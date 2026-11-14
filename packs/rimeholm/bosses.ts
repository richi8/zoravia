/**
 * Rimeholm's bosses (C35). Each breaks on its own reaction:
 * - the Floemaw Titan (Tusk Rookery, Sleet Fells) on Frozen: the fells' sleet storm soaks every
 *   battle, and Ice freezes what is wet;
 * - the Squallwing Titan (Thunder Eyrie, Thunder Bluffs) on Overload: charge it with Electric,
 *   then strike with Metal;
 * - the region boss's Lodestar Lumenaw (the Stormspire, Shipwreck Shoals) on Rooted: muddy it
 *   with Earth, then tangle it with Nature;
 * - the legendary Glacivar (Crown Shrine) on Slam: toss it up with Wind, then bring it down
 *   with Earth.
 * Like the other regions', the Floemaw Titan's and Glacivar's aura gives ×2 / ×1.75 HP
 * (C29/C31/C34); the Squallwing Titan's gives ×2.5 (see below).
 */

import type { BossInput } from '@game/data';

export const bosses = {
  'floemaw-titan': {
    name: 'Floemaw Titan',
    description: 'The sleet soaks it; freeze it with Ice: Frozen cracks its hide.',
    kind: 'titan',
    species: 'rimeholm:floemaw',
    // Lv 16, not 17 (C35 sims): at 17 a team two levels up won only 3% on 5 Super Potions.
    level: 16,
    hpMultiplier: 2,
    signatureMove: 'rimeholm:floe-crush',
    armor: { breaks: ['core:frozen'] },
    theme: 'core:titan-theme',
    rematch: { levels: 8, prize: 1000 },
  },
  'squallwing-titan': {
    name: 'Squallwing Titan',
    description: 'Charge it with Electric, then strike with Metal: Overload breaks its Armor.',
    kind: 'titan',
    species: 'rimeholm:squallwing',
    level: 22,
    // ×2.5, not ×2 (C35 sims): Electric/Wind is weak to Ice, Earth and Metal, and its HP and
    // Defense are low, so at ×2 plain super-effective hits won 78–100% without a reaction.
    hpMultiplier: 2.5,
    signatureMove: 'rimeholm:squall-dive',
    armor: { breaks: ['core:overload'] },
    theme: 'core:titan-theme',
    rematch: { levels: 8, prize: 1200 },
  },
  glacivar: {
    name: 'Glacivar',
    description: 'Toss it up with Wind, then bring it down with Earth: Slam breaks its Armor.',
    kind: 'legendary',
    species: 'rimeholm:glacivar',
    level: 35,
    hpMultiplier: 1.75,
    signatureMove: 'rimeholm:whiteout',
    armor: { breaks: ['core:slam'] },
    theme: 'rimeholm:glacivar-theme',
    rematch: { levels: 5, prize: 2000 },
  },
  // Region boss (C35): Lampwright Odessa's Lumenaw, glowing with the winter lights she pulled
  // down. It fights only in her team (a trainer battle), so it is never Subdued or caught.
  'lodestar-lumenaw': {
    name: 'Lodestar Lumenaw',
    description: 'Muddy it with Earth, then tangle it with Nature: Rooted breaks its Armor.',
    kind: 'titan',
    species: 'rimeholm:lumenaw',
    level: 38,
    // ×1.25, not Vex's and Gorran's ×1.5 (C35 playthrough): Rooted needs two types (Earth, then
    // Nature), so a team without either needs two catches to follow the hint; at ×1.5 the
    // playthrough took 3.8 tries on average.
    hpMultiplier: 1.25,
    signatureMove: 'rimeholm:lodestar-beam',
    armor: { breaks: ['core:rooted'] },
    theme: 'core:titan-theme',
  },
} satisfies Record<string, BossInput>;
