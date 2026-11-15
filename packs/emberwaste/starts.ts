/**
 * Emberwaste's start (C34): the same new-game kit as Verdale (one Lv 6 starter, 2 Potions,
 * 5 Zorbs, 500 coins) in Cinderwell. Choosing a starter sets its flag; Rival Mira reads it.
 */

import type { StartInput } from '@game/data';

export const STARTER_FLAGS = {
  sizzlet: 'emberwaste:starter-sizzlet',
  pebbit: 'emberwaste:starter-pebbit',
  pricklet: 'emberwaste:starter-pricklet',
} as const;

export const starts = {
  emberwaste: {
    name: 'Emberwaste',
    description:
      'Volcanic desert. Fire, Earth and Metal Zorlings, and ash storms that set every battle Burning. The forges of Kilnreach have gone cold.',
    map: 'emberwaste:emberwaste',
    anchor: 'spawn',
    starters: [
      {
        species: 'emberwaste:sizzlet',
        flag: STARTER_FLAGS.sizzlet,
        blurb: 'Fire. Quick and fierce. Strong against Nature.',
      },
      {
        species: 'emberwaste:pebbit',
        flag: STARTER_FLAGS.pebbit,
        blurb: 'Earth. Slow and tough. Strong against Fire.',
      },
      {
        species: 'emberwaste:pricklet',
        flag: STARTER_FLAGS.pricklet,
        blurb: 'Nature. Patient, and it carries water. Strong against Earth.',
      },
    ],
    level: 6,
    bag: { 'core:potion': 2, 'core:zorb': 5 },
    money: 500,
    // East of Verdale (C36c): Ember Pass (0, 104) meets Verdale's (199, 184).
    world: { x: 200, y: 80 },
  },
} satisfies Record<string, StartInput>;
