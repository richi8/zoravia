/**
 * Battle state, actions and events. Everything here is plain, JSON-safe data: the RNG state
 * travels inside the battle state, so a battle can be saved, sent to a server or replayed and
 * always continues the same way.
 */

import type { RngState } from '@engine/core';
import type { BaseStats } from '@game/data';
import type { Zorling } from '@game/progression';

/** Side 0 is the player, side 1 the opponent (a wild Zorling or a trainer). */
export type SideId = 0 | 1;
export const PLAYER: SideId = 0;
export const OPPONENT: SideId = 1;

export type BattleKind = 'wild' | 'trainer';
export type BattlePhase = 'choose' | 'replace' | 'ended';
export type BattleOutcome = 'win' | 'lose' | 'ran';

/** One Zorling taking part in a battle. */
export interface Combatant {
  /** The Zorling as it entered the battle (the battle never changes it). */
  readonly zorling: Zorling;
  readonly types: readonly string[];
  /** Battle stats at the start of the battle; `stats.hp` is max HP. */
  readonly stats: BaseStats;
  /** Current HP. 0 = fainted. */
  readonly hp: number;
}

export interface BattleSide {
  readonly team: readonly Combatant[];
  /** Index into `team` of the Zorling on the field. */
  readonly active: number;
}

export interface BattleState {
  readonly kind: BattleKind;
  /** The turn being chosen or played, starting at 1. */
  readonly turn: number;
  readonly phase: BattlePhase;
  /** Set when `phase` is `'ended'`. */
  readonly outcome: BattleOutcome | null;
  /** Failed run attempts so far (each one makes the next more likely). */
  readonly runAttempts: number;
  readonly sides: readonly [BattleSide, BattleSide];
  readonly rng: RngState;
}

/** What one side does with its turn. */
export type Choice =
  | { readonly kind: 'move'; readonly slot: number }
  /** Switching costs the turn. */
  | { readonly kind: 'switch'; readonly to: number }
  /** Player only, wild battles only. A failed attempt costs the turn. */
  | { readonly kind: 'run' };

export type BattleAction =
  /** Both sides' choices for the current turn (phase `'choose'`). */
  | { readonly kind: 'turn'; readonly player: Choice; readonly opponent: Choice }
  /** Sends in a Zorling after the active one fainted (phase `'replace'`). Free. */
  | { readonly kind: 'replace'; readonly side: SideId; readonly to: number };

/** What happened, in order, for the battle scene to present. */
export type BattleEvent =
  | { readonly kind: 'sendOut'; readonly side: SideId; readonly slot: number }
  | { readonly kind: 'turnStart'; readonly turn: number }
  | { readonly kind: 'switchOut'; readonly side: SideId; readonly slot: number }
  | { readonly kind: 'useMove'; readonly side: SideId; readonly move: string }
  | { readonly kind: 'miss'; readonly side: SideId; readonly move: string }
  /** `side` is the side that took the damage. */
  | {
      readonly kind: 'damage';
      readonly side: SideId;
      readonly amount: number;
      readonly hp: number;
      readonly effectiveness: number;
    }
  | { readonly kind: 'fainted'; readonly side: SideId; readonly slot: number }
  | { readonly kind: 'runFailed' }
  | { readonly kind: 'ran' }
  | { readonly kind: 'turnEnd'; readonly turn: number }
  /** Sides that must send in a replacement before the next turn. */
  | { readonly kind: 'replaceNeeded'; readonly sides: readonly SideId[] }
  | { readonly kind: 'end'; readonly outcome: BattleOutcome };

export interface StepResult {
  readonly state: BattleState;
  readonly events: readonly BattleEvent[];
}

/** The other side. */
export function foe(side: SideId): SideId {
  return side === PLAYER ? OPPONENT : PLAYER;
}

/** The Zorling a side has on the field. */
export function activeOf(state: BattleState, side: SideId): Combatant {
  const s = state.sides[side];
  const c = s.team[s.active];
  if (!c) throw new Error(`Side ${side} has no Zorling in slot ${s.active}`);
  return c;
}

/** Whether a side still has a Zorling that has not fainted. */
export function canFight(state: BattleState, side: SideId): boolean {
  return state.sides[side].team.some((c) => c.hp > 0);
}

/** Whether a side must send in a replacement (its active Zorling fainted, others can fight). */
export function needsReplacement(state: BattleState, side: SideId): boolean {
  return state.phase === 'replace' && activeOf(state, side).hp <= 0 && canFight(state, side);
}
