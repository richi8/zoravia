/** Test bosses: a Titan and the test legendary. Region 1 brings the real ones (C29). */

import type { BossInput } from '@game/data';

export const bosses = {
  'thornwing-titan': {
    name: 'Thornwing Titan',
    description: 'Charge it with Electric, then hit it with Metal: Overload breaks its Armor.',
    kind: 'titan',
    species: 'core:thornwing',
    level: 24,
    signatureMove: 'core:bramble-gale',
    armor: { breaks: ['core:overload'] },
  },
  glacivar: {
    name: 'Glacivar',
    description: 'Test legendary. Lift it up with Wind, then bring it down with Earth: Slam.',
    kind: 'legendary',
    species: 'core:glacivar',
    level: 40,
    signatureMove: 'core:whiteout',
    armor: { breaks: ['core:slam'] },
  },
} satisfies Record<string, BossInput>;
