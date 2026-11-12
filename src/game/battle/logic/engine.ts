/**
 * The battle engine: `step(content, state, action) → { state, events }`. Pure and
 * deterministic: the input state is never changed, and all randomness comes from the RNG
 * state stored in the battle, so the same state and action always give the same result.
 */

import { Rng, type Seed } from '@engine/core';
import type { GameContent } from '@game/data';
import { statsOf, type Zorling } from '@game/progression';
import { ACTION_RANK, computeDamage, DAMAGE_ROLL_MIN, hitChance, runChance } from './rules';
import {
  activeOf,
  canFight,
  foe,
  needsReplacement,
  OPPONENT,
  PLAYER,
  type BattleAction,
  type BattleEvent,
  type BattleKind,
  type BattleSide,
  type BattleState,
  type Choice,
  type Combatant,
  type SideId,
  type StepResult,
} from './state';

/** Working copy the engine changes while resolving one action (never the caller's state). */
type DraftCombatant = Omit<Combatant, 'hp'> & { hp: number };
interface DraftSide {
  team: DraftCombatant[];
  active: number;
}
type Draft = Omit<BattleState, 'turn' | 'phase' | 'outcome' | 'runAttempts' | 'sides' | 'rng'> & {
  turn: number;
  phase: BattleState['phase'];
  outcome: BattleState['outcome'];
  runAttempts: number;
  sides: [DraftSide, DraftSide];
  rng: BattleState['rng'];
};

export interface BattleSetup {
  readonly kind: BattleKind;
  readonly seed: Seed;
  /** The player's team in hotbar order. Fainted members may be included. */
  readonly player: readonly Zorling[];
  /** The wild Zorling, or the trainer's team in send-out order. */
  readonly opponent: readonly Zorling[];
}

/** Starts a battle: each side sends out its first Zorling that has not fainted. */
export function createBattle(content: GameContent, setup: BattleSetup): StepResult {
  const toSide = (team: readonly Zorling[], side: SideId): BattleSide => {
    if (team.length === 0) throw new Error(`Side ${side} has no Zorlings`);
    const combatants = team.map((z) => toCombatant(content, z));
    const active = combatants.findIndex((c) => c.hp > 0);
    if (active < 0) throw new Error(`Side ${side} has no Zorling that can fight`);
    return { team: combatants, active };
  };
  const player = toSide(setup.player, PLAYER);
  const opponent = toSide(setup.opponent, OPPONENT);
  if (setup.kind === 'wild' && opponent.team.length !== 1) {
    throw new Error('A wild battle has exactly one opposing Zorling');
  }
  const state: BattleState = {
    kind: setup.kind,
    turn: 1,
    phase: 'choose',
    outcome: null,
    runAttempts: 0,
    sides: [player, opponent],
    rng: new Rng(setup.seed).getState(),
  };
  const events: BattleEvent[] = [
    { kind: 'sendOut', side: PLAYER, slot: player.active },
    { kind: 'sendOut', side: OPPONENT, slot: opponent.active },
  ];
  return { state, events };
}

function toCombatant(content: GameContent, z: Zorling): Combatant {
  const stats = statsOf(content, z);
  return {
    zorling: z,
    types: content.species.require(z.species).types,
    stats,
    hp: Math.min(Math.max(0, z.hp), stats.hp),
  };
}

/** Every choice a side may make this turn (phase `'choose'`). */
export function legalChoices(state: BattleState, side: SideId): Choice[] {
  if (state.phase !== 'choose') return [];
  const s = state.sides[side];
  const active = activeOf(state, side);
  const out: Choice[] = active.zorling.moves.map((_, slot) => ({ kind: 'move', slot }));
  s.team.forEach((c, to) => {
    if (to !== s.active && c.hp > 0) out.push({ kind: 'switch', to });
  });
  if (side === PLAYER && state.kind === 'wild') out.push({ kind: 'run' });
  return out;
}

/** Slots a side may send in during phase `'replace'`. */
export function legalReplacements(state: BattleState, side: SideId): number[] {
  if (!needsReplacement(state, side)) return [];
  return state.sides[side].team.flatMap((c, i) => (c.hp > 0 ? [i] : []));
}

/** Applies one action. Throws on an action that is not allowed in the current state. */
export function step(content: GameContent, state: BattleState, action: BattleAction): StepResult {
  switch (action.kind) {
    case 'turn':
      return playTurn(content, state, action.player, action.opponent);
    case 'replace':
      return replace(state, action.side, action.to);
  }
}

function replace(state: BattleState, side: SideId, to: number): StepResult {
  if (!legalReplacements(state, side).includes(to)) {
    throw new Error(`Side ${side} cannot send in slot ${to} now`);
  }
  const draft = clone(state);
  draft.sides[side].active = to;
  const events: BattleEvent[] = [{ kind: 'sendOut', side, slot: to }];
  if (!needsReplacement(draft, PLAYER) && !needsReplacement(draft, OPPONENT)) {
    draft.phase = 'choose';
  }
  return { state: draft, events };
}

interface Queued {
  readonly side: SideId;
  readonly choice: Choice;
}

