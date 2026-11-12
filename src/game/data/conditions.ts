/**
 * Conditions (Burning, Wet, …): applied by moves, last a few turns, and set up reactions
 * (see DESIGN.md "Conditions & reactions").
 */

import { defineRegistry, type EntryOf } from '@engine/packs';
import { z } from 'zod';
import { description, name, statusEffectSchema } from './common';

export const CONDITION_TURNS = 3;

export const conditionSchema = z.strictObject({
  name,
  description,
  /** Turns it lasts once applied. */
  turns: z.number().int().min(1).max(10).default(CONDITION_TURNS),
  /** Side effects while active. */
  effects: z.array(statusEffectSchema).default([]),
});

export const conditions = defineRegistry('conditions', conditionSchema);

export type Condition = EntryOf<typeof conditions>;
export type ConditionInput = z.input<typeof conditionSchema>;
