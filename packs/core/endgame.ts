/**
 * The cross-region endgame (C36). Every region pack owns a **danger zone** (Lv 45–60) in a
 * strip its map grew by; core holds what ties them together.
 *
 * - **Beyond the Map** (quest): once the player holds 3 badges, a Guild Surveyor turns up in
 *   every region's hub town. Each danger zone ends at a heart guarded by a Keeper; beating
 *   one adds 1 to `core:hearts-charted`. Three hearts, and Rival Mira waits at Thornveil Camp
 *   (Verdale's zone) for the finale. Badges and hearts are counted as numbers, so a future
 *   region's zone counts too.
 * - `dangerZone(spec)` builds a zone's people from a region pack's spec: the ranger who
 *   blocks the way in until 3 badges, the camp scout, the Surveyor in the hub, ace trainers,
 *   the Keeper, the region's two Elder Titans and hidden items.
 * - **Elder Titans** are the region's Titans again, at endgame level and with their own aura
 *   (a boss of their own with the Titan's species, signature move and Armor), fought as a
 *   one-boss "trainer": boss form, faints, never caught, so the one-per-save rule holds. They
 *   appear once the player has beaten or caught that Titan.
 */

import type { BossInput, DialogueInput, NpcInput, QuestInput, TrainerInput } from '@game/data';
import type { Facing } from '@game/data/maps';
import { STARTER_FLAGS } from './starts';

type Look = NonNullable<NpcInput['look']>;
const c = (local: string): string => `core:${local}`;

/** Hearts charted: each Keeper beaten adds 1. */
export const HEARTS = c('hearts-charted');
/** Hearts needed before the finale. */
export const HEARTS_NEEDED = 3;
/** Badges needed to enter a danger zone. */
export const ZONE_BADGES = 3;
const QUEST = c('beyond-the-map');
const MIRA = c('mira-finale');

// ------------------------------------------------------------------ zone builder

/** A trainer standing in a danger zone. */
export interface ZoneTrainer {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly facing: Facing;
  readonly look: Look;
  /** `[species id, level]`, lead first. */
  readonly team: readonly (readonly [string, number])[];
  readonly prize: number;
  readonly hello: string;
  readonly beaten: string;
  readonly after: string;
}

/** One of the region's Titans, again, at endgame level. */
export interface ElderTitan {
  readonly name: string;
  /** Map anchor of its lair. */
  readonly anchor: string;
  /** The region's Titan (its boss id): it wakes once that one is beaten or caught. */
  readonly titan: string;
  /** That Titan's boss data: the Elder keeps its species, signature move and Armor. */
  readonly from: BossInput;
  /** Its own aura (max HP multiplier), tuned for endgame teams. */
  readonly aura: number;
  readonly level: number;
  readonly prize: number;
  readonly intro: string;
  readonly beaten: string;
  readonly back: string;
}

export interface HiddenItem {
  readonly anchor: string;
  readonly item: string;
  readonly count: number;
  readonly where: string;
}

interface Spot {
  readonly x: number;
  readonly y: number;
  readonly facing: Facing;
}

export interface DangerZoneSpec {
  /** Pack id, for the ids of everything made here. */
  readonly ns: string;
  readonly map: string;
  /** The zone's name ("Thornveil"). */
  readonly name: string;
  /** Where the zone lies, said by the Surveyor ("north of the Heartwood Shrine"). */
  readonly where: string;
  /** The ranger stands in the only gap into the zone. */
  readonly ranger: Spot & { readonly name: string; readonly look: Look };
  readonly surveyor: Spot;
  readonly scout: Spot & {
    readonly name: string;
    readonly look: Look;
    readonly lines: readonly string[];
  };
  readonly aces: Readonly<Record<string, ZoneTrainer>>;
  readonly keeper: ZoneTrainer & { readonly id: string };
  readonly elders: Readonly<Record<string, ElderTitan>>;
  readonly hidden: Readonly<Record<string, HiddenItem>>;
}

export interface ZoneContent {
  readonly bosses: Record<string, BossInput>;
  readonly trainers: Record<string, TrainerInput>;
  readonly dialogues: Record<string, DialogueInput>;
  readonly npcs: Record<string, NpcInput>;
}

const BAG_FULL = 5;

const trainerOf = (t: ZoneTrainer): TrainerInput => ({
  name: t.name,
  teams: [{ team: t.team.map(([species, level]) => ({ species, level })) }],
  prize: t.prize,
});

const personOf = (map: string, t: Spot & { name: string; look: Look }): NpcInput => ({
  name: t.name,
  map,
  x: t.x,
  y: t.y,
  facing: t.facing,
  look: t.look,
});

