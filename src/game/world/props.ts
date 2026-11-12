/**
 * Procedural map props (trees, rocks, cacti, crystals, …) as small pixel sprites. Each prop
 * is a "light field": for every pixel a material and a light value, lit from the upper left.
 * The painter snaps light to the biome's ramp and adds a 1-px outline tinted from the
 * neighbouring material, so props match the tiles of any biome. Pure: no DOM.
 */

import { hash2, valueNoise } from '@engine/core/noise';
import { mix } from '@engine/core/color';
import { packColor } from '@engine/render/pixel-buffer';
import { rampIndex } from '@engine/render/ramp';
import { TILE_STYLE, type Biome, type Material } from './biomes';

export const PROP_KINDS = [
  'tree',
  'pine',
  'cactus',
  'rock',
  'snowrock',
  'bush',
  'crystal',
  'shrub',
  'flowers',
  'pad',
  'floe',
  'vent',
] as const;

export type PropKind = (typeof PROP_KINDS)[number];

export interface PropInfo {
  /** Casts a soft shadow on the ground. */
  readonly shadow: boolean;
  /** Blocks walking on its tile (world maps, C19). */
  readonly solid: boolean;
  /** Placed on liquid tiles (lily pads, ice floes) instead of ground. */
  readonly onLiquid?: boolean;
  /** Vertical offset from the tile bottom (px; negative = up). */
  readonly lift?: number;
  /** Puffs smoke/steam (animated). */
  readonly vent?: boolean;
}

export const PROP_INFO: Readonly<Record<PropKind, PropInfo>> = {
  tree: { shadow: true, solid: true },
  pine: { shadow: true, solid: true },
  cactus: { shadow: true, solid: true },
  rock: { shadow: true, solid: true },
  snowrock: { shadow: true, solid: true },
  bush: { shadow: true, solid: true },
  crystal: { shadow: true, solid: true },
  shrub: { shadow: false, solid: false },
  flowers: { shadow: false, solid: false },
  pad: { shadow: false, solid: false, onLiquid: true, lift: -4 },
  floe: { shadow: false, solid: false, onLiquid: true, lift: -5 },
  vent: { shadow: false, solid: true, lift: -3, vent: true },
};

/** Sprite pixels are packed RGBA (see `packColor`); 0 = transparent. */
export interface PropSprite {
  readonly width: number;
  readonly height: number;
  readonly data: Uint32Array;
}

type Px = readonly [Material, number] | null;
type Field = (x: number, y: number) => Px;

/** Snaps materials to a biome's ramps, with storybook outlines. Caches per material. */
export class Painter {
  private readonly ramps = new Map<Material, number[]>();
  private readonly outlines = new Map<Material, number>();

  constructor(readonly biome: Biome) {}

  ramp(m: Material): number[] {
    let r = this.ramps.get(m);
    if (!r) {
      r = this.biome.ramps[m].map(packColor);
      this.ramps.set(m, r);
    }
    return r;
  }

  /** Packed tone of `m` for `light` at pixel (x, y), dithered at band edges. */
  tone(m: Material, light: number, x: number, y: number): number {
    const r = this.ramp(m);
    return r[rampIndex(r.length, light, x, y, TILE_STYLE.sharpness)] ?? 0;
  }

  outline(m: Material): number {
    let c = this.outlines.get(m);
    if (c === undefined) {
      const darkest = this.biome.ramps[m][0] ?? 0;
      c = packColor(mix(darkest, TILE_STYLE.outlineInk, TILE_STYLE.outlineMix));
      this.outlines.set(m, c);
    }
    return c;
  }
}

const N4 = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
] as const;

function paint(p: Painter, w: number, h: number, field: Field, outline = true): PropSprite {
  const mat: (Material | null)[] = new Array<Material | null>(w * h).fill(null);
  const data = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = field(x, y);
      if (!px) continue;
      mat[y * w + x] = px[0];
      // Offsets keep the dither pattern from lining up across neighbouring props.
      data[y * w + x] = p.tone(px[0], px[1], x * 7 + 3, y * 5 + 1);
    }
  }
  if (!outline) return { width: w, height: h, data };
  const out = new Uint32Array(data);
  const at = (x: number, y: number): Material | null =>
    x >= 0 && y >= 0 && x < w && y < h ? (mat[y * w + x] ?? null) : null;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (at(x, y)) continue;
      for (const [dx, dy] of N4) {
        const m = at(x + dx, y + dy);
        if (m) {
          out[y * w + x] = p.outline(m);
          break;
        }
      }
    }
  }
  return { width: w, height: h, data: out };
}

