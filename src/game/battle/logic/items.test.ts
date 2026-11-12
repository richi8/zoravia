import { describe, expect, it } from 'vitest';
import { definePack } from '@engine/packs';
import { loadGameContent } from '@game/data';
import type { Bag } from '@game/inventory';
import { createZorling, statsOf, type Zorling } from '@game/progression';
import { corePack } from '@packs/core';
import {
  CAPTURE_WOBBLES,
  captureChance,
  captureWobbles,
  createBattle,
  finishBattle,
  legalChoices,
  OPPONENT,
  PLAYER,
  step,
  type BattleEvent,
  type BattleKind,
  type BattleState,
  type Choice,
  type StepResult,
} from '.';

/** A slow, sturdy species that is hard to catch, to check `catchRate`. */
const modPack = definePack({
  manifest: { id: 'm', version: '1.0.0', dependsOn: ['core'] },
  content: {
    species: {
      rarebird: {
        name: 'Rarebird',
        types: ['core:wind'],
        baseStats: { hp: 100, attack: 60, defense: 100, speed: 10 },
        learnset: [{ level: 1, move: 'core:gust' }],
        catchRate: 0.5,
      },
    },
  },
});
const content = loadGameContent([corePack, modPack]);
let uid = 0;
const make = (species: string, level = 20, extra: Partial<Zorling> = {}): Zorling => ({
  ...createZorling(content, { uid: `i${uid++}`, species: `core:${species}`, level }),
  ...extra,
});
const maxHp = (z: Zorling): number => statsOf(content, z).hp;

const start = (
  player: Zorling[],
  opponent: Zorling[],
  bag: Bag,
  opts: { kind?: BattleKind; seed?: number } = {},
): StepResult =>
  createBattle(content, {
    kind: opts.kind ?? (opponent.length > 1 ? 'trainer' : 'wild'),
    seed: opts.seed ?? 1,
    player,
    opponent,
    bag,
  });

const MOVE0: Choice = { kind: 'move', slot: 0 };
const turn = (s: BattleState, player: Choice, opponent: Choice = MOVE0): StepResult =>
  step(content, s, { kind: 'turn', player, opponent });
const potion = (target: number, item = 'core:potion'): Choice => ({ kind: 'item', item, target });
const ZORB: Choice = { kind: 'item', item: 'core:zorb' };
const kinds = (events: readonly BattleEvent[]): string[] => events.map((e) => e.kind);
const itemChoices = (s: BattleState): Choice[] =>
  legalChoices(content, s, PLAYER).filter((c) => c.kind === 'item');

