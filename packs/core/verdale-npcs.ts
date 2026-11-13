/**
 * Region 1, Verdale (C28): the people who run its services (healers by each Zorling center
 * door, clerks by the shop doors) and a few townsfolk who point the way. Story NPCs, the
 * trial, Titans and the legendary move here in C29–C30.
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
  'willowmere-elder': {
    name: 'Elder Rowan',
    map: MAP,
    anchor: 'elder',
    look: { outfit: 'maroon', hair: 'grey', skin: 'tan' },
    behavior: { kind: 'look', every: [2.5, 5] },
    lines: [
      'Welcome to Willowmere, the heart of Verdale.',
      'The meadow to the south is gentle. Fernhollow lies up the north road, past Brookside.',
    ],
  },
  'willowmere-kid': {
    name: 'Tam',
    map: MAP,
    x: 101,
    y: 122,
    look: { outfit: 'sky', hair: 'brown', skin: 'warm' },
    behavior: { kind: 'wander', radius: 3 },
    lines: ['The Silverrun is full of Puddlits!', 'Cross the bridge east to reach Galecrest.'],
  },
  'willowmere-gardener': {
    name: 'Gardener Mo',
    map: MAP,
    x: 108,
    y: 110,
    facing: 'left',
    look: { outfit: 'forest', hair: 'dark', skin: 'deep' },
    behavior: { kind: 'look' },
    lines: ['Lake Willow is west of town. Zorlings love the reeds there.'],
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
  'fernhollow-scout': {
    name: 'Scout Pell',
    map: MAP,
    anchor: 'trial',
    look: { outfit: 'forest', hair: 'blonde', skin: 'warm' },
    behavior: { kind: 'look' },
    lines: [
      'This is the Grove Trial hall. The keeper is away for now.',
      'West of here is Deepwood. Something huge sleeps in a hollow oak there.',
    ],
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
  'galecrest-ranger': {
    name: 'Ranger Kit',
    map: MAP,
    anchor: 'ranger',
    look: { outfit: 'orange', hair: 'red', skin: 'light' },
    behavior: { kind: 'look' },
    lines: [
      'The road east climbs to Ember Pass. The lands beyond are closed for now.',
      'North is Galeback Ridge. Only strong teams should go up to Crown Rock.',
    ],
  },
  ferryman: {
    name: 'Ferryman Gus',
    map: MAP,
    anchor: 'ferryman',
    look: { outfit: 'navy', hair: 'grey', skin: 'warm' },
    lines: ['The ferry to the frozen coast is not running yet. Come back later!'],
  },
};
