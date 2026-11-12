import { describe, expect, it } from 'vitest';
import { Rng } from '@engine/core';
import { definePack } from '@engine/packs';
import { loadGameContent } from '@game/data';
import { createZorling, statsOf, type Zorling } from '@game/progression';
import { corePack } from '@packs/core';
import {
  activeOf,
  computeDamage,
  createBattle,
  DAMAGE_ROLL_MIN,
  hitChance,
  legalChoices,
  OPPONENT,
  PLAYER,
  statMultiplier,
  step,
  type BattleEvent,
  type BattleKind,
  type BattleState,
  type Choice,
  type SideId,
  type Status,
  type StepResult,
} from '.';

const TYPES = ['fire', 'water', 'nature', 'electric', 'ice', 'earth', 'wind', 'metal'] as const;
type T = (typeof TYPES)[number];

/**
 * Test pack: for every type a sure hit that never applies its condition (`t:hit-x`), a sure
 * hit that always does (`t:hitapply-x`) and a sure status move (`t:apply-x`). Species with
 * plain stats so numbers are easy to follow.
 */
const testPack = definePack({
  manifest: { id: 't', version: '1.0.0', dependsOn: ['core'] },
  content: {
    moves: Object.fromEntries(
      TYPES.flatMap((ty) => [
        [`hit-${ty}`, { name: `Hit ${ty}`, type: `core:${ty}`, power: 100, accuracy: 100 }],
        [
          `hitapply-${ty}`,
          { name: `Hitapply ${ty}`, type: `core:${ty}`, power: 40, accuracy: 100, applyChance: 1 },
        ],
        [
          `apply-${ty}`,
          { name: `Apply ${ty}`, type: `core:${ty}`, power: 0, accuracy: 100, applyChance: 1 },
        ],
      ]).concat([['poke', { name: 'Poke', type: 'core:wind', power: 10, accuracy: 100 }]]),
    ),
    species: {
      // Fast attacker.
      ace: species('core:wind', { hp: 120, attack: 100, defense: 100, speed: 200 }),
      // Second fast attacker (for switching in to exploit).
      ace2: species('core:wind', { hp: 120, attack: 100, defense: 100, speed: 190 }),
      // Slow, sturdy target with high defense.
      dummy: species('core:wind', { hp: 255, attack: 60, defense: 160, speed: 10 }),
      slowpoke: species('core:wind', { hp: 120, attack: 100, defense: 100, speed: 20 }),
      frail: species('core:wind', { hp: 10, attack: 10, defense: 10, speed: 5 }),
      wetproof: species('core:wind', base(), 'core:waterproof'),
      heatproof: species('core:wind', base(), 'core:heatproof'),
      kindler: species('core:wind', base(), 'core:kindling'),
      lingerer: species('core:wind', base(), 'core:lingering'),
    },
  },
});

function base() {
  return { hp: 120, attack: 100, defense: 100, speed: 150 };
}
function species(type: string, baseStats: Record<string, number>, trait?: string) {
  return {
    name: 'Test',
    types: [type],
    baseStats,
    ...(trait ? { trait } : {}),
    learnset: [{ level: 1, move: 'core:ember' }],
  };
}

const content = loadGameContent([corePack, testPack]);
let uid = 0;
const mon = (sp: string, moves: string[], level = 50): Zorling => ({
  ...createZorling(content, { uid: `u${uid++}`, species: `t:${sp}`, level }),
  moves: moves.map((m) => (m.includes(':') ? m : `t:${m}`)),
});

const start = (
  player: Zorling[],
  opponent: Zorling[],
  opts: { seed?: number; weather?: string[]; kind?: BattleKind } = {},
): StepResult =>
  createBattle(content, {
    kind: opts.kind ?? (player.length > 1 || opponent.length > 1 ? 'trainer' : 'wild'),
    seed: opts.seed ?? 1,
    player,
    opponent,
    ...(opts.weather ? { weather: opts.weather } : {}),
  });

const MOVE0: Choice = { kind: 'move', slot: 0 };
const MOVE1: Choice = { kind: 'move', slot: 1 };
const turn = (s: BattleState, player: Choice = MOVE0, opponent: Choice = MOVE0): StepResult =>
  step(content, s, { kind: 'turn', player, opponent });

