/**
 * Loads pack definitions into registries.
 *
 * Steps:
 * 1. Validate every pack's shape and manifest; reject duplicate pack ids.
 * 2. Resolve dependencies (missing, version mismatch, cycles) and sort topologically.
 *    Ties keep the order the packs were passed in, so the result is deterministic.
 * 3. For each pack in order: add `content`, apply `overrides`, apply `patches`, run `setup`.
 *
 * All issues are collected and thrown together as one `PackError`.
 */

import { HookRegistry, type HookMap } from './hooks';
import { makeId, NAMESPACED_ID_PATTERN, type NamespacedId } from './ids';
import { formatPath, PackError, zodIssues, type PackIssue } from './errors';
import {
  packShapeSchema,
  parseDependency,
  type PackContent,
  type PackDefinition,
  type PackManifest,
} from './pack';
import {
  Registry,
  type CheckContext,
  type Entry,
  type EntryOf,
  type EntryOrigin,
  type RegistryDefinition,
} from './registry';
import { satisfies } from './version';

export interface LoadedContent<H extends HookMap = HookMap> {
  /** Manifests in load order. */
  readonly packs: readonly PackManifest[];
  readonly hooks: HookRegistry<H>;
  registry<D extends RegistryDefinition>(definition: D): Registry<EntryOf<D>>;
}

interface ParsedPack<H extends HookMap> {
  readonly manifest: PackManifest;
  readonly def: PackDefinition<H>;
  readonly index: number;
}

interface StoreOrigin {
  readonly addedBy: string;
  readonly modifiedBy: string[];
  /** Pack and path where the entry was last set (for cross-entry check messages). */
  last: { pack: string; path: readonly string[] };
}

interface Store {
  readonly def: RegistryDefinition;
  readonly entries: Map<NamespacedId, Entry<unknown>>;
  readonly origins: Map<NamespacedId, StoreOrigin>;
}

export class PackLoader<H extends HookMap = HookMap> {
  private readonly definitions: ReadonlyMap<string, RegistryDefinition>;

  constructor(registries: readonly RegistryDefinition[]) {
    const map = new Map<string, RegistryDefinition>();
    for (const r of registries) {
      if (map.has(r.kind)) throw new Error(`Registry kind "${r.kind}" is defined twice`);
      map.set(r.kind, r);
    }
    this.definitions = map;
  }

  load(packs: readonly PackDefinition<H>[]): LoadedContent<H> {
    const issues: PackIssue[] = [];
    const parsed = this.parseAll(packs, issues);
    if (issues.length) throw new PackError(issues);

    const ordered = orderPacks(parsed, issues);
    if (issues.length) throw new PackError(issues);

    const stores = new Map<string, Store>();
    for (const [kind, def] of this.definitions) {
      stores.set(kind, { def, entries: new Map(), origins: new Map() });
    }
    const hooks = new HookRegistry<H>();
    const deps = transitiveDeps(ordered);

    for (const pack of ordered) {
      const id = pack.manifest.id;
      const reachable = deps.get(id) ?? new Set<string>();
      this.addContent(pack, stores, issues);
      this.modify(pack, 'overrides', stores, reachable, issues);
      this.modify(pack, 'patches', stores, reachable, issues);
      if (pack.def.setup) {
        try {
          pack.def.setup({
            packId: id,
            hooks: { add: (name, handler, options) => hooks.add(id, name, handler, options) },
          });
        } catch (err) {
          issues.push({ pack: id, path: 'setup', message: `threw: ${errorMessage(err)}` });
        }
      }
    }
    if (issues.length) throw new PackError(issues);

    checkEntries(stores, issues);
    if (issues.length) throw new PackError(issues);

    const registries = new Map<string, Registry<unknown>>();
    for (const [kind, store] of stores) {
      const origins = new Map<NamespacedId, EntryOrigin>();
      for (const [eid, o] of store.origins) {
        origins.set(eid, { addedBy: o.addedBy, modifiedBy: Object.freeze([...o.modifiedBy]) });
      }
      registries.set(kind, new Registry(kind, store.entries, origins));
    }

    return {
      packs: ordered.map((p) => p.manifest),
      hooks,
      registry: <D extends RegistryDefinition>(definition: D) => {
        const reg = registries.get(definition.kind);
        if (!reg || this.definitions.get(definition.kind) !== definition) {
          throw new Error(`Registry "${definition.kind}" was not passed to this PackLoader`);
        }
        return reg as Registry<EntryOf<D>>;
      },
    };
  }

