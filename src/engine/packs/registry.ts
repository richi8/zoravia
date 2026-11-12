/**
 * Registries hold validated content of one kind (e.g. `species`, `moves`).
 * The engine defines no registry kinds itself; game code declares them with
 * `defineRegistry` and hands them to the `PackLoader`.
 */

import type { z } from 'zod';
import type { NamespacedId } from './ids';

/** Declares a kind of content and the schema each entry must satisfy. */
export interface RegistryDefinition<S extends z.ZodType = z.ZodType> {
  /** Key used under `content` in a pack, e.g. `"species"`. */
  readonly kind: string;
  readonly schema: S;
}

export function defineRegistry<S extends z.ZodType>(
  kind: string,
  schema: S,
): RegistryDefinition<S> {
  return { kind, schema };
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