const ids = (s: BattleState, side: SideId): string[] => activeOf(s, side).statuses.map((x) => x.id);
const statusOf = (s: BattleState, side: SideId, id: string): Status | undefined =>
  activeOf(s, side).statuses.find((x) => x.id === id);
const find = <K extends BattleEvent['kind']>(
  events: readonly BattleEvent[],
  kind: K,
  side?: SideId,
): Extract<BattleEvent, { kind: K }> | undefined =>
  events.find(
    (e): e is Extract<BattleEvent, { kind: K }> =>
      e.kind === kind && (side === undefined || !('side' in e) || e.side === side),
  );

/** Puts a status on a side's active Zorling (as if applied before the turn). */
function withStatus(
  s: BattleState,
  side: SideId,
  id: string,
  origin: Status['origin'] = 'condition',
  extra: Partial<Status> = {},
): BattleState {
  const copy = structuredClone(s) as { -readonly [K in keyof BattleState]: BattleState[K] };
  const sides = copy.sides as unknown as { team: { statuses: Status[] }[]; active: number }[];
  const c = sides[side]?.team[sides[side].active];
  c?.statuses.push({
    id,
    origin,
    turnsLeft: 3,
    ticks: 0,
    source: foeOf(side),
    fresh: false,
    ...extra,
  });
  return copy;
}
const foeOf = (side: SideId): SideId => (side === PLAYER ? OPPONENT : PLAYER);

/**
 * Damage the faster player's first move would deal this turn with the given extras, using
 * the same roll as the engine (RNG order: hit, damage; no tie or fumble draw).
 */
function expectedDamage(
  s: BattleState,
  moveType: T,
  extra: { multiplier?: number; ignoreDefense?: boolean } = {},
): number {
  const rng = Rng.fromState(s.rng);
  rng.next(); // hit roll
  const user = activeOf(s, PLAYER);
  const target = activeOf(s, OPPONENT);
  return computeDamage({
    level: user.zorling.level,
    power: 100,
    attack: user.stats.attack,
    defense: target.stats.defense * statMultiplier(content, target, 'defense'),
    effectiveness: content.effectiveness(`core:${moveType}`, target.types),
    roll: rng.float(DAMAGE_ROLL_MIN, 1),
    ...extra,
  });
}

describe('applying conditions', () => {
  it('a status move applies its type’s condition for 3 turns', () => {
    const r = turn(start([mon('ace', ['apply-fire'])], [mon('dummy', ['apply-water'])]).state);
    expect(find(r.events, 'conditionApplied', OPPONENT)).toEqual({
      kind: 'conditionApplied',
      side: OPPONENT,
      condition: 'core:burning',
      turns: 3,
      source: PLAYER,
      refreshed: false,
    });
    expect(ids(r.state, OPPONENT)).toEqual(['core:burning']);
    expect(ids(r.state, PLAYER)).toEqual(['core:wet']);
  });

  it('a damaging move applies it on hit by its apply chance', () => {
    const always = turn(start([mon('ace', ['hitapply-ice'])], [mon('dummy', ['hit-wind'])]).state);
    expect(ids(always.state, OPPONENT)).toEqual(['core:chilled']);
    const never = turn(start([mon('ace', ['hit-ice'])], [mon('dummy', ['hit-wind'])]).state);
    expect(ids(never.state, OPPONENT)).toEqual([]);
  });

  it('applies core moves at roughly their apply chance', () => {
    let applied = 0;
    for (let seed = 0; seed < 300; seed++) {
      const r = turn(
        start([mon('ace', ['core:ember'])], [mon('dummy', ['hit-wind'])], { seed }).state,
      );
      if (find(r.events, 'conditionApplied', OPPONENT)) applied++;
    }
    expect(applied / 300).toBeGreaterThan(0.2);
    expect(applied / 300).toBeLessThan(0.4);
  });

  it('is not applied to a Zorling the hit knocked out', () => {
    const r = turn(start([mon('ace', ['hitapply-fire'])], [mon('frail', ['hit-wind'], 5)]).state);
    expect(find(r.events, 'fainted', OPPONENT)).toBeDefined();
    expect(find(r.events, 'conditionApplied')).toBeUndefined();
  });

  it('several different conditions can be on one Zorling', () => {
    let s = start([mon('ace', ['apply-fire', 'apply-wind'])], [mon('dummy', ['hit-wind'])]).state;
    s = turn(s, MOVE0).state;
    s = turn(s, MOVE1).state;
    expect(ids(s, OPPONENT)).toEqual(['core:burning', 'core:airborne']);
  });

  it('re-applying refreshes the duration instead of stacking', () => {
    let s = start([mon('ace', ['apply-water'])], [mon('dummy', ['hit-wind'])]).state;
    s = turn(s).state;
    expect(statusOf(s, OPPONENT, 'core:wet')?.turnsLeft).toBe(2);
    const r = turn(s);
    expect(find(r.events, 'conditionApplied', OPPONENT)).toMatchObject({ refreshed: true });
    expect(ids(r.state, OPPONENT)).toEqual(['core:wet']);
    expect(statusOf(r.state, OPPONENT, 'core:wet')?.turnsLeft).toBe(2);
  });
});

