/**
 * Region 2, Emberwaste: its campaign and lore (C34).
 *
 * **Lore.** Emberwaste lives by the **Deep Ember**, the fire under Mount Caldus. Calderon, its
 * keeper, sleeps in the lava lake of the caldera. Every year at the **Kindling** the vents
 * breathe, the Ember's heat rises out of the mountain, and its glow lights the great forges
 * of Kilnreach. The first smiths learned from the Zorlings that fire and water work together
 * ("heat, then quench"), and Kilnreach's **Forge Trial** still teaches it: in an ash storm
 * everything burns, and a splash of Water sets off a burst of steam.
 *
 * **Main quest, "The Cold Forge".** This year the vents are quiet, the forges of Kilnreach have
 * gone cold, and the trapped heat bursts out sideways as ash storms over the dunes. Elder
 * Sabra (Cinderwell) sends the player to the Forge Trial. Forgemaster Hale says the Titans
 * feel the mountain; beaten, each shows a vision of iron lids on the caldera vents. At the
 * Cap Works on the Caldera Rim, Glassmaker Gorran has capped the vents to pipe their heat
 * into a great glass dome that would keep the ash storms off Kilnreach (and causes them).
 * Beating him (the region boss: his Kiln Ironjaw fights in boss form) opens the vents, and
 * Calderon rises at the Ember Heart. Beating or catching it, then telling Sabra, ends it.
 *
 * **Rival Mira** travels too. She meets the player on Cinderwell's north road, in Kilnreach
 * after the badge, and in Slagwatch once both Titans are beaten. Her starter line beats the
 * player's, from the player's own region: against an Emberwaste starter she has the Emberwaste
 * line that wins (Earth against Sizzlet, Nature against Pebbit, Fire against Pricklet), against
 * a Verdale one the Verdale line, like in Verdale. Against a Rimeholm starter (C35) she brings
 * the Emberwaste line that wins (Nature against Selkit and Woolump, Earth against Sparkit).
 *
 * **Side quests:** The Brass Bell (Juna, catch a Sandskink), The Mirage Spring (Water-carrier
 * Odo and Nira at the hidden spring), The Smith's Apprentice (Smith Brenna, catch a Rivetling),
 * Cold Fire (Stargazer Vell, the Sunstone Circle and a Shimmerfox).
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

type TrainerMemberInput = TrainerInput['teams'][number]['team'][number];
import { STARTER_FLAGS } from './starts';

const MAP = 'emberwaste:emberwaste';
const e = (local: string): string => `emberwaste:${local}`;
const c = (local: string): string => `core:${local}`;

export const KILN_BADGE = e('kiln-badge');
const MAIN = e('cold-forge');
const FLINT = e('apprentice-flint');
const HALE = e('forgemaster-hale');
const GORRAN = e('glassmaker-gorran');
const MIRA_1 = e('mira-cinderwell');
const MIRA_2 = e('mira-kilnreach');
const MIRA_3 = e('mira-slagwatch');
const TITANS_DONE: StoryCondition = {
  all: [{ boss: e('dunewyrm-titan') }, { boss: e('forgeback-titan') }],
};

export const badges: Record<string, BadgeInput> = {
  'kiln-badge': {
    name: 'Kiln Badge',
    description:
      "Proof of passing Kilnreach's Forge Trial: you know when to heat and when to quench. Raises the level cap.",
    type: 'core:fire',
  },
};

// ------------------------------------------------------------------ trainers

/**
 * Rival Mira's ace at each stage of a line, `[Emberwaste, Verdale]` for the lines she can
 * field. The default (no starter flag: old saves, checkpoints) is Verdale's Fire line.
 */
type Stage = 0 | 1 | 2;
const LINES = {
  earth: ['pebbit', 'cragbuck', 'dunemaul'],
  nature: ['pricklet', 'cactorn', 'saguardian'],
  fire: ['sizzlet', 'cindrake', 'magmaroth'],
  coreFire: ['core:emberkit', 'core:blazekit', 'core:infernyx'],
  coreNature: ['core:sprigling', 'core:fernwick', 'core:thornmane'],
  coreWater: ['core:drizzlet', 'core:brooklet', 'core:tidefang'],
} as const;
const id = (s: string): string => (s.includes(':') ? s : e(s));
/**
 * Other regions' starter flags (Verdale's from C33, Rimeholm's from C35), written out: a pack
 * does not import another pack's code, and a flag is only a name, so this needs no dependency.
 */
const CORE_STARTERS = {
  drizzlet: 'core:starter-drizzlet',
  emberkit: 'core:starter-emberkit',
} as const;
const RIMEHOLM_STARTERS = {
  selkit: 'rimeholm:starter-selkit',
  woolump: 'rimeholm:starter-woolump',
  sparkit: 'rimeholm:starter-sparkit',
} as const;

