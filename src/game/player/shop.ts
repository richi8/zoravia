/**
 * Shops, money and using items outside battle (C22). Potions are shop-only and money-only,
 * capped at 5 per type in the bag (DESIGN.md → Economy). Pure.
 */

import type { GameContent } from '@game/data';
import { addToBag, bagCount, bagRoom, takeFromBag } from '@game/inventory';
import { statsOf, type Zorling } from '@game/progression';
import type { Party } from './party';

/** Money for beating a wild Zorling ("small change"). Starting values, tuned in C31. */
export const WILD_PRIZE = { base: 4, perLevel: 2 } as const;

export function wildPrize(level: number): number {
  return WILD_PRIZE.base + WILD_PRIZE.perLevel * Math.max(1, Math.floor(level));
}

/** Most of an item the party can buy now: limited by money and bag room (0 = none). */
export function maxBuyable(content: GameContent, party: Party, item: string): number {
  const price = content.items.require(item).price;
  if (price <= 0) return 0;
  return Math.max(0, Math.min(Math.floor(party.money / price), bagRoom(content, party.bag, item)));
}

/** Buys `count` of an item. Throws if it is not sold, too expensive or over the bag cap. */
export function buyItem(content: GameContent, party: Party, item: string, count: number): Party {
  if (!Number.isInteger(count) || count < 1) throw new Error(`Bad count ${count}`);
  const max = maxBuyable(content, party, item);
  if (count > max) throw new Error(`Cannot buy ${count} "${item}" (at most ${max})`);
  const price = content.items.require(item).price;
  const { bag } = addToBag(content, party.bag, item, count);
  return { ...party, bag, money: party.money - price * count };
}

/** Why an item can't be used on a team member outside battle, or undefined when it can. */
export function fieldUseProblem(
  content: GameContent,
  party: Party,
  item: string,
  teamIndex: number,
): 'none' | 'battle-only' | 'fainted' | 'full' | 'target' | undefined {
  const it = content.items.require(item);
  if (bagCount(party.bag, item) < 1) return 'none';
  if (it.effect.kind !== 'heal') return 'battle-only';
  const z = party.team[teamIndex];
  if (!z) return 'target';
  // No revives (DESIGN.md → Combat): a potion needs a Zorling that has not fainted.
  if (z.hp <= 0) return 'fainted';
  if (z.hp >= statsOf(content, z).hp) return 'full';
  return undefined;
}

/** Uses a potion on a team member outside battle (no turn to lose). Returns HP restored. */
export function useItemInField(
  content: GameContent,
  party: Party,
  item: string,
  teamIndex: number,
): { party: Party; healed: number } {
  const problem = fieldUseProblem(content, party, item, teamIndex);
  if (problem) throw new Error(`Cannot use "${item}" here: ${problem}`);
  const effect = content.items.require(item).effect;
  const z = party.team[teamIndex] as Zorling;
  const max = statsOf(content, z).hp;
  const amount = effect.kind === 'heal' && effect.amount !== 'full' ? effect.amount : max;
  const hp = Math.min(max, z.hp + amount);
  const team = party.team.map((t, i) => (i === teamIndex ? { ...t, hp } : t));
  return { party: { ...party, team, bag: takeFromBag(party.bag, item) }, healed: hp - z.hp };
}
