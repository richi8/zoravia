/** Traits: one optional passive per species (DESIGN.md "Creatures"). */

import { defineRegistry, type EntryOf } from '@engine/packs';
import { z } from 'zod';
import { description, multiplier, name, ref, refTo } from './common';

export const traitEffectSchema = z.discriminatedUnion('kind', [
  /** The condition can never be applied to this Zorling. */
  z.strictObject({ kind: z.literal('conditionImmunity'), condition: ref }),
  /** Own moves of `type` deal more (or less) damage. */
  z.strictObject({ kind: z.literal('typePower'), type: ref, multiplier }),
  /** Conditions this Zorling applies last `turns` longer. */
  z.strictObject({ kind: z.literal('conditionTurns'), turns: z.number().int().min(-5).max(5) }),
]);
export type TraitEffect = z.output<typeof traitEffectSchema>;

export const traitSchema = z.strictObject({
  name,
  description,
  effects: z.array(traitEffectSchema).min(1),
});

export const traits = defineRegistry('traits', traitSchema, {
  refs: (t) =>
    t.effects.flatMap((e, i) =>
      e.kind === 'conditionImmunity'
        ? [refTo('conditions', e.condition, 'effects', i, 'condition')]
        : e.kind === 'typePower'
          ? [refTo('types', e.type, 'effects', i, 'type')]
          : [],
    ),
});

export type Trait = EntryOf<typeof traits>;
export type TraitInput = z.input<typeof traitSchema>;
