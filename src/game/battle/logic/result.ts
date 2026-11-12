/** After a battle: write HP back into the Zorlings and award XP for a win. */

import type { GameContent } from '@game/data';
import { defeatXp, shareXp, type ProgressEvent, type Zorling } from '@game/progression';
import { OPPONENT, PLAYER, type BattleOutcome, type BattleState, type SideId } from './state';

export interface BattleResult {
  readonly outcome: BattleOutcome;
  /** The player's team with battle HP written back and XP added, in hotbar order. */
  readonly team: readonly Zorling[];
  /** XP each team member that has not fainted earned (before the soft cap). */
  readonly xp: number;
  /** Each team member's progression events, in team order. */
  readonly progress: readonly (readonly ProgressEvent[])[];
}

/** A side's Zorlings with their current battle HP. */
export function teamAfter(state: BattleState, side: SideId): Zorling[] {
  return state.sides[side].team.map((c) => ({ ...c.zorling, hp: c.hp }));
}

/** XP of a win: the sum over every opposing Zorling, ×1.5 in trainer battles. */
export function winXp(content: GameContent, state: BattleState): number {
  const trainer = state.kind === 'trainer';
  return state.sides[OPPONENT].team.reduce(
    (sum, c) =>
      sum + defeatXp(content.species.require(c.zorling.species), c.zorling.level, { trainer }),
    0,
  );
}

/**
 * Closes an ended battle. On a win, every team member that has not fainted gets the full
 * XP (team-wide shared XP). Running or losing gives no XP.
 */
export function finishBattle(
  content: GameContent,
  state: BattleState,
  opts: { readonly badges: number },
): BattleResult {
  if (state.phase !== 'ended' || !state.outcome) throw new Error('The battle has not ended');
  const team = teamAfter(state, PLAYER);
  if (state.outcome !== 'win') {
    return { outcome: state.outcome, team, xp: 0, progress: team.map(() => []) };
  }
  const xp = winXp(content, state);
  const shared = shareXp(content, team, xp, opts);
  return { outcome: 'win', team: shared.team, xp, progress: shared.events };
}
