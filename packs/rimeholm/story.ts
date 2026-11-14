/**
 * Region 3, the Rimeholm Isles: its campaign and lore (C35).
 *
 * **Lore.** Rimeholm lives by the **Crownlight**, the winter lights over the White Crown.
 * Glacivar, its keeper, sleeps under the Crown. Every **Long Night** it wakes the lights, and
 * their glow knits the sea ice between the islands, so the sea lies calm and frozen all winter.
 * The first islanders learned from the Zorlings that the sea does half the work ("soak, then
 * strike"), and Glimmerholm's **Tide Trial** still teaches it: in a sleet storm everything is
 * wet, and Ice freezes it or Electric runs right through it.
 *
 * **Main quest, "The Fading Lights".** This winter the lights are fading. The ice will not
 * knit, and the open sea churns into sleet storms over the fells. Elder Halvard (Brinewick)
 * sends the player to the Tide Trial. Tidemaster Sigrun says the Titans feel the lights;
 * beaten, each shows a vision of the lights pouring into a lighthouse. At the Stormspire on the
 * Shipwreck Shoals, Lampwright Odessa has pulled the lights into her lamp so no ship wrecks on
 * the shoals again (and without them the ice cannot hold). Beating her (the region boss: her
 * Lodestar Lumenaw fights in boss form) lets the lights go, and Glacivar rises at the Crown
 * Shrine. Beating or catching it, then telling Halvard, ends it.
 *
 * **Rival Mira** travels too. She meets the player on Brinewick's west road, in Glimmerholm
 * after the badge, and in Rimeport once both Titans are beaten. Her starter line beats the
 * player's, from the player's own region where this pack can name it: against a Rimeholm
 * starter the Rimeholm line that wins (Electric against Selkit, Water against Woolump, Earth
 * against Sparkit), against a Verdale one the Verdale line. Rimeholm does not depend on
 * Emberwaste, so against an Emberwaste starter she brings the Rimeholm line that wins (Water
 * against Sizzlet and Pebbit) or, against Pricklet, Verdale's Fire line (her default).
 *
 * **Side quests:** The Lost Mitten (Little Kari, catch a Flurret), The Netmaker's Lamp
 * (Netmaker Gro, catch a Glimfry), The Floe Garden (Old Sailor Bram and his sister Agnete on
 * the islet), Singing Ice (Ice-singer Liv, the Skerry Circle and a Jellivolt).
 *
 * **Signs and stones** are `sign` objects on the map's sign and standing-stone props.
 * **Hidden items** lie in the secrets and landmarks; each is taken once (a flag).
 */

import type {
  BadgeInput,
  DialogueInput,
  NpcInput,
  QuestInput,
  StoryCondition,
  TrainerInput,
} from '@game/data';
import { STARTER_FLAGS } from './starts';

type TrainerMemberInput = TrainerInput['teams'][number]['team'][number];

const MAP = 'rimeholm:rimeholm';
const r = (local: string): string => `rimeholm:${local}`;
const c = (local: string): string => `core:${local}`;

export const TIDE_BADGE = r('tide-badge');
const MAIN = r('fading-lights');
const PELL = r('deckhand-pell');
const SIGRUN = r('tidemaster-sigrun');
const ODESSA = r('lampwright-odessa');
const MIRA_1 = r('mira-brinewick');
const MIRA_2 = r('mira-glimmerholm');
const MIRA_3 = r('mira-rimeport');
const TITANS_DONE: StoryCondition = {
  all: [{ boss: r('floemaw-titan') }, { boss: r('squallwing-titan') }],
};

export const badges: Record<string, BadgeInput> = {
  'tide-badge': {
    name: 'Tide Badge',
    description:
      "Proof of passing Glimmerholm's Tide Trial: you let the sea do half the work. Raises the level cap.",
    type: 'core:water',
  },
};

// ------------------------------------------------------------------ trainers

/**
 * Rival Mira's ace at each stage of a line, for the lines she can field. The default (no
 * starter flag: old saves, checkpoints, Pricklet) is Verdale's Fire line.
 */
type Stage = 0 | 1 | 2;
const LINES = {
  water: ['selkit', 'selkurr', 'selkaris'],
  earth: ['woolump', 'shagtusk', 'tundramoth'],
  electric: ['sparkit', 'fluxine', 'auroryx'],
  coreFire: ['core:emberkit', 'core:blazekit', 'core:infernyx'],
  coreNature: ['core:sprigling', 'core:fernwick', 'core:thornmane'],
  coreWater: ['core:drizzlet', 'core:brooklet', 'core:tidefang'],
} as const;
const id = (s: string): string => (s.includes(':') ? s : r(s));
/**
 * Other regions' starter flags, written out: a pack does not import another pack's code, and
 * Rimeholm does not depend on Emberwaste (a flag is only a name, so this needs no dependency).
 */
