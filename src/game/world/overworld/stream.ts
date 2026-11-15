/**
 * Terrain streaming for the overworld (C20): the map is baked in small square blocks
 * (`BLOCK` tiles) as they come near the view and dropped again once far away, so memory
 * stays flat on a 200×200 region. Blocks in view are baked at once (no holes); the ring
 * around the view is baked ahead within a per-frame time budget.
 *
 * It also answers depth questions for entities: which prop pixels stand in front of an
 * entity's base line, and redraws tall grass over an entity's feet. Pure: no DOM.
 *
 * Biomes (C37): the stream takes one biome, or a biome per tile for the seamless world. A
 * block near where biomes meet is baked once per biome (each drawing its own props and tall
 * grass, every prop casting its shadow) and the bakes are merged pixel by pixel: the ground
 * shows the biome of the tile at a noise-warped spot, so the border wanders over a few tiles
 * instead of following the tile grid.
 */

import { hash2, valueNoise } from '@engine/core/noise';
import type { PixelBuffer } from '@engine/render/pixel-buffer';
import { TerrainRenderer, type GlowSink } from '../animate';
import { TILE, type Biome } from '../biomes';
import type { WorldMap } from '../map';
import {
  bakeTerrain,
  type PropPlacement,
  type TerrainBake,
  type TerrainMap,
  type TileRect,
} from '../terrain';

/** Bake block size in tiles (128 px): small enough to bake in a few ms. */
export const BLOCK = 8;
/** Blocks kept around the view before they are dropped. */
const KEEP = 2;
/** How far (px) the biome border wanders off the tile grid, at most. */
export const BIOME_WARP = 44;
/** Tiles around a block searched for another biome (covers the warp). */
const WARP_TILES = Math.ceil((BIOME_WARP * 1.5) / TILE) + 1;

/** The biome of each tile (C37). */
export type BiomeField = (tx: number, ty: number) => Biome;

/** What the stream keeps per block: a plain renderer, or a merged one where biomes meet. */
export interface BlockRenderer {
  readonly bake: TerrainBake;
  draw(buf: PixelBuffer, camX: number, camY: number, t: number, sink?: GlowSink): void;
  drawTufts(
    buf: PixelBuffer,
    camX: number,
    camY: number,
    t: number,
    front?: { baseY: number; x: number; y: number; width: number; height: number },
  ): void;
}

/**
 * The biome tile a world pixel shows, after the warp: the border between two biomes wanders
 * by up to `BIOME_WARP` px. Pure, deterministic per seed.
 */
export function warpedTile(wx: number, wy: number, seed: number): [number, number] {
  const [dx, dy] = warp(wx, wy, seed);
  return [Math.floor((wx + dx) / TILE), Math.floor((wy + dy) / TILE)];
}

/** The smooth part of the warp at a world pixel (px). */
function warp(wx: number, wy: number, seed: number): [number, number] {
  const n = (s: number): number =>
    (valueNoise(wx / 38, wy / 38, s) - 0.5) * 1.6 +
    (valueNoise(wx / 11, wy / 11, s + 1) - 0.5) * 0.5;
  return [n(seed + 71) * BIOME_WARP, n(seed + 83) * BIOME_WARP];
}

/** Warp grid step (px): the smooth warp is sampled this coarsely and held in between. */
const WARP_STEP = 4;
/** Per-pixel jitter (px) on top, so the border frays into a dither. */
const WARP_JITTER = 5;

export interface PixelBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export class TerrainStream {
  readonly blocksWide: number;
  readonly blocksHigh: number;
  private readonly terrain: TerrainMap;
  private readonly props: PropPlacement[][];
  private readonly tall: (readonly [number, number])[][];
  private readonly blocks = new Map<number, BlockRenderer>();
  private readonly biomeAt: BiomeField;
  /** Blocks baked so far (for stats/tests). */
  baked = 0;
  /** Of those, blocks where biomes meet (for stats/tests). */
  mixed = 0;

  constructor(
    readonly map: WorldMap,
    biome: Biome | BiomeField,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.biomeAt = typeof biome === 'function' ? biome : () => biome;
    this.terrain = map.toTerrainMap();
    this.blocksWide = Math.ceil(map.width / BLOCK);
    this.blocksHigh = Math.ceil(map.height / BLOCK);
    const n = this.blocksWide * this.blocksHigh;
    this.props = Array.from({ length: n }, () => []);
    this.tall = Array.from({ length: n }, () => []);
    for (const p of this.terrain.props) this.props[this.blockOf(p.tx, p.ty)]?.push(p);
    for (const t of this.terrain.tall) this.tall[this.blockOf(t[0], t[1])]?.push(t);
  }

  get size(): number {
    return this.blocks.size;
  }

