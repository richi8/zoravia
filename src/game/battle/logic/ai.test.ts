import { describe, expect, it } from 'vitest';
import { loadGameContent } from '@game/data';
import { createZorling, type Zorling } from '@game/progression';
import { corePack } from '@packs/core';
import {
  activeOf,
  aiChoice,
  aiReplacement,
  createBattle,
  legalChoices,
  legalReplacements,
  needsReplacement,
  OPPONENT,
  PLAYER,
  sameChoice,
  step,
  type AiStyle,
  type BattleEvent,
  type BattleState,
  type Choice,
  type SideId,
  type Status,
} from '.';

const content = loadGameContent([corePack]);
let uid = 0;
const make = (species: string, level: number, moves?: string[]): Zorling => {
  const z = createZorling(content, { uid: `a${uid++}`, species: `core:${species}`, level });
  return moves ? { ...z, moves: moves.map((m) => `core:${m}`) } : z;
};
const trainer = (player: Zorling[], opponent: Zorling[], seed = 1): BattleState =>
  createBattle(content, { kind: 'trainer', seed, player, opponent }).state;
const moveName = (s: BattleState, side: SideId, c: Choice): string =>
  c.kind === 'move' ? (activeOf(s, side).zorling.moves[c.slot] ?? '') : c.kind;

/** Puts a status on a side's active Zorling (as if applied in an earlier turn). */
function withStatus(s: BattleState, side: SideId, id: string, extra: Partial<Status> = {}) {
  const copy = structuredClone(s);
  const sides = copy.sides as unknown as { team: { statuses: Status[] }[]; active: number }[];
  sides[side]?.team[sides[side].active]?.statuses.push({
    id,
    origin: 'condition',
    turnsLeft: 3,
    ticks: 0,
    source: side === PLAYER ? OPPONENT : PLAYER,
    fresh: false,
    ...extra,
  });
  return copy;
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) freeze(v);
    Object.freeze(value);
  }
  return value;
}

describe('wild AI', () => {
  it('only picks its own moves, and is deterministic for a state', () => {
    const wild = make('voltbat', 25);
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const s = createBattle(content, {
        kind: 'wild',
        seed,
        player: [make('emberkit', 25)],
        opponent: [wild],
      }).state;
      const c = aiChoice(content, s, OPPONENT, 'wild');
      expect(c.kind).toBe('move');
      expect(aiChoice(content, s, OPPONENT, 'wild')).toEqual(c);
      seen.add(moveName(s, OPPONENT, c));
    }
    expect(seen.size).toBe(wild.moves.length); // it varies between its moves
  });

  it('never changes the state or advances the battle RNG', () => {
    const s = freeze(trainer([make('emberkit', 25)], [make('puddlit', 25), make('voltbat', 25)]));
    const rng = [...s.rng];
    for (const style of ['wild', 'trainer'] as const) aiChoice(content, s, OPPONENT, style);
    expect(s.rng).toEqual(rng);
  });
});

