/**
 * Battle VFX drawn into the pixel layer: one effect per move type (projectile, impact),
 * status-move auras, reaction bursts, and the ambient overlays conditions leave on a
 * Zorling. All motion is in game pixels and drawn as whole pixels.
 */

import { Container, Graphics } from 'pixi.js';
import { Rng } from '@engine/core';
import { lighten, mix } from '@engine/core/color';
import { conditionColors, typeColors, type ConditionId, type TypeId } from '@game/style/tokens';
import { lineCells, particleSize, ParticleSystem, type Particle } from './particles';

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Draws particles into a Graphics at whole pixels. */
function drawParticles(g: Graphics, list: readonly Particle[]): void {
  for (const p of list) {
    const s = particleSize(p);
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    const fade = p.age > p.life * 0.7 && (Math.floor(p.age * 30) & 1) === 1;
    if (fade) continue; // flicker out instead of alpha (keeps the palette crisp)
    if (p.shape === 'streak') {
      const sp = Math.hypot(p.vx, p.vy) || 1;
      const len = Math.max(2, s * 3);
      for (const [cx, cy] of lineCells(x, y, x - (p.vx / sp) * len, y - (p.vy / sp) * len)) {
        g.rect(cx, cy, 1, 1).fill({ color: p.color });
      }
    } else if (p.shape === 'glint') {
      g.rect(x - s, y, s * 2 + 1, 1).fill({ color: p.color });
      g.rect(x, y - s, 1, s * 2 + 1).fill({ color: p.color });
    } else {
      g.rect(x - Math.floor(s / 2), y - Math.floor(s / 2), s, s).fill({ color: p.color });
    }
  }
}

interface Effect {
  update(dt: number): void;
  readonly done: boolean;
}

/** Shades of a type color, light to dark. */
function shades(base: number): [number, number, number] {
  return [lighten(base, 0.55), base, mix(base, 0x000000, 0.25)];
}

/** How long a move's projectile takes to reach the target, per type (seconds). */
export const IMPACT_TIME: Readonly<Record<TypeId, number>> = {
  fire: 0.32,
  water: 0.34,
  nature: 0.36,
  electric: 0.1,
  ice: 0.22,
  earth: 0.3,
  wind: 0.3,
  metal: 0.12,
};

/** Longest a move effect runs (impact + its particles), for timing checks. */
export const MOVE_VFX_MAX = 1.2;

/**
 * A move's effect: travels from `from` to `to`, then bursts. `impacted` turns true at the
 * moment of the hit (the scene starts the hurt animation then). Status moves (no power)
 * swirl sparkles onto the target instead.
 */
export class MoveVfx extends Container implements Effect {
  private readonly g = new Graphics();
  private readonly ps = new ParticleSystem();
  private readonly rng: Rng;
  private readonly colors: [number, number, number];
  private t = 0;
  private hit = false;
  private emitAcc = 0;
  readonly impactTime: number;

  constructor(
    private readonly type: TypeId,
    private readonly from: Point,
    private readonly to: Point,
    private readonly status = false,
    seed = 1,
  ) {
    super({ label: `vfx:${type}` });
    this.eventMode = 'none';
    this.addChild(this.g);
    this.rng = new Rng(seed);
    this.colors = shades(typeColors[type].base);
    this.impactTime = status ? 0.4 : IMPACT_TIME[type];
  }

  get impacted(): boolean {
    return this.hit;
  }

  get done(): boolean {
    return this.hit && this.ps.count === 0 && this.t > this.impactTime + 0.15;
  }

  update(dt: number): void {
    this.t += dt;
    if (this.t > MOVE_VFX_MAX + this.impactTime) this.ps.clear();
    const k = Math.min(1, this.t / this.impactTime);
    if (!this.hit) {
      this.emitAcc += dt;
      while (this.emitAcc >= 1 / 60) {
        this.emitAcc -= 1 / 60;
        if (this.status) this.emitStatus(k);
        else this.emitTravel(k);
      }
      if (this.t >= this.impactTime) {
        this.hit = true;
        if (this.status) this.burst(14, 30, 0.4);
        else this.impact();
      }
    }
    this.ps.update(dt);
    this.g.clear();
    if (!this.hit || this.t < this.impactTime + 0.18) this.drawShape(k);
    drawParticles(this.g, this.ps.particles);
  }

  private pick(): number {
    return this.colors[this.rng.int(0, 2)] ?? this.colors[1];
  }

  /** Point along the path at `k` (0 = user, 1 = target). */
  private along(k: number, arc: number): Point {
    return {
      x: this.from.x + (this.to.x - this.from.x) * k,
      y: this.from.y + (this.to.y - this.from.y) * k - Math.sin(k * Math.PI) * arc,
    };
  }