describe('duration', () => {
  it('lasts 3 turns, counting the turn it was applied when the holder still acts after', () => {
    // Faster player applies Wet in turn 1, then only pokes.
    let s = start([mon('ace', ['apply-water', 'hit-metal'])], [mon('dummy', ['hit-wind'])]).state;
    s = turn(s, MOVE0).state; // turn 1
    s = turn(s, MOVE1).state; // turn 2
    expect(ids(s, OPPONENT)).toEqual(['core:wet']);
    const r = turn(s, MOVE1); // turn 3
    expect(find(r.events, 'statusEnded', OPPONENT)).toEqual({
      kind: 'statusEnded',
      side: OPPONENT,
      status: 'core:wet',
      origin: 'condition',
    });
    expect(ids(r.state, OPPONENT)).toEqual([]);
  });

  it('covers 3 of the holder’s own turns when applied after the holder acted', () => {
    // Slower player applies Wet after the foe moved in turn 1: it lasts through turn 4.
    let s = start([mon('slowpoke', ['apply-water', 'poke'])], [mon('ace', ['poke'])]).state;
    s = turn(s, MOVE0).state; // 1
    expect(statusOf(s, OPPONENT, 'core:wet')).toMatchObject({ turnsLeft: 3, fresh: false });
    s = turn(s, MOVE1).state; // 2
    s = turn(s, MOVE1).state; // 3
    expect(ids(s, OPPONENT)).toEqual(['core:wet']);
    const r = turn(s, MOVE1); // 4
    expect(find(r.events, 'statusEnded', OPPONENT)).toBeDefined();
  });

  it('is long enough to apply → switch → exploit, even for the slower side', () => {
    const applier = mon('slowpoke', ['apply-water']);
    const exploiter = mon('ace2', ['hit-electric']);
    let s = start([applier, exploiter], [mon('ace', ['hit-metal'])]).state;
    s = turn(s).state; // 1: Wet (after the foe acted)
    s = turn(s, { kind: 'switch', to: 1 }).state; // 2: switch costs the turn
    const r = turn(s); // 3: exploit
    expect(find(r.events, 'reaction', OPPONENT)).toMatchObject({ reaction: 'core:conducted' });
  });
});

