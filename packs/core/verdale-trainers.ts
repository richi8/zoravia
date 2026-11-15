/**
 * Region 1, Verdale (C29): route trainers, and the encounters with its two Titans and its
 * legendary. Each trainer stands at the roadside of a zone, with a team inside that zone's
 * level band and a one-time prize (about 30 coins per level of their strongest Zorling).
 * Talking to one starts the battle; once beaten they only chat.
 *
 * The Titans wait in their lairs (Mossback at the Hollow Oak in Deepwood, Bogmaw in the
 * Sunken Hollow of the Reed Marsh) and Verdion at the Heartwood Shrine in the Old Grove. Each
 * is a Zorling NPC that leaves once caught, and offers a rematch once beaten. Their hint
 * dialogue around Verdale comes with the campaign (C30): beaten, each Titan shows a vision of
 * Crown Rock, and Verdion only appears once Stormcatcher Vex is beaten there.
 */

import type { DialogueInput, NpcInput, TrainerInput } from '@game/data';
import type { Facing } from '@game/data/maps';

const MAP = 'core:verdale';

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

const ROUTE_TRAINERS: Record<string, RouteTrainer> = {
  // T1
  'picnicker-nell': {
    name: 'Picnicker Nell',
    x: 96,
    y: 228,
    facing: 'right',
    look: { outfit: 'red', hair: 'blonde', skin: 'light' },
    team: [
      ['pipwing', 5],
      ['sproutle', 6],
    ],
    prize: 180,
    hello: 'Oh, a new face! Want to see what my Zorlings learned today?',
    beaten: 'Aww. Time for a sandwich, then.',
    after: 'The meadow is the best place for a picnic. Pipwings beg for crumbs!',
  },
  'fisher-dot': {
    name: 'Fisher Dot',
    x: 71,
    y: 190,
    facing: 'down',
    look: { outfit: 'navy', hair: 'grey', skin: 'tan' },
    team: [
      ['puddlit', 7],
      ['mudpaddle', 8],
    ],
    prize: 240,
    hello: 'Nothing biting today. A battle will do instead!',
    beaten: 'You reeled me right in.',
    after: 'Mudpaddles blow bubbles in the shallows. Watch the water closely.',
  },
  'hiker-brann': {
    name: 'Hiker Brann',
    x: 99,
    y: 158,
    facing: 'right',
    look: { outfit: 'orange', hair: 'brown', skin: 'deep' },
    team: [
      ['hearthog', 10],
      ['puddlit', 10],
      ['mudpaddle', 11],
    ],
    prize: 300,
    hello: 'The trail to Fernhollow is long. Let me test your legs and your team!',
    beaten: 'Strong steps. You will make it.',
    after: 'Fernhollow is just up the road. Rest at the center there.',
  },
  // T2
  'marsh-guide-tess': {
    name: 'Marsh Guide Tess',
    x: 49,
    y: 202,
    facing: 'right',
    look: { outfit: 'forest', hair: 'red', skin: 'warm' },
    team: [
      ['puddlit', 18],
      ['mudpaddle', 18],
      ['hearthog', 19],
    ],
    prize: 570,
    hello: 'The marsh swallows the careless. Show me you are not one of them.',
    beaten: 'You keep your footing well.',
    after: 'Something huge sleeps in the Sunken Hollow, deep in the reeds. Bring a full team.',
  },
  'forager-juno': {
    name: 'Forager Juno',
    x: 100,
    y: 117,
    facing: 'right',
    look: { outfit: 'mustard', hair: 'dark', skin: 'tan' },
    team: [
      ['pipwing', 17],
      ['sproutle', 18],
      ['thornwing', 20],
    ],
    prize: 600,
    hello: 'You stepped on my mushrooms! Battle me to make up for it.',
    beaten: 'Fine, fine. They will grow back.',
    after: 'Sproutles grow into Thornwings. Then they fly off with my best berries.',
  },
  'scout-fen': {
    name: 'Scout Fen',
    x: 90,
    y: 258,
    facing: 'right',
    look: { outfit: 'sky', hair: 'brown', skin: 'light' },
    team: [
      ['ironshell', 18],
      ['hearthog', 19],
      ['thornwing', 20],
    ],
    prize: 600,
    hello: 'Halt! Every traveler in the thicket answers to a scout.',
    beaten: 'You may pass. With honors.',
    after: 'Ironshells hide in the brambles. Their shells ring when you tap them.',
  },
  'ranger-holt': {
    name: 'Ranger Holt',
    x: 63,
    y: 122,
    facing: 'right',
    look: { outfit: 'forest', hair: 'grey', skin: 'deep' },
    team: [
      ['sproutle', 21],
      ['thornwing', 23],
      ['mossback', 24],
    ],
    prize: 720,
    hello: 'Deepwood is no place to wander unprepared. Let me see your team.',
    beaten: 'You will do. Mind the Hollow Oak to the west.',
    after:
      'The Hollow Oak is not a tree. It is a Mossback older than this forest. Fire does well against bark.',
  },
  'birder-wren': {
    name: 'Birder Wren',
    x: 137,
    y: 152,
    facing: 'left',
    look: { outfit: 'white', hair: 'blonde', skin: 'warm' },
    team: [
      ['voltbat', 23],
      ['thornwing', 22],
      ['galehawk', 25],
    ],
    prize: 750,
    hello: 'Shh! You will scare the Galehawks. Unless... you battle me quietly?',
    beaten: 'Not quiet at all. But well fought.',
    after: 'Galehawks nest on the Downs. In spring the sky is full of them.',
  },
  // T3
  'mystic-sora': {
    name: 'Mystic Sora',
    x: 32,
    y: 149,
    facing: 'right',
    look: { outfit: 'purple', hair: 'dark', skin: 'light' },
    team: [
      ['rimewisp', 33],
      ['bogmaw', 34],
      ['torrentoad', 34],
    ],
    prize: 1020,
    hello: 'The mist told me you would come. It did not say who would win.',
    beaten: 'The mist was right to stay quiet.',
    after: 'Rimewisps ride the fog over Mistmere. They are colder than they look.',
  },
  'druid-ash': {
    name: 'Druid Ash',
    x: 102,
    y: 102,
    facing: 'left',
    look: { outfit: 'maroon', hair: 'grey', skin: 'tan' },
    team: [
      ['voltbat', 35],
      ['thornwing', 36],
      ['mossback', 36],
    ],
    prize: 1080,
    hello: 'The Heartwood Shrine lies ahead. Only those the grove trusts may go on.',
    beaten: 'The grove trusts you. So do I.',
    after:
      'Verdion dwells at the shrine. Charge it with Electric first, then strike with Metal. Its wind and leaves glance off iron.',
  },
  'ace-lyra': {
    name: 'Ace Lyra',
    x: 169,
    y: 135,
    facing: 'down',
    look: { outfit: 'black', hair: 'red', skin: 'warm' },
    team: [
      ['galehawk', 39],
      ['rimewisp', 39],
      ['ironshell', 40],
    ],
    prize: 1200,
    hello: 'Few climb this high. Fewer climb back down without losing to me.',
    beaten: 'Huh. You are the real thing.',
    after: 'Crown Rock is just ahead. Something stirs up there.',
  },
};

