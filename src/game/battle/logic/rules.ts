/**
 * Battle numbers: damage formula, accuracy, turn order and running away. Starting values,
 * tuned in C31. All functions are pure; randomness is passed in as already-rolled numbers.
 */

/** Damage is multiplied by a roll in [DAMAGE_ROLL_MIN, 1). */
export const DAMAGE_ROLL_MIN = 0.85;

/** Run chance when slower than the foe, and how much each failed attempt adds. */
export const RUN_BASE_CHANCE = 0.5;
export const RUN_CHANCE_STEP = 0.25;

/** Action order within a turn: running first, then switches, then moves by speed. */
export const ACTION_RANK = { run: 0, switch: 1, move: 2 } as const;

export interface DamageInput {
  readonly level: number;
  readonly power: number;
  readonly attack: number;
  readonly defense: number;
  /** Type effectiveness multiplier (`GameContent.effectiveness`). */
  readonly effectiveness: number;
  /** Random roll in [DAMAGE_ROLL_MIN, 1). */
  readonly roll: number;
  /** Extra multiplier: a reaction's damage multiplier times the user's trait type power. */
  readonly multiplier?: number;
  /** The target's defense counts as no higher than the user's attack (Shatter, Shred). */
  readonly ignoreDefense?: boolean;
}

/**
 * Damage of a hit: ((2·L/5 + 2) · power · ATK/DEF) / 50 + 2, then effectiveness, the extra
 * multiplier and the roll. Ignoring defense caps DEF at ATK, so it never lowers damage. A move with power always deals at least 1. No same-type bonus (dropped 2026-11-12:
 * it would weaken the off-type moves that combos rely on).
 */
export function computeDamage(d: DamageInput): number {
  if (d.power <= 0) return 0;
  const levelFactor = Math.floor((2 * d.level) / 5) + 2;
  const defense = Math.max(1, d.ignoreDefense ? Math.min(d.defense, d.attack) : d.defense);
  const base = Math.floor((levelFactor * d.power * d.attack) / defense / 50) + 2;
  return Math.max(1, Math.floor(base * d.effectiveness * (d.multiplier ?? 1) * d.roll));
}

/**
 * Chance (0–1) that a move hits: accuracy % times the user's accuracy multiplier, divided by
 * the target's evasion multiplier (evasion below 1 means easier to hit).
 */
export function hitChance(accuracy: number, accuracyMultiplier = 1, evasionMultiplier = 1): number {
  const p = ((accuracy / 100) * accuracyMultiplier) / evasionMultiplier;
  return Math.min(1, Math.max(0, p));
}

/** HP a status takes at the end of a turn: max HP × (fraction + growth × ticks so far), ≥ 1. */
export function statusHpLoss(maxHp: number, fraction: number, growth: number, ticks: number) {
  return Math.max(1, Math.floor(maxHp * (fraction + growth * ticks)));
}

/**
 * Chance (0–1) to run from a wild battle: always when at least as fast as the foe, otherwise
 * RUN_BASE_CHANCE plus RUN_CHANCE_STEP for each failed attempt before.
 */
export function runChance(speed: number, foeSpeed: number, failedAttempts: number): number {
  if (speed >= foeSpeed) return 1;
  return Math.min(1, RUN_BASE_CHANCE + RUN_CHANCE_STEP * failedAttempts);
}
