import { describe, expect, it } from 'vitest';
import { loadGameContent } from '@game/data';
import { createZorling, defeatXp, statsOf, type Zorling } from '@game/progression';
import { corePack } from '@packs/core';
import {
  activeOf,
  computeDamage,
  createBattle,
  DAMAGE_ROLL_MIN,
  finishBattle,
  legalChoices,
  legalReplacements,
  needsReplacement,
  OPPONENT,
  PLAYER,
  runChance,
  step,
  teamAfter,
  type BattleAction,
  type BattleEvent,
  type BattleKind,
  type BattleState,
  type Choice,
  type SideId,
  type StepResult,
} from '.';

const content = loadGameContent([corePack]);
const c = (local: string): string => `core:${local}`;
let uid = 0;
const make = (species: string, level: number, extra: Partial<Zorling> = {}): Zorling => {
  const z = createZorling(content, { uid: `z${uid++}`, species: c(species), level });
  return { ...z, ...extra, moves: extra.moves ?? z.moves };
};
const moves = (...ids: string[]): readonly string[] => ids.map(c);

const start = (
  player: Zorling[],
  opponent: Zorling[],
  seed: number | string = 1,
  kind: BattleKind = player.length > 1 || opponent.length > 1 ? 'trainer' : 'wild',
): StepResult => createBattle(content, { kind, seed, player, opponent });

const MOVE0: Choice = { kind: 'move', slot: 0 };
const turn = (state: BattleState, player: Choice, opponent: Choice = MOVE0): StepResult =>
  step(content, state, { kind: 'turn', player, opponent });
const kinds = (events: readonly BattleEvent[]): string[] => events.map((e) => e.kind);

/** Deep-freezes a value so any mutation by the engine throws. */
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) freeze(v);
    Object.freeze(value);
  }
  return value;
}

/** Plays a battle to the end: both sides use their first move and replace with the first legal slot. */
function playOut(
  initial: StepResult,
  policy: (s: BattleState, side: SideId) => Choice = () => MOVE0,
) {
  let state = initial.state;
  const log: BattleEvent[] = [...initial.events];
  const actions: BattleAction[] = [];
  for (let i = 0; i < 500 && state.phase !== 'ended'; i++) {
    let action: BattleAction;
    if (state.phase === 'replace') {
      const side = needsReplacement(state, PLAYER) ? PLAYER : OPPONENT;
      action = { kind: 'replace', side, to: legalReplacements(state, side)[0] ?? -1 };
    } else {
      action = { kind: 'turn', player: policy(state, PLAYER), opponent: policy(state, OPPONENT) };
    }
    actions.push(action);
    const r = step(content, freeze(state), action);
    state = r.state;
    log.push(...r.events);
  }
  return { state, log, actions };
}

describe('createBattle', () => {
  it('sends out the first Zorling that can fight on each side', () => {
    const fainted = make('emberkit', 10, { hp: 0 });
    const { state, events } = start([fainted, make('puddlit', 10)], [make('sproutle', 10)]);
    expect(state.sides[PLAYER].active).toBe(1);
    expect(state.sides[OPPONENT].active).toBe(0);
    expect(state.phase).toBe('choose');
    expect(state.turn).toBe(1);
    expect(events).toEqual([
      { kind: 'sendOut', side: PLAYER, slot: 1 },
      { kind: 'sendOut', side: OPPONENT, slot: 0 },
    ]);
  });

  it('keeps current HP and uses stats from the instance', () => {
    const z = make('emberkit', 10, { hp: 5 });
    const { state } = start([z], [make('sproutle', 10)]);
    expect(activeOf(state, PLAYER).hp).toBe(5);
    expect(activeOf(state, PLAYER).stats).toEqual(statsOf(content, z));
    expect(activeOf(state, PLAYER).types).toEqual([c('fire')]);
  });

  it('rejects empty teams, all-fainted teams and multi-Zorling wild battles', () => {
    const w = make('sproutle', 5);
    expect(() => start([], [w])).toThrow(/no Zorlings/);
    expect(() => start([make('emberkit', 5, { hp: 0 })], [w])).toThrow(/can fight/);
    expect(() => start([make('emberkit', 5)], [w, w], 1, 'wild')).toThrow(/exactly one/);
  });
});

