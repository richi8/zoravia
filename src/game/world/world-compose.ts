/**
 * The seamless world (C37): every placed region merged into one big `WorldMap`, so the
 * player walks between regions with no loading. Pure: no DOM.
 *
 * - Each region keeps its own map and data in its pack. At load, `composeWorld` copies every
 *   region's tiles, corners, zones, props and anchors into one map at its C36c world place
 *   (`worldLayout`). Zone and anchor keys become `<map>/<key>`, so they stay unique.
 * - **Filler:** tiles outside every region are never walkable. Each takes the biome of the
 *   nearest region. It is open sea in the band a ferry crosses and next to a region whose edge
 *   is water. Elsewhere it is blocked land, drawn with the biome's trees, cacti or pines near
 *   the regions (farther out nobody can see it).
 * - **Seams:** where two regions touch, their two border walls become one natural border (the
 *   C37 pick "tree line into scrub"): each side's wall is rebuilt from its own biome's plants,
 *   the line next to the seam always closed. A row stays open only where both sides were open
 *   before, which is a pass such as Ember Pass.
 * - **Ferries:** a ferry link between two placed regions becomes a boat route over the sea,
 *   from the link's `route` data or straight between the two docks.
 * - A map without a world place (a debug map) is composed alone, so it still loads by itself.
 *
 * Saves keep the region map and its local tile: `toLocal` and `toWorld` convert.
 */

import { hash2 } from '@engine/core/noise';
import type { GameContent } from '@game/data';
import { TILE_BLOCK } from '@game/data/maps';
import { npcPlace, type Npc } from '@game/data/npcs';
import { BIOME_IDS, BIOMES, type Biome, type BiomeId } from './biomes';
import { linkedArrival, loadRegion, WorldMap, type Zone } from './map';
import type { Dir, Tile } from './overworld/mover';
import type { PropKind } from './props';
import type { PropPlacement } from './terrain';
import { gapBetween, worldBounds, worldLayout, type WorldRegion } from './world-layout';

/** A region inside the composed world. */
export interface PlacedRegion {
  readonly id: string;
  readonly name: string;
  readonly biome: BiomeId;
  /** The region's own map, in its local tiles. */
  readonly map: WorldMap;
  /** World-map tile of the region's local (0, 0). */
  readonly x: number;
  readonly y: number;
  /** Its C36c layout place (what the map window uses). */
  readonly layout: { readonly x: number; readonly y: number };
}

/** One end of a ferry: the walkable connection tile and the water tile the boat docks on. */
export interface FerryEnd {
  readonly region: PlacedRegion;
  readonly connection: string;
  readonly tile: Tile;
  /** The tile next to `tile` toward the boat: bumping into it or facing it boards. */
  readonly front: Tile;
  /** Where the boat waits, on the water (the first or last tile of the route). */
  readonly dock: Tile;
  /** Facing after stepping off the boat here (away from the boat). */
  readonly facing: Dir;
}

export interface Ferry {
  readonly a: FerryEnd;
  readonly b: FerryEnd;
  /** World tiles from `a.dock` to `b.dock`. */
  readonly route: readonly Tile[];
}

/** An NPC at its world tile. */
export interface PlacedNpc {
  readonly npc: Npc;
  readonly x: number;
  readonly y: number;
  readonly facing: Dir;
}

/** Tiles of filler land around the regions that get plants (farther out nobody sees it). */
export const FILLER_REACH = 24;

/**
 * How sea filler looks next to a biome whose liquid is lava: the biome's own ground and
 * plants, but water (Verdale's water and a sandy bank), so a desert coast meets the sea.
 */
export function seaLook(biome: Biome): Biome {
  if (biome.liquid === 'water') return biome;
  const water = BIOMES.forest;
  return {
    ...biome,
    liquid: 'water',
    foam: water.foam,
    ramps: { ...biome.ramps, liquid: water.ramps.liquid, bank: [0xa8743e, 0xc28c52, 0xd8a86c] },
  };
}

