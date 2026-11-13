/**
 * Test trial and trainers (C27) for the test region, kept as debug content. Region 1's real
 * trial, rival and region boss are in `verdale-story.ts` (C30); this trial gives the same
 * Grove Badge.
 *
 * - The **Grove Trial**: beat Apprentice Fern, then Warden Oak, who gives the Grove Badge.
 *   Oak is a story boss: +4 levels for every badge the player already holds when coming here
 *   from another region (sandbox start).
 * - **Rival Mira** meets the player twice: at the east edge of town before the trial, and by
 *   the trial after the badge. Her first team depends on the badges held, and both fights
 *   scale like story bosses.
 * - Fern and Oak can be fought again once the badge is won (rematches).
 */

import type { DialogueInput, TrainerInput } from '@game/data';

const BADGE = 'core:grove-badge';
const FERN = 'core:apprentice-fern';
const OAK = 'core:warden-oak';

export const trainers: Record<string, TrainerInput> = {
  'apprentice-fern': {
    name: 'Apprentice Fern',
    teams: [
      {
        team: [
          { species: 'core:sproutle', level: 8 },
          { species: 'core:puddlit', level: 9 },
        ],
      },
    ],
    prize: 240,
    rematch: { levels: 8, prize: 200 },
  },
  'warden-oak': {
    name: 'Warden Oak',
    teams: [
      {
        team: [
          { species: 'core:voltbat', level: 11 },
          { species: 'core:sproutle', level: 12 },
          {
            species: 'core:thornwing',
            level: 13,
            moves: ['core:gust', 'core:vine-snap', 'core:mud-toss'],
          },
        ],
      },
    ],
    prize: 900,
    perBadge: 4,
    rematch: { levels: 10, prize: 700 },
  },
  'rival-mira': {
    name: 'Rival Mira',
    teams: [
      {
        team: [
          { species: 'core:emberkit', level: 7 },
          { species: 'core:voltbat', level: 6 },
        ],
      },
      {
        // Met after a badge from another region: a stronger team.
        badges: 1,
        team: [
          { species: 'core:blazekit', level: 17 },
          { species: 'core:voltbat', level: 16 },
          { species: 'core:ironshell', level: 16 },
        ],
      },
    ],
    prize: 300,
    perBadge: 4,
  },
  'rival-mira-grove': {
    name: 'Rival Mira',
    teams: [
      {
        team: [
          { species: 'core:emberkit', level: 12 },
          { species: 'core:voltbat', level: 12 },
          { species: 'core:ironshell', level: 13 },
        ],
      },
    ],
    prize: 600,
    perBadge: 4,
  },
};

/** Dialogues of the trial, the rival and the legendary's shrine. */
export const dialogues: Record<string, DialogueInput> = {
  'keeper-bryn': {
    start: 'hello',
    nodes: {
      hello: {
        branch: [
          { if: { badge: BADGE }, goto: 'done' },
          { if: { beat: FERN }, goto: 'oak' },
        ],
        goto: 'intro',
      },
      intro: {
        say: [
          'This is the Grove Trial. Beat Apprentice Fern by the center, then Warden Oak by the south gate.',
          'Win, and Oak gives you the Grove Badge. Badges let your Zorlings grow stronger.',
        ],
      },
      oak: { say: ['Fern let you through? Warden Oak waits by the south gate.'] },
      done: { say: ['The Grove Badge suits you. Fern and Oak will gladly fight you again.'] },
    },
  },
  'apprentice-fern': {
    start: 'hello',
    nodes: {
      hello: {
        branch: [
          { if: { badge: BADGE }, goto: 'rematch' },
          { if: { beat: FERN }, goto: 'after' },
        ],
        goto: 'challenge',
      },
      challenge: {
        say: ["You're taking the Grove Trial? You'll have to get past me first!"],
        battle: { trainer: FERN },
        win: 'won',
      },
      won: { say: ['You pass! Warden Oak waits by the south gate.'] },
      after: { say: ['Warden Oak waits by the south gate. Good luck!'] },
      rematch: {
        say: ["I've trained since you beat me. Want to see?"],
        choices: [{ text: "Let's battle", goto: 'fight-again' }, { text: 'Not now' }],
      },
      'fight-again': { battle: { trainer: FERN }, win: 'won-again' },
      'won-again': { say: ['Still too strong for me!'] },
    },
  },
  'warden-oak': {
    start: 'hello',
    nodes: {
      hello: {
        branch: [
          { if: { badge: BADGE }, goto: 'rematch' },
          { if: { beat: FERN }, goto: 'challenge' },
        ],
        goto: 'not-yet',
      },
      'not-yet': { say: ['Show my apprentice Fern what you can do first.'] },
      challenge: {
        say: ['So Fern let you through. Then show me how you and your Zorlings work together!'],
        battle: { trainer: OAK },
        win: 'won',
      },
      won: {
        say: ['Well fought. You read my Zorlings like the forest reads the wind.', 'Take this.'],
        do: [{ badge: BADGE }],
      },
      rematch: {
        say: ['Back for another lesson? I will not hold back this time.'],
        choices: [{ text: 'Battle', goto: 'fight-again' }, { text: 'Later' }],
      },
      'fight-again': { battle: { trainer: OAK }, win: 'won-again' },
      'won-again': { say: ['Splendid. The grove is in good hands.'] },
    },
  },
  'rival-mira': {
    start: 'hello',
    nodes: {
      hello: {
        say: [
          "There you are! I heard you're going for the Grove Trial.",
          "Let's see if you're ready. I won't go easy on you!",
        ],
        battle: { trainer: 'core:rival-mira' },
        win: 'won',
      },
      won: { say: ["Fine, you're ready. See you at the trial!"] },
    },
  },
  'rival-mira-grove': {
    start: 'hello',
    nodes: {
      hello: {
        say: ['You got the Grove Badge?! Then beating you now counts double!'],
        battle: { trainer: 'core:rival-mira-grove' },
        win: 'won',
      },
      won: { say: ["Again?! Next region, I'll be the one with the badge first."] },
    },
  },
  'glacivar-shrine': {
    start: 'hello',
    nodes: {
      hello: {
        branch: [{ if: { boss: 'core:glacivar' }, goto: 'back' }],
        goto: 'first',
      },
      first: {
        say: ['The air turns to frost. Glacivar watches you from the ice.'],
        choices: [{ text: 'Face it', goto: 'fight' }, { text: 'Step back' }],
      },
      fight: { battle: { boss: 'core:glacivar' }, win: 'after' },
      after: {
        branch: [{ if: { caught: 'core:glacivar' }, goto: 'caught' }],
        goto: 'beaten',
      },
      caught: { say: ['The frost lifts. The shrine is quiet now.'] },
      beaten: { say: ['Glacivar sinks back into the ice. It will rise again, stronger.'] },
      back: {
        say: ['Glacivar has risen again, colder than before.'],
        choices: [{ text: 'Face it', goto: 'rematch' }, { text: 'Step back' }],
      },
      rematch: { battle: { boss: 'core:glacivar' }, win: 'beaten' },
    },
  },
};
