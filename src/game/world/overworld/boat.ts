/**
 * The ferry boat (C37, preview pick B "rowboat and ferryman"): a wooden rowboat with the
 * ferryman rowing from the stern and the player riding at the bow. Drawn in code like
 * everything else, for each heading, with the oars swinging by `phase`.
 *
 * Also the boat's voyage along a ferry route: its place and heading at any distance, and how
 * long the ride takes. Pure: no DOM.
 */

import { packColor } from '@engine/render/pixel-buffer';
import type { PixelBuffer } from '@engine/render/pixel-buffer';
import { TILE } from '../biomes';
import type { Dir, Tile } from './mover';

export interface BoatFrame {
  readonly width: number;
  readonly height: number;
  /** Packed pixels, 0 = clear. */
  readonly data: Uint32Array;
  /** Where the hull's middle is in the frame (it sits on the boat's point). */
  readonly cx: number;
  readonly cy: number;
  /** Where the player's feet go (the bow), from the hull's middle. */
  readonly bow: { readonly x: number; readonly y: number };
}

/** Ride length (s), whatever the route's length. */
export const RIDE = { min: 10, max: 15, tilesPerSecond: 2 } as const;

const WOOD = [0x5a3a24, 0x76502f, 0x93683f, 0xb08452] as const;
const COAT = [0x2e3a5e, 0x3e4e7a, 0x56689a] as const;
const HAT = [0x2e4a3a, 0x3e6a4e, 0x5a8a66] as const;
const SKIN = 0xf0c6a0;
const INK = 0x10131f;
const FOAM = 0xeaf7ff;

const ramp = (r: readonly number[], t: number): number =>
  r[Math.max(0, Math.min(r.length - 1, Math.floor(t * r.length)))] ?? 0;

function mix(a: number, b: number, t: number): number {
  const c = (s: number, k: number): number => (s >> k) & 255;
  const m = (k: number): number => Math.round(c(a, k) + (c(b, k) - c(a, k)) * t) << k;
  return m(16) | m(8) | m(0);
}

/** Paints a field of colors with a storybook outline (each edge pixel's color mixed to ink). */
function paint(w: number, h: number, f: (x: number, y: number) => number | null): Uint32Array {
  const col: (number | null)[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) col.push(f(x, y));
  const data = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = col[y * w + x];
      if (c !== null && c !== undefined) {
        data[y * w + x] = packColor(c);
        continue;
      }
      for (const [dx, dy] of [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ] as const) {
        const X = x + dx;
        const Y = y + dy;
        const n = X >= 0 && Y >= 0 && X < w && Y < h ? col[Y * w + X] : null;
        if (n !== null && n !== undefined) {
          data[y * w + x] = packColor(mix(n, INK, 0.6));
          break;
        }
      }
    }
  }
  return data;
}

/** The ferryman's upper body at (fx, fy) = his waist, sitting at the oars. */
function ferryman(x: number, y: number, fx: number, fy: number): number | null {
  if (Math.abs(x - fx) <= 5 && y >= fy - 9 && y <= fy)
    return ramp(COAT, x < fx ? 0.9 : 0.35 - (y - fy + 9) * 0.01);
  if (y === fy - 12 && Math.abs(x - fx) === 1) return 0x2a2030;
  if (Math.abs(x - fx) <= 3 && y >= fy - 15 && y < fy - 9) return SKIN;
  if (Math.abs(x - fx) <= 4 && y >= fy - 19 && y < fy - 14) return ramp(HAT, 0.75 - (x - fx) / 12);
  if (Math.abs(x - fx) <= 7 && y === fy - 15) return HAT[0];
  return null;
}

/** An oar from (x0, y0) to (x1, y1), its blade at the far end. */
function oar(x: number, y: number, x0: number, y0: number, x1: number, y1: number): number | null {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  const t = ((x - x0) * dx + (y - y0) * dy) / len2;
  if (t < 0 || t > 1) return null;
  const d = Math.abs((x - x0) * dy - (y - y0) * dx) / Math.sqrt(len2);
  if (d < 0.8) return WOOD[2];
  if (t > 0.78 && d < 2.4) return WOOD[3];
  return null;
}

