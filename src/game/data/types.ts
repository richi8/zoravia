/**
 * Types (Fire, Water, …) and the effectiveness chart (see DESIGN.md "Types").
 *
 * Each type lists who it beats and what it resists. A move's multiplier against a defender is
 * the product over the defender's types of ×1.5 (move type beats it) and ×0.67 (it resists the
 * move type). The core pack writes every resist out, so a type's entry fully describes it.
 */

import { defineRegistry, type EntryOf } from '@engine/packs';
import { z } from 'zod';
import { duplicates, name, ref, refTo } from './common';

export const STRONG_MULTIPLIER = 1.5;
export const WEAK_MULTIPLIER = 0.67;

export const typeSchema = z.strictObject({
  name,
  /** Moves of this type deal ×1.5 to these types. */
  strongAgainst: z.array(ref).default([]),
  /** Moves of these types deal ×0.67 to this type. */
  resists: z.array(ref).default([]),
  /** The condition this type's moves apply (see `moves.applyChance`). */
  applies: ref,
});

export const types = defineRegistry('types', typeSchema, {
  refs: (t) => [
    ...t.strongAgainst.map((id, i) => refTo('types', id, 'strongAgainst', i)),
    ...t.resists.map((id, i) => refTo('types', id, 'resists', i)),
    refTo('conditions', t.applies, 'applies'),
  ],
  check: (t) => [
    ...duplicates(t.strongAgainst).map((id) => ({
      path: ['strongAgainst'],
      message: `"${id}" is listed twice`,
    })),
    ...duplicates(t.resists).map((id) => ({
      path: ['resists'],
      message: `"${id}" is listed twice`,
    })),
  ],
});

export type ZorlingType = EntryOf<typeof types>;
export type TypeInput = z.input<typeof typeSchema>;