const SEA_LOOKS = new Map<BiomeId, Biome>(BIOME_IDS.map((id) => [id, seaLook(BIOMES[id])]));

export class World {
  private readonly regionIdx: Uint8Array;
  private readonly biomeIdx: Uint8Array;
  private readonly sea: Uint8Array;

  constructor(
    readonly map: WorldMap,
    readonly regions: readonly PlacedRegion[],
    readonly ferries: readonly Ferry[],
    regionIdx: Uint8Array,
    biomeIdx: Uint8Array,
    sea: Uint8Array,
  ) {
    this.regionIdx = regionIdx;
    this.biomeIdx = biomeIdx;
    this.sea = sea;
  }

  /** How a tile is drawn: its biome, or for sea filler the biome with water (`seaLook`). */
  lookAt(tx: number, ty: number): Biome {
    const id = this.biomeAt(tx, ty);
    const x = Math.min(Math.max(tx, 0), this.map.width - 1);
    const y = Math.min(Math.max(ty, 0), this.map.height - 1);
    return this.sea[y * this.map.width + x] ? (SEA_LOOKS.get(id) ?? BIOMES[id]) : BIOMES[id];
  }

  /** The region a world tile belongs to (none on filler or outside). */
  regionAt(tx: number, ty: number): PlacedRegion | undefined {
    const i = this.map.index(tx, ty);
    const r = i < 0 ? 0 : (this.regionIdx[i] ?? 0);
    return r ? this.regions[r - 1] : undefined;
  }

  /** The biome drawn on a tile (filler takes its nearest region's). */
  biomeAt(tx: number, ty: number): BiomeId {
    const x = Math.min(Math.max(tx, 0), this.map.width - 1);
    const y = Math.min(Math.max(ty, 0), this.map.height - 1);
    return BIOME_IDS[this.biomeIdx[y * this.map.width + x] ?? 0] ?? 'forest';
  }

  region(id: string): PlacedRegion | undefined {
    return this.regions.find((r) => r.id === id);
  }

  /** A region's local tile as a world tile (undefined for a map not in this world). */
  toWorld(mapId: string, x: number, y: number): Tile | undefined {
    const r = this.region(mapId);
    return r ? { x: r.x + x, y: r.y + y } : undefined;
  }

  /** A world tile as its region and local tile. */
  toLocal(tx: number, ty: number): { region: PlacedRegion; x: number; y: number } | undefined {
    const region = this.regionAt(tx, ty);
    return region ? { region, x: tx - region.x, y: ty - region.y } : undefined;
  }

  /**
   * The ferry boarded by facing tile `t` from tile `from` (the end's connection tile and
   * the tile in front of it toward the boat), if any.
   */
  ferryAt(from: Tile, t: Tile): { ferry: Ferry; from: FerryEnd; to: FerryEnd } | undefined {
    const is = (a: Tile, b: Tile): boolean => a.x === b.x && a.y === b.y;
    for (const ferry of this.ferries) {
      if (is(ferry.a.tile, from) && is(ferry.a.front, t))
        return { ferry, from: ferry.a, to: ferry.b };
      if (is(ferry.b.tile, from) && is(ferry.b.front, t))
        return { ferry, from: ferry.b, to: ferry.a };
    }
    return undefined;
  }

  /** The ferry leaving from a region's connection, if any. */
  ferryFrom(
    mapId: string,
    connection: string,
  ): { ferry: Ferry; from: FerryEnd; to: FerryEnd } | undefined {
    for (const ferry of this.ferries) {
      if (ferry.a.region.id === mapId && ferry.a.connection === connection)
        return { ferry, from: ferry.a, to: ferry.b };
      if (ferry.b.region.id === mapId && ferry.b.connection === connection)
        return { ferry, from: ferry.b, to: ferry.a };
    }
    return undefined;
  }

  /** Every NPC of every region, at its world tile, in pack order. */
  npcs(content: GameContent): PlacedNpc[] {
    const out: PlacedNpc[] = [];
    for (const n of content.npcs.values()) {
      const r = this.region(n.map);
      if (!r) continue;
      const p = npcPlace(n, r.map);
      out.push({ npc: n, x: r.x + p.x, y: r.y + p.y, facing: p.facing });
    }
    return out;
  }
}

