/**
 * The game's sound service (C24). `main.ts` installs an `AudioEngine`; scenes call `playSfx`
 * and `playCry`. Before that (tests, the lab without audio) every call is a no-op, so scenes
 * don't need the engine passed through their options.
 */

import { scaleSpec, type AudioEngine, type PlayOptions, type SoundSpec } from '@engine/audio';
import { setUiSoundSink, type UiSound } from '@engine/ui';
import {
  DEFAULT_AUDIO,
  saveAudioSettings,
  type AudioChannel,
  type AudioSettings,
  type SettingsStorage,
} from './settings';
import { SFX, type SfxId } from './sfx';

export interface SoundOptions extends PlayOptions {
  /** Pitch multiplier. Default 1. */
  readonly pitch?: number;
  /** Time multiplier. Default 1. */
  readonly stretch?: number;
}

let audio: AudioEngine | undefined;
let storage: SettingsStorage | undefined;
let settings: AudioSettings = DEFAULT_AUDIO;

/** UI sounds repeat fast (held keys); a short throttle keeps them from stacking. */
const UI_THROTTLE: Record<UiSound, number> = {
  move: 0.04,
  select: 0.05,
  back: 0.05,
  blocked: 0.12,
  open: 0.08,
  advance: 0.05,
};

export function installAudio(
  engine: AudioEngine,
  opts: { readonly settings?: AudioSettings; readonly storage?: SettingsStorage } = {},
): void {
  audio = engine;
  storage = opts.storage;
  applySettings(opts.settings ?? DEFAULT_AUDIO);
  setUiSoundSink((s) => playSfx(`ui.${s}`, { key: `ui.${s}`, throttle: UI_THROTTLE[s] }));
}

export function audioEngine(): AudioEngine | undefined {
  return audio;
}

export function audioSettings(): AudioSettings {
  return settings;
}

/** Changes one volume, applies it and stores the settings. */
export function setVolume(channel: AudioChannel, value: number): void {
  applySettings({ ...settings, [channel]: value });
  saveAudioSettings(storage, settings);
}

function applySettings(s: AudioSettings): void {
  settings = s;
  audio?.setVolume('master', s.master);
  audio?.setVolume('sfx', s.sfx);
  audio?.setVolume('music', s.music);
  audio?.setVolume('ambience', s.music);
}

export function playSfx(id: SfxId, opts: SoundOptions = {}): void {
  playSpec(SFX[id], opts);
}

export function playSpec(spec: SoundSpec, opts: SoundOptions = {}): void {
  if (!audio) return;
  const scaled =
    opts.pitch !== undefined || opts.stretch !== undefined
      ? scaleSpec(spec, {
          ...(opts.pitch !== undefined ? { pitch: opts.pitch } : {}),
          ...(opts.stretch !== undefined ? { stretch: opts.stretch } : {}),
        })
      : spec;
  audio.play(scaled, opts);
}
