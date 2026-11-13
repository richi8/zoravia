/**
 * Test NPCs for the C21 test region (C22: a center attendant and a shop). Region 1's real
 * townsfolk come with C28–C30.
 */

import type { NpcInput } from '@game/data';

export const npcs: Record<string, NpcInput> = {
  'test-elder': {
    name: 'Elder Rowan',
    map: 'core:test-region',
    anchor: 'elder',
    look: { outfit: 'maroon', hair: 'grey', skin: 'tan' },
    behavior: { kind: 'look', every: [2.5, 5] },
    lines: [
      'Welcome to the test region, young one.',
      'Wild Zorlings roam outside town. The farther you walk, the stronger they get.',
    ],
  },
  'test-shopkeeper': {
    name: 'Shopkeeper Ida',
    map: 'core:test-region',
    anchor: 'shop',
    look: { outfit: 'mustard', hair: 'blonde', skin: 'light' },
    lines: ['Welcome! Potions and Zorbs, fresh today.'],
    role: {
      kind: 'shop',
      title: "Ida's Shop",
      stock: ['core:potion', 'core:super-potion', 'core:max-potion', 'core:zorb'],
    },
  },
  'test-healer': {
    name: 'Healer Wren',
    map: 'core:test-region',
    anchor: 'center',
    look: { outfit: 'white', hair: 'red', skin: 'light' },
    lines: ['Welcome to the Zorling center! How can I help?'],
    role: { kind: 'center' },
  },
  'test-kid': {
    name: 'Pip',
    map: 'core:test-region',
    x: 55,
    y: 51,
    look: { outfit: 'sky', hair: 'red', skin: 'warm' },
    behavior: { kind: 'wander', radius: 3 },
    lines: [
      'I saw a Sproutle in the tall grass to the east!',
      'Walk into one and it will fight you.',
    ],
  },
  'test-ranger': {
    name: 'Ranger Ode',
    map: 'core:test-region',
    x: 62,
    y: 48,
    facing: 'left',
    look: { outfit: 'forest', hair: 'dark', skin: 'deep' },
    behavior: { kind: 'look' },
    lines: [
      'Some wild Zorlings are curious and run right at you. Shy ones run away.',
      'If one catches you, it is a battle!',
    ],
  },
  'test-fisher': {
    name: 'Fisher Lou',
    map: 'core:test-region',
    x: 60,
    y: 56,
    facing: 'up',
    look: { outfit: 'navy', hair: 'brown', skin: 'light' },
    lines: ['Nothing biting today.'],
  },
};