const clamp01 = (v: number): number => Math.min(Math.max(v, 0), 1);
const inDisc = (x: number, y: number, cx: number, cy: number, r: number): boolean =>
  (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
/** Light on a ball lit from the upper left. */
const ball = (x: number, y: number, cx: number, cy: number, r: number): number =>
  clamp01(
    0.55 -
      (((x - cx) * 0.45 + (y - cy) * 0.75) / r) * 0.5 +
      (1 - Math.hypot(x - cx, y - cy) / r) * 0.15,
  );

function tree(p: Painter, s: number): PropSprite {
  const blobs = [
    [15, 13, 11.5],
    [8, 18, 7.5],
    [22, 18, 7.5],
    [15, 20, 8],
  ] as const;
  return paint(p, 30, 36, (x, y) => {
    for (const [cx, cy, r] of blobs) {
      if (inDisc(x, y, cx, cy, r)) {
        const leaf = (valueNoise(x * 0.32, y * 0.32, s) - 0.5) * 0.45;
        return ['foliage', ball(x, y, 15, 15, 14) + leaf - (y > 22 ? 0.2 : 0)];
      }
    }
    if (x >= 12 && x <= 17 && y >= 24 && y <= 34) {
      return ['wood', x < 14 ? 0.85 : x < 16 ? 0.5 : 0.15];
    }
    if (y === 35 && (x === 11 || x === 18)) return ['wood', 0.2];
    return null;
  });
}

function pine(p: Painter, s: number): PropSprite {
  const tiers = [
    [3, 13, 6],
    [9, 20, 8],
    [15, 28, 9.5],
  ] as const;
  return paint(p, 20, 36, (x, y) => {
    for (let t = tiers.length - 1; t >= 0; t--) {
      const tier = tiers[t];
      if (!tier) continue;
      const [top, bottom, half] = tier;
      if (y < top || y > bottom) continue;
      const hw = ((y - top) / (bottom - top)) * half + 1;
      if (Math.abs(x - 10) > hw) continue;
      const ty = y - top;
      const capped = ty <= 2 + (hash2(x, t, s) < 0.5 ? 1 : 0);
      if (capped || (y === bottom && hash2(x, y, s) < 0.4)) {
        return ['ground', 0.8 - (x - 10) * 0.05];
      }
      return ['foliage', 0.55 - ((x - 10) / hw) * 0.35 - (ty / (bottom - top)) * 0.25];
    }
    if (x >= 9 && x <= 11 && y > 28 && y <= 34) return ['wood', x === 9 ? 0.8 : 0.3];
    return null;
  });
}

function cactus(p: Painter, s: number): PropSprite {
  const v = hash2(s, 1, 77);
  const armL = 9 + Math.floor(v * 4);
  const armR = 6 + Math.floor(hash2(s, 2, 77) * 5);
  const body = (x: number, y: number): boolean =>
    x >= 6 && x <= 10 && y >= 2 && y <= 24 && !(y === 2 && (x === 6 || x === 10));
  const left = (x: number, y: number): boolean =>
    (x >= 1 && x <= 3 && y >= armL - 6 && y <= armL + 1 && !(y === armL - 6 && x !== 2)) ||
    (y >= armL && y <= armL + 2 && x >= 1 && x <= 6);
  const right = (x: number, y: number): boolean =>
    (x >= 13 && x <= 15 && y >= armR - 4 && y <= armR + 1 && !(y === armR - 4 && x !== 14)) ||
    (y >= armR && y <= armR + 2 && x >= 10 && x <= 15);
  return paint(p, 17, 26, (x, y) => {
    const b = body(x, y);
    if (!b && !left(x, y) && !right(x, y)) return null;
    const cx = b ? 8 : x <= 5 ? 2 : 14;
    return ['foliage', 0.55 - (x - cx) * 0.18 + (x % 2 === 0 ? 0.12 : -0.08)];
  });
}

function rock(p: Painter, s: number, snowCap: boolean): PropSprite {
  return paint(p, 15, 12, (x, y) => {
    const dx = (x - 7) / 7;
    const dy = (y - 7) / 6;
    if (dx * dx + dy * dy > 1 + (hash2(x, y, s) - 0.5) * 0.2 || y > 11) return null;
    if (snowCap && y < 5 + (hash2(x, 0, s) < 0.5 ? 1 : 0)) return ['ground', 0.8];
    return ['rock', ball(x, y, 7, 6, 8) * 0.8 + (x + y * 0.4 < 8 ? 0.25 : 0)];
  });
}

function bush(p: Painter, s: number): PropSprite {
  return paint(p, 16, 12, (x, y) =>
    inDisc(x, y, 5, 7, 4.5) || inDisc(x, y, 10, 6, 5) || inDisc(x, y, 8, 8, 4)
      ? ['foliage', ball(x, y, 8, 6, 7) + (valueNoise(x * 0.5, y * 0.5, s) - 0.5) * 0.35]
      : null,
  );
}

function crystal(p: Painter): PropSprite {
  const shards = [
    [6, 1, 2.6],
    [3, 6, 1.8],
    [10, 5, 2],
  ] as const;
  return paint(p, 14, 16, (x, y) => {
    for (const [cx, top, hw] of shards) {
      if (y < top) continue;
      if (Math.abs(x - cx) <= Math.min(1, (y - top) / 4) * hw) {
        return ['accent', x <= cx ? 0.85 - (y - top) * 0.02 : 0.35];
      }
    }
    return null;
  });
}

function shrub(p: Painter, s: number): PropSprite {
  const pix = new Set<number>();
  const grow = (x: number, y: number, a: number, len: number, depth: number): void => {
    for (let i = 0; i < len; i++) {
      x += Math.cos(a);
      y -= Math.sin(a);
      pix.add(Math.round(y) * 32 + Math.round(x));
    }
    if (depth > 0) {
      grow(x, y, a + 0.6, len * 0.65, depth - 1);
      grow(x, y, a - 0.55, len * 0.6, depth - 1);
    }
  };
  grow(7, 12, Math.PI / 2 + (hash2(s, 3, 5) - 0.5) * 0.3, 4, 2);
  return paint(
    p,
    15,
    13,
    (x, y) => (pix.has(y * 32 + x) ? ['wood', 0.4 + hash2(x, y, s) * 0.4] : null),
    true,
  );
}

function flowers(p: Painter, s: number): PropSprite {
  const data = new Uint32Array(15 * 13);
  const colors = p.biome.flowers;
  if (colors.length === 0) return { width: 15, height: 13, data };
  for (let i = 0; i < 5; i++) {
    const x = 1 + Math.floor(hash2(i, 1, s) * 12);
    const y = 1 + Math.floor(hash2(i, 2, s) * 10);
    data[y * 15 + x] = packColor(colors[Math.floor(hash2(i, 3, s) * colors.length)] ?? 0);
  }
  return { width: 15, height: 13, data };
}

function pad(p: Painter): PropSprite {
  return paint(p, 11, 7, (x, y) => {
    const dx = (x - 5) / 5;
    const dy = (y - 3) / 3;
    if (dx * dx + dy * dy > 1 || (y === 3 && x >= 5)) return null;
    return ['accent', 0.6 - dy * 0.3];
  });
}

function floe(p: Painter, s: number): PropSprite {
  return paint(p, 19, 9, (x, y) => {
    const dx = (x - 9) / 9;
    const dy = (y - 4) / 4;
    if (dx * dx + dy * dy > 1 + (hash2(x, y, s) - 0.5) * 0.25) return null;
    return ['alt', y < 4 ? 0.85 : 0.45];
  });
}

function vent(p: Painter): PropSprite {
  return paint(p, 12, 6, (x, y) => {
    const dx = (x - 5.5) / 5.5;
    const dy = (y - 3) / 3;
    const d = dx * dx + dy * dy;
    if (d > 1) return null;
    if (d < 0.35) return ['bank', 0.05];
    return ['rock', y < 3 ? 0.7 : 0.3];
  });
}

/** Builds a prop sprite. Same painter (biome), kind and variant → same pixels. */
export function buildProp(p: Painter, kind: PropKind, variant: number): PropSprite {
  const s = (variant * 7919 + 13) | 0;
  switch (kind) {
    case 'tree':
      return tree(p, s);
    case 'pine':
      return pine(p, s);
    case 'cactus':
      return cactus(p, s);
    case 'rock':
      return rock(p, s, false);
    case 'snowrock':
      return rock(p, s, true);
    case 'bush':
      return bush(p, s);
    case 'crystal':
      return crystal(p);
    case 'shrub':
      return shrub(p, s);
    case 'flowers':
      return flowers(p, s);
    case 'pad':
      return pad(p);
    case 'floe':
      return floe(p, s);
    case 'vent':
      return vent(p);
  }
}
