/**
 * A decoded region map in memory: terrain corner grids (C11), per-tile flags, zones,
 * props, anchors and connection points, plus collision derived from all of it. Chunk
 * helpers let the overworld (C20) bake and stream one chunk at a time. Pure: no DOM.
 *
 * The world tool builds and edits maps through the same class, so fields are mutable;
 * game code treats a decoded map as read-only. Call `refreshCollision()` after edits.
 */

import { CornerGrid } from '@engine/world/autotile';
import {
  DEFAULT_CHUNK_TILES,
  TILE_BLOCK,
  TILE_OPEN,
  TILE_TALL,
  type AnchorData,
  type ConnectionData,
  type ZoneData,
} from '@game/data/maps';
import type { BiomeId } from '../biomes';
import { PROP_INFO, propFootprint } from '../props';
import type { PropPlacement, TerrainMap, TileRect } from '../terrain';

export interface Zone extends ZoneData {
  /** Local zone id in the map (`meadow`). */
  readonly key: string;
}

/** A tile counts as water/lava (blocked) when at least this many of its corners are liquid. */
export const LIQUID_BLOCK_CORNERS = 3;

export interface WorldMapInit {
  readonly name: string;
  readonly biome: BiomeId;
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  readonly chunkSize?: number;
}

export class WorldMap {
  name: string;
  readonly biome: BiomeId;
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  readonly chunkSize: number;
  readonly alt: CornerGrid;
  readonly path: CornerGrid;
  readonly liquid: CornerGrid;
  /** Per tile: `TILE_TALL | TILE_BLOCK | TILE_OPEN` bits. */
  readonly flags: Uint8Array;
  /** Per tile: 0 = no zone, otherwise 1 + index into `zones`. */
  readonly zoneIndex: Uint8Array;
  zones: Zone[] = [];
  props: PropPlacement[] = [];
  anchors: Record<string, AnchorData> = {};
  connections: Record<string, ConnectionData> = {};
  /** Where the region's first shipped tile (0, 0) sits now (C36; see `regionMapSchema`). */
  origin: readonly [number, number] = [0, 0];
  private readonly solid: Uint8Array;
  private doors: Map<number, 'center' | 'shop'> | undefined;

  constructor(init: WorldMapInit) {
    this.name = init.name;
    this.biome = init.biome;
    this.seed = init.seed;
    this.width = init.width;
    this.height = init.height;
    this.chunkSize = init.chunkSize ?? DEFAULT_CHUNK_TILES;
    this.alt = new CornerGrid(init.width, init.height);
    this.path = new CornerGrid(init.width, init.height);
    this.liquid = new CornerGrid(init.width, init.height);
    const n = init.width * init.height;
    this.flags = new Uint8Array(n);
    this.zoneIndex = new Uint8Array(n);
    this.solid = new Uint8Array(n);
  }

  /** Deep copy (the world tool edits copies, never its inputs). */
  clone(): WorldMap {
    const m = new WorldMap(this);
    m.alt.data.set(this.alt.data);
    m.path.data.set(this.path.data);
    m.liquid.data.set(this.liquid.data);
    m.flags.set(this.flags);
    m.zoneIndex.set(this.zoneIndex);
    m.zones = this.zones.map((z) => ({ ...z, spawns: z.spawns.map((s) => ({ ...s })) }));
    m.props = this.props.map((p) => ({ ...p }));
    m.anchors = structuredClone(this.anchors);
    m.connections = structuredClone(this.connections);
    m.origin = this.origin;
    m.refreshCollision();
    return m;
  }

  inside(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.width && ty < this.height;
  }

  /** Tile index, or -1 outside the map. */
  index(tx: number, ty: number): number {
    return this.inside(tx, ty) ? ty * this.width + tx : -1;
  }

  tall(tx: number, ty: number): boolean {
    const i = this.index(tx, ty);
    return i >= 0 && ((this.flags[i] ?? 0) & TILE_TALL) !== 0;
  }

  /** True when the player cannot stand on the tile. Outside the map is always blocked. */
  blocked(tx: number, ty: number): boolean {
    const i = this.index(tx, ty);
    return i < 0 || this.solid[i] === 1;
  }

  /** The service behind a building door on this tile (C28), if any. */
  doorAt(tx: number, ty: number): 'center' | 'shop' | undefined {
    if (!this.doors) {
      this.doors = new Map();
      for (const p of this.props) {
        const service = PROP_INFO[p.kind].service;
        if (service) this.doors.set(p.ty * this.width + p.tx, service);
      }
    }
    return this.inside(tx, ty) ? this.doors.get(ty * this.width + tx) : undefined;
  }

  zoneAt(tx: number, ty: number): Zone | undefined {
    const i = this.index(tx, ty);
    const z = i < 0 ? 0 : (this.zoneIndex[i] ?? 0);
    return z ? this.zones[z - 1] : undefined;
  }

  zone(key: string): Zone | undefined {
    return this.zones.find((z) => z.key === key);
  }

