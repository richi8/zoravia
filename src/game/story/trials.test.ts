import { describe, expect, it } from 'vitest';
import { definePack } from '@engine/packs';
import {
  aiChoice,
  aiReplacement,
  createBattle,
  finishBattle,
  needsReplacement,
  OPPONENT,
  PLAYER,
  step,
  type BattleResult,
  type BattleState,
} from '@game/battle/logic';
import {
  loadGameContent,
  type BadgeInput,
  type DialogueInput,
  type GameContent,
  type NpcInput,
  type TrainerInput,
} from '@game/data';
import { applyBattleResult, bossDone, healTeam, newParty, type Party } from '@game/player';
import { createZorling } from '@game/progression';
import { corePack } from '@packs/core';
import { BADGE_NOTE, DialogueRun, holds, storyBattle, type StoryBattle } from '.';

const content = loadGameContent([corePack]);
let n = 0;
const z = (species: string, level: number) =>
  createZorling(content, { uid: `u${n++}`, species: `core:${species}`, level });

/** A strong team, so story fights in these tests are won. */
const strong = (level = 40): Party =>
  newParty({
    team: [z('torrentoad', level), z('infernyx', level), z('thornwing', level)],
    bag: { 'core:zorb': 3 },
    money: 100,
  });

/** Plays a battle to the end with the trainer AI on both sides; Zorbs at a Subdued boss. */
function play(c: GameContent, plan: StoryBattle, badges: number): BattleResult {
  let state: BattleState = createBattle(c, plan.setup).state;
  for (let guard = 0; state.phase !== 'ended' && guard < 400; guard++) {
    if (state.phase === 'replace') {
      const side = needsReplacement(state, OPPONENT) ? OPPONENT : PLAYER;
      state = step(c, state, { kind: 'replace', side, to: aiReplacement(c, state, side) }).state;
      continue;
    }
    const foe = state.sides[OPPONENT].team[state.sides[OPPONENT].active];
    const player = foe?.boss?.subdued
      ? { kind: 'item' as const, item: 'core:zorb' }
      : aiChoice(c, state, PLAYER, 'trainer');
    const opponent = aiChoice(c, state, OPPONENT, state.kind === 'wild' ? 'wild' : 'trainer');
    state = step(c, state, { kind: 'turn', player, opponent }).state;
  }
  expect(state.phase).toBe('ended');
  return finishBattle(c, state, { badges });
}

interface Talked {
  readonly party: Party;
  readonly pages: string[];
  readonly notes: string[];
  readonly battles: StoryBattle[];
  readonly results: BattleResult[];
}

/**
 * Runs a dialogue like the overworld does: pages, choices in order, and every battle node
 * played through the real engine with the result written back.
 */
function talk(c: GameContent, id: string, party: Party, choices: number[] = []): Talked {
  const run = new DialogueRun(c, id, party, 'NPC');
  const out: Talked = { party, pages: [], notes: [], battles: [], results: [] };
  for (let i = 0; i < 50 && run.view; i++) {
    const view = run.view;
    out.pages.push(...view.pages);
    out.notes.push(...view.notes);
    if (view.battle) {
      const plan = storyBattle(c, run.party, view.battle, 1000 + i);
      if (!plan) {
        run.battleOver(run.party, false);
        continue;
      }
      out.battles.push(plan);
      const result = play(c, plan, run.party.badges.length);
      out.results.push(result);
      const applied = applyBattleResult(run.party, result, plan.apply).party;
      run.battleOver(applied, result.outcome === 'win' || result.outcome === 'caught');
      continue;
    }
    run.next(view.choices.length ? choices.shift() : undefined);
  }
  expect(run.done).toBe(true);
  return { ...out, party: run.party };
}

const pack = (c: {
  badges?: Record<string, BadgeInput>;
  trainers?: Record<string, TrainerInput>;
  dialogues?: Record<string, DialogueInput>;
  npcs?: Record<string, NpcInput>;
}) => definePack({ manifest: { id: 't', version: '1.0.0', dependsOn: ['core'] }, content: c });
const load = (c: Parameters<typeof pack>[0]) => () => loadGameContent([corePack, pack(c)]);

const team = [{ species: 'core:emberkit', level: 5 }];

