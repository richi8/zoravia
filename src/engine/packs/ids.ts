/**
 * Namespaced content IDs: `<namespace>:<local>`, e.g. `core:emberfox`.
 * The namespace is always the id of the pack that first added the entry.
 */

import { z } from 'zod';

const SEGMENT = '[a-z0-9][a-z0-9_-]*';
export const NAMESPACE_PATTERN = new RegExp(`^${SEGMENT}$`);
export const LOCAL_ID_PATTERN = NAMESPACE_PATTERN;
export const NAMESPACED_ID_PATTERN = new RegExp(`^${SEGMENT}:${SEGMENT}$`);

/** Branded string so a raw string cannot be passed where a full id is expected by accident. */
export type NamespacedId = string & { readonly __brand: 'NamespacedId' };

export function isNamespacedId(value: string): value is NamespacedId {
  return NAMESPACED_ID_PATTERN.test(value);
}

export function makeId(namespace: string, local: string): NamespacedId {
  const id = `${namespace}:${local}`;
  if (!isNamespacedId(id)) {
    throw new Error(
      `Invalid id "${id}": use lowercase letters, digits, "_" or "-" (e.g. "core:emberfox")`,
    );
  }
  return id;
}

export function parseId(id: string): { namespace: string; local: string } {
  if (!isNamespacedId(id)) {
    throw new Error(`Invalid id "${id}": expected "<namespace>:<name>", e.g. "core:emberfox"`);
  }
  const i = id.indexOf(':');
  return { namespace: id.slice(0, i), local: id.slice(i + 1) };
}

/**
 * Resolves a reference written inside a pack: a full id stays as-is, a bare name
 * resolves to the pack's own namespace (`"tackle"` in pack `core` → `core:tackle`).
 */
export function resolveId(ref: string, ownNamespace: string): NamespacedId {
  if (!ref.includes(':')) return makeId(ownNamespace, ref);
  parseId(ref); // validates
  return ref as NamespacedId;
}

/** Zod schema for a full namespaced id (for references between content entries). */
export const namespacedIdSchema = z
  .string()
  .regex(NAMESPACED_ID_PATTERN, 'Expected a namespaced id like "core:emberfox"')
  .transform((s) => s as NamespacedId);
