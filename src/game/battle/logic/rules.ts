/**
 * Battle numbers: damage formula, accuracy, turn order and running away. Starting values,
 * tuned in C31. All functions are pure; randomness is passed in as already-rolled numbers.
 */

/** Moves of one of the user's own types deal this much more damage. */
export const SAME_TYPE_BONUS = 1.25;

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
  /** Same-type bonus applies. */
  readonly sameType: boolean;
  /** Type effectiveness multiplier (`GameContent.effectiveness`). */
  readonly effectiveness: number;
  /** Random roll in [DAMAGE_ROLL_MIN, 1). */
  readonly roll: number;
}

/**
 * Damage of a hit: ((2·L/5 + 2) · power · ATK/DEF) / 50 + 2, then same-type bonus,
 * effectiveness and the roll. A move with power always deals at least 1.
 */
export function computeDamage(d: DamageInput): number {
  if (d.power <= 0) return 0;
  const levelFactor = Math.floor((2 * d.level) / 5) + 2;
  const base = Math.floor((levelFactor * d.power * d.attack) / Math.max(1, d.defense) / 50) + 2;
  const bonus = d.sameType ? SAME_TYPE_BONUS : 1;
  return Math.max(1, Math.floor(base * bonus * d.effectiveness * d.roll));
}

/** Chance (0–1) that a move hits. C15 adds accuracy and evasion modifiers. */
export function hitChance(accuracy: number): number {
  return Math.min(1, Math.max(0, accuracy / 100));
}

/**
 * Chance (0–1) to run from a wild battle: always when at least as fast as the foe, otherwise
 * RUN_BASE_CHANCE plus RUN_CHANCE_STEP for each failed attempt before.
 */
export function runChance(speed: number, foeSpeed: number, failedAttempts: number): number {
  if (speed >= foeSpeed) return 1;
  return Math.min(1, RUN_BASE_CHANCE + RUN_CHANCE_STEP * failedAttempts);
}