const cache = new WeakMap<GameContent, Map<string, World>>();

/**
 * The world a map is played in: every placed region when `mapId` has a world place, else
 * that map alone (a debug map). Cached per content.
 */
export function worldFor(content: GameContent, mapId: string): World {
  let worlds = cache.get(content);
  if (!worlds) {
    worlds = new Map();
    cache.set(content, worlds);
  }
  const placed = worldLayout(content).filter((r) => isPlaced(content, r.map));
  const key = placed.some((r) => r.map === mapId) ? '*world' : mapId;
  let w = worlds.get(key);
  if (!w) {
    w =
      key === '*world'
        ? composeWorld(content, placed)
        : composeWorld(content, [regionAlone(content, mapId)]);
    worlds.set(key, w);
  }
  return w;
}

function isPlaced(content: GameContent, mapId: string): boolean {
  for (const s of content.starts.values()) if (s.map === mapId && s.world) return true;
  return false;
}

function regionAlone(content: GameContent, mapId: string): WorldRegion {
  const m = content.maps.require(mapId);
  return { map: mapId, name: m.name, x: 0, y: 0, width: m.width, height: m.height };
}

interface Slot {
  readonly region: PlacedRegion;
  readonly zoneBase: number;
}

/** Builds the world from regions at their layout places. */
export function composeWorld(content: GameContent, layout: readonly WorldRegion[]): World {
  const b = worldBounds(layout);
  const W = b.width;
  const H = b.height;
  const regions: PlacedRegion[] = layout.map((r) => {
    const map = loadRegion(content, r.map);
    return {
      id: r.map,
      name: map.name,
      biome: map.biome,
      map,
      x: r.x - b.x,
      y: r.y - b.y,
      layout: { x: r.x, y: r.y },
    };
  });
  const first = regions[0];
  if (!first) throw new Error('A world needs at least one region');
  const world = new WorldMap({
    name: regions.length > 1 ? 'World' : first.name,
    biome: first.biome,
    seed: first.map.seed,
    width: W,
    height: H,
  });
  const regionIdx = new Uint8Array(W * H);
  const biomeIdx = new Uint8Array(W * H);

  // Regions: tiles, zones, anchors, props.
  const slots: Slot[] = [];
  regions.forEach((r, i) => {
    const m = r.map;
    const zoneBase = world.zones.length;
    world.zones.push(...m.zones.map((z): Zone => ({ ...z, key: `${r.id}/${z.key}` })));
    if (world.zones.length > 255) throw new Error('A world holds at most 255 zones');
    const bi = BIOME_IDS.indexOf(r.biome);
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) {
        const s = y * m.width + x;
        const d = (r.y + y) * W + r.x + x;
        regionIdx[d] = i + 1;
        biomeIdx[d] = bi;
        world.flags[d] = m.flags[s] ?? 0;
        const z = m.zoneIndex[s] ?? 0;
        world.zoneIndex[d] = z ? z + zoneBase : 0;
      }
    }
    for (const [k, a] of Object.entries(m.anchors))
      world.anchors[`${r.id}/${k}`] = { ...a, x: a.x + r.x, y: a.y + r.y };
    slots.push({ region: r, zoneBase });
  });

  // Filler: nearest region, sea or land.
  const sea = seaBands(content, layout, b);
  const near = new Int16Array(W * H).fill(-1);
  const dist = new Uint16Array(W * H);
  const isSea = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (regionIdx[i]) continue;
      let best = 0;
      let bestD = Infinity;
      regions.forEach((r, k) => {
        const dx = Math.max(r.x - x, 0, x - (r.x + r.map.width - 1));
        const dy = Math.max(r.y - y, 0, y - (r.y + r.map.height - 1));
        const d = Math.max(dx, dy);
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      });
      const r = regions[best] as PlacedRegion;
      near[i] = best;
      dist[i] = Math.min(bestD, 65535);
      biomeIdx[i] = BIOME_IDS.indexOf(r.biome);
      const ex = Math.min(Math.max(x - r.x, 0), r.map.width - 1);
      const ey = Math.min(Math.max(y - r.y, 0), r.map.height - 1);
      const watery = BIOMES[r.biome].liquid === 'water' && r.map.liquidCorners(ex, ey) >= 3;
      if (watery || sea.some((s) => inRect(s, x, y))) isSea[i] = 1;
      else world.flags[i] = TILE_BLOCK;
    }
  }

  // Corners: a corner takes its region's value; filler corners next to sea are water.
  const cols = W + 1;
  for (let cy = 0; cy <= H; cy++) {
    for (let cx = 0; cx <= W; cx++) {
      let owner: PlacedRegion | undefined;
      let wet = false;
      for (const [tx, ty] of [
        [cx, cy],
        [cx - 1, cy],
        [cx, cy - 1],
        [cx - 1, cy - 1],
      ] as const) {
        if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
        const r = regionIdx[ty * W + tx] ?? 0;
        if (r) {
          owner = regions[r - 1];
          break;
        }
        if (isSea[ty * W + tx]) wet = true;
      }
      const c = cy * cols + cx;
      if (owner) {
        const lx = cx - owner.x;
        const ly = cy - owner.y;
        world.alt.data[c] = owner.map.alt.get(lx, ly);
        world.path.data[c] = owner.map.path.get(lx, ly);
        world.liquid.data[c] = owner.map.liquid.get(lx, ly);
      } else if (wet) world.liquid.data[c] = 1;
    }
  }

  // Props: the regions' own (minus their walls at seams), the seams, then the filler plants.
  const seams = findSeams(regions);
  const cleared = new Set<number>();
  const seamProps: PropPlacement[] = [];
  for (const s of seams) buildSeam(s, W, world, cleared, seamProps);
  for (const r of regions) {
    for (const p of r.map.props) {
      const tx = p.tx + r.x;
      const ty = p.ty + r.y;
      if (cleared.has(ty * W + tx)) continue;
      world.props.push({ ...p, tx, ty });
    }
  }
  world.props.push(...seamProps);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (regionIdx[i] || isSea[i] || (dist[i] ?? 0) > FILLER_REACH) continue;
      const biome = BIOME_IDS[biomeIdx[i] ?? 0] ?? 'forest';
      const p = fillerPlant(biome, x, y, world.seed);
      if (p) world.props.push(p);
    }
  }
  world.refreshCollision();

  return new World(world, regions, ferries(content, regions), regionIdx, biomeIdx, isSea);
}

