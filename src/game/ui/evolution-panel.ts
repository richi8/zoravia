/**
 * Evolution (C22b; C32 "Stage", picked at the C32 preview round without the rings): the world
 * dims to navy, gold rays turn slowly behind the Zorling at 2×, and sparkles rise around it.
 * It turns into a white silhouette, the old and new silhouettes swap faster and faster, a
 * full-screen white flash, and the new form shows with a burst of sparkles and its name.
 * `E` skips to the flash. Calls `onDone` once at the end; the caller then closes it and
 * tells what happened.
 *
 * It covers the whole screen: open it with the screen size (`resize` keeps it filled).
 */

import { Container, Graphics, Rectangle, Sprite, type Texture } from 'pixi.js';
import { Rng } from '@engine/core/rng';
import { pixelTexture } from '@engine/render/pixel-texture';
import { type UiInput, type Widget } from '@engine/ui';
import { brand, paper } from '../style/tokens';
import { gameSettings } from '@game/settings';
import { uiText } from './text';

export interface EvolutionOptions {
  readonly title: string;
  /** Name of the new form, shown at the reveal. */
  readonly intoName?: string;
  /** Colored sprites and white silhouettes of the old and new form (same size). */
  readonly from: { readonly color: Texture; readonly white: Texture };
  readonly into: { readonly color: Texture; readonly white: Texture };
  readonly onDone: (panel: EvolutionPanel) => void;
}

/** Timeline, seconds. */
const T = { dim: 0.4, glow: 0.6, swap: 1.1, flash: 3.1, reveal: 3.45, end: 4.6 } as const;
/** Zorling scale on the stage. */
const SCALE = 2;
const NAVY = 0x141a3c;
const GOLD = brand.sunbeam;
/** Size of the ray texture (game px before its ×2 scale). */
const RAYS = 160;

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  color: number;
  big: boolean;
}

export class EvolutionPanel implements Widget<Container> {
  readonly view = new Container({ label: 'evolution' });
  private w = 480;
  private h = 270;
  private readonly dim = new Graphics();
  private readonly rays: Sprite;
  private readonly stage = new Container();
  private readonly oldColor: Sprite;
  private readonly oldWhite: Sprite;
  private readonly newColor: Sprite;
  private readonly newWhite: Sprite;
  private readonly sparks = new Graphics();
  private readonly flash = new Graphics();
  private readonly title;
  private readonly name;
  private readonly list: Spark[] = [];
  private readonly rng = new Rng(7);
  private spawnAcc = 0;
  private burst = false;
  private time = 0;
  private finished = false;

  constructor(private readonly options: EvolutionOptions) {
    // One shared texture (never destroyed): the panel may still fade out after closing.
    rayTexture ??= pixelTexture(rayArt());
    this.rays = new Sprite(rayTexture);
    this.rays.anchor.set(0.5);
    this.rays.scale.set(2);
    const at = (t: Texture): Sprite => {
      const s = new Sprite(t);
      s.anchor.set(0.5);
      return s;
    };
    this.oldColor = at(options.from.color);
    this.oldWhite = at(options.from.white);
    this.newColor = at(options.into.color);
    this.newWhite = at(options.into.white);
    this.stage.scale.set(SCALE);
    this.stage.addChild(this.oldColor, this.newColor, this.oldWhite, this.newWhite);
    this.title = uiText('name', options.title, paper.light);
    this.name = uiText('callout', options.intoName ?? '', GOLD);
    this.view.addChild(this.dim, this.rays, this.sparks, this.stage, this.title, this.name);
    this.view.addChild(this.flash);
    this.view.eventMode = 'static';
    this.resize(this.w, this.h);
    this.apply();
  }

  get width(): number {
    return this.w;
  }

  get height(): number {
    return this.h;
  }

  /** Seconds into the animation. */
  get elapsed(): number {
    return this.time;
  }

