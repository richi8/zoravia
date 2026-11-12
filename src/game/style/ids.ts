/**
 * Content ids → style ids. Types and conditions get their colors, labels and icons from
 * `tokens.ts`, keyed by a short id (`fire`, `wet`). Content refers to them by full id
 * (`core:fire`); the part after the namespace is matched against the style lists.
 */

import { CONDITION_IDS, TYPE_IDS, type ConditionId, type TypeId } from './tokens';

const localPart = (id: string): string => id.slice(id.indexOf(':') + 1);

/** The style type of a content type id, if it has one (`core:fire` → `fire`). */
export function typeIdOf(id: string): TypeId | undefined {
  const local = localPart(id);
  return (TYPE_IDS as readonly string[]).includes(local) ? (local as TypeId) : undefined;
}

/** The style condition of a content condition id, if it has one (`core:wet` → `wet`). */
export function conditionIdOf(id: string): ConditionId | undefined {
  const local = localPart(id);
  return (CONDITION_IDS as readonly string[]).includes(local) ? (local as ConditionId) : undefined;
}

/** Style types of a species' types; types without a style are left out (pack-added types). */
export function styleTypes(ids: readonly string[]): TypeId[] {
  return ids.flatMap((id) => {
    const t = typeIdOf(id);
    return t ? [t] : [];
  });
}
