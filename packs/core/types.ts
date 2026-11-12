/** The 8 types and the effectiveness chart from DESIGN.md "Types". */

import type { TypeInput } from '@game/data';

export const types = {
  fire: {
    name: 'Fire',
    strongAgainst: ['core:nature', 'core:ice', 'core:metal'],
    resists: ['core:nature', 'core:ice', 'core:metal'],
    applies: 'core:burning',
  },
  water: {
    name: 'Water',
    strongAgainst: ['core:fire', 'core:earth'],
    resists: ['core:fire', 'core:earth'],
    applies: 'core:wet',
  },
  nature: {
    name: 'Nature',
    strongAgainst: ['core:water', 'core:earth'],
    resists: ['core:water', 'core:earth'],
    applies: 'core:overgrown',
  },
  electric: {
    name: 'Electric',
    strongAgainst: ['core:water', 'core:wind'],
    resists: ['core:water', 'core:wind'],
    applies: 'core:charged',
  },
  ice: {
    name: 'Ice',
    strongAgainst: ['core:nature', 'core:wind'],
    resists: ['core:nature', 'core:wind'],
    applies: 'core:chilled',
  },
  earth: {
    name: 'Earth',
    strongAgainst: ['core:fire', 'core:electric', 'core:metal'],
    resists: ['core:fire', 'core:electric', 'core:metal'],
    applies: 'core:muddy',
  },
  wind: {
    name: 'Wind',
    strongAgainst: ['core:nature'],
    resists: ['core:nature'],
    applies: 'core:airborne',
  },
  metal: {
    name: 'Metal',
    strongAgainst: ['core:ice', 'core:wind'],
    resists: ['core:nature', 'core:ice', 'core:wind', 'core:metal'],
    applies: 'core:exposed',
  },
} satisfies Record<string, TypeInput>;
