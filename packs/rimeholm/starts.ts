/**
 * Rimeholm's start (C35): the same new-game kit as the other regions (one Lv 6 starter,
 * 2 Potions, 5 Zorbs, 500 coins) in Brinewick. Choosing a starter sets its flag; Rival Mira
 * reads it.
 */

import type { StartInput } from '@game/data';

export const STARTER_FLAGS = {
  selkit: 'rimeholm:starter-selkit',
  woolump: 'rimeholm:starter-woolump',
  sparkit: 'rimeholm:starter-sparkit',
} as const;

export const starts = {
  rimeholm: {
    name: 'Rimeholm Isles',
    description:
      'Frozen islands joined by piers. Ice, Water and Electric Zorlings, and sleet storms that soak every battle. The winter lights have gone dark.',
    map: 'rimeholm:rimeholm',
    anchor: 'spawn',
    starters: [
      {
        species: 'rimeholm:selkit',
        flag: STARTER_FLAGS.selkit,
        blurb: 'Water. Playful and steady. Strong against Earth.',
      },
      {
        species: 'rimeholm:woolump',
        flag: STARTER_FLAGS.woolump,
        blurb: 'Earth. Slow and woolly. Strong against Electric.',
      },
      {
        species: 'rimeholm:sparkit',
        flag: STARTER_FLAGS.sparkit,
        blurb: 'Electric. Quick and bright. Strong against Water.',
      },
    ],
    level: 6,
    bag: { 'core:potion': 2, 'core:zorb': 5 },
    money: 500,
  },
} satisfies Record<string, StartInput>;