  private emitTravel(k: number): void {
    const r = this.rng;
    switch (this.type) {
      case 'fire': {
        const p = this.along(k, 18);
        for (let i = 0; i < 3; i++) {
          this.ps.spawn({
            x: p.x + r.float(-3, 3),
            y: p.y + r.float(-3, 3),
            vx: r.float(-15, 15),
            vy: r.float(-40, -15),
            life: r.float(0.2, 0.4),
            size: r.int(1, 3),
            shrink: true,
            color: this.pick(),
          });
        }
        break;
      }
      case 'water': {
        for (let d = 0; d < 3; d++) {
          const p = this.along(Math.max(0, k - d * 0.08), 24);
          this.ps.spawn({
            x: p.x,
            y: p.y,
            life: 0.12,
            size: 2,
            color: d ? this.colors[0] : 0xffffff,
          });
        }
        break;
      }
      case 'nature': {
        const p = this.along(k, 10);
        const a = this.t * 14;
        for (let i = 0; i < 3; i++) {
          const ai = a + (i * Math.PI * 2) / 3;
          this.ps.spawn({
            x: p.x + Math.cos(ai) * 7,
            y: p.y + Math.sin(ai) * 5,
            life: 0.1,
            size: 2,
            color: this.colors[i % 2 === 0 ? 1 : 2],
          });
        }
        break;
      }
      case 'ice': {
        const p = this.along(k, 0);
        const vx = (this.to.x - this.from.x) / this.impactTime;
        const vy = (this.to.y - this.from.y) / this.impactTime;
        this.ps.spawn({
          x: p.x,
          y: p.y + r.float(-4, 4),
          vx,
          vy,
          life: 0.06,
          size: 2,
          shape: 'streak',
          color: 0xffffff,
        });
        this.ps.spawn({
          x: p.x,
          y: p.y + r.float(-6, 6),
          vx: vx * 0.2,
          vy: vy * 0.2,
          life: 0.25,
          color: this.colors[0],
        });
        break;
      }
      case 'earth': {
        if (r.chance(0.35)) {
          const fall = 90 * (1 - k);
          this.ps.spawn({
            x: this.to.x + r.float(-18, 18),
            y: this.to.y - 20 - fall,
            vy: 240,
            life: 0.12,
            size: r.int(2, 4),
            color: this.pick(),
          });
        }
        break;
      }
      case 'wind': {
        const p = this.along(k, 8);
        const off = Math.sin(this.t * 30) * 8;
        this.ps.spawn({
          x: p.x,
          y: p.y + off,
          vx: (this.to.x - this.from.x) * 0.6,
          vy: Math.cos(this.t * 30) * 60,
          life: 0.18,
          shape: 'streak',
          color: r.chance(0.5) ? 0xffffff : this.colors[0],
        });
        break;
      }
      case 'electric':
      case 'metal':
        break; // drawn as shapes (bolt / slashes)
    }
  }

  private emitStatus(k: number): void {
    const r = this.rng;
    const a = r.float(0, Math.PI * 2);
    const rad = 34 * (1 - k) + 6;
    this.ps.spawn({
      x: this.to.x + Math.cos(a) * rad,
      y: this.to.y + Math.sin(a) * rad * 0.7,
      vx: -Math.cos(a) * 40,
      vy: -Math.sin(a) * 30 - 10,
      life: 0.3,
      shape: r.chance(0.3) ? 'glint' : 'square',
      size: r.int(1, 2),
      color: this.pick(),
    });
  }

