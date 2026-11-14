/**
 * Emberwaste's bosses (C34). Each breaks on its own reaction:
 * - the Dunewyrm Titan (Sunken Sands, Cinder Dunes) on Steam Burst: the dunes' ash storm sets
 *   every battle Burning, and Water puts the fire out with a burst of steam;
 * - the Forgeback Titan (Old Foundry, Rust Canyon) on Shred: rust its plates with Metal, then
 *   let Wind tear through;
 * - the region boss's Kiln Ironjaw (Cap Works, Caldera Rim) on Shatter: chill it, then Earth;
 * - the legendary Calderon (Ember Heart) on Frozen: soak it, then freeze it.
 * Like Verdale's, the Titans' and Calderon's aura gives ×2 HP (C29/C31).
 */

import type { BossInput } from '@game/data';

export const bosses = {
  'dunewyrm-titan': {
    name: 'Dunewyrm Titan',
    description:
      'The ash storm sets it Burning; quench it with Water: Steam Burst cracks its hide.',
    kind: 'titan',
    species: 'emberwaste:dunewyrm',
    level: 17,
    hpMultiplier: 2,
    signatureMove: 'emberwaste:dune-quake',
    armor: { breaks: ['core:steam-burst'] },
    theme: 'core:titan-theme',
    rematch: { levels: 8, prize: 1000 },
  },
  'forgeback-titan': {
    name: 'Forgeback Titan',
    description: 'Rust it with Metal, then strike with Wind: Shred tears through its plates.',
    kind: 'titan',
    species: 'emberwaste:forgeback',
    level: 22,
    hpMultiplier: 2,
    signatureMove: 'emberwaste:forge-hammer',
    armor: { breaks: ['core:shred'] },
    theme: 'core:titan-theme',
    rematch: { levels: 8, prize: 1200 },
  },
  calderon: {
    name: 'Calderon',
    description: 'Soak it with Water, then freeze it with Ice: Frozen breaks its Armor.',
    kind: 'legendary',
    species: 'emberwaste:calderon',
    level: 35,
    hpMultiplier: 1.75,
    signatureMove: 'emberwaste:caldera-flare',
    armor: { breaks: ['core:frozen'] },
    rematch: { levels: 5, prize: 2000 },
  },
  // Region boss (C34): Glassmaker Gorran's Ironjaw, fed by the caldera's heat. It fights only
  // in his team (a trainer battle), so it is never Subdued or caught.
  'kiln-ironjaw': {
    name: 'Kiln Ironjaw',
    description: 'Chill it with Ice, then strike with Earth: Shatter breaks its Armor.',
    kind: 'titan',
    species: 'emberwaste:ironjaw',
    level: 38,
    hpMultiplier: 1.5,
    signatureMove: 'emberwaste:kiln-blast',
    armor: { breaks: ['core:shatter'] },
    theme: 'core:titan-theme',
  },
} satisfies Record<string, BossInput>;
