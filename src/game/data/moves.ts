/** Moves. Every move has one type; it may apply that type's condition (DESIGN.md). */

import { defineRegistry, type EntryOf } from '@engine/packs';
import { z } from 'zod';
import { description, fraction, name, ref, refTo } from './common';

export const moveSchema = z
  .strictObject({
    name,
    description,
    type: ref,
    /** 0 = a status move that only applies its condition. */
    power: z.number().int().min(0).max(250),
    /** Hit chance in percent. */
    accuracy: z.number().int().min(1).max(100),
    /** Chance (0–1) to apply the move type's condition on hit. */
    applyChance: fraction.default(0),
  })
  .refine((m) => m.power > 0 || m.applyChance > 0, {
    message: 'A move with 0 power must apply its condition (applyChance > 0)',
    path: ['applyChance'],
  });

export const moves = defineRegistry('moves', moveSchema, {
  refs: (m) => [refTo('types', m.type, 'type')],
});

export type Move = EntryOf<typeof moves>;
export type MoveInput = z.input<typeof moveSchema>;