  private impact(): void {
    const r = this.rng;
    const { x, y } = this.to;
    switch (this.type) {
      case 'fire':
        for (let i = 0; i < 26; i++) {
          this.ps.spawn({
            x: x + r.float(-8, 8),
            y: y + r.float(-6, 10),
            vx: r.float(-50, 50),
            vy: r.float(-110, -30),
            ay: 40,
            drag: 0.2,
            life: r.float(0.3, 0.6),
            size: r.int(2, 4),
            shrink: true,
            color: r.chance(0.3) ? 0xfff1a8 : this.pick(),
          });
        }
        break;
      case 'water':
        for (let i = 0; i < 24; i++) {
          this.ps.spawn({
            x: x + r.float(-6, 6),
            y,
            vx: r.float(-80, 80),
            vy: r.float(-130, -40),
            ay: 420,
            life: r.float(0.35, 0.55),
            size: r.int(1, 3),
            color: r.chance(0.3) ? 0xffffff : this.pick(),
          });
        }
        break;
      case 'nature':
        for (let i = 0; i < 18; i++) {
          this.ps.spawn({
            x: x + r.float(-6, 6),
            y: y + r.float(-6, 6),
            vx: r.float(-70, 70),
            vy: r.float(-70, 20),
            ay: 70,
            drag: 0.15,
            life: r.float(0.45, 0.7),
            size: 2,
            color: this.pick(),
          });
        }
        break;
      case 'electric':
        this.burst(22, 140, 0.25, 'streak');
        break;
      case 'ice':
        this.burst(14, 90, 0.35, 'streak');
        for (let i = 0; i < 8; i++) {
          this.ps.spawn({
            x: x + r.float(-16, 16),
            y: y + r.float(-18, 12),
            life: r.float(0.4, 0.7),
            size: r.int(1, 2),
            shape: 'glint',
            color: 0xffffff,
          });
        }
        break;
      case 'earth':
        for (let i = 0; i < 22; i++) {
          this.ps.spawn({
            x: x + r.float(-14, 14),
            y: y + 14 + r.float(-2, 4),
            vx: r.float(-90, 90),
            vy: r.float(-50, -5),
            ay: 120,
            drag: 0.1,
            life: r.float(0.35, 0.6),
            size: r.int(2, 4),
            shrink: true,
            color: r.chance(0.4) ? lighten(this.colors[1], 0.3) : this.pick(),
          });
        }
        break;
      case 'wind':
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * Math.PI * 2;
          this.ps.spawn({
            x: x + Math.cos(a) * 6,
            y: y + Math.sin(a) * 4,
            vx: Math.cos(a + 1.2) * 110,
            vy: Math.sin(a + 1.2) * 70,
            drag: 0.2,
            life: 0.4,
            shape: 'streak',
            color: i % 2 ? 0xffffff : this.colors[0],
          });
        }
        break;
      case 'metal':
        this.burst(16, 120, 0.3, 'streak', 0xffffff);
        break;
    }
  }

  private burst(
    n: number,
    speed: number,
    life: number,
    shape: Particle['shape'] = 'square',
    color?: number,
  ): void {
    const r = this.rng;
    for (let i = 0; i < n; i++) {
      const a = r.float(0, Math.PI * 2);
      const s = r.float(speed * 0.4, speed);
      this.ps.spawn({
        x: this.to.x,
        y: this.to.y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        drag: 0.1,
        life: r.float(life * 0.6, life),
        size: r.int(1, 2),
        shape,
        color: color ?? this.pick(),
      });
    }
  }

  /** Shapes that are not particles: the electric bolt and metal slashes. */
  private drawShape(k: number): void {
    const g = this.g;
    if (this.status) return;
    if (this.type === 'electric') {
      const flick = Math.floor(this.t * 20);
      if (flick % 3 === 2) return;
      const r = new Rng(flick + 7);
      const steps = 7;
      let px = this.from.x;
      let py = this.from.y;
      for (let i = 1; i <= steps; i++) {
        const nx =
          this.from.x + ((this.to.x - this.from.x) * i) / steps + (i < steps ? r.float(-6, 6) : 0);
        const ny =
          this.from.y + ((this.to.y - this.from.y) * i) / steps + (i < steps ? r.float(-8, 8) : 0);
        for (const [cx, cy] of lineCells(px, py, nx, ny)) {
          g.rect(cx - 1, cy - 1, 3, 3).fill({ color: this.colors[1] });
        }
        for (const [cx, cy] of lineCells(px, py, nx, ny))
          g.rect(cx, cy, 1, 1).fill({ color: 0xffffff });
        px = nx;
        py = ny;
      }
    } else if (this.type === 'metal') {
      const grow = Math.min(1, (this.t / (this.impactTime + 0.12)) * 1.4);
      for (let i = 0; i < 3; i++) {
        const ox = this.to.x - 14 + i * 10;
        const oy = this.to.y - 18 + i * 3;
        const len = 30 * grow;
        for (const [cx, cy] of lineCells(ox, oy, ox + len * 0.6, oy + len)) {
          g.rect(cx, cy, 2, 1).fill({ color: i === 1 ? 0xffffff : this.colors[0] });
        }
      }
    } else if (!this.hit && this.type === 'water') {
      const p = this.along(k, 24);
      g.rect(Math.round(p.x) - 2, Math.round(p.y) - 2, 5, 5).fill({ color: this.colors[1] });
      g.rect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2).fill({ color: 0xffffff });
    } else if (!this.hit && this.type === 'fire') {
      const p = this.along(k, 18);
      g.rect(Math.round(p.x) - 3, Math.round(p.y) - 3, 6, 6).fill({ color: this.colors[1] });
      g.rect(Math.round(p.x) - 1, Math.round(p.y) - 2, 3, 3).fill({ color: 0xfff1a8 });
    }
  }
}