const OTHER_STARTERS = {
  drizzlet: 'core:starter-drizzlet',
  emberkit: 'core:starter-emberkit',
  sizzlet: 'emberwaste:starter-sizzlet',
  pebbit: 'emberwaste:starter-pebbit',
} as const;

function miraAce(stage: Stage, level: number): TrainerMemberInput {
  const at = (line: keyof typeof LINES): string => id(LINES[line][stage]);
  return {
    species: at('coreFire'),
    level,
    instead: [
      { if: { flag: STARTER_FLAGS.selkit }, species: at('electric') },
      { if: { flag: STARTER_FLAGS.woolump }, species: at('water') },
      { if: { flag: STARTER_FLAGS.sparkit }, species: at('earth') },
      { if: { flag: OTHER_STARTERS.drizzlet }, species: at('coreNature') },
      { if: { flag: OTHER_STARTERS.emberkit }, species: at('coreWater') },
      { if: { flag: OTHER_STARTERS.sizzlet }, species: at('water') },
      { if: { flag: OTHER_STARTERS.pebbit }, species: at('water') },
    ],
  };
}

export const storyTrainers: Record<string, TrainerInput> = {
  'deckhand-pell': {
    name: 'Deckhand Pell',
    teams: [
      {
        team: [
          { species: r('pinchill'), level: 11 },
          { species: r('flurret'), level: 12 },
          { species: r('glimfry'), level: 12 },
        ],
      },
    ],
    prize: 360,
    rematch: { levels: 10, prize: 300 },
  },
  // Soak, then strike: Glimfry drenches the foe, Spinzap's shock runs through the wet.
  'tidemaster-sigrun': {
    name: 'Tidemaster Sigrun',
    teams: [
      {
        team: [
          { species: r('glimfry'), level: 12, moves: [c('drench'), c('splash-shot')] },
          { species: r('pinchill'), level: 13 },
          { species: r('spinzap'), level: 15, moves: [c('static-bite'), c('static-field')] },
        ],
      },
    ],
    prize: 1000,
    perBadge: 4,
    rematch: { levels: 12, prize: 800 },
  },
  'mira-brinewick': {
    name: 'Rival Mira',
    teams: [
      { team: [miraAce(0, 7), { species: r('flurret'), level: 6 }] },
      {
        // Met with a badge from another region (sandbox start): a stronger team.
        badges: 1,
        team: [
          miraAce(1, 17),
          { species: c('galehawk'), level: 18 },
          { species: r('jellivolt'), level: 16 },
        ],
      },
    ],
    prize: 300,
    perBadge: 4,
  },
  // She only shows up with the Tide Badge, so with one badge these are 4 levels higher.
  'mira-glimmerholm': {
    name: 'Rival Mira',
    teams: [
      {
        team: [
          miraAce(0, 11),
          { species: r('flurret'), level: 11 },
          { species: r('pinchill'), level: 10 },
        ],
      },
    ],
    prize: 700,
    perBadge: 4,
  },
  'mira-rimeport': {
    name: 'Rival Mira',
    teams: [
      {
        team: [
          { species: c('galehawk'), level: 24 },
          { species: r('brineclaw'), level: 24 },
          miraAce(1, 26),
        ],
      },
    ],
    prize: 1300,
    perBadge: 4,
  },
  // The region boss. With the Tide Badge: Lv 35, 36 and 37 (her Lodestar Lumenaw in boss form),
  // one below Vex and Gorran: at 36–38 the playthrough needed 4.9 tries (C35).
  'lampwright-odessa': {
    name: 'Lampwright Odessa',
    teams: [
      {
        team: [
          { species: r('urchivolt'), level: 31 },
          { species: r('jellivolt'), level: 32 },
          { species: r('lumenaw'), level: 33, boss: r('lodestar-lumenaw') },
        ],
      },
    ],
    prize: 2400,
    perBadge: 4,
    rematch: { levels: 8, prize: 1500 },
  },
};

// ------------------------------------------------------------------ quests

