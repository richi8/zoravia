/** Items: potions (shop-only, bag cap 5 per type) and capture items (DESIGN.md "Economy"). */

import { defineRegistry, type EntryOf } from '@engine/packs';
import { z } from 'zod';
import { description, name } from './common';

export const POTION_BAG_CAP = 5;

export const itemEffectSchema = z.discriminatedUnion('kind', [
  /** Restores `amount` HP, or all HP when `amount` is `"full"`. */
  z.strictObject({
    kind: z.literal('heal'),
    amount: z.union([z.number().int().positive(), z.literal('full')]),
  }),
  /** Throws a capture item at a wild (or Subdued) Zorling. */
  z.strictObject({ kind: z.literal('capture'), strength: z.number().positive().default(1) }),
]);
export type ItemEffect = z.output<typeof itemEffectSchema>;

export const ITEM_CATEGORIES = ['potion', 'capture'] as const;

export const itemSchema = z.strictObject({
  name,
  description,
  category: z.enum(ITEM_CATEGORIES),
  /** Shop price in money. 0 = not sold. */
  price: z.number().int().min(0),
  /** Most the bag holds of this item; omitted = no limit. */
  bagCap: z.number().int().positive().optional(),
  effect: itemEffectSchema,
});

export const items = defineRegistry('items', itemSchema);

export type Item = EntryOf<typeof items>;
export type ItemInput = z.input<typeof itemSchema>;
