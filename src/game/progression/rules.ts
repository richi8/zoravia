/**
 * Progression numbers: stat formula, XP curve, XP yield and the badge-based soft level cap
 * (DESIGN.md "Creatures" / "World"). Starting values, tuned in C31.
 */

import { STAT_IDS, statTotal, type BaseStats, type Species } from '@game/data';

/** Highest level an instance can reach. Endgame zones top out at 60. */
export const LEVEL_LIMIT = 100;

/** Captured Titans keep a Titan mark: +5% to every stat. */
export const TITAN_MARK_MULTIPLIER = 1.05;

/** Soft level cap per badges held (index = badge count). More badges: +5 each. */
export const LEVEL_CAPS: readonly number[] = [30, 45, 52, 60];
export const LEVEL_CAP_STEP = 5;

/** XP gained at or above the soft cap is multiplied by this ("sharply reduced"). */
export const OVER_CAP_XP_MULTIPLIER = 0.1;

/** Trainer-owned Zorlings give this much more XP than wild ones. */
export const TRAINER_XP_MULTIPLIER = 1.5;

/**
 * Battle stats at a level. No hidden per-instance values (those are a "Future" feature):
 * HP = 2·base·L/100 + L + 10, others = 2·base·L/100 + 5, then the Titan mark.
 */
export function statsAt(base: BaseStats, level: number, titanMark = false): BaseStats {
  const mark = titanMark ? TITAN_MARK_MULTIPLIER : 1;
  const out = {} as Record<(typeof STAT_IDS)[number], number>;
  for (const k of STAT_IDS) {
    const raw = Math.floor((2 * base[k] * level) / 100) + (k === 'hp' ? level + 10 : 5);
    out[k] = Math.floor(raw * mark);
  }
  return out;
}

/** Total XP needed to reach `level` (cubic curve, level 1 = 0). */
export function xpForLevel(level: number): number {
  return level <= 1 ? 0 : level ** 3 - 1;
}

/** Level reached with `xp` total XP. */
export function levelForXp(xp: number): number {
  let level = 1;
  while (level < LEVEL_LIMIT && xpForLevel(level + 1) <= xp) level++;
  return level;
}

/** Soft level cap for the number of badges held. */
export function levelCap(badges: number): number {
  const last = LEVEL_CAPS.length - 1;
  const cap =
    badges <= last
      ? (LEVEL_CAPS[Math.max(0, badges)] ?? 0)
      : (LEVEL_CAPS[last] ?? 0) + (badges - last) * LEVEL_CAP_STEP;
  return Math.min(cap, LEVEL_LIMIT);
}

/** Base XP a species gives: its `xpYield`, or stat total / 5. */
export function xpYield(species: Species): number {
  return species.xpYield ?? Math.round(statTotal(species.baseStats) / 5);
}

/** XP each team member earns for defeating a Zorling (before the soft cap). */
export function defeatXp(
  species: Species,
  level: number,
  opts: { trainer?: boolean } = {},
): number {
  const trainer = opts.trainer ? TRAINER_XP_MULTIPLIER : 1;
  return Math.max(1, Math.floor((xpYield(species) * level * trainer) / 7));
}
