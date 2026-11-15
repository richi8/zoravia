/**
 * Plays looping `Song`s on a bus, with crossfades (C25).
 *
 * Notes are scheduled a little ahead on the audio clock by a timer (the usual Web Audio
 * look-ahead pattern), so timing does not depend on the frame rate. A hidden tab's timers
 * run about once a second, so the look-ahead grows while the page is hidden.
 *
 * Each song plays on its own "deck" (a gain node). Switching songs fades the old deck out
 * while the new one fades in. The player remembers where each song was left and resumes it
 * from the start of that bar, unless asked to restart: back from a battle, the field theme
 * carries on where it stopped.
 *
 * Asking for a song before the audio context is unlocked is fine: it starts on unlock.
 */

import { scheduleSpec, type AudioEngine, type Bus } from './audio-engine';
import { barSteps, indexSong, noteSpec, stepSeconds, type Song, type StepNote } from './song';

export interface MusicPlayOptions {
  /** Crossfade in seconds. Default 1. */
  readonly fade?: number;
  /** Start from the top instead of where the song was left. Default false. */
  readonly restart?: boolean;
}

export interface MusicPlayerOptions {
  readonly bus?: Bus;
  /** Seconds scheduled ahead while visible. Default 0.25. */
  readonly lookahead?: number;
  /** Seconds scheduled ahead while the page is hidden. Default 1.6. */
  readonly hiddenLookahead?: number;
  /** Timer period in ms. Default 40. */
  readonly interval?: number;
  /** Most music voices sounding at once; later notes are dropped. Default 40. */
  readonly maxVoices?: number;
}

interface Deck {
  readonly song: Song;
  readonly index: readonly (readonly StepNote[])[];
  readonly gain: GainNode;
  readonly stepSec: number;
  /** Audio time of step `base`. */
  readonly t0: number;
  readonly base: number;
  /** Next absolute step to schedule. */
  next: number;
  /** Audio time after which a fading deck is removed. */
  until?: number;
}

const SILENT = 0.0001;
/** A lowpass this high lets everything through. */
export const OPEN_HZ = 20_000;

export class MusicPlayer {
  private deck: Deck | undefined;
  private readonly fading: Deck[] = [];
  private wanted: { song: Song; opts: MusicPlayOptions } | undefined;
  private readonly positions = new Map<string, number>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private level: GainNode | undefined;
  private levelValue = 1;
  /** Lowpass after the level (a muffled tone while a Zorling is low on HP, C36e). */
  private filter: BiquadFilterNode | undefined;
  private filterHz = OPEN_HZ;
  private voices = 0;
  private readonly bus: Bus;
  private readonly lookahead: number;
  private readonly hiddenLookahead: number;
  private readonly interval: number;
  private readonly maxVoices: number;

  constructor(
    private readonly audio: AudioEngine,
    opts: MusicPlayerOptions = {},
  ) {
    this.bus = opts.bus ?? 'music';
    this.lookahead = opts.lookahead ?? 0.25;
    this.hiddenLookahead = opts.hiddenLookahead ?? 1.6;
    this.interval = opts.interval ?? 40;
    this.maxVoices = opts.maxVoices ?? 40;
  }

  /** Id of the song playing (or waiting for unlock). */
  get current(): string | undefined {
    return this.wanted?.song.id;
  }

  /** Plays a song. The same song again is ignored unless `restart` is set. */
  play(song: Song, opts: MusicPlayOptions = {}): void {
    if (this.wanted?.song.id === song.id && !opts.restart) return;
    if (this.deck?.song.id === song.id && opts.restart) this.retire(opts.fade ?? 1);
    this.wanted = { song, opts };
    this.start();
  }

  /** Fades the music out. */
  stop(fade = 1): void {
    this.wanted = undefined;
    this.retire(fade);
  }

  /** Scales everything this player plays (ducking under a jingle, ambience in battle). */
  setLevel(level: number, seconds = 0.5): void {
    this.levelValue = Math.max(0, level);
    const ctx = this.audio.context;
    if (this.level && ctx) {
      this.level.gain.cancelScheduledValues(ctx.currentTime);
      this.level.gain.setTargetAtTime(
        this.levelValue,
        ctx.currentTime,
        Math.max(0.01, seconds / 3),
      );
    }
  }

  /**
   * Muffles everything this player plays through a lowpass at `hz` (`OPEN_HZ` or more: no
   * muffle), gliding there over `seconds`.
   */
  setLowpass(hz: number, seconds = 0.5): void {
    this.filterHz = Math.max(40, Math.min(OPEN_HZ, hz));
    const ctx = this.audio.context;
    if (this.filter && ctx) {
      this.filter.frequency.cancelScheduledValues(ctx.currentTime);
      this.filter.frequency.setTargetAtTime(
        this.filterHz,
        ctx.currentTime,
        Math.max(0.01, seconds / 3),
      );
    }
  }

  /** Stops the timer and drops everything at once. */
  dispose(): void {
    this.wanted = undefined;
    for (const d of [...this.fading, ...(this.deck ? [this.deck] : [])]) d.gain.disconnect();
    this.fading.length = 0;
    this.deck = undefined;
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }

  private start(): void {
    if (this.timer === undefined) this.timer = setInterval(() => this.tick(), this.interval);
    this.tick();
  }