type Rect = { x: number; y: number; width: number; height: number };

const inRect = (r: Rect, x: number, y: number): boolean =>
  x >= r.x && y >= r.y && x < r.x + r.width && y < r.y + r.height;

/**
 * The sea a ferry crosses, as a band across the whole world (world-map tiles): the rows (or
 * columns) between two regions a ferry links across a gap.
 */
function seaBands(
  content: GameContent,
  layout: readonly WorldRegion[],
  b: { x: number; y: number; width: number; height: number },
): Rect[] {
  const out: Rect[] = [];
  for (const r of layout) {
    for (const [key, c] of Object.entries(content.maps.get(r.map)?.connections ?? {})) {
      if (c.kind !== 'ferry') continue;
      const there = linkedArrival(content, r.map, key);
      const o = there && layout.find((x) => x.map === there.map);
      const gap = o && gapBetween(r, o);
      if (!gap) continue;
      const across = gap.height > 0 && gap.width > 0 && isRowGap(r, o);
      out.push(
        across
          ? { x: 0, y: gap.y - b.y, width: b.width, height: gap.height }
          : { x: gap.x - b.x, y: 0, width: gap.width, height: b.height },
      );
    }
  }
  return out;
}

/** Whether two regions face each other across rows (one above the other). */
function isRowGap(a: WorldRegion, b: WorldRegion): boolean {
  return a.y + a.height <= b.y || b.y + b.height <= a.y;
}

