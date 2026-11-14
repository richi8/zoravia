import { describe, expect, it } from 'vitest';
import { definePack } from '@engine/packs';
import { createBattle, finishBattle, step, type BattleResult } from '@game/battle/logic';
import { loadGameContent, type DialogueInput, type NpcInput, type QuestInput } from '@game/data';
import { applyBattleResult, newParty, type Party } from '@game/player';
import { createZorling } from '@game/progression';
import { corePack } from '@packs/core';
import {
  act,
  advanceQuests,
  DialogueRun,
  holds,
  questLog,
  questState,
  questStep,
  runActions,
  type DialogueView,
} from '.';

const content = loadGameContent([corePack]);
let n = 0;
const z = (species: string, level = 9) =>
  createZorling(content, { uid: `u${n++}`, species: `core:${species}`, level });
const fresh = (over: Partial<Party> = {}): Party => ({
  ...newParty({
    team: [z('emberkit'), z('puddlit'), z('sproutle')],
    bag: { 'core:potion': 2 },
    money: 100,
  }),
  ...over,
});

/** A pack with story content on top of core. */
const pack = (content: {
  dialogues?: Record<string, DialogueInput>;
  quests?: Record<string, QuestInput>;
  npcs?: Record<string, NpcInput>;
}) => definePack({ manifest: { id: 't', version: '1.0.0', dependsOn: ['core'] }, content });
const load = (c: Parameters<typeof pack>[0]) => () => loadGameContent([corePack, pack(c)]);

/** Reads every view of a dialogue, picking `choices` in order when asked. */
function talk(
  c = content,
  id: string,
  party: Party,
  choices: number[] = [],
): {
  party: Party;
  views: DialogueView[];
} {
  const run = new DialogueRun(c, id, party, 'NPC');
  const views: DialogueView[] = [];
  for (let i = 0; i < 50 && run.view; i++) {
    const view = run.view;
    views.push(view);
    run.next(view.choices.length ? choices.shift() : undefined);
  }
  expect(run.done).toBe(true);
  return { party: run.party, views };
}

const said = (views: readonly DialogueView[]) => views.flatMap((v) => [...v.pages, ...v.notes]);

describe('story content validation', () => {
  const quest: QuestInput = {
    name: 'Q',
    steps: [{ id: 'a', text: 'Do it.', done: { flag: 't:a' } }],
  };

  it('core has the sample quest and its dialogues', () => {
    expect(content.quests.require('core:nothing-biting').steps).toHaveLength(3);
    expect(content.npcs.require('core:test-fisher').dialogue).toBe('core:fisher-lou');
  });

  it('rejects broken dialogue graphs', () => {
    expect(load({ dialogues: { d: { start: 'x', nodes: { a: {} } } } })).toThrow(/No such node/);
    expect(load({ dialogues: { d: { start: 'a', nodes: { a: { goto: 'b' } } } } })).toThrow(
      /No node "b"/,
    );
    expect(
      load({
        dialogues: {
          d: { start: 'a', nodes: { a: { choices: [{ text: 'x' }], goto: 'a' } } },
        },
      }),
    ).toThrow(/Choices end a node/);
  });

  it('rejects references to content that does not exist', () => {
    const d = (node: DialogueInput['nodes'][string]) => ({
      dialogues: { d: { start: 'a', nodes: { a: node } } },
    });
    expect(load(d({ do: [{ give: 'core:nope' }] }))).toThrow(/nope/);
    expect(load(d({ do: [{ start: 't:missing' }] }))).toThrow(/missing/);
    expect(load(d({ branch: [{ if: { not: { caught: 'core:nobody' } }, goto: 'a' }] }))).toThrow(
      /nobody/,
    );
    expect(
      load({
        quests: { q: quest },
        ...d({ branch: [{ if: { quest: 't:q', is: 'active', step: 'zzz' }, goto: 'a' }] }),
      }),
    ).toThrow(/no step "zzz"/);
    expect(load({ quests: { q: { ...quest, reward: { items: { 'core:nope': 1 } } } } })).toThrow(
      /nope/,
    );
  });

  it('rejects quests with a repeated step id, and NPCs with both lines and a dialogue', () => {
    const twice = { ...quest, steps: [...quest.steps, ...quest.steps] };
    expect(load({ quests: { q: twice } })).toThrow(/used twice/);
    const npc: NpcInput = { name: 'X', map: 'core:test-region', x: 50, y: 50 };
    expect(load({ npcs: { n: npc } })).toThrow(/lines or dialogue/);
    expect(load({ npcs: { n: { ...npc, lines: ['Hi'], dialogue: 'core:fisher-lou' } } })).toThrow(
      /lines or dialogue/,
    );
    expect(load({ npcs: { n: { ...npc, dialogue: 't:none' } } })).toThrow(/none/);
    expect(load({ npcs: { n: { ...npc, dialogue: 'core:ranger-ode' } } })).not.toThrow();
  });
});

