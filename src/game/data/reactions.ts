/**
 * Reactions: a move of `type` hitting a target that has `condition` (e.g. Water on Burning →
 * Steam Burst). The reaction consumes the condition, changes the hit's damage, and can leave a
 * lingering effect on the target.
 */

import { defineRegistry, type EntryOf } from '@engine/packs';
import { z } from 'zod';
import { description, multiplier, name, ref, refTo, statusEffectSchema } from './common';

export const reactionSchema = z.strictObject({
  name,
  description,
  condition: ref,
  /** Type of the move that triggers it. */
  type: ref,
  damageMultiplier: multiplier.default(1),
  /** The hit ignores the target's defense. */
  ignoreDefense: z.boolean().default(false),
  /** Effects left on the target for a few turns after the reaction. */
  lingering: z
    .strictObject({
      turns: z.number().int().min(1).max(10),
      effects: z.array(statusEffectSchema).min(1),
    })
    .optional(),
});

interface ReactionKey {
  readonly id: string;
  readonly condition: string;
  readonly type: string;
}

export const reactions = defineRegistry('reactions', reactionSchema, {
  refs: (r) => [refTo('conditions', r.condition, 'condition'), refTo('types', r.type, 'type')],
  check: (r, ctx) => {
    const clash = (ctx.values('reactions') as ReactionKey[]).find(
      (o) => o.id !== r.id && o.condition === r.condition && o.type === r.type,
    );
    return clash
      ? [{ path: ['type'], message: `"${clash.id}" already reacts to the same type and condition` }]
      : [];
  },
});

export type Reaction = EntryOf<typeof reactions>;
export type ReactionInput = z.input<typeof reactionSchema>;
