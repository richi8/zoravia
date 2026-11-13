/**
 * Save slots (C23). Each slot is one playthrough. Writing a slot keeps the previous write as
 * a backup in the same transaction; loading falls back to the backup when the main copy
 * cannot be read. The storage itself is a small key-value interface: IndexedDB in the game
 * (`idb.ts`), memory in tests.
 */

import type { GameContent } from '@game/data';
import { displayName } from '@game/progression';
import { readSave, toSave, type GameState } from './codec';
import { SaveError } from './migrate';

export const SLOT_COUNT = 3;

export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  /** Writes every entry at once (all or nothing). */
  setMany(entries: readonly (readonly [string, unknown])[]): Promise<void>;
  delete(keys: readonly string[]): Promise<void>;
}

/** In-memory store (tests, and the fallback when IndexedDB is not available). */
export class MemoryStore implements KeyValueStore {
  readonly data = new Map<string, unknown>();

  get(key: string): Promise<unknown> {
    const v = this.data.get(key);
    return Promise.resolve(v === undefined ? undefined : structuredClone(v));
  }

  setMany(entries: readonly (readonly [string, unknown])[]): Promise<void> {
    for (const [k, v] of entries) this.data.set(k, structuredClone(v));
    return Promise.resolve();
  }

  delete(keys: readonly string[]): Promise<void> {
    for (const k of keys) this.data.delete(k);
    return Promise.resolve();
  }
}

/** What the slot list shows. */
export interface SlotSummary {
  readonly lead: string;
  readonly level: number;
  readonly team: number;
  readonly caught: number;
  readonly place: string;
  readonly playtime: number;
  readonly savedAt: string;
}

export type SlotInfo =
  | { readonly slot: number; readonly state: 'empty' }
  | {
      readonly slot: number;
      readonly state: 'ok';
      readonly summary: SlotSummary;
      readonly fromBackup: boolean;
    }
  | { readonly slot: number; readonly state: 'broken'; readonly problems: readonly string[] };

export interface Loaded {
  readonly state: GameState;
  readonly savedAt: string;
  /** The main copy was unreadable and the backup was used. */
  readonly fromBackup: boolean;
}

export class SaveSlots {
  constructor(
    private readonly store: KeyValueStore,
    private readonly content: GameContent,
  ) {}

  static key(slot: number): string {
    checkSlot(slot);
    return `slot-${slot}`;
  }

  static backupKey(slot: number): string {
    return `${SaveSlots.key(slot)}.prev`;
  }

  /** Loads a slot, or `undefined` when it is empty. Throws `SaveError` if nothing is readable. */
  async load(slot: number): Promise<Loaded | undefined> {
    const main = await this.store.get(SaveSlots.key(slot));
    const backup = await this.store.get(SaveSlots.backupKey(slot));
    if (main === undefined && backup === undefined) return undefined;
    let error: unknown;
    for (const [raw, fromBackup] of [
      [main, false],
      [backup, true],
    ] as const) {
      if (raw === undefined) continue;
      try {
        const state = readSave(this.content, raw);
        return { state, savedAt: savedAtOf(raw), fromBackup };
      } catch (e) {
        error ??= e;
      }
    }
    throw error instanceof SaveError ? error : new SaveError([String(error)]);
  }

  /** Writes a slot; the old copy becomes the backup. */
  async write(slot: number, state: GameState, now = new Date()): Promise<void> {
    const data = toSave(this.content, state, now);
    const old = await this.store.get(SaveSlots.key(slot));
    const entries: [string, unknown][] = [[SaveSlots.key(slot), data]];
    if (old !== undefined) entries.push([SaveSlots.backupKey(slot), old]);
    await this.store.setMany(entries);
  }

  async remove(slot: number): Promise<void> {
    await this.store.delete([SaveSlots.key(slot), SaveSlots.backupKey(slot)]);
  }

  async info(slot: number): Promise<SlotInfo> {
    try {
      const loaded = await this.load(slot);
      if (!loaded) return { slot, state: 'empty' };
      return {
        slot,
        state: 'ok',
        summary: this.summary(loaded),
        fromBackup: loaded.fromBackup,
      };
    } catch (e) {
      const problems = e instanceof SaveError ? e.problems : [String(e)];
      return { slot, state: 'broken', problems };
    }
  }

  async list(): Promise<SlotInfo[]> {
    const out: SlotInfo[] = [];
    for (let s = 1; s <= SLOT_COUNT; s++) out.push(await this.info(s));
    return out;
  }

  private summary(loaded: Loaded): SlotSummary {
    const { content } = this;
    const { party, place, playtime } = loaded.state;
    const lead = party.team[0];
    return {
      lead: lead ? displayName(content, lead) : '—',
      level: lead?.level ?? 0,
      team: party.team.length,
      caught: party.dex.caught.length,
      place: content.maps.require(place.map).name,
      playtime,
      savedAt: loaded.savedAt,
    };
  }
}

/**
 * Serializes writes: one at a time, and while one runs only the newest waiting state is
 * written next (older ones are skipped). `save` resolves when that state (or a newer one)
 * is on disk.
 */
export class SaveQueue {
  private running: Promise<void> | undefined;
  private next: GameState | undefined;
  private waiters: { resolve(): void; reject(e: unknown): void }[] = [];

  constructor(private readonly write: (state: GameState) => Promise<void>) {}

  save(state: GameState): Promise<void> {
    this.next = state;
    const done = new Promise<void>((resolve, reject) => this.waiters.push({ resolve, reject }));
    this.running ??= this.drain();
    return done;
  }

  /** Resolves when nothing is waiting or being written. */
  async idle(): Promise<void> {
    while (this.running) await this.running;
  }

  private async drain(): Promise<void> {
    while (this.next) {
      const state = this.next;
      const waiters = this.waiters;
      this.next = undefined;
      this.waiters = [];
      try {
        await this.write(state);
        for (const w of waiters) w.resolve();
      } catch (e) {
        for (const w of waiters) w.reject(e);
      }
    }
    this.running = undefined;
  }
}

/** "1:05" (hours and minutes) from seconds. */
export function formatPlaytime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

function savedAtOf(raw: unknown): string {
  const v = (raw as { savedAt?: unknown }).savedAt;
  return typeof v === 'string' ? v : '';
}

function checkSlot(slot: number): void {
  if (!Number.isInteger(slot) || slot < 1 || slot > SLOT_COUNT) {
    throw new Error(`Save slot must be 1–${SLOT_COUNT}, got ${slot}`);
  }
}