describe('side effects', () => {
  it('Burning takes 1/16 max HP at the end of each turn, 3 times', () => {
    let s = start(
      [mon('ace', ['apply-fire', 'apply-metal'])],
      [mon('dummy', ['apply-metal'])],
    ).state;
    const max = activeOf(s, OPPONENT).stats.hp;
    const losses: number[] = [];
    for (const choice of [MOVE0, MOVE1, MOVE1, MOVE1]) {
      const r = turn(s, choice);
      for (const e of r.events)
        if (e.kind === 'statusDamage' && e.side === OPPONENT) losses.push(e.amount);
      s = r.state;
    }
    expect(losses).toEqual([1, 2, 3].map(() => Math.floor(max / 16)));
    expect(activeOf(s, OPPONENT).hp).toBe(max - 3 * Math.floor(max / 16));
  });

  it('Overgrown drains HP to the side that planted it', () => {
    // The foe hurts the player first, so the drain has something to heal.
    let s = start([mon('slowpoke', ['apply-nature'])], [mon('ace', ['poke'])]).state;
    const r = turn(s);
    s = r.state;
    const r2 = turn(s);
    const loss = find(r2.events, 'statusDamage', OPPONENT);
    expect(loss).toMatchObject({ status: 'core:overgrown' });
    const max = activeOf(s, OPPONENT).stats.hp;
    expect(loss?.amount).toBe(Math.floor(max / 24));
    expect(find(r2.events, 'heal', PLAYER)).toMatchObject({ amount: loss?.amount });
  });

  it('re-applying every turn after the holder acted never stops the HP loss', () => {
    // The slower player Kindles every turn: Burning still ticks each turn from turn 2 on.
    let s = start([mon('slowpoke', ['apply-fire'])], [mon('ace', ['poke'])]).state;
    let ticks = 0;
    for (let i = 0; i < 5; i++) {
      const r = turn(s);
      if (find(r.events, 'statusDamage', OPPONENT)) ticks++;
      s = r.state;
    }
    expect(ticks).toBe(4);
    expect(statusOf(s, OPPONENT, 'core:burning')).toMatchObject({ turnsLeft: 3, fresh: false });
  });

  it('Wet and Chilled slow a Zorling down enough to change turn order', () => {
    // ace (200) vs ace2 (190): Wet ×0.85 on ace makes ace2 faster.
    const s = start([mon('ace', ['hit-metal'])], [mon('ace2', ['hit-metal'])]).state;
    const order = (st: BattleState) =>
      turn(st).events.flatMap((e) => (e.kind === 'useMove' ? [e.side] : []));
    expect(order(s)).toEqual([PLAYER, OPPONENT]);
    expect(order(withStatus(s, PLAYER, 'core:wet'))).toEqual([OPPONENT, PLAYER]);
    expect(order(withStatus(s, PLAYER, 'core:chilled'))).toEqual([OPPONENT, PLAYER]);
  });

  it('Charged makes about 10% of moves fumble', () => {
    let fumbles = 0;
    for (let seed = 0; seed < 500; seed++) {
      const s = start([mon('ace', ['hit-metal'])], [mon('dummy', ['hit-wind'])], { seed }).state;
      if (find(turn(withStatus(s, PLAYER, 'core:charged')).events, 'fumbled', PLAYER)) fumbles++;
    }
    expect(fumbles / 500).toBeGreaterThan(0.06);
    expect(fumbles / 500).toBeLessThan(0.14);
  });

  it('Muddy lowers accuracy and Airborne makes a Zorling easier to hit', () => {
    const s = start([mon('ace', ['hit-metal'])], [mon('dummy', ['hit-wind'])]).state;
    const muddy = activeOf(withStatus(s, PLAYER, 'core:muddy'), PLAYER);
    const airborne = activeOf(withStatus(s, OPPONENT, 'core:airborne'), OPPONENT);
    expect(statMultiplier(content, muddy, 'accuracy')).toBe(0.85);
    expect(hitChance(90, statMultiplier(content, muddy, 'accuracy'))).toBeCloseTo(0.765);
    expect(hitChance(80, 1, statMultiplier(content, airborne, 'evasion'))).toBeCloseTo(0.8 / 0.85);
    expect(hitChance(95, 1, 0.85)).toBe(1);
  });

  it('Exposed lowers defense, so hits deal more', () => {
    // Wind on Exposed would be Shred, so hit with Metal, which does not react.
    const s2 = withStatus(
      start([mon('ace', ['hit-metal'])], [mon('dummy', ['hit-wind'])]).state,
      OPPONENT,
      'core:exposed',
    );
    const plain = start([mon('ace', ['hit-metal'])], [mon('dummy', ['hit-wind'])]).state;
    const hit = (st: BattleState) => find(turn(st).events, 'damage', OPPONENT)?.amount ?? 0;
    expect(hit(s2)).toBe(expectedDamage(s2, 'metal'));
    expect(hit(s2)).toBeGreaterThan(hit(plain));
    expect(statMultiplier(content, activeOf(s2, OPPONENT), 'defense')).toBe(0.75);
  });
});