export const quests: Record<string, QuestInput> = {
  'fading-lights': {
    name: 'The Fading Lights',
    from: 'Elder Halvard',
    summary:
      'The winter lights over the White Crown are fading, the sea ice will not knit, and sleet storms churn the sea. Elder Halvard wants to know why.',
    steps: [
      {
        id: 'tide-trial',
        text: 'Earn the Tide Badge at the Tide Trial in Glimmerholm, east along the strand.',
        done: { badge: TIDE_BADGE },
      },
      {
        id: 'titans',
        text: 'Face the Titans: the Floemaw (Sleet Fells) and the Squallwing (Thunder Bluffs).',
        done: TITANS_DONE,
      },
      {
        id: 'stormspire',
        text: 'Find the lighthouse: the Stormspire, on the Shipwreck Shoals east of Rimeport.',
        done: { beat: ODESSA },
      },
      {
        id: 'crown-shrine',
        text: 'The lights are back in the sky. Climb to the Crown Shrine on the White Crown.',
        done: { boss: r('glacivar') },
      },
      {
        id: 'halvard',
        text: 'Tell Elder Halvard in Brinewick.',
        done: { flag: r('fading-lights-told') },
      },
    ],
    reward: { money: 3000, items: { 'core:max-potion': 2 } },
  },
  'lost-mitten': {
    name: 'The Lost Mitten',
    from: 'Little Kari',
    summary: 'A Flurret ran off with Kari’s red mitten. Kari wants the little thief caught.',
    steps: [
      {
        id: 'catch',
        text: 'Catch a Flurret. They dart through the snow on the Shingle Shore, south of town.',
        done: { caught: r('flurret') },
      },
      { id: 'tell', text: 'Show it to Little Kari.', done: { flag: r('mitten-told') } },
    ],
    reward: { money: 200, items: { 'core:potion': 2 } },
  },
  'netmakers-lamp': {
    name: 'The Netmaker’s Lamp',
    from: 'Netmaker Gro',
    summary:
      'The nights are so dark without the winter lights that Netmaker Gro cannot see to mend her nets. A Glimfry would make a fine little lamp.',
    steps: [
      {
        id: 'catch',
        text: 'Catch a Glimfry. They glow in the water along the Driftwood Strand.',
        done: { caught: r('glimfry') },
      },
      {
        id: 'tell',
        text: 'Show it to Netmaker Gro in Glimmerholm.',
        done: { flag: r('net-told') },
      },
    ],
    reward: { money: 600, items: { 'core:zorb': 5 } },
  },
  'floe-garden': {
    name: 'The Floe Garden',
    from: 'Old Sailor Bram',
    summary:
      'Bram’s sister Agnete went to live on an islet of ice flowers years ago, and he has not heard from her since. Is she well?',
    steps: [
      {
        id: 'find',
        text: 'Find Agnete on the islet east of the Sleet Fells. Hop across the ice floes.',
        done: { flag: r('floe-found') },
      },
      {
        id: 'tell',
        text: 'Tell Old Sailor Bram in Brinewick.',
        done: { flag: r('floe-told') },
      },
    ],
    reward: { money: 800, items: { 'core:super-potion': 2 } },
  },
  'singing-ice': {
    name: 'Singing Ice',
    from: 'Ice-singer Liv',
    summary:
      'On still nights the sea ice hums a tune, and nobody knows who sings it. Ice-singer Liv wants to find out.',
    steps: [
      {
        id: 'stones',
        text: 'Read the old stones of the Skerry Circle, at the south end of Hoarfrost Heath.',
        done: { flag: r('skerry-read') },
      },
      {
        id: 'catch',
        text: 'Catch the singer: a Jellivolt, in the Kelp Shallows or the Squall Reach.',
        done: { caught: r('jellivolt') },
      },
      {
        id: 'tell',
        text: 'Show it to Ice-singer Liv in Rimeport.',
        done: { flag: r('singing-told') },
      },
    ],
    reward: { money: 1500, items: { 'core:max-potion': 1 } },
  },
};

// ------------------------------------------------------------------ dialogues

/** A trainer who can be fought again once beaten: a choice, then the battle. */
function rematchNodes(trainer: string, ask: string, won: string): DialogueInput['nodes'] {
  return {
    rematch: {
      say: [ask],
      choices: [{ text: 'Battle', goto: 'fight-again' }, { text: 'Not now' }],
    },
    'fight-again': { battle: { trainer }, win: 'won-again' },
    'won-again': { say: [won] },
  };
}

/** A quest giver: ask, remind, report back, thank. */
function questGiver(
  quest: string,
  told: string,
  lines: {
    readonly ask: readonly string[];
    readonly yes: string;
    readonly yesThanks: string;
    readonly no: string;
    readonly remind: string;
    readonly report: readonly string[];
    readonly thanks: string;
  },
): DialogueInput {
  const q = r(quest);
  return {
    start: 'hello',
    nodes: {
      hello: {
        branch: [
          { if: { quest: q, is: 'done' }, goto: 'thanks' },
          { if: { quest: q, is: 'active', step: 'tell' }, goto: 'report' },
          { if: { quest: q, is: 'active' }, goto: 'remind' },
        ],
        goto: 'ask',
      },
      ask: {
        say: [...lines.ask],
        choices: [{ text: lines.yes, do: [{ start: q }], goto: 'yes' }, { text: lines.no }],
      },
      yes: { say: [lines.yesThanks] },
      remind: { say: [lines.remind] },
      report: { say: [...lines.report], do: [{ set: r(told) }] },
      thanks: { say: [lines.thanks] },
    },
  };
}

const step = (s: string): StoryCondition => ({ quest: MAIN, is: 'active', step: s });