describe('damage formula', () => {
  const base = {
    level: 50,
    power: 60,
    attack: 100,
    defense: 100,
    effectiveness: 1,
    roll: 1,
  };

  it('follows the formula', () => {
    // (22 · 60 · 100/100) / 50 + 2 = 28
    expect(computeDamage(base)).toBe(28);
    expect(computeDamage({ ...base, attack: 200 })).toBe(54);
    expect(computeDamage({ ...base, roll: DAMAGE_ROLL_MIN })).toBe(Math.floor(28 * 0.85));
  });

  it('applies effectiveness, with no same-type bonus', () => {
    expect(computeDamage({ ...base, effectiveness: 1.5 })).toBe(42);
    expect(computeDamage({ ...base, effectiveness: 0.67 })).toBe(18);
    expect(computeDamage({ ...base, effectiveness: 2.25 })).toBe(Math.floor(28 * 2.25));
  });

  it('deals at least 1 with power and 0 without', () => {
    expect(
      computeDamage({ ...base, level: 1, power: 1, attack: 1, defense: 255, roll: 0.85 }),
    ).toBe(1);
    expect(computeDamage({ ...base, power: 0 })).toBe(0);
  });
});

describe('a turn', () => {
  it('lets the faster Zorling move first', () => {
    // Voltbat (speed 185 base) outspeeds Ironshell (55).
    const { state } = start([make('ironshell', 20)], [make('voltbat', 20)]);
    const { events } = turn(state, MOVE0);
    const uses = events.filter((e) => e.kind === 'useMove').map((e) => e.side);
    expect(uses).toEqual([OPPONENT, PLAYER]);
  });

  it('breaks a speed tie with the battle RNG', () => {
    const firsts = new Set<SideId>();
    for (let seed = 0; seed < 40; seed++) {
      const { state } = start([make('emberkit', 10)], [make('emberkit', 10)], seed);
      const first = turn(state, MOVE0).events.find((e) => e.kind === 'useMove');
      if (first?.kind === 'useMove') firsts.add(first.side);
    }
    expect([...firsts].sort()).toEqual([PLAYER, OPPONENT]);
  });

  it('deals damage with type effectiveness and reports it', () => {
    // Ember (fire) on Sproutle (nature) is strong; on Puddlit (water) it is weak.
    const fire = make('emberkit', 15, { moves: moves('ember') });
    const vsNature = turn(start([fire], [make('sproutle', 15)]).state, MOVE0).events;
    const vsWater = turn(start([fire], [make('puddlit', 15)]).state, MOVE0).events;
    const hit = (events: readonly BattleEvent[]) =>
      events.find((e) => e.kind === 'damage' && e.side === OPPONENT);
    expect(hit(vsNature)).toMatchObject({ effectiveness: 1.5 });
    expect(hit(vsWater)).toMatchObject({ effectiveness: 0.67 });
  });

  it('lowers HP by exactly the damage reported', () => {
    const r = start([make('emberkit', 15)], [make('sproutle', 15)]);
    const before = activeOf(r.state, OPPONENT).hp;
    const after = turn(r.state, MOVE0);
    const dmg = after.events.find((e) => e.kind === 'damage' && e.side === OPPONENT);
    expect(dmg?.kind).toBe('damage');
    if (dmg?.kind !== 'damage') return;
    expect(dmg.hp).toBe(before - dmg.amount);
    expect(activeOf(after.state, OPPONENT).hp).toBe(dmg.hp);
    expect(after.state.turn).toBe(2);
    expect(kinds(after.events).at(0)).toBe('turnStart');
    expect(kinds(after.events).at(-1)).toBe('turnEnd');
  });

  it('never misses with 100 accuracy and sometimes misses with 90', () => {
    const missRate = (move: string): number => {
      let misses = 0;
      for (let seed = 0; seed < 400; seed++) {
        const z = make('ironshell', 30, { moves: moves(move) });
        const { events } = turn(start([z], [make('ironshell', 30)], seed).state, MOVE0);
        if (events.some((e) => e.kind === 'miss' && e.side === PLAYER)) misses++;
      }
      return misses / 400;
    };
    expect(missRate('iron-bash')).toBe(0);
    const rate = missRate('mud-toss');
    expect(rate).toBeGreaterThan(0.05);
    expect(rate).toBeLessThan(0.16);
  });

  it('a status move deals no damage', () => {
    const z = make('emberkit', 10, { moves: moves('kindle') });
    const { events } = turn(start([z], [make('sproutle', 10)]).state, MOVE0);
    expect(events.some((e) => e.kind === 'damage' && e.side === OPPONENT)).toBe(false);
    expect(events.some((e) => e.kind === 'useMove' && e.side === PLAYER)).toBe(true);
  });

  it('rejects choices that are not allowed', () => {
    const { state } = start(
      [make('emberkit', 10), make('puddlit', 10, { hp: 0 })],
      [make('sproutle', 10)],
      1,
      'trainer',
    );
    expect(() => turn(state, { kind: 'move', slot: 5 })).toThrow(/cannot choose/);
    expect(() => turn(state, { kind: 'switch', to: 0 })).toThrow(/cannot choose/); // already out
    expect(() => turn(state, { kind: 'switch', to: 1 })).toThrow(/cannot choose/); // fainted
    expect(() => turn(state, { kind: 'run' })).toThrow(/cannot choose/); // trainer battle
    expect(() => turn(state, MOVE0, { kind: 'run' })).toThrow(/cannot choose/); // opponent
    expect(() => step(content, state, { kind: 'replace', side: PLAYER, to: 0 })).toThrow();
  });

  it('lists legal choices', () => {
    const wild = start(
      [make('emberkit', 10), make('puddlit', 10)],
      [make('sproutle', 10)],
      1,
      'wild',
    );
    expect(legalChoices(content, wild.state, PLAYER)).toEqual([
      { kind: 'move', slot: 0 },
      { kind: 'move', slot: 1 },
      { kind: 'move', slot: 2 },
      { kind: 'switch', to: 1 },
      { kind: 'run' },
    ]);
    expect(legalChoices(content, wild.state, OPPONENT)).toEqual([
      { kind: 'move', slot: 0 },
      { kind: 'move', slot: 1 },
    ]);
  });

  it('never changes the input state', () => {
    const { state } = start([make('emberkit', 15)], [make('sproutle', 15)]);
    const copy = structuredClone(state);
    turn(freeze(state), MOVE0);
    expect(state).toEqual(copy);
  });
});