describe('reactions', () => {
  const table: {
    reaction: string;
    condition: string;
    move: T;
    multiplier: number;
    ignoreDefense?: boolean;
  }[] = [
    { reaction: 'wildfire', condition: 'overgrown', move: 'fire', multiplier: 2 },
    { reaction: 'steam-burst', condition: 'burning', move: 'water', multiplier: 1.75 },
    { reaction: 'rooted', condition: 'muddy', move: 'nature', multiplier: 1 },
    { reaction: 'conducted', condition: 'wet', move: 'electric', multiplier: 1.75 },
    { reaction: 'frozen', condition: 'wet', move: 'ice', multiplier: 1 },
    {
      reaction: 'shatter',
      condition: 'chilled',
      move: 'earth',
      multiplier: 2,
      ignoreDefense: true,
    },
    { reaction: 'slam', condition: 'airborne', move: 'earth', multiplier: 1.75 },
    {
      reaction: 'shred',
      condition: 'exposed',
      move: 'wind',
      multiplier: 1.75,
      ignoreDefense: true,
    },
    { reaction: 'overload', condition: 'charged', move: 'metal', multiplier: 1.5 },
  ];

  it.each(table)(
    '$reaction: $move on $condition, ×$multiplier, consumes the condition',
    ({ reaction, condition, move, multiplier, ignoreDefense }) => {
      const s = withStatus(
        start([mon('ace', [`hit-${move}`])], [mon('dummy', ['hit-wind'])]).state,
        OPPONENT,
        `core:${condition}`,
      );
      const r = turn(s);
      const events = r.events.map((e) => e.kind);
      expect(find(r.events, 'reaction')).toEqual({
        kind: 'reaction',
        side: OPPONENT,
        reaction: `core:${reaction}`,
        condition: `core:${condition}`,
      });
      expect(events.indexOf('reaction')).toBeLessThan(events.indexOf('damage'));
      expect(ids(r.state, OPPONENT)).not.toContain(`core:${condition}`);
      expect(find(r.events, 'damage', OPPONENT)?.amount).toBe(
        expectedDamage(s, move, { multiplier, ignoreDefense: ignoreDefense ?? false }),
      );
    },
  );

  it('covers every reaction in the core pack', () => {
    expect(table.map((t) => `core:${t.reaction}`).sort()).toEqual(
      content.reactions
        .values()
        .map((r) => r.id)
        .sort(),
    );
  });

  it('ignoring defense matters against a high-defense target', () => {
    const s = withStatus(
      start([mon('ace', ['hit-earth'])], [mon('dummy', ['hit-wind'])]).state,
      OPPONENT,
      'core:chilled',
    );
    const withIgnore = expectedDamage(s, 'earth', { multiplier: 2, ignoreDefense: true });
    expect(withIgnore).toBeGreaterThan(expectedDamage(s, 'earth', { multiplier: 2 }));
  });

  it('no reaction without the matching condition', () => {
    const s = withStatus(
      start([mon('ace', ['hit-fire'])], [mon('dummy', ['hit-wind'])]).state,
      OPPONENT,
      'core:wet',
    );
    const r = turn(s);
    expect(find(r.events, 'reaction')).toBeUndefined();
    expect(ids(r.state, OPPONENT)).toEqual(['core:wet']);
  });

  it('status moves do not set off reactions', () => {
    const s = withStatus(
      start([mon('ace', ['apply-fire'])], [mon('dummy', ['hit-wind'])]).state,
      OPPONENT,
      'core:overgrown',
    );
    const r = turn(s);
    expect(find(r.events, 'reaction')).toBeUndefined();
    expect(ids(r.state, OPPONENT)).toEqual(['core:overgrown', 'core:burning']);
  });

  it('a fumbled move sets off nothing', () => {
    const s = withStatus(
      start([mon('ace', ['hit-fire'])], [mon('dummy', ['hit-wind'])]).state,
      OPPONENT,
      'core:overgrown',
    );
    let found = false;
    for (let seed = 0; seed < 200 && !found; seed++) {
      const st = withStatus({ ...s, rng: new Rng(seed).getState() }, PLAYER, 'core:charged');
      const r = turn(st);
      if (find(r.events, 'fumbled', PLAYER)) {
        found = true;
        expect(find(r.events, 'reaction')).toBeUndefined();
        expect(ids(r.state, OPPONENT)).toContain('core:overgrown');
      }
    }
    expect(found).toBe(true);
  });

  it('with two matching conditions, the oldest reacts', () => {
    let s = start([mon('ace', ['hit-earth'])], [mon('dummy', ['hit-wind'])]).state;
    s = withStatus(withStatus(s, OPPONENT, 'core:airborne'), OPPONENT, 'core:chilled');
    const r = turn(s);
    expect(find(r.events, 'reaction')).toMatchObject({ reaction: 'core:slam' });
    expect(ids(r.state, OPPONENT)).toEqual(['core:chilled']);
  });

  it('the hit can then apply its own condition (chains)', () => {
    const s = withStatus(
      start([mon('ace', ['hitapply-water'])], [mon('dummy', ['hit-wind'])]).state,
      OPPONENT,
      'core:burning',
    );
    const r = turn(s);
    expect(find(r.events, 'reaction')).toMatchObject({ reaction: 'core:steam-burst' });
    expect(ids(r.state, OPPONENT)).toEqual(['core:steam-burst', 'core:wet']);
  });

  it('Steam Burst leaves lower accuracy for 2 turns', () => {
    const s = withStatus(
      start([mon('ace', ['hit-water', 'hit-metal'])], [mon('dummy', ['hit-wind'])]).state,
      OPPONENT,
      'core:burning',
    );
    let r = turn(s);
    expect(statMultiplier(content, activeOf(r.state, OPPONENT), 'accuracy')).toBe(0.8);
    r = turn(r.state, MOVE1);
    expect(ids(r.state, OPPONENT)).toEqual([]);
    expect(find(r.events, 'statusEnded', OPPONENT)).toMatchObject({
      status: 'core:steam-burst',
      origin: 'reaction',
    });
  });

  it('Rooted traps the target and drains more each turn', () => {
    const foeTeam = [mon('dummy', ['hit-wind']), mon('dummy', ['hit-wind'])];
    const s = withStatus(
      start([mon('slowpoke', ['hit-nature', 'apply-metal'])], foeTeam).state,
      OPPONENT,
      'core:muddy',
    );
    expect(legalChoices(content, s, OPPONENT)).toContainEqual({ kind: 'switch', to: 1 });
    const max = activeOf(s, OPPONENT).stats.hp;
    const drains: number[] = [];
    const collect = (res: StepResult) => {
      for (const e of res.events) {
        if (e.kind === 'statusDamage' && e.status === 'core:rooted') drains.push(e.amount);
      }
    };
    // Applied before the slower foe acted, so it drains from this turn on, 3 times.
    let r = turn(s);
    collect(r);
    expect(legalChoices(content, r.state, OPPONENT)).toEqual([{ kind: 'move', slot: 0 }]);
    expect(() => turn(r.state, MOVE1, { kind: 'switch', to: 1 })).toThrow(/cannot choose/);
    for (let i = 0; i < 3; i++) {
      r = turn(r.state, MOVE1);
      collect(r);
    }
    expect(drains).toEqual([
      Math.floor(max * (1 / 16)),
      Math.floor(max * (1 / 16 + 1 / 32)),
      Math.floor(max * (1 / 16 + 2 / 32)),
    ]);
    expect(legalChoices(content, r.state, OPPONENT)).toContainEqual({ kind: 'switch', to: 1 });
  });

  it('Frozen makes the target lose its move this turn if it has not acted yet', () => {
    const s = withStatus(
      start([mon('ace', ['hit-ice'])], [mon('dummy', ['hit-wind'])]).state,
      OPPONENT,
      'core:wet',
    );
    const r = turn(s);
    expect(find(r.events, 'skipped', OPPONENT)).toEqual({
      kind: 'skipped',
      side: OPPONENT,
      status: 'core:frozen',
    });
    expect(r.events.some((e) => e.kind === 'useMove' && e.side === OPPONENT)).toBe(false);
    // Over after one lost move.
    const r2 = turn(r.state);
    expect(r2.events.some((e) => e.kind === 'useMove' && e.side === OPPONENT)).toBe(true);
  });

  it('Overload stuns a target that already acted on its next turn instead', () => {
    const s = withStatus(
      start([mon('slowpoke', ['hit-metal'])], [mon('ace', ['hit-wind'])]).state,
      OPPONENT,
      'core:charged',
    );
    // Find a seed where the foe does not fumble its own move.
    let r = turn(s);
    for (let seed = 2; find(r.events, 'fumbled'); seed++) {
      r = turn({ ...s, rng: new Rng(seed).getState() });
    }
    expect(find(r.events, 'reaction')).toMatchObject({ reaction: 'core:overload' });
    expect(find(r.events, 'skipped')).toBeUndefined();
    expect(ids(r.state, OPPONENT)).toEqual(['core:overload']);
    const r2 = turn(r.state);
    expect(find(r2.events, 'skipped', OPPONENT)).toMatchObject({ status: 'core:overload' });
    expect(ids(r2.state, OPPONENT)).toEqual([]);
  });

  it('a dual-type wild can set up and exploit its own combo', () => {
    const wild = mon('dummy', ['apply-water', 'hit-electric']);
    let s = start([mon('slowpoke', ['hit-wind'])], [wild]).state;
    s = turn(s, MOVE0, MOVE0).state;
    const r = turn(s, MOVE0, MOVE1);
    expect(find(r.events, 'reaction', PLAYER)).toMatchObject({ reaction: 'core:conducted' });
  });
});

