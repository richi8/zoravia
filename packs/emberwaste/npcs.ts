/**
 * Emberwaste (C34): the people who run its services (healers by each Zorling center door,
 * clerks by the shop doors). Townsfolk, the trial and the story are in `story.ts`; route
 * trainers and the boss lairs in `trainers.ts`.
 */

import type { NpcInput } from '@game/data';

const MAP = 'emberwaste:emberwaste';

export const serviceNpcs: Record<string, NpcInput> = {
  // Cinderwell (hub). The first center listed is where a new player wakes after losing.
  'cinderwell-healer': {
    name: 'Healer Amara',
    map: MAP,
    anchor: 'center',
    look: { outfit: 'white', hair: 'dark', skin: 'deep' },
    lines: ['Welcome to the Cinderwell Zorling center! Rest out of the sun a while.'],
    role: { kind: 'center' },
  },
  'cinderwell-clerk': {
    name: 'Clerk Tibo',
    map: MAP,
    anchor: 'shop',
    look: { outfit: 'mustard', hair: 'brown', skin: 'tan' },
    lines: ['Potions and Zorbs! Water costs extra. Just kidding.'],
    role: { kind: 'shop', title: 'Cinderwell Shop', stock: ['core:potion', 'core:zorb'] },
  },
  // Kilnreach.
  'kilnreach-healer': {
    name: 'Healer Senna',
    map: MAP,
    anchor: 'center-kilnreach',
    look: { outfit: 'white', hair: 'red', skin: 'warm' },
    lines: ['Welcome to the Kilnreach Zorling center!'],
    role: { kind: 'center' },
  },
  'kilnreach-clerk': {
    name: 'Clerk Hollis',
    map: MAP,
    anchor: 'shop-kilnreach',
    look: { outfit: 'navy', hair: 'grey', skin: 'light' },
    lines: ['Stronger potions for the slopes. The ash eats through the weak ones.'],
    role: {
      kind: 'shop',
      title: 'Kilnreach Shop',
      stock: ['core:potion', 'core:super-potion', 'core:max-potion', 'core:zorb'],
    },
  },
  // Slagwatch outpost.
  'slagwatch-healer': {
    name: 'Healer Doran',
    map: MAP,
    anchor: 'center-slagwatch',
    look: { outfit: 'white', hair: 'blonde', skin: 'tan' },
    lines: ['Last center before the ridge. Mind the vents up there.'],
    role: { kind: 'center' },
  },
};