describe('fainting, winning and losing', () => {
  it('skips the move of a Zorling that fainted earlier in the turn and wins', () => {
    const strong = make('voltbat', 50);
    const { state, events } = turn(start([strong], [make('puddlit', 5)]).state, MOVE0);
    expect(kinds(events)).toEqual(['turnStart', 'useMove', 'damage', 'fainted', 'turnEnd', 'end']);
    expect(state.phase).toBe('ended');
    expect(state.outcome).toBe('win');
    expect(() => turn(state, MOVE0)).toThrow(/phase "ended"/);
  });

  it('loses when the whole player team has fainted', () => {
    const { state } = playOut(start([make('puddlit', 5)], [make('verdion', 60)]));
    expect(state.outcome).toBe('lose');
    expect(teamAfter(state, PLAYER)[0]?.hp).toBe(0);
  });

  it('asks for a free replacement after a faint', () => {
    const a = make('puddlit', 5);
    const b = make('ironshell', 60);
    const r = turn(start([a, b], [make('voltbat', 60)], 3).state, MOVE0);
    expect(r.state.phase).toBe('replace');
    expect(r.events.at(-1)).toEqual({ kind: 'replaceNeeded', sides: [PLAYER] });
    expect(needsReplacement(r.state, PLAYER)).toBe(true);
    expect(needsReplacement(r.state, OPPONENT)).toBe(false);
    expect(legalReplacements(r.state, PLAYER)).toEqual([1]);
    expect(legalChoices(content, r.state, PLAYER)).toEqual([]);
    expect(() => turn(r.state, MOVE0)).toThrow(/phase "replace"/);
    expect(() => step(content, r.state, { kind: 'replace', side: OPPONENT, to: 0 })).toThrow();

    const sent = step(content, r.state, { kind: 'replace', side: PLAYER, to: 1 });
    // Free: no turn is played, the foe does not attack.
    expect(sent.events).toEqual([{ kind: 'sendOut', side: PLAYER, slot: 1 }]);
    expect(sent.state.phase).toBe('choose');
    expect(sent.state.turn).toBe(r.state.turn);
    expect(activeOf(sent.state, PLAYER).zorling.uid).toBe(b.uid);
  });

  it('trainer battles go on until every opposing Zorling has fainted', () => {
    const foes = [make('sproutle', 5), make('puddlit', 5), make('emberkit', 5)];
    const { state, log } = playOut(start([make('verdion', 60)], foes, 7, 'trainer'));
    expect(state.outcome).toBe('win');
    expect(log.filter((e) => e.kind === 'fainted' && e.side === OPPONENT)).toHaveLength(3);
    expect(log.filter((e) => e.kind === 'sendOut' && e.side === OPPONENT)).toHaveLength(3);
  });
});

