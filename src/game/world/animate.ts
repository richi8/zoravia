/**
 * Per-frame drawing of a baked terrain into a screen `PixelBuffer`: static ground, then the
 * animated layers (water ripples and pulsing foam, flowing lava, swaying tall grass), then
 * props, then vent puffs. A small "software shader": the game screen is at most a few
 * hundred thousand game pixels, so this stays cheap on the CPU. Pure: no DOM.
 */

import { fbm, hash2, valueNoise } from '@engine/core/noise';
import { bayer4 } from '@engine/render/ramp';
import { packColor, type PixelBuffer } from '@engine/render/pixel-buffer';
import { TILE_STYLE, type Biome } from './biomes';
import { Painter } from './props';
import { LIQUID_STRIDE, type TerrainBake } from './terrain';

/** Receives the glowing prop pixels drawn this frame (C32 lighting). */
export interface GlowSink {
  /** Screen pixel `i` was drawn as packed color `px`, with `PropGlow` code `code`. */
  glow(i: number, px: number, code: number): void;
}

/**
 * Draws terrain with screen pixel (0, 0) at world pixel (`camX`, `camY`); `t` in seconds.
 * The layer methods take whole-pixel cameras: `draw` floors its camera, and so do the
 * terrain stream's entry points (C38: a half-pixel camera wrote past the buffer).
 */
export class TerrainRenderer {
  readonly painter: Painter;
  private readonly foam: number;
  private readonly crust: number;
  private readonly lava: number[];
  private readonly tall: number[];

  constructor(
    readonly bake: TerrainBake,
    readonly biome: Biome,
    readonly seed: number,
  ) {
    this.painter = new Painter(biome);
    this.foam = packColor(biome.foam);
    this.crust = this.painter.ramp('bank')[1] ?? 0;
    this.lava = this.painter.ramp('liquid');
    this.tall = this.painter.ramp('tall');
  }

  draw(buf: PixelBuffer, cx: number, cy: number, t: number, sink?: GlowSink): void {
    const camX = Math.floor(cx);
    const camY = Math.floor(cy);
    this.drawBase(buf, camX, camY);
    this.drawLiquid(buf, camX, camY, t);
    this.drawTufts(buf, camX, camY, t);
    this.drawOverlay(buf, camX, camY, sink);
    this.drawVents(buf, camX, camY, t);
  }

  /** The bake's columns on screen, [x0, x1) in screen pixels (empty when x1 <= x0). */
  private span(buf: PixelBuffer, camX: number): [number, number] {
    const ox = this.bake.x - camX;
    return [Math.max(0, ox), Math.min(buf.width, ox + this.bake.width)];
  }

  /** Static ground (row copies, clipped). */
  drawBase(buf: PixelBuffer, camX: number, camY: number): void {
    const { bake } = this;
    const out = buf.data;
    const W = buf.width;
    const ox = bake.x - camX;
    const oy = bake.y - camY;
    const [x0, x1] = this.span(buf, camX);
    if (x1 <= x0) return;
    for (let y = Math.max(0, oy); y < Math.min(buf.height, oy + bake.height); y++) {
      const src = (y - oy) * bake.width + (x0 - ox);
      out.set(bake.base.subarray(src, src + (x1 - x0)), y * W + x0);
    }
  }

  /** Water ripples or flowing lava. */
  drawLiquid(buf: PixelBuffer, camX: number, camY: number, t: number): void {
    const out = buf.data;
    const W = buf.width;
    const H = buf.height;
    const L = this.bake.liquid;
    const lava = this.biome.liquid === 'lava';
    for (let j = 0; j < L.length; j += LIQUID_STRIDE) {
      const wx = L[j + 1] ?? 0;
      const wy = L[j + 2] ?? 0;
      const sx = wx - camX;
      const sy = wy - camY;
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
      const m = (L[j + 3] ?? 0) / 1000;
      const depth = (L[j + 4] ?? 0) / 1000;
      out[sy * W + sx] = lava
        ? this.lavaPx(wx, wy, m, depth, t)
        : this.waterPx(wx, wy, m, depth, t);
    }
  }

