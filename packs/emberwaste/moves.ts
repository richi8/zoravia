/**
 * Emberwaste's moves (C34): Metal's strong hit (core has none above Steel Claw), and the
 * signature moves of its Titans, the region boss's Kiln Ironjaw and the legendary Calderon.
 */

import type { MoveInput } from '@game/data';

export const moves = {
  'iron-crash': {
    name: 'Iron Crash',
    type: 'core:metal',
    power: 85,
    accuracy: 85,
    applyChance: 0.2,
  },
  'dune-quake': {
    name: 'Dune Quake',
    description: 'The Dunewyrm Titan’s signature move.',
    type: 'core:earth',
    power: 80,
    accuracy: 90,
    applyChance: 0.3,
  },
  'forge-hammer': {
    name: 'Forge Hammer',
    description: 'The Forgeback Titan’s signature move.',
    type: 'core:metal',
    power: 80,
    accuracy: 90,
    applyChance: 0.3,
  },
  'kiln-blast': {
    name: 'Kiln Blast',
    description: 'The Kiln Ironjaw’s signature move: a breath of furnace heat.',
    type: 'core:fire',
    power: 80,
    accuracy: 90,
    applyChance: 0.3,
  },
  'caldera-flare': {
    name: 'Caldera Flare',
    description: 'Calderon’s signature move.',
    type: 'core:fire',
    power: 85,
    accuracy: 90,
    applyChance: 0.3,
  },
} satisfies Record<string, MoveInput>;
