/**
 * Bakes a biome map into pixels: ground with soft texture, autotiled layers (alt ground,
 * path, liquid with its bank), palette-safe prop shadows, and a prop overlay. Animated parts
 * (liquid, tall grass, vents) are recorded for `drawTerrain` to redraw every frame.
 *
 * All noise is sampled in world pixels, so a map can be baked in chunks (any tile rect) and
 * the chunks join without seams. Pure: no DOM.
 */

import { fbm, hash2, valueNoise } from '@engine/core/noise';
import { coverage, type CornerGrid } from '@engine/world/autotile';
import { TILE, TILE_STYLE, type Biome, type Material } from './biomes';
import {
  buildProp,
  Painter,
  PROP_INFO,
  propFootprint,
  type PropKind,
  type PropSprite,
} from './props';

export interface PropPlacement {
  readonly kind: PropKind;
  readonly tx: number;
  readonly ty: number;
  /** Pixel nudge from the tile's bottom-center anchor. */
  readonly dx?: number;
  readonly dy?: number;
  /** Shape variant (0–7). */
  readonly variant?: number;
}

/** A biome map: three corner-grid layers over the ground, plus props and tall grass. */
export interface TerrainMap {
  /** Size in tiles. */
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  /** Second ground (meadow, basalt, ice sheet). */
  readonly alt: CornerGrid;
  readonly path: CornerGrid;
  /** Water or lava. Drawn above everything else, with a bank around it. */
  readonly liquid: CornerGrid;
  readonly props: readonly PropPlacement[];
  /** Tiles with swaying tall grass. */
  readonly tall: readonly (readonly [number, number])[];
}

/** Tile rectangle. */
export interface TileRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Tuft {
  /** World pixels of the tuft's base. */
  readonly x: number;
  readonly y: number;
  readonly height: number;
}

/** Entries per liquid pixel in `TerrainBake.liquid`. */
export const LIQUID_STRIDE = 5;

export interface TerrainBake {
  /** World pixel of the bake's top-left. */
  readonly x: number;
  readonly y: number;
  /** Size in pixels. */
  readonly width: number;
  readonly height: number;
  /** Packed pixels: static ground (liquid pixels left 0, redrawn per frame). */
  readonly base: Uint32Array;
  /** Packed prop pixels drawn over animated layers (0 = none). */
  readonly overlay: Uint32Array;
  /**
   * Per overlay pixel: world y of its prop's base (footprint center), 0 where `overlay` is
   * empty. Entities whose base is above (smaller y) are hidden behind that pixel (C20).
   */
  readonly depth: Int32Array;
  /** Per overlay pixel: its `PropGlow` code (0 = none), lit at night (C32). */
  readonly glow: Uint8Array;
  /**
   * Liquid pixels, `LIQUID_STRIDE` ints each: local index, world x, world y, edge coverage
   * ×1000 (with noise; 500 = shoreline) and smooth depth ×1000.
   */
  readonly liquid: Int32Array;
  readonly tufts: readonly Tuft[];
  /** World pixels where vents puff. */
  readonly vents: readonly { readonly x: number; readonly y: number }[];
}

/** Coverage plus a little noise, so edges wobble organically (world-pixel noise). */
function edge(g: CornerGrid, px: number, py: number, seed: number, amp: number): number {
  return coverage(g, px, py, TILE) + (valueNoise(px * 0.28, py * 0.28, seed + 99) - 0.5) * amp;
}

interface Placed {
  readonly sprite: PropSprite;
  readonly info: (typeof PROP_INFO)[PropKind];
  /** Sprite top-left, world px. */
  readonly x: number;
  readonly y: number;
  /** Shadow / footprint center, world px. */
  readonly bx: number;
  readonly by: number;
}

