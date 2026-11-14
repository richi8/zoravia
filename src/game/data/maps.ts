/**
 * World maps (DESIGN.md "World"): one region per entry, as shipped data. The world tool
 * (`tools/world`) generates a region once from a seed, merges the hand-edit overlay on top
 * and writes the result into a pack; the game decodes it with `decodeRegion`.
 *
 * Format v1, all positions in tiles from the map's top-left:
 * - The map is cut into square **chunks** (`chunkSize` tiles, last row/column may be
 *   smaller), each stored as rows of characters so diffs stay readable:
 *   - `corners`: terrain per tile **corner** (C11 dual grid), one digit 0–7 per corner:
 *     bit 1 alt ground, bit 2 path, bit 4 liquid. A chunk holds the corners of its tiles'
 *     top-left; the last chunk of a row/column also holds the closing corner row/column.
 *   - `tiles`: one digit per tile: bit 1 tall grass, bit 2 always blocked, bit 4 always
 *     walkable (both unset = collision follows terrain and props).
 *   - `zones`: one zone glyph per tile, `.` = no zone.
 *   - `props`: `[kind, x, y, variant, dx, dy]` with x/y in map tiles.
 * - `zones`: zone/tier metadata with spawn tables, keyed by local zone id.
 * - `anchors`: named points (spawn point, doors, NPC spots); `connections`: where other
 *   regions attach (map edges, sea routes, passes, ferries).
 */

import { defineRegistry, type CheckContext, type EntryOf, type EntryProblem } from '@engine/packs';
import { z } from 'zod';
import { BIOME_IDS } from '@game/world/biomes';
import { MOOD_IDS } from '@game/world/lighting';
import { PROP_KINDS } from '@game/world/props';
import { WEATHER_IDS } from '@game/world/weather';
import { name, ref, refTo } from './common';
import { MAX_LEVEL } from './species';

export const MAP_FORMAT = 1;
export const DEFAULT_CHUNK_TILES = 32;
export const MAX_MAP_TILES = 1024;

/** Corner bits in `corners` rows. */
export const CORNER_ALT = 1;
export const CORNER_PATH = 2;
export const CORNER_LIQUID = 4;

/** Tile bits in `tiles` rows. */
export const TILE_TALL = 1;
export const TILE_BLOCK = 2;
export const TILE_OPEN = 4;

export const NO_ZONE = '.';

/** Concentric tiers (DESIGN.md "World") and the wild levels each one allows. */
export const TIERS = ['t1', 't2', 't3', 'danger'] as const;
export type Tier = (typeof TIERS)[number];
export const TIER_LEVELS: Readonly<Record<Tier, readonly [number, number]>> = {
  t1: [3, 15],
  t2: [15, 30],
  t3: [30, 45],
  danger: [45, 60],
};

export const FACINGS = ['up', 'down', 'left', 'right'] as const;
export type Facing = (typeof FACINGS)[number];

export const CONNECTION_KINDS = ['edge', 'sea', 'pass', 'ferry'] as const;

const level = z.number().int().min(1).max(MAX_LEVEL);
const levels = z.tuple([level, level]);
const coord = z.number().int().min(0).max(MAX_MAP_TILES);

export const spawnSchema = z.strictObject({
  species: ref,
  /** Relative chance among the zone's spawns. */
  weight: z.number().int().positive().default(1),
  /** Narrower level range for this species; omitted = the zone's. */
  levels: levels.optional(),
});

export const zoneSchema = z.strictObject({
  name,
  /** Single character used in the chunks' `zones` rows. */
  glyph: z.string().regex(/^[a-z0-9]$/, 'Glyph must be one of a–z or 0–9'),
  tier: z.enum(TIERS),
  /** Fixed wild levels of the zone (inside the tier's range). */
  levels,
  spawns: z.array(spawnSchema).default([]),
  /** Light mood over the whole zone (C32), e.g. `canopy` under a deep wood. */
  mood: z.enum(MOOD_IDS).optional(),
  /** Cosmetic weather while the player is in the zone (C32). */
  weather: z.enum(WEATHER_IDS).optional(),
});

