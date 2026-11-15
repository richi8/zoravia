/**
 * `region.json`: what the generator needs to make a region's base map. It is read once,
 * when the base is generated (`npm run world -- gen`). Everything authored by hand after
 * that (spawn tables, anchors, terrain fixes) lives in `overlay.json`.
 */

import { z } from 'zod';
import { CONNECTION_KINDS, DEFAULT_CHUNK_TILES, MAX_MAP_TILES, TIERS } from '@game/data/maps';
import { name } from '@game/data/common';
import { BIOME_IDS } from '@game/world/biomes';

export const EXITS = ['north', 'east', 'south', 'west'] as const;
export type Exit = (typeof EXITS)[number];

const key = z.string().regex(/^[a-z0-9_-]+$/);

const pt = z.tuple([z.number(), z.number()]);
const line = z.array(pt).min(2);

/**
 * Authored layout (C28): instead of tier rings around one hub, the region's big shapes are
 * placed by hand and the generator only adds organic detail (noisy edges, props, grass).
 * Positions are in tiles.
 */
export const layoutSchema = z.strictObject({
  /** Towns: cleared ground with a path plaza, no zone. The first is the spawn town. */
  towns: z
    .record(
      key,
      z.strictObject({ name, at: pt, radius: z.number().positive(), plaza: z.number().default(3) }),
    )
    .refine((t) => Object.keys(t).length > 0, 'At least one town'),
  /** Paths as polylines (they wobble a little between points). */
  routes: z
    .array(
      z.strictObject({
        points: line,
        width: z.number().positive().default(2),
        wobble: z.number().min(0).default(3),
      }),
    )
    .default([]),
  /** Rivers as polylines; routes crossing them get bridges. */
  rivers: z
    .array(z.strictObject({ points: line, width: z.number().positive().default(3) }))
    .default([]),
  /** Lakes as noisy ellipses (`radius` = [rx, ry]). */
  lakes: z
    .array(z.strictObject({ at: pt, radius: pt, wobble: z.number().min(0).default(0.2) }))
    .default([]),
  /** Dry land inside lakes. */
  islands: z.array(z.strictObject({ at: pt, radius: pt })).default([]),
  /** Small random ponds: lake-noise threshold (0 = none). */
  ponds: z.number().min(0).max(1).default(0.26),
  /**
   * Cleared spots for landmarks (lairs, shrines, secrets). Each becomes an anchor (`id`,
   * `kind`). `ring` walls it with trees, open only toward `gap`.
   */
  clearings: z
    .array(
      z.strictObject({
        id: key,
        kind: z.string().min(1).max(24),
        at: pt,
        radius: z.number().positive(),
        ring: z.boolean().default(false),
        gap: z.enum(EXITS).optional(),
      }),
    )
    .default([]),
  /** Stepping-stone crossings over water (walkable lily pads), e.g. to a secret island. */
  fords: z.array(z.strictObject({ points: line })).default([]),
  /**
   * Zone shapes: each tile outside towns joins the zone with the nearest seed (warped by
   * noise). `trees` / `grass` / `wet` shift how dense trees, tall grass and ponds are.
   */
  zones: z.record(
    key,
    z.strictObject({
      seeds: z.array(pt).min(1),
      trees: z.number().min(-1).max(1).default(0),
      grass: z.number().min(-1).max(1).default(0),
      /** More small ponds (+) or fewer (−). */
      wet: z.number().min(-1).max(1).default(0),
    }),
  ),
  /** Connection points on the map edge; routes should end at them. */
  exits: z.record(key, z.strictObject({ at: pt, kind: z.enum(CONNECTION_KINDS).default('edge') })),
});

export type Layout = z.output<typeof layoutSchema>;

/**
 * A strip added to one side of a region after it shipped (C36). It is generated on its own
 * (`world extend`, frozen in `generated-<id>.json`) from a layout in strip coordinates, then
 * glued on at build time: the region's existing tiles stay as they are. Its exits on the
 * glued side are joins: the region's border is opened there instead of making connections.
 */
export const extensionSchema = z.strictObject({
  side: z.enum(EXITS),
  /** Depth of the strip in tiles; its length is the region's side. */
  size: z.number().int().min(8).max(MAX_MAP_TILES),
  seed: z.number().int(),
  zones: z
    .record(key, z.strictObject({ name, tier: z.enum(TIERS) }))
    .refine((zs) => Object.keys(zs).length > 0, 'At least one zone'),
  layout: layoutSchema,
});

export type Extension = z.output<typeof extensionSchema>;

export const regionConfigSchema = z.strictObject({
  name,
  biome: z.enum(BIOME_IDS),
  seed: z.number().int(),
  width: z.number().int().min(32).max(MAX_MAP_TILES),
  height: z.number().int().min(32).max(MAX_MAP_TILES),
  chunkSize: z.number().int().min(4).max(256).default(DEFAULT_CHUNK_TILES),
  /**
   * Zones in the order the generator lays them out: tiers form rings around the hub town
   * (first tier innermost); zones sharing a tier split its ring into sectors.
   */
  zones: z
    .record(key, z.strictObject({ name, tier: z.enum(TIERS) }))
    .refine((zs) => Object.keys(zs).length > 0, 'At least one zone'),
  /** Map edges a path from the hub leads to; each gets a connection point. */
  exits: z.array(z.enum(EXITS)).min(1).default(['north', 'east', 'south', 'west']),
  /** Authored layout (C28); when set, `exits` is ignored and zones follow `layout.zones`. */
  layout: layoutSchema.optional(),
  /** Strips added later, glued on in this order (C36). */
  extensions: z.record(key, extensionSchema).default({}),
});

export type RegionConfig = z.output<typeof regionConfigSchema>;
export type RegionConfigInput = z.input<typeof regionConfigSchema>;