function miraAce(stage: Stage, level: number): TrainerMemberInput {
  const at = (line: keyof typeof LINES): string => id(LINES[line][stage]);
  return {
    species: at('coreFire'),
    level,
    instead: [
      { if: { flag: STARTER_FLAGS.sizzlet }, species: at('earth') },
      { if: { flag: STARTER_FLAGS.pebbit }, species: at('nature') },
      { if: { flag: STARTER_FLAGS.pricklet }, species: at('fire') },
      { if: { flag: CORE_STARTERS.drizzlet }, species: at('coreNature') },
      { if: { flag: CORE_STARTERS.emberkit }, species: at('coreWater') },
      // Rimeholm's starters (C35): Nature beats Water and Earth, Earth beats Electric.
      { if: { flag: RIMEHOLM_STARTERS.selkit }, species: at('nature') },
      { if: { flag: RIMEHOLM_STARTERS.woolump }, species: at('nature') },
      { if: { flag: RIMEHOLM_STARTERS.sparkit }, species: at('earth') },
    ],
  };
}

export const storyTrainers: Record<string, TrainerInput> = {
  'apprentice-flint': {
    name: 'Apprentice Flint',
    teams: [
      {
        team: [
          { species: e('cindermite'), level: 11 },
          { species: e('sandskink'), level: 12 },
          { species: e('oasip'), level: 12 },
        ],
      },
    ],
    prize: 360,
    rematch: { levels: 10, prize: 300 },
  },
  // Heat, then quench: Cindermite sets the foe Burning, Oasip sets off Steam Burst.
  'forgemaster-hale': {
    name: 'Forgemaster Hale',
    teams: [
      {
        team: [
          { species: e('cindermite'), level: 12, moves: [c('kindle'), c('ember'), c('iron-bash')] },
          { species: e('rivetling'), level: 13 },
          { species: e('oasip'), level: 15, moves: [c('splash-shot'), c('drench')] },
        ],
      },
    ],
    prize: 1000,
    perBadge: 4,
    rematch: { levels: 12, prize: 800 },
  },
  'mira-cinderwell': {
    name: 'Rival Mira',
    teams: [
      { team: [miraAce(0, 7), { species: e('tumblet'), level: 6 }] },
      {
        // Met with a badge from another region (sandbox start): a stronger team.
        badges: 1,
        team: [
          miraAce(1, 17),
          { species: c('galehawk'), level: 18 },
          { species: e('voltsting'), level: 16 },
        ],
      },
    ],
    prize: 300,
    perBadge: 4,
  },
  // She only shows up with the Kiln Badge, so with one badge these are 4 levels higher.
  'mira-kilnreach': {
    name: 'Rival Mira',
    teams: [
      {
        team: [
          miraAce(0, 11),
          { species: e('tumblet'), level: 11 },
          { species: e('rivetling'), level: 10 },
        ],
      },
    ],
    prize: 700,
    perBadge: 4,
  },
  'mira-slagwatch': {
    name: 'Rival Mira',
    teams: [
      {
        team: [
          { species: c('galehawk'), level: 24 },
          { species: e('ironjaw'), level: 24 },
          miraAce(1, 26),
        ],
      },
    ],
    prize: 1300,
    perBadge: 4,
  },
  // The region boss. With the Kiln Badge: Lv 36, 37 and 38 (his Kiln Ironjaw in boss form).
  'glassmaker-gorran': {
    name: 'Glassmaker Gorran',
    teams: [
      {
        team: [
          { species: e('pyrebeetle'), level: 32 },
          { species: e('voltsting'), level: 33 },
          { species: e('ironjaw'), level: 34, boss: e('kiln-ironjaw') },
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
  'cold-forge': {
    name: 'The Cold Forge',
    from: 'Elder Sabra',
    summary:
      'The vents of Mount Caldus are quiet, the forges of Kilnreach have gone cold, and ash storms roll over the dunes. Elder Sabra wants to know why.',
    steps: [
      {
        id: 'forge-trial',
        text: 'Earn the Kiln Badge at the Forge Trial in Kilnreach, up the north road.',
        done: { badge: KILN_BADGE },
      },
      {
        id: 'titans',
        text: 'Face the Titans: the Dunewyrm (Cinder Dunes) and the Forgeback (Rust Canyon).',
        done: TITANS_DONE,
      },
      {
        id: 'cap-works',
        text: 'Climb to the Cap Works on the Caldera Rim, north of Slagwatch.',
        done: { beat: GORRAN },
      },
      {
        id: 'ember-heart',
        text: 'The vents breathe again. Go to the Ember Heart, north of Kilnreach.',
        done: { boss: e('calderon') },
      },
      {
        id: 'sabra',
        text: 'Tell Elder Sabra in Cinderwell.',
        done: { flag: e('cold-forge-told') },
      },
    ],
    reward: { money: 3000, items: { 'core:max-potion': 2 } },
  },
  'brass-bell': {
    name: 'The Brass Bell',
    from: 'Juna',
    summary:
      'A Sandskink ran off with Juna’s brass caravan bell. Juna wants the little thief caught.',
    steps: [
      {
        id: 'catch',
        text: 'Catch a Sandskink. They swim in the sand of the Sunbaked Flats, south of town.',
        done: { caught: e('sandskink') },
      },
      { id: 'tell', text: 'Show it to Juna.', done: { flag: e('bell-told') } },
    ],
    reward: { money: 200, items: { 'core:potion': 2 } },
  },
  'mirage-spring': {
    name: 'The Mirage Spring',
    from: 'Water-carrier Odo',
    summary:
      'Odo’s grandfather spoke of a spring hidden in a ring of rocks east of the lava river. Is it real, or a mirage?',
    steps: [
      {
        id: 'find',
        text: 'Find the spring in a ring of rocks east of the lava river. Look for a gap.',
        done: { flag: e('spring-found') },
      },
      {
        id: 'tell',
        text: 'Tell Water-carrier Odo in Cinderwell.',
        done: { flag: e('spring-told') },
      },
    ],
    reward: { money: 600, items: { 'core:super-potion': 2 } },
  },
  'smiths-apprentice': {
    name: 'The Smith’s Apprentice',
    from: 'Smith Brenna',
    summary:
      'Smith Brenna’s forge is cold, but she still needs a helper: a Rivetling to gnaw the rust off her old tools.',
    steps: [
      {
        id: 'catch',
        text: 'Catch a Rivetling. They nibble old nails along the Dustway and in Rust Canyon.',
        done: { caught: e('rivetling') },
      },
      {
        id: 'tell',
        text: 'Show it to Smith Brenna in Kilnreach.',
        done: { flag: e('smith-told') },
      },
    ],
    reward: { money: 800, items: { 'core:zorb': 5 } },
  },
  'cold-fire': {
    name: 'Cold Fire',
    from: 'Stargazer Vell',
    summary:
      'On cold nights a blue fire flickers over the far wastes, and it leaves frost behind. Stargazer Vell wants to know what it is.',
    steps: [
      {
        id: 'stones',
        text: 'Read the old stones of the Sunstone Circle, west of the Redrock Trail.',
        done: { flag: e('sunstone-read') },
      },
      {
        id: 'catch',
        text: 'Catch the cold fire: a Shimmerfox, in the Obsidian Wastes or on the Caldera Rim.',
        done: { caught: e('shimmerfox') },
      },
      {
        id: 'tell',
        text: 'Show it to Stargazer Vell in Slagwatch.',
        done: { flag: e('cold-fire-told') },
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

/**
 * A rumour (C42) said first once `when` holds, unless the dialogue's quest is under way: the
 * townsfolk notice the region's starters out in the wild after its badge.
 */
function withRumour(
  d: DialogueInput,
  quest: string,
  when: StoryCondition,
  say: readonly string[],
): DialogueInput {
  const notBusy: StoryCondition = { not: { quest, is: 'active' } };
  return {
    start: 'rumour-hello',
    nodes: {
      ...d.nodes,
      'rumour-hello': { branch: [{ if: { all: [when, notBusy] }, goto: 'rumour' }], goto: d.start },
      rumour: { say: [...say], goto: d.start },
    },
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
  const q = e(quest);
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
      report: { say: [...lines.report], do: [{ set: e(told) }] },
      thanks: { say: [lines.thanks] },
    },
  };
}

const step = (s: string): StoryCondition => ({ quest: MAIN, is: 'active', step: s });

const mainDialogues: Record<string, DialogueInput> = {
  'elder-sabra': {
    start: 'hello',
    nodes: {
      hello: {
        branch: [
          { if: { quest: MAIN, is: 'done' }, goto: 'thanks' },
          { if: step('sabra'), goto: 'report' },
          { if: step('forge-trial'), goto: 'remind-trial' },
          { if: step('titans'), goto: 'remind-titans' },
          { if: step('cap-works'), goto: 'remind-cap' },
          { if: step('ember-heart'), goto: 'remind-heart' },
        ],
        goto: 'intro',
      },
      intro: {
        say: [
          'Welcome to Cinderwell, traveler. Sit, have some water. Out here it is worth more than gold.',
          'Every year at the Kindling, the vents of Mount Caldus breathe and the Deep Ember’s heat rises out of the mountain. Its glow lights the forges of Kilnreach.',
          'This year the vents are quiet. The forges are cold, and the heat has to go somewhere: the ash storms over the dunes grow worse every week.',
          'Go north to Kilnreach and take the Forge Trial. Forgemaster Hale knows the mountain better than anyone. Ask about the vents.',
        ],
        do: [{ start: MAIN }],
      },
      'remind-trial': {
        say: ['Kilnreach is up the Redrock Trail, north of town. Forgemaster Hale runs the trial.'],
      },
      'remind-titans': {
        say: [
          'The Titans feel the mountain’s heartbeat, they say. But a Titan does not talk. It fights. Bring water.',
        ],
      },
      'remind-cap': {
        say: [
          'Lids on the vents? Someone is up at the Caldera Rim, then. Ranger Tova in Slagwatch knows the climb.',
        ],
      },
      'remind-heart': {
        say: [
          'I felt the ground hum this morning, and the well water is warm again! Go to the Ember Heart. Something is waking.',
        ],
      },
      report: {
        say: [
          'You met Calderon itself? And the vents breathe again. Listen: the forges in Kilnreach are ringing all the way down here.',
          'Emberwaste owes you a great deal, friend. Take these, and come back when the nights get cold.',
        ],
        do: [{ set: e('cold-forge-told') }],
      },
      thanks: { say: ['The storms are calming down already. Thank you, friend.'] },
    },
  },
  'forgemaster-hale': {
    start: 'hello',
    nodes: {
      hello: {
        branch: [
          { if: { badge: KILN_BADGE }, goto: 'after-badge' },
          { if: { beat: FLINT }, goto: 'challenge' },
        ],
        goto: 'intro',
      },
      intro: {
        say: [
          'Welcome to the Forge Trial. I am Forgemaster Hale. The forge is cold, but the trial still stands.',
          'Beat my apprentice Flint by the shop first, then come back to me.',
          'A smith’s secret: heat, then quench. Set a foe Burning, then hit it with Water, and the steam does the rest. In an ash storm, everything is already burning.',
        ],
      },
      challenge: {
        say: ['Flint let you through. Now show me heat and water working together!'],
        battle: { trainer: HALE },
        win: 'won',
      },
      won: {
        say: [
          'Well forged. You know when to heat and when to quench.',
          'The Kiln Badge is yours. With it, your Zorlings can grow much stronger.',
        ],
        do: [{ badge: KILN_BADGE }],
        branch: [{ if: { quest: MAIN, is: 'active' }, goto: 'vents' }],
      },
      vents: {
        say: [
          'Sabra sent you about the vents? Then ask the Titans. They live close to the mountain’s fire, and they feel when it changes.',
          'The Dunewyrm sleeps in the Sunken Sands, deep in the Cinder Dunes, west of Cinderwell. The Forgeback broods in the Old Foundry at the end of Rust Canyon, southeast.',
          'Beat them, and they may show you what they have felt.',
        ],
      },
      'after-badge': {
        branch: [{ if: step('titans'), goto: 'titan-tips' }],
        goto: 'rematch',
      },
      'titan-tips': {
        say: [
          'The Titans’ hides turn aside plain hits. The dunes’ storm sets the Dunewyrm burning: quench it with Water. Rust the Forgeback’s plates with Metal, then let the Wind tear through.',
        ],
        goto: 'rematch',
      },
      ...rematchNodes(
        HALE,
        'Back for another round at the anvil?',
        'Hot and cold, every time. Well done.',
      ),
    },
  },
  'apprentice-flint': {
    start: 'hello',
    nodes: {
      hello: {
        branch: [
          { if: { badge: KILN_BADGE }, goto: 'rematch' },
          { if: { beat: FLINT }, goto: 'after' },
        ],
        goto: 'challenge',
      },
      challenge: {
        say: ['Here for the Forge Trial? You have to get past me first!'],
        battle: { trainer: FLINT },
        win: 'won',
      },
      won: { say: ['Ow, hot! Go on, Forgemaster Hale is waiting by the forge.'] },
      after: { say: ['Forgemaster Hale is waiting by the forge. Good luck!'] },
      ...rematchNodes(FLINT, 'Practice round? I have been training!', 'Still too hot for me.'),
    },
  },
  'mira-cinderwell': {
    start: 'hello',
    nodes: {
      hello: {
        say: [
          'Hey! I came all the way here to see the Kindling, and the vents are not even breathing.',
          'Fine. A battle will warm me up. Your Zorling against mine!',
        ],
        battle: { trainer: MIRA_1 },
        win: 'won',
      },
      won: {
        say: ['Ugh, the sand got in my eyes. Next time, I win! See you in Kilnreach.'],
      },
    },
  },
  'mira-kilnreach': {
    start: 'hello',
    nodes: {
      hello: {
        say: ['The Kiln Badge? Already? Fine. Beat me again and I will believe it.'],
        battle: { trainer: MIRA_2 },
        win: 'won',
      },
      won: {
        say: ['Hot, then cold, then I lose. I need to learn this steam thing.'],
      },
    },
  },
  'mira-slagwatch': {
    start: 'hello',
    nodes: {
      hello: {
        say: [
          'You faced both Titans? I just watched the Forgeback from a slag heap. From very far away.',
          'Something strange is going on up on the Caldera Rim. But first: one more battle. A real one!',
        ],
        battle: { trainer: MIRA_3 },
        win: 'won',
      },
      won: {
        say: [
          'Okay. You win. Again. Go see what is happening at the Cap Works. I will cheer from down here.',
        ],
      },
    },
  },
  'glassmaker-gorran': {
    start: 'hello',
    nodes: {
      hello: { branch: [{ if: { beat: GORRAN }, goto: 'rematch' }], goto: 'intro' },
      intro: {
        say: [
          'A visitor! Mind the pipes. Welcome to the Cap Works, the greatest glassworks in Emberwaste!',
          'Every vent on the rim, capped and piped into my furnace. With that heat I am blowing a glass dome big enough to cover all of Kilnreach. No more ash storms!',
          'What do you mean, the storms started when I capped the vents? Nonsense. My Kiln Ironjaw says so too. Ironjaw, show them!',
        ],
        battle: { trainer: GORRAN },
        win: 'won',
      },
      won: {
        say: [
          'The heat had to go somewhere… and it went under the dunes. Oh. Oh dear.',
          'Fine. Off with the lids! I will make windows instead. Small ones. Lots of them.',
          'Listen to that: the vents are breathing. Something big is stirring in the caldera.',
        ],
      },
      ...rematchNodes(
        GORRAN,
        'I am testing a new furnace. Help me test it?',
        'Back to the drawing board. A small drawing board.',
      ),
    },
  },
  'dune-guide-rasa': {
    start: 'hello',
    nodes: {
      hello: {
        branch: [{ if: { boss: e('dunewyrm-titan') }, goto: 'done' }],
        goto: 'hint',
      },
      hint: {
        say: [
          'The Cinder Dunes are ahead. In the storm out there, everything starts burning, even the Titan in the Sunken Sands.',
          'A burning Dunewyrm and a splash of Water: steam, right through its hide. Bring Water Zorlings.',
        ],
      },
      done: { say: ['You faced the Dunewyrm? The dunes have been quiet since.'] },
    },
  },
  'foundry-keeper-tomas': {
    start: 'hello',
    nodes: {
      hello: {
        branch: [{ if: { boss: e('forgeback-titan') }, goto: 'done' }],
        goto: 'hint',
      },
      hint: {
        say: [
          'I kept the Old Foundry for forty years. Now a Forgeback Titan lives in the slag.',
          'Its plates are thick, but iron rusts. Rust them with Metal first, then send in the Wind to tear through.',
        ],
      },
      done: { say: ['The foundry is quiet again. Thank you, young one.'] },
    },
  },
  'ranger-tova': {
    start: 'hello',
    nodes: {
      hello: {
        branch: [
          { if: { beat: GORRAN }, goto: 'open' },
          { if: step('cap-works'), goto: 'climb' },
        ],
        goto: 'chat',
      },
      chat: {
        say: [
          'Slagwatch keeps an eye on the ridge. West of the dunes, Ember Pass leads over the mountains to Verdale.',
        ],
      },
      climb: {
        say: [
          'The Cap Works? Take the road north past Ironspire Ridge, then follow the pipes up the rim.',
          'Gorran’s Kiln Ironjaw is all iron and furnace heat. Chill it with Ice, then hit it with Earth, and it cracks like cold glass.',
        ],
      },
      open: { say: ['The vents are open! The ash clouds are thinning over the dunes already.'] },
    },
  },
};

const sideDialogues: Record<string, DialogueInput> = {
  juna: withRumour(
    questGiver('brass-bell', 'bell-told', {
      ask: [
        'A Sandskink stole my brass bell! It wiggled into the sand and was gone.',
        'They love shiny things. Can you catch one? I want to see the thief up close.',
      ],
      yes: 'I’ll catch it',
      yesThanks: 'Yay! They swim in the sand of the Sunbaked Flats, south of town.',
      no: 'Maybe later',
      remind: 'Sandskinks swim in the Sunbaked Flats, south of town.',
      report: [
        'You caught one! Look at its little eyes. It does not look sorry at all.',
        'Here, take these. I will buy a new bell. Maybe a less shiny one.',
      ],
      thanks: 'I tie my new bell on with string now. The Sandskinks can only stare.',
    }),
    e('brass-bell'),
    { badge: KILN_BADGE },
    [
      'Something new is out on the Sunbaked Flats! A little salamander, napping on the hot stones.',
      'Odo saw a plump cactus sprout by the Dustway, and the Redrock miners say the pebbles there have started to walk.',
    ],
  ),
  'water-carrier-odo': questGiver('mirage-spring', 'spring-told', {
    ask: [
      'My grandfather told me of a spring hidden in a ring of rocks, east of the lava river. Cool water, right in the waste!',
      'Everyone says it is a mirage. Will you look for it?',
    ],
    yes: 'I’ll look for it',
    yesThanks:
      'Thank you! East of the river, north of the Slagwatch road. Look for a gap in the rocks.',
    no: 'Not now',
    remind: 'East of the river, north of the Slagwatch road. Look for a gap in the rocks!',
    report: [
      'Nira lives there? And the water is real! Grandfather was right all along.',
      'Take these. I will bring my jugs out there this very week.',
    ],
    thanks: 'Spring water in Cinderwell! Nira says hello.',
  }),
  'smith-brenna': questGiver('smiths-apprentice', 'smith-told', {
    ask: [
      'My forge is cold, so I am cleaning my tools. Rust everywhere!',
      'A Rivetling would gnaw it right off. Will you catch me one?',
    ],
    yes: 'I’ll find one',
    yesThanks: 'Wonderful! They nibble old nails along the Dustway, west of Cinderwell.',
    no: 'Not now',
    remind: 'Rivetlings love the Dustway and Rust Canyon. Listen for the crunching!',
    report: [
      'Look at it chew! My tongs are shining already.',
      'Here, a few Zorbs. When the forge is hot again, I will make you something better.',
    ],
    thanks: 'My Rivetling helper is on its third hammer today. Clever thing.',
  }),
  'stargazer-vell': questGiver('cold-fire', 'cold-fire-told', {
    ask: [
      'On cold nights a blue fire flickers over the far wastes. It leaves frost on the sand by morning!',
      'The old stones of the Sunstone Circle might say what it is. Will you look into it?',
    ],
    yes: 'I’ll look',
    yesThanks: 'Thank you! The Sunstone Circle is west of the Redrock Trail.',
    no: 'Not now',
    remind: 'Start at the Sunstone Circle, west of the Redrock Trail.',
    report: [
      'A Shimmerfox! So the cold fire is its tail. I will have to rewrite half my star charts.',
      'Here, take this. Come stargazing some night. Bring your fox.',
    ],
    thanks: 'Every cold night I count the blue fires now. Seven last night!',
  }),
  'spring-nira': {
    start: 'hello',
    nodes: {
      hello: { branch: [{ if: { flag: e('spring-found') }, goto: 'again' }], goto: 'first' },
      first: {
        say: [
          'Oh! Nobody finds this place. Welcome to the Mirage Spring.',
          'Yes, the water is real. Have a drink, and take these. Travelers here get a gift.',
        ],
        do: [{ set: e('spring-found') }, { give: 'core:zorb', count: 3 }],
      },
      again: {
        branch: [{ if: { beat: GORRAN }, goto: 'warm' }],
        goto: 'still',
      },
      still: { say: ['The spring is cool even when the storms rage. A good place to rest.'] },
      warm: { say: ['The storms have calmed! The spring is fuller than it has been in years.'] },
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
  'sign-cinderwell-north': {
    x: 102,
    y: 107,
    name: 'Sign',
    text: ['North: the Redrock Trail and Kilnreach.'],
  },
  'sign-cinderwell-east': {
    x: 115,
    y: 121,
    name: 'Sign',
    text: ['East: over the lava bridge to the Scorch Basin and Slagwatch.'],
  },
  'sign-cinderwell-west': {
    x: 91,
    y: 119,
    name: 'Sign',
    text: ['West: the Dustway and the Cinder Dunes. Far west: Ember Pass, to Verdale.'],
  },
  'sign-cinderwell-south': {
    x: 105,
    y: 133,
    name: 'Sign',
    text: ['South: the Sunbaked Flats and Rust Canyon.'],
  },
  'sign-kilnreach-north': {
    x: 102,
    y: 53,
    name: 'Sign',
    text: ['North: the Glass Flats, the Caldera Rim and the Ember Heart. Strong teams only!'],
  },
  'sign-kilnreach-east': {
    x: 112,
    y: 65,
    name: 'Sign',
    text: ['East: the long road to Slagwatch.'],
  },
  'sign-kilnreach-west': {
    x: 88,
    y: 63,
    name: 'Sign',
    text: ['West: the Ashfall Slopes. Ash storms ahead!'],
  },
  'sign-kilnreach': {
    x: 101,
    y: 75,
    name: 'Sign',
    text: ['Kilnreach, home of the Forge Trial. South: Cinderwell.'],
  },
  'sign-slagwatch-north': {
    x: 162,
    y: 103,
    name: 'Sign',
    text: ['North: Ironspire Ridge and the Caldera Rim.'],
  },
  'sign-slagwatch-east': {
    x: 169,
    y: 113,
    name: 'Sign',
    text: ['Slagwatch outpost. The last Zorling center before the ridge.'],
  },
  'sign-slagwatch-west': {
    x: 150,
    y: 111,
    name: 'Sign',
    text: ['West: Cinderwell. Northwest: the road to Kilnreach.'],
  },
  'stone-trial': {
    x: 97,
    y: 71,
    name: 'Trial stone',
    text: ['THE FORGE TRIAL', '“Heat, then quench. No blade is made by fire alone.”'],
  },
};

/** Stones whose text depends on the story. */
const storySigns: Record<string, NpcInput> = {
  'stone-ember-heart': {
    name: 'Ember stone',
    map: MAP,
    x: 96,
    y: 9,
    object: 'sign',
    dialogue: e('stone-ember-heart'),
  },
  'stone-sunstone': {
    name: 'Sunstone',
    map: MAP,
    x: 61,
    y: 81,
    object: 'sign',
    dialogue: e('stone-sunstone'),
  },
};

const stoneDialogues: Record<string, DialogueInput> = {
  'stone-ember-heart': {
    start: 'hello',
    nodes: {
      hello: {
        say: ['“HERE THE MOUNTAIN BREATHES. LET NO HAND STOP ITS BREATH.”'],
        branch: [{ if: { beat: GORRAN }, goto: 'warm' }],
        goto: 'cold',
      },
      cold: { say: ['The stone is cold to the touch.'] },
      warm: { say: ['The stone is warm, and it hums softly.'] },
    },
  },
  'stone-sunstone': {
    start: 'hello',
    nodes: {
      hello: {
        say: [
          'The old stones are carved with suns, and one with a moon.',
          '“When the sun sleeps, the cold fire runs. Frost on its tail, stars in its eyes.”',
        ],
        do: [{ set: e('sunstone-read') }],
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
  'item-glass-garden': {
    anchor: 'glass-garden',
    item: 'core:max-potion',
    count: 1,
    where: 'among the glass flowers',
  },
  'item-buried-caravan': {
    anchor: 'buried-caravan',
    item: 'core:max-potion',
    count: 1,
    where: 'in an old caravan chest',
  },
  'item-sunstone-circle': {
    anchor: 'sunstone-circle',
    item: 'core:super-potion',
    count: 2,
    where: 'between the stones',
  },
  'item-old-mine': {
    anchor: 'old-mine',
    item: 'core:super-potion',
    count: 1,
    where: 'in a rusty mine cart',
  },
  'item-lookout': { anchor: 'lookout', item: 'core:zorb', count: 5, where: 'under a flat rock' },
};

const BAG_FULL = 5;

function hiddenDialogue(id: string, h: Hidden): DialogueInput {
  const take: DialogueInput['nodes'][string] = {
    say: [`Something is tucked away ${h.where}…`],
    do: [{ give: h.item, count: h.count }, { set: e(id) }],
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
  'elder-sabra': {
    name: 'Elder Sabra',
    map: MAP,
    anchor: 'elder',
    look: { outfit: 'maroon', hair: 'grey', skin: 'deep' },
    behavior: { kind: 'look', every: [2.5, 5] },
    dialogue: e('elder-sabra'),
  },
  juna: {
    name: 'Juna',
    map: MAP,
    x: 101,
    y: 123,
    look: { outfit: 'orange', hair: 'dark', skin: 'tan' },
    behavior: { kind: 'wander', radius: 3 },
    dialogue: e('juna'),
  },
  'water-carrier-odo': {
    name: 'Water-carrier Odo',
    map: MAP,
    x: 112,
    y: 117,
    facing: 'left',
    look: { outfit: 'sky', hair: 'grey', skin: 'warm' },
    behavior: { kind: 'look' },
    dialogue: e('water-carrier-odo'),
  },
  'forgemaster-hale': {
    name: 'Forgemaster Hale',
    mark: 'trial',
    map: MAP,
    anchor: 'trial',
    look: { outfit: 'maroon', hair: 'grey', skin: 'tan' },
    dialogue: HALE,
  },
  'apprentice-flint': {
    name: 'Apprentice Flint',
    mark: 'trial',
    map: MAP,
    x: 104,
    y: 66,
    facing: 'down',
    look: { outfit: 'orange', hair: 'brown', skin: 'light' },
    dialogue: FLINT,
  },
  'smith-brenna': {
    name: 'Smith Brenna',
    map: MAP,
    x: 93,
    y: 66,
    facing: 'up',
    look: { outfit: 'navy', hair: 'red', skin: 'deep' },
    behavior: { kind: 'look' },
    dialogue: e('smith-brenna'),
  },
  'dune-guide-rasa': {
    name: 'Dune Guide Rasa',
    map: MAP,
    x: 58,
    y: 111,
    facing: 'right',
    look: { outfit: 'mustard', hair: 'blonde', skin: 'deep' },
    behavior: { kind: 'look' },
    dialogue: e('dune-guide-rasa'),
  },
  'foundry-keeper-tomas': {
    name: 'Foundry Keeper Tomas',
    map: MAP,
    x: 126,
    y: 141,
    facing: 'right',
    look: { outfit: 'navy', hair: 'grey', skin: 'light' },
    behavior: { kind: 'look' },
    dialogue: e('foundry-keeper-tomas'),
  },
  'mira-cinderwell': {
    name: 'Rival Mira',
    mark: 'rival',
    map: MAP,
    x: 100,
    y: 106,
    facing: 'down',
    look: MIRA_LOOK,
    when: { not: { beat: MIRA_1 } },
    dialogue: MIRA_1,
  },
  'mira-kilnreach': {
    name: 'Rival Mira',
    mark: 'rival',
    map: MAP,
    x: 100,
    y: 72,
    facing: 'down',
    look: MIRA_LOOK,
    when: { all: [{ badge: KILN_BADGE }, { not: { beat: MIRA_2 } }] },
    dialogue: MIRA_2,
  },
  'mira-slagwatch': {
    name: 'Rival Mira',
    mark: 'rival',
    map: MAP,
    x: 161,
    y: 104,
    facing: 'down',
    look: MIRA_LOOK,
    when: { all: [{ badge: KILN_BADGE }, TITANS_DONE, { not: { beat: MIRA_3 } }] },
    dialogue: MIRA_3,
  },
  'glassmaker-gorran': {
    name: 'Glassmaker Gorran',
    mark: 'boss',
    map: MAP,
    anchor: 'boss-cap-works',
    look: { outfit: 'white', hair: 'brown', skin: 'warm' },
    behavior: { kind: 'look' },
    dialogue: GORRAN,
  },
  'ranger-tova': {
    name: 'Ranger Tova',
    map: MAP,
    anchor: 'ranger',
    look: { outfit: 'orange', hair: 'dark', skin: 'deep' },
    behavior: { kind: 'look' },
    dialogue: e('ranger-tova'),
  },
  'stargazer-vell': {
    name: 'Stargazer Vell',
    map: MAP,
    x: 158,
    y: 116,
    facing: 'up',
    look: { outfit: 'purple', hair: 'blonde', skin: 'light' },
    behavior: { kind: 'look' },
    dialogue: e('stargazer-vell'),
  },
  'spring-nira': {
    name: 'Nira',
    map: MAP,
    anchor: 'mirage-spring',
    look: { outfit: 'sky', hair: 'blonde', skin: 'tan' },
    behavior: { kind: 'look' },
    dialogue: e('spring-nira'),
  },
};

export const storyNpcsAll: Record<string, NpcInput> = {
  ...storyNpcs,
  ...Object.fromEntries(
    Object.entries(SIGNS).map(([id, s]) => [
      id,
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
    Object.entries(HIDDEN).map(([id, h]) => [
      id,
      {
        name: 'Hidden item',
        map: MAP,
        anchor: h.anchor,
        object: 'item',
        when: { not: { flag: e(id) } },
        dialogue: e(id),
      } satisfies NpcInput,
    ]),
  ),
};

export const storyDialogues: Record<string, DialogueInput> = {
  ...mainDialogues,
  ...sideDialogues,
  ...stoneDialogues,
  ...Object.fromEntries(Object.entries(HIDDEN).map(([id, h]) => [id, hiddenDialogue(id, h)])),
};

/** Ids of the Emberwaste signs and stones that sit on a map prop (for tests). */
export const EMBERWASTE_SIGNS: readonly string[] = [
  ...Object.keys(SIGNS),
  ...Object.keys(storySigns),
];
