/** Emberwaste's traits (C34): type boosts for its Earth and Metal Zorlings. */

import type { TraitInput } from '@game/data';

export const traits = {
  landslide: {
    name: 'Landslide',
    description: 'Earth moves deal 20% more damage.',
    effects: [{ kind: 'typePower', type: 'core:earth', multiplier: 1.2 }],
  },
  forged: {
    name: 'Forged',
    description: 'Metal moves deal 20% more damage.',
    effects: [{ kind: 'typePower', type: 'core:metal', multiplier: 1.2 }],
  },
} satisfies Record<string, TraitInput>;