function playTurn(
  content: GameContent,
  state: BattleState,
  player: Choice,
  opponent: Choice,
): StepResult {
  if (state.phase !== 'choose') throw new Error(`Cannot play a turn in phase "${state.phase}"`);
  checkChoice(state, PLAYER, player);
  checkChoice(state, OPPONENT, opponent);

  const draft = clone(state);
  const rng = Rng.fromState(state.rng);
  const events: BattleEvent[] = [{ kind: 'turnStart', turn: draft.turn }];
  const queue: Queued[] = [
    { side: PLAYER, choice: player },
    { side: OPPONENT, choice: opponent },
  ];
  const ranked = (rank: number): Queued[] =>
    queue.filter((q) => ACTION_RANK[q.choice.kind] === rank);

  // Only the player can choose to run (checked above).
  if (player.kind === 'run') tryRun(draft, rng, events);
  if (draft.phase !== 'ended') {
    for (const q of ranked(ACTION_RANK.switch)) {
      if (q.choice.kind === 'switch') doSwitch(draft, q.side, q.choice.to, events);
    }
    for (const q of moveOrder(draft, rng, ranked(ACTION_RANK.move))) {
      if (q.choice.kind === 'move') useMove(content, draft, rng, q.side, q.choice.slot, events);
    }
    endTurn(draft, events);
  }
  draft.rng = rng.getState();
  return { state: draft, events };
}

function checkChoice(state: BattleState, side: SideId, choice: Choice): void {
  const ok = legalChoices(state, side).some(
    (c) =>
      c.kind === choice.kind &&
      (c.kind !== 'move' || (choice.kind === 'move' && c.slot === choice.slot)) &&
      (c.kind !== 'switch' || (choice.kind === 'switch' && c.to === choice.to)),
  );
  if (!ok) throw new Error(`Side ${side} cannot choose ${JSON.stringify(choice)} now`);
}

/** Faster Zorling first; a speed tie is a coin flip. */
function moveOrder(draft: Draft, rng: Rng, moves: Queued[]): Queued[] {
  const [a, b] = moves;
  if (!a || !b) return moves;
  const speedA = activeOf(draft, a.side).stats.speed;
  const speedB = activeOf(draft, b.side).stats.speed;
  const aFirst = speedA === speedB ? rng.chance(0.5) : speedA > speedB;
  return aFirst ? [a, b] : [b, a];
}

function tryRun(draft: Draft, rng: Rng, events: BattleEvent[]): void {
  const speed = activeOf(draft, PLAYER).stats.speed;
  const foeSpeed = activeOf(draft, OPPONENT).stats.speed;
  if (rng.chance(runChance(speed, foeSpeed, draft.runAttempts))) {
    events.push({ kind: 'ran' });
    finish(draft, 'ran', events);
  } else {
    draft.runAttempts += 1;
    events.push({ kind: 'runFailed' });
  }
}

function doSwitch(draft: Draft, side: SideId, to: number, events: BattleEvent[]): void {
  const s = draft.sides[side];
  events.push({ kind: 'switchOut', side, slot: s.active });
  s.active = to;
  events.push({ kind: 'sendOut', side, slot: to });
}

function useMove(
  content: GameContent,
  draft: Draft,
  rng: Rng,
  side: SideId,
  slot: number,
  events: BattleEvent[],
): void {
  const user = activeOf(draft, side);
  if (user.hp <= 0) return; // fainted earlier this turn
  const targetSide = foe(side);
  const targetTeam = draft.sides[targetSide];
  const target = targetTeam.team[targetTeam.active];
  if (!target) throw new Error(`Side ${targetSide} has no active Zorling`);
  if (target.hp <= 0) return;

  const move = content.moves.require(user.zorling.moves[slot] ?? '');
  events.push({ kind: 'useMove', side, move: move.id });
  if (!rng.chance(hitChance(move.accuracy))) {
    events.push({ kind: 'miss', side, move: move.id });
    return;
  }
  if (move.power === 0) return; // status move: its condition is applied in C15

  const effectiveness = content.effectiveness(move.type, target.types);
  const amount = computeDamage({
    level: user.zorling.level,
    power: move.power,
    attack: user.stats.attack,
    defense: target.stats.defense,
    sameType: user.types.includes(move.type),
    effectiveness,
    roll: rng.float(DAMAGE_ROLL_MIN, 1),
  });
  const dealt = Math.min(amount, target.hp);
  target.hp -= dealt;
  events.push({ kind: 'damage', side: targetSide, amount: dealt, hp: target.hp, effectiveness });
  if (target.hp <= 0) {
    events.push({ kind: 'fainted', side: targetSide, slot: draft.sides[targetSide].active });
  }
}

function endTurn(draft: Draft, events: BattleEvent[]): void {
  events.push({ kind: 'turnEnd', turn: draft.turn });
  draft.turn += 1;
  const playerUp = canFight(draft, PLAYER);
  const opponentUp = canFight(draft, OPPONENT);
  // If both sides are out at once (possible with C15 damage over time), the player wins.
  if (!opponentUp) return finish(draft, 'win', events);
  if (!playerUp) return finish(draft, 'lose', events);

  const waiting = ([PLAYER, OPPONENT] as const).filter((s) => activeOf(draft, s).hp <= 0);
  if (waiting.length > 0) {
    draft.phase = 'replace';
    events.push({ kind: 'replaceNeeded', sides: waiting });
  }
}

function finish(draft: Draft, outcome: NonNullable<BattleState['outcome']>, events: BattleEvent[]) {
  draft.phase = 'ended';
  draft.outcome = outcome;
  events.push({ kind: 'end', outcome });
}

function clone(state: BattleState): Draft {
  return structuredClone(state) as unknown as Draft;
}
