/**
 * Test NPCs for the C21 test region (C22: a center attendant and a shop; C26: Ranger Ode and
 * Fisher Lou run the dialogues of the sample quest in `story.ts`; C27: the Grove Trial, Rival
 * Mira's two encounters, see `trainers.ts`; Glacivar's shrine moved to the `rimeholm` pack in
 * C35). Verdale's townsfolk (C28) are in `verdale-npcs.ts`.
 */

import type { NpcInput } from '@game/data';
import { verdaleNpcs } from './verdale-npcs';
import { verdaleStoryNpcs } from './verdale-story';
import { verdaleTrainerNpcs } from './verdale-trainers';

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
    dialogue: 'core:ranger-ode',
  },
  'test-fisher': {
    name: 'Fisher Lou',
    map: 'core:test-region',
    x: 60,
    y: 56,
    facing: 'up',
    look: { outfit: 'navy', hair: 'brown', skin: 'light' },
    dialogue: 'core:fisher-lou',
  },
  'trial-keeper': {
    name: 'Keeper Bryn',
    map: 'core:test-region',
    x: 54,
    y: 43,
    facing: 'down',
    look: { outfit: 'forest', hair: 'grey', skin: 'warm' },
    dialogue: 'core:keeper-bryn',
  },
  'trial-fern': {
    name: 'Apprentice Fern',
    map: 'core:test-region',
    x: 45,
    y: 46,
    facing: 'right',
    look: { outfit: 'mustard', hair: 'dark', skin: 'tan' },
    behavior: { kind: 'look' },
    dialogue: 'core:apprentice-fern',
    mark: 'trial',
  },
  'trial-oak': {
    name: 'Warden Oak',
    map: 'core:test-region',
    x: 48,
    y: 53,
    facing: 'up',
    look: { outfit: 'maroon', hair: 'dark', skin: 'deep' },
    dialogue: 'core:warden-oak',
    mark: 'trial',
  },
  'rival-mira': {
    name: 'Rival Mira',
    map: 'core:test-region',
    x: 56,
    y: 49,
    facing: 'left',
    look: { outfit: 'purple', hair: 'blonde', skin: 'light' },
    when: { not: { beat: 'core:rival-mira' } },
    dialogue: 'core:rival-mira',
    mark: 'rival',
  },
  'rival-mira-grove': {
    name: 'Rival Mira',
    map: 'core:test-region',
    x: 53,
    y: 53,
    facing: 'left',
    look: { outfit: 'purple', hair: 'blonde', skin: 'light' },
    when: {
      all: [{ badge: 'core:grove-badge' }, { not: { beat: 'core:rival-mira-grove' } }],
    },
    dialogue: 'core:rival-mira-grove',
    mark: 'rival',
  },
  ...verdaleNpcs,
  ...verdaleTrainerNpcs,
  ...verdaleStoryNpcs,
};
