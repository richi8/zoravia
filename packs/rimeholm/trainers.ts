/**
 * Rimeholm (C35): route trainers, and the encounters with its two Titans and its legendary.
 * Each trainer stands at the roadside of a zone, with a team inside that zone's level band (the
 * stage a wild Zorling has at that level) and a one-time prize (about 30 coins per level of
 * their strongest Zorling). Talking to one starts the battle; once beaten they only chat.
 *
 * The Floemaw Titan waits at the Tusk Rookery in the Sleet Fells (in the sleet storm, which
 * soaks it for Ice to freeze), the Squallwing Titan at the Thunder Eyrie on the Thunder Bluffs,
 * and Glacivar at the Crown Shrine on the White Crown. Each is a Zorling NPC that leaves once
 * caught and offers a rematch once beaten. Beaten, each Titan shows a vision of the winter
 * lights drawn into a lighthouse; Glacivar only appears once Lampwright Odessa is beaten at the
 * Stormspire.
 */

import type { DialogueInput, NpcInput, TrainerInput } from '@game/data';
import type { Facing } from '@game/data/maps';

const MAP = 'rimeholm:rimeholm';
const r = (local: string): string => `rimeholm:${local}`;
/** Species ids: Rimeholm's own, or `core:` ones written in full. */
const sp = (id: string): string => (id.includes(':') ? id : r(id));

type Look = NonNullable<NpcInput['look']>;

interface RouteTrainer {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly facing: Facing;
  readonly look: Look;
  /** `[species, level]` pairs, lead first. */
  readonly team: readonly (readonly [string, number])[];
  readonly prize: number;
  readonly hello: string;
  readonly beaten: string;
  readonly after: string;
}

