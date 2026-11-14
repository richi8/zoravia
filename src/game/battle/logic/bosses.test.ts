import { describe, expect, it } from 'vitest';
import { Rng } from '@engine/core';
import { definePack, PackError } from '@engine/packs';
import { loadGameContent, type BossInput } from '@game/data';
import { createZorling, statsOf, type Zorling } from '@game/progression';
import { corePack } from '@packs/core';
import {
  activeOf,
  aiChoice,
  ARMOR_BROKEN_MULTIPLIER,
  ARMOR_BROKEN_TURNS,
  ARMOR_DAMAGE_MULTIPLIER,
  bossZorling,
  capturedForm,
  computeDamage,
  createBattle,
  DAMAGE_ROLL_MIN,
  finishBattle,
  legalChoices,
  OPPONENT,
  PLAYER,
  simulateBoss,
  step,
  withSignature,
  type BattleEvent,
  type BattleKind,
  type BattleState,
  type Choice,
  type SimPolicy,
  type StepResult,
} from '.';
import type { Bag } from '@game/inventory';

/** Sure-hit test moves and species, and a Titan whose Armor only Overload breaks. */
const hit = (type: string, power = 50) => ({
  name: `Hit ${type}`,
  type: `core:${type}`,
  power,
  accuracy: 100,
});
const apply = (type: string) => ({
  name: `Apply ${type}`,
  type: `core:${type}`,
  power: 0,
  accuracy: 100,
  applyChance: 1,
});
const testPack = definePack({
  manifest: { id: 'b', version: '1.0.0', dependsOn: ['core'] },
  content: {
    moves: {
      'hit-metal': hit('metal'),
      'hit-wind': hit('wind'),
      'hit-fire': hit('fire', 250),
      'apply-electric': apply('electric'),
      'apply-metal': apply('metal'),
      'apply-fire': apply('fire'),
      poke: hit('fire', 1),
      sig: hit('wind', 60),
    },
    species: {
      ace: {
        name: 'Ace',
        types: ['core:fire'],
        baseStats: { hp: 200, attack: 100, defense: 200, speed: 200 },
        learnset: [{ level: 1, move: 'b:hit-metal' }],
      },
      golem: {
        name: 'Golem',
        types: ['core:nature'],
        baseStats: { hp: 100, attack: 50, defense: 100, speed: 10 },
        learnset: [
          { level: 1, move: 'b:poke' },
          { level: 2, move: 'b:apply-fire' },
          { level: 3, move: 'b:hit-wind' },
        ],
      },
    },
    bosses: {
      'golem-titan': {
        name: 'Golem Titan',
        kind: 'titan',
        species: 'b:golem',
        level: 20,
        signatureMove: 'b:sig',
        armor: { breaks: ['core:overload'] },
      },
      'bare-golem': {
        name: 'Bare Golem',
        kind: 'titan',
        species: 'b:golem',
        level: 20,
        hpMultiplier: 2,
        signatureMove: 'b:sig',
      },
    },
  },
});
const content = loadGameContent([corePack, testPack]);

let uid = 0;
const ace = (moves: string[], level = 20): Zorling => ({
  ...createZorling(content, { uid: `p${uid++}`, species: 'b:ace', level }),
  moves: moves.map((m) => `b:${m}`),
});
const golem = (extra: Partial<Zorling> = {}): Zorling => ({
  ...bossZorling(content, 'b:golem-titan', { uid: `g${uid++}` }),
  moves: ['b:poke'],
  ...extra,
});

const start = (
  player: Zorling[],
  opts: { boss?: string; bag?: Bag; kind?: BattleKind; foe?: Zorling } = {},
): StepResult =>
  createBattle(content, {
    kind: opts.kind ?? 'wild',
    seed: 7,
    player,
    opponent: [opts.foe ?? golem()],
    bag: opts.bag ?? {},
    boss: { id: opts.boss ?? 'b:golem-titan' },
  });

const MOVE = (slot: number): Choice => ({ kind: 'move', slot });
const ZORB: Choice = { kind: 'item', item: 'core:zorb' };
const turn = (s: BattleState, player: Choice, opponent: Choice = MOVE(0)): StepResult =>
  step(content, s, { kind: 'turn', player, opponent });
const kinds = (events: readonly BattleEvent[]): string[] => events.map((e) => e.kind);
const damageTo = (events: readonly BattleEvent[], side = OPPONENT): number[] =>
  events.flatMap((e) => (e.kind === 'damage' && e.side === side ? [e.amount] : []));