const c = (local: string): string => `core:${local}`;

function trainerOf(t: RouteTrainer): TrainerInput {
  return {
    name: t.name,
    teams: [{ team: t.team.map(([species, level]) => ({ species: c(species), level })) }],
    prize: t.prize,
  };
}

function dialogueOf(id: string, t: RouteTrainer): DialogueInput {
  return {
    start: 'hello',
    nodes: {
      hello: { branch: [{ if: { beat: c(id) }, goto: 'after' }], goto: 'challenge' },
      challenge: { say: [t.hello], battle: { trainer: c(id) }, win: 'won' },
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
    dialogue: c(id),
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
      hello: { branch: [{ if: { boss: c(boss) }, goto: 'back' }], goto: 'first' },
      first: {
        say: [intro],
        choices: [{ text: 'Face it', goto: 'fight' }, { text: 'Step back' }],
      },
      fight: { battle: { boss: c(boss) }, win: 'after' },
      after: {
        ...(vision.length ? { say: [...vision], narration: true } : {}),
        branch: [{ if: { boss: c(boss), caught: true }, goto: 'caught' }],
        goto: 'beaten',
      },
      caught: { say: ['All is quiet now.'] },
      beaten: { say: [beaten] },
      back: { say: [back], choices: [{ text: 'Face it', goto: 'rematch' }, { text: 'Step back' }] },
      rematch: { battle: { boss: c(boss) }, win: 'beaten' },
    },
  };
}

