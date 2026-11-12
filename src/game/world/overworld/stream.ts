/**
 * Terrain streaming for the overworld (C20): the map is baked in small square blocks
 * (`BLOCK` tiles) as they come near the view and dropped again once far away, so memory
 * stays flat on a 200×200 region. Blocks in view are baked at once (no holes); the ring
 * around the view is baked ahead within a per-frame time budget.
 *
 * It also answers depth questions for entities: which prop pixels stand in front of an
 * entity's base line, and redraws tall grass over an entity's feet. Pure: no DOM.
 */

import type { PixelBuffer } from '@engine/render/pixel-buffer';
import { TerrainRenderer } from '../animate';
import { TILE, type Biome } from '../biomes';
import type { WorldMap } from '../map';
import { bakeTerrain, type PropPlacement, type TerrainMap, type TileRect } from '../terrain';

/** Bake block size in tiles (128 px): small enough to bake in a few ms. */
export const BLOCK = 8;
/** Blocks kept around the view before they are dropped. */
const KEEP = 2;

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
  private readonly blocks = new Map<number, TerrainRenderer>();
  /** Blocks baked so far (for stats/tests). */
  baked = 0;

  constructor(
    readonly map: WorldMap,
    readonly biome: Biome,
    private readonly now: () => number = () => performance.now(),
  ) {
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
  visible(view: PixelBox): TerrainRenderer[] {
    const out: TerrainRenderer[] = [];
    for (const i of this.blocksIn(view, 0)) out.push(this.block(i));
    return out;
  }

  /** Draws terrain for the view (camera top-left at `camX`, `camY`). */
  draw(buf: PixelBuffer, camX: number, camY: number, t: number): void {
    for (const r of this.visible({ x: camX, y: camY, width: buf.width, height: buf.height }))
      r.draw(buf, camX, camY, t);
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

  private block(i: number): TerrainRenderer {
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
    const map: TerrainMap = { ...this.terrain, props, tall: this.tall[i] ?? [] };
    r = new TerrainRenderer(bakeTerrain(map, this.biome, rect), this.biome, this.map.seed);
    this.blocks.set(i, r);
    this.baked++;
    return r;
  }
}