const mainDialogues: Record<string, DialogueInput> = {
  'elder-halvard': {
    start: 'hello',
    nodes: {
      hello: {
        branch: [
          { if: { quest: MAIN, is: 'done' }, goto: 'thanks' },
          { if: step('halvard'), goto: 'report' },
          { if: step('tide-trial'), goto: 'remind-trial' },
          { if: step('titans'), goto: 'remind-titans' },
          { if: step('stormspire'), goto: 'remind-stormspire' },
          { if: step('crown-shrine'), goto: 'remind-crown' },
        ],
        goto: 'intro',
      },
      intro: {
        say: [
          'Welcome to Brinewick, traveler. Come in out of the wind. Have some fish soup.',
          'Every Long Night the Crownlight dances over the White Crown, and its glow knits the sea ice between our islands. All winter the sea lies calm.',
          'This winter the lights are fading. The ice will not knit, and the open sea churns into sleet storms over the fells.',
          'Go east to Glimmerholm and take the Tide Trial. Tidemaster Sigrun reads the sea better than anyone. Ask her about the lights.',
        ],
        do: [{ start: MAIN }],
      },
      'remind-trial': {
        say: ['Glimmerholm is east along the Driftwood Strand. Tidemaster Sigrun runs the trial.'],
      },
      'remind-titans': {
        say: [
          'The Titans feel the lights, they say. But a Titan does not talk. It fights. Wrap up warm.',
        ],
      },
      'remind-stormspire': {
        say: [
          'A lighthouse drinking the lights? That must be the Stormspire, on the shoals east of Rimeport. Ranger Knut in Rimeport knows the way.',
        ],
      },
      'remind-crown': {
        say: [
          'I saw green in the sky last night, for the first time this winter! Go to the Crown Shrine. Something is waking.',
        ],
      },
      report: {
        say: [
          'You met Glacivar itself? And the lights dance again. Listen: the ice is singing as it knits out there.',
          'Rimeholm owes you a great deal, friend. Take these, and come back for the Long Night feast.',
        ],
        do: [{ set: r('fading-lights-told') }],
      },
      thanks: { say: ['The ice is thick enough to skate on already. Thank you, friend.'] },
    },
  },
  'tidemaster-sigrun': {
    start: 'hello',
    nodes: {
      hello: {
        branch: [
          { if: { badge: TIDE_BADGE }, goto: 'after-badge' },
          { if: { beat: PELL }, goto: 'challenge' },
        ],
        goto: 'intro',
      },
      intro: {
        say: [
          'Welcome to the Tide Trial. I am Tidemaster Sigrun. The sea is rough this year, but the trial still stands.',
          'Beat my deckhand Pell by the well first, then come back to me.',
          'A sailor’s secret: soak, then strike. Drench a foe with Water, then hit it with Ice to freeze it, or Electric to run right through it. In a sleet storm, everything is already wet.',
        ],
      },
      challenge: {
        say: ['Pell let you through. Now show me how the sea does half the work!'],
        battle: { trainer: SIGRUN },
        win: 'won',
      },
      won: {
        say: [
          'Well sailed. You let the sea do half the work.',
          'The Tide Badge is yours. With it, your Zorlings can grow much stronger.',
        ],
        do: [{ badge: TIDE_BADGE }],
        branch: [{ if: { quest: MAIN, is: 'active' }, goto: 'lights' }],
      },
      lights: {
        say: [
          'Halvard sent you about the lights? Then ask the Titans. They live under the open sky, and they feel the lights the way we feel the cold.',
          'The Floemaw sleeps at the Tusk Rookery in the Sleet Fells, south of Brinewick. The Squallwing nests at the Thunder Eyrie, out on the Thunder Bluffs past Rimeport.',
          'Beat them, and they may show you what they have seen.',
        ],
      },
      'after-badge': {
        branch: [{ if: step('titans'), goto: 'titan-tips' }],
        goto: 'rematch',
      },
      'titan-tips': {
        say: [
          'The Titans’ hides turn aside plain hits. The fells’ sleet soaks the Floemaw: freeze it with Ice. Charge the Squallwing with Electric, then strike it with Metal.',
        ],
        goto: 'rematch',
      },
      ...rematchNodes(
        SIGRUN,
        'Back for another round on the pier?',
        'Soak, then strike, every time. Well done.',
      ),
    },
  },
  'deckhand-pell': {
    start: 'hello',
    nodes: {
      hello: {
        branch: [
          { if: { badge: TIDE_BADGE }, goto: 'rematch' },
          { if: { beat: PELL }, goto: 'after' },
        ],
        goto: 'challenge',
      },
      challenge: {
        say: ['Here for the Tide Trial? You have to get past me first!'],
        battle: { trainer: PELL },
        win: 'won',
      },
      won: { say: ['Man overboard! Go on, Tidemaster Sigrun is waiting at the pier.'] },
      after: { say: ['Tidemaster Sigrun is waiting at the pier. Good luck!'] },
      ...rematchNodes(
        PELL,
        'Practice round? I have been swabbing AND training!',
        'Overboard again.',
      ),
    },
  },
  'mira-brinewick': {
    start: 'hello',
    nodes: {
      hello: {
        say: [
          'Hey! I came all the way here to see the winter lights, and the sky is dark.',
          'Fine. A battle will warm me up. Your Zorling against mine!',
        ],
        battle: { trainer: MIRA_1 },
        win: 'won',
      },
      won: {
        say: [
          'Ugh, my fingers are too cold to give orders. Next time, I win! See you in Glimmerholm.',
        ],
      },
    },
  },
  'mira-glimmerholm': {
    start: 'hello',
    nodes: {
      hello: {
        say: ['The Tide Badge? Already? Fine. Beat me again and I will believe it.'],
        battle: { trainer: MIRA_2 },
        win: 'won',
      },
      won: {
        say: ['Soak, then strike, then I lose. I need to learn this sea thing.'],
      },
    },
  },
  'mira-rimeport': {
    start: 'hello',
    nodes: {
      hello: {
        say: [
          'You faced both Titans? I watched the Squallwing from the harbor. Through a telescope. A small one.',
          'There is a light out on the shoals that never goes out. Strange, right? But first: one more battle. A real one!',
        ],
        battle: { trainer: MIRA_3 },
        win: 'won',
      },
      won: {
        say: [
          'Okay. You win. Again. Go see what that light on the Stormspire is. I will keep the soup warm.',
        ],
      },
    },
  },
  'lampwright-odessa': {
    start: 'hello',
    nodes: {
      hello: { branch: [{ if: { beat: ODESSA }, goto: 'rematch' }], goto: 'intro' },
      intro: {
        say: [
          'A visitor! Shade your eyes, the lamp is very bright. Welcome to the Stormspire!',
          'For a hundred years ships wrecked on these shoals in the dark. So I built a lamp that never goes out, and filled it with the winter lights themselves. No ship has wrecked since!',
          'What do you mean, the ice will not knit without them? Nonsense. My Lodestar Lumenaw says so too. Lumenaw, show them!',
        ],
        battle: { trainer: ODESSA },
        win: 'won',
      },
      won: {
        say: [
          'The lights hold the ice together… and without the ice, the sea churns into sleet. Oh. Oh, no.',
          'Fine. I will let them go. I can burn whale oil, like every other lighthouse.',
          'Look up! The Crownlight is back. Something is stirring on the White Crown.',
        ],
      },
      ...rematchNodes(
        ODESSA,
        'I am testing a new lens. Help me test it?',
        'Back to plain oil. It is very cozy, really.',
      ),
    },
  },
  'herder-gunnar': {
    start: 'hello',
    nodes: {
      hello: {
        branch: [{ if: { boss: r('floemaw-titan') }, goto: 'done' }],
        goto: 'hint',
      },
      hint: {
        say: [
          'The Sleet Fells are ahead. In the sleet out there, everything is soaked, even the Titan at the Tusk Rookery.',
          'A soaked Floemaw and a breath of Ice: frozen solid, and its hide cracks. Bring Ice Zorlings.',
        ],
      },
      done: { say: ['You faced the Floemaw? My herd grazes the fells in peace again.'] },
    },
  },
  'storm-watcher-eira': {
    start: 'hello',
    nodes: {
      hello: {
        branch: [{ if: { boss: r('squallwing-titan') }, goto: 'done' }],
        goto: 'hint',
      },
      hint: {
        say: [
          'I count the lightning on the bluffs. Lately one bolt is always the same: the Squallwing Titan, at the Thunder Eyrie.',
          'Its feathers turn plain hits. Charge it up with Electric first, then strike with Metal, and the charge bursts right through.',
        ],
      },
      done: { say: ['The eyrie is quiet. Only ordinary lightning now. Lovely.'] },
    },
  },
  'ranger-knut': {
    start: 'hello',
    nodes: {
      hello: {
        branch: [
          { if: { beat: ODESSA }, goto: 'open' },
          { if: step('stormspire'), goto: 'climb' },
        ],
        goto: 'chat',
      },
      chat: {
        say: [
          'Rimeport keeps watch on the outer isles. Far north, the Brinewick pier has a ferry to Verdale.',
        ],
      },
      climb: {
        say: [
          'The Stormspire? Take the piers east past the Thunder Bluffs, out onto the Shipwreck Shoals.',
          'Odessa’s Lodestar Lumenaw is all water and stolen light. Muddy it with Earth, then tangle it with Nature, and it cannot shake loose.',
        ],
      },
      open: { say: ['The lights are back! You can see the ice knitting from the harbor.'] },
    },
  },
};

