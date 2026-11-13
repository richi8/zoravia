/**
 * One boss per save (C23, DESIGN.md "Bosses"): a Titan or legendary is done once the player
 * beats it or catches it. Losing or running leaves it waiting. Rematches (C27) count their
 * wins here too. Plain, JSON-safe data. Pure.
 */

import type { BattleOutcome } from '@game/battle/logic';

export type BossResult = 'defeated' | 'caught';

export interface BossRecord {
  readonly result: BossResult;
  /** Rematches won (C27); left out = 0. */
  readonly rematches?: number | undefined;
}

/** Boss id → how it ended. */
export type BossLog = Readonly<Record<string, BossRecord>>;

export const EMPTY_BOSS_LOG: BossLog = {};

/** Whether the boss was already beaten or caught in this save. */
export function bossDone(log: BossLog, boss: string): boolean {
  return log[boss] !== undefined;
}

/**
 * Logs a boss battle. A win counts as `defeated`, a catch as `caught`; other outcomes change
 * nothing. A catch after an earlier win upgrades the record. Returns the same object when
 * nothing changes.
 */
export function recordBoss(log: BossLog, boss: string, outcome: BattleOutcome): BossLog {
  const result: BossResult | undefined =
    outcome === 'caught' ? 'caught' : outcome === 'win' ? 'defeated' : undefined;
  if (!result) return log;
  const old = log[boss]?.result;
  if (old === 'caught' || old === result) return log;
  return { ...log, [boss]: { ...log[boss], result } };
}

/** Rematches won against a boss. */
export function bossRematches(log: BossLog, boss: string): number {
  return log[boss]?.rematches ?? 0;
}

/** Counts a rematch win (the boss must be done already; otherwise nothing changes). */
export function recordBossRematch(log: BossLog, boss: string): BossLog {
  const old = log[boss];
  if (!old) return log;
  return { ...log, [boss]: { ...old, rematches: (old.rematches ?? 0) + 1 } };
}
