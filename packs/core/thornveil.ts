/**
 * Thornveil (C36): Verdale's danger zone, in the strip north of the Old Grove. The road leaves
 * the Heartwood Shrine northward; a ranger keeps the gap in the trees until the player holds
 * three badges. Thornveil Camp (no center) sits just inside. Tanglewild (Lv 45–52) fills the
 * south, Elderroot Deep (Lv 52–60, under a thick canopy) the north, where the Keeper guards
 * the Elder Tree. The Elder Mossback waits in the Ancient Hollow to the east, the Elder Bogmaw
 * in the Drowned Bog by the western lake.
 *
 * Its rares are Elderhorn (Nature/Earth stag) and Stormoth (Wind/Electric moth), from the
 * Verdale kit (looks picked at the C36 preview).
 */

import type { SpeciesInput } from '@game/data';
import { bosses } from './bosses';
import { dangerZone } from './endgame';

const c = (local: string): string => `core:${local}`;
const learn = (...pairs: [number, string][]): { level: number; move: string }[] =>
  pairs.map(([level, move]) => ({ level, move: c(move) }));
const KIT = 'core:verdale';

export const thornveilSpecies = {
  elderhorn: {
    name: 'Elderhorn',
    description:
      'An ancient stag whose antlers have grown into a living thicket. Only seen deep in Thornveil.',
    types: ['core:nature', 'core:earth'],
    baseStats: { hp: 140, attack: 140, defense: 135, speed: 115 },
    learnset: learn(
      [1, 'vine-snap'],
      [1, 'mud-toss'],
      [1, 'thorn-volley'],
      [45, 'rock-slam'],
      [50, 'timber-crush'],
      [55, 'quake'],
    ),
    rare: true,
    catchRate: 0.6,
    look: { seed: 3741, plan: 'quadruped', mood: 'fierce', kit: KIT },
  },
  stormoth: {
    name: 'Stormoth',
    description: 'A great moth whose wings crackle with static before a storm.',
    types: ['core:wind', 'core:electric'],
    baseStats: { hp: 115, attack: 140, defense: 105, speed: 170 },
    learnset: learn(
      [1, 'gust'],
      [1, 'static-bite'],
      [1, 'wing-cut'],
      [45, 'volt-lash'],
      [50, 'gale-dash'],
      [55, 'cyclone'],
    ),
    rare: true,
    catchRate: 0.6,
    look: { seed: 3708, plan: 'insect', mood: 'dark', kit: KIT },
  },
} satisfies Record<string, SpeciesInput>;

export const THORNVEIL = dangerZone({
  ns: 'core',
  map: c('verdale'),
  name: 'Thornveil',
  where: 'north of the Heartwood Shrine',
  ranger: {
    name: 'Ranger Hollis',
    x: 100,
    y: 81,
    facing: 'down',
    look: { outfit: 'forest', hair: 'brown', skin: 'tan' },
  },
  surveyor: { x: 97, y: 197, facing: 'right' },
  scout: {
    name: 'Guild Scout Wren',
    x: 98,
    y: 64,
    facing: 'down',
    look: { outfit: 'mustard', hair: 'blonde', skin: 'light' },
    lines: [
      'Welcome to Thornveil Camp. There is no center out here, so mind your potions.',
      'An old Mossback sleeps in the Ancient Hollow to the east. Seed it, then set it alight, same as the young ones.',
      'In the Drowned Bog to the west lives an Elder Bogmaw. Soak it, then shock it. It hates Nature most of all.',
      'The Keeper at the Elder Tree leans on Nature. Fire and Ice will serve you well.',
    ],
  },
  aces: {
    'wildwalker-bryn': {
      name: 'Wildwalker Bryn',
      x: 80,
      y: 46,
      facing: 'down',
      look: { outfit: 'forest', hair: 'dark', skin: 'deep' },
      team: [
        [c('galehawk'), 48],
        [c('torrentoad'), 48],
        [c('thornwing'), 49],
      ],
      prize: 2450,
      hello: 'Nobody comes this far by accident. Let us see what brought you!',
      beaten: 'The Tanglewild agrees with you.',
      after: 'Elderhorns shed their antlers in spring. I have only ever found one.',
    },
    'botanist-iris': {
      name: 'Botanist Iris',
      x: 70,
      y: 58,
      facing: 'right',
      look: { outfit: 'white', hair: 'red', skin: 'warm' },
      team: [
        [c('bogmaw'), 49],
        [c('thornwing'), 50],
        [c('voltbat'), 50],
      ],
      prize: 2500,
      hello:
        'Careful, you are standing on a fern no one has named yet. Battle me while I sketch it!',
      beaten: 'I will name it after you. Fernus defeatus.',
      after: 'Stormoths only fly before a storm. If you see one, find shelter.',
    },
    'old-guard-corin': {
      name: 'Old Guard Corin',
      x: 124,
      y: 30,
      facing: 'down',
      look: { outfit: 'navy', hair: 'grey', skin: 'tan' },
      team: [
        [c('mossback'), 54],
        [c('ironshell'), 54],
        [c('galehawk'), 55],
      ],
      prize: 2750,
      hello: 'I have guarded this road for forty years. Not once has it been easy. Ready?',
      beaten: 'Forty-one years, then. You may pass.',
      after: 'The Elder Tree is older than Verdale. Some say the Heartwood is its seed.',
    },
  },
  keeper: {
    id: 'keeper-ysolde',
    name: 'Keeper Ysolde',
    x: 100,
    y: 8,
    facing: 'down',
    look: { outfit: 'forest', hair: 'grey', skin: 'light' },
    team: [
      [c('torrentoad'), 57],
      [c('mossback'), 58],
      [c('thornmane'), 59],
    ],
    prize: 4000,
    hello: 'The Elder Tree has stood for a thousand years. Its keeper does not step aside lightly.',
    beaten: 'Then the Guild may have its map. Write the Elder Tree on it kindly.',
    after: 'Listen. The Elder Tree breathes just like the Heartwood. Slower, though.',
  },
  elders: {
    'elder-mossback': {
      name: 'Elder Mossback',
      anchor: 'ancient-hollow',
      titan: 'core:mossback-titan',
      from: bosses['mossback-titan'],
      aura: 3,
      level: 52,
      prize: 3000,
      intro: 'A hill of moss stirs. An Elder Mossback, older than the Titan of Deepwood, rises!',
      beaten: 'The Elder Mossback settles back into the hollow, grumbling like a landslide.',
      back: 'The Elder Mossback opens one eye. It would not mind another fight.',
    },
    'elder-bogmaw': {
      name: 'Elder Bogmaw',
      anchor: 'drowned-bog',
      titan: 'core:bogmaw-titan',
      from: bosses['bogmaw-titan'],
      aura: 2.5,
      level: 56,
      prize: 3500,
      intro: 'The bog bubbles and heaves. An Elder Bogmaw surges out of the mud!',
      beaten: 'The Elder Bogmaw sinks back under the mud.',
      back: 'Bubbles rise from the bog. The Elder Bogmaw wants another round.',
    },
  },
  hidden: {
    'item-moonlit-glade': {
      anchor: 'moonlit-glade',
      item: 'core:max-potion',
      count: 1,
      where: 'in a ring of pale mushrooms',
    },
    'item-thorn-arch': {
      anchor: 'thorn-arch',
      item: 'core:super-potion',
      count: 2,
      where: 'under the thorny arch',
    },
  },
});
