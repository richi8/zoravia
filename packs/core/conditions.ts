/**
 * The 8 conditions from DESIGN.md "Conditions & reactions". Each lasts 3 turns.
 * Side-effect sizes are starting values, tuned in the balance pass (C31).
 */

import type { ConditionInput } from '@game/data';

export const conditions = {
  burning: {
    name: 'Burning',
    description: 'Takes damage every turn.',
    effects: [{ kind: 'hpLoss', fraction: 1 / 16 }],
  },
  wet: {
    name: 'Wet',
    description: 'A little slower.',
    effects: [{ kind: 'stat', stat: 'speed', multiplier: 0.85 }],
  },
  overgrown: {
    name: 'Overgrown',
    description: 'Loses a little HP each turn to whoever planted it.',
    effects: [{ kind: 'hpLoss', fraction: 1 / 24, toSource: true }],
  },
  charged: {
    name: 'Charged',
    description: '10% chance to fumble a move.',
    effects: [{ kind: 'fumble', chance: 0.1 }],
  },
  chilled: {
    name: 'Chilled',
    description: 'Slower.',
    effects: [{ kind: 'stat', stat: 'speed', multiplier: 0.7 }],
  },
  muddy: {
    name: 'Muddy',
    description: 'Less accurate.',
    effects: [{ kind: 'stat', stat: 'accuracy', multiplier: 0.85 }],
  },
  airborne: {
    name: 'Airborne',
    description: 'Easier to hit.',
    effects: [{ kind: 'stat', stat: 'evasion', multiplier: 0.85 }],
  },
  exposed: {
    name: 'Exposed',
    description: 'Lower defense.',
    effects: [{ kind: 'stat', stat: 'defense', multiplier: 0.75 }],
  },
} satisfies Record<string, ConditionInput>;