/** Where a prop's sprite goes: sprite top-left and footprint center, world px. */
export function placeProp(
  p: PropPlacement,
  sprite: PropSprite,
): { x: number; y: number; bx: number; by: number } {
  const info = PROP_INFO[p.kind];
  const variant = (p.variant ?? 0) & 7;
  const dx = p.dx ?? 0;
  const dy = (p.dy ?? 0) + (info.lift ?? 0);
  // Buildings center on their footprint, not on their (door) tile.
  const [fx, , fw] = propFootprint(p.kind, p.tx, p.ty, variant);
  const bx = fx * TILE + (fw * TILE) / 2 + dx;
  return {
    x: bx - (sprite.width >> 1),
    y: p.ty * TILE + TILE - 1 - sprite.height + dy,
    bx,
    by: p.ty * TILE + TILE - 2 + dy,
  };
}

/** Prop sprites by kind and variant (they only depend on the painter). */
export class PropSprites {
  private readonly cache = new Map<string, PropSprite>();
  constructor(readonly painter: Painter) {}
  get(p: PropPlacement): PropSprite {
    const variant = (p.variant ?? 0) & 7;
    const key = `${p.kind}:${variant}`;
    let sprite = this.cache.get(key);
    if (!sprite) {
      sprite = buildProp(this.painter, p.kind, variant);
      this.cache.set(key, sprite);
    }
    return sprite;
  }
}

/** Prop sprites shared by every bake of a biome (they only depend on the biome's colors). */
const SHARED_SPRITES = new WeakMap<Biome, PropSprites>();

function spritesFor(biome: Biome): PropSprites {
  let s = SHARED_SPRITES.get(biome);
  if (!s) {
    s = new PropSprites(new Painter(biome));
    SHARED_SPRITES.set(biome, s);
  }
  return s;
}

function placeProps(map: TerrainMap, biome: Biome): Placed[] {
  const sprites = spritesFor(biome);
  const placed = map.props.map((p): Placed => {
    const sprite = sprites.get(p);
    return { sprite, info: PROP_INFO[p.kind], ...placeProp(p, sprite) };
  });
  return placed.sort((a, b) => a.by - b.by);
}

export interface BakeOptions {
  /**
   * Props whose shadows fall on the ground, when not the drawn ones (C37: a block shared by
   * two biomes draws each biome's props in its own bake, but every prop casts its shadow).
   */
  readonly shadows?: readonly PropPlacement[];
  /** Tall-grass tiles that darken the ground, when not the drawn ones (as for `shadows`). */
  readonly tallShade?: readonly (readonly [number, number])[];
  /**
   * Only these pixels get ground and liquid (index in the rect, true = this bake's); the
   * others stay 0 (C37: each biome of a shared block bakes only the pixels it owns).
   */
  readonly only?: (i: number) => boolean;
}