const BOSSES = {
  'mossback-titan': {
    anchor: 'titan-hollow-oak',
    species: 'mossback',
    dialogue: bossDialogue(
      'mossback-titan',
      'The old oak groans and opens its eyes. It is no tree: it is a Titan Mossback!',
      'The Mossback Titan sinks back into the earth. It will wake again.',
      'The Hollow Oak stirs. The Mossback Titan is ready for another fight.',
      [
        'As the Mossback settles, its rumble fills your head with a memory…',
        'A tall rock above the clouds, north of Galecrest. Ropes and sails spin on top, pulling in the wind.',
      ],
    ),
  },
  'bogmaw-titan': {
    anchor: 'titan-sunken-hollow',
    species: 'bogmaw',
    dialogue: bossDialogue(
      'bogmaw-titan',
      'Two huge eyes rise from the mud. The Bogmaw Titan blocks the way!',
      'The Bogmaw Titan slips back under the mud. It will be back.',
      'Bubbles rise from the hollow. The Bogmaw Titan wants a rematch.',
      [
        'In the bubbles on the mud you glimpse a picture…',
        'Great sails turning on a crown of rock, high on a ridge. The marsh reeds all lean toward it.',
      ],
    ),
  },
  verdion: {
    anchor: 'legendary',
    species: 'verdion',
    dialogue: bossDialogue(
      'verdion',
      'The leaves stop rustling. Verdion steps out of the Heartwood and watches you.',
      'Verdion fades into the wind. It will return.',
      'A green wind circles the shrine. Verdion has returned.',
    ),
  },
} as const;

export const verdaleTrainers: Record<string, TrainerInput> = Object.fromEntries(
  Object.entries(ROUTE_TRAINERS).map(([id, t]) => [id, trainerOf(t)]),
);

export const verdaleDialogues: Record<string, DialogueInput> = {
  ...Object.fromEntries(Object.entries(ROUTE_TRAINERS).map(([id, t]) => [id, dialogueOf(id, t)])),
  ...Object.fromEntries(Object.entries(BOSSES).map(([id, b]) => [`${id}-lair`, b.dialogue])),
};

export const verdaleTrainerNpcs: Record<string, NpcInput> = {
  ...Object.fromEntries(Object.entries(ROUTE_TRAINERS).map(([id, t]) => [id, npcOf(id, t)])),
  ...Object.fromEntries(
    Object.entries(BOSSES).map(([id, b]) => [
      `${id}-lair`,
      {
        name:
          id === 'verdion'
            ? 'Verdion'
            : `${b.species === 'mossback' ? 'Mossback' : 'Bogmaw'} Titan`,
        map: MAP,
        anchor: b.anchor,
        zorling: c(b.species),
        // Verdion only comes once the Seedwind blows again (C30: Vex beaten at Crown Rock).
        when:
          id === 'verdion'
            ? { all: [{ beat: 'core:stormcatcher-vex' }, { not: { boss: c(id), caught: true } }] }
            : { not: { boss: c(id), caught: true } },
        dialogue: c(`${id}-lair`),
      } satisfies NpcInput,
    ]),
  ),
};