/** A reaction's burst: an expanding pixel ring in both types' colors plus sparks. */
export class ReactionVfx extends Container implements Effect {
  private readonly g = new Graphics();
  private readonly ps = new ParticleSystem();
  private t = 0;

  constructor(
    private readonly at: Point,
    private readonly colors: readonly number[],
    seed = 3,
  ) {
    super({ label: 'vfx:reaction' });
    this.eventMode = 'none';
    this.addChild(this.g);
    const r = new Rng(seed);
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2 + r.float(-0.1, 0.1);
      const s = r.float(80, 160);
      this.ps.spawn({
        x: at.x,
        y: at.y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s * 0.7,
        drag: 0.08,
        life: r.float(0.4, 0.7),
        size: r.int(1, 3),
        shape: i % 3 === 0 ? 'glint' : 'square',
        color: colors[i % colors.length] ?? 0xffffff,
      });
    }
  }

  get done(): boolean {
    return this.t > 0.75;
  }

  update(dt: number): void {
    this.t += dt;
    this.ps.update(dt);
    const g = this.g.clear();
    if (this.t < 0.35) {
      const rad = 8 + this.t * 160;
      const n = Math.round(rad * 2);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const c = this.colors[i % this.colors.length] ?? 0xffffff;
        g.rect(
          Math.round(this.at.x + Math.cos(a) * rad),
          Math.round(this.at.y + Math.sin(a) * rad * 0.6),
          2,
          2,
        ).fill({
          color: c,
        });
      }
    }
    drawParticles(g, this.ps.particles);
  }
}

/** Short white sparkle stars (a successful capture, a level up). */
export class SparkleVfx extends Container implements Effect {
  private readonly g = new Graphics();
  private readonly ps = new ParticleSystem();
  private t = 0;

  constructor(at: Point, color = 0xfff1a8, seed = 5) {
    super({ label: 'vfx:sparkle' });
    this.eventMode = 'none';
    this.addChild(this.g);
    const r = new Rng(seed);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      this.ps.spawn({
        x: at.x,
        y: at.y,
        vx: Math.cos(a) * r.float(30, 60),
        vy: Math.sin(a) * r.float(30, 60) - 20,
        drag: 0.2,
        life: r.float(0.5, 0.8),
        size: r.int(1, 2),
        shape: 'glint',
        color: i % 2 ? 0xffffff : color,
      });
    }
  }

  get done(): boolean {
    return this.t > 0.85;
  }

  update(dt: number): void {
    this.t += dt;
    this.ps.update(dt);
    drawParticles(this.g.clear(), this.ps.particles);
  }
}

/** Overlay ids: the 8 conditions plus the lingering reaction effects that have a look. */
export type OverlayId = ConditionId | 'frozen' | 'rooted' | 'overload' | 'steam-burst';

/** Particles per second for each overlay. */
const OVERLAY_RATE: Readonly<Record<OverlayId, number>> = {
  burning: 14,
  wet: 7,
  overgrown: 5,
  charged: 9,
  chilled: 7,
  muddy: 4,
  airborne: 6,
  exposed: 4,
  frozen: 10,
  rooted: 6,
  overload: 10,
  'steam-burst': 6,
};

/**
 * Ambient particles that show a Zorling's conditions on the field (flames for Burning, drips
 * for Wet, sparks for Charged, …). Its origin is the Zorling's ground point.
 */
export class ConditionOverlay extends Container {
  private readonly g = new Graphics();
  private readonly ps = new ParticleSystem();
  private readonly rng = new Rng(11);
  private readonly acc = new Map<OverlayId, number>();
  private ids: readonly OverlayId[] = [];
  /** Half width and height of the figure in game pixels. */
  private w = 24;
  private h = 56;

  constructor() {
    super({ label: 'condition-overlay' });
    this.eventMode = 'none';
    this.addChild(this.g);
  }

  /** Sets the active overlays and the figure size (sprite px). */
  set(ids: readonly OverlayId[], size = 96): void {
    this.ids = ids;
    this.w = Math.round(size * 0.24);
    this.h = Math.round(size * 0.55);
  }

  clear(): void {
    this.ids = [];
    this.ps.clear();
    this.g.clear();
  }

