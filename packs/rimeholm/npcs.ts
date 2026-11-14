/**
 * Rimeholm (C35): the people who run its services (healers by each Zorling center door,
 * clerks by the shop doors) and the Brinewick ferryman. Townsfolk, the trial and the story are
 * in `story.ts`; route trainers and the boss lairs in `trainers.ts`.
 */

import type { NpcInput } from '@game/data';

const MAP = 'rimeholm:rimeholm';

export const serviceNpcs: Record<string, NpcInput> = {
  // Brinewick (hub). The first center listed is where a new player wakes after losing.
  'brinewick-healer': {
    name: 'Healer Ingrid',
    map: MAP,
    anchor: 'center',
    look: { outfit: 'white', hair: 'blonde', skin: 'light' },
    lines: ['Welcome to the Brinewick Zorling center! Warm up by the stove a while.'],
    role: { kind: 'center' },
  },
  'brinewick-clerk': {
    name: 'Clerk Tor',
    map: MAP,
    anchor: 'shop',
    look: { outfit: 'navy', hair: 'red', skin: 'light' },
    lines: ['Potions and Zorbs! Mittens are extra. Just kidding, we are out of mittens.'],
    role: { kind: 'shop', title: 'Brinewick Shop', stock: ['core:potion', 'core:zorb'] },
  },
  // Glimmerholm.
  'glimmerholm-healer': {
    name: 'Healer Maren',
    map: MAP,
    anchor: 'center-glimmerholm',
    look: { outfit: 'white', hair: 'dark', skin: 'tan' },
    lines: ['Welcome to the Glimmerholm Zorling center!'],
    role: { kind: 'center' },
  },
  'glimmerholm-clerk': {
    name: 'Clerk Edvin',
    map: MAP,
    anchor: 'shop-glimmerholm',
    look: { outfit: 'forest', hair: 'grey', skin: 'warm' },
    lines: ['Stronger potions for the outer isles. The sleet is no joke out there.'],
    role: {
      kind: 'shop',
      title: 'Glimmerholm Shop',
      stock: ['core:potion', 'core:super-potion', 'core:max-potion', 'core:zorb'],
    },
  },
  // Rimeport.
  'rimeport-healer': {
    name: 'Healer Solveig',
    map: MAP,
    anchor: 'center-rimeport',
    look: { outfit: 'white', hair: 'red', skin: 'deep' },
    lines: ['Last center before the Stormspire. Rest up, the shoals are rough.'],
    role: { kind: 'center' },
  },
  // The Brinewick pier: the ferry to Verdale leaves from its far end.
  'ferryman-ola': {
    name: 'Ferryman Ola',
    map: MAP,
    anchor: 'ferryman',
    look: { outfit: 'sky', hair: 'grey', skin: 'warm' },
    lines: [
      'The ferry to Verdale leaves from the end of the pier. Walk on board whenever you like.',
      'Gus runs the Willowmere side. Tell him Ola says his knots are still crooked.',
    ],
  },
};
