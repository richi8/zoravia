/**
 * The player's Zorlings, bag and money between battles (C21). A minimal holder until the
 * party, storage and shop screens (C22) and saves (C23) exist. Pure.
 */

import type { BattleResult } from '@game/battle/logic';
import type { GameContent } from '@game/data';
import type { Bag } from '@game/inventory';
import { statsOf, type Zorling } from '@game/progression';

/** Hotbar size (DESIGN.md → Team). */
export const TEAM_SIZE = 3;

export interface Party {
  /** Active team in hotbar order (up to 3). */
  readonly team: readonly Zorling[];
  /** Every other owned Zorling. */
  readonly storage: readonly Zorling[];
  readonly bag: Bag;
  readonly money: number;
}

export interface Applied {
  readonly party: Party;
  /** Where a caught Zorling went. */
  readonly caughtTo?: 'team' | 'storage';
}

/** Writes a battle result back: team HP and XP, used items, and the caught Zorling. */
export function applyBattleResult(party: Party, result: BattleResult): Applied {
  const team = [...result.team];
  const storage = [...party.storage];
  let caughtTo: Applied['caughtTo'];
  if (result.caught) {
    caughtTo = team.length < TEAM_SIZE ? 'team' : 'storage';
    (caughtTo === 'team' ? team : storage).push(result.caught);
  }
  const next: Party = { ...party, team, storage, bag: result.bag };
  return caughtTo ? { party: next, caughtTo } : { party: next };
}

/** True when no team member can fight. */
export function teamDown(party: Party): boolean {
  return party.team.every((z) => z.hp <= 0);
}

/** Every team member back to full HP (until Zorling centers, C22). */
export function healTeam(content: GameContent, party: Party): Party {
  return { ...party, team: party.team.map((z) => ({ ...z, hp: statsOf(content, z).hp })) };
}
