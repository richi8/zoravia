/**
 * Emberwaste (C34): route trainers, and the encounters with its two Titans and its legendary.
 * Each trainer stands at the roadside of a zone, with a team inside that zone's level band (the
 * stage a wild Zorling has at that level) and a one-time prize (about 30 coins per level of
 * their strongest Zorling). Talking to one starts the battle; once beaten they only chat.
 *
 * The Dunewyrm Titan waits at the Sunken Sands in the Cinder Dunes, the Forgeback Titan at the
 * Old Foundry in Rust Canyon, and Calderon at the Ember Heart above the caldera. Each is a
 * Zorling NPC that leaves once caught and offers a rematch once beaten. Beaten, each Titan
 * shows a vision of the iron lids on the caldera vents; Calderon only appears once Glassmaker
 * Gorran is beaten at the Cap Works.
 */

import type { DialogueInput, NpcInput, TrainerInput } from '@game/data';
import type { Facing } from '@game/data/maps';

const MAP = 'emberwaste:emberwaste';
const e = (local: string): string => `emberwaste:${local}`;
/** Species ids: Emberwaste's own, or `core:` ones written in full. */
const sp = (id: string): string => (id.includes(':') ? id : e(id));

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
  'prospector-ruby': {
    name: 'Prospector Ruby',
    x: 100,
    y: 144,
    facing: 'left',
    look: { outfit: 'orange', hair: 'red', skin: 'warm' },
    team: [
      ['cindermite', 5],
      ['sandskink', 6],
    ],
    prize: 180,
    hello: 'Found anything shiny out here? No? Then battle me instead!',
    beaten: 'Hah! You dig deep.',
    after: 'Sandskinks love shiny things. Leave a coin out and watch the sand wiggle.',
  },
  'water-carrier-ilo': {
    name: 'Water-carrier Ilo',
    x: 82,
    y: 115,
    facing: 'right',
    look: { outfit: 'sky', hair: 'dark', skin: 'deep' },
    team: [
      ['oasip', 7],
      ['rivetling', 8],
    ],
    prize: 240,
    hello: 'Careful, these jugs are full! Let me set them down. Now, a battle!',
    beaten: 'Not a drop spilled. Well fought.',
    after: 'Oasips live in the old wells. Follow one and you never go thirsty.',
  },
  'trailblazer-cass': {
    name: 'Trailblazer Cass',
    x: 102,
    y: 92,
    facing: 'left',
    look: { outfit: 'maroon', hair: 'blonde', skin: 'light' },
    team: [
      ['cindermite', 10],
      ['sandskink', 10],
      ['rivetling', 11],
    ],
    prize: 330,
    hello: 'The Redrock Trail is steep. Show me you can make the climb!',
    beaten: 'Strong legs, strong team.',
    after: 'Kilnreach is just up the trail. Its forges used to glow all night.',
  },
  // T2
  'dune-rider-zeph': {
    name: 'Dune Rider Zeph',
    x: 52,
    y: 132,
    facing: 'right',
    look: { outfit: 'mustard', hair: 'dark', skin: 'tan' },
    team: [
      ['sandskink', 17],
      ['tumblet', 17],
      ['pyrebeetle', 18],
    ],
    prize: 540,
    hello: 'The ash storm is blowing. Everything burns out here. Ready?',
    beaten: 'You ride the storm well.',
    after: 'In the storm everyone burns. A splash of water then hits like a geyser!',
  },
  'glassblower-opal': {
    name: 'Glassblower Opal',
    x: 98,
    y: 44,
    facing: 'right',
    look: { outfit: 'white', hair: 'blonde', skin: 'warm' },
    team: [
      ['voltsting', 18],
      ['oasip', 18],
      ['rivetling', 19],
    ],
    prize: 570,
    hello: 'Mind the glass! The flats crack underfoot. Let us battle on the solid bits.',
    beaten: 'Shattered. Beautifully.',
    after: 'Voltstings crackle before a storm. The whole flat hums when it is coming.',
  },
  'miner-tobin': {
    name: 'Miner Tobin',
    x: 141,
    y: 153,
    facing: 'up',
    look: { outfit: 'navy', hair: 'brown', skin: 'deep' },
    team: [
      ['rivetling', 18],
      ['core:ironshell', 19],
      ['ironjaw', 20],
    ],
    prize: 600,
    hello: 'Nobody digs in Rust Canyon without getting past me first!',
    beaten: 'You hit like a pickaxe.',
    after: 'The Old Foundry is just south. Something big sleeps in the slag heaps.',
  },
  'firewatcher-rook': {
    name: 'Firewatcher Rook',
    x: 60,
    y: 52,
    facing: 'right',
    look: { outfit: 'red', hair: 'grey', skin: 'tan' },
    team: [
      ['pyrebeetle', 21],
      ['core:hearthog', 22],
    ],
    prize: 660,
    hello: 'I watch the slopes for fires. You look like trouble. Let us find out.',
    beaten: 'No trouble at all. Just strong.',
    after: 'The ash storms came early this year. The vents up north have gone quiet.',
  },
  'nomad-kesh': {
    name: 'Nomad Kesh',
    x: 157,
    y: 88,
    facing: 'right',
    look: { outfit: 'purple', hair: 'dark', skin: 'warm' },
    team: [
      ['dunewyrm', 23],
      ['mirageel', 24],
      ['voltsting', 24],
    ],
    prize: 720,
    hello: 'I have crossed the basin a hundred times. Have you ever crossed a nomad?',
    beaten: 'The basin is yours to cross.',
    after: 'Mirageels shimmer over the hot sand. Most travelers think they are water.',
  },
  // T3
  'hermit-vale': {
    name: 'Hermit Vale',
    x: 20,
    y: 104,
    facing: 'up',
    look: { outfit: 'black', hair: 'grey', skin: 'light' },
    team: [
      ['shimmerfox', 33],
      ['dunewyrm', 34],
      ['mirageel', 34],
    ],
    prize: 1020,
    hello: 'Few come this far west. Fewer leave without a battle.',
    beaten: 'The glass remembers your name now.',
    after:
      'Calderon sleeps in the caldera. Fire and stone it is, and both fear water. Soak it, then freeze it solid.',
  },
  'climber-nash': {
    name: 'Climber Nash',
    x: 165,
    y: 66,
    facing: 'right',
    look: { outfit: 'forest', hair: 'red', skin: 'deep' },
    team: [
      ['ironjaw', 35],
      ['voltsting', 36],
      ['forgeback', 36],
    ],
    prize: 1080,
    hello: 'Ironspire is all iron and no handholds. Battle me while I catch my breath!',
    beaten: 'Strong grip. Strong team.',
    after: 'From up here you can see the Cap Works. Iron lids on every vent. Strange.',
  },
  'ace-sienna': {
    name: 'Ace Sienna',
    x: 154,
    y: 37,
    facing: 'left',
    look: { outfit: 'red', hair: 'blonde', skin: 'tan' },
    team: [
      ['pyrebeetle', 39],
      ['shimmerfox', 39],
      ['dunewyrm', 40],
    ],
    prize: 1200,
    hello: 'You climbed the caldera. Now get past the best trainer in Emberwaste.',
    beaten: 'You earned the view.',
    after: 'Gorran is just ahead at the Cap Works. He says he is saving Kilnreach.',
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
      hello: { branch: [{ if: { beat: e(id) }, goto: 'after' }], goto: 'challenge' },
      challenge: { say: [t.hello], battle: { trainer: e(id) }, win: 'won' },
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
    dialogue: e(id),
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
      hello: { branch: [{ if: { boss: e(boss) }, goto: 'back' }], goto: 'first' },
      first: {
        say: [intro],
        choices: [{ text: 'Face it', goto: 'fight' }, { text: 'Step back' }],
      },
      fight: { battle: { boss: e(boss) }, win: 'after' },
      after: {
        ...(vision.length ? { say: [...vision], narration: true } : {}),
        branch: [{ if: { boss: e(boss), caught: true }, goto: 'caught' }],
        goto: 'beaten',
      },
      caught: { say: ['All is quiet now.'] },
      beaten: { say: [beaten] },
      back: { say: [back], choices: [{ text: 'Face it', goto: 'rematch' }, { text: 'Step back' }] },
      rematch: { battle: { boss: e(boss) }, win: 'beaten' },
    },
  };
}

