/**
 * Town pieces (C28): Zorling center, shop, houses, well, sign, fence, lamp, bridge decks and
 * standing stones, as pixel sprites in the storybook tile style (style "A", chosen at the
 * C28 preview round, 2026-11-13): outlines tinted from each material, soft dithered shading,
 * shingle roofs and timber corner posts.
 *
 * Buildings use fixed town colors (`TOWN_RAMPS`) instead of the biome's ramps, so a house
 * looks the same in every region. Pure: no DOM.
 */

import { hash2, valueNoise } from '@engine/core/noise';
import type { PropSprite } from './props';
import type { Painter, PaintMaterial } from './props';

/** Town materials: ramps dark → light, shared by every biome. */
export const TOWN_RAMPS = {
  wall: [0xb89a74, 0xd8c09a, 0xeedcb8, 0xfbf1da],
  plaster: [0xa8a8b4, 0xcacbd4, 0xe4e6ec, 0xfafbfd],
  timber: [0x5a3a24, 0x76502f, 0x93683f, 0xae8456],
  stone: [0x666c7a, 0x878e9a, 0xa8afb8, 0xcfd4da],
  glass: [0x2f5a86, 0x4f86b6, 0x8cc4e6, 0xd8f0fc],
  white: [0xc8d0dc, 0xeef2f6, 0xffffff],
  gold: [0xa07a22, 0xd8ae40, 0xf6d878],
  heart: [0xa82838, 0xd8405a, 0xf47a8a],
  awning: [0xa8323a, 0xd84a4a, 0xf07070],
  potion: [0x2f6ab0, 0x4a92e0, 0x9ad0ff],
  bloomRed: [0xd84a6a, 0xff7f98],
  bloomYellow: [0xd8a82a, 0xffd23f],
  leaf: [0x2a6e3a, 0x3c8a46, 0x56a654, 0x78c266],
  rune: [0x1d5f66, 0x2a8084, 0x42a29e, 0x70c6bc],
  roofRed: [0x8e2f2a, 0xb8443a, 0xd8604c, 0xf08a6c],
  roofBlue: [0x2c4a88, 0x3c64ac, 0x5684cc, 0x84aee8],
  roofTeal: [0x1d5f66, 0x2a8084, 0x42a29e, 0x70c6bc],
  roofMustard: [0x94661c, 0xbc8628, 0xdaa842, 0xf0cc70],
  roofPlum: [0x5a2e5a, 0x7a4278, 0x9a5c94, 0xbe82b2],
  roofGreen: [0x2e5e34, 0x407a40, 0x5a9a50, 0x80ba6a],
} as const satisfies Record<string, readonly number[]>;

export type TownMaterial = keyof typeof TOWN_RAMPS;

/** House roof colors by `variant & 3`. */
const HOUSE_ROOFS: readonly TownMaterial[] = ['roofTeal', 'roofMustard', 'roofRed', 'roofPlum'];

/** Sprite drawing surface: one material and light value per pixel. */
class Canvas {
  readonly mat: (PaintMaterial | null)[];
  readonly light: Float32Array;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.mat = new Array<PaintMaterial | null>(w * h).fill(null);
    this.light = new Float32Array(w * h);
  }

  set(x: number, y: number, m: PaintMaterial, l: number): void {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return;
    this.mat[yi * this.w + xi] = m;
    this.light[yi * this.w + xi] = l;
  }

  get(x: number, y: number): PaintMaterial | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.mat[y * this.w + x] ?? null;
  }

  rect(
    x0: number,
    y0: number,
    w: number,
    h: number,
    m: PaintMaterial,
    l: number | ((x: number, y: number) => number),
  ): void {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++)
        this.set(x, y, m, typeof l === 'number' ? l : l(x - x0, y - y0));
  }

  fill(
    test: (x: number, y: number) => boolean,
    m: PaintMaterial,
    l: (x: number, y: number) => number,
  ): void {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) if (test(x, y)) this.set(x, y, m, l(x, y));
  }

  /** Tones from the painter, then a 1-px outline tinted from the neighbouring material. */
  finish(p: Painter): PropSprite {
    const { w, h } = this;
    const data = new Uint32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const m = this.mat[i];
      if (!m) continue;
      const x = i % w;
      const y = (i - x) / w;
      data[i] = p.tone(m, this.light[i] ?? 0.5, x * 7 + 3, y * 5 + 1);
    }
    const out = new Uint32Array(data);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (this.get(x, y)) continue;
        const m =
          this.get(x, y + 1) ?? this.get(x, y - 1) ?? this.get(x + 1, y) ?? this.get(x - 1, y);
        if (m) out[y * w + x] = p.outline(m);
      }
    }
    return { width: w, height: h, data: out };
  }
}

