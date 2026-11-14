/**
 * Model kits (C35a). Verdale draws from the classic body plans (C08–C09) with their own part
 * weights, plus its legendary's dragon, the leafwyrm.
 */

import type { ModelKitInput } from '@game/data';

export const modelKits = {
  verdale: {
    name: 'Verdale',
    description: 'Meadows and forests: the classic Zorling body plans.',
    plans: [
      'quadruped',
      'feline',
      'canine',
      'dragon',
      'serpent',
      'avian',
      'raptor',
      'bat',
      'insect',
      'fish',
      'blob',
      'biped',
      'golem',
      'leafwyrm',
    ],
  },
} satisfies Record<string, ModelKitInput>;