  /** Bakes every block touching the view now; returns the renderers in draw order. */
  visible(view: PixelBox): BlockRenderer[] {
    const out: BlockRenderer[] = [];
    for (const i of this.blocksIn(view, 0)) out.push(this.block(i));
    return out;
  }

  /** Draws terrain for the view (camera top-left at `camX`, `camY`). */
  draw(buf: PixelBuffer, camX: number, camY: number, t: number, sink?: GlowSink): void {
    for (const r of this.visible({ x: camX, y: camY, width: buf.width, height: buf.height }))
      r.draw(buf, camX, camY, t, sink);
  }

  /** Bakes blocks near the view ahead of time and drops far ones. */
  prefetch(view: PixelBox, budgetMs = 4): void {
    const start = this.now();
    for (const i of this.blocksIn(view, 1)) {
      if (this.blocks.has(i)) continue;
      this.block(i);
      if (this.now() - start >= budgetMs) break;
    }
    const keep = new Set(this.blocksIn(view, KEEP));
    for (const i of this.blocks.keys()) if (!keep.has(i)) this.blocks.delete(i);
  }

  /** True when a prop pixel at world (`wx`, `wy`) stands in front of an entity based at `baseY`. */
  occludes(wx: number, wy: number, baseY: number): boolean {
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    if (tx < 0 || ty < 0 || tx >= this.map.width || ty >= this.map.height) return false;
    const r = this.blocks.get(this.blockOf(tx, ty));
    if (!r) return false;
    const b = r.bake;
    return (b.depth[(wy - b.y) * b.width + (wx - b.x)] ?? 0) > baseY;
  }

  /** Redraws tall grass in front of an entity's feet (`box` world px, base line `baseY`). */
  drawGrassOver(
    buf: PixelBuffer,
    camX: number,
    camY: number,
    t: number,
    box: PixelBox,
    baseY: number,
  ): void {
    const front = { ...box, baseY };
    for (const i of this.blocksIn({ ...box, height: box.height + TILE }, 0))
      this.blocks.get(i)?.drawTufts(buf, camX, camY, t, front);
  }

  private blockOf(tx: number, ty: number): number {
    return Math.floor(ty / BLOCK) * this.blocksWide + Math.floor(tx / BLOCK);
  }

  private *blocksIn(view: PixelBox, margin: number): Generator<number> {
    const S = BLOCK * TILE;
    const x0 = Math.max(0, Math.floor(view.x / S) - margin);
    const y0 = Math.max(0, Math.floor(view.y / S) - margin);
    const x1 = Math.min(this.blocksWide - 1, Math.floor((view.x + view.width - 1) / S) + margin);
    const y1 = Math.min(this.blocksHigh - 1, Math.floor((view.y + view.height - 1) / S) + margin);
    for (let by = y0; by <= y1; by++)
      for (let bx = x0; bx <= x1; bx++) yield by * this.blocksWide + bx;
  }

  private block(i: number): BlockRenderer {
    let r = this.blocks.get(i);
    if (r) return r;
    const bx = i % this.blocksWide;
    const by = (i - bx) / this.blocksWide;
    const rect: TileRect = {
      x: bx * BLOCK,
      y: by * BLOCK,
      width: Math.min(BLOCK, this.map.width - bx * BLOCK),
      height: Math.min(BLOCK, this.map.height - by * BLOCK),
    };
    // Props from neighbouring blocks overlap in (canopies, shadows), so bake with those too.
    const props: PropPlacement[] = [];
    for (let y = by - 1; y <= by + 1; y++) {
      for (let x = bx - 1; x <= bx + 1; x++) {
        if (x < 0 || y < 0 || x >= this.blocksWide || y >= this.blocksHigh) continue;
        props.push(...(this.props[y * this.blocksWide + x] ?? []));
      }
    }
    const tall = this.tall[i] ?? [];
    const biomes = this.biomesNear(rect);
    const seed = this.map.seed;
    if (biomes.length === 1) {
      const biome = biomes[0] as Biome;
      const map: TerrainMap = { ...this.terrain, props, tall };
      r = new TerrainRenderer(bakeTerrain(map, biome, rect), biome, seed);
    } else {
      const owner = biomeOwner(
        rect,
        biomes,
        this.biomeAt,
        seed,
        (x, y) => this.map.liquidCorners(x, y) > 0,
      );
      const layers = biomes.map((biome, k) => {
        const own = (t: { tx: number; ty: number }): boolean => this.biomeAt(t.tx, t.ty) === biome;
        const map: TerrainMap = {
          ...this.terrain,
          props: props.filter(own),
          tall: tall.filter(([tx, ty]) => this.biomeAt(tx, ty) === biome),
        };
        const only = (j: number): boolean => owner[j] === k;
        return {
          biome,
          bake: bakeTerrain(map, biome, rect, { shadows: props, tallShade: tall, only }),
        };
      });
      r = mergeBlock(layers, owner, seed);
      this.mixed++;
    }
    this.blocks.set(i, r);
    this.baked++;
    return r;
  }