/** The damage the player's next sure hit of `type` (power 50) deals, from the battle RNG. */
function expectedDamage(s: BattleState, type: string, multiplier: number): number {
  const rng = Rng.fromState(s.rng);
  rng.next(); // hit roll
  const user = activeOf(s, PLAYER);
  const target = activeOf(s, OPPONENT);
  return computeDamage({
    level: user.zorling.level,
    power: 50,
    attack: user.stats.attack,
    defense: target.stats.defense,
    effectiveness: content.effectiveness(`core:${type}`, target.types),
    roll: rng.float(DAMAGE_ROLL_MIN, 1),
    multiplier,
  });
}

describe('boss data', () => {
  const load = (boss: BossInput) =>
    loadGameContent([
      corePack,
      definePack({
        manifest: { id: 'x', version: '1.0.0', dependsOn: ['core'] },
        content: { bosses: { bad: boss } },
      }),
    ]);
  const base: BossInput = {
    name: 'Bad',
    kind: 'titan',
    species: 'core:ironshell',
    level: 20,
    signatureMove: 'core:gale-dash',
    armor: { breaks: ['core:overload'] },
  };

  it('core bosses load, with ×3 HP by default', () => {
    expect(content.bosses.require('core:thornwing-titan').hpMultiplier).toBe(3);
    expect(content.bosses.require('core:verdion').kind).toBe('legendary');
  });

  it('rejects bosses that break the rules', () => {
    expect(() => load(base)).not.toThrow();
    expect(() => load({ ...base, kind: 'legendary' })).toThrow(PackError);
    expect(() => load({ ...base, species: 'core:verdion' })).toThrow(PackError);
    expect(() => load({ ...base, signatureMove: 'core:iron-bash' })).toThrow(/learnset/);
    expect(() => load({ ...base, armor: { breaks: ['core:nope'] } })).toThrow(PackError);
    const twice = { breaks: ['core:overload', 'core:overload'] };
    expect(() => load({ ...base, armor: twice })).toThrow(/twice/);
  });
});

describe('boss aura', () => {
  it('×3 max HP, the signature move as an extra move, and Armor', () => {
    const z = { ...golem(), moves: ['b:poke', 'b:apply-fire', 'b:hit-wind'] };
    const boss = activeOf(start([ace(['hit-metal'])], { foe: z }).state, OPPONENT);
    const normal = statsOf(content, z);
    expect(boss.stats).toEqual({ ...normal, hp: normal.hp * 3 });
    expect(boss.hp).toBe(normal.hp * 3);
    expect(boss.moves).toEqual([...z.moves, 'b:sig']); // 4 moves
    expect(boss.boss).toEqual({
      id: 'b:golem-titan',
      baseHp: normal.hp,
      armor: 'armored',
      rearmTurn: null,
      subdued: false,
    });
    const s = start([ace(['hit-metal'])], { foe: z }).state;
    expect(legalChoices(content, s, OPPONENT).filter((c) => c.kind === 'move')).toHaveLength(4);
  });

  it('a hurt Zorling keeps its HP fraction; a boss without Armor has none', () => {
    const z = golem();
    const max = statsOf(content, z).hp;
    const hurt = activeOf(start([ace(['hit-metal'])], { foe: { ...z, hp: max / 2 } }).state, 1);
    expect(hurt.hp).toBe(Math.ceil(max * 1.5));
    const bare = activeOf(start([ace(['hit-metal'])], { boss: 'b:bare-golem' }).state, OPPONENT);
    expect(bare.stats.hp).toBe(max * 2);
    expect(bare.boss?.armor).toBe('none');
  });

  it('checks the boss setup', () => {
    const wrong = createZorling(content, { uid: 'w', species: 'core:emberkit', level: 20 });
    expect(() => start([ace(['hit-metal'])], { foe: wrong })).toThrow(/not a/);
    expect(() =>
      createBattle(content, {
        kind: 'wild',
        seed: 1,
        player: [ace(['hit-metal'])],
        opponent: [golem()],
        boss: { id: 'b:golem-titan', slot: 1 },
      }),
    ).toThrow(/slot 1/);
  });
});

