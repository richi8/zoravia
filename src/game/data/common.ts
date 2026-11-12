/** Shared schema pieces for game content. */

import { namespacedIdSchema, type EntryRef } from '@engine/packs';
import { z } from 'zod';

/** A reference to another entry, written as a full id (`"core:fire"`). */
export const ref = namespacedIdSchema;

export const name = z.string().min(1).max(24);
export const description = z.string().max(160).default('');

/** A fraction of max HP (e.g. 1/16), 0–1. */
export const fraction = z.number().min(0).max(1);

/** A multiplier on a stat or on damage. */
export const multiplier = z.number().positive().max(10);

/** Battle stats species and instances have (see DESIGN.md "Creatures"). */
export const STAT_IDS = ['hp', 'attack', 'defense', 'speed'] as const;
export type StatId = (typeof STAT_IDS)[number];

/** Values conditions and reactions can raise or lower for a few turns. */
export const MODIFIABLE_STATS = ['attack', 'defense', 'speed', 'accuracy', 'evasion'] as const;
export type ModifiableStat = (typeof MODIFIABLE_STATS)[number];

/**
 * Effects that last while a condition or a reaction's lingering effect is active.
 * The battle engine (C14/C15) gives them meaning; packs only combine them.
 */
export const statusEffectSchema = z.discriminatedUnion('kind', [
  /** Loses `fraction` of max HP at the end of each turn, `growth` more each turn after. */
  z.strictObject({
    kind: z.literal('hpLoss'),
    fraction,
    growth: fraction.default(0),
    /** The HP lost heals whoever applied it (a drain). */
    toSource: z.boolean().default(false),
  }),
  /** Multiplies one stat (e.g. speed ×0.85). Evasion < 1 means easier to hit. */
  z.strictObject({ kind: z.literal('stat'), stat: z.enum(MODIFIABLE_STATS), multiplier }),
  /** Chance to fail a chosen move. */
  z.strictObject({ kind: z.literal('fumble'), chance: fraction }),
  /** Cannot switch out. */
  z.strictObject({ kind: z.literal('trapped') }),
  /** Loses its next turn. */
  z.strictObject({ kind: z.literal('skipTurn') }),
]);
export type StatusEffect = z.output<typeof statusEffectSchema>;

/** Builds an `EntryRef` for registry `refs` callbacks. */
export function refTo(kind: string, id: string, ...path: PropertyKey[]): EntryRef {
  return { kind, id, path };
}

/** Finds values that appear more than once. */
export function duplicates<T>(values: readonly T[]): T[] {
  const seen = new Set<T>();
  const dup = new Set<T>();
  for (const v of values) (seen.has(v) ? dup : seen).add(v);
  return [...dup];
}
