/**
 * The save file format (C23). A save is plain, JSON-safe data with a `version`; older
 * versions are upgraded step by step in `migrate.ts` before this schema checks them.
 *
 * Version history:
 * - v1: the first format: party (team, storage, bag, money, optional Dex) and the player's
 *   map, tile and facing, all at the top level.
 * - v2 (current): `place` and `respawn` (the last center used) as map + tile + facing,
 *   the boss log (one per save), play time, and the packs the save was made with.
 */

import { z } from 'zod';
import { FACINGS, ref } from '@game/data';
import { TEAM_SIZE } from '@game/player';
import { zorlingSchema } from '@game/progression';

export const SAVE_FORMAT = 'zoravia-save';
export const SAVE_VERSION = 2;

const count = z.number().int().min(0);

export const placeSchema = z.strictObject({
  map: ref,
  x: count,
  y: count,
  facing: z.enum(FACINGS),
});

export const partySchema = z.strictObject({
  team: z.array(zorlingSchema).min(1).max(TEAM_SIZE),
  storage: z.array(zorlingSchema),
  bag: z.record(ref, z.number().int().min(1)),
  money: count,
  dex: z.strictObject({ seen: z.array(ref), caught: z.array(ref) }),
  bosses: z.record(ref, z.strictObject({ result: z.enum(['defeated', 'caught']) })),
});

export const saveSchema = z.strictObject({
  format: z.literal(SAVE_FORMAT),
  version: z.literal(SAVE_VERSION),
  /** ISO time of the write. */
  savedAt: z.string(),
  /** Pack id → version the save was written with (for messages, not checked). */
  packs: z.record(z.string(), z.string()),
  /** Seconds played. */
  playtime: z.number().min(0),
  place: placeSchema,
  respawn: placeSchema.optional(),
  party: partySchema,
});

export type SaveData = z.output<typeof saveSchema>;