describe('Armor cycle', () => {
  it('takes ×0.4 damage while armored, and other reactions do not break it', () => {
    let s = start([ace(['hit-metal', 'hit-wind', 'apply-metal'])]).state;
    let r = turn(s, MOVE(0));
    expect(damageTo(r.events)).toEqual([expectedDamage(s, 'metal', ARMOR_DAMAGE_MULTIPLIER)]);
    // Exposed + Wind = Shred, but only Overload breaks this Armor.
    s = turn(r.state, MOVE(2)).state;
    r = turn(s, MOVE(1));
    expect(kinds(r.events)).toContain('reaction');
    expect(kinds(r.events)).not.toContain('armorBroken');
    expect(activeOf(r.state, OPPONENT).boss?.armor).toBe('armored');
  });

  it('the right reaction breaks it: ×1.5 for the hit and 2 more turns, then it re-arms', () => {
    let s = start([ace(['hit-metal', 'apply-electric'])]).state;
    s = turn(s, MOVE(1)).state; // Charged
    const broken = s.turn;
    const reaction = content.reactions.require('core:overload').damageMultiplier;
    let r = turn(s, MOVE(0));
    expect(kinds(r.events).slice(1, 5)).toEqual(['useMove', 'reaction', 'armorBroken', 'damage']);
    expect(r.events).toContainEqual({
      kind: 'armorBroken',
      side: OPPONENT,
      reaction: 'core:overload',
    });
    expect(damageTo(r.events)).toEqual([
      expectedDamage(s, 'metal', reaction * ARMOR_BROKEN_MULTIPLIER),
    ]);
    expect(activeOf(r.state, OPPONENT).boss).toMatchObject({
      armor: 'broken',
      rearmTurn: broken + ARMOR_BROKEN_TURNS,
    });
    for (let i = 0; i < ARMOR_BROKEN_TURNS; i++) {
      s = r.state;
      r = turn(s, MOVE(0));
      expect(damageTo(r.events)).toEqual([expectedDamage(s, 'metal', ARMOR_BROKEN_MULTIPLIER)]);
    }
    expect(kinds(r.events).at(-2)).toBe('armorRestored');
    expect(activeOf(r.state, OPPONENT).boss?.armor).toBe('armored');
    s = r.state;
    r = turn(s, MOVE(0));
    expect(damageTo(r.events)).toEqual([expectedDamage(s, 'metal', ARMOR_DAMAGE_MULTIPLIER)]);
  });

  it('damage over time is a fraction of the HP without the aura', () => {
    const foe = golem();
    const r = turn(start([ace(['apply-fire'])], { foe }).state, MOVE(0));
    const burn = r.events.find((e) => e.kind === 'statusDamage' && e.side === OPPONENT);
    expect(burn).toMatchObject({ amount: Math.floor(statsOf(content, foe).hp / 16) });
  });
});

describe('Subdued and capture', () => {
  const weak = (): Zorling => golem({ hp: 1 });

  it('a capture item cannot be thrown at a boss before it is Subdued', () => {
    const s = start([ace(['hit-metal'])], { bag: { 'core:zorb': 3 } }).state;
    expect(legalChoices(content, s, PLAYER)).not.toContainEqual(ZORB);
  });

  it('beaten in a wild battle it is Subdued, waits, and any capture item catches it', () => {
    const s = start([ace(['hit-fire'])], { foe: weak(), bag: { 'core:zorb': 1 } }).state;
    const r = turn(s, MOVE(0));
    expect(kinds(r.events)).toContain('subdued');
    expect(kinds(r.events)).not.toContain('fainted');
    expect(r.state.phase).toBe('choose');
    const boss = activeOf(r.state, OPPONENT);
    expect(boss.boss).toMatchObject({ subdued: true, armor: 'none' });
    expect(boss.hp).toBe(0);
    expect(legalChoices(content, r.state, PLAYER)).toEqual([ZORB]);
    expect(legalChoices(content, r.state, OPPONENT)).toEqual([{ kind: 'wait' }]);
    expect(aiChoice(content, r.state, OPPONENT, 'trainer')).toEqual({ kind: 'wait' });

    const c = turn(r.state, ZORB, { kind: 'wait' });
    expect(c.events).toContainEqual({
      kind: 'capture',
      item: 'core:zorb',
      success: true,
      wobbles: 3,
    });
    expect(c.state.outcome).toBe('caught');
    expect(c.state.bag).toEqual({});
    const result = finishBattle(content, c.state, { badges: 0 });
    expect(result.xp).toBeGreaterThan(0);
    expect(result.caught).toMatchObject({
      species: 'b:golem',
      titanMark: true,
      hp: 1,
      moves: ['b:poke', 'b:sig'],
    });
  });

  it('without a capture item, Subduing it is a win', () => {
    const r = turn(start([ace(['hit-fire'])], { foe: weak() }).state, MOVE(0));
    expect(kinds(r.events)).toContain('subdued');
    expect(r.state.outcome).toBe('win');
    expect(finishBattle(content, r.state, { badges: 0 }).caught).toBeNull();
  });

  it('in a trainer battle a boss faints as usual', () => {
    const r = turn(start([ace(['hit-fire'])], { foe: weak(), kind: 'trainer' }).state, MOVE(0));
    expect(kinds(r.events)).toContain('fainted');
    expect(kinds(r.events)).not.toContain('subdued');
    expect(r.state.outcome).toBe('win');
  });

  it('captured form: the aura is gone, a Titan keeps a mark and its signature move', () => {
    expect(withSignature(['a', 'b', 'c'], 's', 3)).toEqual(['b', 'c', 's']);
    expect(withSignature(['a'], 's', 3)).toEqual(['a', 's']);
    expect(withSignature(['a', 's'], 's', 3)).toEqual(['a', 's']);

    const legend = bossZorling(content, 'core:verdion', { uid: 'l' });
    const s = createBattle(content, {
      kind: 'wild',
      seed: 1,
      player: [ace(['hit-metal'])],
      opponent: [legend],
      boss: { id: 'core:verdion' },
    }).state;
    const caught = capturedForm(content, activeOf(s, OPPONENT));
    expect(caught.titanMark).toBe(false);
    expect(caught.moves).toHaveLength(3);
    expect(caught.moves.at(-1)).toBe('core:verdant-gale');
    expect(statsOf(content, caught).hp).toBe(statsOf(content, legend).hp); // no aura
  });
});