describe('trainer and badge data', () => {
  it('rejects badly formed trainers, battle nodes and Zorling NPCs', () => {
    expect(load({ trainers: { a: { name: 'A', teams: [{ badges: 1, team }] } } })).toThrow(
      /first team must start at 0/,
    );
    expect(
      load({ trainers: { a: { name: 'A', teams: [{ team }, { badges: 0, team }] } } }),
    ).toThrow(/go up in badges/);
    const titan = { species: 'core:thornwing', level: 20, boss: 'core:thornwing-titan' };
    expect(load({ trainers: { a: { name: 'A', teams: [{ team: [titan, titan] }] } } })).toThrow(
      /one boss per team/,
    );
    const wrong = { species: 'core:sproutle', level: 20, boss: 'core:thornwing-titan' };
    expect(load({ trainers: { a: { name: 'A', teams: [{ team: [wrong] }] } } })).toThrow(
      /is not a core:sproutle/,
    );
    expect(
      load({
        trainers: { a: { name: 'A', teams: [{ team: [{ species: 'core:nope', level: 3 }] }] } },
      }),
    ).toThrow(/core:nope/);
    const battle = { trainer: 'core:apprentice-fern' };
    expect(load({ dialogues: { d: { start: 'a', nodes: { a: { battle, goto: 'a' } } } } })).toThrow(
      /A battle ends a node/,
    );
    expect(load({ dialogues: { d: { start: 'a', nodes: { a: { win: 'a' } } } } })).toThrow(
      /win needs a battle/,
    );
    expect(load({ dialogues: { d: { start: 'a', nodes: { a: { battle, win: 'b' } } } } })).toThrow(
      /No node "b"/,
    );
    expect(
      load({ dialogues: { d: { start: 'a', nodes: { a: { battle: { boss: 'core:nope' } } } } } }),
    ).toThrow(/core:nope/);
    expect(
      load({
        npcs: {
          g: {
            name: 'G',
            map: 'core:test-region',
            x: 1,
            y: 1,
            zorling: 'core:glacivar',
            behavior: { kind: 'wander' },
            lines: ['…'],
          },
        },
      }),
    ).toThrow(/does not wander/);
    expect(
      load({
        npcs: {
          g: {
            name: 'G',
            map: 'core:test-region',
            x: 1,
            y: 1,
            lines: ['…'],
            when: { badge: 'x:y' },
          },
        },
      }),
    ).toThrow(/x:y/);
  });
});

describe('story battles', () => {
  it('picks the team for the badges held and scales story bosses per badge', () => {
    const c = loadGameContent([
      corePack,
      pack({
        badges: {
          b1: { name: 'One', type: 'core:fire' },
          b2: { name: 'Two', type: 'core:ice' },
        },
      }),
    ]);
    const fight = (badges: string[], id: string) =>
      storyBattle(c, { ...strong(), badges }, { trainer: id }, 1) as StoryBattle;
    // Rival: team by badges, then +4 per badge above that team's threshold.
    expect(fight([], 'core:rival-mira').setup.opponent.map((x) => [x.species, x.level])).toEqual([
      ['core:emberkit', 7],
      ['core:voltbat', 6],
    ]);
    const one = fight(['t:b1'], 'core:rival-mira').setup.opponent;
    expect(one.map((x) => [x.species, x.level])).toEqual([
      ['core:blazekit', 17],
      ['core:voltbat', 16],
      ['core:ironshell', 16],
    ]);
    expect(fight(['t:b1', 't:b2'], 'core:rival-mira').setup.opponent.map((x) => x.level)).toEqual([
      21, 20, 20,
    ]);
    // Trial leader: +4 per badge held; set moves are kept.
    const oak = fight(['t:b1', 't:b2'], 'core:warden-oak');
    expect(oak.setup.opponent.map((x) => x.level)).toEqual([19, 20, 21]);
    expect(oak.setup.opponent[2]?.moves).toEqual(['core:gust', 'core:vine-snap', 'core:mud-toss']);
    expect(oak.setup.kind).toBe('trainer');
    expect(oak.trainer).toBe('Warden Oak');
    expect(oak.prize).toBe(900);
  });

  it('puts a trainer’s boss member in boss form without logging the boss', () => {
    const c = loadGameContent([
      corePack,
      pack({
        trainers: {
          boss: {
            name: 'Boss Vex',
            teams: [
              {
                team: [
                  { species: 'core:ironshell', level: 20 },
                  { species: 'core:thornwing', level: 24, boss: 'core:thornwing-titan' },
                ],
              },
            ],
            prize: 1000,
          },
        },
      }),
    ]);
    const plan = storyBattle(c, strong(45), { trainer: 't:boss' }, 3) as StoryBattle;
    expect(plan.setup.boss).toEqual({ id: 'core:thornwing-titan', slot: 1 });
    const result = play(c, plan, 0);
    expect(result.outcome).toBe('win');
    expect(result.caught).toBeNull();
    const party = applyBattleResult(strong(45), result, plan.apply).party;
    expect(bossDone(party.bosses, 'core:thornwing-titan')).toBe(false);
    expect(party.trainers['t:boss']).toEqual({ wins: 1 });
  });
});

