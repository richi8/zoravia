/**
 * Region 1, Verdale: its campaign and lore (C30).
 *
 * **Lore.** Verdale's forests grew from the Heartwood, the great tree at the shrine in the
 * far north. Every spring the Heartwood breathes out a warm wind, the **Seedwind**, that
 * carries its seeds over the land and wakes the forest. Verdion, the Heartwood's keeper,
 * rides its first breath. The Titans (the Mossback of the Hollow Oak, the Bogmaw of the
 * Sunken Hollow) are old enough to remember a hundred springs. The first wardens learned
 * from the Zorlings how one move sets up another ("Fire wakes the bark, Water calms the
 * flame, Stone breaks the frost"), and Fernhollow's **Grove Trial** still tests it.
 *
 * **Main quest, "The Still Wind".** This spring the Seedwind has not come. Elder Rowan
 * (Willowmere) sends the player to the Grove Trial in Fernhollow. Warden Elm says the
 * Titans remember; beaten, each shows a vision of sails on a rock north of Galecrest. On
 * Crown Rock, Stormcatcher Vex has built the Gale Engine to bottle every breeze for her
 * airship. Beating her (the region boss: her Storm Galehawk fights in boss form) frees the
 * wind, and Verdion appears at the Heartwood Shrine. Beating or catching it, then telling
 * Rowan, ends the quest.
 *
 * **Rival Mira** meets the player three times: on Willowmere's north road, at the trial
 * after the badge, and in Galecrest once both Titans are beaten.
 *
 * **Side quests:** Sandwich Snatcher (Tam, catch a Pipwing), The Lost Orchard (Gardener Mo
 * and Hazel in the Old Orchard secret), Ringing Shells (Tinker Pim, catch an Ironshell),
 * Lights on the Water (Ferryman Gus, the Drowned Ruins stone and a Rimewisp).
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

const MAP = 'core:verdale';
const c = (local: string): string => `core:${local}`;

export const GROVE_BADGE = c('grove-badge');
const MAIN = c('still-wind');
const LINDEN = c('apprentice-linden');
const ELM = c('warden-elm');
const VEX = c('stormcatcher-vex');
const MIRA_1 = c('mira-willowmere');
const MIRA_2 = c('mira-fernhollow');
const MIRA_3 = c('mira-galecrest');
const TITANS_DONE: StoryCondition = {
  all: [{ boss: c('mossback-titan') }, { boss: c('bogmaw-titan') }],
};

export const verdaleBadges: Record<string, BadgeInput> = {
  'grove-badge': {
    name: 'Grove Badge',
    description:
      "Proof of passing Fernhollow's Grove Trial: you and your Zorlings work as one. Raises the level cap.",
    type: 'core:nature',
  },
};

// ------------------------------------------------------------------ trainers

export const verdaleStoryTrainers: Record<string, TrainerInput> = {
  'apprentice-linden': {
    name: 'Apprentice Linden',
    teams: [
      {
        team: [
          { species: c('pipwing'), level: 11 },
          { species: c('sproutle'), level: 12 },
          { species: c('puddlit'), level: 12 },
        ],
      },
    ],
    prize: 360,
    rematch: { levels: 10, prize: 300 },
  },
  'warden-elm': {
    name: 'Warden Elm',
    teams: [
      {
        team: [
          { species: c('voltbat'), level: 13 },
          { species: c('mudpaddle'), level: 14 },
          {
            species: c('thornwing'),
            level: 15,
            moves: [c('gust'), c('vine-snap'), c('mud-toss')],
          },
        ],
      },
    ],
    prize: 1000,
    perBadge: 4,
    rematch: { levels: 12, prize: 800 },
  },
  'mira-willowmere': {
    name: 'Rival Mira',
    teams: [
      {
        team: [
          { species: c('emberkit'), level: 7 },
          { species: c('pipwing'), level: 6 },
        ],
      },
      {
        // Met with a badge from another region (sandbox start): a stronger team.
        badges: 1,
        team: [
          { species: c('blazekit'), level: 17 },
          { species: c('galehawk'), level: 17 },
          { species: c('voltbat'), level: 16 },
        ],
      },
    ],
    prize: 300,
    perBadge: 4,
  },
  // She only shows up with the Grove Badge, so with one badge these are 4 levels higher.
  'mira-fernhollow': {
    name: 'Rival Mira',
    teams: [
      {
        team: [
          { species: c('blazekit'), level: 12 },
          { species: c('pipwing'), level: 12 },
          { species: c('ironshell'), level: 11 },
        ],
      },
    ],
    prize: 700,
    perBadge: 4,
  },
  'mira-galecrest': {
    name: 'Rival Mira',
    teams: [
      {
        team: [
          { species: c('galehawk'), level: 30 },
          { species: c('ironshell'), level: 30 },
          { species: c('infernyx'), level: 31 },
        ],
      },
    ],
    prize: 1300,
    perBadge: 4,
  },
  // The region boss. With the Grove Badge: Lv 36, 37 and 38 (her Storm Galehawk in boss form).
  'stormcatcher-vex': {
    name: 'Stormcatcher Vex',
    teams: [
      {
        team: [
          { species: c('voltbat'), level: 32 },
          { species: c('rimewisp'), level: 33 },
          { species: c('galehawk'), level: 34, boss: c('storm-galehawk') },
        ],
      },
    ],
    prize: 2400,
    perBadge: 4,
    rematch: { levels: 8, prize: 1500 },
  },
};

// ------------------------------------------------------------------ quests

export const verdaleQuests: Record<string, QuestInput> = {
  'still-wind': {
    name: 'The Still Wind',
    from: 'Elder Rowan',
    summary:
      'The Seedwind has not come this spring, and the leaves of Verdale stay curled. Elder Rowan wants to know why.',
    steps: [
      {
        id: 'grove-trial',
        text: 'Earn the Grove Badge at the trial in Fernhollow, up the north road.',
        done: { badge: GROVE_BADGE },
      },
      {
        id: 'titans',
        text: 'Face the Titans: the Mossback in Deepwood and the Bogmaw in the Reed Marsh.',
        done: TITANS_DONE,
      },
      {
        id: 'crown-rock',
        text: 'Climb Galeback Ridge, north of Galecrest, to the sails on Crown Rock.',
        done: { beat: VEX },
      },
      {
        id: 'heartwood',
        text: 'The Seedwind blows again. Go to the Heartwood Shrine, north of Fernhollow.',
        done: { boss: c('verdion') },
      },
      {
        id: 'rowan',
        text: 'Tell Elder Rowan in Willowmere.',
        done: { flag: c('still-wind-told') },
      },
    ],
    reward: { money: 3000, items: { 'core:max-potion': 2 } },
  },
  'sandwich-snatcher': {
    name: 'Sandwich Snatcher',
    from: 'Tam',
    summary: 'A Pipwing stole Tam’s sandwich in the Sunny Meadow. Tam wants to meet the thief.',
    steps: [
      {
        id: 'catch',
        text: 'Catch a Pipwing in the Sunny Meadow, south of town.',
        done: { caught: c('pipwing') },
      },
      { id: 'tell', text: 'Show it to Tam.', done: { flag: c('sandwich-told') } },
    ],
    reward: { money: 200, items: { 'core:potion': 2 } },
  },
  'lost-orchard': {
    name: 'The Lost Orchard',
    from: 'Gardener Mo',
    summary:
      'Gardener Mo’s grandmother told of an orchard hidden behind a wall of trees, far southeast of Willowmere. Is it still there?',
    steps: [
      {
        id: 'find',
        text: 'Find the hidden orchard along the southeast road. Look for a gap in the trees.',
        done: { flag: c('orchard-found') },
      },
      { id: 'tell', text: 'Tell Gardener Mo in Willowmere.', done: { flag: c('orchard-told') } },
    ],
    reward: { money: 600, items: { 'core:super-potion': 2 } },
  },
  'ringing-shells': {
    name: 'Ringing Shells',
    from: 'Tinker Pim',
    summary:
      'Tinker Pim is making a bell for the Galecrest windmill and wants to hear an Ironshell ring.',
    steps: [
      {
        id: 'catch',
        text: 'Catch an Ironshell. They hide in the Bramble Thicket.',
        done: { caught: c('ironshell') },
      },
      { id: 'tell', text: 'Show it to Tinker Pim in Galecrest.', done: { flag: c('shells-told') } },
    ],
    reward: { money: 800, items: { 'core:zorb': 5 } },
  },
  'lights-on-the-water': {
    name: 'Lights on the Water',
    from: 'Ferryman Gus',
    summary:
      'Cold lights drift over the water at night, and Ferryman Gus’s passengers are scared. What are they?',
    steps: [
      {
        id: 'ruins',
        text: 'Read the old stone at the Drowned Ruins, at the end of the marsh road.',
        done: { flag: c('ruins-read') },
      },
      {
        id: 'catch',
        text: 'Catch one of the cold lights: a Rimewisp. They ride the fog over Mistmere.',
        done: { caught: c('rimewisp') },
      },
      { id: 'tell', text: 'Show it to Ferryman Gus.', done: { flag: c('lights-told') } },
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

const step = (s: string): StoryCondition => ({ quest: MAIN, is: 'active', step: s });

const mainDialogues: Record<string, DialogueInput> = {
  'elder-rowan': {
    start: 'hello',
    nodes: {
      hello: {
        branch: [
          { if: { quest: MAIN, is: 'done' }, goto: 'thanks' },
          { if: step('rowan'), goto: 'report' },
          { if: step('grove-trial'), goto: 'remind-trial' },
          { if: step('titans'), goto: 'remind-titans' },
          { if: step('crown-rock'), goto: 'remind-crown' },
          { if: step('heartwood'), goto: 'remind-shrine' },
        ],
        goto: 'intro',
      },
      intro: {
        say: [
          'Ah, you’re up! Welcome to Willowmere, the heart of Verdale.',
          'Every spring a warm wind blows down from the Heartwood, the great tree in the far north. We call it the Seedwind. It wakes the whole forest.',
          'This year it hasn’t come. The leaves stay curled, the windmills stand still, and the Zorlings are restless.',
          'Go north to Fernhollow and take the Grove Trial. Warden Elm knows the old ways better than anyone. Ask about the Seedwind.',
        ],
        do: [{ start: MAIN }],
      },
      'remind-trial': {
        say: [
          'Fernhollow is up the north road, past Brookside. Warden Elm runs the Grove Trial there.',
        ],
      },
      'remind-titans': {
        say: [
          'The Titans? Elm is right: they are older than any of us. But a Titan won’t talk. It will fight. Heal up first.',
        ],
      },
      'remind-crown': {
        say: [
          'Sails on Crown Rock? Ranger Kit in Galecrest knows the ridge. Cross the Silverrun bridge east of town.',
        ],
      },
      'remind-shrine': {
        say: [
          'I felt it this morning: the Seedwind! Go to the Heartwood Shrine, north of Fernhollow. Something is waiting there.',
        ],
      },
      report: {
        say: [
          'You met Verdion itself? And the Seedwind blows again! Look, the leaves are opening all over town.',
          'Verdale owes you a great deal, friend. Take these, and come back to visit.',
        ],
        do: [{ set: c('still-wind-told') }],
      },
      thanks: { say: ['Listen: you can hear the leaves again. Thank you, friend.'] },
    },
  },
  'warden-elm': {
    start: 'hello',
    nodes: {
      hello: {
        branch: [
          { if: { badge: GROVE_BADGE }, goto: 'after-badge' },
          { if: { beat: LINDEN }, goto: 'challenge' },
        ],
        goto: 'intro',
      },
      intro: {
        say: [
          'Welcome to the Grove Trial. I am Warden Elm.',
          'Here we test how well you and your Zorlings work together. Beat my apprentice Linden by the east road first, then come back to me.',
          'A tip: one move sets things up, another sets them off. Soak a foe, then shock it. Seed it, then burn it.',
        ],
      },
      challenge: {
        say: ['Linden let you through. Now show me what you have learned!'],
        battle: { trainer: ELM },
        win: 'won',
      },
      won: {
        say: [
          'Well fought. You read your Zorlings like the forest reads the wind.',
          'The Grove Badge is yours. With it, your Zorlings can grow much stronger.',
        ],
        do: [{ badge: GROVE_BADGE }],
        branch: [{ if: { quest: MAIN, is: 'active' }, goto: 'seedwind' }],
      },
      seedwind: {
        say: [
          'Rowan sent you about the Seedwind? Then ask the old ones. The Titans have slept through a hundred springs.',
          'The Mossback sleeps in the Hollow Oak, in Deepwood to the west. The Bogmaw hides in the Sunken Hollow of the Reed Marsh, west of Willowmere.',
          'They won’t talk, mind you. Beat them, and they may show you what they remember.',
        ],
      },
      'after-badge': {
        branch: [{ if: step('titans'), goto: 'titan-tips' }],
        goto: 'rematch',
      },
      'titan-tips': {
        say: [
          'The Titans’ hides turn aside plain hits. Seed the Mossback, then burn it. Soak the Bogmaw, then shock it.',
        ],
        goto: 'rematch',
      },
      ...rematchNodes(
        ELM,
        'Back for another lesson? I will not hold back this time.',
        'Splendid. The grove is in good hands.',
      ),
    },
  },
  'apprentice-linden': {
    start: 'hello',
    nodes: {
      hello: {
        branch: [
          { if: { badge: GROVE_BADGE }, goto: 'rematch' },
          { if: { beat: LINDEN }, goto: 'after' },
        ],
        goto: 'challenge',
      },
      challenge: {
        say: ['Here for the Grove Trial? Then you face me first!'],
        battle: { trainer: LINDEN },
        win: 'won',
      },
      won: { say: ['Wow, you’re good! Go on, Warden Elm is waiting at the hall door.'] },
      after: { say: ['Warden Elm is waiting at the hall door. Good luck!'] },
      ...rematchNodes(
        LINDEN,
        'I’ve trained every day since you beat me. Want to see?',
        'Still too strong for me!',
      ),
    },
  },
  'mira-willowmere': {
    start: 'hello',
    nodes: {
      hello: {
        say: [
          'Hey, you! I’m Mira. I’m going to be the first to earn the Grove Badge this year.',
          'Before I go, let’s see what your Zorlings can do!',
        ],
        battle: { trainer: MIRA_1 },
        win: 'won',
      },
      won: {
        say: [
          'Okay, okay, you’re not bad. See you in Fernhollow! Last one there buys the berry tarts!',
        ],
      },
    },
  },
  'mira-fernhollow': {
    start: 'hello',
    nodes: {
      hello: {
        say: ['You got the Grove Badge before me?! Fine. Beat me again and I’ll believe it.'],
        battle: { trainer: MIRA_2 },
        win: 'won',
      },
      won: {
        say: [
          'Hmph. You owe me berry tarts anyway.',
          'I’m going after the Titans next. Bet I wake one before you do!',
        ],
      },
    },
  },
  'mira-galecrest': {
    start: 'hello',
    nodes: {
      hello: {
        say: [
          'You beat both Titans too? Then you saw it: the sails on a rock, north of here.',
          'Whoever is up there took the wind. One last battle, then we go up together. Well, you go first.',
        ],
        battle: { trainer: MIRA_3 },
        win: 'won',
      },
      won: {
        say: [
          'You’re the real thing. Go on, Crown Rock is yours. I’ll keep the road clear behind you.',
        ],
      },
    },
  },
  'stormcatcher-vex': {
    start: 'hello',
    nodes: {
      hello: { branch: [{ if: { beat: VEX }, goto: 'rematch' }], goto: 'intro' },
      intro: {
        say: [
          'Whoa, a visitor! Careful, don’t trip on the ropes.',
          'Isn’t she beautiful? My Gale Engine catches every breeze in Verdale. Once the tanks are full, my airship flies to the frozen coast!',
          'The Seedwind? The forest can wait one spring. You want to stop me? Fine! Storm, we have company!',
        ],
        battle: { trainer: VEX },
        win: 'won',
      },
      won: {
        say: [
          'My Storm, beaten? And the engine is shaking apart!',
          'Okay, okay! I’ll open the tanks. I didn’t know the forest needed the wind that much.',
          'Listen… there it goes. Down the ridge, all the way to the Heartwood.',
        ],
      },
      ...rematchNodes(
        VEX,
        'Next I’ll build a ship that runs on sunshine. Want a rematch while I think?',
        'You’re a storm all by yourself!',
      ),
    },
  },
  'scout-pell': {
    start: 'hello',
    nodes: {
      hello: {
        branch: [{ if: { boss: c('mossback-titan') }, goto: 'done' }],
        goto: 'hint',
      },
      hint: {
        say: [
          'West of here is Deepwood. The Hollow Oak there is no tree: it’s a Mossback Titan, older than the forest.',
          'Its bark turns aside almost anything. Seed it with a Nature move, then set it alight with Fire. Wildfire burns right through.',
        ],
      },
      done: { say: ['You faced the Mossback and walked away? Deepwood feels lighter already.'] },
    },
  },
  'reedcutter-wade': {
    start: 'hello',
    nodes: {
      hello: {
        branch: [{ if: { boss: c('bogmaw-titan') }, goto: 'done' }],
        goto: 'hint',
      },
      hint: {
        say: [
          'Deep in the reeds is the Sunken Hollow. A Bogmaw Titan wallows there, caked in mud as hard as stone.',
          'Soak it with Water, then shock it with Electric. Conducted cracks that mud right open.',
        ],
      },
      done: {
        say: ['The marsh is calm since you faced the Bogmaw. My reeds grow straight again.'],
      },
    },
  },
  'ranger-kit': {
    start: 'hello',
    nodes: {
      hello: {
        branch: [
          { if: { beat: VEX }, goto: 'windmills' },
          { if: step('crown-rock'), goto: 'ridge' },
        ],
        goto: 'chat',
      },
      chat: {
        say: [
          'The road east climbs to Ember Pass. The lands beyond are closed for now.',
          'North is Galeback Ridge. Only strong teams should go up to Crown Rock.',
        ],
      },
      ridge: {
        say: [
          'Sails on Crown Rock? So that’s where the wind went! The ridge path starts at the sign north of town.',
          'The trainers up there are tough, and the center here is the last one. Heal first.',
        ],
      },
      windmills: {
        say: ['The windmills are turning again! Galecrest hasn’t sounded this good in years.'],
      },
    },
  },
};

const sideDialogues: Record<string, DialogueInput> = {
  tam: {
    start: 'hello',
    nodes: {
      hello: {
        branch: [
          { if: { quest: c('sandwich-snatcher'), is: 'done' }, goto: 'thanks' },
          { if: { quest: c('sandwich-snatcher'), is: 'active', step: 'tell' }, goto: 'report' },
          { if: { quest: c('sandwich-snatcher'), is: 'active' }, goto: 'remind' },
          { if: { quest: MAIN, is: 'new' }, goto: 'rowan' },
        ],
        goto: 'ask',
      },
      rowan: {
        say: [
          'Elder Rowan was looking for you! He’s by the big house on the west side of the square.',
        ],
        goto: 'ask',
      },
      ask: {
        say: [
          'A Pipwing stole my sandwich in the meadow! Right out of my hand!',
          'Could you catch it? I just want to see the little thief up close.',
        ],
        choices: [
          { text: 'I’ll catch it', do: [{ start: c('sandwich-snatcher') }], goto: 'yay' },
          { text: 'Maybe later' },
        ],
      },
      yay: { say: ['Yay! The meadow is just south of town. Pipwings love the tall grass.'] },
      remind: { say: ['Pipwings flutter around the Sunny Meadow, south of town.'] },
      report: {
        say: [
          'That’s it! That’s the one! Look at its little crumb-covered beak.',
          'Here, I saved these for you. Mom says potions are better than sandwiches anyway.',
        ],
        do: [{ set: c('sandwich-told') }],
      },
      thanks: { say: ['I pack two sandwiches now. One for me, one for the Pipwings!'] },
    },
  },
  'gardener-mo': {
    start: 'hello',
    nodes: {
      hello: {
        branch: [
          { if: { quest: c('lost-orchard'), is: 'done' }, goto: 'thanks' },
          { if: { quest: c('lost-orchard'), is: 'active', step: 'tell' }, goto: 'report' },
          { if: { quest: c('lost-orchard'), is: 'active' }, goto: 'remind' },
        ],
        goto: 'ask',
      },
      ask: {
        say: [
          'My grandmother told me of an orchard she planted with a friend, hidden behind a wall of trees.',
          'Far southeast of town, she said, along the road to the Lookout. I’ve never found the way in.',
        ],
        choices: [
          { text: 'I’ll look for it', do: [{ start: c('lost-orchard') }], goto: 'thank-you' },
          { text: 'Not now' },
        ],
      },
      'thank-you': { say: ['Thank you! Look for a gap in the trees. Grandmother liked secrets.'] },
      remind: { say: ['Southeast, past the meadow road. Look for a gap in the trees!'] },
      report: {
        say: [
          'Hazel is still there? And the trees still bear fruit? Oh, Grandmother would be so happy.',
          'Please, take these. I’ll visit Hazel as soon as the planting is done.',
        ],
        do: [{ set: c('orchard-told') }],
      },
      thanks: { say: ['Hazel sent me a basket of apples. Best I ever tasted!'] },
    },
  },
  'orchard-hazel': {
    start: 'hello',
    nodes: {
      hello: { branch: [{ if: { flag: c('orchard-found') }, goto: 'again' }], goto: 'first' },
      first: {
        say: [
          'Oh! Nobody has found my orchard in years. How did you get through the trees?',
          'I planted these trees long ago with a gardener from Willowmere. Her grandchild still lives there, I hear.',
          'Take these for the road. And tell Willowmere old Hazel says hello.',
        ],
        do: [{ set: c('orchard-found') }, { give: 'core:zorb', count: 3 }],
      },
      again: {
        branch: [{ if: { beat: VEX }, goto: 'wind' }],
        goto: 'still',
      },
      still: { say: ['The blossoms are waiting for the Seedwind. So am I.'] },
      wind: { say: ['The Seedwind is back! The branches will be heavy with fruit this year.'] },
    },
  },
  'tinker-pim': {
    start: 'hello',
    nodes: {
      hello: {
        branch: [
          { if: { quest: c('ringing-shells'), is: 'done' }, goto: 'thanks' },
          { if: { quest: c('ringing-shells'), is: 'active', step: 'tell' }, goto: 'report' },
          { if: { quest: c('ringing-shells'), is: 'active' }, goto: 'remind' },
        ],
        goto: 'ask',
      },
      ask: {
        say: [
          'I’m making a bell for the windmill, but it rings flat. Clunk. Clunk!',
          'They say an Ironshell’s shell rings like a perfect bell. Could you bring one for me to hear?',
        ],
        choices: [
          { text: 'I’ll find one', do: [{ start: c('ringing-shells') }], goto: 'thank-you' },
          { text: 'Not now' },
        ],
      },
      'thank-you': {
        say: ['Wonderful! Ironshells hide in the Bramble Thicket, south of Willowmere.'],
      },
      remind: { say: ['Ironshells hide in the Bramble Thicket. Listen for the ringing!'] },
      report: {
        say: [
          'May I? Just a tap… Ding! Oh, that’s the note! That’s exactly the note!',
          'Here, for your trouble. Your Ironshell can keep its shell. I only needed the sound.',
        ],
        do: [{ set: c('shells-told') }],
      },
      thanks: { say: ['Hear that? Ding! Every time the windmill turns.'] },
    },
  },
  'ferryman-gus': {
    start: 'hello',
    nodes: {
      hello: {
        branch: [
          { if: { quest: c('lights-on-the-water'), is: 'done' }, goto: 'thanks' },
          { if: { quest: c('lights-on-the-water'), is: 'active', step: 'tell' }, goto: 'report' },
          { if: { quest: c('lights-on-the-water'), is: 'active' }, goto: 'remind' },
        ],
        goto: 'ask',
      },
      ask: {
        say: [
          'The ferry to the frozen coast isn’t running yet. And now there are cold lights drifting over the water at night!',
          'My passengers won’t come near the dock. They say the old stones at the Drowned Ruins tell of the lights. Would you look?',
        ],
        choices: [
          { text: 'I’ll look', do: [{ start: c('lights-on-the-water') }], goto: 'thank-you' },
          { text: 'Not now' },
        ],
      },
      'thank-you': {
        say: ['Thank you! The Drowned Ruins are at the far end of the marsh road, to the west.'],
      },
      remind: {
        say: ['The ruins are at the end of the marsh road. Mind the mud on the way.'],
      },
      report: {
        say: [
          'So that’s a Rimewisp? It’s… kind of cute, really. A little cold light.',
          'Wait till my passengers see this! Here, you’ve earned it. Once the ferry runs, your ride is on me.',
        ],
        do: [{ set: c('lights-told') }],
      },
      thanks: {
        say: ['Nobody’s scared of the lights anymore. Now I just need the ferry to run!'],
      },
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
  'sign-willowmere-north': {
    x: 96,
    y: 103,
    name: 'Sign',
    text: ['North: Brookside Trail and Fernhollow.'],
  },
  'sign-willowmere-east': {
    x: 112,
    y: 115,
    name: 'Sign',
    text: [
      'East: the Silverrun bridge, Breezy Downs and Galecrest. Southeast: the orchard road to the Lookout.',
    ],
  },
  'sign-willowmere-west': {
    x: 87,
    y: 118,
    name: 'Sign',
    text: ['West: Lake Willow and Willow Shore. The Reed Marsh lies beyond.'],
  },
  'sign-willowmere-south': {
    x: 101,
    y: 130,
    name: 'Sign',
    text: ['South: Sunny Meadow, the Bramble Thicket and the ferry dock.'],
  },
  'sign-fernhollow-north': {
    x: 100,
    y: 52,
    name: 'Sign',
    text: ['North: the Old Grove and the Heartwood Shrine. Strong teams only!'],
  },
  'sign-fernhollow-west': {
    x: 94,
    y: 57,
    name: 'Sign',
    text: ['West: Fernwood and Deepwood. Beyond them, Mistmere.'],
  },
  'sign-fernhollow': {
    x: 104,
    y: 72,
    name: 'Sign',
    text: ['Fernhollow, home of the Grove Trial. East: Breezy Downs. South: Willowmere.'],
  },
  'sign-galecrest': {
    x: 153,
    y: 109,
    name: 'Sign',
    text: ['Galecrest outpost. The last Zorling center before the ridge.'],
  },
  'sign-galecrest-north': {
    x: 164,
    y: 103,
    name: 'Sign',
    text: ['North: Galeback Ridge and Crown Rock. East: Ember Pass (closed).'],
  },
  'sign-lookout': {
    x: 183,
    y: 151,
    name: 'Sign',
    text: ['Lookout Point. On a clear day you can see all the way to the sea.'],
  },
  'sign-ferry': {
    x: 86,
    y: 196,
    name: 'Sign',
    text: ['Willowmere ferry dock. Ferries to the frozen coast: not running.'],
  },
  'stone-trial': {
    x: 99,
    y: 70,
    name: 'Trial stone',
    text: ['THE GROVE TRIAL', '“No Zorling wins alone. One move sets up, another sets off.”'],
  },
  'stone-circle': {
    x: 135,
    y: 28,
    name: 'Old stone',
    text: [
      'Worn runes ring the stone: “Fire wakes the bark. Water calms the flame. Stone breaks the frost.”',
      'The first wardens wrote down what they learned from the Zorlings here, long before Fernhollow was built.',
    ],
  },
};

/** Stones whose text depends on the story. */
const storySigns: Record<string, NpcInput> = {
  'stone-shrine': {
    name: 'Shrine stone',
    map: MAP,
    x: 100,
    y: 9,
    object: 'sign',
    dialogue: c('stone-shrine'),
  },
  'stone-ruins': {
    name: 'Ruin stone',
    map: MAP,
    x: 21,
    y: 183,
    object: 'sign',
    dialogue: c('stone-ruins'),
  },
};

