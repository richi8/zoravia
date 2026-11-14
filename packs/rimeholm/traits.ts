/** Rimeholm's traits (C35): type boosts for its Electric and Ice Zorlings. */

import type { TraitInput } from '@game/data';

export const traits = {
  'live-wire': {
    name: 'Live Wire',
    description: 'Electric moves deal 20% more damage.',
    effects: [{ kind: 'typePower', type: 'core:electric', multiplier: 1.2 }],
  },
  rimebound: {
    name: 'Rimebound',
    description: 'Ice moves deal 20% more damage.',
    effects: [{ kind: 'typePower', type: 'core:ice', multiplier: 1.2 }],
  },
} satisfies Record<string, TraitInput>;
