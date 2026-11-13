/**
 * The save file format (C23). A save is plain, JSON-safe data with a `version`; older
 * versions are upgraded step by step in `migrate.ts` before this schema checks them.
 *
 * Version history:
 * - v1: the first format: party (team, storage, bag, money, optional Dex) and the player's
 *   map, tile and facing, all at the top level.
 * - v2: `place` and `respawn` (the last center used) as map + tile + facing, the boss log
 *   (one per save), play time, and the packs the save was made with.
 * - v3 (C26): story flags and quest progress in the party.
 * - v4 (current, C27): badges held, trainers beaten, and rematches won in the boss log.
 */

import { z } from 'zod';
import { FACINGS, ref } from '@game/data';
import { TEAM_SIZE } from '@game/player';
import { zorlingSchema } from '@game/progression';

export const SAVE_FORMAT = 'zoravia-save';
export const SAVE_VERSION = 4;

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
  bosses: z.record(
    ref,
    z.strictObject({
      result: z.enum(['defeated', 'caught']),
      rematches: z.number().int().min(1).optional(),
    }),
  ),
  flags: z.record(ref, z.number().int()),
  quests: z.record(
    ref,
    z.discriminatedUnion('state', [
      z.strictObject({ state: z.literal('active'), step: z.string().min(1) }),
      z.strictObject({ state: z.literal('done') }),
    ]),
  ),
  badges: z.array(ref),
  trainers: z.record(ref, z.strictObject({ wins: z.number().int().min(1) })),
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
