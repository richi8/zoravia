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

export interface DexPage {
  /** `All`, or a region's name (C42). */
  readonly name: string;
  readonly entries: readonly DexEntry[];
  readonly seen: number;
  readonly caught: number;
}

/**
 * The Dex pages (C42): All, then one per start region with the species of its pack (core is
 * Verdale), in pack order. A pack with no start region has no page of its own.
 */
export function dexPages(content: GameContent, dex: Dex): DexPage[] {
  const all = dexEntries(content, dex);
  const page = (name: string, entries: readonly DexEntry[]): DexPage => ({
    name,
    entries,
    seen: entries.filter((e) => e.seen).length,
    caught: entries.filter((e) => e.caught).length,
  });
  const packOf = (id: string): string => id.slice(0, id.indexOf(':'));
  const regions = new Map<string, string>();
  for (const s of content.starts.values()) {
    const pack = packOf(s.map);
    if (!regions.has(pack)) regions.set(pack, content.maps.get(s.map)?.name ?? s.name);
  }
  return [
    page('All', all),
    ...[...regions].map(([pack, name]) =>
      page(
        name,
        all.filter((e) => packOf(e.species) === pack),
      ),
    ),
  ];
}