// ------------------------------------------------------------------ seams

/** Where region `a` meets region `b` along a vertical (`x`) or horizontal (`y`) line. */
interface Seam {
  readonly a: PlacedRegion;
  readonly b: PlacedRegion;
  readonly axis: 'x' | 'y';
  /** The world line: `b`'s first column (axis x) or row (axis y). */
  readonly at: number;
  /** The overlap along the seam, [from, to). */
  readonly from: number;
  readonly to: number;
}

function findSeams(regions: readonly PlacedRegion[]): Seam[] {
  const out: Seam[] = [];
  for (const a of regions) {
    for (const b of regions) {
      if (a === b) continue;
      if (a.x + a.map.width === b.x) {
        const from = Math.max(a.y, b.y);
        const to = Math.min(a.y + a.map.height, b.y + b.map.height);
        if (to > from) out.push({ a, b, axis: 'x', at: b.x, from, to });
      }
      if (a.y + a.map.height === b.y) {
        const from = Math.max(a.x, b.x);
        const to = Math.min(a.x + a.map.width, b.x + b.map.width);
        if (to > from) out.push({ a, b, axis: 'y', at: b.y, from, to });
      }
    }
  }
  return out;
}

/** A biome's border plants: the closed line next to the seam, and the thinning row behind. */
const BORDER: Readonly<
  Record<BiomeId, { line: readonly PropKind[]; inner: readonly [PropKind, number][] }>
> = {
  forest: { line: ['bush', 'tree'], inner: [['tree', 0.45]] },
  desert: {
    line: ['cactus', 'rock'],
    inner: [
      ['cactus', 0.3],
      ['shrub', 0.25],
    ],
  },
  frozen: { line: ['snowrock', 'pine'], inner: [['pine', 0.4]] },
};

/**
 * Rebuilds the two walls along a seam (C37 "tree line into scrub"). Each side's two border
 * rows (columns for a vertical seam) are cleared of props and planted again from its own
 * biome: the line next to the seam is always solid and blocked, the row behind it thins out.
 * Where both sides were walkable next to the seam (a pass), nothing changes.
 */
function buildSeam(
  s: Seam,
  W: number,
  world: WorldMap,
  cleared: Set<number>,
  out: PropPlacement[],
): void {
  const sides = [
    { r: s.a, line: s.at - 1, inner: s.at - 2 },
    { r: s.b, line: s.at, inner: s.at + 1 },
  ];
  const tile = (along: number, across: number): [number, number] =>
    s.axis === 'x' ? [across, along] : [along, across];
  for (let along = s.from; along < s.to; along++) {
    const open = sides.every((side) => {
      const [x, y] = tile(along, side.line);
      return !side.r.map.blocked(x - side.r.x, y - side.r.y);
    });
    if (open) continue;
    for (const side of sides) {
      const plants = BORDER[side.r.biome];
      for (const across of [side.line, side.inner]) {
        const [x, y] = tile(along, across);
        cleared.add(y * W + x);
      }
      const seed = world.seed + (side.r === s.a ? 0 : 7);
      const jitter = (k: number): number => Math.round((hash2(along, k, seed + 3) - 0.5) * 6);
      const [lx, ly] = tile(along, side.line);
      const lineKind = plants.line[hash2(along, side.line, seed) < 0.5 ? 0 : 1] ?? 'tree';
      out.push(plant(lineKind, lx, ly, along, s.axis === 'x' ? jitter(1) : 0));
      world.flags[ly * W + lx] = TILE_BLOCK;
      const [ix, iy] = tile(along, side.inner);
      const roll = hash2(along, side.inner, seed + 1);
      let acc = 0;
      for (const [kind, p] of plants.inner) {
        acc += p;
        if (roll < acc) {
          out.push(plant(kind, ix, iy, along * 3, s.axis === 'x' ? jitter(2) : 0));
          break;
        }
      }
      // The old wall blocked this tile by its props only; it opens if nothing solid grows.
      const fi = iy * W + ix;
      world.flags[fi] = (world.flags[fi] ?? 0) & ~TILE_BLOCK;
    }
  }
}