/** Front roof plane: ridge at `y0`, eave at `y1`, narrowing by up to 4 px toward the ridge. */
function roof(c: Canvas, col: TownMaterial, x0: number, x1: number, y0: number, y1: number): void {
  const H = y1 - y0;
  for (let y = y0; y <= y1; y++) {
    const t = (y - y0) / H;
    const inset = Math.round((1 - t) * 4);
    const row = Math.floor((y - y0) / 4);
    const band = (y - y0) % 4;
    for (let x = x0 + inset; x <= x1 - inset; x++) {
      const u = (x - x0) / (x1 - x0);
      let l = 0.75 - u * 0.35 + (1 - t) * 0.12;
      const seam = (x + (row % 2) * 3) % 6 === 0;
      if (band === 3) l -= 0.32;
      else if (seam && band > 0) l -= 0.2;
      if (band === 0) l += 0.08;
      if (y === y1) l -= 0.15;
      c.set(x, y, col, l);
    }
  }
  for (let x = x0 + 4; x <= x1 - 4; x++) c.set(x, y0, col, 0.95 - ((x - x0) / (x1 - x0)) * 0.3);
}

/** Wall with a stone foundation and timber corner posts. */
function wall(c: Canvas, x0: number, x1: number, y0: number, y1: number, mat: TownMaterial): void {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / (x1 - x0);
      c.set(x, y, mat, 0.82 - u * 0.25 - (y - y0 < 3 ? 0.35 : 0));
    }
  for (let x = x0; x <= x1; x++) {
    const u = (x - x0) / (x1 - x0);
    c.set(x, y1, 'stone', 0.45 - u * 0.2);
    c.set(x, y1 - 1, 'stone', 0.7 - u * 0.2);
  }
  for (let y = y0 + 2; y < y1 - 1; y++) {
    c.set(x0, y, 'timber', 0.75);
    c.set(x0 + 1, y, 'timber', 0.5);
    c.set(x1, y, 'timber', 0.2);
    c.set(x1 - 1, y, 'timber', 0.3);
  }
  for (let x = x0; x <= x1; x++) c.set(x, y0 + 2, 'timber', 0.45);
}

function window_(c: Canvas, x: number, y: number, w: number, h: number, box = false): void {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const frame =
        i === 0 || j === 0 || i === w - 1 || j === h - 1 || i === w >> 1 || j === h >> 1;
      if (frame) c.set(x + i, y + j, 'timber', 0.55);
      else c.set(x + i, y + j, 'glass', i + j < 4 ? 0.95 : 0.45 - (j / h) * 0.1);
    }
  for (let i = -1; i <= w; i++) c.set(x + i, y + h, 'timber', 0.35);
  if (box) {
    for (let i = 0; i < w; i++) {
      c.set(x + i, y + h + 1, 'timber', 0.2);
      const bloom: TownMaterial = i % 3 === 0 ? 'bloomRed' : i % 3 === 1 ? 'leaf' : 'bloomYellow';
      c.set(x + i, y + h - 1 + (i % 2), bloom, 0.9);
    }
  }
}

function door(c: Canvas, x: number, y: number, w: number, h: number, double = false): void {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      if (j < 2 && (i < 2 - j || i >= w - 2 + j)) continue;
      if (double && (i === w >> 1 || i === (w >> 1) - 1)) {
        c.set(x + i, y + j, 'timber', 0.15);
        continue;
      }
      if (double && j > 2 && j < h * 0.5 && i > 1 && i < w - 2) {
        c.set(x + i, y + j, 'glass', 0.6 + (i < 4 ? 0.3 : 0));
        continue;
      }
      const edge = i === 0 || i === w - 1 || j === 0;
      c.set(x + i, y + j, 'timber', edge ? 0.2 : 0.55 + (i % 3 === 0 ? -0.15 : 0));
    }
  if (!double) c.set(x + w - 3, y + (h >> 1) + 1, 'gold', 0.9);
  for (let i = -1; i <= w; i++) c.set(x + i, y + h, 'stone', 0.8);
}

/** Gold-ringed white disc with a heart: the Zorling center sign. */
function emblem(c: Canvas, cx: number, cy: number, r: number): void {
  c.fill(
    (x, y) => Math.hypot(x - cx, y - cy) <= r,
    'white',
    (x, y) => 0.9 - (x - cx + (y - cy)) * 0.03,
  );
  c.fill(
    (x, y) => {
      const d = Math.hypot(x - cx, y - cy);
      return d <= r && d > r - 1.2;
    },
    'gold',
    () => 0.7,
  );
  const s = r * 0.5;
  const hy = cy + 0.5;
  c.fill(
    (x, y) => {
      const u = (x - cx) / s;
      const v = -(y - hy) / s;
      return (u * u + v * v - 1) ** 3 - u * u * v * v * v < 0;
    },
    'heart',
    (x, y) => (x < cx && y < hy ? 0.9 : 0.5),
  );
}