const cache = new Map<string, BoatFrame>();

/** The boat heading `dir`, oars at `phase` (0–1, one stroke), cached per 8 phases. */
export function boatFrame(dir: Dir, phase: number): BoatFrame {
  const p = Math.floor((((phase % 1) + 1) % 1) * 8);
  const key = `${dir}:${p}`;
  let f = cache.get(key);
  if (!f) {
    f = dir === 'up' || dir === 'down' ? vertical(dir, p / 8) : sideways(dir, p / 8);
    cache.set(key, f);
  }
  return f;
}

/** Bow toward the camera (`down`) or away (`up`). */
function vertical(dir: 'up' | 'down', phase: number): BoatFrame {
  const W = 72;
  const H = 60;
  const cx = 36;
  const swing = Math.sin(phase * Math.PI * 2);
  // `s` runs from the stern (0) to the bow (1) along the hull, rows 14..56.
  const top = 14;
  const len = 42;
  const sAt = (y: number): number => (dir === 'down' ? (y - top) / len : 1 - (y - top) / len);
  const sternY = dir === 'down' ? top + 4 : top + len - 4;
  const fy = sternY + (dir === 'down' ? 6 : 2);
  const data = paint(W, H, (x, y) => {
    // He sits in the hull, so he is drawn over it.
    const man = ferryman(x, y, cx, fy);
    if (man !== null) return man;
    const oy = sternY + (dir === 'down' ? 6 : -6);
    for (const k of [-1, 1]) {
      const c = oar(x, y, cx + k * 12, oy, cx + k * 34, oy + Math.round(swing * 8));
      if (c !== null) return c;
    }
    if (y >= top && y <= top + len) {
      const s = sAt(y);
      const half = 15 * Math.sqrt(Math.max(0, 1 - ((s - 0.38) / 0.64) ** 2));
      if (Math.abs(x - cx) <= half) {
        if (Math.abs(x - cx) > half - 3) return ramp(WOOD, 0.9 - (x - cx) / 40);
        if ((y - top) % 11 === 5) return WOOD[0];
        return ramp(WOOD, 0.45 - (x - cx) / 60);
      }
    }
    return null;
  });
  const bowY = dir === 'down' ? top + len - 8 : top + 12;
  return {
    width: W,
    height: H,
    data,
    cx,
    cy: top + len / 2,
    bow: { x: 0, y: bowY - (top + len / 2) },
  };
}

/** Bow to the left or right, seen from the side and above. */
function sideways(dir: 'left' | 'right', phase: number): BoatFrame {
  const W = 72;
  const H = 52;
  const cy = 36;
  const swing = Math.sin(phase * Math.PI * 2);
  const left = 14;
  const len = 44;
  const sAt = (x: number): number => (dir === 'right' ? (x - left) / len : 1 - (x - left) / len);
  const sternX = dir === 'right' ? left + 9 : left + len - 9;
  const data = paint(W, H, (x, y) => {
    const man = ferryman(x, y, sternX, cy - 1);
    if (man !== null) return man;
    // The near oar dips toward the camera, the far one shows above the hull.
    const ox = sternX + (dir === 'right' ? 8 : -8);
    const sweep = Math.round(swing * 9);
    const near = oar(x, y, ox, cy + 2, ox + sweep, cy + 15);
    if (near !== null) return near;
    const far = oar(x, y, ox, cy - 4, ox + sweep, cy - 13);
    if (far !== null) return far;
    if (x >= left && x <= left + len) {
      const s = sAt(x);
      const half = 9 * Math.sqrt(Math.max(0, 1 - ((s - 0.4) / 0.62) ** 2));
      if (Math.abs(y - cy) <= half) {
        if (y - cy > half - 4) return ramp(WOOD, 0.3);
        if (cy - y > half - 2) return WOOD[3];
        if ((x - left) % 12 === 6) return WOOD[0];
        return ramp(WOOD, 0.5 - (y - cy) / 40);
      }
    }
    return null;
  });
  const bowX = dir === 'right' ? left + len - 11 : left + 11;
  return {
    width: W,
    height: H,
    data,
    cx: left + len / 2,
    cy,
    bow: { x: bowX - (left + len / 2), y: 2 },
  };
}

