/**
 * Map exploration (C36b): each region map starts dark and is revealed around the player as
 * they walk. The map is cut into `CELL_TILES`-square cells; a cell is explored once the
 * player has been within `REVEAL_RADIUS` tiles of its middle.
 *
 * **Places** are what the player discovers by name: zones (entered), and anchors of the
 * place kinds (towns, landmarks, secrets, lairs, shrines, arenas, hearts: come within their
 * radius). A place discovered for the first time is returned by `visit` so the overworld can
 * toast it. Pure: no rendering, no DOM.
 *
 * Saved per map as `ExploredData` (cells as base64 bits, places by key, and the map's
 * `origin` when written). A map that grew on its north or west side since (C36) moves the
 * cells along, like saved places.
 */

import type { GameContent } from '@game/data';
import type { WorldMap } from './map/world-map';

/** Tiles per side of an exploration cell. */
export const CELL_TILES = 4;
/** Tiles around the player revealed at each step (about the visible screen's half height). */
export const REVEAL_RADIUS = 9;

/** Anchor kinds that are places with a name (DESIGN.md "World"). */
export const PLACE_KINDS = [
  'town',
  'landmark',
  'secret',
  'lair',
  'shrine',
  'arena',
  'heart',
] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number] | 'zone';

/** Discovery radius of a place anchor without its own `radius`. */
const PLACE_RADIUS = 4;
/** Towns are discovered from further away (their anchor is the middle of the town). */
const TOWN_RADIUS = 8;

export interface MapPlace {
  /** `zone:<key>` or `anchor:<key>`. */
  readonly key: string;
  readonly kind: PlaceKind;
  readonly name: string;
  /** Anchor tile, or the middle of a zone (labels). */
  readonly x: number;
  readonly y: number;
  /** Anchor places: discovered within this many tiles. */
  readonly radius: number;
  /** The zone's wild levels (a zone, or the zone a place stands in). */
  readonly levels?: readonly [number, number];
}

/** "town-thornveil-camp" → "Thornveil Camp". */
export function placeName(anchorKey: string): string {
  return anchorKey
    .replace(/^town-/, '')
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const placesCache = new WeakMap<WorldMap, readonly MapPlace[]>();

/** Every named place of a map: its zones, then its place anchors. */
export function mapPlaces(m: WorldMap): readonly MapPlace[] {
  const have = placesCache.get(m);
  if (have) return have;
  const sums = m.zones.map(() => ({ x: 0, y: 0, n: 0 }));
  for (let ty = 0; ty < m.height; ty++)
    for (let tx = 0; tx < m.width; tx++) {
      const z = m.zoneIndex[ty * m.width + tx] ?? 0;
      const s = z ? sums[z - 1] : undefined;
      if (!s) continue;
      s.x += tx;
      s.y += ty;
      s.n++;
    }
  const out: MapPlace[] = m.zones.map((z, i) => {
    const s = sums[i] ?? { x: 0, y: 0, n: 0 };
    const n = Math.max(1, s.n);
    return {
      key: `zone:${z.key}`,
      kind: 'zone',
      name: z.name,
      x: Math.round(s.x / n),
      y: Math.round(s.y / n),
      radius: 0,
      levels: z.levels,
    };
  });
  for (const [key, a] of Object.entries(m.anchors)) {
    if (!(PLACE_KINDS as readonly string[]).includes(a.kind)) continue;
    const zone = m.zoneAt(a.x, a.y);
    out.push({
      key: `anchor:${key}`,
      kind: a.kind as PlaceKind,
      name: placeName(key),
      x: a.x,
      y: a.y,
      radius: a.kind === 'town' ? TOWN_RADIUS : (a.radius ?? PLACE_RADIUS),
      ...(zone ? { levels: zone.levels } : {}),
    });
  }
  placesCache.set(m, out);
  return out;
}

/** What one map has revealed: explored cells and discovered places. */
export class ExploredMap {
  readonly cols: number;
  readonly rows: number;
  readonly cells: Uint8Array;
  readonly places = new Set<string>();

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.cols = Math.ceil(width / CELL_TILES);
    this.rows = Math.ceil(height / CELL_TILES);
    this.cells = new Uint8Array(this.cols * this.rows);
  }

  /** Whether the tile's cell is explored (outside the map: no). */
  seen(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return false;
    return this.cells[Math.floor(ty / CELL_TILES) * this.cols + Math.floor(tx / CELL_TILES)] === 1;
  }

  /** Reveals every cell whose middle is within `r` tiles of the tile; true if any was new. */
  reveal(tx: number, ty: number, r = REVEAL_RADIUS): boolean {
    let changed = false;
    const half = CELL_TILES / 2;
    const c0 = Math.max(0, Math.floor((tx - r) / CELL_TILES));
    const c1 = Math.min(this.cols - 1, Math.floor((tx + r) / CELL_TILES));
    const r0 = Math.max(0, Math.floor((ty - r) / CELL_TILES));
    const r1 = Math.min(this.rows - 1, Math.floor((ty + r) / CELL_TILES));
    // Measured from the tile's middle to the cell's middle.
    const px = tx + 0.5;
    const py = ty + 0.5;
    for (let cy = r0; cy <= r1; cy++)
      for (let cx = c0; cx <= c1; cx++) {
        const dx = cx * CELL_TILES + half - px;
        const dy = cy * CELL_TILES + half - py;
        if (dx * dx + dy * dy > r * r) continue;
        const i = cy * this.cols + cx;
        if (this.cells[i]) continue;
        this.cells[i] = 1;
        changed = true;
      }
    return changed;
  }

  /** Explored cells. */
  get explored(): number {
    let n = 0;
    for (const c of this.cells) n += c;
    return n;
  }
}