const BOSSES = {
  'dunewyrm-titan': {
    name: 'Dunewyrm Titan',
    anchor: 'titan-sunken-sands',
    species: 'dunewyrm',
    dialogue: bossDialogue(
      'dunewyrm-titan',
      'The sand heaves and a ridge of rock rises out of it. It is a Titan Dunewyrm!',
      'The Dunewyrm Titan sinks back into the sand. It will rise again.',
      'The sand shivers. The Dunewyrm Titan is ready for another fight.',
      [
        'As the Dunewyrm sinks, the sand shows you a picture…',
        'The caldera rim, far to the north. Iron lids sit on every vent, and pipes run from them to a great glass dome.',
      ],
    ),
  },
  'forgeback-titan': {
    name: 'Forgeback Titan',
    anchor: 'titan-old-foundry',
    species: 'forgeback',
    dialogue: bossDialogue(
      'forgeback-titan',
      'A slag heap stands up, glowing red through its iron plates. The Forgeback Titan!',
      'The Forgeback Titan settles into the slag. Its glow dims, for now.',
      'The Old Foundry glows again. The Forgeback Titan wants a rematch.',
      [
        'The heat of its plates fills your head with a memory…',
        'Fire that should rise up from the mountain is pushed sideways under the sand. Above it, someone is hammering lids onto the vents.',
      ],
    ),
  },
  calderon: {
    name: 'Calderon',
    anchor: 'legendary',
    species: 'calderon',
    dialogue: bossDialogue(
      'calderon',
      'The lava lake glows bright. Calderon climbs out of the Deep Ember and looks at you.',
      'Calderon sinks back into the glowing lake. It will return.',
      'The Ember Heart flares. Calderon has returned.',
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
        zorling: e(b.species),
        // Calderon only wakes once the vents are open again (Gorran beaten at the Cap Works).
        when:
          id === 'calderon'
            ? {
                all: [
                  { beat: 'emberwaste:glassmaker-gorran' },
                  { not: { boss: e(id), caught: true } },
                ],
              }
            : { not: { boss: e(id), caught: true } },
        dialogue: e(`${id}-lair`),
      } satisfies NpcInput,
    ]),
  ),
};
