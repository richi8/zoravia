/**
 * Region 1, Verdale (C28): the people who run its services (healers by each Zorling center
 * door, clerks by the shop doors). The townsfolk, the trial and the rest of the story live in
 * `verdale-story.ts` (C30); route trainers and the boss lairs in `verdale-trainers.ts` (C29).
 */

import type { NpcInput } from '@game/data';

const MAP = 'core:verdale';

export const verdaleNpcs: Record<string, NpcInput> = {
  // Willowmere (hub). The first center listed is where a new player wakes after losing.
  'willowmere-healer': {
    name: 'Healer Lin',
    map: MAP,
    anchor: 'center',
    look: { outfit: 'white', hair: 'red', skin: 'light' },
    lines: ['Welcome to the Willowmere Zorling center! How can I help?'],
    role: { kind: 'center' },
  },
  'willowmere-clerk': {
    name: 'Clerk Ada',
    map: MAP,
    anchor: 'shop',
    look: { outfit: 'mustard', hair: 'blonde', skin: 'warm' },
    lines: ['Potions and Zorbs for the road!'],
    role: { kind: 'shop', title: 'Willowmere Shop', stock: ['core:potion', 'core:zorb'] },
  },
  // Fernhollow.
  'fernhollow-healer': {
    name: 'Healer Iva',
    map: MAP,
    anchor: 'center-fernhollow',
    look: { outfit: 'white', hair: 'dark', skin: 'tan' },
    lines: ['Welcome to the Fernhollow Zorling center!'],
    role: { kind: 'center' },
  },
  'fernhollow-clerk': {
    name: 'Clerk Bo',
    map: MAP,
    anchor: 'shop-fernhollow',
    look: { outfit: 'navy', hair: 'brown', skin: 'light' },
    lines: ['Stronger potions for the deep woods.'],
    role: {
      kind: 'shop',
      title: 'Fernhollow Shop',
      stock: ['core:potion', 'core:super-potion', 'core:zorb'],
    },
  },
  // Galecrest outpost.
  'galecrest-healer': {
    name: 'Healer Sol',
    map: MAP,
    anchor: 'center-galecrest',
    look: { outfit: 'white', hair: 'blonde', skin: 'deep' },
    lines: ['Rest here before the ridge. The wind up there is fierce.'],
    role: { kind: 'center' },
  },
};
