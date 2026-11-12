/** Potions (tiered, bag cap 5 each) and the capture item. Prices are tuned in C31. */

import { POTION_BAG_CAP, type ItemInput } from '@game/data';

export const items = {
  potion: {
    name: 'Potion',
    description: 'Restores 30 HP.',
    category: 'potion',
    price: 100,
    bagCap: POTION_BAG_CAP,
    effect: { kind: 'heal', amount: 30 },
  },
  'super-potion': {
    name: 'Super Potion',
    description: 'Restores 80 HP.',
    category: 'potion',
    price: 300,
    bagCap: POTION_BAG_CAP,
    effect: { kind: 'heal', amount: 80 },
  },
  'max-potion': {
    name: 'Max Potion',
    description: 'Restores all HP.',
    category: 'potion',
    price: 900,
    bagCap: POTION_BAG_CAP,
    effect: { kind: 'heal', amount: 'full' },
  },
  zorb: {
    name: 'Zorb',
    description: 'Catches a weakened wild Zorling. Always works on a Subdued one.',
    category: 'capture',
    price: 60,
    effect: { kind: 'capture' },
  },
} satisfies Record<string, ItemInput>;
