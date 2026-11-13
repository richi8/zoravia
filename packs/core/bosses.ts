/**
 * Bosses. Verdale (C29): the Mossback Titan (Hollow Oak, Deepwood), the Bogmaw Titan (Sunken
 * Hollow, Reed Marsh) and the legendary Verdion (Heartwood Shrine, Old Grove). Each lists the
 * reaction that breaks its Armor. Their aura gives ×2 HP rather than the default ×3: on these
 * bulky species ×3 was out of reach for a team of their level in the C29 simulations (tuned in
 * C31). The Thornwing Titan and Glacivar are the test region's.
 */

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
    theme: 'core:titan-theme',
    rematch: { levels: 8, prize: 1200 },
  },
  glacivar: {
    name: 'Glacivar',
    description: 'Test legendary. Lift it up with Wind, then bring it down with Earth: Slam.',
    kind: 'legendary',
    species: 'core:glacivar',
    level: 40,
    signatureMove: 'core:whiteout',
    armor: { breaks: ['core:slam'] },
    theme: 'core:glacivar-theme',
    rematch: { levels: 5, prize: 2000 },
  },
  'mossback-titan': {
    name: 'Mossback Titan',
    description: 'Seed it with Nature, then set it alight with Fire: Wildfire breaks its bark.',
    kind: 'titan',
    species: 'core:mossback',
    level: 22,
    hpMultiplier: 2,
    signatureMove: 'core:ancient-root',
    armor: { breaks: ['core:wildfire'] },
    theme: 'core:titan-theme',
    rematch: { levels: 8, prize: 1200 },
  },
  'bogmaw-titan': {
    name: 'Bogmaw Titan',
    description: 'Soak it with Water, then shock it with Electric: Conducted cracks its mud.',
    kind: 'titan',
    species: 'core:bogmaw',
    level: 17,
    hpMultiplier: 2,
    signatureMove: 'core:bog-surge',
    armor: { breaks: ['core:conducted'] },
    theme: 'core:titan-theme',
    rematch: { levels: 8, prize: 1000 },
  },
  verdion: {
    name: 'Verdion',
    description: 'Chill it with Ice, then strike with Earth: Shatter breaks its Armor.',
    kind: 'legendary',
    species: 'core:verdion',
    level: 36,
    hpMultiplier: 2,
    signatureMove: 'core:verdant-gale',
    armor: { breaks: ['core:shatter'] },
    rematch: { levels: 5, prize: 2000 },
  },
} satisfies Record<string, BossInput>;
