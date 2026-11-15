/**
 * The Polar Drift (C36): Rimeholm's danger zone, an ice shelf in the strip south of the White
 * Crown. A pier leaves the shore below the Crown Shrine southward; a ranger stands on it until
 * the player holds three badges. Driftwatch Camp (no center) sits where the pier lands. The
 * Driftice Floes (Lv 45–52) lie in a sleet storm (every battle starts Wet); the Aurora Shelf
 * (Lv 52–60) lies past them, where the Keeper guards the Starfall Cairn. The Elder Floemaw
 * waits on the Walrus Floe (in the sleet, so Frozen is close at hand), the Elder Squallwing on
 * the Storm Roost.
 *
 * Its rares are Starhorn (Ice/Wind caribou) and Deepjaw (Water/Ice angler), from the frozen kit
 * (looks picked at the C36 preview).
 */

import type { SpeciesInput } from '@game/data';
import { bosses } from './bosses';
import { dangerZone } from '@packs/core/endgame';

const r = (local: string): string => `rimeholm:${local}`;
const learn = (...pairs: [number, string][]): { level: number; move: string }[] =>
  pairs.map(([level, move]) => ({ level, move: move.includes(':') ? move : `core:${move}` }));
const KIT = 'rimeholm:frozen';

export const polarDriftSpecies = {
  starhorn: {
    name: 'Starhorn',
    description: 'A caribou whose antlers catch the aurora and hold its light until dawn.',
    types: ['core:ice', 'core:wind'],
    baseStats: { hp: 125, attack: 140, defense: 110, speed: 155 },
    learnset: learn(
      [1, 'frost-fang'],
      [1, 'gust'],
      [1, 'hail-dash'],
      [45, 'gale-dash'],
      [50, 'cyclone'],
      [55, 'blizzard'],
    ),
    rare: true,
    catchRate: 0.6,
    look: { seed: 3685, plan: 'caribou', mood: 'fierce', kit: KIT },
  },
  deepjaw: {
    name: 'Deepjaw',
    description: 'It lurks under the ice shelf. Its lure looks just like a lost lantern.',
    types: ['core:water', 'core:ice'],
    baseStats: { hp: 150, attack: 145, defense: 130, speed: 105 },
    learnset: learn(
      [1, 'splash-shot'],
      [1, 'frost-fang'],
      [1, 'tide-crash'],
      [45, 'hail-dash'],
      [50, 'riptide'],
      [55, 'blizzard'],
    ),
    rare: true,
    catchRate: 0.6,
    look: { seed: 3694, plan: 'angler', mood: 'dark', kit: KIT },
  },
} satisfies Record<string, SpeciesInput>;

export const POLAR_DRIFT = dangerZone({
  ns: 'rimeholm',
  map: r('rimeholm'),
  name: 'Polar Drift',
  where: 'south of the White Crown, past the Crown Shrine',
  ranger: {
    name: 'Ranger Siv',
    x: 90,
    y: 197,
    facing: 'up',
    look: { outfit: 'sky', hair: 'blonde', skin: 'light' },
  },
  surveyor: { x: 102, y: 37, facing: 'down' },
  scout: {
    name: 'Guild Scout Arne',
    x: 92,
    y: 224,
    facing: 'down',
    look: { outfit: 'navy', hair: 'red', skin: 'warm' },
    lines: [
      'Welcome to Driftwatch Camp. No center out here. Keep a Max Potion handy.',
      'The sleet on the floes soaks everything. Ice freezes a soaked Zorling solid, Electric shocks it.',
      'An Elder Floemaw hauls out on the Walrus Floe to the west. Freeze it, as you would the young one.',
      'The Elder Squallwing roosts to the east. Charge it with Electric, then strike with Metal.',
    ],
  },
  aces: {
    'icebreaker-sven': {
      name: 'Icebreaker Sven',
      x: 66,
      y: 240,
      facing: 'down',
      look: { outfit: 'red', hair: 'blonde', skin: 'light' },
      team: [
        [r('rimestoat'), 48],
        [r('floemaw'), 48],
        [r('jellivolt'), 49],
      ],
      prize: 2450,
      hello: 'My ship is frozen in a mile north of here. I have had time to train. Lots of time!',
      beaten: 'Well. Back to waiting for the thaw.',
      after: 'Deepjaws follow ship lanterns. That is how I lost my ship.',
    },
    'stargazer-maren': {
      name: 'Stargazer Maren',
      x: 96,
      y: 237,
      facing: 'left',
      look: { outfit: 'purple', hair: 'dark', skin: 'tan' },
      team: [
        [r('lumenaw'), 49],
        [r('urchivolt'), 50],
        ['core:rimewisp', 50],
      ],
      prize: 2500,
      hello: 'The stars are clearer here than anywhere in Zoravia. So is a good battle!',
      beaten: 'A shooting star! Oh, no, that was my Lumenaw.',
      after: 'Starhorns graze on the shelf at night. Their antlers glow like the Crownlight.',
    },
    'whaler-ingrid': {
      name: 'Whaler Ingrid',
      x: 101,
      y: 256,
      facing: 'left',
      look: { outfit: 'navy', hair: 'grey', skin: 'warm' },
      team: [
        [r('brineclaw'), 54],
        [r('frostcairn'), 54],
        [r('squallwing'), 55],
      ],
      prize: 2750,
      hello: 'I stopped hunting whales years ago. Now I hunt good battles.',
      beaten: 'That was a whale of a fight.',
      after:
        'The cairn ahead was built by the first sailors who reached the shelf. Nobody knows how.',
    },
  },
  keeper: {
    id: 'keeper-aurelle',
    name: 'Keeper Aurelle',
    x: 100,
    y: 264,
    facing: 'up',
    look: { outfit: 'sky', hair: 'grey', skin: 'light' },
    team: [
      [r('tundramoth'), 57],
      [r('auroryx'), 58],
      [r('selkaris'), 59],
    ],
    prize: 4000,
    hello:
      'The Starfall Cairn marks where the first light fell. I keep it. Show me you deserve to see it.',
    beaten: 'Then go, and draw the cairn on your map. Draw it bright.',
    after: 'Glacivar came here once, long ago. The ice still remembers its footprints.',
  },
  elders: {
    'elder-floemaw': {
      name: 'Elder Floemaw',
      anchor: 'walrus-floe',
      titan: 'rimeholm:floemaw-titan',
      from: bosses['floemaw-titan'],
      aura: 3,
      level: 52,
      prize: 3000,
      intro:
        'The floe tips as something huge hauls itself up. An Elder Floemaw, tusks like icebergs!',
      beaten: 'The Elder Floemaw slides back into the dark water.',
      back: 'The floe rocks. The Elder Floemaw is back for more.',
    },
    'elder-squallwing': {
      name: 'Elder Squallwing',
      anchor: 'storm-roost',
      titan: 'rimeholm:squallwing-titan',
      from: bosses['squallwing-titan'],
      aura: 4,
      level: 56,
      prize: 3500,
      intro: 'Thunder cracks overhead. An Elder Squallwing dives out of the storm!',
      beaten: 'The Elder Squallwing climbs back into the clouds.',
      back: 'Lightning flickers over the roost. The Elder Squallwing is waiting.',
    },
  },
  hidden: {
    'item-aurora-pool': {
      anchor: 'aurora-pool',
      item: 'core:max-potion',
      count: 1,
      where: 'at the bottom of the glowing pool',
    },
    'item-frozen-mast': {
      anchor: 'frozen-mast',
      item: 'core:super-potion',
      count: 2,
      where: 'in a crate lashed to the frozen mast',
    },
  },
});