function chimney(c: Canvas, x: number, y0: number, y1: number): void {
  for (let y = y0; y <= y1; y++)
    for (let i = 0; i < 5; i++)
      c.set(
        x + i,
        y,
        'stone',
        (i < 2 ? 0.75 : 0.4) + (y === y0 ? 0.2 : 0) - ((y + (i >> 1)) % 3 === 0 ? 0.15 : 0),
      );
}

/** Zorling center, 82×78 (5 tiles wide); the double door is the middle column. */
export function center(p: Painter): PropSprite {
  const c = new Canvas(82, 78);
  roof(c, 'roofRed', 0, 81, 6, 40);
  wall(c, 3, 78, 41, 76, 'plaster');
  const gx0 = 27;
  const gx1 = 54;
  for (let y = 0; y <= 40; y++) {
    const half = Math.min(y, 14);
    for (let x = gx0; x <= gx1; x++) {
      if (Math.abs(x - (gx0 + gx1) / 2) > half) continue;
      const u = (x - gx0) / (gx1 - gx0);
      c.set(x, y, 'roofRed', 0.85 - u * 0.4 + (y % 4 === 3 ? -0.25 : 0));
    }
  }
  for (let y = 18; y <= 40; y++)
    for (let x = gx0 + 3; x <= gx1 - 3; x++)
      c.set(x, y, 'plaster', 0.85 - ((x - gx0) / (gx1 - gx0)) * 0.25);
  emblem(c, 40.5, 28, 8);
  door(c, 33, 56, 16, 20, true);
  window_(c, 9, 52, 12, 10);
  window_(c, 61, 52, 12, 10);
  for (let x = 3; x <= 78; x++) c.set(x, 41, 'gold', 0.6 - ((x - 3) / 75) * 0.3);
  return c.finish(p);
}

/** Shop, 66×72 (4 tiles wide): blue roof, potion sign over the door (first column). */
export function shop(p: Painter): PropSprite {
  const c = new Canvas(66, 72);
  roof(c, 'roofBlue', 0, 65, 4, 38);
  wall(c, 3, 62, 39, 70, 'wall');
  for (let y = 44; y <= 50; y++)
    for (let x = 24; x <= 59; x++) {
      if (y === 50 && (x - 24) % 4 === 3) continue;
      const stripe = Math.floor((x - 24) / 4) % 2 === 0;
      c.set(x, y, stripe ? 'awning' : 'white', 0.85 - (y - 44) * 0.08);
    }
  window_(c, 28, 52, 28, 10);
  door(c, 4, 52, 13, 18);
  for (let y = 44; y <= 51; y++)
    for (let x = 3; x <= 17; x++) {
      const edge = x === 3 || x === 17 || y === 44 || y === 51;
      c.set(x, y, edge ? 'timber' : 'wall', edge ? 0.3 : 0.9);
    }
  c.fill(
    (x, y) => Math.hypot(x - 10, y - 48.5) <= 2.4 || (x >= 9 && x <= 11 && y >= 45 && y <= 46),
    'potion',
    (x) => (x < 10 ? 0.95 : 0.5),
  );
  return c.finish(p);
}

/**
 * House, 58×70 (4 tiles wide). `variant & 3` picks the roof color; bit 4 puts the door on the
 * right (third column) instead of the left (second column).
 */
export function house(p: Painter, variant: number): PropSprite {
  const c = new Canvas(58, 70);
  const right = (variant & 4) !== 0;
  chimney(c, right ? 10 : 42, 0, 12);
  roof(c, HOUSE_ROOFS[variant & 3] ?? 'roofTeal', 0, 57, 6, 40);
  wall(c, 3, 54, 41, 68, 'wall');
  if (right) {
    door(c, 29, 51, 11, 17);
    window_(c, 9, 50, 12, 9, true);
  } else {
    door(c, 16, 51, 11, 17);
    window_(c, 35, 50, 12, 9, true);
  }
  return c.finish(p);
}

export function well(p: Painter): PropSprite {
  const c = new Canvas(28, 30);
  for (let y = 0; y < 8; y++)
    for (let x = 4 - (y >> 1); x < 24 + (y >> 1); x++)
      c.set(x, y, 'roofRed', 0.8 - (x / 28) * 0.4 - (y % 3 === 2 ? 0.2 : 0));
  c.rect(4, 8, 2, 12, 'timber', 0.6);
  c.rect(22, 8, 2, 12, 'timber', 0.25);
  c.rect(11, 10, 6, 1, 'timber', 0.3);
  c.rect(13, 11, 2, 4, 'stone', 0.4);
  c.fill(
    (x, y) => y >= 18 && y <= 28 && x >= 2 && x <= 25,
    'stone',
    (x, y) => 0.8 - (x / 28) * 0.4 - ((x + (y >> 1)) % 5 === 0 || y % 4 === 0 ? 0.25 : 0),
  );
  c.rect(5, 18, 18, 3, 'glass', (_x, y) => 0.2 + y * 0.1);
  return c.finish(p);
}

