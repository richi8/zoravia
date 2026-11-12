/**
 * Pack definition format.
 *
 * ```ts
 * export default definePack({
 *   manifest: { id: 'lava', version: '1.0.0', dependsOn: ['core@^1.0.0'] },
 *   content: { species: { blazer: { ... } } },          // adds lava:blazer
 *   overrides: { species: { 'core:emberfox': { ... } } }, // replaces a whole entry
 *   patches: { items: { 'core:potion': { price: 50 } } }, // shallow-merges fields
 *   setup: ({ hooks }) => hooks.add('battle:damage', (d) => d),
 * });
 * ```
 *
 * Rules:
 * - `content` entries are added under the pack's own namespace; ids must be new.
 * - `overrides` / `patches` target existing entries from packs this pack depends on
 *   (directly or transitively). Patched results are re-validated against the schema.
 * - Packs load in dependency order; ties keep the order they were given in.
 */

import { z } from 'zod';
import type { HookHandler, HookMap, HookOptions } from './hooks';
import { NAMESPACE_PATTERN } from './ids';
import { RANGE_PATTERN, VERSION_PATTERN } from './version';

/** `"core"` or `"core@^1.0.0"`. */
const DEPENDENCY_PATTERN = new RegExp(
  `^${NAMESPACE_PATTERN.source.slice(1, -1)}(@${RANGE_PATTERN.source.slice(1, -1)})?$`,
);

export const manifestSchema = z.strictObject({
  id: z.string().regex(NAMESPACE_PATTERN, 'Pack id must be lowercase letters, digits, "_" or "-"'),
  version: z.string().regex(VERSION_PATTERN, 'Version must look like "1.0.0"'),
  name: z.string().optional(),
  description: z.string().optional(),
  dependsOn: z
    .array(
      z.string().regex(DEPENDENCY_PATTERN, 'Dependency must look like "core" or "core@^1.0.0"'),
    )
    .default([]),
});

export type PackManifestInput = z.input<typeof manifestSchema>;
export type PackManifest = z.output<typeof manifestSchema>;

/** kind → id → raw entry data. Validated per registry at load time. */
export type PackContent = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

export interface PackSetupApi<H extends HookMap> {
  readonly packId: string;
  readonly hooks: {
    add<K extends keyof H>(name: K, handler: HookHandler<H[K]>, options?: HookOptions): void;
  };
}

export interface PackDefinition<H extends HookMap = HookMap> {
  readonly manifest: PackManifestInput;
  readonly content?: PackContent;
  readonly overrides?: PackContent;
  readonly patches?: PackContent;
  readonly setup?: (api: PackSetupApi<H>) => void;
}

/** Identity helper that gives pack files type checking. */
export function definePack<H extends HookMap = HookMap>(
  pack: PackDefinition<H>,
): PackDefinition<H> {
  return pack;
}

const contentSchema = z.record(z.string(), z.record(z.string(), z.unknown()));

/** Shape check of a pack definition (entries themselves are checked by registries). */
export const packShapeSchema = z.strictObject({
  manifest: manifestSchema,
  content: contentSchema.optional(),
  overrides: contentSchema.optional(),
  patches: contentSchema.optional(),
  setup: z
    .custom<(...args: never[]) => unknown>(
      (v) => typeof v === 'function',
      'setup must be a function',
    )
    .optional(),
});

export function parseDependency(dep: string): { id: string; range: string } {
  const at = dep.indexOf('@');
  return at < 0 ? { id: dep, range: '*' } : { id: dep.slice(0, at), range: dep.slice(at + 1) };
}