const sideDialogues: Record<string, DialogueInput> = {
  'little-kari': questGiver('lost-mitten', 'mitten-told', {
    ask: [
      'A Flurret stole my red mitten! It ran into the snow and was gone.',
      'They hide mittens in the drifts. Can you catch one? I want to see the thief up close.',
    ],
    yes: 'I’ll catch it',
    yesThanks: 'Yay! They dart through the snow on the Shingle Shore, south of town.',
    no: 'Maybe later',
    remind: 'Flurrets live on the Shingle Shore, south of town.',
    report: [
      'You caught one! Look at its little nose. It does not look sorry at all.',
      'Here, take these. Grandma is knitting me new mittens. On a string.',
    ],
    thanks: 'My new mittens are on a string now. The Flurrets can only stare.',
  }),
  'netmaker-gro': questGiver('netmakers-lamp', 'net-told', {
    ask: [
      'Without the winter lights the nights are pitch dark. I cannot see my own knots!',
      'A Glimfry glows like a little lamp. Will you catch me one?',
    ],
    yes: 'I’ll find one',
    yesThanks: 'Wonderful! They glow in the water along the Driftwood Strand, west of here.',
    no: 'Not now',
    remind: 'Glimfry glow along the Driftwood Strand. Look for the light in the water!',
    report: [
      'Look at it shine! I can see every knot.',
      'Here, a few Zorbs. Tied with my best knot.',
    ],
    thanks: 'My Glimfry lamp swims in a bucket by my chair. Best lamp I ever had.',
  }),
  'old-sailor-bram': questGiver('floe-garden', 'floe-told', {
    ask: [
      'My sister Agnete went to live on a little islet years ago. She grows flowers in the ice, she says.',
      'I am too old to hop the floes now. Will you see if she is well?',
    ],
    yes: 'I’ll find her',
    yesThanks:
      'Thank you! The islet is east of the Sleet Fells. A line of ice floes leads out to it.',
    no: 'Not now',
    remind: 'East of the Sleet Fells. Hop across the ice floes!',
    report: [
      'She is well? And still stubborn? Ha! That is my sister.',
      'Take these. I will row out there come spring, floes or no floes.',
    ],
    thanks: 'Agnete sent me an ice flower. It has not melted yet.',
  }),
  'ice-singer-liv': questGiver('singing-ice', 'singing-told', {
    ask: [
      'On still nights the sea ice hums. A tune, always the same one! I sing it back, but I do not know who sings it.',
      'The old stones of the Skerry Circle might say. Will you look into it?',
    ],
    yes: 'I’ll look',
    yesThanks: 'Thank you! The Skerry Circle stands at the south end of Hoarfrost Heath.',
    no: 'Not now',
    remind: 'Start at the Skerry Circle, at the south end of Hoarfrost Heath.',
    report: [
      'A Jellivolt! So the singing is its hum under the ice. I will have to write it down.',
      'Here, take this. Come sing with us some night. Bring your Jellivolt.',
    ],
    thanks: 'We sing with the Jellivolts every still night now. They hum in tune.',
  }),
  'hermit-agnete': {
    start: 'hello',
    nodes: {
      hello: { branch: [{ if: { flag: r('floe-found') }, goto: 'again' }], goto: 'first' },
      first: {
        say: [
          'Oh! Nobody hops the floes out here. Welcome to the Floe Garden.',
          'Yes, the flowers grow in the ice. Bram sent you? Tell him I am fine. And take these: visitors get a gift.',
        ],
        do: [{ set: r('floe-found') }, { give: 'core:zorb', count: 3 }],
      },
      again: {
        branch: [{ if: { beat: ODESSA }, goto: 'bright' }],
        goto: 'still',
      },
      still: { say: ['The flowers miss the winter lights. They grow so slowly in the dark.'] },
      bright: { say: ['The lights are back! The ice flowers are blooming green and gold.'] },
    },
  },
};