/** Everything a region's danger zone needs, from its spec. */
export function dangerZone(z: DangerZoneSpec): ZoneContent {
  const id = (local: string): string => `${z.ns}:${local}`;
  const bosses: Record<string, BossInput> = {};
  const trainers: Record<string, TrainerInput> = {};
  const dialogues: Record<string, DialogueInput> = {};
  const npcs: Record<string, NpcInput> = {};

  for (const [k, t] of Object.entries(z.aces)) {
    trainers[k] = trainerOf(t);
    dialogues[k] = {
      start: 'hello',
      nodes: {
        hello: { branch: [{ if: { beat: id(k) }, goto: 'after' }], goto: 'challenge' },
        challenge: { say: [t.hello], battle: { trainer: id(k) }, win: 'won' },
        won: { say: [t.beaten] },
        after: { say: [t.after] },
      },
    };
    npcs[k] = { ...personOf(z.map, t), dialogue: id(k) };
  }

  const k = z.keeper;
  trainers[k.id] = trainerOf(k);
  dialogues[k.id] = {
    start: 'hello',
    nodes: {
      hello: { branch: [{ if: { beat: id(k.id) }, goto: 'after' }], goto: 'challenge' },
      challenge: { say: [k.hello], battle: { trainer: id(k.id) }, win: 'won' },
      won: {
        do: [{ add: HEARTS }],
        say: [k.beaten, `The heart of the ${z.name} is charted.`],
      },
      after: { say: [k.after] },
    },
  };
  npcs[k.id] = { ...personOf(z.map, k), dialogue: id(k.id) };

  for (const [e, t] of Object.entries(z.elders)) {
    const { rematch: _, ...titan } = t.from;
    bosses[e] = { ...titan, name: t.name, level: t.level, hpMultiplier: t.aura };
    trainers[e] = {
      name: t.name,
      teams: [{ team: [{ species: t.from.species, level: t.level, boss: id(e) }] }],
      prize: t.prize,
      rematch: { levels: 4, prize: Math.round(t.prize / 2) },
    };
    dialogues[e] = {
      start: 'hello',
      nodes: {
        hello: { branch: [{ if: { beat: id(e) }, goto: 'back' }], goto: 'first' },
        first: {
          say: [t.intro],
          choices: [{ text: 'Face it', goto: 'fight' }, { text: 'Step back' }],
        },
        fight: { battle: { trainer: id(e) }, win: 'beaten' },
        beaten: { say: [t.beaten] },
        back: {
          say: [t.back],
          choices: [{ text: 'Face it', goto: 'fight' }, { text: 'Step back' }],
        },
      },
    };
    npcs[e] = {
      name: t.name,
      map: z.map,
      anchor: t.anchor,
      zorling: t.from.species,
      // It wakes once the player has beaten or caught that Titan in its old lair.
      when: { boss: t.titan },
      dialogue: id(e),
    };
  }

  for (const [h, item] of Object.entries(z.hidden)) {
    const take: DialogueInput['nodes'][string] = {
      say: [`Something is tucked away ${item.where}…`],
      do: [{ give: item.item, count: item.count }, { set: id(h) }],
    };
    dialogues[h] = {
      start: 'hello',
      nodes:
        item.item === 'core:zorb'
          ? { hello: take }
          : {
              hello: {
                branch: [{ if: { has: item.item, count: BAG_FULL }, goto: 'full' }],
                goto: 'take',
              },
              take,
              full: {
                say: [`Something is tucked away ${item.where}, but your bag has no room for it.`],
              },
            },
    };
    npcs[h] = {
      name: 'Hidden item',
      map: z.map,
      anchor: item.anchor,
      object: 'item',
      when: { not: { flag: id(h) } },
      dialogue: id(h),
    };
  }

  npcs['gate-ranger'] = {
    ...personOf(z.map, z.ranger),
    behavior: { kind: 'stand' },
    when: { not: { badges: ZONE_BADGES } },
    lines: [
      `Past me lies the ${z.name}: wild country no map covers, and Zorlings stronger than any in the regions.`,
      `Only trainers who hold ${ZONE_BADGES} badges may go on. Come back when you do.`,
    ],
  };
  npcs['zone-scout'] = { ...personOf(z.map, z.scout), lines: [...z.scout.lines] };
  npcs['surveyor'] = {
    name: 'Guild Surveyor',
    map: z.map,
    x: z.surveyor.x,
    y: z.surveyor.y,
    facing: z.surveyor.facing,
    look: SURVEYOR_LOOK,
    when: { badges: ZONE_BADGES },
    dialogue: c('surveyor'),
  };
  return { bosses, trainers, dialogues, npcs };
}

const SURVEYOR_LOOK: Look = { outfit: 'forest', hair: 'grey', skin: 'warm' };

// ------------------------------------------------------------------ the meta-quest

export const endgameQuests: Record<string, QuestInput> = {
  'beyond-the-map': {
    name: 'Beyond the Map',
    from: 'Guild Surveyor',
    summary:
      'Zoravia’s regions are charted. What lies past their edges is not. The Explorers’ Guild wants the wild hearts beyond them charted.',
    steps: [
      {
        id: 'first-heart',
        text: 'Reach the heart of a danger zone past a region’s edge. Beat its Keeper.',
        done: { flag: HEARTS, atLeast: 1 },
      },
      {
        id: 'second-heart',
        text: 'One heart charted. Chart a second one.',
        done: { flag: HEARTS, atLeast: 2 },
      },
      {
        id: 'third-heart',
        text: 'Two hearts charted. Chart a third one.',
        done: { flag: HEARTS, atLeast: HEARTS_NEEDED },
      },
      {
        id: 'mira',
        text: 'Mira waits at Thornveil Camp, north of Verdale’s Heartwood Shrine.',
        done: { beat: MIRA },
      },
    ],
    reward: { money: 10000, items: { 'core:max-potion': 3 } },
  },
};