describe('trainer AI', () => {
  it('prefers the move that hits hardest (type effectiveness)', () => {
    // Water vs Fire is strong; Earth is also strong vs Fire but weaker and less accurate.
    const me = make('puddlit', 25, ['gust', 'splash-shot']);
    const s = trainer([make('emberkit', 25)], [me, make('ironshell', 25)]);
    expect(moveName(s, OPPONENT, aiChoice(content, s, OPPONENT, 'trainer'))).toBe(
      'core:splash-shot',
    );
  });

  it('sets off a reaction when the foe has a condition it exploits', () => {
    // Voltbat: Wing Cut (55, strong vs Nature) would normally win against Sproutle…
    const me = make('voltbat', 25, ['wing-cut', 'static-bite']);
    const s0 = trainer([make('sproutle', 25)], [me, make('ironshell', 25)]);
    expect(moveName(s0, OPPONENT, aiChoice(content, s0, OPPONENT, 'trainer'))).toBe(
      'core:wing-cut',
    );
    // …but with the foe Wet, Static Bite sets off Conducted (×1.75).
    const s = withStatus(s0, PLAYER, 'core:wet');
    expect(moveName(s, OPPONENT, aiChoice(content, s, OPPONENT, 'trainer'))).toBe(
      'core:static-bite',
    );
  });

  it('sets up a condition its team can exploit', () => {
    const wetter = make('puddlit', 25, ['splash-shot', 'drench']);
    const vs = [make('voltbat', 25)];
    // With an Electric teammate, Drench (Wet) beats a plain Water hit…
    const combo = trainer(vs, [wetter, make('voltbat', 25)]);
    expect(moveName(combo, OPPONENT, aiChoice(content, combo, OPPONENT, 'trainer'))).toBe(
      'core:drench',
    );
    // …without anyone to exploit Wet, it just attacks (a lone Zorling cannot switch).
    const plain = trainer(vs, [wetter]);
    expect(moveName(plain, OPPONENT, aiChoice(content, plain, OPPONENT, 'trainer'))).toBe(
      'core:splash-shot',
    );
    // A condition the foe already has is not worth setting up again.
    const already = withStatus(combo, PLAYER, 'core:wet');
    expect(moveName(already, OPPONENT, aiChoice(content, already, OPPONENT, 'trainer'))).not.toBe(
      'core:drench',
    );
  });

  it('switches to a teammate that can exploit a condition on the foe', () => {
    const s0 = trainer(
      [make('ironshell', 25)],
      [make('puddlit', 25, ['splash-shot', 'drench']), make('voltbat', 25)],
    );
    const s = withStatus(s0, PLAYER, 'core:wet');
    expect(aiChoice(content, s, OPPONENT, 'trainer')).toEqual({ kind: 'switch', to: 1 });
    // Not when the condition runs out this turn.
    const ending = withStatus(s0, PLAYER, 'core:wet', { turnsLeft: 1 });
    expect(aiChoice(content, ending, OPPONENT, 'trainer').kind).toBe('move');
  });

  it('switches out of a lost turn (Frozen)', () => {
    const s0 = trainer([make('ironshell', 25)], [make('emberkit', 25), make('voltbat', 25)]);
    const copy = structuredClone(s0);
    const sides = copy.sides as unknown as { team: { statuses: Status[] }[]; active: number }[];
    sides[OPPONENT]?.team[0]?.statuses.push({
      id: 'core:frozen',
      origin: 'reaction',
      turnsLeft: 1,
      ticks: 0,
      source: PLAYER,
      fresh: false,
    });
    expect(aiChoice(content, copy, OPPONENT, 'trainer')).toEqual({ kind: 'switch', to: 1 });
  });

  it('only makes legal choices, and never items or running', () => {
    for (let seed = 0; seed < 30; seed++) {
      const s = trainer(
        [make('emberkit', 25), make('sproutle', 25)],
        [make('voltbat', 25), make('puddlit', 25)],
        seed,
      );
      for (const side of [PLAYER, OPPONENT] as const) {
        const c = aiChoice(content, s, side, 'trainer');
        expect(legalChoices(content, s, side).some((l) => sameChoice(l, c))).toBe(true);
        expect(['move', 'switch']).toContain(c.kind);
      }
    }
  });

  it('sends in the best matchup after a faint', () => {
    // Against Emberkit (Fire): Puddlit (Water) beats Sproutle (Nature).
    let s = trainer(
      [make('emberkit', 30)],
      [make('voltbat', 5), make('sproutle', 25), make('puddlit', 25)],
    );
    for (let i = 0; i < 20 && s.phase === 'choose'; i++) {
      s = step(content, s, {
        kind: 'turn',
        player: { kind: 'move', slot: 0 },
        opponent: { kind: 'move', slot: 0 },
      }).state;
    }
    expect(needsReplacement(s, OPPONENT)).toBe(true);
    expect(legalReplacements(s, OPPONENT)).toEqual([1, 2]);
    expect(aiReplacement(content, s, OPPONENT)).toBe(2);
  });
});

/** Plays a trainer battle to the end with both sides run by the AI. */
function simulate(player: Zorling[], opponent: Zorling[], seed: number, playerStyle: AiStyle) {
  let state = trainer(player, opponent, seed);
  const events: BattleEvent[] = [];
  for (let i = 0; i < 300 && state.phase !== 'ended'; i++) {
    if (state.phase === 'replace') {
      const side = needsReplacement(state, PLAYER) ? PLAYER : OPPONENT;
      const to =
        side === PLAYER
          ? (legalReplacements(state, PLAYER)[0] ?? -1)
          : aiReplacement(content, state, OPPONENT);
      const r = step(content, state, { kind: 'replace', side, to });
      state = r.state;
      events.push(...r.events);
      continue;
    }
    const r = step(content, state, {
      kind: 'turn',
      player: aiChoice(content, state, PLAYER, playerStyle),
      opponent: aiChoice(content, state, OPPONENT, 'trainer'),
    });
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

describe('sample trainer fights', () => {
  const trainerTeam = () => [make('puddlit', 25), make('voltbat', 25), make('sproutle', 25)];
  const playerTeam = () => [make('emberkit', 25), make('ironshell', 25), make('thornwing', 25)];

  it('the trainer AI performs combos (reactions on the player) in sample fights', () => {
    let fights = 0;
    let withCombo = 0;
    let viaSwitch = 0;
    for (let seed = 0; seed < 20; seed++) {
      const { state, events } = simulate(playerTeam(), trainerTeam(), seed, 'wild');
      expect(state.phase).toBe('ended');
      fights++;
      const reactions = events.filter((e) => e.kind === 'reaction' && e.side === PLAYER);
      if (reactions.length > 0) withCombo++;
      // A combo set up by one Zorling and finished by a teammate that switched in.
      if (events.some((e) => e.kind === 'switchOut' && e.side === OPPONENT) && reactions.length) {
        viaSwitch++;
      }
    }
    expect(withCombo).toBeGreaterThan(0);
    expect(withCombo / fights).toBeGreaterThanOrEqual(0.5);
    expect(viaSwitch).toBeGreaterThan(0);
  });

  it('beats a random-move opponent more often than not', () => {
    let wins = 0;
    for (let seed = 0; seed < 30; seed++) {
      // Mirror match: same teams, so only the decisions differ.
      const { state } = simulate(trainerTeam(), trainerTeam(), seed, 'wild');
      if (state.outcome === 'lose') wins++; // the player (random) lost to the trainer AI
    }
    expect(wins / 30).toBeGreaterThan(0.6);
  });

  it('replays identically for a seed', () => {
    const [mine, theirs] = [playerTeam(), trainerTeam()];
    const a = simulate(mine, theirs, 3, 'trainer');
    const b = simulate(mine, theirs, 3, 'trainer');
    expect(a.events).toEqual(b.events);
    expect(a.state).toEqual(b.state);
  });
});