const plant = (kind: PropKind, tx: number, ty: number, v: number, dx: number): PropPlacement => ({
  kind,
  tx,
  ty,
  variant: Math.abs(v) & 7,
  ...(dx ? { dx } : {}),
});

/** A plant on blocked filler land, or none (by biome, deterministic per tile). */
function fillerPlant(
  biome: BiomeId,
  x: number,
  y: number,
  seed: number,
): PropPlacement | undefined {
  const h = hash2(x, y, seed + 911);
  const v = Math.floor(hash2(y, x, seed + 17) * 8);
  const dx = Math.round((hash2(x, y, seed + 5) - 0.5) * 6);
  const at = (kind: PropKind): PropPlacement => ({
    kind,
    tx: x,
    ty: y,
    variant: v,
    ...(dx ? { dx } : {}),
  });
  switch (biome) {
    case 'forest':
      return h < 0.78 ? at('tree') : h < 0.88 ? at('bush') : undefined;
    case 'desert':
      return h < 0.16 ? at('cactus') : h < 0.3 ? at('rock') : h < 0.42 ? at('shrub') : undefined;
    case 'frozen':
      return h < 0.7 ? at('pine') : h < 0.8 ? at('snowrock') : undefined;
  }
}

// ------------------------------------------------------------------ ferries

const NEIGHBOURS: readonly (readonly [number, number, Dir])[] = [
  [0, 1, 'up'],
  [0, -1, 'down'],
  [1, 0, 'left'],
  [-1, 0, 'right'],
];

function ferries(content: GameContent, regions: readonly PlacedRegion[]): Ferry[] {
  const out: Ferry[] = [];
  const done = new Set<string>();
  for (const r of regions) {
    for (const [key, c] of Object.entries(r.map.connections)) {
      if (c.kind !== 'ferry') continue;
      const there = linkedArrival(content, r.id, key);
      const o = there && regions.find((x) => x.id === there.map);
      if (!there || !o) continue;
      const id = [`${r.id}#${key}`, `${o.id}#${there.connection}`].sort().join('|');
      if (done.has(id)) continue;
      done.add(id);
      const back = o.map.connections[there.connection];
      const aTile = { x: r.x + c.x, y: r.y + c.y };
      const bTile = { x: o.x + there.x, y: o.y + there.y };
      let route: Tile[] | undefined;
      if (c.route) route = c.route.map(([x, y]) => ({ x: r.x + x, y: r.y + y }));
      else if (back?.route)
        route = back.route.map(([x, y]) => ({ x: o.x + x, y: o.y + y })).reverse();
      const aDock = route?.[0] ?? dockNear(aTile, bTile);
      const bDock = route?.[route.length - 1] ?? dockNear(bTile, aTile);
      const end = (region: PlacedRegion, connection: string, tile: Tile, dock: Tile): FerryEnd => {
        const front = toward(tile, dock);
        return { region, connection, tile, front, dock, facing: awayFrom(tile, front) };
      };
      out.push({
        a: end(r, key, aTile, aDock),
        b: end(o, there.connection, bTile, bDock),
        route: route ?? [aDock, bDock],
      });
    }
  }
  return out;
}

/** The tile next to `t` that lies most toward `other` (where the boat docks). */
function dockNear(t: Tile, other: Tile): Tile {
  let best = { x: t.x, y: t.y + 1 };
  let bestD = Infinity;
  for (const [dx, dy] of NEIGHBOURS) {
    const n = { x: t.x + dx, y: t.y + dy };
    const d = Math.abs(n.x - other.x) + Math.abs(n.y - other.y);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

/** The neighbour of `t` closest to `dock`. */
function toward(t: Tile, dock: Tile): Tile {
  return dockNear(t, dock);
}

/** Facing from `t` away from its neighbour `n`. */
function awayFrom(t: Tile, n: Tile): Dir {
  for (const [dx, dy, dir] of NEIGHBOURS) if (n.x === t.x + dx && n.y === t.y + dy) return dir;
  return 'down';
}