describe('switching', () => {
  it('clears the switching Zorling’s conditions and lingering effects, not the foe’s', () => {
    let s = start(
      [mon('ace', ['hit-metal']), mon('ace2', ['hit-metal'])],
      [mon('dummy', ['hit-wind'])],
    ).state;
    s = withStatus(withStatus(s, PLAYER, 'core:burning'), PLAYER, 'core:steam-burst', 'reaction');
    s = withStatus(s, OPPONENT, 'core:wet');
    const r = turn(s, { kind: 'switch', to: 1 });
    expect(r.state.sides[PLAYER].team[0]?.statuses).toEqual([]);
    expect(ids(r.state, PLAYER)).toEqual([]);
    expect(ids(r.state, OPPONENT)).toEqual(['core:wet']);
    // Back in later: still clean.
    const back = turn(r.state, { kind: 'switch', to: 0 });
    expect(ids(back.state, PLAYER)).toEqual([]);
  });

  it('conditions applied to a Zorling that just switched in last 3 of its own turns', () => {
    const s = start(
      [mon('ace', ['hit-metal']), mon('ace2', ['hit-metal'])],
      [mon('dummy', ['apply-fire'])],
    ).state;
    const r = turn(s, { kind: 'switch', to: 1 });
    expect(statusOf(r.state, PLAYER, 'core:burning')).toMatchObject({ turnsLeft: 3 });
    expect(find(r.events, 'statusDamage', PLAYER)).toBeUndefined();
  });
});

