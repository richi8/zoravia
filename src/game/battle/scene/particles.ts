/**
 * Tiny particle simulation for battle VFX (pure: no rendering). Particles live in game
 * pixels; the view draws each one as whole-pixel squares or short streaks.
 */

export type ParticleShape = 'square' | 'streak' | 'glint';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Constant acceleration (gravity is `ay > 0`). */
  ax: number;
  ay: number;
  /** Velocity kept per second (1 = none lost, 0.1 = strong drag). */
  drag: number;
  age: number;
  life: number;
  size: number;
  color: number;
  shape: ParticleShape;
  /** Shrinks to nothing over its life. */
  shrink: boolean;
}

export type ParticleInit = Partial<Particle> & Pick<Particle, 'x' | 'y' | 'life' | 'color'>;

export class ParticleSystem {
  readonly particles: Particle[] = [];

  spawn(p: ParticleInit): void {
    this.particles.push({
      vx: 0,
      vy: 0,
      ax: 0,
      ay: 0,
      drag: 1,
      age: 0,
      size: 1,
      shape: 'square',
      shrink: false,
      ...p,
    });
  }

  get count(): number {
    return this.particles.length;
  }

  update(dt: number): void {
    const list = this.particles;
    let n = 0;
    for (const p of list) {
      p.age += dt;
      if (p.age >= p.life) continue;
      const keep = p.drag === 1 ? 1 : Math.pow(p.drag, dt);
      p.vx = (p.vx + p.ax * dt) * keep;
      p.vy = (p.vy + p.ay * dt) * keep;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      list[n++] = p;
    }
    list.length = n;
  }

  clear(): void {
    this.particles.length = 0;
  }
}

/** Current size of a particle (shrinking ones get smaller with age), at least 1 px. */
export function particleSize(p: Particle): number {
  if (!p.shrink) return p.size;
  return Math.max(1, Math.round(p.size * (1 - p.age / p.life)));
}

/** Whole-pixel cells of a line from (x0, y0) to (x1, y1) (Bresenham). */
export function lineCells(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const tx = Math.round(x1);
  const ty = Math.round(y1);
  const dx = Math.abs(tx - x);
  const dy = -Math.abs(ty - y);
  const sx = x < tx ? 1 : -1;
  const sy = y < ty ? 1 : -1;
  let err = dx + dy;
  const out: [number, number][] = [];
  for (;;) {
    out.push([x, y]);
    if (x === tx && y === ty) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return out;
}