/**
 * The player stands on a tile: reveals around it and discovers the zone it is in and any
 * place in range. Returns the places discovered just now (in map order).
 */
export function visit(m: WorldMap, e: ExploredMap, tx: number, ty: number): MapPlace[] {
  e.reveal(tx, ty);
  const zone = m.zoneAt(tx, ty);
  const found: MapPlace[] = [];
  for (const p of mapPlaces(m)) {
    if (e.places.has(p.key)) continue;
    const here =
      p.kind === 'zone'
        ? zone !== undefined && p.key === `zone:${zone.key}`
        : (p.x - tx) ** 2 + (p.y - ty) ** 2 <= p.radius * p.radius;
    if (!here) continue;
    e.places.add(p.key);
    found.push(p);
  }
  return found;
}

// ------------------------------------------------------------------ save form

/** One map's exploration as saved (JSON-safe). */
export interface ExploredData {
  /** The map's `origin` when written (C36), to follow later growth. */
  readonly origin: readonly [number, number];
  readonly cols: number;
  readonly rows: number;
  /** One bit per cell, row by row, as base64. */
  readonly cells: string;
  /** Discovered places by key. */
  readonly places: readonly string[];
}

/** Map id → its exploration. Maps never visited are left out. */
export type Exploration = Readonly<Record<string, ExploredData>>;

export function exploredData(m: WorldMap, e: ExploredMap): ExploredData {
  const bits = new Uint8Array(Math.ceil(e.cells.length / 8));
  e.cells.forEach((c, i) => {
    if (c) bits[i >> 3] = (bits[i >> 3] ?? 0) | (1 << (i & 7));
  });
  return {
    origin: [m.origin[0], m.origin[1]],
    cols: e.cols,
    rows: e.rows,
    cells: toBase64(bits),
    places: [...e.places].sort(),
  };
}

/**
 * The live exploration of a map from its saved form (or a dark map). Cells are moved by
 * however far the map's origin moved since, in whole cells; places the map no longer has
 * are dropped.
 */
export function exploredMap(m: WorldMap, data?: ExploredData): ExploredMap {
  const e = new ExploredMap(m.width, m.height);
  if (!data) return e;
  const dx = Math.round((m.origin[0] - data.origin[0]) / CELL_TILES);
  const dy = Math.round((m.origin[1] - data.origin[1]) / CELL_TILES);
  let bits: Uint8Array;
  try {
    bits = fromBase64(data.cells);
  } catch {
    bits = new Uint8Array(0);
  }
  for (let r = 0; r < data.rows; r++)
    for (let c = 0; c < data.cols; c++) {
      const i = r * data.cols + c;
      if (!((bits[i >> 3] ?? 0) & (1 << (i & 7)))) continue;
      const x = c + dx;
      const y = r + dy;
      if (x >= 0 && y >= 0 && x < e.cols && y < e.rows) e.cells[y * e.cols + x] = 1;
    }
  const known = new Set(mapPlaces(m).map((p) => p.key));
  for (const p of data.places) if (known.has(p)) e.places.add(p);
  return e;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] ?? '';
    out += B64[(n >> 12) & 63] ?? '';
    out += i + 1 < bytes.length ? (B64[(n >> 6) & 63] ?? '') : '=';
    out += i + 2 < bytes.length ? (B64[n & 63] ?? '') : '=';
  }
  return out;
}