describe('weather', () => {
  it('puts its conditions on both first Zorlings at the start', () => {
    const r = start([mon('ace', ['hit-metal'])], [mon('dummy', ['hit-wind'])], {
      weather: ['core:burning'],
    });
    expect(r.events.map((e) => e.kind)).toEqual([
      'sendOut',
      'sendOut',
      'conditionApplied',
      'conditionApplied',
    ]);
    expect(find(r.events, 'conditionApplied')).toMatchObject({ source: null, turns: 3 });
    expect(ids(r.state, PLAYER)).toEqual(['core:burning']);
    expect(ids(r.state, OPPONENT)).toEqual(['core:burning']);
    // Counts from turn 1: ticks in turns 1–3, gone after turn 3.
    let s = r.state;
    for (let i = 0; i < 3; i++) s = turn(s).state;
    expect(ids(s, PLAYER)).toEqual([]);
  });

  it('respects immunities and rejects unknown conditions', () => {
    const r = start([mon('wetproof', ['hit-metal'])], [mon('dummy', ['hit-wind'])], {
      weather: ['core:wet'],
    });
    expect(find(r.events, 'conditionBlocked')).toEqual({
      kind: 'conditionBlocked',
      side: PLAYER,
      condition: 'core:wet',
      trait: 'core:waterproof',
    });
    expect(ids(r.state, PLAYER)).toEqual([]);
    expect(ids(r.state, OPPONENT)).toEqual(['core:wet']);
    expect(() =>
      start([mon('ace', ['hit-metal'])], [mon('dummy', ['hit-wind'])], { weather: ['core:nope'] }),
    ).toThrow();
  });

  it('weather drains have no source to heal', () => {
    const r = start([mon('ace', ['hit-metal'])], [mon('dummy', ['hit-wind'])], {
      weather: ['core:overgrown'],
    });
    const t = turn(r.state);
    expect(find(t.events, 'statusDamage')).toBeDefined();
    expect(find(t.events, 'heal')).toBeUndefined();
  });
});

