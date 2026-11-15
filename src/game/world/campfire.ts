/**
 * Camp props (C40), style "A" from the C40 preview round (2026-11-15): a campfire of crossed
 * logs in a ring of grey stones, and a cream canvas A-frame tent with a teal hem.
 *
 * The map bakes the fire **burnt down** (logs, ash and a few embers). While it burns, the
 * scene draws one of `FLAME_FRAMES` full fire sprites over it, so the flames animate and sit
 * between the back and front stones. Pure: no DOM.
 */

import { hash2 } from '@engine/core/noise';
import { Canvas, type TownMaterial } from './buildings';
import type { Painter, PaintMaterial, PropSprite } from './props';

/** Frames of the burning fire's flicker. */
export const FLAME_FRAMES = 4;
/** Campfire sprite size (px). */
export const CAMPFIRE_W = 22;
export const CAMPFIRE_H = 20;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
/** Light on a ball lit from the upper left. */
const ballLight = (x: number, y: number, cx: number, cy: number, r: number): number =>
  clamp01(0.6 - (((x - cx) * 0.5 + (y - cy) * 0.7) / r) * 0.5);

function line(
  c: Canvas,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  m: PaintMaterial,
  light: number,
  thick = 1,
): void {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) * 2 + 1;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    for (let k = 0; k < thick; k++)
      c.set(x0 + (x1 - x0) * t + k, y0 + (y1 - y0) * t, m, light - k * 0.3);
  }
}

/** The stones of the ring behind (`back`) or in front of the fire. */
function stones(c: Canvas, part: 'back' | 'front'): void {
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2;
    const sx = 11 + Math.cos(a) * 8;
    const sy = 15 + Math.sin(a) * 3.3;
    if ((part === 'back') !== sy < 15) continue;
    const r = 1.9 + hash2(i, 3, 7) * 0.6;
    c.fill(
      (x, y) => ((x - sx) / r) ** 2 + ((y - sy) / (r * 0.8)) ** 2 <= 1,
      'stone',
      (x, y) => ballLight(x, y, sx - 0.5, sy - 0.5, r) * 0.9 + 0.05,
    );
  }
}

function hearth(c: Canvas): void {
  stones(c, 'back');
  c.fill(
    (x, y) => ((x - 11) / 6) ** 2 + ((y - 15) / 2.4) ** 2 <= 1,
    'ash',
    () => 0.4,
  );
  line(c, 5, 13, 16, 16, 'wood', 0.6, 2);
  line(c, 6, 16, 16, 13, 'wood', 0.35, 2);
}

/** Flame tongues over the logs; `f` is the flicker frame. */
function flames(c: Canvas, f: number): void {
  const cx = 11;
  const base = 14;
  const half = 4.5;
  for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
    const d = Math.abs(x - cx) / half;
    if (d > 1) continue;
    const wob = 0.75 + 0.35 * Math.sin(f * 2.1 + x * 1.7) + 0.15 * Math.sin(f * 3.7 - x * 0.9);
    const h = 11 * Math.pow(1 - d, 0.7) * wob;
    for (let y = base; y > base - h; y--) {
      const t = (base - y) / h;
      const inner = d < 0.45 && t < 0.65;
      const m: TownMaterial = inner ? 'fireCore' : 'fire';
      c.set(x, y, m, inner ? 0.9 - t * 0.3 : 0.75 - t * 0.5);
    }
  }
  // Sparks rising.
  for (let i = 0; i < 3; i++) {
    const ph = (f + i * 1.3) % 4;
    if (ph >= 3.2) continue;
    const x = cx + Math.round((hash2(i, 9, 4) - 0.5) * 8 + Math.sin(ph * 1.5 + i) * 1.5);
    c.set(x, 3 - Math.round(ph * 2.2), 'fireCore', 0.9);
  }
}

/** The campfire burnt down to embers: what the map bakes. */
export function campfire(p: Painter): PropSprite {
  const c = new Canvas(CAMPFIRE_W, CAMPFIRE_H);
  hearth(c);
  for (const [x, y] of [
    [8, 14],
    [11, 15],
    [13, 14],
    [10, 13],
  ] as const)
    c.set(x, y, 'fire', 0.55);
  stones(c, 'front');
  return c.finish(p);
}

/** The burning campfire, flicker frame `f` (0 … `FLAME_FRAMES` − 1); drawn over the map's. */
export function campfireLit(p: Painter, f: number): PropSprite {
  const c = new Canvas(CAMPFIRE_W, CAMPFIRE_H);
  hearth(c);
  flames(c, f);
  stones(c, 'front');
  return c.finish(p);
}

/** Canvas A-frame tent with a teal hem, the door flap tied back, guy ropes and pegs. */
export function tent(p: Painter): PropSprite {
  const c = new Canvas(40, 30);
  const ax = 15;
  const ay = 3;
  const by = 27;
  const slope = (y: number): number => (y - ay) / (by - ay);
  // The roof's far side, seen past the front face.
  c.fill(
    (x, y) => {
      const t = slope(y);
      const right = ax + t * 13;
      return t >= 0 && t <= 1 && x > right - 1 && x <= right + 8 && y <= by - (x - right) * 0.35;
    },
    'canvas',
    (x, y) => 0.32 - ((x - ax) / 40) * 0.1 + (((x + y) & 7) === 0 ? -0.1 : 0),
  );
  line(c, ax, ay, ax + 8, ay - 2, 'canvas', 0.75);
  // Front face.
  c.fill(
    (x, y) => {
      const t = slope(y);
      return t >= 0 && t <= 1 && Math.abs(x - ax) <= t * 13;
    },
    'canvas',
    (x, y) => 0.85 - (x - ax + 13) * 0.012 - (y - ay) * 0.004,
  );
  const door = (y: number): number => (y - (ay + 8)) / (by - ay - 8);
  c.fill(
    (x, y) => door(y) >= 0 && door(y) <= 1 && x >= ax - door(y) * 5 && x <= ax + door(y) * 2,
    'shade',
    () => 0.15,
  );
  c.fill(
    (x, y) => door(y) >= 0 && door(y) <= 1 && x > ax + door(y) * 2 && x <= ax + door(y) * 6,
    'canvas',
    () => 0.55,
  );
  c.fill(
    (x, y) => y >= by - 1 && y <= by && Math.abs(x - ax) <= 13 && !(x >= ax - 5 && x <= ax + 2),
    'roofTeal',
    (x) => 0.7 - x * 0.01,
  );
  // Pole tip, guy ropes and pegs.
  line(c, ax, 0, ax, ay, 'timber', 0.6);
  line(c, ax - 1, ay + 1, 0, by + 1, 'timber', 0.4);
  line(c, ax + 8, ay - 1, 39, by - 4, 'timber', 0.3);
  c.set(0, by + 2, 'timber', 0.2);
  c.set(39, by - 3, 'timber', 0.2);
  return c.finish(p);
}