describe('conditions and actions', () => {
  it('test flags, quests, bag, money, Dex and bosses, and combine them', () => {
    const p = fresh({
      flags: { 'core:x': 2 },
      quests: { 'core:nothing-biting': { state: 'active', step: 'tell-lou' } },
      bosses: { 'core:thornwing-titan': { result: 'caught' } },
    });
    const yes = (c: Parameters<typeof holds>[2]) => expect(holds(content, p, c)).toBe(true);
    const no = (c: Parameters<typeof holds>[2]) => expect(holds(content, p, c)).toBe(false);
    yes({ flag: 'core:x' });
    yes({ flag: 'core:x', atLeast: 2 });
    no({ flag: 'core:x', atLeast: 3 });
    no({ flag: 'core:y' });
    yes({ quest: 'core:nothing-biting', is: 'active' });
    yes({ quest: 'core:nothing-biting', is: 'active', step: 'tell-lou' });
    no({ quest: 'core:nothing-biting', is: 'active', step: 'ask-ode' });
    no({ quest: 'core:nothing-biting', is: 'new' });
    yes({ has: 'core:potion', count: 2 });
    no({ has: 'core:potion', count: 3 });
    yes({ money: 100 });
    no({ money: 101 });
    yes({ caught: 'core:emberkit' });
    no({ seen: 'core:voltbat' });
    yes({ boss: 'core:thornwing-titan' });
    yes({ boss: 'core:thornwing-titan', caught: true });
    no({ boss: 'core:verdion' });
    expect(
      holds(content, fresh({ bosses: { 'core:verdion': { result: 'defeated' } } }), {
        boss: 'core:verdion',
        caught: true,
      }),
    ).toBe(false);
    yes({ not: { flag: 'core:y' } });
    yes({ all: [{ flag: 'core:x' }, { money: 50 }] });
    no({ all: [{ flag: 'core:x' }, { money: 500 }] });
    yes({ any: [{ flag: 'core:y' }, { money: 50 }] });
  });

  it('set, count and clear flags; give and take items and money; start a quest once', () => {
    const p0 = fresh();
    const r = runActions(content, p0, [
      { set: 'core:a' },
      { add: 'core:n' },
      { add: 'core:n', by: 2 },
      { set: 'core:b', value: 5 },
      { clear: 'core:b' },
      { give: 'core:potion', count: 9 },
      { take: 'core:zorb' },
      { take: 'core:potion', count: 2 },
      { money: 250 },
      { money: -1000 },
      { start: 'core:nothing-biting' },
      { start: 'core:nothing-biting' },
    ]);
    expect(r.party.flags).toEqual({ 'core:a': 1, 'core:n': 3 });
    // Potion: 2 + 3 (cap 5) − 2 = 3; the missing Zorb takes nothing.
    expect(r.party.bag).toEqual({ 'core:potion': 3 });
    expect(r.party.money).toBe(0);
    expect(questStep(r.party, 'core:nothing-biting')).toBe('ask-ode');
    expect(r.notes).toEqual([
      'You received 3 × Potion.',
      "Your bag can't hold more Potions.",
      'You handed over 2 × Potion.',
      'You received 250 coins.',
      'You paid 350 coins.',
      'New quest: Nothing Biting',
    ]);
    // The input party is untouched.
    expect(p0.flags).toEqual({});
    expect(p0.money).toBe(100);
  });

  it('a quest moves through every step that already holds, then pays its reward', () => {
    // Ode already told, Voltbat already caught: starting goes straight to "Tell Fisher Lou".
    const p = fresh({ flags: { 'core:pond-ode': 1 } });
    const caught = { ...p, dex: { seen: ['core:voltbat'], caught: ['core:voltbat'] } };
    const started = act(content, caught, [{ start: 'core:nothing-biting' }]);
    expect(questStep(started.party, 'core:nothing-biting')).toBe('tell-lou');
    expect(started.notes).toEqual([
      'New quest: Nothing Biting',
      'Quest updated: Catch a wild Voltbat in the meadow.',
      'Quest updated: Tell Fisher Lou.',
    ]);
    const done = act(content, started.party, [{ set: 'core:pond-lou' }]);
    expect(questState(done.party, 'core:nothing-biting')).toBe('done');
    expect(done.party.money).toBe(400);
    expect(done.party.bag['core:super-potion']).toBe(1);
    expect(done.notes).toEqual([
      'Quest complete: Nothing Biting!',
      'You received 300 coins.',
      'You received Super Potion.',
    ]);
    // Nothing more to do: no notes, same party.
    const again = advanceQuests(content, done.party);
    expect(again.notes).toEqual([]);
    expect(again.party).toBe(done.party);
  });

  it('runs the actions of a step when it is done', () => {
    const loop: Record<string, QuestInput> = {
      a: {
        name: 'A',
        steps: [{ id: 's', text: 'A', done: { money: 0 }, do: [{ add: 't:laps' }] }],
      },
    };
    const c = loadGameContent([corePack, pack({ quests: loop })]);
    const r = act(c, fresh(), [{ start: 't:a' }]);
    expect(questState(r.party, 't:a')).toBe('done');
    expect(r.party.flags['t:laps']).toBe(1);
  });
});

