/**
 * The player's bag: item id → count. Pure functions over plain, JSON-safe data. Items with a
 * `bagCap` (potions: 5 per type, DESIGN.md "Economy") never go above it.
 */

import type { GameContent } from '@game/data';

export type Bag = Readonly<Record<string, number>>;

export const EMPTY_BAG: Bag = {};

/** How many of an item the bag holds. */
export function bagCount(bag: Bag, item: string): number {
  return bag[item] ?? 0;
}

/** How many more of an item fit (Infinity when it has no cap). */
export function bagRoom(content: GameContent, bag: Bag, item: string): number {
  const cap = content.items.require(item).bagCap;
  return cap === undefined ? Infinity : Math.max(0, cap - bagCount(bag, item));
}

export interface AddResult {
  readonly bag: Bag;
  /** How many were actually added (less than asked when the cap was reached). */
  readonly added: number;
}

/** Adds up to `count` of an item, stopping at its bag cap. */
export function addToBag(content: GameContent, bag: Bag, item: string, count = 1): AddResult {
  checkCount(count);
  const added = Math.min(count, bagRoom(content, bag, item));
  if (added === 0) return { bag, added: 0 };
  return { bag: { ...bag, [item]: bagCount(bag, item) + added }, added };
}

/** Removes `count` of an item. Throws if the bag holds fewer. */
export function takeFromBag(bag: Bag, item: string, count = 1): Bag {
  checkCount(count);
  const have = bagCount(bag, item);
  if (have < count) throw new Error(`The bag has ${have} "${item}", cannot take ${count}`);
  const { [item]: _old, ...rest } = bag;
  return have === count ? rest : { ...rest, [item]: have - count };
}

function checkCount(count: number): void {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`Item count must be a positive integer, got ${count}`);
  }
}
