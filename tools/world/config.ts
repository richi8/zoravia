/**
 * `region.json`: what the generator needs to make a region's base map. It is read once,
 * when the base is generated (`npm run world -- gen`). Everything authored by hand after
 * that (spawn tables, anchors, terrain fixes) lives in `overlay.json`.
 */

import { z } from 'zod';
import { DEFAULT_CHUNK_TILES, MAX_MAP_TILES, TIERS } from '@game/data/maps';
import { name } from '@game/data/common';
import { BIOME_IDS } from '@game/world/biomes';

export const EXITS = ['north', 'east', 'south', 'west'] as const;
export type Exit = (typeof EXITS)[number];

const key = z.string().regex(/^[a-z0-9_-]+$/);

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
});

export type RegionConfig = z.output<typeof regionConfigSchema>;
export type RegionConfigInput = z.input<typeof regionConfigSchema>;