describe('switching', () => {
  it('costs the turn and the foe hits the Zorling that came in', () => {
    const a = make('emberkit', 10);
    const b = make('ironshell', 10);
    const { state, events } = turn(start([a, b], [make('voltbat', 10)], 1).state, {
      kind: 'switch',
      to: 1,
    });
    expect(kinds(events).slice(0, 3)).toEqual(['turnStart', 'switchOut', 'sendOut']);
    expect(events.some((e) => e.kind === 'useMove' && e.side === PLAYER)).toBe(false);
    expect(state.sides[PLAYER].active).toBe(1);
    expect(activeOf(state, PLAYER).hp).toBeLessThan(statsOf(content, b).hp);
    expect(state.sides[PLAYER].team[0]?.hp).toBe(statsOf(content, a).hp);
  });

  it('happens before moves even for the slower side', () => {
    const { events } = turn(
      start([make('ironshell', 10)], [make('voltbat', 10), make('emberkit', 10)], 1).state,
      MOVE0,
      { kind: 'switch', to: 1 },
    );
    expect(kinds(events).slice(1, 4)).toEqual(['switchOut', 'sendOut', 'useMove']);
  });
});

describe('running', () => {
  it('always works when at least as fast', () => {
    for (let seed = 0; seed < 20; seed++) {
      const { state, events } = turn(
        start([make('voltbat', 10)], [make('ironshell', 10)], seed).state,
        {
          kind: 'run',
        },
      );
      expect(kinds(events)).toEqual(['turnStart', 'ran', 'end']);
      expect(state.outcome).toBe('ran');
    }
  });

  it('can fail when slower, costs the turn, and gets likelier', () => {
    expect(runChance(10, 20, 0)).toBe(0.5);
    expect(runChance(10, 20, 1)).toBe(0.75);
    expect(runChance(10, 20, 2)).toBe(1);
    let failures = 0;
    for (let seed = 0; seed < 60; seed++) {
      const r = turn(start([make('ironshell', 30)], [make('voltbat', 10)], seed).state, {
        kind: 'run',
      });
      if (r.state.phase === 'ended') continue;
      failures++;
      expect(r.state.runAttempts).toBe(1);
      expect(kinds(r.events)).toContain('runFailed');
      expect(r.events.some((e) => e.kind === 'useMove' && e.side === OPPONENT)).toBe(true);
    }
    expect(failures).toBeGreaterThan(10);
    expect(failures).toBeLessThan(50);
  });
});