  /** Fills a screen of `w`×`h` game px. */
  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.view.hitArea = new Rectangle(0, 0, w, h);
    const cx = Math.round(w / 2);
    const cy = Math.round(h / 2) - 10;
    this.rays.position.set(cx, cy);
    this.stage.position.set(cx, cy);
    this.flash.clear().rect(0, 0, w, h).fill({ color: 0xffffff });
    this.place();
  }

  handleInput(input: UiInput): void {
    if (input.confirmPressed() && this.time < T.flash) this.time = T.flash;
  }

  update(dt: number): void {
    if (this.finished) return;
    this.time += dt;
    this.updateSparks(dt);
    this.apply();
    if (this.time >= T.end) {
      this.finished = true;
      this.options.onDone(this);
    }
  }

  private apply(): void {
    const t = this.time;
    const { w, h } = this;
    this.dim
      .clear()
      .rect(0, 0, w, h)
      .fill({ color: NAVY, alpha: 0.78 * clamp01(t / T.dim) });
    // Rays: fade in, grow brighter during the swap, ease off after the reveal.
    const rayA =
      t < T.flash
        ? 0.22 * clamp01((t - T.dim * 0.5) / T.glow) + 0.1 * clamp01((t - T.swap) / 1.5)
        : 0.2 * (1 - clamp01((t - T.reveal) / (T.end - T.reveal)) * 0.5);
    this.rays.alpha = rayA;
    this.rays.rotation = t * 0.25;
    const showNew = t >= T.flash || (t >= T.swap && swapPhase(t));
    this.oldColor.visible = t < T.swap;
    this.newColor.visible = t >= T.flash;
    this.oldWhite.visible = !showNew && t >= T.glow * 0.5;
    this.oldWhite.alpha = clamp01((t - T.glow * 0.5) / (T.swap - T.glow * 0.5));
    this.newWhite.visible = showNew && t < T.end;
    this.newWhite.alpha = t >= T.reveal ? 1 - clamp01((t - T.reveal) / 0.5) : 1;
    this.flash.visible = t >= T.flash && t < T.reveal + 0.15;
    // Flashes off (C33): only a soft glow instead of a white screen.
    const peak = gameSettings().flashes ? 0.92 : 0.2;
    this.flash.alpha = peak * (1 - clamp01((t - T.flash) / (T.reveal + 0.15 - T.flash)));
    this.title.visible = t < T.flash;
    this.title.alpha = clamp01((t - 0.2) / 0.3);
    this.name.visible = t >= T.reveal && this.name.text !== '';
    this.name.alpha = clamp01((t - T.reveal) / 0.25);
    if (t >= T.flash && !this.burst) {
      this.burst = true;
      for (let i = 0; i < 40; i++) this.spark(true);
    }
    this.place();
  }

  private place(): void {
    const { w, h } = this;
    const bottom = Math.round(h / 2) - 10 + 48 * SCALE + 8;
    this.title.position.set(Math.round((w - this.title.width) / 2), Math.min(h - 24, bottom));
    this.name.position.set(Math.round((w - this.name.width) / 2), Math.min(h - 28, bottom));
  }

  private spark(burst: boolean): void {
    const r = this.rng;
    const a = r.float(0, Math.PI * 2);
    const d = burst ? r.float(8, 30) : r.float(40, 110);
    const speed = burst ? r.float(60, 130) : r.float(10, 24);
    this.list.push({
      x: Math.cos(a) * d,
      y: Math.sin(a) * d * 0.8,
      vx: burst ? Math.cos(a) * speed : r.float(-4, 4),
      vy: burst ? Math.sin(a) * speed * 0.8 - 10 : -speed,
      age: 0,
      life: r.float(0.6, 1.2),
      color: r.chance(0.5) ? 0xffffff : burst && r.chance(0.4) ? 0x9be37a : GOLD,
      big: r.chance(0.3),
    });
  }

  private updateSparks(dt: number): void {
    if (this.time > T.dim && this.time < T.flash) {
      // Rising sparkles, more as the swap speeds up.
      this.spawnAcc += dt * (12 + 30 * clamp01((this.time - T.swap) / 2));
      while (this.spawnAcc >= 1) {
        this.spawnAcc -= 1;
        this.spark(false);
      }
    }
    let n = 0;
    for (const s of this.list) {
      s.age += dt;
      if (s.age >= s.life) continue;
      s.vx *= Math.pow(0.3, dt);
      s.vy *= Math.pow(0.5, dt);
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      this.list[n++] = s;
    }
    this.list.length = n;
    const g = this.sparks.clear();
    const cx = Math.round(this.w / 2);
    const cy = Math.round(this.h / 2) - 10;
    for (const s of this.list) {
      // Flicker out at the end (keeps the palette crisp).
      if (s.age > s.life * 0.7 && Math.floor(s.age * 30) % 2 === 1) continue;
      const x = Math.round(cx + s.x);
      const y = Math.round(cy + s.y);
      g.rect(x, y, 1, 1);
      if (s.big) g.rect(x - 1, y, 3, 1).rect(x, y - 1, 1, 3);
      g.fill({ color: s.color });
    }
  }
}

let rayTexture: Texture | undefined;

/** Gold rays as pixel art: 8 soft wedges fading out from the middle (rotated as a sprite). */
function rayArt(): { width: number; height: number; data: Uint8ClampedArray } {
  const n = RAYS;
  const data = new Uint8ClampedArray(n * n * 4);
  const c = n / 2;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - c, y - c) / c;
      if (d > 1) continue;
      const k = Math.sin(Math.atan2(y - c, x - c) * 8);
      if (k < 0.55) continue;
      // Dithered fade toward the edge.
      const keep = 1 - d;
      if (keep < 0.12 && (x + y) % 2) continue;
      const i = (y * n + x) * 4;
      data[i] = (GOLD >> 16) & 0xff;
      data[i + 1] = (GOLD >> 8) & 0xff;
      data[i + 2] = GOLD & 0xff;
      data[i + 3] = Math.round(255 * Math.min(1, keep * 1.6));
    }
  }
  return { width: n, height: n, data };
}

/** True on the "new form" half of the swap, which gets faster toward the flash. */
function swapPhase(t: number): boolean {
  const k = clamp01((t - T.swap) / (T.flash - T.swap));
  // Phase = ∫ frequency, frequency rising from 2 to 14 swaps per second.
  const seconds = t - T.swap;
  const phase = seconds * (2 + 6 * k);
  return Math.floor(phase * 2) % 2 === 1;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