/** Draws foam on the water behind a moving boat (a V wake) or rings around a docked one. */
export function drawWake(
  buf: PixelBuffer,
  sx: number,
  sy: number,
  dir: Dir,
  t: number,
  moving: boolean,
): void {
  if (!moving) {
    for (let a = 0; a < 48; a++) {
      const ang = (a / 48) * Math.PI * 2;
      const r = 20 + Math.sin(t * 4 + a) * 0.6;
      buf.dot(sx + Math.cos(ang) * r, sy + 4 + Math.sin(ang) * r * 0.45, FOAM, 0.3);
    }
    return;
  }
  // Back along the heading (the way the boat came), and sideways.
  const [bx, by] = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] }[dir] as [
    number,
    number,
  ];
  const px = -by;
  const py = bx;
  const half = dir === 'up' || dir === 'down' ? 12 : 10;
  const sternOff = dir === 'up' || dir === 'down' ? 20 : 22;
  for (let d = 0; d < 96; d++) {
    const spread = half + d * 0.38;
    const a = Math.max(0, 0.9 - d / 96) * (0.55 + 0.45 * Math.sin(d * 0.55 - t * 9));
    for (const k of [-1, 1]) {
      const x = sx + bx * (sternOff + d) + px * k * spread;
      const y = sy + by * (sternOff + d) + py * k * spread;
      buf.dot(x, y, FOAM, a);
      buf.dot(x + px * k, y + py * k, FOAM, a * 0.4);
    }
    if (d < 40) {
      const j = Math.sin(d * 1.3 + t * 7) * half * 0.6;
      buf.dot(
        sx + bx * (sternOff + d) + px * j,
        sy + by * (sternOff + d) + py * j,
        FOAM,
        0.55 - d / 72,
      );
    }
  }
  // Bow wave.
  for (let d = 0; d < 9; d++) {
    for (const k of [-1, 1]) {
      const x = sx - bx * (sternOff - 2) + px * k * (4 + d * 1.2) + bx * d * 1.1;
      const y = sy - by * (sternOff - 2) + py * k * (4 + d * 1.2) + by * d * 1.1;
      buf.dot(x, y, FOAM, 0.8 - d / 11);
    }
  }
}

/** A route in world pixels (tile middles) with its length. */
export interface Voyage {
  readonly points: readonly { readonly x: number; readonly y: number }[];
  readonly length: number;
}

export function voyage(route: readonly Tile[]): Voyage {
  const points = route.map((t) => ({ x: t.x * TILE + TILE / 2, y: t.y * TILE + TILE / 2 }));
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as { x: number; y: number };
    const b = points[i] as { x: number; y: number };
    length += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return { points, length };
}

/** Seconds a voyage takes: 2 tiles/s, kept between 10 and 15 s. */
export function rideSeconds(v: Voyage): number {
  const s = v.length / TILE / RIDE.tilesPerSecond;
  return Math.min(RIDE.max, Math.max(RIDE.min, s));
}

/** Where the boat is `d` px along a voyage, and which way it heads (the larger axis). */
export function along(v: Voyage, d: number): { x: number; y: number; dir: Dir } {
  const pts = v.points;
  let left = Math.max(0, d);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as { x: number; y: number };
    const b = pts[i] as { x: number; y: number };
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= seg || i === pts.length - 1) {
      const t = seg > 0 ? Math.min(1, left / seg) : 1;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, dir: heading(a, b) };
    }
    left -= seg;
  }
  const p = pts[0] ?? { x: 0, y: 0 };
  return { x: p.x, y: p.y, dir: 'down' };
}

/** The heading from `a` to `b` along the larger axis. */
export function heading(a: { x: number; y: number }, b: { x: number; y: number }): Dir {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy >= 0 ? 'down' : 'up';
}
