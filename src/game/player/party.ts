/**
 * The player's Zorlings, bag, money, Dex, boss log, story flags and quests between battles
 * (C21–C23, C26). Saved by `@game/save`. Pure.
 */

import type { BattleResult } from '@game/battle/logic';
import type { GameContent } from '@game/data';
import type { Bag } from '@game/inventory';
import { statsOf, type Zorling } from '@game/progression';
import { EMPTY_BOSS_LOG, recordBoss, type BossLog } from './bosses';
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
  /** Bosses beaten or caught (one per save). */
  readonly bosses: BossLog;
  /** Story flags set by dialogue and quests (C26); a missing flag is 0. */
  readonly flags: Flags;
  /** Quests started, by id (C26); a quest not listed is not started. */
  readonly quests: QuestLog;
}

export type Flags = Readonly<Record<string, number>>;

/** A started quest: at a step (by id), or done. */
export type QuestProgress =
  { readonly state: 'active'; readonly step: string } | { readonly state: 'done' };

export type QuestLog = Readonly<Record<string, QuestProgress>>;

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
    bosses: EMPTY_BOSS_LOG,
    flags: {},
    quests: {},
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
  /** The boss fought, if any (logged on a win or a catch). */
  readonly boss?: string;
}

/**
 * Writes a battle result back: team HP and XP, used items, the prize on a win, the Dex, the
 * boss log, and the caught Zorling (to the team while it has fewer than 3, else to storage; it gets a new
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
  const bosses = opts.boss ? recordBoss(party.bosses, opts.boss, result.outcome) : party.bosses;
  const money = party.money + prize;
  const next: Party = { ...party, team, storage, bag: result.bag, money, dex, bosses };
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