  private retire(fade: number): void {
    const d = this.deck;
    const ctx = this.audio.context;
    if (!d || !ctx) {
      this.deck = undefined;
      return;
    }
    this.deck = undefined;
    const now = ctx.currentTime;
    this.positions.set(d.song.id, positiveMod(this.stepAt(d, now), d.song.length));
    const f = Math.max(0.02, fade);
    d.gain.gain.cancelScheduledValues(now);
    d.gain.gain.setValueAtTime(Math.max(SILENT, d.gain.gain.value), now);
    d.gain.gain.linearRampToValueAtTime(SILENT, now + f);
    d.until = now + f + 0.05;
    this.fading.push(d);
  }

  private output(ctx: AudioContext): AudioNode | undefined {
    const bus = this.audio.bus(this.bus);
    if (!bus) return undefined;
    if (!this.level) {
      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = this.filterHz;
      this.filter.connect(bus);
      this.level = ctx.createGain();
      this.level.gain.value = this.levelValue;
      this.level.connect(this.filter);
    }
    return this.level;
  }

  private tick(): void {
    const ctx = this.audio.context;
    if (!ctx || ctx.state !== 'running') return;
    const out = this.output(ctx);
    if (!out) return;
    const now = ctx.currentTime;
    const want = this.wanted;
    if (want && this.deck?.song.id !== want.song.id) {
      const fade = want.opts.fade ?? 1;
      this.retire(fade);
      this.deck = this.open(ctx, out, want.song, fade, want.opts.restart ?? false);
    }
    const ahead = isHidden() ? this.hiddenLookahead : this.lookahead;
    for (const d of [...this.fading, ...(this.deck ? [this.deck] : [])]) {
      this.schedule(ctx, d, now, Math.min(now + ahead, d.until ?? Infinity));
    }
    for (let i = this.fading.length - 1; i >= 0; i--) {
      const d = this.fading[i];
      if (d && d.until !== undefined && now > d.until) {
        d.gain.disconnect();
        this.fading.splice(i, 1);
      }
    }
    if (!this.deck && !this.wanted && !this.fading.length && this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private open(
    ctx: AudioContext,
    out: AudioNode,
    song: Song,
    fade: number,
    restart: boolean,
  ): Deck {
    const gain = ctx.createGain();
    const target = song.gain ?? 1;
    const now = ctx.currentTime;
    const t0 = now + 0.06;
    if (fade > 0.02) {
      gain.gain.setValueAtTime(SILENT, now);
      gain.gain.linearRampToValueAtTime(target, t0 + fade);
    } else {
      gain.gain.value = target;
    }
    gain.connect(out);
    const bar = barSteps(song);
    const left = restart ? 0 : (this.positions.get(song.id) ?? 0);
    const base = Math.floor(left / bar) * bar;
    return { song, index: indexSong(song), gain, stepSec: stepSeconds(song), t0, base, next: base };
  }

  /** Absolute step playing at audio time `t` (may be before `base`). */
  private stepAt(d: Deck, t: number): number {
    return d.base + Math.floor((t - d.t0) / d.stepSec);
  }

  private timeOf(d: Deck, step: number): number {
    const swing = step % 2 === 1 ? (d.song.swing ?? 0) : 0;
    return d.t0 + (step - d.base + swing) * d.stepSec;
  }

  private schedule(ctx: AudioContext, d: Deck, now: number, horizon: number): void {
    // Fell behind (a throttled tab): skip what is already past instead of a burst.
    if (this.timeOf(d, d.next) < now - 0.02) d.next = Math.max(d.next, this.stepAt(d, now) + 1);
    const { song } = d;
    while (this.timeOf(d, d.next) < horizon) {
      const at = this.timeOf(d, d.next);
      for (const { track, note } of d.index[positiveMod(d.next, song.length)] ?? []) {
        const inst = song.instruments[track.instrument];
        if (!inst) continue;
        const spec = noteSpec(inst, note.pitch, note.len * d.stepSec, note.vel ?? 1);
        if (this.voices + spec.tones.length > this.maxVoices) continue;
        this.voices += spec.tones.length;
        scheduleSpec(ctx, d.gain, spec, at, {
          gain: track.gain ?? 1,
          pan: track.pan ?? 0,
          ended: () => this.voices--,
        });
      }
      d.next++;
    }
  }
}

/**
 * Renders `seconds` of a song offline into a stereo buffer (lab views, level checks in the
 * browser). Needs `OfflineAudioContext`.
 */
export async function renderSong(
  song: Song,
  seconds: number,
  sampleRate = 22_050,
): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil((seconds + 0.5) * sampleRate), sampleRate);
  const out = ctx.createGain();
  out.gain.value = song.gain ?? 1;
  out.connect(ctx.destination);
  const index = indexSong(song);
  const ss = stepSeconds(song);
  for (let step = 0; ; step++) {
    const t = (step + (step % 2 === 1 ? (song.swing ?? 0) : 0)) * ss;
    if (t >= seconds) break;
    for (const { track, note } of index[step % song.length] ?? []) {
      const inst = song.instruments[track.instrument];
      if (!inst) continue;
      const spec = noteSpec(inst, note.pitch, note.len * ss, note.vel ?? 1);
      scheduleSpec(ctx, out, spec, t, { gain: track.gain ?? 1, pan: track.pan ?? 0 });
    }
  }
  return ctx.startRendering();
}

function positiveMod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

function isHidden(): boolean {
  return typeof document !== 'undefined' && document.hidden;
}
