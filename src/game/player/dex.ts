/**
 * The Dex (C22): which species the player has seen and caught. Plain, JSON-safe lists in the
 * order they were first logged. Caught implies seen. Pure.
 */

import type { GameContent } from '@game/data';

export interface Dex {
  readonly seen: readonly string[];
  readonly caught: readonly string[];
}

export const EMPTY_DEX: Dex = { seen: [], caught: [] };

/** Logs species as seen. Returns the same object when nothing is new. */
export function markSeen(dex: Dex, species: readonly string[]): Dex {
  const add = [...new Set(species)].filter((s) => !dex.seen.includes(s));
  return add.length ? { ...dex, seen: [...dex.seen, ...add] } : dex;
}

/** Logs species as caught (and seen). Returns the same object when nothing is new. */
export function markCaught(dex: Dex, species: readonly string[]): Dex {
  const seen = markSeen(dex, species);
  const add = [...new Set(species)].filter((s) => !seen.caught.includes(s));
  return add.length ? { ...seen, caught: [...seen.caught, ...add] } : seen;
}

export interface DexEntry {
  /** Dex number, from 1, in species registry order. */
  readonly number: number;
  readonly species: string;
  readonly seen: boolean;
  readonly caught: boolean;
}

/** Every species the content knows, in registry order, with what the player has logged. */
export function dexEntries(content: GameContent, dex: Dex): DexEntry[] {
  return content.species.values().map((s, i) => ({
    number: i + 1,
    species: s.id,
    seen: dex.seen.includes(s.id),
    caught: dex.caught.includes(s.id),
  }));
}