describe('sample trial and rival (core pack)', () => {
  it('runs the Grove Trial end to end: Fern, then Oak, the badge, then rematches', () => {
    let party = strong(30);
    const keeper = (p: Party) => talk(content, 'core:keeper-bryn', p).pages[0];
    expect(keeper(party)).toMatch(/This is the Grove Trial/);

    // Oak first: sent to Fern, no battle.
    let t = talk(content, 'core:warden-oak', party);
    expect(t.battles).toHaveLength(0);
    expect(t.pages[0]).toMatch(/apprentice Fern/);

    // Fern: a trainer battle from pack data, won through the real engine.
    t = talk(content, 'core:apprentice-fern', party);
    expect(t.battles).toHaveLength(1);
    expect(t.results[0]?.outcome).toBe('win');
    expect(t.pages.at(-1)).toMatch(/You pass!/);
    expect(t.party.money).toBe(100 + 240);
    expect(t.party.trainers).toEqual({ 'core:apprentice-fern': { wins: 1 } });
    party = t.party;
    expect(keeper(party)).toMatch(/Warden Oak waits/);
    // Fern again before the badge: no second battle.
    expect(talk(content, 'core:apprentice-fern', party).battles).toHaveLength(0);

    // Oak: the leader battle, then the badge (with its note).
    t = talk(content, 'core:warden-oak', party);
    expect(t.results[0]?.outcome).toBe('win');
    expect(t.notes).toEqual([`${BADGE_NOTE}Grove Badge!`]);
    expect(t.party.badges).toEqual(['core:grove-badge']);
    expect(t.party.money).toBe(party.money + 900);
    party = t.party;
    expect(keeper(party)).toMatch(/Grove Badge suits you/);
    expect(holds(content, party, { badges: 1 })).toBe(true);

    // Rematches: higher levels, the rematch prize once, then only XP.
    t = talk(content, 'core:apprentice-fern', party, [0]);
    expect(t.battles[0]?.rematch).toBe(true);
    expect(t.battles[0]?.setup.opponent.map((x) => x.level)).toEqual([16, 17]);
    expect(t.party.money).toBe(party.money + 200);
    expect(t.party.trainers['core:apprentice-fern']).toEqual({ wins: 2 });
    const again = talk(content, 'core:apprentice-fern', t.party, [0]);
    expect(again.battles[0]?.prize).toBe(0);
    expect(again.party.money).toBe(t.party.money);
    expect(again.results[0]?.xp).toBeGreaterThan(0);
    // "Not now" (also what `Q` picks) skips the rematch.
    expect(talk(content, 'core:apprentice-fern', party, [1]).battles).toHaveLength(0);
    // Oak's rematch: +10 levels (story boss scaling counts badges above 0: +4, it is held now).
    const oak = talk(content, 'core:warden-oak', party, [0]).battles[0];
    expect(oak?.setup.opponent.map((x) => x.level)).toEqual([25, 26, 27]);
  });

  it('meets Rival Mira twice: she leaves once beaten and comes back after the badge', () => {
    const at = (id: string) => content.npcs.require(id);
    const here = (id: string, p: Party) => {
      const when = at(id).when;
      return !when || holds(content, p, when);
    };
    let party = strong(30);
    expect(here('core:rival-mira', party)).toBe(true);
    expect(here('core:rival-mira-grove', party)).toBe(false);

    const t = talk(content, 'core:rival-mira', party);
    expect(t.battles[0]?.trainer).toBe('Rival Mira');
    expect(t.results[0]?.outcome).toBe('win');
    expect(t.pages.at(-1)).toMatch(/See you at the trial/);
    expect(t.party.money).toBe(100 + 300);
    party = t.party;
    expect(here('core:rival-mira', party)).toBe(false);

    party = { ...party, badges: ['core:grove-badge'] };
    expect(here('core:rival-mira-grove', party)).toBe(true);
    const t2 = talk(content, 'core:rival-mira-grove', party);
    expect(t2.results[0]?.outcome).toBe('win');
    // Story boss scaling: one badge held → +4.
    expect(t2.battles[0]?.setup.opponent.map((x) => x.level)).toEqual([16, 16, 17]);
    expect(here('core:rival-mira-grove', t2.party)).toBe(false);
  });

  it('ends the dialogue when a story battle is lost', () => {
    const weak = newParty({ team: [z('sproutle', 3)], money: 100 });
    const t = talk(content, 'core:rival-mira', weak);
    expect(t.results[0]?.outcome).toBe('lose');
    expect(t.pages.some((p) => /See you at the trial/.test(p))).toBe(false);
    expect(t.party.trainers).toEqual({});
    expect(t.party.money).toBe(100);
  });

  it('fights the legendary once per save, then offers rematches it cannot be caught in', () => {
    const shrine = content.npcs.require('core:glacivar');
    let party = strong(60);
    // "Step back" (the last choice) leaves it waiting.
    expect(talk(content, 'core:glacivar-shrine', party, [1]).battles).toHaveLength(0);

    const t = talk(content, 'core:glacivar-shrine', party, [0]);
    const plan = t.battles[0] as StoryBattle;
    expect(plan.setup.kind).toBe('wild');
    expect(plan.setup.boss).toEqual({ id: 'core:glacivar' });
    expect(t.results[0]?.outcome).toBe('caught');
    expect(t.pages.at(-1)).toMatch(/shrine is quiet/);
    // Rematches play the boss with the trainer AI, a much harder fight: bring a bigger team.
    party = { ...t.party, team: strong(85).team };
    expect(bossDone(party.bosses, 'core:glacivar')).toBe(true);
    expect(party.dex.caught).toContain('core:glacivar');
    // Caught: the shrine NPC is gone.
    expect(holds(content, party, shrine.when ?? { badges: 0 })).toBe(false);

    // Rematch (e.g. through the dialogue again): a trainer-style boss battle 5 levels up.
    const r = talk(content, 'core:glacivar-shrine', party, [0]);
    const re = r.battles[0] as StoryBattle;
    expect(re.rematch).toBe(true);
    expect(re.setup.kind).toBe('trainer');
    expect(re.trainer).toBe('Glacivar');
    expect(re.setup.opponent[0]?.level).toBe(45);
    expect(r.results[0]?.outcome).toBe('win');
    expect(r.results[0]?.caught).toBeNull();
    expect(r.party.money).toBe(party.money + 2000);
    expect(r.party.bosses['core:glacivar']).toEqual({ result: 'caught', rematches: 1 });
    expect(r.pages.at(-1)).toMatch(/rise again/);
    // Second rematch: no money, only XP.
    const r2 = talk(content, 'core:glacivar-shrine', healTeam(content, r.party), [0]);
    expect(r2.battles[0]?.prize).toBe(0);
    expect(r2.party.bosses['core:glacivar']).toEqual({ result: 'caught', rematches: 2 });
  });

  it('skips the battle of a boss that is done and has no rematch', () => {
    const c = loadGameContent([
      corePack,
      pack({
        dialogues: {
          d: {
            start: 'a',
            nodes: {
              a: { say: ['Grr!'], battle: { boss: 'core:thornwing-titan' }, win: 'b' },
              b: { say: ['Won'] },
            },
          },
        },
      }),
    ]);
    // Fake a boss without a rematch by dropping it from the plan's input.
    const party: Party = {
      ...strong(),
      bosses: { 'core:thornwing-titan': { result: 'defeated' } },
    };
    const noRematch = {
      ...c,
      bosses: {
        ...c.bosses,
        require: (id: string) => ({ ...c.bosses.require(id), rematch: undefined }),
      },
    } as unknown as GameContent;
    expect(storyBattle(noRematch, party, { boss: 'core:thornwing-titan' }, 1)).toBeUndefined();
    // The runner: a battle view moved past without a battle ends the dialogue.
    const run = new DialogueRun(c, 't:d', party, 'NPC');
    expect(run.view?.battle).toEqual({ boss: 'core:thornwing-titan' });
    expect(run.view?.pages).toEqual(['Grr!']);
    run.next();
    expect(run.done).toBe(true);
  });
});