// ------------------------------------------------------------------ signs, stones and items

interface Sign {
  readonly x: number;
  readonly y: number;
  readonly name: string;
  readonly text: readonly string[];
}

const SIGNS: Record<string, Sign> = {
  'sign-brinewick-north': {
    x: 98,
    y: 21,
    name: 'Sign',
    text: ['North: the pier. The ferry to Verdale leaves from its far end.'],
  },
  'sign-brinewick-east': {
    x: 111,
    y: 35,
    name: 'Sign',
    text: ['East: the Driftwood Strand and Glimmerholm.'],
  },
  'sign-brinewick-west': {
    x: 87,
    y: 33,
    name: 'Sign',
    text: ['West: Hoarfrost Heath and the Skerry Circle.'],
  },
  'sign-brinewick-south': {
    x: 101,
    y: 47,
    name: 'Sign',
    text: ['South: over the piers to the Sleet Fells. Sleet storms ahead!'],
  },
  'sign-glimmerholm-north': {
    x: 162,
    y: 51,
    name: 'Sign',
    text: ['North: Seal Rock.'],
  },
  'sign-glimmerholm-east': {
    x: 172,
    y: 63,
    name: 'Sign',
    text: ['East: the Kelp Shallows.'],
  },
  'sign-glimmerholm-west': {
    x: 148,
    y: 61,
    name: 'Sign',
    text: ['West: the Driftwood Strand and Brinewick.'],
  },
  'sign-glimmerholm-south': {
    x: 161,
    y: 73,
    name: 'Sign',
    text: ['South: the Thunder Bluffs and Rimeport.'],
  },
  'sign-rimeport-north': {
    x: 152,
    y: 123,
    name: 'Sign',
    text: ['North: the Thunder Bluffs and Glimmerholm.'],
  },
  'sign-rimeport-east': {
    x: 159,
    y: 133,
    name: 'Sign',
    text: ['East: the Thunder Eyrie and the Stormspire. Strong teams only!'],
  },
  'sign-rimeport-west': {
    x: 140,
    y: 131,
    name: 'Sign',
    text: ['Rimeport. West: the piers to the Sleet Fells. South: Frostfen and the White Crown.'],
  },
  'stone-trial': {
    x: 157,
    y: 69,
    name: 'Trial stone',
    text: ['THE TIDE TRIAL', '“Soak, then strike. The sea does half the work.”'],
  },
};