  private parseAll(packs: readonly PackDefinition<H>[], issues: PackIssue[]): ParsedPack<H>[] {
    const out: ParsedPack<H>[] = [];
    const seen = new Set<string>();
    packs.forEach((def, index) => {
      const rawId = (def as { manifest?: { id?: unknown } }).manifest?.id;
      const label = typeof rawId === 'string' ? rawId : `#${index}`;
      const result = packShapeSchema.safeParse(def);
      if (!result.success) {
        issues.push(...zodIssues(label, [], result.error));
        return;
      }
      const manifest = result.data.manifest;
      if (seen.has(manifest.id)) {
        issues.push({ pack: manifest.id, path: 'manifest.id', message: 'Duplicate pack id' });
        return;
      }
      seen.add(manifest.id);
      for (const section of ['content', 'overrides', 'patches'] as const) {
        for (const kind of Object.keys(def[section] ?? {})) {
          if (!this.definitions.has(kind)) {
            const known = [...this.definitions.keys()].map((k) => `"${k}"`).join(', ');
            issues.push({
              pack: manifest.id,
              path: `${section}.${kind}`,
              message: `Unknown content kind "${kind}" (known: ${known || 'none'})`,
            });
          }
        }
      }
      out.push({ manifest, def, index });
    });
    return out;
  }

  private addContent(pack: ParsedPack<H>, stores: Map<string, Store>, issues: PackIssue[]): void {
    const ns = pack.manifest.id;
    for (const [kind, entries] of sectionEntries(pack.def.content)) {
      const store = stores.get(kind);
      if (!store) continue;
      for (const [local, raw] of Object.entries(entries)) {
        const path = ['content', kind, local];
        if (local.includes(':')) {
          issues.push({
            pack: ns,
            path: formatPath(path),
            message: `Content ids are added to the pack's own namespace; write "${local.split(':').pop()}" (to change another pack's entry use "overrides" or "patches")`,
          });
          continue;
        }
        let id: NamespacedId;
        try {
          id = makeId(ns, local);
        } catch (err) {
          issues.push({ pack: ns, path: formatPath(path), message: errorMessage(err) });
          continue;
        }
        if (store.entries.has(id)) {
          issues.push({ pack: ns, path: formatPath(path), message: `Duplicate id "${id}"` });
          continue;
        }
        const entry = validate(store, ns, path, id, raw, issues);
        if (!entry) continue;
        store.entries.set(id, entry);
        store.origins.set(id, { addedBy: ns, modifiedBy: [], last: { pack: ns, path } });
      }
    }
  }

  private modify(
    pack: ParsedPack<H>,
    section: 'overrides' | 'patches',
    stores: Map<string, Store>,
    reachable: ReadonlySet<string>,
    issues: PackIssue[],
  ): void {
    const ns = pack.manifest.id;
    for (const [kind, entries] of sectionEntries(pack.def[section])) {
      const store = stores.get(kind);
      if (!store) continue;
      for (const [target, raw] of Object.entries(entries)) {
        const path = [section, kind, target];
        const fail = (message: string): void => {
          issues.push({ pack: ns, path: formatPath(path), message });
        };
        if (!NAMESPACED_ID_PATTERN.test(target)) {
          fail(`Target must be a full id like "core:emberfox", got "${target}"`);
          continue;
        }
        const id = target as NamespacedId;
        const targetNs = id.slice(0, id.indexOf(':'));
        if (targetNs !== ns && !reachable.has(targetNs)) {
          fail(`Pack "${ns}" must depend on "${targetNs}" to change "${id}"`);
          continue;
        }
        const existing = store.entries.get(id);
        if (!existing) {
          fail(`Cannot ${section === 'overrides' ? 'override' : 'patch'} unknown ${kind} "${id}"`);
          continue;
        }
        let data: unknown = raw;
        if (section === 'patches') {
          if (!isPlainObject(raw) || !isPlainObject(existing)) {
            fail('A patch must be an object of fields to change');
            continue;
          }
          const { id: _ignored, ...base } = existing as Record<string, unknown>;
          data = { ...base, ...raw };
        }
        const entry = validate(store, ns, path, id, data, issues);
        if (!entry) continue;
        store.entries.set(id, entry);
        const origin = store.origins.get(id);
        if (origin) {
          origin.modifiedBy.push(ns);
          origin.last = { pack: ns, path };
        }
      }
    }
  }
}

