/**
 * Trainers beaten and badges held (C27). Plain, JSON-safe data. Pure.
 *
 * A trainer's first win pays its prize; with a rematch, the first rematch win pays the
 * rematch prize once more. Later wins pay nothing (DESIGN.md "Economy": trainer money is
 * one-time). Bosses follow the same rule with `BossRecord.rematches`.
 */

export interface TrainerRecord {
  /** Times beaten. */
  readonly wins: number;
}

/** Trainer id → record. A trainer not listed was never beaten. */
export type TrainerLog = Readonly<Record<string, TrainerRecord>>;

export const EMPTY_TRAINER_LOG: TrainerLog = {};

export function trainerWins(log: TrainerLog, trainer: string): number {
  return log[trainer]?.wins ?? 0;
}

/** Counts one more win. */
export function recordTrainerWin(log: TrainerLog, trainer: string): TrainerLog {
  return { ...log, [trainer]: { wins: trainerWins(log, trainer) + 1 } };
}

/**
 * Money for a win given the wins before it: the prize the first time, the rematch prize the
 * second time, then nothing.
 */
export function winPrize(
  winsBefore: number,
  prize: number,
  rematch: { readonly prize: number } | undefined,
): number {
  if (winsBefore === 0) return prize;
  if (winsBefore === 1) return rematch?.prize ?? 0;
  return 0;
}

/** Badges in the order they were won; giving one held already changes nothing. */
export function addBadge(badges: readonly string[], badge: string): readonly string[] {
  return badges.includes(badge) ? badges : [...badges, badge];
}