function fromBase64(s: string): Uint8Array {
  const clean = s.replace(/=+$/, '');
  if (!/^[A-Za-z0-9+/]*$/.test(clean)) throw new Error('not base64');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const v = (k: number): number => {
      const ch = clean[i + k];
      return ch === undefined ? 0 : B64.indexOf(ch);
    };
    const n = (v(0) << 18) | (v(1) << 12) | (v(2) << 6) | v(3);
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

// ------------------------------------------------------------------ old saves

/** Tiles where an NPC stands (its x/y or anchor), if it is on `map`. */
export function npcTile(
  m: WorldMap,
  n: {
    readonly x?: number | undefined;
    readonly y?: number | undefined;
    readonly anchor?: string | undefined;
  },
): { x: number; y: number } | undefined {
  if (n.x !== undefined && n.y !== undefined) return { x: n.x, y: n.y };
  const a = n.anchor ? m.anchors[n.anchor] : undefined;
  return a ? { x: a.x, y: a.y } : undefined;
}

/** Battles an NPC's dialogue can start (trainer and boss ids). */
export function npcBattles(
  content: GameContent,
  dialogue: string | undefined,
): { trainers: string[]; bosses: string[] } {
  const trainers: string[] = [];
  const bosses: string[] = [];
  const d = dialogue ? content.dialogues.get(dialogue) : undefined;
  for (const node of Object.values(d?.nodes ?? {})) {
    const b = node.battle;
    if (!b) continue;
    if ('trainer' in b) trainers.push(b.trainer);
    else bosses.push(b.boss);
  }
  return { trainers, bosses };
}

/** Radius revealed around the spots an old save proves the player visited. */
const LEGACY_RADIUS = 12;

/**
 * A sensible reveal for a save made before exploration (C36b): around the saved place and
 * last center, every trainer beaten and boss logged, and the hub (start spot) of every
 * region with any of those. Places in reach are discovered quietly.
 */
export function legacyExploration(
  content: GameContent,
  progress: {
    readonly places: readonly { readonly map: string; readonly x: number; readonly y: number }[];
    readonly trainers: Readonly<Record<string, unknown>>;
    readonly bosses: Readonly<Record<string, unknown>>;
  },
  load: (id: string) => WorldMap,
): Record<string, ExploredData> {
  const spots = new Map<string, { x: number; y: number }[]>();
  const add = (map: string, x: number, y: number): void => {
    if (!content.maps.has(map)) return;
    let list = spots.get(map);
    if (!list) spots.set(map, (list = []));
    list.push({ x, y });
  };
  for (const p of progress.places) add(p.map, p.x, p.y);
  for (const n of content.npcs.values()) {
    if (!content.maps.has(n.map)) continue;
    const { trainers, bosses } = npcBattles(content, n.dialogue);
    const met =
      trainers.some((t) => t in progress.trainers) || bosses.some((b) => b in progress.bosses);
    if (!met) continue;
    const at = npcTile(load(n.map), n);
    if (at) add(n.map, at.x, at.y);
  }
  for (const s of content.starts.values()) {
    if (!spots.has(s.map)) continue;
    const m = load(s.map);
    const a = m.anchors[s.anchor] ?? m.anchors['spawn'];
    if (a) add(s.map, a.x, a.y);
  }
  const out: Record<string, ExploredData> = {};
  for (const [id, list] of spots) {
    const m = load(id);
    const e = new ExploredMap(m.width, m.height);
    for (const s of list) {
      e.reveal(s.x, s.y, LEGACY_RADIUS);
      const z = m.zoneAt(s.x, s.y);
      if (z) e.places.add(`zone:${z.key}`);
    }
    for (const p of mapPlaces(m)) if (p.kind !== 'zone' && e.seen(p.x, p.y)) e.places.add(p.key);
    out[id] = exploredData(m, e);
  }
  return out;
}