/** Runs every registry's `refs` and `check` over the fully loaded content. */
function checkEntries(stores: ReadonlyMap<string, Store>, issues: PackIssue[]): void {
  const ctx: CheckContext = {
    get: (kind, id) => stores.get(kind)?.entries.get(id as NamespacedId),
    values: (kind) => [...(stores.get(kind)?.entries.values() ?? [])],
  };
  for (const store of stores.values()) {
    const { refs, check } = store.def.options;
    if (!refs && !check) continue;
    for (const [id, entry] of store.entries) {
      const last = store.origins.get(id)?.last ?? { pack: id.split(':')[0] ?? '', path: [] };
      const report = (path: readonly PropertyKey[], message: string): void => {
        issues.push({ pack: last.pack, path: formatPath([...last.path, ...path]), message });
      };
      try {
        for (const ref of refs?.(entry) ?? []) {
          const target = stores.get(ref.kind);
          if (!target) {
            report(ref.path, `Refers to unknown content kind "${ref.kind}"`);
          } else if (!target.entries.has(ref.id as NamespacedId)) {
            const local = ref.id.split(':').pop();
            const near = [...target.entries.keys()].filter((k) => k.endsWith(`:${local}`));
            const hint = near.length
              ? ` Did you mean ${near.map((k) => `"${k}"`).join(', ')}?`
              : '';
            report(ref.path, `Unknown ${ref.kind} "${ref.id}".${hint}`);
          }
        }
        for (const problem of check?.(entry, ctx) ?? []) report(problem.path, problem.message);
      } catch (err) {
        report([], `Check of ${store.def.kind} "${id}" threw: ${errorMessage(err)}`);
      }
    }
  }
}

function validate(
  store: Store,
  pack: string,
  path: readonly string[],
  id: NamespacedId,
  raw: unknown,
  issues: PackIssue[],
): Entry<unknown> | undefined {
  const result = store.def.schema.safeParse(raw);
  if (!result.success) {
    issues.push(...zodIssues(pack, path, result.error));
    return undefined;
  }
  const value = result.data;
  if (!isPlainObject(value)) {
    issues.push({
      pack,
      path: formatPath(path),
      message: `Registry "${store.def.kind}" schema must produce an object`,
    });
    return undefined;
  }
  return deepFreeze({ ...value, id }) as Entry<unknown>;
}

function sectionEntries(section: PackContent | undefined): [string, Record<string, unknown>][] {
  return Object.entries(section ?? {}) as [string, Record<string, unknown>][];
}

function orderPacks<H extends HookMap>(
  packs: readonly ParsedPack<H>[],
  issues: PackIssue[],
): ParsedPack<H>[] {
  const byId = new Map(packs.map((p) => [p.manifest.id, p]));

  for (const pack of packs) {
    for (const dep of pack.manifest.dependsOn) {
      const { id, range } = parseDependency(dep);
      const target = byId.get(id);
      if (!target) {
        issues.push({
          pack: pack.manifest.id,
          path: 'manifest.dependsOn',
          message: `Pack "${id}" is not loaded`,
        });
      } else if (!satisfies(target.manifest.version, range)) {
        issues.push({
          pack: pack.manifest.id,
          path: 'manifest.dependsOn',
          message: `Needs "${id}@${range}" but version ${target.manifest.version} is loaded`,
        });
      } else if (id === pack.manifest.id) {
        issues.push({
          pack: id,
          path: 'manifest.dependsOn',
          message: 'A pack cannot depend on itself',
        });
      }
    }
  }
  if (issues.length) return [];

  // Depth-first topological sort, visiting in input order for deterministic ties.
  const ordered: ParsedPack<H>[] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (pack: ParsedPack<H>, trail: string[]): boolean => {
    const id = pack.manifest.id;
    if (state.get(id) === 'done') return true;
    if (state.get(id) === 'visiting') {
      const cycle = [...trail.slice(trail.indexOf(id)), id].join(' → ');
      issues.push({ pack: id, path: 'manifest.dependsOn', message: `Dependency cycle: ${cycle}` });
      return false;
    }
    state.set(id, 'visiting');
    for (const dep of pack.manifest.dependsOn) {
      const target = byId.get(parseDependency(dep).id);
      if (target && !visit(target, [...trail, id])) return false;
    }
    state.set(id, 'done');
    ordered.push(pack);
    return true;
  };
  for (const pack of packs) if (!visit(pack, [])) return [];
  return ordered;
}

/** pack id → every pack it depends on, directly or transitively. */
function transitiveDeps<H extends HookMap>(
  ordered: readonly ParsedPack<H>[],
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const pack of ordered) {
    const set = new Set<string>();
    for (const dep of pack.manifest.dependsOn) {
      const id = parseDependency(dep).id;
      set.add(id);
      for (const t of out.get(id) ?? []) set.add(t);
    }
    out.set(pack.manifest.id, set);
  }
  return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
