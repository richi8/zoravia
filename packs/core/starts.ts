/**
 * Start regions of the core pack (C33). Verdale is the gentlest start: one Lv 6 starter,
 * 2 Potions, 5 Zorbs and 500 coins (the C31 balance simulator plays from the same start,
 * `tools/balance/verdale.ts`). Choosing a starter sets its flag; Rival Mira reads it.
 */

import type { StartInput } from '@game/data';

export const STARTER_FLAGS = {
  sprigling: 'core:starter-sprigling',
  drizzlet: 'core:starter-drizzlet',
  emberkit: 'core:starter-emberkit',
} as const;

export const starts = {
  verdale: {
    name: 'Verdale',
    description:
      'Temperate forest and lakes. Nature, Water and Wind Zorlings. The gentlest start: the Seedwind has not come this spring.',
    map: 'core:verdale',
    anchor: 'spawn',
    starters: [
      {
        species: 'core:sprigling',
        flag: STARTER_FLAGS.sprigling,
        blurb: 'Nature. Sturdy and patient. Strong against Water.',
      },
      {
        species: 'core:drizzlet',
        flag: STARTER_FLAGS.drizzlet,
        blurb: 'Water. Quick and steady. Strong against Fire.',
      },
      {
        species: 'core:emberkit',
        flag: STARTER_FLAGS.emberkit,
        blurb: 'Fire. Hits hard, breaks easily. Strong against Nature.',
      },
    ],
    level: 6,
    bag: { 'core:potion': 2, 'core:zorb': 5 },
    money: 500,
  },
} satisfies Record<string, StartInput>;