describe('dialogue runner', () => {
  const c = loadGameContent([
    corePack,
    pack({
      dialogues: {
        d: {
          start: 'route',
          nodes: {
            route: {
              branch: [{ if: { flag: 't:met' }, goto: 'again' }],
              goto: 'first',
            },
            first: {
              say: ['Hello!', 'Want something?'],
              do: [{ set: 't:met' }],
              choices: [
                { text: 'A potion', do: [{ give: 'core:potion' }], goto: 'bye' },
                { text: 'Rich only', if: { money: 9999 }, goto: 'bye' },
                { text: 'No thanks' },
              ],
            },
            again: { say: ['Back again?'], speaker: 'Other', goto: 'bye' },
            bye: { say: ['Bye!'] },
            hidden: { choices: [{ text: 'x', if: { money: 9999 } }] },
            loop: { goto: 'loop' },
          },
        },
        hidden: { start: 'a', nodes: { a: { choices: [{ text: 'x', if: { money: 9999 } }] } } },
        loop: { start: 'a', nodes: { a: { goto: 'b' }, b: { goto: 'a' } } },
      },
    }),
  ]);

  it('routes, hides choices whose condition fails, and applies the chosen actions', () => {
    const { party, views } = talk(c, 't:d', fresh(), [0]);
    expect(views[0]).toEqual({
      pages: ['Hello!', 'Want something?'],
      speaker: 'NPC',
      notes: [],
      choices: ['A potion', 'No thanks'],
    });
    expect(views[1]).toMatchObject({ pages: [], notes: ['You received Potion.'] });
    expect(views[2]).toMatchObject({ pages: ['Bye!'], speaker: 'NPC' });
    expect(party.bag['core:potion']).toBe(3);
    expect(party.flags['t:met']).toBe(1);
    // Second talk takes the other branch, with the node's own speaker.
    const second = talk(c, 't:d', party);
    expect(second.views.map((v) => [v.speaker, v.pages])).toEqual([
      ['Other', ['Back again?']],
      ['NPC', ['Bye!']],
    ]);
  });

  it('`Q` (no choice) picks the last choice', () => {
    const { party, views } = talk(c, 't:d', fresh(), []);
    expect(views).toHaveLength(1);
    expect(party.bag['core:potion']).toBe(2);
  });

  it('ends at nodes whose choices are all hidden, and on endless routing', () => {
    expect(new DialogueRun(c, 't:hidden', fresh()).done).toBe(true);
    expect(new DialogueRun(c, 't:loop', fresh()).done).toBe(true);
  });
});