const surveyorDialogue: DialogueInput = {
  start: 'hello',
  nodes: {
    hello: {
      branch: [
        { if: { quest: QUEST, is: 'done' }, goto: 'done' },
        {
          if: {
            all: [
              { quest: QUEST, is: 'active' },
              { flag: HEARTS, atLeast: HEARTS_NEEDED },
            ],
          },
          goto: 'mira',
        },
        { if: { quest: QUEST, is: 'active' }, goto: 'active' },
      ],
      goto: 'offer',
    },
    offer: {
      say: [
        'Three badges! The Explorers’ Guild sent me to find trainers like you.',
        'Zoravia’s regions are charted, every town and trail. What lies past their edges is not.',
        'Beyond each region there is wild country, with Zorlings stronger than any you have met. At the heart of each lies something old, and a Keeper guards it.',
        'Chart three of those hearts for the Guild. The rangers at the edges will let you pass now.',
      ],
      do: [{ start: QUEST }],
    },
    active: {
      say: [
        'Every region has a way out past its edge, and a ranger keeps it. Beat the Keeper at the heart of the wild country beyond.',
      ],
    },
    mira: {
      say: [
        'Three hearts! Someone else has been charting too. A girl named Mira asked for you, at Thornveil Camp in Verdale.',
      ],
    },
    done: {
      say: ['The Guild’s new maps have your name on them. Zoravia is bigger than anyone thought.'],
    },
  },
};

// ------------------------------------------------------------------ Mira's finale

/** Her ace: the Verdale line that beats the player's starter (C33/C34 rule). */
const ACE = 'core:infernyx';
const counters: { flag: string; species: string }[] = [
  { flag: STARTER_FLAGS.drizzlet, species: c('thornmane') },
  { flag: STARTER_FLAGS.emberkit, species: c('tidefang') },
  // Other regions' starters, by flag only (core depends on no region pack).
  { flag: 'emberwaste:starter-sizzlet', species: c('tidefang') },
  { flag: 'emberwaste:starter-pebbit', species: c('tidefang') },
  { flag: 'rimeholm:starter-selkit', species: c('thornmane') },
  { flag: 'rimeholm:starter-woolump', species: c('thornmane') },
  // Against Electric no Verdale starter line wins: she brings the Earth of a Mossback.
  { flag: 'rimeholm:starter-sparkit', species: c('mossback') },
];

export const endgameTrainers: Record<string, TrainerInput> = {
  'mira-finale': {
    name: 'Rival Mira',
    teams: [
      {
        team: [
          { species: c('galehawk'), level: 62 },
          { species: c('ironshell'), level: 62 },
          {
            species: ACE,
            level: 64,
            instead: counters.map((x) => ({ if: { flag: x.flag }, species: x.species })),
          },
        ],
      },
    ],
    prize: 6000,
    rematch: { levels: 0, prize: 2000 },
  },
};

const miraDialogue: DialogueInput = {
  start: 'hello',
  nodes: {
    hello: { branch: [{ if: { beat: MIRA }, goto: 'after' }], goto: 'challenge' },
    challenge: {
      say: [
        'There you are! The Guild told me you charted three hearts. So did I. Well, two and a half.',
        'We started on the same road in Willowmere. Every region since, you were one step ahead.',
        'Out here there are no badges and no level caps to hide behind. Just us. One last battle, for real this time!',
      ],
      battle: { trainer: MIRA },
      win: 'won',
    },
    won: {
      say: [
        'Ha… I knew it. I knew it the whole way.',
        'Go tell the Surveyor. Zoravia has a new best trainer, and I have a new reason to train.',
      ],
    },
    after: {
      say: ['Again? Fine, but only because I like losing to you less every time.'],
      choices: [{ text: 'Battle', goto: 'rematch' }, { text: 'Later' }],
    },
    rematch: { battle: { trainer: MIRA }, win: 'won-again' },
    'won-again': { say: ['Still you. Next time, though.'] },
  },
};

export const endgameDialogues: Record<string, DialogueInput> = {
  surveyor: surveyorDialogue,
  'mira-finale': miraDialogue,
};

/** Mira waits at Thornveil Camp once three hearts are charted (C36). */
export const endgameNpcs: Record<string, NpcInput> = {
  'mira-finale': {
    name: 'Rival Mira',
    map: c('verdale'),
    x: 102,
    y: 64,
    facing: 'left',
    look: { outfit: 'purple', hair: 'red', skin: 'light' },
    when: { flag: HEARTS, atLeast: HEARTS_NEEDED },
    dialogue: MIRA,
  },
};
