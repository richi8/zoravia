/**
 * Rimeholm's moves (C35): Electric's strong hit (core has none above Volt Lash), and the
 * signature moves of its Titans, the region boss's Lodestar Lumenaw and the legendary Glacivar
 * (Whiteout moved here from core with Glacivar).
 */

import type { MoveInput } from '@game/data';

export const moves = {
  thunderclap: {
    name: 'Thunderclap',
    type: 'core:electric',
    power: 85,
    accuracy: 85,
    applyChance: 0.2,
  },
  'floe-crush': {
    name: 'Floe Crush',
    description: 'The Floemaw Titan’s signature move.',
    type: 'core:ice',
    power: 80,
    accuracy: 90,
    applyChance: 0.3,
  },
  'squall-dive': {
    name: 'Squall Dive',
    description: 'The Squallwing Titan’s signature move.',
    type: 'core:electric',
    power: 80,
    accuracy: 90,
    applyChance: 0.3,
  },
  'lodestar-beam': {
    name: 'Lodestar Beam',
    description: 'The Lodestar Lumenaw’s signature move: a beam of stolen winter light.',
    type: 'core:electric',
    power: 80,
    accuracy: 90,
    applyChance: 0.3,
  },
  whiteout: {
    name: 'Whiteout',
    description: 'Glacivar’s signature move.',
    type: 'core:ice',
    power: 80,
    accuracy: 90,
    applyChance: 0.3,
  },
} satisfies Record<string, MoveInput>;