describe('sample quest (C26 "done when")', () => {
  it('"Nothing Biting", defined only in pack data, is completable', () => {
    let party = fresh({ bag: { 'core:zorb': 3 } });
    expect(questLog(content, party)).toEqual([]);

    // Ranger Ode has only tips before the quest.
    expect(said(talk(content, 'core:ranger-ode', party).views)).toEqual([
      'Some wild Zorlings are curious and run right at you. Shy ones run away.',
      'If one catches you, it is a battle!',
    ]);

    // Fisher Lou: declining leaves the quest unstarted; accepting starts it.
    party = talk(content, 'core:fisher-lou', party, [1]).party;
    expect(questState(party, 'core:nothing-biting')).toBe('new');
    let r = talk(content, 'core:fisher-lou', party, [0]);
    party = r.party;
    expect(said(r.views)).toContain('New quest: Nothing Biting');
    expect(questStep(party, 'core:nothing-biting')).toBe('ask-ode');
    expect(said(talk(content, 'core:fisher-lou', party).views)[0]).toMatch(/Ranger Ode walks/);

    // Step 1: ask Ranger Ode.
    r = talk(content, 'core:ranger-ode', party);
    party = r.party;
    expect(said(r.views)).toContain('Quest updated: Catch a wild Voltbat in the meadow.');
    expect(questStep(party, 'core:nothing-biting')).toBe('catch-voltbat');

    // Step 2: catch a wild Voltbat through the real battle engine.
    let caught: BattleResult | undefined;
    for (let seed = 1; seed < 40 && !caught; seed++) {
      const wild = { ...z('voltbat', 6), hp: 1 };
      const s0 = createBattle(content, {
        kind: 'wild',
        seed,
        player: party.team,
        opponent: [wild],
        bag: party.bag,
      }).state;
      const out = step(content, s0, {
        kind: 'turn',
        player: { kind: 'item', item: 'core:zorb' },
        opponent: { kind: 'move', slot: 0 },
      });
      if (out.state.outcome === 'caught') caught = finishBattle(content, out.state, { badges: 0 });
    }
    expect(caught?.caught?.species).toBe('core:voltbat');
    party = applyBattleResult(party, caught as BattleResult, {
      opponents: ['core:voltbat'],
    }).party;
    // The overworld checks quests after every battle.
    const moved = advanceQuests(content, party);
    party = moved.party;
    expect(moved.notes).toEqual(['Quest updated: Tell Fisher Lou.']);

    // The log shows the steps reached, the current one last.
    expect(questLog(content, party)[0]).toMatchObject({
      name: 'Nothing Biting',
      from: 'Fisher Lou',
      done: false,
      steps: [
        { text: 'Ask Ranger Ode about the pond.', done: true },
        { text: 'Catch a wild Voltbat in the meadow.', done: true },
        { text: 'Tell Fisher Lou.', done: false },
      ],
      reward: '300 coins, Super Potion',
    });

    // Step 3: tell Fisher Lou → complete, with the reward.
    const money = party.money;
    r = talk(content, 'core:fisher-lou', party);
    party = r.party;
    expect(said(r.views)).toEqual([
      'You caught the Voltbat? Look, the fish are back already!',
      'Here, take this. You earned it.',
      'Quest complete: Nothing Biting!',
      'You received 300 coins.',
      'You received Super Potion.',
    ]);
    expect(questState(party, 'core:nothing-biting')).toBe('done');
    expect(party.money).toBe(money + 300);
    expect(party.bag['core:super-potion']).toBe(1);
    expect(questLog(content, party)[0]?.done).toBe(true);

    // Afterwards Lou only thanks the player, and nothing pays twice.
    r = talk(content, 'core:fisher-lou', party);
    expect(said(r.views)).toEqual(['The fish are biting again, all thanks to you!']);
    expect(r.party.money).toBe(party.money);
  });
});
