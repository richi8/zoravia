/** The full reaction table from DESIGN.md "Conditions & reactions". */

import type { ReactionInput } from '@game/data';

export const reactions = {
  wildfire: {
    name: 'Wildfire',
    description: 'Fire on Overgrown: double damage.',
    condition: 'core:overgrown',
    type: 'core:fire',
    damageMultiplier: 2,
  },
  'steam-burst': {
    name: 'Steam Burst',
    description: 'Water on Burning: ×1.75 damage and the steam lowers accuracy.',
    condition: 'core:burning',
    type: 'core:water',
    damageMultiplier: 1.75,
    lingering: { turns: 2, effects: [{ kind: 'stat', stat: 'accuracy', multiplier: 0.8 }] },
  },
  rooted: {
    name: 'Rooted',
    description: 'Nature on Muddy: can’t switch out, and a growing drain.',
    condition: 'core:muddy',
    type: 'core:nature',
    lingering: {
      turns: 3,
      effects: [
        { kind: 'trapped' },
        { kind: 'hpLoss', fraction: 1 / 16, growth: 1 / 32, toSource: true },
      ],
    },
  },
  conducted: {
    name: 'Conducted',
    description: 'Electric on Wet: ×1.75 damage.',
    condition: 'core:wet',
    type: 'core:electric',
    damageMultiplier: 1.75,
  },
  frozen: {
    name: 'Frozen',
    description: 'Ice on Wet: frozen solid, skips a turn.',
    condition: 'core:wet',
    type: 'core:ice',
    lingering: { turns: 1, effects: [{ kind: 'skipTurn' }] },
  },
  shatter: {
    name: 'Shatter',
    description: 'Earth on Chilled: double damage, ignores defense.',
    condition: 'core:chilled',
    type: 'core:earth',
    damageMultiplier: 2,
    ignoreDefense: true,
  },
  slam: {
    name: 'Slam',
    description: 'Earth on Airborne: ×1.75 damage.',
    condition: 'core:airborne',
    type: 'core:earth',
    damageMultiplier: 1.75,
  },
  shred: {
    name: 'Shred',
    description: 'Wind on Exposed: ×1.75 damage, ignores defense.',
    condition: 'core:exposed',
    type: 'core:wind',
    damageMultiplier: 1.75,
    ignoreDefense: true,
  },
  overload: {
    name: 'Overload',
    description: 'Metal on Charged: ×1.5 damage and a stun.',
    condition: 'core:charged',
    type: 'core:metal',
    damageMultiplier: 1.5,
    lingering: { turns: 1, effects: [{ kind: 'skipTurn' }] },
  },
} satisfies Record<string, ReactionInput>;