export function bakeTerrain(
  map: TerrainMap,
  biome: Biome,
  rect?: TileRect,
  opts: BakeOptions = {},
): TerrainBake {
  const r = rect ?? { x: 0, y: 0, width: map.width, height: map.height };
  const X0 = r.x * TILE;
  const Y0 = r.y * TILE;
  const W = r.width * TILE;
  const H = r.height * TILE;
  const s = map.seed;
  const painter = new Painter(biome);
  const props = placeProps(map, biome);
  const local = (wx: number, wy: number): number => {
    const x = wx - X0;
    const y = wy - Y0;
    return x < 0 || y < 0 || x >= W || y >= H ? -1 : y * W + x;
  };

  // Shadows lower the light before the ramp lookup, so they stay on the palette.
  const shade = new Float32Array(W * H);
  const casters = opts.shadows ? placeProps({ ...map, props: opts.shadows }, biome) : props;
  for (const p of casters) {
    if (!p.info.shadow) continue;
    const rx = p.sprite.width * 0.42;
    const ry = 3.5;
    for (let y = Math.floor(p.by - ry); y <= p.by + ry; y++) {
      for (let x = Math.floor(p.bx - rx); x <= p.bx + rx; x++) {
        const i = local(x, y);
        if (i < 0) continue;
        const d = ((x - p.bx) / rx) ** 2 + ((y - p.by) / ry) ** 2;
        if (d <= 1) shade[i] = Math.max(shade[i] ?? 0, TILE_STYLE.shadow * (1 - d * 0.6));
      }
    }
  }
  const tufts: Tuft[] = [];
  for (const [tx, ty] of opts.tallShade ?? map.tall) {
    if (tx < r.x || ty < r.y || tx >= r.x + r.width || ty >= r.y + r.height) continue;
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const i = local(tx * TILE + x, ty * TILE + y);
        if (i >= 0) shade[i] = Math.max(shade[i] ?? 0, TILE_STYLE.tallShade);
      }
    }
  }
  for (const [tx, ty] of map.tall) {
    if (tx < r.x || ty < r.y || tx >= r.x + r.width || ty >= r.y + r.height) continue;
    for (let n = 0; n < 6; n++) {
      const h = hash2(tx * 7 + n, ty, s + 50);
      tufts.push({
        x: tx * TILE + 1 + Math.floor(h * 14),
        y: ty * TILE + 5 + Math.floor(hash2(n, tx * 3 + ty, s) * 11),
        height: 5 + (Math.floor(h * 31) % 4),
      });
    }
  }
  tufts.sort((a, b) => a.y - b.y);

  // Ground and layers.
  const base = new Uint32Array(W * H);
  const liquid: number[] = [];
  const { sparkle = 0, iceStreaks = false, altPits = 0 } = biome.details;
  const only = opts.only;
  for (let ly = 0; ly < H; ly++) {
    const py = Y0 + ly;
    for (let lx = 0; lx < W; lx++) {
      const px = X0 + lx;
      const i = ly * W + lx;
      if (only && !only(i)) continue;
      const ml = edge(map.liquid, px, py, s, 0.16);
      if (ml >= 0.5) {
        const depth = coverage(map.liquid, px, py, TILE);
        liquid.push(i, px, py, Math.round(ml * 1000), Math.round(depth * 1000));
        continue;
      }
      const tex =
        0.52 + (fbm(px * 0.08, py * 0.08, s) - 0.5) * 0.55 + (hash2(px, py, s) - 0.5) * 0.14;
      let m: Material;
      let l: number;
      if (ml >= 0.38) {
        m = 'bank';
        l = tex + (ml > 0.46 ? -0.3 : 0.05);
      } else {
        const mp = edge(map.path, px, py, s, 0.14);
        if (mp >= 0.5) {
          m = 'path';
          l = tex + (mp < 0.57 ? -0.32 : 0.05) + (hash2(px >> 1, py >> 1, s + 4) < 0.06 ? 0.35 : 0);
        } else {
          const ma = edge(map.alt, px, py, s, 0.2);
          if (ma >= 0.5) {
            m = 'alt';
            l = tex + (ma < 0.55 ? 0.3 : 0);
            if (iceStreaks && (px + py * 2) % 23 === 0) l += 0.4;
            if (altPits > 0 && hash2(px >> 2, py >> 1, s + 6) < altPits) l -= 0.4;
          } else {
            m = 'ground';
            l = tex;
            if (hash2(px, py, s + 12) < 0.012) l = 0.05;
            if (sparkle > 0 && hash2(px, py, s + 13) < sparkle) l = 1;
          }
        }
      }
      base[i] = painter.tone(m, l - (shade[i] ?? 0), px, py);
    }
  }

  // Props overlay (clipped to the rect; props from neighbouring chunks overlap in too).
  const overlay = new Uint32Array(W * H);
  const depth = new Int32Array(W * H);
  const glow = new Uint8Array(W * H);
  const vents: { x: number; y: number }[] = [];
  for (const p of props) {
    const { width: sw, height: sh, data, glow: sg } = p.sprite;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const c = data[y * sw + x] ?? 0;
        if (!c) continue;
        const i = local(p.x + x, p.y + y);
        if (i >= 0) {
          overlay[i] = c;
          depth[i] = p.info.flat ? 0 : p.by;
          glow[i] = sg?.[y * sw + x] ?? 0;
        }
      }
    }
    if (p.info.vent && local(p.bx, p.by) >= 0) vents.push({ x: p.bx, y: p.by - 4 });
  }

  return {
    x: X0,
    y: Y0,
    width: W,
    height: H,
    base,
    overlay,
    depth,
    glow,
    liquid: Int32Array.from(liquid),
    tufts,
    vents,
  };
}