export const ROUTE_TRAINERS: Record<string, RouteTrainer> = {
  // T1
  'beachcomber-tilde': {
    name: 'Beachcomber Tilde',
    x: 100,
    y: 56,
    facing: 'left',
    look: { outfit: 'sky', hair: 'blonde', skin: 'light' },
    team: [
      ['flurret', 5],
      ['pinchill', 6],
    ],
    prize: 180,
    hello: 'Found anything on the shingle? I found you! Battle time!',
    beaten: 'Washed right out to sea.',
    after:
      'Pinchills clack their claws to call the tide. Listen and you will hear the beach talking.',
  },
  'shepherd-arne': {
    name: 'Shepherd Arne',
    x: 60,
    y: 51,
    facing: 'up',
    look: { outfit: 'forest', hair: 'brown', skin: 'tan' },
    team: [
      ['spinzap', 7],
      ['kelpling', 8],
    ],
    prize: 240,
    hello: 'My flock is grazing the heath. Mind your step, and mind my Zorlings!',
    beaten: 'Good thing my flock did not see that.',
    after: 'Spinzaps hide in the heather. The sheep learned to walk around them. So should you.',
  },
  'netter-yrsa': {
    name: 'Netter Yrsa',
    x: 130,
    y: 45,
    facing: 'right',
    look: { outfit: 'mustard', hair: 'red', skin: 'warm' },
    team: [
      ['glimfry', 10],
      ['pinchill', 10],
      ['spinzap', 11],
    ],
    prize: 330,
    hello: 'You walked right into my net! Well, my battle. Same thing.',
    beaten: 'The one that got away. That is you.',
    after: 'Glimmerholm is just east. The Tide Trial there teaches you to soak, then strike.',
  },
  // T2
  'herder-eskil': {
    name: 'Herder Eskil',
    x: 100,
    y: 86,
    facing: 'left',
    look: { outfit: 'maroon', hair: 'dark', skin: 'light' },
    team: [
      ['tuskit', 17],
      ['core:voltbat', 17],
      ['frostcairn', 18],
    ],
    prize: 540,
    hello: 'The sleet soaks everything on the fells. Ready to battle wet?',
    beaten: 'Soaked and beaten. Both of us.',
    after: 'In the sleet everyone is wet. Then a breath of Ice freezes them solid!',
  },
  'diver-signe': {
    name: 'Diver Signe',
    x: 164,
    y: 86,
    facing: 'left',
    look: { outfit: 'navy', hair: 'blonde', skin: 'tan' },
    team: [
      ['glimfry', 18],
      ['jellivolt', 18],
      ['kelpling', 19],
    ],
    prize: 570,
    hello: 'I dive the Kelp Shallows every morning. The water is freezing. So are my Zorlings!',
    beaten: 'Brr. You win.',
    after: 'Jellivolts drift under the ice and hum. Do not touch them. I learned the hard way.',
  },
  'stormchaser-bjorn': {
    name: 'Stormchaser Bjorn',
    x: 166,
    y: 143,
    facing: 'left',
    look: { outfit: 'purple', hair: 'red', skin: 'deep' },
    team: [
      ['core:voltbat', 19],
      ['urchivolt', 20],
    ],
    prize: 600,
    hello: 'Lightning strikes the bluffs a hundred times a night. Let us add one more!',
    beaten: 'Struck down. Fair enough.',
    after: 'The Thunder Eyrie is just east. Something with huge wings nests in the storm-glass.',
  },
  'skater-freya': {
    name: 'Skater Freya',
    x: 54,
    y: 128,
    facing: 'left',
    look: { outfit: 'red', hair: 'blonde', skin: 'light' },
    team: [
      ['rimestoat', 21],
      ['floemaw', 22],
    ],
    prize: 660,
    hello: 'The squalls freeze the reach into one big rink. Battle me on the ice!',
    beaten: 'I slipped. That is my story.',
    after: 'Out here the sleet never stops. Everyone is wet, so Electric hits like a thunderbolt.',
  },
  'trapper-knud': {
    name: 'Trapper Knud',
    x: 138,
    y: 158,
    facing: 'left',
    look: { outfit: 'black', hair: 'grey', skin: 'warm' },
    team: [
      ['brineclaw', 23],
      ['tanglekelp', 24],
      ['lumenaw', 24],
    ],
    prize: 720,
    hello: 'The fen ice is thin. One wrong step and you are swimming. Let us battle carefully.',
    beaten: 'You crossed the fen. Not many do.',
    after:
      'Lumenaws glow under the fen ice. People think they are the winter lights. They are not.',
  },
  // T3
  'wreck-diver-oskar': {
    name: 'Wreck Diver Oskar',
    x: 179,
    y: 113,
    facing: 'left',
    look: { outfit: 'navy', hair: 'dark', skin: 'deep' },
    team: [
      ['brineclaw', 33],
      ['jellivolt', 34],
      ['urchivolt', 34],
    ],
    prize: 1020,
    hello: 'Forty wrecks on these shoals. I have dived every one. Let us battle!',
    beaten: 'You would make a good diver.',
    after: 'Since the Stormspire lamp went up, no ship has wrecked here. Odessa is proud of that.',
  },
  'climber-hedda': {
    name: 'Climber Hedda',
    x: 72,
    y: 177,
    facing: 'right',
    look: { outfit: 'orange', hair: 'brown', skin: 'tan' },
    team: [
      ['frostcairn', 35],
      ['rimestoat', 36],
      ['floemaw', 36],
    ],
    prize: 1080,
    hello: 'The Glacier Steps are slippery, but I never fall. Can you say the same?',
    beaten: 'Fine, I fell. Once.',
    after: 'From the top step you can see the White Crown. It used to glow at night.',
  },
  'ace-runa': {
    name: 'Ace Runa',
    x: 112,
    y: 179,
    facing: 'up',
    look: { outfit: 'white', hair: 'grey', skin: 'deep' },
    team: [
      ['squallwing', 39],
      ['lumenaw', 39],
      ['floemaw', 40],
    ],
    prize: 1200,
    hello: 'You climbed the White Crown. Now get past the best trainer in Rimeholm.',
    beaten: 'The Crown is yours to climb.',
    after:
      'Glacivar sleeps under the Crown. Ice and lightning, and both fear the earth. Toss it up with Wind, then slam it down with Earth.',
  },
};

function trainerOf(t: RouteTrainer): TrainerInput {
  return {
    name: t.name,
    teams: [{ team: t.team.map(([species, level]) => ({ species: sp(species), level })) }],
    prize: t.prize,
  };
}

function dialogueOf(id: string, t: RouteTrainer): DialogueInput {
  return {
    start: 'hello',
    nodes: {
      hello: { branch: [{ if: { beat: r(id) }, goto: 'after' }], goto: 'challenge' },
      challenge: { say: [t.hello], battle: { trainer: r(id) }, win: 'won' },
      won: { say: [t.beaten] },
      after: { say: [t.after] },
    },
  };
}