  /** Prop pixels (lit ones reported to `sink`). */
  drawOverlay(buf: PixelBuffer, camX: number, camY: number, sink?: GlowSink): void {
    const { bake } = this;
    const out = buf.data;
    const W = buf.width;
    const ox = bake.x - camX;
    const oy = bake.y - camY;
    const [x0, x1] = this.span(buf, camX);
    if (x1 <= x0) return;
    for (let y = Math.max(0, oy); y < Math.min(buf.height, oy + bake.height); y++) {
      const src = (y - oy) * bake.width - ox;
      const row = y * W;
      for (let x = x0; x < x1; x++) {
        const c = bake.overlay[src + x] ?? 0;
        if (!c) continue;
        out[row + x] = c;
        if (sink) {
          const g = bake.glow[src + x] ?? 0;
          if (g) sink.glow(row + x, c, g);
        }
      }
    }
  }

  /** Vent puffs. */
  drawVents(buf: PixelBuffer, camX: number, camY: number, t: number): void {
    for (const v of this.bake.vents) {
      for (let k = 0; k < 5; k++) {
        const ph = (t * 0.6 + k / 5) % 1;
        const x = v.x + Math.sin(ph * 6 + k) * 2 + ph * 6 - camX;
        const y = v.y - ph * 26 - camY;
        const a = 0.55 * (1 - ph);
        const r = 1 + ph * 2.5;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++)
            if (dx * dx + dy * dy <= r * r) buf.dot(x + dx, y + dy, 0xd8d0cc, a);
        }
      }
    }
  }

  /**
   * Draws the swaying tall-grass tufts. With `front`, only tufts whose base is below
   * `front.baseY` and inside the `front` pixel box (world px) — used to draw grass over an
   * entity's feet after the entity (C20).
   */
  drawTufts(
    buf: PixelBuffer,
    camX: number,
    camY: number,
    t: number,
    front?: { baseY: number; x: number; y: number; width: number; height: number },
  ): void {
    const out = buf.data;
    const W = buf.width;
    const H = buf.height;
    const tall = this.tall;
    for (const tf of this.bake.tufts) {
      if (
        front &&
        (tf.y <= front.baseY ||
          tf.x < front.x - 2 ||
          tf.x > front.x + front.width + 2 ||
          tf.y - 8 > front.y + front.height ||
          tf.y < front.y)
      )
        continue;
      const sway = Math.sin(t * 2.2 + tf.x * 0.11 + tf.y * 0.05);
      for (let b = -1; b <= 1; b++) {
        const hgt = tf.height - Math.abs(b) - (b === 1 ? 1 : 0);
        for (let k = 0; k < hgt; k++) {
          const f = k / hgt;
          const off = Math.round(sway * 1.3 * f * f + b * Math.floor(k / 3) * 0.7);
          const X = tf.x + b + off - camX;
          const Y = tf.y - k - camY;
          if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
          const tone = Math.min(tall.length - 1, Math.floor((0.15 + f * 0.85) * tall.length));
          out[Y * W + X] = tall[tone] ?? 0;
        }
      }
    }
  }

  private waterPx(x: number, y: number, m: number, depth: number, t: number): number {
    const edge = 0.535 + 0.02 * Math.sin(t * 1.8 + (x + y) * 0.12);
    if (m < edge) return this.foam;
    let l = m < edge + 0.05 ? 0.72 : Math.min(Math.max(0.62 - (depth - 0.5) * 0.9, 0.18), 0.62);
    if (y % 3 === 0) {
      const s = this.seed;
      const hl =
        valueNoise(x * 0.09 + t * 0.35, y * 0.55, s + 5) +
        valueNoise(x * 0.04 - t * 0.2, y * 0.2, s + 6) * 0.4;
      if (hl > 1.02) l = 1;
    }
    return this.painter.tone('liquid', l, x, y);
  }

  private lavaPx(x: number, y: number, m: number, depth: number, t: number): number {
    if (m < 0.55 + 0.012 * Math.sin(t * 2 + x * 0.3)) return this.crust;
    const s = this.seed;
    const f =
      fbm(x * 0.05 + t * 0.18, y * 0.07 - t * 0.06, s) +
      fbm(x * 0.11 - t * 0.1, y * 0.11, s + 2) * 0.5;
    const l = Math.min(Math.max((f - 0.62) * 1.7 + 0.3 + (depth - 0.6) * 0.3, 0), 1);
    if (l > 0.95 && hash2(x, y + Math.floor(t * 6), 3) < 0.02) return this.foam;
    const n = this.lava.length;
    const dither = (bayer4(x, y) - 0.5) * (2 / TILE_STYLE.sharpness) * 0.25;
    const i = Math.floor(Math.min(Math.max(l + dither, 0), 0.999) * n);
    return this.lava[i] ?? 0;
  }
}
