/**
 * The game's sound service (C24). `main.ts` installs an `AudioEngine`; scenes call `playSfx`
 * and `playCry`. Before that (tests, the lab without audio) every call is a no-op, so scenes
 * don't need the engine passed through their options.
 */

import {
  AmbiencePlayer,
  MusicPlayer,
  scaleSpec,
  specDuration,
  type Ambience,
  type AudioEngine,
  type MusicPlayOptions,
  type PlayOptions,
  type Song,
  type SoundSpec,
} from '@engine/audio';
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
let music: MusicPlayer | undefined;
let ambience: AmbiencePlayer | undefined;
let storage: SettingsStorage | undefined;
let settings: AudioSettings = DEFAULT_AUDIO;
/** Silenced without touching the volume settings (C33: the tab is hidden). */
let muted = false;

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
  music?.dispose();
  ambience?.dispose();
  audio = engine;
  music = new MusicPlayer(engine);
  ambience = new AmbiencePlayer(engine);
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

/** Silences all sound (or brings it back) without changing the volume settings. */
export function setMuted(on: boolean): void {
  muted = on;
  audio?.setVolume('master', muted ? 0 : settings.master);
}

function applySettings(s: AudioSettings): void {
  settings = s;
  audio?.setVolume('master', muted ? 0 : s.master);
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

// ─── Music and ambience (C25) ───────────────────────────────────────────────────────────

/** Plays a song on the music bus, crossfading from the one playing. */
export function playMusic(song: Song, opts: MusicPlayOptions = {}): void {
  music?.play(song, opts);
}

export function stopMusic(fade = 1): void {
  music?.stop(fade);
}

/** Id of the song playing (or waiting for the first key press). */
export function currentMusic(): string | undefined {
  return music?.current;
}

/** Scales the music, e.g. under a jingle. 1 = normal. */
export function setMusicLevel(level: number, seconds = 0.5): void {
  music?.setLevel(level, seconds);
}

let duckUntil = 0;
let duckTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Plays a jingle (center heal, evolution, quest fanfare) with the music ducked under it,
 * coming back up once it ends (C32). Overlapping jingles keep it ducked until the last ends.
 */
export function playJingle(id: SfxId, level = 0.25): void {
  playSfx(id);
  if (!music) return;
  const ms = specDuration(SFX[id]) * 1000 + 150;
  const now = Date.now();
  duckUntil = Math.max(duckUntil, now + ms);
  setMusicLevel(level, 0.15);
  if (duckTimer !== undefined) clearTimeout(duckTimer);
  duckTimer = setTimeout(() => {
    duckTimer = undefined;
    setMusicLevel(1, 0.8);
  }, duckUntil - now);
}

export function playAmbience(a: Ambience, opts: { readonly fade?: number } = {}): void {
  ambience?.play(a, opts);
}

export function stopAmbience(fade = 2): void {
  ambience?.stop(fade);
}

export function currentAmbience(): string | undefined {
  return ambience?.current;
}

/** Scales the ambience (quieter in battle). 1 = normal. */
export function setAmbienceLevel(level: number, seconds = 1): void {
  ambience?.setLevel(level, seconds);
}

/** Stops music and ambience (back to a menu). */
export function stopAllMusic(fade = 1): void {
  stopMusic(fade);
  stopAmbience(fade);
}
