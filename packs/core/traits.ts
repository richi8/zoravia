/** Traits: type boosts, condition immunities and longer conditions. */

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
  overgrowth: {
    name: 'Overgrowth',
    description: 'Nature moves deal 20% more damage.',
    effects: [{ kind: 'typePower', type: 'core:nature', multiplier: 1.2 }],
  },
  torrent: {
    name: 'Torrent',
    description: 'Water moves deal 20% more damage.',
    effects: [{ kind: 'typePower', type: 'core:water', multiplier: 1.2 }],
  },
  tailwind: {
    name: 'Tailwind',
    description: 'Wind moves deal 20% more damage.',
    effects: [{ kind: 'typePower', type: 'core:wind', multiplier: 1.2 }],
  },
  grounded: {
    name: 'Grounded',
    description: 'Never gets Charged.',
    effects: [{ kind: 'conditionImmunity', condition: 'core:charged' }],
  },
  'sure-footed': {
    name: 'Sure-footed',
    description: 'Never becomes Airborne.',
    effects: [{ kind: 'conditionImmunity', condition: 'core:airborne' }],
  },
  frostproof: {
    name: 'Frostproof',
    description: 'Never gets Chilled.',
    effects: [{ kind: 'conditionImmunity', condition: 'core:chilled' }],
  },
} satisfies Record<string, TraitInput>;
