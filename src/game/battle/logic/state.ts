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

/** Where a status comes from: a condition, or the lingering effect a reaction left. */
export type StatusOrigin = 'condition' | 'reaction';

/**
 * A condition (Burning, Wet, …) or a reaction's lingering effect (Rooted, Frozen, …) on a
 * Zorling. Its effects are looked up in the content by `id`.
 */
export interface Status {
  /** A condition id (origin `'condition'`) or a reaction id (origin `'reaction'`). */
  readonly id: string;
  readonly origin: StatusOrigin;
  /** End-of-turn countdowns left; it ends when this reaches 0. */
  readonly turnsLeft: number;
  /** Countdowns so far (growing drains get stronger with each). */
  readonly ticks: number;
  /** The side that applied it (drains heal that side's active Zorling); null for weather. */
  readonly source: SideId | null;
  /**
   * Applied after its holder already acted this turn, so this turn's countdown is skipped. A
   * status therefore always covers as many of the holder's own turns as it lasts.
   */
  readonly fresh: boolean;
}

/** One Zorling taking part in a battle. */
export interface Combatant {
  /** The Zorling as it entered the battle (the battle never changes it). */
  readonly zorling: Zorling;
  readonly types: readonly string[];
  /** Battle stats at the start of the battle; `stats.hp` is max HP. */
  readonly stats: BaseStats;
  /** Current HP. 0 = fainted. */
  readonly hp: number;
  /** Active statuses in the order they were applied. Cleared on switching out or fainting. */
  readonly statuses: readonly Status[];
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
  /** A Charged Zorling fumbled its move (it fails). */
  | { readonly kind: 'fumbled'; readonly side: SideId; readonly move: string }
  /** The Zorling loses its move to a status (e.g. Frozen). */
  | { readonly kind: 'skipped'; readonly side: SideId; readonly status: string }
  /** A hit set off a reaction on `side` (the target); the condition is used up. */
  | {
      readonly kind: 'reaction';
      readonly side: SideId;
      readonly reaction: string;
      readonly condition: string;
    }
  /** `side` is the side that took the damage. */
  | {
      readonly kind: 'damage';
      readonly side: SideId;
      readonly amount: number;
      readonly hp: number;
      readonly effectiveness: number;
    }
  | { readonly kind: 'fainted'; readonly side: SideId; readonly slot: number }
  /**
   * A condition was put on `side`. `source` is the side that applied it (null for weather);
   * `refreshed` means it was already there and now lasts the full time again.
   */
  | {
      readonly kind: 'conditionApplied';
      readonly side: SideId;
      readonly condition: string;
      readonly turns: number;
      readonly source: SideId | null;
      readonly refreshed: boolean;
    }
  /** A trait kept the condition off. */
  | {
      readonly kind: 'conditionBlocked';
      readonly side: SideId;
      readonly condition: string;
      readonly trait: string;
    }
  /** End-of-turn HP loss from a status (Burning, Overgrown, Rooted). */
  | {
      readonly kind: 'statusDamage';
      readonly side: SideId;
      readonly status: string;
      readonly amount: number;
      readonly hp: number;
    }
  /** A drain healed `side`. */
  | { readonly kind: 'heal'; readonly side: SideId; readonly amount: number; readonly hp: number }
  /** A status ran out. */
  | {
      readonly kind: 'statusEnded';
      readonly side: SideId;
      readonly status: string;
      readonly origin: StatusOrigin;
    }
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