  /** The biomes of the tiles in and around a rect (the warp reaches this far), first seen first. */
  private biomesNear(rect: TileRect): Biome[] {
    const out: Biome[] = [];
    const m = WARP_TILES;
    for (let y = rect.y - m; y < rect.y + rect.height + m; y++) {
      for (let x = rect.x - m; x < rect.x + rect.width + m; x++) {
        const b = this.biomeAt(x, y);
        if (!out.includes(b)) out.push(b);
      }
    }
    return out;
  }
}

/**
 * One block from a bake per biome (C37): the ground pixel comes from the layer `pick` says;
 * a prop pixel from whichever layer's prop stands in front. Each layer keeps the liquid
 * pixels it owns, its tall grass and its vents, and animates them in its own biome.
 */
function mergeBlock(
  layers: readonly { biome: Biome; bake: TerrainBake }[],
  owner: Uint8Array,
  seed: number,
): BlockRenderer {
  const first = layers[0]?.bake as TerrainBake;
  const { width: W, height: H } = first;
  const base = new Uint32Array(W * H);
  const overlay = new Uint32Array(W * H);
  const depth = new Int32Array(W * H);
  const glow = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const own = layers[owner[i] ?? 0]?.bake ?? first;
      base[i] = own.base[i] ?? 0;
      let best = -1;
      layers.forEach((l, j) => {
        if (!l.bake.overlay[i]) return;
        if (best < 0 || (l.bake.depth[i] ?? 0) > (layers[best]?.bake.depth[i] ?? 0)) best = j;
      });
      const from = layers[best]?.bake;
      if (from) {
        overlay[i] = from.overlay[i] ?? 0;
        depth[i] = from.depth[i] ?? 0;
        glow[i] = from.glow[i] ?? 0;
      }
    }
  }
  const merged: TerrainBake = {
    ...first,
    base,
    overlay,
    depth,
    glow,
    liquid: new Int32Array(),
    tufts: [],
    vents: [],
  };
  const ground = new TerrainRenderer(merged, layers[0]?.biome as Biome, seed);
  const parts = layers.map((l) => {
    // Each layer baked liquid only on its own pixels, so it animates just those.
    return new TerrainRenderer(l.bake, l.biome, seed);
  });
  return {
    bake: merged,
    draw(buf, camX, camY, t, sink) {
      ground.drawBase(buf, camX, camY);
      for (const p of parts) p.drawLiquid(buf, camX, camY, t);
      for (const p of parts) p.drawTufts(buf, camX, camY, t);
      ground.drawOverlay(buf, camX, camY, sink);
      for (const p of parts) p.drawVents(buf, camX, camY, t);
    },
    drawTufts(buf, camX, camY, t, front) {
      for (const p of parts) p.drawTufts(buf, camX, camY, t, front);
    },
  };
}

/**
 * Which biome (index into `biomes`) each pixel of a rect shows: the biome of the tile at a
 * warped spot. The smooth warp is sampled every `WARP_STEP` px; a per-pixel jitter frays it.
 */
export function biomeOwner(
  rect: TileRect,
  biomes: readonly Biome[],
  biomeAt: BiomeField,
  seed: number,
  wet: (tx: number, ty: number) => boolean = () => false,
): Uint8Array {
  const X0 = rect.x * TILE;
  const Y0 = rect.y * TILE;
  const W = rect.width * TILE;
  const H = rect.height * TILE;
  const out = new Uint8Array(W * H);
  for (let gy = 0; gy < H; gy += WARP_STEP) {
    for (let gx = 0; gx < W; gx += WARP_STEP) {
      const [dx, dy] = warp(X0 + gx + WARP_STEP / 2, Y0 + gy + WARP_STEP / 2, seed);
      for (let y = gy; y < Math.min(H, gy + WARP_STEP); y++) {
        for (let x = gx; x < Math.min(W, gx + WARP_STEP); x++) {
          const wx = X0 + x;
          const wy = Y0 + y;
          const jx = (hash2(wx, wy, seed + 5) - 0.5) * 2 * WARP_JITTER;
          const jy = (hash2(wy, wx, seed + 6) - 0.5) * 2 * WARP_JITTER;
          let b = biomeAt(Math.floor((wx + dx + jx) / TILE), Math.floor((wy + dy + jy) / TILE));
          // Water never turns to lava (or back) by the warp: a wet tile keeps its own kind.
          const ox = Math.floor(wx / TILE);
          const oy = Math.floor(wy / TILE);
          const own = biomeAt(ox, oy);
          if (b !== own && b.liquid !== own.liquid && wet(ox, oy)) b = own;
          const k = biomes.indexOf(b);
          out[y * W + x] = k < 0 ? 0 : k;
        }
      }
    }
  }
  return out;
}
