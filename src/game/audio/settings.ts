/**
 * Volume settings (C24). Kept in `localStorage`, separate from save slots: they belong to the
 * player's device, not to a playthrough. The settings screen (C33) will reuse this.
 */

import { z } from 'zod';
import type { VolumeChannel } from '@engine/audio';

export interface AudioSettings {
  readonly master: number;
  readonly music: number;
  readonly sfx: number;
}

export const AUDIO_CHANNELS = [
  'master',
  'music',
  'sfx',
] as const satisfies readonly (keyof AudioSettings & VolumeChannel)[];
export type AudioChannel = (typeof AUDIO_CHANNELS)[number];

export const DEFAULT_AUDIO: AudioSettings = { master: 0.8, music: 0.7, sfx: 0.8 };
/** Volume steps: 0 %, 10 %, … 100 %. */
export const VOLUME_STEP = 0.1;
export const SETTINGS_KEY = 'zoravia:audio';

const level = z.number().min(0).max(1);
const schema = z.object({
  master: level.default(DEFAULT_AUDIO.master),
  music: level.default(DEFAULT_AUDIO.music),
  sfx: level.default(DEFAULT_AUDIO.sfx),
});

/** Rounds to the nearest step and clamps to 0–1. */
export function stepVolume(v: number, steps = 0): number {
  const n = Math.round(v / VOLUME_STEP) + steps;
  return Math.min(10, Math.max(0, n)) / 10;
}

export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Reads the settings; anything missing or broken falls back to the default. */
export function loadAudioSettings(storage: SettingsStorage | undefined): AudioSettings {
  try {
    const raw = storage?.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_AUDIO;
    const parsed = schema.safeParse(JSON.parse(raw));
    if (!parsed.success) return DEFAULT_AUDIO;
    return parsed.data;
  } catch {
    return DEFAULT_AUDIO;
  }
}

export function saveAudioSettings(storage: SettingsStorage | undefined, s: AudioSettings): void {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // Storage full or blocked: the settings just won't persist.
  }
}

export function formatVolume(v: number): string {
  return v <= 0 ? 'Off' : `${Math.round(v * 100)}%`;
}
