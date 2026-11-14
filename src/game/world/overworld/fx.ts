/**
 * Small overworld effects (C32): grass bits when someone steps into tall grass, dust puffs
 * from the player's feet on paths, puffs where a wild Zorling leaves, and the sparkle of an
 * item picked up. Particles live in world pixels and draw straight into the frame's
 * `PixelBuffer` as whole pixels. Pure: no DOM; randomness is seeded.
 */

import { Rng, type Seed } from '@engine/core/rng';
import type { PixelBuffer } from '@engine/render/pixel-buffer';

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Gravity, px/s². */
  ay: number;
  age: number;
  life: number;
  color: number;
  /** 1 = single pixel, 2 = 2×2, 3 = a "+" glint. */
  size: 1 | 2 | 3;
}

/** Cap so a long walk through grass can never pile up particles. */
const MAX_BITS = 300;

export class WorldFx {
  private readonly bits: Bit[] = [];
  private readonly rng: Rng;

  constructor(seed: Seed) {
    this.rng = new Rng(seed);
  }

  get count(): number {
    return this.bits.length;
  }

  private add(b: Omit<Bit, 'age'>): void {
    if (this.bits.length >= MAX_BITS) this.bits.shift();
    this.bits.push({ ...b, age: 0 });
  }

  /** Grass bits flicked up at a foot line (`x`, `y` world px), in the grass colors. */
  rustle(x: number, y: number, colors: readonly number[]): void {
    const r = this.rng;
    for (let i = 0; i < 6; i++) {
      this.add({
        x: x + r.float(-5, 5),
        y: y - r.float(0, 3),
        vx: r.float(-26, 26),
        vy: r.float(-48, -22),
        ay: 150,
        life: r.float(0.3, 0.5),
        color: colors[r.int(0, colors.length - 1)] ?? 0x56a654,
        size: 1,
      });
    }
  }

  /** A soft dust puff behind a step (`dx` = direction of the step along x, -1/0/1). */
  dust(x: number, y: number, dx: number, color: number): void {
    const r = this.rng;
    for (let i = 0; i < 3; i++) {
      this.add({
        x: x + r.float(-3, 3),
        y: y - r.float(0, 1),
        vx: -dx * r.float(6, 16) + r.float(-6, 6),
        vy: r.float(-10, -3),
        ay: 0,
        life: r.float(0.25, 0.4),
        color,
        size: i === 0 ? 2 : 1,
      });
    }
  }

  /** A white puff where a creature pops away. */
  puff(x: number, y: number): void {
    const r = this.rng;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const s = r.float(18, 30);
      this.add({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s * 0.6 - 6,
        ay: 0,
        life: r.float(0.3, 0.45),
        color: i % 3 ? 0xffffff : 0xdfe6ee,
        size: 2,
      });
    }
  }

  /** Gold glints rising from a picked-up item. */
  sparkle(x: number, y: number): void {
    const r = this.rng;
    for (let i = 0; i < 9; i++) {
      this.add({
        x: x + r.float(-7, 7),
        y: y + r.float(-6, 2),
        vx: r.float(-8, 8),
        vy: r.float(-34, -14),
        ay: 0,
        life: r.float(0.45, 0.8),
        color: i % 2 ? 0xfff2a8 : 0xffd23f,
        size: i % 3 === 0 ? 3 : 1,
      });
    }
  }

  update(dt: number): void {
    let n = 0;
    for (const b of this.bits) {
      b.age += dt;
      if (b.age >= b.life) continue;
      b.vy += b.ay * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      this.bits[n++] = b;
    }
    this.bits.length = n;
  }

  /** Draws with screen (0, 0) at world (`camX`, `camY`). */
  draw(buf: PixelBuffer, camX: number, camY: number): void {
    for (const b of this.bits) {
      const t = b.age / b.life;
      // Flicker out at the end instead of fading (keeps the palette crisp).
      if (t > 0.7 && (Math.floor(b.age * 30) & 1) === 1) continue;
      const x = Math.round(b.x - camX);
      const y = Math.round(b.y - camY);
      const a = 0.95;
      buf.dot(x, y, b.color, a);
      if (b.size === 2) {
        buf.dot(x + 1, y, b.color, a);
        buf.dot(x, y + 1, b.color, a);
        buf.dot(x + 1, y + 1, b.color, a);
      } else if (b.size === 3 && t < 0.6) {
        buf.dot(x - 1, y, b.color, a * 0.7);
        buf.dot(x + 1, y, b.color, a * 0.7);
        buf.dot(x, y - 1, b.color, a * 0.7);
        buf.dot(x, y + 1, b.color, a * 0.7);
      }
    }
  }
}