describe('traits', () => {
  it('Waterproof never gets Wet, so it can never be Frozen', () => {
    let s = start([mon('ace', ['apply-water', 'hit-ice'])], [mon('wetproof', ['hit-wind'])]).state;
    const r = turn(s);
    expect(find(r.events, 'conditionBlocked', OPPONENT)).toMatchObject({ condition: 'core:wet' });
    s = turn(r.state, MOVE1).state;
    expect(ids(s, OPPONENT)).not.toContain('core:frozen');
  });

  it('Heatproof never starts Burning', () => {
    const r = turn(start([mon('ace', ['apply-fire'])], [mon('heatproof', ['hit-wind'])]).state);
    expect(find(r.events, 'conditionBlocked', OPPONENT)).toMatchObject({ trait: 'core:heatproof' });
    expect(ids(r.state, OPPONENT)).toEqual([]);
  });

  it('Kindling makes Fire moves deal 20% more', () => {
    const s = start([mon('kindler', ['hit-fire'])], [mon('dummy', ['hit-wind'])]).state;
    expect(find(turn(s).events, 'damage', OPPONENT)?.amount).toBe(
      expectedDamage(s, 'fire', { multiplier: 1.2 }),
    );
    const other = start([mon('kindler', ['hit-metal'])], [mon('dummy', ['hit-wind'])]).state;
    expect(find(turn(other).events, 'damage', OPPONENT)?.amount).toBe(
      expectedDamage(other, 'metal'),
    );
  });

  it('Lingering makes the conditions it applies last 1 turn longer', () => {
    const r = turn(start([mon('lingerer', ['apply-ice'])], [mon('dummy', ['hit-wind'])]).state);
    expect(find(r.events, 'conditionApplied', OPPONENT)).toMatchObject({ turns: 4 });
  });
});

describe('fainting from statuses', () => {
  it('a Zorling can faint at the end of a turn, which wins the battle', () => {
    const frail = { ...mon('frail', ['hit-wind'], 5), hp: 1 };
    const s = withStatus(
      start([mon('ace', ['apply-metal'])], [frail]).state,
      OPPONENT,
      'core:burning',
    );
    const r = turn(s);
    const kinds = r.events.map((e) => e.kind);
    expect(kinds.slice(-4)).toEqual(['statusDamage', 'fainted', 'turnEnd', 'end']);
    expect(r.state.outcome).toBe('win');
    expect(activeOf(r.state, OPPONENT).statuses).toEqual([]);
  });

  it('if both last Zorlings go down to statuses at once, the player wins', () => {
    const p = { ...mon('frail', ['apply-metal'], 5), hp: 1 };
    const o = { ...mon('frail', ['apply-metal'], 5), hp: 1 };
    let s = start([p], [o]).state;
    s = withStatus(withStatus(s, PLAYER, 'core:burning'), OPPONENT, 'core:burning');
    const r = turn(s);
    expect(r.events.filter((e) => e.kind === 'fainted')).toHaveLength(2);
    expect(r.state.outcome).toBe('win');
  });

  it('a fainted Zorling’s HP and statuses do not carry into the replacement', () => {
    const team = [{ ...mon('frail', ['hit-wind'], 5), hp: 1 }, mon('dummy', ['hit-wind'])];
    const s = withStatus(
      start([mon('ace', ['apply-metal'])], team).state,
      OPPONENT,
      'core:burning',
    );
    const r = turn(s);
    expect(r.state.phase).toBe('replace');
    const sent = step(content, r.state, { kind: 'replace', side: OPPONENT, to: 1 });
    expect(ids(sent.state, OPPONENT)).toEqual([]);
    expect(activeOf(sent.state, OPPONENT).hp).toBe(statsOf(content, team[1] as Zorling).hp);
  });
});

describe('determinism with conditions', () => {
  it('a combo-heavy battle replays identically and survives a JSON round trip', () => {
    const play = () => {
      uid = 500;
      let r = start(
        [mon('ace', ['apply-water', 'hit-electric', 'hitapply-fire'])],
        [mon('dummy', ['hitapply-earth', 'hit-nature', 'apply-nature'])],
        { seed: 77, weather: ['core:chilled'] },
      );
      const log: BattleEvent[] = [...r.events];
      for (let i = 0; i < 12 && r.state.phase === 'choose'; i++) {
        r = turn(r.state, { kind: 'move', slot: i % 3 }, { kind: 'move', slot: (i + 1) % 3 });
        log.push(...r.events);
        r = { ...r, state: JSON.parse(JSON.stringify(r.state)) as BattleState };
      }
      return { state: r.state, log };
    };
    const a = play();
    const b = play();
    expect(b).toEqual(a);
    expect(a.log.some((e) => e.kind === 'reaction')).toBe(true);
  });
});