describe('determinism', () => {
  const scripted = (seed: number | string) =>
    playOut(
      start(
        [make('emberkit', 14), make('puddlit', 14), make('sproutle', 14)],
        [make('voltbat', 15), make('ironshell', 15), make('thornwing', 20)],
        seed,
        'trainer',
      ),
      // Rotate through moves so every slot gets used.
      (s, side) => {
        const n = activeOf(s, side).zorling.moves.length;
        return { kind: 'move', slot: (s.turn + side) % n };
      },
    );

  it('replays a scripted battle with a fixed seed identically', () => {
    uid = 1000;
    const a = scripted('replay');
    uid = 1000;
    const b = scripted('replay');
    expect(a.state.phase).toBe('ended');
    expect(b.state).toEqual(a.state);
    expect(b.log).toEqual(a.log);
    expect(a.log.length).toBeGreaterThan(20);
  });

  it('replays the same recorded actions from the start to the same end', () => {
    uid = 2000;
    const recorded = scripted(42);
    uid = 2000;
    let r = start(
      [make('emberkit', 14), make('puddlit', 14), make('sproutle', 14)],
      [make('voltbat', 15), make('ironshell', 15), make('thornwing', 20)],
      42,
      'trainer',
    );
    const log = [...r.events];
    for (const action of recorded.actions) {
      r = step(content, r.state, action);
      log.push(...r.events);
    }
    expect(r.state).toEqual(recorded.state);
    expect(log).toEqual(recorded.log);
  });

  it('gives different battles for different seeds', () => {
    const logs = new Set([1, 2, 3, 4, 5].map((s) => JSON.stringify(scripted(s).log)));
    expect(logs.size).toBeGreaterThan(1);
  });

  it('continues identically after a JSON round trip of the state', () => {
    let r = start([make('emberkit', 14)], [make('sproutle', 14)], 'save');
    r = turn(r.state, MOVE0);
    const restored = JSON.parse(JSON.stringify(r.state)) as BattleState;
    expect(turn(restored, MOVE0)).toEqual(turn(r.state, MOVE0));
  });
});

describe('finishBattle', () => {
  it('writes HP back and shares the XP of a win with every member, fainted ones too', () => {
    const lead = make('voltbat', 30);
    const down = make('puddlit', 10, { hp: 0 });
    const benched = make('sproutle', 10);
    const foe = make('puddlit', 5);
    const { state } = playOut(start([lead, down, benched], [foe], 9, 'wild'));
    expect(state.outcome).toBe('win');
    const result = finishBattle(content, state, { badges: 99 });
    const xp = defeatXp(content.species.require(foe.species), 5);
    expect(result.xp).toBe(xp);
    expect(result.team.map((z) => z.xp)).toEqual([lead.xp + xp, down.xp + xp, benched.xp + xp]);
    expect(result.team[1]?.hp).toBe(0);
    expect(result.progress[1]?.[0]).toMatchObject({ kind: 'xp', amount: xp });
    expect(result.progress[0]?.[0]).toMatchObject({ kind: 'xp', amount: xp });
  });

  it('gives trainer XP for every opposing Zorling', () => {
    const foes = [make('sproutle', 5), make('emberkit', 6)];
    const { state } = playOut(start([make('verdion', 60)], foes, 2, 'trainer'));
    const sum = foes.reduce(
      (s, f) => s + defeatXp(content.species.require(f.species), f.level, { trainer: true }),
      0,
    );
    expect(finishBattle(content, state, { badges: 99 }).xp).toBe(sum);
  });

  it('gives no XP for running or losing, and only works once the battle ended', () => {
    const r = start([make('voltbat', 10)], [make('ironshell', 10)]);
    expect(() => finishBattle(content, r.state, { badges: 0 })).toThrow(/not ended/);
    const ran = turn(r.state, { kind: 'run' });
    const result = finishBattle(content, ran.state, { badges: 0 });
    expect(result).toMatchObject({ outcome: 'ran', xp: 0 });
    expect(result.team[0]).toEqual({ ...r.state.sides[PLAYER].team[0]?.zorling });
  });
});
