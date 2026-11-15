/**
 * The Ashen Rift (C36): Emberwaste's danger zone, in the strip east of Ironspire Ridge. The
 * road leaves the Lookout eastward; a ranger keeps the gap in the rocks until the player holds
 * three badges. Rift Camp (no center) sits just inside. The Cinder Rift (Lv 45–52) lies west of
 * the lava river, in an ash storm (every battle starts Burning); the Molten Deep (Lv 52–60) lies
 * past it, where the Keeper guards the Rift Forge. The Elder Dunewyrm waits in the Glass Sink
 * (in the storm, so Steam Burst is close at hand), the Elder Forgeback in the Sunken Forge.
 *
 * Its rares are Brimscorp (Fire/Metal scorpion) and Shardwing (Metal/Wind vulture), from the
 * desert kit (looks picked at the C36 preview).
 */

import type { SpeciesInput } from '@game/data';
import { bosses } from './bosses';
import { dangerZone } from '@packs/core/endgame';

const e = (local: string): string => `emberwaste:${local}`;
const learn = (...pairs: [number, string][]): { level: number; move: string }[] =>
  pairs.map(([level, move]) => ({ level, move: move.includes(':') ? move : `core:${move}` }));
const KIT = 'emberwaste:desert';

export const ashenRiftSpecies = {
  brimscorp: {
    name: 'Brimscorp',
    description: 'A scorpion with an iron shell. Its stinger glows white-hot when it is angry.',
    types: ['core:fire', 'core:metal'],
    baseStats: { hp: 125, attack: 150, defense: 150, speed: 105 },
    learnset: learn(
      [1, 'ember'],
      [1, 'iron-bash'],
      [1, 'flame-pounce'],
      [45, 'steel-claw'],
      [50, e('iron-crash')],
      [55, 'blaze-rush'],
    ),
    rare: true,
    catchRate: 0.6,
    look: { seed: 3663, plan: 'scorpion', mood: 'fierce', kit: KIT },
  },
  shardwing: {
    name: 'Shardwing',
    description: 'A vulture with feathers of volcanic glass. They ring like bells as it glides.',
    types: ['core:metal', 'core:wind'],
    baseStats: { hp: 120, attack: 140, defense: 120, speed: 150 },
    learnset: learn(
      [1, 'wing-cut'],
      [1, 'iron-bash'],
      [1, 'gale-dash'],
      [45, 'steel-claw'],
      [50, 'cyclone'],
      [55, e('iron-crash')],
    ),
    rare: true,
    catchRate: 0.6,
    look: { seed: 3675, plan: 'vulture', mood: 'dark', kit: KIT },
  },
} satisfies Record<string, SpeciesInput>;

export const ASHEN_RIFT = dangerZone({
  ns: 'emberwaste',
  map: e('emberwaste'),
  name: 'Ashen Rift',
  where: 'east of the Lookout on Ironspire Ridge',
  ranger: {
    name: 'Ranger Dov',
    x: 199,
    y: 134,
    facing: 'left',
    look: { outfit: 'mustard', hair: 'dark', skin: 'deep' },
  },
  surveyor: { x: 109, y: 122, facing: 'down' },
  scout: {
    name: 'Guild Scout Lio',
    x: 211,
    y: 131,
    facing: 'down',
    look: { outfit: 'orange', hair: 'brown', skin: 'tan' },
    lines: [
      'Welcome to Rift Camp. No center out here. The nearest bed is back in Slagwatch.',
      'West of the lava river the ash never settles. Everyone burns, so splash them with Water.',
      'An Elder Dunewyrm lives in the Glass Sink, down south in the storm. Steam cracks it, same as the young one.',
      'The Elder Forgeback sleeps in the Sunken Forge to the north. Lift it off its feet with Wind, then cut it.',
    ],
  },
  aces: {
    'dune-strider-rhea': {
      name: 'Dune Strider Rhea',
      x: 231,
      y: 121,
      facing: 'left',
      look: { outfit: 'red', hair: 'dark', skin: 'warm' },
      team: [
        [e('pyrebeetle'), 48],
        [e('dunewyrm'), 48],
        [e('mirageel'), 49],
      ],
      prize: 2450,
      hello: 'The ash has been falling for a hundred years out here. Think you can see through it?',
      beaten: 'Clear as a summer sky. Well fought.',
      after: 'Brimscorps hide under the ash. Step lightly, or step on one.',
    },
    'ashwalker-tor': {
      name: 'Ashwalker Tor',
      x: 234,
      y: 145,
      facing: 'left',
      look: { outfit: 'black', hair: 'grey', skin: 'tan' },
      team: [
        [e('dustwhirl'), 49],
        [e('voltsting'), 50],
        [e('ironjaw'), 50],
      ],
      prize: 2500,
      hello: 'I walk the storm every day. Today I walk it with you. Battle!',
      beaten: 'Hah! The storm likes you.',
      after: 'The Glass Sink is south of here. The sand sings when the Elder Dunewyrm moves.',
    },
    'smith-varga': {
      name: 'Smith Varga',
      x: 247,
      y: 90,
      facing: 'down',
      look: { outfit: 'maroon', hair: 'red', skin: 'deep' },
      team: [
        [e('forgeback'), 54],
        [e('shimmerfox'), 54],
        [e('ironjaw'), 55],
      ],
      prize: 2750,
      hello:
        'The old smiths forged in the Rift. Their hammers are still warm. Show me your temper!',
      beaten: 'Good steel. Very good steel.',
      after: 'Shardwings drop glass feathers. The smiths of Kilnreach would pay a fortune for one.',
    },
  },
  keeper: {
    id: 'keeper-ashka',
    name: 'Keeper Ashka',
    x: 265,
    y: 63,
    facing: 'down',
    look: { outfit: 'red', hair: 'grey', skin: 'deep' },
    team: [
      [e('saguardian'), 57],
      [e('dunemaul'), 58],
      [e('magmaroth'), 59],
    ],
    prize: 4000,
    hello:
      'The Rift Forge made the first fire of Emberwaste. I keep it lit. You will not put it out.',
    beaten: 'The fire still burns. Write that on your map.',
    after: 'Calderon was born in this forge, the stories say. Then it went home to the mountain.',
  },
  elders: {
    'elder-dunewyrm': {
      name: 'Elder Dunewyrm',
      anchor: 'glass-sink',
      titan: 'emberwaste:dunewyrm-titan',
      from: bosses['dunewyrm-titan'],
      aura: 3,
      level: 52,
      prize: 3000,
      intro: 'The glass cracks and the sand pours down. An Elder Dunewyrm rises out of the sink!',
      beaten: 'The Elder Dunewyrm sinks back into the glass, slow as a sunset.',
      back: 'The sand in the sink shivers. The Elder Dunewyrm is ready again.',
    },
    'elder-forgeback': {
      name: 'Elder Forgeback',
      anchor: 'sunken-forge',
      titan: 'emberwaste:forgeback-titan',
      from: bosses['forgeback-titan'],
      aura: 3,
      level: 56,
      prize: 3500,
      intro: 'An anvil the size of a house stands up. It is an Elder Forgeback, glowing white!',
      beaten: 'The Elder Forgeback cools to a dull red and settles down.',
      back: 'The Sunken Forge glows again. The Elder Forgeback wants another fight.',
    },
  },
  hidden: {
    'item-ember-geode': {
      anchor: 'ember-geode',
      item: 'core:max-potion',
      count: 1,
      where: 'inside a cracked geode',
    },
    'item-bone-arch': {
      anchor: 'bone-arch',
      item: 'core:super-potion',
      count: 2,
      where: 'under the old bone arch',
    },
  },
});
