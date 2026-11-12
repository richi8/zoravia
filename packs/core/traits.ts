/** Test traits covering each trait effect kind. */

import type { TraitInput } from '@game/data';

export const traits = {
  kindling: {
    name: 'Kindling',
    description: 'Fire moves deal 20% more damage.',
    effects: [{ kind: 'typePower', type: 'core:fire', multiplier: 1.2 }],
  },
  waterproof: {
    name: 'Waterproof',
    description: 'Never gets Wet.',
    effects: [{ kind: 'conditionImmunity', condition: 'core:wet' }],
  },
  heatproof: {
    name: 'Heatproof',
    description: 'Never starts Burning.',
    effects: [{ kind: 'conditionImmunity', condition: 'core:burning' }],
  },
  lingering: {
    name: 'Lingering',
    description: 'Conditions it applies last 1 turn longer.',
    effects: [{ kind: 'conditionTurns', turns: 1 }],
  },
} satisfies Record<string, TraitInput>;
