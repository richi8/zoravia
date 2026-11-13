/**
 * The player's Zorlings, bag, money and Dex between battles (C21, C22). Saves come with C23.
 * Pure.
 */

import type { BattleResult } from '@game/battle/logic';
import type { GameContent } from '@game/data';
import type { Bag } from '@game/inventory';
import { statsOf, type Zorling } from '@game/progression';
import { EMPTY_DEX, markCaught, markSeen, type Dex } from './dex';

/** Hotbar size (DESIGN.md → Team). */
export const TEAM_SIZE = 3;

export interface Party {
  /** Active team in hotbar order (1–3). */
  readonly team: readonly Zorling[];
  /** Every other owned Zorling. */
  readonly storage: readonly Zorling[];
  readonly bag: Bag;
  readonly money: number;
  readonly dex: Dex;
}

export interface NewParty {
  readonly team: readonly Zorling[];
  readonly storage?: readonly Zorling[];
  readonly bag?: Bag;
  readonly money?: number;
}

/** A party whose Dex already lists every Zorling it owns as caught. */
export function newParty(p: NewParty): Party {
  const storage = p.storage ?? [];
  const owned = [...p.team, ...storage].map((z) => z.species);
  return {
    team: p.team,
    storage,
    bag: p.bag ?? {},
    money: p.money ?? 0,
    dex: markCaught(EMPTY_DEX, owned),
  };
}

export interface Applied {
  readonly party: Party;
  /** Where a caught Zorling went. */
  readonly caughtTo?: 'team' | 'storage';
}

export interface ApplyOptions {
  /** Species of the opposing Zorlings (logged as seen). */
  readonly opponents?: readonly string[];
  /** Money won (only paid on a win). */
  readonly prize?: number;
}

/**
 * Writes a battle result back: team HP and XP, used items, the prize on a win, the Dex, and
 * the caught Zorling (to the team while it has fewer than 3, else to storage; it gets a new
 * uid if its own is already taken).
 */
export function applyBattleResult(
  party: Party,
  result: BattleResult,
  opts: ApplyOptions = {},
): Applied {
  const team = [...result.team];
  const storage = [...party.storage];
  let dex = markSeen(party.dex, opts.opponents ?? []);
  let caughtTo: Applied['caughtTo'];
  if (result.caught) {
    const used = new Set([...team, ...storage].map((z) => z.uid));
    const caught = { ...result.caught, uid: freeUid(result.caught.uid, used) };
    caughtTo = team.length < TEAM_SIZE ? 'team' : 'storage';
    (caughtTo === 'team' ? team : storage).push(caught);
    dex = markCaught(dex, [caught.species]);
  }
  const prize = result.outcome === 'win' ? Math.max(0, Math.floor(opts.prize ?? 0)) : 0;
  const next: Party = { ...party, team, storage, bag: result.bag, money: party.money + prize, dex };
  return caughtTo ? { party: next, caughtTo } : { party: next };
}

/** `uid` if it is free, else `uid-2`, `uid-3`, … */
export function freeUid(uid: string, used: ReadonlySet<string>): string {
  if (!used.has(uid)) return uid;
  for (let n = 2; ; n++) {
    const next = `${uid}-${n}`;
    if (!used.has(next)) return next;
  }
}

/** True when no team member can fight. */
export function teamDown(party: Party): boolean {
  return party.team.every((z) => z.hp <= 0);
}

/** Every team member back to full HP. */
export function healTeam(content: GameContent, party: Party): Party {
  return { ...party, team: party.team.map((z) => healed(content, z)) };
}

/** A Zorling at full HP. */
export function healed(content: GameContent, z: Zorling): Zorling {
  return { ...z, hp: statsOf(content, z).hp };
}
