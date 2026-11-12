/**
 * ~10 test species: a 3-stage line, two 2-stage lines, two single-stage species (one dual
 * type, one trait-less) and a legendary. Region 1 replaces these with real content (C29).
 */

import type { SpeciesInput } from '@game/data';

const learn = (...pairs: [number, string][]): { level: number; move: string }[] =>
  pairs.map(([level, move]) => ({ level, move: `core:${move}` }));

export const species = {
  emberkit: {
    name: 'Emberkit',
    types: ['core:fire'],
    baseStats: { hp: 70, attack: 85, defense: 60, speed: 85 },
    trait: 'core:kindling',
    learnset: learn([1, 'ember'], [1, 'gust'], [8, 'kindle'], [14, 'flame-pounce']),
    evolution: { into: 'core:blazekit', level: 16 },
  },
  blazekit: {
    name: 'Blazekit',
    types: ['core:fire'],
    baseStats: { hp: 92, attack: 115, defense: 83, speed: 120 },
    trait: 'core:kindling',
    learnset: learn([1, 'ember'], [1, 'flame-pounce'], [22, 'wing-cut']),
    evolution: { into: 'core:infernyx', level: 34 },
  },
  infernyx: {
    name: 'Infernyx',
    types: ['core:fire'],
    baseStats: { hp: 115, attack: 145, defense: 105, speed: 155 },
    trait: 'core:kindling',
    learnset: learn([1, 'flame-pounce'], [1, 'wing-cut'], [38, 'gale-dash']),
  },
  puddlit: {
    name: 'Puddlit',
    types: ['core:water'],
    baseStats: { hp: 95, attack: 75, defense: 90, speed: 70 },
    trait: 'core:waterproof',
    learnset: learn([1, 'splash-shot'], [5, 'drench'], [12, 'mud-toss']),
    evolution: { into: 'core:torrentoad', level: 22 },
  },
  torrentoad: {
    name: 'Torrentoad',
    types: ['core:water'],
    baseStats: { hp: 140, attack: 110, defense: 135, speed: 105 },
    trait: 'core:waterproof',
    learnset: learn([1, 'splash-shot'], [1, 'drench'], [22, 'tide-crash'], [28, 'rock-slam']),
  },
  sproutle: {
    name: 'Sproutle',
    types: ['core:nature'],
    baseStats: { hp: 85, attack: 80, defense: 90, speed: 75 },
    trait: 'core:lingering',
    learnset: learn([1, 'vine-snap'], [6, 'spore-cloud'], [14, 'gust']),
    evolution: { into: 'core:thornwing', level: 20 },
  },
  thornwing: {
    name: 'Thornwing',
    types: ['core:nature', 'core:wind'],
    baseStats: { hp: 110, attack: 125, defense: 110, speed: 145 },
    trait: 'core:lingering',
    learnset: learn([1, 'vine-snap'], [1, 'gust'], [20, 'thorn-volley'], [26, 'gale-dash']),
  },
  voltbat: {
    name: 'Voltbat',
    description: 'No trait, so slightly higher stats.',
    types: ['core:electric', 'core:wind'],
    baseStats: { hp: 90, attack: 120, defense: 85, speed: 185 },
    learnset: learn([1, 'static-bite'], [1, 'wing-cut'], [18, 'volt-lash'], [24, 'frost-fang']),
  },
  ironshell: {
    name: 'Ironshell',
    description: 'A Metal tank: no trait, so slightly higher stats.',
    types: ['core:metal'],
    baseStats: { hp: 150, attack: 105, defense: 170, speed: 55 },
    learnset: learn([1, 'iron-bash'], [10, 'mud-toss'], [20, 'steel-claw']),
  },
  glacivar: {
    name: 'Glacivar',
    description: 'Test legendary.',
    types: ['core:ice'],
    baseStats: { hp: 150, attack: 150, defense: 135, speed: 140 },
    trait: 'core:heatproof',
    learnset: learn([1, 'frost-fang'], [1, 'hail-dash'], [1, 'rock-slam']),
    legendary: true,
  },
} satisfies Record<string, SpeciesInput>;
