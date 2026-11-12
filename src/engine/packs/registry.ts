/**
 * Registries hold validated content of one kind (e.g. `species`, `moves`).
 * The engine defines no registry kinds itself; game code declares them with
 * `defineRegistry` and hands them to the `PackLoader`.
 */

import type { z } from 'zod';
import type { NamespacedId } from './ids';

/** A reference from one entry to an entry of some kind, found at `path` inside the entry. */
export interface EntryRef {
  readonly path: readonly PropertyKey[];
  /** Registry kind the id must exist in, e.g. `"moves"`. */
  readonly kind: string;
  readonly id: string;
}

/** A problem found by a registry's `check`, at `path` inside the entry. */
export interface EntryProblem {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

/** Read access to every loaded entry, for cross-entry checks. */
export interface CheckContext {
  get(kind: string, id: string): unknown;
  values(kind: string): readonly unknown[];
}

/**
 * Cross-entry rules, run once after every pack has loaded (so overrides and patches from
 * later packs are already applied):
 * - `refs` lists ids the entry points to; each must exist in its registry.
 * - `check` reports any other problem (cycles, duplicates, rules spanning entries).
 */
export interface RegistryOptions<T> {
  // Method syntax on purpose: definitions of any entry type fit `RegistryDefinition`.
  refs?(entry: Entry<T>): readonly EntryRef[];
  check?(entry: Entry<T>, ctx: CheckContext): readonly EntryProblem[];
}

/** Declares a kind of content and the schema each entry must satisfy. */
export interface RegistryDefinition<S extends z.ZodType = z.ZodType> {
  /** Key used under `content` in a pack, e.g. `"species"`. */
  readonly kind: string;
  readonly schema: S;
  readonly options: RegistryOptions<z.output<S>>;
}

export function defineRegistry<S extends z.ZodType>(
  kind: string,
  schema: S,
  options: RegistryOptions<z.output<S>> = {},
): RegistryDefinition<S> {
  return { kind, schema, options };
}

/** A validated entry: the schema output plus its full id. */
export type Entry<T> = Readonly<T> & { readonly id: NamespacedId };

/** Output type of a registry definition's entries. */
export type EntryOf<D extends RegistryDefinition> = Entry<z.output<D['schema']>>;

export interface EntryOrigin {
  /** Pack that added the entry (also its namespace). */
  readonly addedBy: string;
  /** Packs that overrode or patched it afterwards, in load order. */
  readonly modifiedBy: readonly string[];
}

/** Read-only, ordered view of one registry after loading. */
export class Registry<T> {
  constructor(
    readonly kind: string,
    private readonly entries: ReadonlyMap<NamespacedId, Entry<T>>,
    private readonly origins: ReadonlyMap<NamespacedId, EntryOrigin>,
  ) {}

  get size(): number {
    return this.entries.size;
  }

  has(id: string): boolean {
    return this.entries.has(id as NamespacedId);
  }

  get(id: string): Entry<T> | undefined {
    return this.entries.get(id as NamespacedId);
  }

  /** Like `get`, but throws a readable error for unknown ids. */
  require(id: string): Entry<T> {
    const entry = this.get(id);
    if (!entry) {
      const near = [...this.entries.keys()].filter((k) => k.endsWith(`:${id.split(':').pop()}`));
      const hint = near.length ? ` Did you mean ${near.map((k) => `"${k}"`).join(', ')}?` : '';
      throw new Error(`Unknown ${this.kind} "${id}".${hint}`);
    }
    return entry;
  }

  /** Ids in load order (pack order, then declaration order). */
  ids(): NamespacedId[] {
    return [...this.entries.keys()];
  }

  values(): Entry<T>[] {
    return [...this.entries.values()];
  }

  /** Entries from one namespace. */
  inNamespace(namespace: string): Entry<T>[] {
    const prefix = `${namespace}:`;
    return this.values().filter((e) => e.id.startsWith(prefix));
  }

  origin(id: string): EntryOrigin | undefined {
    return this.origins.get(id as NamespacedId);
  }

  [Symbol.iterator](): IterableIterator<Entry<T>> {
    return this.entries.values();
  }
}