describe('items in battle: potions', () => {
  it('offers a potion only for team members that are hurt and have not fainted', () => {
    const hurt = make('emberkit', 20, { hp: 10 });
    const full = make('puddlit');
    const out = make('sproutle', 20, { hp: 0 });
    const { state } = start([hurt, full, out], [make('voltbat'), make('ironshell')], {
      'core:potion': 1,
      'core:zorb': 3,
      'core:super-potion': 0,
    });
    // No capture item in a trainer battle, nothing for an empty stack.
    expect(itemChoices(state)).toEqual([potion(0)]);
    // The opponent never uses items.
    expect(legalChoices(content, state, OPPONENT).some((c) => c.kind === 'item')).toBe(false);
  });

  it('heals, costs the turn, goes before moves and takes the potion from the bag', () => {
    const me = make('ironshell', 20, { hp: 5 });
    const wild = make('voltbat', 20); // much faster than Ironshell
    const s0 = start([me], [wild], { 'core:potion': 2 }).state;
    const { state, events } = turn(s0, potion(0));
    expect(kinds(events).slice(0, 4)).toEqual(['turnStart', 'itemUsed', 'heal', 'useMove']);
    expect(events).toContainEqual({ kind: 'heal', side: PLAYER, slot: 0, amount: 30, hp: 35 });
    // The player did not move this turn: the only move is the foe's.
    expect(events.filter((e) => e.kind === 'useMove')).toEqual([
      { kind: 'useMove', side: OPPONENT, move: wild.moves[0] },
    ]);
    expect(state.bag).toEqual({ 'core:potion': 1 });
    expect(s0.bag).toEqual({ 'core:potion': 2 });
  });

  it('never heals above max HP; Max Potion heals fully; works on a benched member', () => {
    const active = make('emberkit', 20);
    const benched = make('puddlit', 20, { hp: 1 });
    const max = maxHp(benched);
    const s0 = start([active, benched], [make('voltbat'), make('ironshell')], {
      'core:max-potion': 1,
    }).state;
    const { state, events } = turn(s0, potion(1, 'core:max-potion'));
    expect(events).toContainEqual({
      kind: 'itemUsed',
      side: PLAYER,
      item: 'core:max-potion',
      slot: 1,
    });
    expect(events).toContainEqual({
      kind: 'heal',
      side: PLAYER,
      slot: 1,
      amount: max - 1,
      hp: max,
    });
    expect(state.sides[PLAYER].team[1]?.hp).toBe(max);
    expect(state.bag).toEqual({});
    expect(itemChoices(state)).toEqual([]);

    const nearlyFull = make('emberkit', 20, { hp: maxHp(active) - 4 });
    const t = turn(start([nearlyFull], [make('voltbat')], { 'core:potion': 1 }).state, potion(0));
    expect(t.events).toContainEqual(
      expect.objectContaining({ kind: 'heal', slot: 0, amount: 4, hp: maxHp(active) }),
    );
  });

  it('rejects items that are not in the bag or not usable', () => {
    const s = start([make('emberkit', 20, { hp: 10 })], [make('voltbat')], {}).state;
    expect(() => turn(s, potion(0))).toThrow(/cannot choose/);
    const s2 = start([make('emberkit', 20, { hp: 10 })], [make('voltbat')], {
      'core:potion': 1,
    }).state;
    expect(() => turn(s2, { kind: 'item', item: 'core:potion' })).toThrow(/cannot choose/);
    expect(() => turn(s2, potion(3))).toThrow(/cannot choose/);
    expect(() =>
      createBattle(content, {
        kind: 'wild',
        seed: 1,
        player: [make('emberkit')],
        opponent: [make('voltbat')],
        bag: { 'core:nope': 1 },
      }),
    ).toThrow();
  });

  it('returns the bag after the battle', () => {
    const me = make('infernyx', 60, { hp: 50 });
    let r = start([me], [make('sproutle', 3)], { 'core:potion': 3 });
    r = turn(r.state, potion(0));
    while (r.state.phase !== 'ended') r = turn(r.state, MOVE0);
    const result = finishBattle(content, r.state, { badges: 0 });
    expect(result.outcome).toBe('win');
    expect(result.bag).toEqual({ 'core:potion': 2 });
    expect(result.caught).toBeNull();
  });
});

