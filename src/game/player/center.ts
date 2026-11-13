/**
 * Zorling center services (C22): healing, storage ↔ team swaps, reordering the hotbar and the
 * move relearner. Swaps happen only at a center (DESIGN.md → Team); the UI enforces that by
 * opening storage only there. Every function is pure and throws on a rule break, so the UI
 * checks with the `can*` helpers first.
 */

import type { GameContent } from '@game/data';
import { learnMove, MOVE_SLOTS, relearnableMoves, type Zorling } from '@game/progression';
import { healed, TEAM_SIZE, type Party } from './party';

/** Move relearner fee ("small fee", DESIGN.md → Creatures). Starting value, tuned in C31. */
export const RELEARN_FEE = 100;

/** Heals the team and everything in storage. */
export function healAll(content: GameContent, party: Party): Party {
  return {
    ...party,
    team: party.team.map((z) => healed(content, z)),
    storage: party.storage.map((z) => healed(content, z)),
  };
}

/** A place a Zorling can be in: a hotbar slot or a storage index (`storage.length` = new). */
export type Spot = { readonly area: 'team'; readonly index: number } | StorageSpot;
type StorageSpot = { readonly area: 'storage'; readonly index: number };

function at(party: Party, s: Spot): Zorling | undefined {
  return (s.area === 'team' ? party.team : party.storage)[s.index];
}

function inRange(party: Party, s: Spot): boolean {
  if (!Number.isInteger(s.index) || s.index < 0) return false;
  return s.area === 'team' ? s.index < TEAM_SIZE : s.index <= party.storage.length;
}

/**
 * Whether moving the Zorling at `from` onto `to` is allowed. Onto another Zorling they swap;
 * onto an empty spot it moves there. The team may never end up empty.
 */
export function canMove(party: Party, from: Spot, to: Spot): boolean {
  if (!inRange(party, from) || !inRange(party, to)) return false;
  if (!at(party, from)) return false;
  if (from.area === to.area && from.index === to.index) return false;
  const target = at(party, to);
  // Taking the last team member out without one coming back.
  if (from.area === 'team' && to.area === 'storage' && !target && party.team.length <= 1) {
    return false;
  }
  return true;
}

/** Moves or swaps (see `canMove`). Team and storage stay packed (no holes). */
export function moveZorling(party: Party, from: Spot, to: Spot): Party {
  if (!canMove(party, from, to)) {
    throw new Error(`Cannot move ${from.area}[${from.index}] to ${to.area}[${to.index}]`);
  }
  const team: (Zorling | undefined)[] = [...party.team];
  const storage: (Zorling | undefined)[] = [...party.storage];
  const list = (s: Spot): (Zorling | undefined)[] => (s.area === 'team' ? team : storage);
  const a = list(from)[from.index];
  const b = list(to)[to.index];
  list(from)[from.index] = b;
  list(to)[to.index] = a;
  const packed = (l: (Zorling | undefined)[]): Zorling[] => l.filter((z): z is Zorling => !!z);
  return { ...party, team: packed(team), storage: packed(storage) };
}

/** Moves the relearner can teach this team member. */
export function relearnOptions(content: GameContent, party: Party, teamIndex: number): string[] {
  const z = party.team[teamIndex];
  return z ? relearnableMoves(content, z) : [];
}

export type RelearnProblem = 'money' | 'move' | 'slot';

/** Why a relearn cannot happen, or undefined when it can. */
export function relearnProblem(
  content: GameContent,
  party: Party,
  teamIndex: number,
  move: string,
  replaceSlot: number | null,
): RelearnProblem | undefined {
  const z = party.team[teamIndex];
  if (!z || !relearnableMoves(content, z).includes(move)) return 'move';
  if (party.money < RELEARN_FEE) return 'money';
  if (
    z.moves.length >= MOVE_SLOTS &&
    (replaceSlot === null || z.moves[replaceSlot] === undefined)
  ) {
    return 'slot';
  }
  return undefined;
}

/** Pays the fee and teaches the move (into a free slot, or over `replaceSlot`). */
export function relearn(
  content: GameContent,
  party: Party,
  teamIndex: number,
  move: string,
  replaceSlot: number | null,
): Party {
  const problem = relearnProblem(content, party, teamIndex, move, replaceSlot);
  if (problem) throw new Error(`Cannot relearn "${move}": ${problem}`);
  const z = party.team[teamIndex] as Zorling;
  const { zorling } = learnMove(content, z, move, replaceSlot ?? 0);
  const team = party.team.map((t, i) => (i === teamIndex ? zorling : t));
  return { ...party, team, money: party.money - RELEARN_FEE };
}