describe('boss AI', () => {
  it('goes for the reaction that breaks the Armor', () => {
    // hit-wind (Wind on Nature: strong) would deal more against Armor than hit-metal
    // without a reaction, but on a Charged boss hit-metal sets off Overload and breaks it.
    let s = start([ace(['hit-wind', 'hit-metal', 'apply-electric'])]).state;
    expect(aiChoice(content, s, PLAYER, 'trainer')).toEqual(MOVE(2)); // set up Charged
    s = turn(s, MOVE(2)).state;
    expect(aiChoice(content, s, PLAYER, 'trainer')).toEqual(MOVE(1));
  });
});

describe('boss simulation (Thornwing Titan, Lv 24 team vs Lv 24 Titan)', () => {
  const team = (): Zorling[] =>
    (
      [
        ['voltbat', ['static-field', 'volt-lash', 'frost-fang']],
        ['ironshell', ['iron-bash', 'steel-claw', 'mud-toss']],
        ['blazekit', ['flame-pounce', 'kindle', 'ember']],
      ] as const
    ).map(([species, moves], i) => ({
      ...createZorling(content, { uid: `s${i}`, species: `core:${species}`, level: 24 }),
      moves: moves.map((m) => `core:${m}`),
    }));
  const SEEDS = 100;
  const run = (policy: SimPolicy, potions: number) => {
    let wins = 0;
    let potionsUsed = 0;
    let breaks = 0;
    for (let seed = 0; seed < SEEDS; seed++) {
      const r = simulateBoss(content, {
        boss: 'core:thornwing-titan',
        team: team(),
        bag: { 'core:zorb': 1, 'core:super-potion': potions },
        policy,
        seed,
      });
      if (r.outcome === 'caught') wins++;
      potionsUsed += r.potionsUsed;
      breaks += r.armorBreaks;
    }
    return { win: wins / SEEDS, potions: potionsUsed / SEEDS, breaks: breaks / SEEDS };
  };
  const reactions: SimPolicy = { style: 'reactions', potion: 'core:super-potion' };
  const brute: SimPolicy = { style: 'brute', potion: 'core:super-potion' };

  it('is beatable by reactions, with few or no potions', () => {
    const r = run(reactions, 0);
    expect(r.win).toBeGreaterThanOrEqual(0.9);
    expect(r.breaks).toBeGreaterThanOrEqual(2);
  });

  it('is beatable by brute force with ~4–5 good potions, not without', () => {
    const none = run(brute, 0);
    const three = run(brute, 3);
    const five = run(brute, 5);
    expect(none.win).toBe(0);
    expect(three.win).toBeLessThan(0.5);
    expect(five.win).toBeGreaterThanOrEqual(0.6);
    expect(five.breaks).toBe(0);
  });

  it('is deterministic', () => {
    const setup = {
      boss: 'core:thornwing-titan',
      team: team(),
      bag: { 'core:zorb': 1 },
      policy: reactions,
      seed: 3,
    };
    expect(simulateBoss(content, setup)).toEqual(simulateBoss(content, setup));
  });
});