export const anchorSchema = z.strictObject({
  x: coord,
  y: coord,
  /** Free-form role: `spawn`, `center`, `shop`, `npc`, … */
  kind: z.string().min(1).max(24).default('point'),
  facing: z.enum(FACINGS).optional(),
  /** Light mood around the anchor (C32), full within `radius` tiles and fading after. */
  mood: z.enum(MOOD_IDS).optional(),
  radius: z.number().int().min(1).max(32).optional(),
});

export const connectionSchema = z.strictObject({
  x: coord,
  y: coord,
  kind: z.enum(CONNECTION_KINDS),
  /** Target as `pack:region#connection`; omitted = not attached yet. */
  to: z
    .string()
    .regex(/^[a-z0-9_-]+:[a-z0-9_-]+#[a-z0-9_-]+$/, 'Must look like "core:region#connection"')
    .optional(),
});

export const propRowSchema = z.tuple([
  z.enum(PROP_KINDS),
  coord,
  coord,
  z.number().int().min(0).max(7),
  z.number().int().min(-8).max(8),
  z.number().int().min(-8).max(8),
]);

export const chunkSchema = z.strictObject({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  corners: z.array(z.string().regex(/^[0-7]+$/)),
  tiles: z.array(z.string().regex(/^[0-7]+$/)),
  zones: z.array(z.string().regex(/^[a-z0-9.]+$/)),
  props: z.array(propRowSchema).default([]),
});

const key = z.string().regex(/^[a-z0-9_-]+$/, 'Keys use lowercase letters, digits, "_" or "-"');

export const regionMapSchema = z
  .strictObject({
    format: z.literal(MAP_FORMAT),
    name,
    biome: z.enum(BIOME_IDS),
    /** Seed of the generated base (also seeds the tile texture). */
    seed: z.number().int(),
    width: z.number().int().min(1).max(MAX_MAP_TILES),
    height: z.number().int().min(1).max(MAX_MAP_TILES),
    chunkSize: z.number().int().min(4).max(256).default(DEFAULT_CHUNK_TILES),
    zones: z.record(key, zoneSchema),
    anchors: z.record(key, anchorSchema).default({}),
    connections: z.record(key, connectionSchema).default({}),
    chunks: z.array(chunkSchema),
  })
  .superRefine((m, ctx) => {
    for (const p of checkLayout(m)) ctx.addIssue({ code: 'custom', ...p });
  });

export type RegionMapData = z.output<typeof regionMapSchema>;
export type RegionMapInput = z.input<typeof regionMapSchema>;
export type ZoneData = z.output<typeof zoneSchema>;
export type AnchorData = z.output<typeof anchorSchema>;
export type ConnectionData = z.output<typeof connectionSchema>;
export type ChunkData = z.output<typeof chunkSchema>;

/** Tile span of chunk `c` along an axis of `size` tiles. */
export function chunkSpan(c: number, size: number, chunk: number): readonly [number, number] {
  const start = c * chunk;
  return [start, Math.min(start + chunk, size) - start];
}

/** Shape rules a schema cannot express: chunk grid, row lengths, glyphs, positions. */
function checkLayout(m: RegionMapData): { path: PropertyKey[]; message: string }[] {
  const out: { path: PropertyKey[]; message: string }[] = [];
  const cw = Math.ceil(m.width / m.chunkSize);
  const ch = Math.ceil(m.height / m.chunkSize);
  const glyphs = new Map<string, string>();
  for (const [k, z] of Object.entries(m.zones)) {
    const other = glyphs.get(z.glyph);
    if (other)
      out.push({
        path: ['zones', k, 'glyph'],
        message: `Glyph "${z.glyph}" is also used by "${other}"`,
      });
    glyphs.set(z.glyph, k);
    const [lo, hi] = TIER_LEVELS[z.tier];
    if (z.levels[0] > z.levels[1])
      out.push({ path: ['zones', k, 'levels'], message: 'Min level is above max level' });
    if (z.levels[0] < lo || z.levels[1] > hi) {
      out.push({
        path: ['zones', k, 'levels'],
        message: `Tier ${z.tier} levels must stay within ${lo}–${hi}`,
      });
    }
    z.spawns.forEach((s, i) => {
      if (
        s.levels &&
        (s.levels[0] < z.levels[0] || s.levels[1] > z.levels[1] || s.levels[0] > s.levels[1])
      ) {
        out.push({
          path: ['zones', k, 'spawns', i, 'levels'],
          message: `Must stay within the zone's ${z.levels[0]}–${z.levels[1]}`,
        });
      }
    });
  }
  const inside = (x: number, y: number): boolean => x < m.width && y < m.height;
  for (const [k, a] of Object.entries(m.anchors)) {
    if (!inside(a.x, a.y))
      out.push({ path: ['anchors', k], message: `(${a.x}, ${a.y}) is outside the map` });
  }
  for (const [k, c] of Object.entries(m.connections)) {
    if (!inside(c.x, c.y))
      out.push({ path: ['connections', k], message: `(${c.x}, ${c.y}) is outside the map` });
  }
  const seen = new Set<string>();
  m.chunks.forEach((c, i) => {
    const at = (...p: PropertyKey[]): PropertyKey[] => ['chunks', i, ...p];
    if (c.x >= cw || c.y >= ch) {
      out.push({
        path: at(),
        message: `Chunk (${c.x}, ${c.y}) is outside the ${cw}×${ch} chunk grid`,
      });
      return;
    }
    const id = `${c.x},${c.y}`;
    if (seen.has(id)) out.push({ path: at(), message: `Chunk (${id}) appears twice` });
    seen.add(id);
    const [x0, w] = chunkSpan(c.x, m.width, m.chunkSize);
    const [y0, h] = chunkSpan(c.y, m.height, m.chunkSize);
    const rows = (field: 'corners' | 'tiles' | 'zones', rw: number, rh: number): void => {
      const r = c[field];
      if (r.length !== rh)
        out.push({ path: at(field), message: `Expected ${rh} rows, got ${r.length}` });
      r.forEach((row, j) => {
        if (row.length !== rw)
          out.push({ path: at(field, j), message: `Expected ${rw} characters, got ${row.length}` });
      });
    };
    const lastX = c.x === cw - 1 ? 1 : 0;
    const lastY = c.y === ch - 1 ? 1 : 0;
    rows('corners', w + lastX, h + lastY);
    rows('tiles', w, h);
    rows('zones', w, h);
    c.zones.forEach((row, j) => {
      for (const g of row) {
        if (g !== NO_ZONE && !glyphs.has(g)) {
          out.push({ path: at('zones', j), message: `Unknown zone glyph "${g}"` });
          break;
        }
      }
    });
    c.props.forEach((p, j) => {
      if (p[1] < x0 || p[1] >= x0 + w || p[2] < y0 || p[2] >= y0 + h) {
        out.push({
          path: at('props', j),
          message: `Prop at (${p[1]}, ${p[2]}) is outside its chunk`,
        });
      }
    });
  });
  if (out.length === 0 && seen.size !== cw * ch) {
    out.push({ path: ['chunks'], message: `Expected ${cw * ch} chunks, got ${seen.size}` });
  }
  return out;
}

export const maps = defineRegistry('maps', regionMapSchema, {
  refs: (m) =>
    Object.entries(m.zones).flatMap(([k, z]) =>
      z.spawns.map((s, i) => refTo('species', s.species, 'zones', k, 'spawns', i, 'species')),
    ),
  check: (m, ctx) => checkSpawns(m, ctx),
});

export type RegionMap = EntryOf<typeof maps>;

function checkSpawns(m: RegionMapData, ctx: CheckContext): EntryProblem[] {
  const out: EntryProblem[] = [];
  for (const [k, z] of Object.entries(m.zones)) {
    z.spawns.forEach((s, i) => {
      const sp = ctx.get('species', s.species) as { legendary: boolean } | undefined;
      if (sp?.legendary) {
        out.push({
          path: ['zones', k, 'spawns', i, 'species'],
          message: 'Legendaries do not spawn in the wild',
        });
      }
    });
  }
  return out;
}
