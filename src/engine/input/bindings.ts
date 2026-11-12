/**
 * Key bindings data model (no UI). Game code declares its actions, contexts and default
 * bindings; players' changes are stored as a small profile of overrides.
 *
 * Keys are `KeyboardEvent.code` values (`KeyW`, `ArrowUp`, `Enter`, …) — physical keys, so
 * WASD keeps its shape on any layout — plus `Mouse0`…`Mouse4` for mouse buttons.
 *
 * A **conflict** is one key bound to two different actions that can be active at the same
 * time (they share a context, or one of them is global). The same key on actions that never
 * share a context is fine: that is how `W` means "move" in the overworld and "navigate" in menus.
 */

import { z } from 'zod';

export type KeyCode = string;
export type BindingTable<A extends string> = Readonly<Record<A, readonly KeyCode[]>>;

export interface InputContextDef<A extends string> {
  readonly id: string;
  readonly actions: readonly A[];
}

export interface BindingsConfig<A extends string> {
  readonly defaults: BindingTable<A>;
  readonly contexts: readonly InputContextDef<A>[];
  /** Actions active in every context (e.g. a debug toggle). */
  readonly global?: readonly A[];
}

export interface Conflict<A extends string> {
  readonly key: KeyCode;
  readonly actions: readonly [A, A];
  /** Context where both are active (`"global"` if one of them is global). */
  readonly context: string;
}

export type ConflictPolicy = 'reject' | 'steal' | 'swap';

export interface RebindResult<A extends string> {
  readonly ok: boolean;
  /** Conflicts that blocked (`reject`) or were resolved (`steal`/`swap`). */
  readonly conflicts: readonly Conflict<A>[];
}

export const BINDING_PROFILE_VERSION = 1;

const profileSchema = z.object({
  version: z.literal(BINDING_PROFILE_VERSION),
  overrides: z.record(z.string(), z.array(z.string())),
});

/** Serializable player bindings: only actions that differ from the defaults. */
export type BindingProfile = z.infer<typeof profileSchema>;

export class Bindings<A extends string> {
  private table: Map<A, KeyCode[]>;
  private readonly defaults: BindingTable<A>;
  private readonly contexts: readonly InputContextDef<A>[];
  private readonly global: ReadonlySet<A>;
  private readonly listeners = new Set<() => void>();
  private keyIndex: Map<KeyCode, A[]> | undefined;

  constructor(config: BindingsConfig<A>) {
    this.defaults = config.defaults;
    this.contexts = config.contexts;
    this.global = new Set(config.global ?? []);
    this.table = this.copyDefaults();
  }

  get actions(): A[] {
    return Object.keys(this.defaults) as A[];
  }

  keysFor(action: A): readonly KeyCode[] {
    return this.table.get(action) ?? [];
  }

  /** All actions bound to `key` (in any context). */
  actionsForKey(key: KeyCode): readonly A[] {
    if (!this.keyIndex) {
      this.keyIndex = new Map();
      for (const [action, keys] of this.table) {
        for (const k of keys) {
          const list = this.keyIndex.get(k) ?? [];
          list.push(action);
          this.keyIndex.set(k, list);
        }
      }
    }
    return this.keyIndex.get(key) ?? [];
  }

  /** Whether two actions can be active at the same time. Returns the shared context id. */
  sharedContext(a: A, b: A): string | undefined {
    if (a === b) return undefined;
    if (this.global.has(a) || this.global.has(b)) return 'global';
    return this.contexts.find((c) => c.actions.includes(a) && c.actions.includes(b))?.id;
  }

  /** Every conflict in the current bindings. */
  conflicts(): Conflict<A>[] {
    const out: Conflict<A>[] = [];
    const actions = this.actions;
    for (let i = 0; i < actions.length; i++) {
      for (let j = i + 1; j < actions.length; j++) {
        const a = actions[i] as A;
        const b = actions[j] as A;
        const context = this.sharedContext(a, b);
        if (!context) continue;
        for (const key of this.keysFor(a)) {
          if (this.keysFor(b).includes(key)) out.push({ key, actions: [a, b], context });
        }
      }
    }
    return out;
  }

  /**
   * Binds `key` to `action` at `slot` (index in its key list; `slot >= length` appends).
   * `key = null` removes that slot. On conflict:
   * - `reject` (default): nothing changes, `ok: false`.
   * - `steal`: the key is removed from the conflicting actions.
   * - `swap`: conflicting actions get the key this slot had before (or just lose it).
   */
  rebind(
    action: A,
    slot: number,
    key: KeyCode | null,
    policy: ConflictPolicy = 'reject',
  ): RebindResult<A> {
    const keys = [...this.keysFor(action)];
    const previous = keys[slot];
    if (key === null) {
      if (slot < keys.length) keys.splice(slot, 1);
      this.write(action, keys);
      return { ok: true, conflicts: [] };
    }

    const conflicts: Conflict<A>[] = [];
    for (const other of this.actions) {
      const context = this.sharedContext(action, other);
      if (context && this.keysFor(other).includes(key)) {
        conflicts.push({ key, actions: [action, other], context });
      }
    }
    if (conflicts.length && policy === 'reject') return { ok: false, conflicts };

    for (const c of conflicts) {
      const other = c.actions[1];
      const otherKeys = this.keysFor(other).map((k) =>
        k === key && policy === 'swap' && previous !== undefined ? previous : k,
      );
      this.write(
        other,
        otherKeys.filter((k, i) => k !== key && otherKeys.indexOf(k) === i),
        false,
      );
    }

    const without = keys.filter((k, i) => k !== key || i === slot);
    if (slot < without.length) without[slot] = key;
    else without.push(key);
    this.write(action, without);
    return { ok: true, conflicts };
  }

  /** Restores one action, or every action, to its defaults. */
  reset(action?: A): void {
    if (action === undefined) {
      this.table = this.copyDefaults();
      this.changed();
    } else {
      this.write(action, [...this.defaults[action]]);
    }
  }

  toProfile(): BindingProfile {
    const overrides: Record<string, string[]> = {};
    for (const action of this.actions) {
      const current = this.keysFor(action);
      const def = this.defaults[action];
      if (current.length !== def.length || current.some((k, i) => k !== def[i])) {
        overrides[action] = [...current];
      }
    }
    return { version: BINDING_PROFILE_VERSION, overrides };
  }

  /**
   * Applies a stored profile on top of the defaults. Invalid data is rejected as a whole;
   * unknown actions (e.g. removed in an update) are skipped and reported.
   */
  loadProfile(data: unknown): { ok: boolean; skipped: string[]; error?: string } {
    const parsed = profileSchema.safeParse(data);
    if (!parsed.success) return { ok: false, skipped: [], error: parsed.error.message };
    const table = this.copyDefaults();
    const skipped: string[] = [];
    for (const [action, keys] of Object.entries(parsed.data.overrides)) {
      if (action in this.defaults) table.set(action as A, [...new Set(keys)]);
      else skipped.push(action);
    }
    this.table = table;
    this.changed();
    return { ok: true, skipped };
  }

  /** Called after any change. Returns an unsubscribe function. */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private write(action: A, keys: KeyCode[], notify = true): void {
    this.table.set(action, keys);
    if (notify) this.changed();
    else this.keyIndex = undefined;
  }

  private changed(): void {
    this.keyIndex = undefined;
    for (const l of this.listeners) l();
  }

  private copyDefaults(): Map<A, KeyCode[]> {
    return new Map(
      (Object.entries(this.defaults) as [A, readonly KeyCode[]][]).map(([a, k]) => [a, [...k]]),
    );
  }
}
