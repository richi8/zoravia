/**
 * Battle numbers: damage formula, accuracy, turn order and running away. Starting values,
 * tuned in C31. All functions are pure; randomness is passed in as already-rolled numbers.
 */

/** Damage is multiplied by a roll in [DAMAGE_ROLL_MIN, 1). */
export const DAMAGE_ROLL_MIN = 0.85;

/** Run chance when slower than the foe, and how much each failed attempt adds. */
export const RUN_BASE_CHANCE = 0.5;
export const RUN_CHANCE_STEP = 0.25;

/** Action order within a turn: running first, then switches and items, then moves by speed. */
export const ACTION_RANK = { run: 0, switch: 1, item: 1, move: 2, wait: 2 } as const;

/** Damage a boss takes while its Armor holds. */
export const ARMOR_DAMAGE_MULTIPLIER = 0.4;
/** Damage a boss takes while its Armor is broken (the breaking hit included). */
export const ARMOR_BROKEN_MULTIPLIER = 1.5;
/** Turns after the one it broke in that Armor stays broken; it re-arms at the end of the last. */
export const ARMOR_BROKEN_TURNS = 2;

/** Capture chance at full HP, and how much the missing HP fraction adds on top. */
export const CAPTURE_BASE = 0.1;
export const CAPTURE_HP_WEIGHT = 0.75;
/** Capture chance multiplier while the target has at least one condition. */
export const CAPTURE_CONDITION_BONUS = 1.2;
/** Wobbles shown for a successful capture; a failed one shows fewer. */
export const CAPTURE_WOBBLES = 3;

export interface CaptureInput {
  readonly hp: number;
  readonly maxHp: number;
  /** The capture item's strength (Zorb: 1). */
  readonly strength: number;
  /** The species' catch rate (default 1). */
  readonly catchRate: number;
  /** Whether the target has a condition (Burning, Wet, …). */
  readonly hasCondition: boolean;
}

/**
 * Chance (0–1) that a capture item catches a wild Zorling: (base + weight × missing HP
 * fraction) × strength × catch rate, ×1.2 with a condition. A Zorb on a full-HP Zorling with
 * catch rate 1 is 10%; at 1 HP about 85%, ~100% with a condition.
 */
export function captureChance(c: CaptureInput): number {
  const missing = 1 - Math.min(1, Math.max(0, c.hp / c.maxHp));
  const bonus = c.hasCondition ? CAPTURE_CONDITION_BONUS : 1;
  const p = (CAPTURE_BASE + CAPTURE_HP_WEIGHT * missing) * c.strength * c.catchRate * bonus;
  return Math.min(1, Math.max(0, p));
}

/**
 * Wobbles before a capture breaks free: the closer the roll was to succeeding, the more
 * (0 to CAPTURE_WOBBLES − 1). A success shows CAPTURE_WOBBLES.
 */
export function captureWobbles(chance: number, roll: number): number {
  if (roll < chance) return CAPTURE_WOBBLES;
  if (roll <= 0) return 0;
  return Math.min(CAPTURE_WOBBLES - 1, Math.floor((chance / roll) * CAPTURE_WOBBLES));
}

/** Expected value of the damage roll, used by the AI to estimate damage. */
export const DAMAGE_ROLL_MEAN = (DAMAGE_ROLL_MIN + 1) / 2;

export interface DamageInput {
  readonly level: number;
  readonly power: number;
  readonly attack: number;
  readonly defense: number;
  /** Type effectiveness multiplier (`GameContent.effectiveness`). */
  readonly effectiveness: number;
  /** Random roll in [DAMAGE_ROLL_MIN, 1). */
  readonly roll: number;
  /** Extra multiplier: reaction × the user's trait type power × the target's Armor. */
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
