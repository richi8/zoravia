/**
 * Test story content (C26): one 3-step quest for the test region, "Nothing Biting", and the
 * dialogues of the two NPCs it involves. Region 1's real campaign comes with C30.
 *
 * Fisher Lou starts it. Ranger Ode explains the pond (sets a flag: step 1), the player
 * catches a wild Voltbat in the meadow (step 2), and telling Lou (another flag: step 3)
 * completes it.
 */

import type { DialogueInput, QuestInput } from '@game/data';

const QUEST = 'core:nothing-biting';

export const quests: Record<string, QuestInput> = {
  'nothing-biting': {
    name: 'Nothing Biting',
    from: 'Fisher Lou',
    summary: 'The pond in town has gone quiet. Fisher Lou wants to know what scares the fish.',
    steps: [
      { id: 'ask-ode', text: 'Ask Ranger Ode about the pond.', done: { flag: 'core:pond-ode' } },
      {
        id: 'catch-voltbat',
        text: 'Catch a wild Voltbat in the meadow.',
        done: { caught: 'core:voltbat' },
      },
      { id: 'tell-lou', text: 'Tell Fisher Lou.', done: { flag: 'core:pond-lou' } },
    ],
    reward: { money: 300, items: { 'core:super-potion': 1 } },
  },
};

export const dialogues: Record<string, DialogueInput> = {
  'fisher-lou': {
    start: 'hello',
    nodes: {
      hello: {
        branch: [
          { if: { quest: QUEST, is: 'done' }, goto: 'thanks' },
          { if: { quest: QUEST, is: 'active', step: 'tell-lou' }, goto: 'report' },
          { if: { quest: QUEST, is: 'active', step: 'ask-ode' }, goto: 'remind-ode' },
          { if: { quest: QUEST, is: 'active' }, goto: 'remind-catch' },
        ],
        goto: 'ask',
      },
      ask: {
        say: [
          'Nothing biting today. Nothing yesterday either.',
          'Something keeps scaring the fish. Ranger Ode knows this pond better than anyone…',
        ],
        choices: [
          { text: "I'll ask Ode", do: [{ start: QUEST }], goto: 'thank-you' },
          { text: 'Good luck!' },
        ],
      },
      'thank-you': { say: ['Would you? Thank you! Ode walks the east side of town.'] },
      'remind-ode': { say: ['Ranger Ode walks the east side of town. Ask about the pond!'] },
      'remind-catch': {
        say: ['A Voltbat zapping the water? Catch one, and maybe the rest stay away.'],
      },
      report: {
        say: [
          'You caught the Voltbat? Look, the fish are back already!',
          'Here, take this. You earned it.',
        ],
        do: [{ set: 'core:pond-lou' }],
      },
      thanks: { say: ['The fish are biting again, all thanks to you!'] },
    },
  },
  'ranger-ode': {
    start: 'hello',
    nodes: {
      hello: {
        branch: [{ if: { quest: QUEST, is: 'active', step: 'ask-ode' }, goto: 'pond' }],
        goto: 'tips',
      },
      tips: {
        say: [
          'Some wild Zorlings are curious and run right at you. Shy ones run away.',
          'If one catches you, it is a battle!',
        ],
      },
      pond: {
        say: [
          'The pond? A wild Voltbat has been zapping the water. Fish hate that.',
          'Voltbats hide in the meadow east of town. Catch one, and it will have better things to do.',
        ],
        do: [{ set: 'core:pond-ode' }],
      },
    },
  },
};