  /** Index + 1 of a zone key (what `zoneIndex` stores); adds nothing. 0 if unknown. */
  zoneSlot(key: string | null): number {
    if (key === null) return 0;
    return this.zones.findIndex((z) => z.key === key) + 1;
  }

  /** Number of liquid corners of a tile (0–4). */
  liquidCorners(tx: number, ty: number): number {
    const g = this.liquid;
    return g.get(tx, ty) + g.get(tx + 1, ty) + g.get(tx, ty + 1) + g.get(tx + 1, ty + 1);
  }

  /**
   * Whether a tile's water/lava blocks walking: 3+ liquid corners, or 2 unless they are the
   * two top corners. With water only at the top, an entity's feet (bottom of the tile) stand
   * on the bank; any other half-liquid tile would put the feet or body in the water (C20).
   */
  liquidBlocks(tx: number, ty: number): boolean {
    const n = this.liquidCorners(tx, ty);
    if (n >= LIQUID_BLOCK_CORNERS) return true;
    if (n < 2) return false;
    return !(this.liquid.get(tx, ty) && this.liquid.get(tx + 1, ty));
  }

  /**
   * Recomputes collision: a tile is blocked when its liquid blocks (`liquidBlocks`) or a solid
   * prop covers it (buildings cover their whole footprint); a walkway (bridge deck) opens its
   * tile over water. Tile flags still win (`TILE_BLOCK` over `TILE_OPEN`).
   */
  refreshCollision(): void {
    const { width, height, solid, flags } = this;
    solid.fill(0);
    this.doors = undefined;
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        if (this.liquidBlocks(tx, ty)) solid[ty * width + tx] = 1;
      }
    }
    for (const p of this.props) {
      const info = PROP_INFO[p.kind];
      if (!info.solid && !info.walkway) continue;
      const [x0, y0, w, h] = propFootprint(p.kind, p.tx, p.ty, p.variant);
      for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
          const i = this.index(x, y);
          if (i >= 0) solid[i] = info.solid ? 1 : 0;
        }
      }
    }
    for (let i = 0; i < solid.length; i++) {
      const f = flags[i] ?? 0;
      if (f & TILE_BLOCK) solid[i] = 1;
      else if (f & TILE_OPEN) solid[i] = 0;
    }
  }

  /** Walkable tiles reachable from a tile by 4-way steps (1 = reachable), per tile index. */
  reachableFrom(tx: number, ty: number): Uint8Array {
    const seen = new Uint8Array(this.width * this.height);
    if (this.blocked(tx, ty)) return seen;
    const queue = [ty * this.width + tx];
    seen[ty * this.width + tx] = 1;
    while (queue.length) {
      const i = queue.pop() ?? 0;
      const x = i % this.width;
      const y = (i - x) / this.width;
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ] as const) {
        const j = ny * this.width + nx;
        if (!this.blocked(nx, ny) && !seen[j]) {
          seen[j] = 1;
          queue.push(j);
        }
      }
    }
    return seen;
  }

  get chunksWide(): number {
    return Math.ceil(this.width / this.chunkSize);
  }

  get chunksHigh(): number {
    return Math.ceil(this.height / this.chunkSize);
  }

  /** Tile rect of chunk (`cx`, `cy`); edge chunks may be smaller. */
  chunkRect(cx: number, cy: number): TileRect {
    const x = cx * this.chunkSize;
    const y = cy * this.chunkSize;
    return {
      x,
      y,
      width: Math.min(this.chunkSize, this.width - x),
      height: Math.min(this.chunkSize, this.height - y),
    };
  }

  /** Chunks overlapping a tile rect (clipped to the map), row by row. */
  chunksIn(rect: TileRect): [number, number][] {
    const s = this.chunkSize;
    const x0 = Math.max(0, Math.floor(rect.x / s));
    const y0 = Math.max(0, Math.floor(rect.y / s));
    const x1 = Math.min(this.chunksWide - 1, Math.floor((rect.x + rect.width - 1) / s));
    const y1 = Math.min(this.chunksHigh - 1, Math.floor((rect.y + rect.height - 1) / s));
    const out: [number, number][] = [];
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) out.push([cx, cy]);
    return out;
  }

  /** Tall-grass tiles as a list (the C11 `TerrainMap` form). */
  tallTiles(): [number, number][] {
    const out: [number, number][] = [];
    for (let i = 0; i < this.flags.length; i++) {
      if ((this.flags[i] ?? 0) & TILE_TALL) out.push([i % this.width, Math.floor(i / this.width)]);
    }
    return out;
  }

  /** The map in the form the C11 terrain baker draws (`bakeTerrain(map, biome, rect)`). */
  toTerrainMap(): TerrainMap {
    return {
      width: this.width,
      height: this.height,
      seed: this.seed,
      alt: this.alt,
      path: this.path,
      liquid: this.liquid,
      props: this.props,
      tall: this.tallTiles(),
    };
  }
}