export function sign(p: Painter): PropSprite {
  const c = new Canvas(16, 20);
  c.rect(7, 9, 2, 10, 'timber', (x) => (x === 0 ? 0.7 : 0.3));
  c.rect(1, 2, 14, 8, 'timber', (x, y) => 0.75 - x * 0.03 - (y === 7 ? 0.3 : 0));
  for (let x = 3; x <= 12; x++) if (x % 3 !== 2) c.set(x, 5, 'timber', 0.2);
  return c.finish(p);
}

export function fence(p: Painter): PropSprite {
  const c = new Canvas(16, 14);
  for (const px of [1, 13]) c.rect(px, 1, 2, 12, 'timber', (x) => (x === 0 ? 0.8 : 0.4));
  c.rect(0, 4, 16, 2, 'timber', (_x, y) => (y === 0 ? 0.75 : 0.45));
  c.rect(0, 9, 16, 2, 'timber', (_x, y) => (y === 0 ? 0.7 : 0.4));
  return c.finish(p);
}

export function lamp(p: Painter): PropSprite {
  const c = new Canvas(10, 28);
  c.rect(4, 8, 2, 18, 'timber', (x) => (x === 0 ? 0.6 : 0.2));
  c.rect(3, 25, 4, 2, 'stone', 0.5);
  c.rect(2, 2, 6, 6, 'gold', (x, y) => 0.95 - x * 0.08 - y * 0.03);
  c.rect(1, 1, 8, 1, 'timber', 0.3);
  c.rect(3, 0, 4, 1, 'timber', 0.3);
  return c.finish(p);
}

/** Standing stone with a rune and moss at its foot. */
export function menhir(p: Painter, s: number): PropSprite {
  const c = new Canvas(14, 26);
  c.fill(
    (x, y) => y >= 1 && y <= 24 && Math.abs(x - 6.5) <= 5 - Math.max(0, 6 - y) * 0.6,
    'stone',
    (x, y) => 0.8 - (x / 14) * 0.6 + (valueNoise(x * 0.5, y * 0.5, s) - 0.5) * 0.3,
  );
  c.fill(
    (x, y) => y > 19 && y < 25 && hash2(x, y, s) < 0.5 && Math.abs(x - 6.5) <= 5,
    'leaf',
    () => 0.6,
  );
  for (let y = 9; y < 15; y++) c.set(6, y, 'rune', 0.9);
  c.set(5, 10, 'rune', 0.9);
  c.set(7, 13, 'rune', 0.9);
  return c.finish(p);
}

/**
 * Bridge deck for walking north–south over water: planks across, one tile. `variant` bit 1
 * draws the west rail, bit 2 the east rail.
 */
export function bridgeV(p: Painter, variant: number): PropSprite {
  const c = new Canvas(16, 16);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const seam = y % 4 === 3;
      c.set(x, y, 'timber', 0.72 - (seam ? 0.35 : 0) + (hash2(x >> 3, y >> 2, 3) - 0.5) * 0.12);
    }
  for (let y = 0; y < 16; y++) {
    if (variant & 1) {
      c.set(0, y, 'timber', 0.7);
      c.set(1, y, 'timber', 0.4);
    }
    if (variant & 2) {
      c.set(14, y, 'timber', 0.35);
      c.set(15, y, 'timber', 0.2);
    }
  }
  return c.finish(p);
}

/**
 * Bridge deck for walking east–west over water: planks along, one tile. `variant` bit 1
 * draws the north rail, bit 2 the south rail.
 */
export function bridgeH(p: Painter, variant: number): PropSprite {
  const c = new Canvas(16, 16);
  for (let x = 0; x < 16; x++)
    for (let y = 0; y < 16; y++) {
      const seam = x % 4 === 3;
      c.set(x, y, 'timber', 0.75 - (seam ? 0.35 : 0) + hash2(x >> 2, 0, 9) * 0.1);
    }
  for (let x = 0; x < 16; x++) {
    if (variant & 1) {
      c.set(x, 0, 'timber', 0.6);
      c.set(x, 1, 'timber', 0.3);
    }
    if (variant & 2) {
      c.set(x, 14, 'timber', 0.45);
      c.set(x, 15, 'timber', 0.2);
    }
  }
  return c.finish(p);
}