function npcOf(id: string, t: RouteTrainer): NpcInput {
  return {
    name: t.name,
    map: MAP,
    x: t.x,
    y: t.y,
    facing: t.facing,
    look: t.look,
    dialogue: r(id),
  };
}

/** A boss waiting at its lair: face it, then rematches once it is beaten. */
function bossDialogue(
  boss: string,
  intro: string,
  beaten: string,
  back: string,
  vision: readonly string[] = [],
): DialogueInput {
  return {
    start: 'hello',
    nodes: {
      hello: { branch: [{ if: { boss: r(boss) }, goto: 'back' }], goto: 'first' },
      first: {
        say: [intro],
        choices: [{ text: 'Face it', goto: 'fight' }, { text: 'Step back' }],
      },
      fight: { battle: { boss: r(boss) }, win: 'after' },
      after: {
        ...(vision.length ? { say: [...vision], narration: true } : {}),
        branch: [{ if: { boss: r(boss), caught: true }, goto: 'caught' }],
        goto: 'beaten',
      },
      caught: { say: ['All is quiet now.'] },
      beaten: { say: [beaten] },
      back: { say: [back], choices: [{ text: 'Face it', goto: 'rematch' }, { text: 'Step back' }] },
      rematch: { battle: { boss: r(boss) }, win: 'beaten' },
    },
  };
}

const BOSSES = {
  'floemaw-titan': {
    name: 'Floemaw Titan',
    anchor: 'titan-tusk-rookery',
    species: 'floemaw',
    dialogue: bossDialogue(
      'floemaw-titan',
      'A snowbank snorts and rolls over. Tusks as long as oars! It is a Titan Floemaw!',
      'The Floemaw Titan slides back under the snow. It will be back.',
      'The rookery rumbles. The Floemaw Titan is ready for another fight.',
      [
        'As the Floemaw settles, the frost on its tusks shows you a picture…',
        'A lighthouse on a sea stack, far to the east. The winter lights pour down out of the sky into its lamp.',
      ],
    ),
  },
  'squallwing-titan': {
    name: 'Squallwing Titan',
    anchor: 'titan-thunder-eyrie',
    species: 'squallwing',
    dialogue: bossDialogue(
      'squallwing-titan',
      'Lightning lights up the storm-glass, and a great shape spreads its wings. The Squallwing Titan!',
      'The Squallwing Titan folds its wings and rides the storm away. For now.',
      'Thunder rolls over the eyrie. The Squallwing Titan wants a rematch.',
      [
        'The crackle of its feathers fills your head with a memory…',
        'Green and gold ribbons of light, pulled down from the sky and wound into a lamp. Under it, the sea churns into sleet.',
      ],
    ),
  },
  glacivar: {
    name: 'Glacivar',
    anchor: 'legendary',
    species: 'glacivar',
    dialogue: bossDialogue(
      'glacivar',
      'The sky over the White Crown flickers green. Glacivar rises from the ice and looks at you.',
      'Glacivar sinks back into the Crown. It will return.',
      'The lights dance over the Crown Shrine. Glacivar has returned.',
    ),
  },
} as const;

export const trainers: Record<string, TrainerInput> = Object.fromEntries(
  Object.entries(ROUTE_TRAINERS).map(([id, t]) => [id, trainerOf(t)]),
);

export const trainerDialogues: Record<string, DialogueInput> = {
  ...Object.fromEntries(Object.entries(ROUTE_TRAINERS).map(([id, t]) => [id, dialogueOf(id, t)])),
  ...Object.fromEntries(Object.entries(BOSSES).map(([id, b]) => [`${id}-lair`, b.dialogue])),
};

export const trainerNpcs: Record<string, NpcInput> = {
  ...Object.fromEntries(Object.entries(ROUTE_TRAINERS).map(([id, t]) => [id, npcOf(id, t)])),
  ...Object.fromEntries(
    Object.entries(BOSSES).map(([id, b]) => [
      `${id}-lair`,
      {
        name: b.name,
        map: MAP,
        anchor: b.anchor,
        zorling: r(b.species),
        // Glacivar only wakes once the lights are back in the sky (Odessa beaten at the Stormspire).
        when:
          id === 'glacivar'
            ? {
                all: [
                  { beat: 'rimeholm:lampwright-odessa' },
                  { not: { boss: r(id), caught: true } },
                ],
              }
            : { not: { boss: r(id), caught: true } },
        dialogue: r(`${id}-lair`),
      } satisfies NpcInput,
    ]),
  ),
};