/** Stones whose text depends on the story. */
const storySigns: Record<string, NpcInput> = {
  'stone-crown': {
    name: 'Crown stone',
    map: MAP,
    x: 96,
    y: 183,
    object: 'sign',
    dialogue: r('stone-crown'),
  },
  'stone-skerry': {
    name: 'Skerry stone',
    map: MAP,
    x: 31,
    y: 73,
    object: 'sign',
    dialogue: r('stone-skerry'),
  },
};

const stoneDialogues: Record<string, DialogueInput> = {
  'stone-crown': {
    start: 'hello',
    nodes: {
      hello: {
        say: ['“THE CROWN KEEPS THE LIGHTS. THE LIGHTS KEEP THE ICE.”'],
        branch: [{ if: { beat: ODESSA }, goto: 'bright' }],
        goto: 'dark',
      },
      dark: { say: ['The stone is dark and frosted over.'] },
      bright: { say: ['Green light flickers across the carving.'] },
    },
  },
  'stone-skerry': {
    start: 'hello',
    nodes: {
      hello: {
        say: [
          'The old stones are carved with waves, and one with a little bell.',
          '“Under the ice the lights sing. Hum back, and they come.”',
        ],
        do: [{ set: r('skerry-read') }],
      },
    },
  },
};

interface Hidden {
  readonly anchor: string;
  readonly item: string;
  readonly count: number;
  readonly where: string;
}

/** Hidden items: one each, in the secrets and at the landmarks. */
const HIDDEN: Record<string, Hidden> = {
  'item-frozen-wreck': {
    anchor: 'frozen-wreck',
    item: 'core:max-potion',
    count: 1,
    where: 'in a frozen sea chest',
  },
  'item-hot-spring': {
    anchor: 'hot-spring',
    item: 'core:max-potion',
    count: 1,
    where: 'under a warm stone by the water',
  },
  'item-skerry-circle': {
    anchor: 'skerry-circle',
    item: 'core:super-potion',
    count: 2,
    where: 'between the stones',
  },
  'item-whalebone-arch': {
    anchor: 'whalebone-arch',
    item: 'core:super-potion',
    count: 1,
    where: 'under the old whale ribs',
  },
  'item-seal-rock': {
    anchor: 'seal-rock',
    item: 'core:zorb',
    count: 5,
    where: 'in a crack in the rock',
  },
};

const BAG_FULL = 5;

function hiddenDialogue(hid: string, h: Hidden): DialogueInput {
  const take: DialogueInput['nodes'][string] = {
    say: [`Something is tucked away ${h.where}…`],
    do: [{ give: h.item, count: h.count }, { set: r(hid) }],
  };
  // Potions have a bag cap: leave the item where it is while the bag is full.
  const potion = h.item !== 'core:zorb';
  return {
    start: 'hello',
    nodes: potion
      ? {
          hello: {
            branch: [{ if: { has: h.item, count: BAG_FULL }, goto: 'full' }],
            goto: 'take',
          },
          take,
          full: {
            say: [`Something is tucked away ${h.where}, but your bag has no room for it.`],
          },
        }
      : { hello: take },
  };
}

// ------------------------------------------------------------------ people and objects

const MIRA_LOOK = { outfit: 'purple', hair: 'red', skin: 'light' } as const;

