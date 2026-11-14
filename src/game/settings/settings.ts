/**
 * Game settings (C33): battle speed, text speed, the `1 2 3` switch prompt and comfort
 * options. Like the volumes (C24) they belong to the device, not to a save slot, and are kept
 * in `localStorage`. Key bindings are kept beside them (`KEYS_KEY`, the C05 binding profile).
 *
 * Scenes read the live values through `gameSettings()` whenever they need them (a battle
 * reads the speed when it starts), so a change in the pause menu applies at once.
 */

import { z } from 'zod';
import type { Bindings } from '@engine/input';
import type { SettingsStorage } from '@game/audio';

export const BATTLE_SPEEDS = [1, 1.5, 2] as const;
export type BattleSpeed = (typeof BATTLE_SPEEDS)[number];

export const TEXT_SPEEDS = ['slow', 'normal', 'fast'] as const;
export type TextSpeed = (typeof TEXT_SPEEDS)[number];

/** Dialogue letters per second for each text speed ("normal" is the C07 token value). */
export const TEXT_CHARS_PER_SECOND: Readonly<Record<TextSpeed, number>> = {
  slow: 24,
  normal: 40,
  fast: 75,
};

export interface GameSettings {
  readonly battleSpeed: BattleSpeed;
  readonly textSpeed: TextSpeed;
  /** Ask before switching with `1 2 3` in battle. */
  readonly confirmSwitch: boolean;
  /** Screen shake in battles and the overworld bump nudge. */
  readonly shake: boolean;
  /** Full-screen white flashes (battle transition, evolution). */
  readonly flashes: boolean;
  /** Silence all sound while the tab is hidden. */
  readonly muteHidden: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  battleSpeed: 1,
  textSpeed: 'normal',
  confirmSwitch: false,
  shake: true,
  flashes: true,
  muteHidden: true,
};

export const SETTINGS_KEY = 'zoravia:settings';
export const KEYS_KEY = 'zoravia:keys';

const schema = z.object({
  battleSpeed: z
    .number()
    .refine((n): n is BattleSpeed => (BATTLE_SPEEDS as readonly number[]).includes(n))
    .catch(DEFAULT_SETTINGS.battleSpeed),
  textSpeed: z.enum(TEXT_SPEEDS).catch(DEFAULT_SETTINGS.textSpeed),
  confirmSwitch: z.boolean().catch(DEFAULT_SETTINGS.confirmSwitch),
  shake: z.boolean().catch(DEFAULT_SETTINGS.shake),
  flashes: z.boolean().catch(DEFAULT_SETTINGS.flashes),
  muteHidden: z.boolean().catch(DEFAULT_SETTINGS.muteHidden),
});

/** Reads the settings; a missing or broken value falls back to its default. */
export function loadSettings(storage: SettingsStorage | undefined): GameSettings {
  try {
    const raw = storage?.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return DEFAULT_SETTINGS;
    return schema.parse({ ...DEFAULT_SETTINGS, ...data }) as GameSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function store(storage: SettingsStorage | undefined, key: string, value: unknown): void {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the settings just won't persist.
  }
}

// ------------------------------------------------------------------ live settings

let current: GameSettings = DEFAULT_SETTINGS;
let storage: SettingsStorage | undefined;
const listeners = new Set<(s: GameSettings) => void>();

/** Loads the stored settings and keeps them in `storage` from now on. */
export function installSettings(target: SettingsStorage | undefined): GameSettings {
  storage = target;
  current = loadSettings(target);
  for (const l of listeners) l(current);
  return current;
}

export function gameSettings(): GameSettings {
  return current;
}

/** Changes some settings, stores them and tells the listeners. */
export function updateSettings(patch: Partial<GameSettings>): GameSettings {
  current = { ...current, ...patch };
  store(storage, SETTINGS_KEY, current);
  for (const l of listeners) l(current);
  return current;
}

/** Called after every change. Returns an unsubscribe function. */
export function onSettingsChange(listener: (s: GameSettings) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Dialogue letters per second for the current text speed. */
export function textCharsPerSecond(s: GameSettings = current): number {
  return TEXT_CHARS_PER_SECOND[s.textSpeed];
}

/** The next value in a list of choices (wrapping), or the one before with `step = -1`. */
export function cycle<T>(values: readonly T[], now: T, step = 1): T {
  const i = values.indexOf(now);
  const n = values.length;
  return values[((((i < 0 ? 0 : i) + step) % n) + n) % n] as T;
}

// ------------------------------------------------------------------ key bindings

/**
 * Loads the stored key bindings into `bindings` and stores every later change. A broken or
 * outdated profile is ignored (the defaults stay).
 */
export function persistBindings<A extends string>(
  bindings: Bindings<A>,
  target: SettingsStorage | undefined,
): () => void {
  try {
    const raw = target?.getItem(KEYS_KEY);
    if (raw) bindings.loadProfile(JSON.parse(raw));
  } catch {
    // Unreadable profile: keep the defaults.
  }
  return bindings.onChange(() => store(target, KEYS_KEY, bindings.toProfile()));
}