const stoneDialogues: Record<string, DialogueInput> = {
  'stone-shrine': {
    start: 'hello',
    nodes: {
      hello: {
        say: [
          'Words cut deep into the stone: “The Heartwood breathes out every spring. Its keeper rides the first breath.”',
        ],
        branch: [{ if: { beat: VEX }, goto: 'wind' }],
        goto: 'still',
      },
      still: { say: ['The air here is very still.'] },
      wind: { say: ['A warm wind hums around the stone.'] },
    },
  },
  'stone-ruins': {
    start: 'hello',
    nodes: {
      hello: {
        say: [
          'Most of the words have washed away. One line is still clear:',
          '“…and the cold lights on the water are only wisps of frost, blown south from the frozen coast. They mean no harm.”',
        ],
        do: [{ set: c('ruins-read') }],
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
  'item-hidden-glade': {
    anchor: 'hidden-glade',
    item: 'core:max-potion',
    count: 1,
    where: 'under a mossy root',
  },
  'item-mist-isle': {
    anchor: 'mist-isle',
    item: 'core:max-potion',
    count: 1,
    where: 'in the reeds',
  },
  'item-stone-circle': {
    anchor: 'stone-circle',
    item: 'core:super-potion',
    count: 2,
    where: 'between the stones',
  },
  'item-lookout': { anchor: 'lookout', item: 'core:zorb', count: 5, where: 'behind the railing' },
  'item-drowned-ruins': {
    anchor: 'drowned-ruins',
    item: 'core:super-potion',
    count: 1,
    where: 'in a cracked urn',
  },
};

const BAG_FULL = 5;

function hiddenDialogue(id: string, h: Hidden): DialogueInput {
  const take: DialogueInput['nodes'][string] = {
    say: [`Something is tucked away ${h.where}…`],
    do: [{ give: h.item, count: h.count }, { set: c(id) }],
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

const storyNpcs: Record<string, NpcInput> = {
  'elder-rowan': {
    name: 'Elder Rowan',
    map: MAP,
    anchor: 'elder',
    look: { outfit: 'maroon', hair: 'grey', skin: 'tan' },
    behavior: { kind: 'look', every: [2.5, 5] },
    dialogue: c('elder-rowan'),
  },
  tam: {
    name: 'Tam',
    map: MAP,
    x: 101,
    y: 122,
    look: { outfit: 'sky', hair: 'brown', skin: 'warm' },
    behavior: { kind: 'wander', radius: 3 },
    dialogue: c('tam'),
  },
  'gardener-mo': {
    name: 'Gardener Mo',
    map: MAP,
    x: 108,
    y: 110,
    facing: 'left',
    look: { outfit: 'forest', hair: 'dark', skin: 'deep' },
    behavior: { kind: 'look' },
    dialogue: c('gardener-mo'),
  },
  'warden-elm': {
    name: 'Warden Elm',
    map: MAP,
    anchor: 'trial',
    look: { outfit: 'forest', hair: 'grey', skin: 'warm' },
    dialogue: c('warden-elm'),
  },
  'apprentice-linden': {
    name: 'Apprentice Linden',
    map: MAP,
    x: 103,
    y: 70,
    facing: 'left',
    look: { outfit: 'mustard', hair: 'brown', skin: 'light' },
    dialogue: c('apprentice-linden'),
  },
  'scout-pell': {
    name: 'Scout Pell',
    map: MAP,
    x: 92,
    y: 59,
    facing: 'right',
    look: { outfit: 'forest', hair: 'blonde', skin: 'warm' },
    behavior: { kind: 'look' },
    dialogue: c('scout-pell'),
  },
  'reedcutter-wade': {
    name: 'Reedcutter Wade',
    map: MAP,
    x: 54,
    y: 132,
    facing: 'left',
    look: { outfit: 'mustard', hair: 'grey', skin: 'deep' },
    behavior: { kind: 'look' },
    dialogue: c('reedcutter-wade'),
  },
  'mira-willowmere': {
    name: 'Rival Mira',
    map: MAP,
    x: 99,
    y: 104,
    facing: 'down',
    look: { outfit: 'purple', hair: 'red', skin: 'light' },
    when: { not: { beat: MIRA_1 } },
    dialogue: MIRA_1,
  },
  'mira-fernhollow': {
    name: 'Rival Mira',
    map: MAP,
    x: 100,
    y: 72,
    facing: 'down',
    look: { outfit: 'purple', hair: 'red', skin: 'light' },
    when: { all: [{ badge: GROVE_BADGE }, { not: { beat: MIRA_2 } }] },
    dialogue: MIRA_2,
  },
  'mira-galecrest': {
    name: 'Rival Mira',
    map: MAP,
    x: 161,
    y: 104,
    facing: 'down',
    look: { outfit: 'purple', hair: 'red', skin: 'light' },
    when: { all: [{ badge: GROVE_BADGE }, TITANS_DONE, { not: { beat: MIRA_3 } }] },
    dialogue: MIRA_3,
  },
  'stormcatcher-vex': {
    name: 'Stormcatcher Vex',
    map: MAP,
    anchor: 'boss-crown-rock',
    look: { outfit: 'orange', hair: 'blonde', skin: 'tan' },
    behavior: { kind: 'look' },
    dialogue: VEX,
  },
  'ranger-kit': {
    name: 'Ranger Kit',
    map: MAP,
    anchor: 'ranger',
    look: { outfit: 'orange', hair: 'red', skin: 'light' },
    behavior: { kind: 'look' },
    dialogue: c('ranger-kit'),
  },
  'tinker-pim': {
    name: 'Tinker Pim',
    map: MAP,
    x: 150,
    y: 112,
    facing: 'right',
    look: { outfit: 'navy', hair: 'blonde', skin: 'light' },
    behavior: { kind: 'look' },
    dialogue: c('tinker-pim'),
  },
  'orchard-hazel': {
    name: 'Hazel',
    map: MAP,
    anchor: 'old-orchard',
    look: { outfit: 'white', hair: 'grey', skin: 'warm' },
    behavior: { kind: 'look' },
    dialogue: c('orchard-hazel'),
  },
  'ferryman-gus': {
    name: 'Ferryman Gus',
    map: MAP,
    anchor: 'ferryman',
    look: { outfit: 'navy', hair: 'grey', skin: 'warm' },
    dialogue: c('ferryman-gus'),
  },
};

export const verdaleStoryNpcs: Record<string, NpcInput> = {
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
        when: { not: { flag: c(id) } },
        dialogue: c(id),
      } satisfies NpcInput,
    ]),
  ),
};

export const verdaleStoryDialogues: Record<string, DialogueInput> = {
  ...mainDialogues,
  ...sideDialogues,
  ...stoneDialogues,
  ...Object.fromEntries(Object.entries(HIDDEN).map(([id, h]) => [id, hiddenDialogue(id, h)])),
};

/** Ids of the Verdale signs and stones that sit on a map prop (for tests). */
export const VERDALE_SIGNS: readonly string[] = [...Object.keys(SIGNS), ...Object.keys(storySigns)];
