/**
 * Model kits (C35a): which body plans and parts a region's Zorlings are drawn from. A species
 * names its kit in `look.kit`; its plans must come from the kit, and the kit's part weights
 * are added to each plan's own when the look is rolled. The drawing code stays in the engine
 * side of the game (`@game/zorlings`); packs only choose from it.
 */

import { defineRegistry, type EntryOf, type EntryProblem } from '@engine/packs';
import { BODY_PLANS, PART_KINDS, type PartSlot } from '@game/zorlings/genome';
import { z } from 'zod';
import { description, duplicates, name } from './common';

const weight = z.number().min(0).max(20);
const slotWeights = <S extends PartSlot>(slot: S) =>
  z.partialRecord(z.enum(PART_KINDS[slot] as unknown as [string, ...string[]]), weight);

export const modelKitSchema = z.strictObject({
  name,
  description,
  /** Body plans the kit's species may use (final forms and young stages). */
  plans: z.array(z.enum(BODY_PLANS)).min(1),
  /**
   * Part weights added to each plan's own; 0 removes a kind. Slots a plan fixes to one kind
   * (beaks, stingers) ignore them.
   */
  parts: z
    .strictObject({
      ears: slotWeights('ears').optional(),
      horns: slotWeights('horns').optional(),
      tail: slotWeights('tail').optional(),
      back: slotWeights('back').optional(),
      wings: slotWeights('wings').optional(),
      markings: slotWeights('markings').optional(),
      eyes: slotWeights('eyes').optional(),
      mouth: slotWeights('mouth').optional(),
      snout: slotWeights('snout').optional(),
    })
    .default({}),
});

export type ModelKit = EntryOf<typeof modelKits>;
export type ModelKitInput = z.input<typeof modelKitSchema>;

export const modelKits = defineRegistry('modelKits', modelKitSchema, {
  check: (k) => {
    const out: EntryProblem[] = [];
    for (const p of duplicates(k.plans)) out.push({ path: ['plans'], message: `"${p}" twice` });
    return out;
  },
});