  update(dt: number): void {
    for (const id of this.ids) {
      let a = (this.acc.get(id) ?? 0) + dt * OVERLAY_RATE[id];
      while (a >= 1) {
        a -= 1;
        this.spawnFor(id);
      }
      this.acc.set(id, a);
    }
    this.ps.update(dt);
    const g = this.g.clear();
    if (this.ids.includes('frozen')) {
      // An icy rim at the feet.
      g.rect(-this.w, -2, this.w * 2, 2).fill({ color: 0xd3f6ff });
      g.rect(-this.w + 3, -4, this.w * 2 - 6, 2).fill({ color: 0x8fe3f5 });
    }
    drawParticles(g, this.ps.particles);
  }

  private spawnFor(id: OverlayId): void {
    const r = this.rng;
    const w = this.w;
    const h = this.h;
    const body = (): { x: number; y: number } => ({ x: r.float(-w, w), y: -r.float(4, h) });
    const color = (c: ConditionId): number => conditionColors[c].color;
    switch (id) {
      case 'burning': {
        const p = body();
        this.ps.spawn({
          ...p,
          vy: -r.float(20, 40),
          vx: r.float(-5, 5),
          life: r.float(0.3, 0.6),
          size: r.int(1, 3),
          shrink: true,
          color: r.chance(0.4) ? 0xffd23f : color('burning'),
        });
        break;
      }
      case 'wet':
        this.ps.spawn({
          x: r.float(-w, w),
          y: -h * r.float(0.5, 1),
          vy: 30,
          ay: 160,
          life: 0.5,
          size: 1,
          color: r.chance(0.5) ? 0xffffff : color('wet'),
        });
        break;
      case 'overgrown':
        this.ps.spawn({
          x: r.float(-w, w),
          y: -r.float(0, 8),
          vy: -r.float(10, 18),
          vx: r.float(-6, 6),
          life: 0.8,
          size: 2,
          color: r.chance(0.5) ? 0x4cbf56 : color('overgrown'),
        });
        break;
      case 'charged': {
        const p = body();
        this.ps.spawn({
          ...p,
          life: r.float(0.08, 0.16),
          size: r.int(1, 2),
          shape: 'glint',
          color: r.chance(0.5) ? 0xffffff : color('charged'),
        });
        break;
      }
      case 'chilled':
        this.ps.spawn({
          x: r.float(-w - 6, w + 6),
          y: -h - 6,
          vy: r.float(14, 24),
          vx: r.float(-6, 6),
          life: 1.2,
          size: 1,
          color: r.chance(0.5) ? 0xffffff : color('chilled'),
        });
        break;
      case 'muddy':
        this.ps.spawn({
          x: r.float(-w, w),
          y: -r.float(2, h * 0.5),
          vy: 10,
          ay: 120,
          life: 0.5,
          size: 2,
          color: r.chance(0.5) ? 0x6b4f2e : color('muddy'),
        });
        break;
      case 'airborne':
        this.ps.spawn({
          x: r.chance(0.5) ? -w - 8 : w + 8,
          y: -r.float(0, 14),
          vx: r.chance(0.5) ? 50 : -50,
          life: 0.4,
          shape: 'streak',
          color: color('airborne'),
        });
        break;
      case 'exposed': {
        const p = body();
        this.ps.spawn({ ...p, life: 0.35, size: 2, shape: 'glint', color: color('exposed') });
        break;
      }
      case 'frozen': {
        const p = body();
        this.ps.spawn({
          ...p,
          life: 0.5,
          size: r.int(1, 2),
          shape: 'glint',
          color: r.chance(0.5) ? 0xffffff : 0x8fe3f5,
        });
        break;
      }
      case 'rooted':
        this.ps.spawn({
          x: r.float(-w, w),
          y: -1,
          vy: -r.float(14, 26),
          life: 0.5,
          size: 2,
          color: r.chance(0.5) ? 0x3f8f3a : 0x8b6b45,
        });
        break;
      case 'overload': {
        this.ps.spawn({
          x: r.float(-10, 10),
          y: -h - 4,
          vx: r.float(-20, 20),
          vy: -r.float(5, 15),
          life: 0.3,
          size: 2,
          shape: 'glint',
          color: r.chance(0.5) ? 0xffffff : 0xffd23f,
        });
        break;
      }
      case 'steam-burst':
        this.ps.spawn({
          x: r.float(-w, w),
          y: -r.float(h * 0.4, h),
          vy: -r.float(10, 20),
          vx: r.float(-8, 8),
          drag: 0.5,
          life: 0.9,
          size: r.int(2, 3),
          shrink: true,
          color: r.chance(0.5) ? 0xe8eef2 : 0xc7d1d8,
        });
        break;
    }
  }
}