describe('capture', () => {
  it('chance grows as HP drops, with conditions and with strength / catch rate', () => {
    const base = { maxHp: 100, strength: 1, catchRate: 1, hasCondition: false };
    expect(captureChance({ ...base, hp: 100 })).toBeCloseTo(0.1);
    expect(captureChance({ ...base, hp: 50 })).toBeCloseTo(0.475);
    expect(captureChance({ ...base, hp: 1 })).toBeCloseTo(0.8425);
    expect(captureChance({ ...base, hp: 50, hasCondition: true })).toBeCloseTo(0.57);
    expect(captureChance({ ...base, hp: 1, hasCondition: true })).toBe(1);
    expect(captureChance({ ...base, hp: 50, catchRate: 0.5 })).toBeCloseTo(0.2375);
    expect(captureChance({ ...base, hp: 100, strength: 20 })).toBe(1);
  });

  it('wobbles: 3 on a catch, more the closer a miss came', () => {
    expect(captureWobbles(0.5, 0.2)).toBe(CAPTURE_WOBBLES);
    expect(captureWobbles(0.5, 0.55)).toBe(2);
    expect(captureWobbles(0.5, 0.9)).toBe(1);
    expect(captureWobbles(0.1, 0.9)).toBe(0);
  });

  it('a catch ends the battle at once and costs the Zorb', () => {
    const wild = make('sproutle', 10);
    const weak = { ...wild, hp: 1 };
    const r0 = start([make('ironshell', 10)], [weak], { 'core:zorb': 2 });
    expect(itemChoices(r0.state)).toEqual([ZORB]);
    // Find a seed where the ~84% throw works.
    for (let seed = 1; seed < 20; seed++) {
      const r = turn(
        start([make('ironshell', 10)], [weak], { 'core:zorb': 2 }, { seed }).state,
        ZORB,
      );
      const capture = r.events.find((e) => e.kind === 'capture');
      if (!capture || !capture.success) continue;
      expect(kinds(r.events)).toEqual(['turnStart', 'itemUsed', 'capture', 'end']);
      expect(capture).toEqual({ kind: 'capture', item: 'core:zorb', success: true, wobbles: 3 });
      expect(r.state.outcome).toBe('caught');
      expect(r.state.bag).toEqual({ 'core:zorb': 1 });
      const result = finishBattle(content, r.state, { badges: 0 });
      expect(result.outcome).toBe('caught');
      expect(result.caught).toEqual({ ...weak, hp: 1 });
      expect(result.xp).toBeGreaterThan(0); // a catch gives the XP of a win
      expect(result.bag).toEqual({ 'core:zorb': 1 });
      return;
    }
    throw new Error('No seed caught it');
  });

  it('a failed throw costs the Zorb and the turn; the wild Zorling still moves', () => {
    for (let seed = 1; seed < 50; seed++) {
      const r = turn(
        start([make('ironshell', 10)], [make('sproutle', 10)], { 'core:zorb': 1 }, { seed }).state,
        ZORB,
      );
      const capture = r.events.find((e) => e.kind === 'capture');
      if (!capture || capture.success) continue;
      expect(capture.wobbles).toBeLessThan(CAPTURE_WOBBLES);
      expect(r.state.phase).toBe('choose');
      expect(r.state.bag).toEqual({});
      expect(
        r.events.filter((e) => e.kind === 'useMove').map((e) => 'side' in e && e.side),
      ).toEqual([OPPONENT]);
      expect(itemChoices(r.state)).toEqual([]);
      return;
    }
    throw new Error('Every throw worked');
  });

  it('rates match the chance over many seeds (full HP: 10%; catch rate 0.5: 5%)', () => {
    const rate = (species: string): number => {
      let caught = 0;
      for (let seed = 0; seed < 2000; seed++) {
        const wild = { ...createZorling(content, { uid: 'w', species, level: 10 }) };
        const r = turn(
          start([make('ironshell', 10)], [wild], { 'core:zorb': 1 }, { seed }).state,
          ZORB,
        );
        if (r.state.outcome === 'caught') caught++;
      }
      return caught / 2000;
    };
    expect(rate('core:sproutle')).toBeCloseTo(0.1, 1);
    expect(rate('m:rarebird')).toBeCloseTo(0.05, 1);
    expect(content.species.require('core:sproutle').catchRate).toBe(1);
  });

  it('a condition on the wild Zorling makes it easier (×1.2)', () => {
    const wild = make('sproutle', 10);
    const half = { ...wild, hp: Math.floor(maxHp(wild) / 2) };
    const rate = (weather: string[]): number => {
      let caught = 0;
      for (let seed = 0; seed < 2000; seed++) {
        const s = createBattle(content, {
          kind: 'wild',
          seed,
          player: [make('ironshell', 10)],
          opponent: [half],
          bag: { 'core:zorb': 1 },
          weather,
        }).state;
        if (turn(s, ZORB).state.outcome === 'caught') caught++;
      }
      return caught / 2000;
    };
    const p = captureChance({
      hp: half.hp,
      maxHp: maxHp(wild),
      strength: 1,
      catchRate: 1,
      hasCondition: false,
    });
    expect(rate([])).toBeCloseTo(p, 1);
    expect(rate(['core:burning'])).toBeCloseTo(p * 1.2, 1);
  });

  it('is deterministic for a seed', () => {
    const play = () =>
      turn(
        start([make('ironshell', 10)], [make('sproutle', 10)], { 'core:zorb': 1 }, { seed: 7 })
          .state,
        ZORB,
      );
    const a = play();
    const b = play();
    expect(a.events).toEqual(b.events);
    expect(a.state.rng).toEqual(b.state.rng);
  });
});
