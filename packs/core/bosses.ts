/**
 * Bosses. Verdale (C29): the Mossback Titan (Hollow Oak, Deepwood), the Bogmaw Titan (Sunken
 * Hollow, Reed Marsh) and the legendary Verdion (Heartwood Shrine, Old Grove). Each lists the
 * reaction that breaks its Armor. Their aura gives ×2 HP rather than the default ×3: on these
 * bulky species ×3 was out of reach for a team of their level in the C29 simulations (tuned in
 * C31). The Storm Galehawk is the region boss's (C30). The Thornwing Titan is the test
 * region's. Glacivar moved to the `rimeholm` pack (C35).
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
    description: 'Charge it with Electric, then strike with Metal: Overload breaks its Armor.',
    kind: 'legendary',
    species: 'core:verdion',
    level: 36,
    hpMultiplier: 2,
    signatureMove: 'core:verdant-gale',
    // Was Shatter (Chill, then Earth) until C31: Nature resists Earth and its Nature hits do
    // ×2.25 to Earth/Water Zorlings, so that plan lost to plain potions. Electric and Metal
    // Zorlings both resist Verdion's own types.
    armor: { breaks: ['core:overload'] },
    rematch: { levels: 5, prize: 2000 },
  },
  // Region boss (C30): Stormcatcher Vex's Galehawk, charged by her Gale Engine. It fights only
  // in her team (a trainer battle), so it is never Subdued or caught.
  'storm-galehawk': {
    name: 'Storm Galehawk',
    description: 'Toss it up with Wind, then bring it down with Earth: Slam breaks its Armor.',
    kind: 'titan',
    species: 'core:galehawk',
    level: 38,
    hpMultiplier: 1.5,
    signatureMove: 'core:gale-engine',
    armor: { breaks: ['core:slam'] },
    theme: 'core:titan-theme',
  },
} satisfies Record<string, BossInput>;
