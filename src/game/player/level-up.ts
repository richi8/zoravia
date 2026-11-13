/**
 * Level-up choices (C22b): what a battle left for the player to decide, and applying those
 * decisions. A full move set means a new move is only *offered* (replace one or skip); an
 * evolution is offered on reaching its level and the player may wait (DESIGN.md → Creatures).
 * The battle text already announced both; these turn them into choices. Pure.
 */

import type { GameContent } from '@game/data';
import {
  canEvolve,
  evolve,
  learnMove,
  MOVE_SLOTS,
  type ProgressEvent,
  type Zorling,
} from '@game/progression';
import { markCaught } from './dex';
import type { Party } from './party';

export type Offer =
  | { readonly kind: 'move'; readonly uid: string; readonly move: string }
  | { readonly kind: 'evolve'; readonly uid: string; readonly into: string };

/**
 * The choices left by progression events (team order, then event order). Each member gets
 * its move offers first and at most one evolution offer, after them.
 */
export function offersFrom(
  team: readonly Zorling[],
  progress: readonly (readonly ProgressEvent[])[],
): Offer[] {
  const out: Offer[] = [];
  team.forEach((z, i) => {
    let evolveInto: string | undefined;
    for (const e of progress[i] ?? []) {
      if (e.kind === 'moveOffer') out.push({ kind: 'move', uid: z.uid, move: e.move });
      else if (e.kind === 'canEvolve') evolveInto = e.into;
    }
    if (evolveInto) out.push({ kind: 'evolve', uid: z.uid, into: evolveInto });
  });
  return out;
}

/** Index and Zorling of a team member by uid. */
export function memberOf(party: Party, uid: string): { index: number; zorling: Zorling } {
  const index = party.team.findIndex((z) => z.uid === uid);
  const zorling = party.team[index];
  if (!zorling) throw new Error(`No team member "${uid}"`);
  return { index, zorling };
}

/** Whether an offer still makes sense (the member is on the team and it still applies). */
export function offerValid(content: GameContent, party: Party, offer: Offer): boolean {
  const z = party.team.find((t) => t.uid === offer.uid);
  if (!z) return false;
  if (offer.kind === 'move') return !z.moves.includes(offer.move);
  return canEvolve(content, z) && content.species.require(z.species).evolution?.into === offer.into;
}

/**
 * Takes a move offer: learns `move` over `replaceSlot`, or skips it with `null`. With a free
 * slot (it can open up after an evolution) the move simply goes there.
 */
export function answerMoveOffer(
  content: GameContent,
  party: Party,
  uid: string,
  move: string,
  replaceSlot: number | null,
): Party {
  const { index, zorling } = memberOf(party, uid);
  const slot = zorling.moves.length < MOVE_SLOTS && replaceSlot === null ? 0 : replaceSlot;
  const { zorling: next } = learnMove(content, zorling, move, slot);
  return { ...party, team: party.team.map((t, i) => (i === index ? next : t)) };
}

/**
 * Evolves a team member. Returns the new party (the new species is logged as caught), the
 * evolution's events and the move offers it left (moves the new form learns at this level).
 */
export function evolveMember(
  content: GameContent,
  party: Party,
  uid: string,
): { party: Party; events: readonly ProgressEvent[]; offers: Offer[] } {
  const { index, zorling } = memberOf(party, uid);
  const result = evolve(content, zorling);
  const team = party.team.map((t, i) => (i === index ? result.zorling : t));
  const offers: Offer[] = result.events.flatMap((e) =>
    e.kind === 'moveOffer' ? [{ kind: 'move' as const, uid, move: e.move }] : [],
  );
  return {
    party: { ...party, team, dex: markCaught(party.dex, [result.zorling.species]) },
    events: result.events,
    offers,
  };
}