const storyNpcs: Record<string, NpcInput> = {
  'elder-halvard': {
    name: 'Elder Halvard',
    map: MAP,
    anchor: 'elder',
    look: { outfit: 'navy', hair: 'grey', skin: 'light' },
    behavior: { kind: 'look', every: [2.5, 5] },
    dialogue: r('elder-halvard'),
  },
  'little-kari': {
    name: 'Little Kari',
    map: MAP,
    x: 96,
    y: 40,
    look: { outfit: 'red', hair: 'blonde', skin: 'light' },
    behavior: { kind: 'wander', radius: 3 },
    dialogue: r('little-kari'),
  },
  'old-sailor-bram': {
    name: 'Old Sailor Bram',
    map: MAP,
    x: 101,
    y: 24,
    facing: 'left',
    look: { outfit: 'sky', hair: 'grey', skin: 'tan' },
    behavior: { kind: 'look' },
    dialogue: r('old-sailor-bram'),
  },
  'tidemaster-sigrun': {
    name: 'Tidemaster Sigrun',
    map: MAP,
    anchor: 'trial',
    look: { outfit: 'navy', hair: 'blonde', skin: 'tan' },
    dialogue: SIGRUN,
  },
  'deckhand-pell': {
    name: 'Deckhand Pell',
    map: MAP,
    x: 158,
    y: 66,
    facing: 'down',
    look: { outfit: 'sky', hair: 'brown', skin: 'warm' },
    dialogue: PELL,
  },
  'netmaker-gro': {
    name: 'Netmaker Gro',
    map: MAP,
    x: 152,
    y: 63,
    facing: 'up',
    look: { outfit: 'mustard', hair: 'grey', skin: 'deep' },
    behavior: { kind: 'look' },
    dialogue: r('netmaker-gro'),
  },
  'herder-gunnar': {
    name: 'Herder Gunnar',
    map: MAP,
    x: 98,
    y: 59,
    facing: 'right',
    look: { outfit: 'maroon', hair: 'grey', skin: 'light' },
    behavior: { kind: 'look' },
    dialogue: r('herder-gunnar'),
  },
  'storm-watcher-eira': {
    name: 'Storm-watcher Eira',
    map: MAP,
    x: 156,
    y: 118,
    facing: 'left',
    look: { outfit: 'purple', hair: 'dark', skin: 'tan' },
    behavior: { kind: 'look' },
    dialogue: r('storm-watcher-eira'),
  },
  'mira-brinewick': {
    name: 'Rival Mira',
    map: MAP,
    x: 86,
    y: 38,
    facing: 'right',
    look: MIRA_LOOK,
    when: { not: { beat: MIRA_1 } },
    dialogue: MIRA_1,
  },
  'mira-glimmerholm': {
    name: 'Rival Mira',
    map: MAP,
    x: 163,
    y: 70,
    facing: 'left',
    look: MIRA_LOOK,
    when: { all: [{ badge: TIDE_BADGE }, { not: { beat: MIRA_2 } }] },
    dialogue: MIRA_2,
  },
  'mira-rimeport': {
    name: 'Rival Mira',
    map: MAP,
    x: 148,
    y: 128,
    facing: 'right',
    look: MIRA_LOOK,
    when: { all: [{ badge: TIDE_BADGE }, TITANS_DONE, { not: { beat: MIRA_3 } }] },
    dialogue: MIRA_3,
  },
  'lampwright-odessa': {
    name: 'Lampwright Odessa',
    map: MAP,
    anchor: 'boss-stormspire',
    look: { outfit: 'mustard', hair: 'red', skin: 'warm' },
    behavior: { kind: 'look' },
    dialogue: ODESSA,
  },
  'ranger-knut': {
    name: 'Ranger Knut',
    map: MAP,
    anchor: 'ranger',
    look: { outfit: 'forest', hair: 'blonde', skin: 'light' },
    behavior: { kind: 'look' },
    dialogue: r('ranger-knut'),
  },
  'ice-singer-liv': {
    name: 'Ice-singer Liv',
    map: MAP,
    x: 146,
    y: 136,
    facing: 'right',
    look: { outfit: 'white', hair: 'dark', skin: 'deep' },
    behavior: { kind: 'look' },
    dialogue: r('ice-singer-liv'),
  },
  'hermit-agnete': {
    name: 'Agnete',
    map: MAP,
    anchor: 'floe-garden',
    look: { outfit: 'forest', hair: 'grey', skin: 'tan' },
    behavior: { kind: 'look' },
    dialogue: r('hermit-agnete'),
  },
};

export const storyNpcsAll: Record<string, NpcInput> = {
  ...storyNpcs,
  ...Object.fromEntries(
    Object.entries(SIGNS).map(([sid, s]) => [
      sid,
      {
        name: s.name,
        map: MAP,
        x: s.x,
        y: s.y,
        object: 'sign',
        lines: [...s.text],
      } satisfies NpcInput,
    ]),
  ),
  ...storySigns,
  ...Object.fromEntries(
    Object.entries(HIDDEN).map(([hid, h]) => [
      hid,
      {
        name: 'Hidden item',
        map: MAP,
        anchor: h.anchor,
        object: 'item',
        when: { not: { flag: r(hid) } },
        dialogue: r(hid),
      } satisfies NpcInput,
    ]),
  ),
};

export const storyDialogues: Record<string, DialogueInput> = {
  ...mainDialogues,
  ...sideDialogues,
  ...stoneDialogues,
  ...Object.fromEntries(Object.entries(HIDDEN).map(([hid, h]) => [hid, hiddenDialogue(hid, h)])),
};

/** Ids of the Rimeholm signs and stones that sit on a map prop (for tests). */
export const RIMEHOLM_SIGNS: readonly string[] = [
  ...Object.keys(SIGNS),
  ...Object.keys(storySigns),
];
