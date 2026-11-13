/**
 * Ambience: layered background sound of a place (C25).
 *
 * An `Ambience` is a list of layers:
 * - **beds** play without end: filtered noise or a soft tone, with a slow swell of the level
 *   and an optional slow filter sweep (wind, rain, surf, a lava rumble);
 * - **events** play now and then: one of a few short sounds at a random time, pitch, level
 *   and stereo position (birds, drips, crackles, ice creaks), optionally in short bursts.
 *
 * `AmbiencePlayer` crossfades between ambiences the same way `MusicPlayer` does with songs.
 * Event timing uses a seeded `Rng`, so a place sounds the same way every visit.
 */

import { Rng } from '../core/rng';
import { longNoiseBuffer, scheduleSpec, type AudioEngine, type Bus } from './audio-engine';
import { scaleSpec, type SoundSpec } from './spec';

export interface AmbienceBed {
  readonly kind: 'bed';
  /** `noise`, or a wave at `freq`. */
  readonly source: 'noise' | 'sine' | 'triangle' | 'sawtooth' | 'square';
  readonly freq?: number;
  readonly filter: {
    readonly type: 'lowpass' | 'highpass' | 'bandpass';
    readonly freq: number;
    readonly q?: number;
  };
  readonly gain: number;
  /** Slow rise and fall of the level: `rate` in Hz, `depth` 0–1. */
  readonly swell?: { readonly rate: number; readonly depth: number };
  /** Slow sweep of the filter: `rate` in Hz, `depth` in Hz. */
  readonly sweep?: { readonly rate: number; readonly depth: number };
  readonly pan?: number;
}

export interface AmbienceEvents {
  readonly kind: 'events';
  readonly sounds: readonly SoundSpec[];
  /** Seconds between two sounds (or bursts), min–max. */
  readonly every: readonly [number, number];
  /** Pitch multiplier range. Default [1, 1]. */
  readonly pitch?: readonly [number, number];
  /** Gain multiplier range. Default [1, 1]. */
  readonly gain?: readonly [number, number];
  /** How far left or right a sound may sit, 0–1. Default 0.6. */
  readonly spread?: number;
  /** Several sounds close together (a bird's call): count range and gap in seconds. */
  readonly burst?: { readonly count: readonly [number, number]; readonly gap: number };
}

export type AmbienceLayer = AmbienceBed | AmbienceEvents;

export interface Ambience {
  /** Stable id; the same ambience again is ignored. */
  readonly id: string;
  readonly layers: readonly AmbienceLayer[];
  /** Overall gain. Default 1. */
  readonly gain?: number;
}

export interface AmbiencePlayOptions {
  /** Crossfade in seconds. Default 2. */
  readonly fade?: number;
}

interface Deck {
  readonly ambience: Ambience;
  readonly gain: GainNode;
  readonly sources: AudioScheduledSourceNode[];
  readonly rng: Rng;
  /** Audio time of each events layer's next sound. */
  readonly nextAt: number[];
  until?: number;
}

const SILENT = 0.0001;
const LOOKAHEAD = 0.3;
const HIDDEN_LOOKAHEAD = 1.6;

export class AmbiencePlayer {
  private deck: Deck | undefined;
  private readonly fading: Deck[] = [];
  private wanted: { ambience: Ambience; opts: AmbiencePlayOptions } | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private level: GainNode | undefined;
  private levelValue = 1;

  constructor(
    private readonly audio: AudioEngine,
    private readonly bus: Bus = 'ambience',
  ) {}

  get current(): string | undefined {
    return this.wanted?.ambience.id;
  }

  play(ambience: Ambience, opts: AmbiencePlayOptions = {}): void {
    if (this.wanted?.ambience.id === ambience.id) return;
    this.wanted = { ambience, opts };
    if (this.timer === undefined) this.timer = setInterval(() => this.tick(), 50);
    this.tick();
  }

  stop(fade = 2): void {
    this.wanted = undefined;
    this.retire(fade);
  }

  /** Scales the whole ambience (quieter under battle music). */
  setLevel(level: number, seconds = 1): void {
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

  dispose(): void {
    this.wanted = undefined;
    for (const d of [...this.fading, ...(this.deck ? [this.deck] : [])]) this.close(d);
    this.fading.length = 0;
    this.deck = undefined;
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }

  private retire(fade: number): void {
    const d = this.deck;
    const ctx = this.audio.context;
    this.deck = undefined;
    if (!d || !ctx) return;
    const now = ctx.currentTime;
    const f = Math.max(0.02, fade);
    d.gain.gain.cancelScheduledValues(now);
    d.gain.gain.setValueAtTime(Math.max(SILENT, d.gain.gain.value), now);
    d.gain.gain.linearRampToValueAtTime(SILENT, now + f);
    d.until = now + f + 0.05;
    this.fading.push(d);
  }

  private close(d: Deck): void {
    for (const s of d.sources) {
      try {
        s.stop();
      } catch {
        // Already stopped.
      }
      s.disconnect();
    }
    d.gain.disconnect();
  }

  private tick(): void {
    const ctx = this.audio.context;
    const bus = this.audio.bus(this.bus);
    if (!ctx || !bus || ctx.state !== 'running') return;
    if (!this.level) {
      this.level = ctx.createGain();
      this.level.gain.value = this.levelValue;
      this.level.connect(bus);
    }
    const now = ctx.currentTime;
    const want = this.wanted;
    if (want && this.deck?.ambience.id !== want.ambience.id) {
      const fade = want.opts.fade ?? 2;
      this.retire(fade);
      this.deck = this.open(ctx, this.level, want.ambience, fade);
    }
    const horizon = now + (isHidden() ? HIDDEN_LOOKAHEAD : LOOKAHEAD);
    for (const d of [...this.fading, ...(this.deck ? [this.deck] : [])]) {
      this.events(ctx, d, now, Math.min(horizon, d.until ?? Infinity));
    }
    for (let i = this.fading.length - 1; i >= 0; i--) {
      const d = this.fading[i];
      if (d && d.until !== undefined && now > d.until) {
        this.close(d);
        this.fading.splice(i, 1);
      }
    }
    if (!this.deck && !this.wanted && !this.fading.length && this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private open(ctx: AudioContext, out: AudioNode, ambience: Ambience, fade: number): Deck {
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    const target = ambience.gain ?? 1;
    gain.gain.setValueAtTime(SILENT, now);
    gain.gain.linearRampToValueAtTime(target, now + Math.max(0.05, fade));
    gain.connect(out);
    const rng = new Rng(`ambience:${ambience.id}`);
    const sources: AudioScheduledSourceNode[] = [];
    const nextAt: number[] = [];
    for (const layer of ambience.layers) {
      if (layer.kind === 'bed') {
        sources.push(...startBed(ctx, gain, layer, now, rng));
        nextAt.push(Infinity);
      } else {
        // The first sound comes after part of the usual wait, not right at the fade-in.
        nextAt.push(now + rng.float(0.3, 1) * rng.float(layer.every[0], layer.every[1]));
      }
    }
    return { ambience, gain, sources, rng, nextAt };
  }

  private events(ctx: AudioContext, d: Deck, now: number, horizon: number): void {
    d.ambience.layers.forEach((layer, i) => {
      if (layer.kind !== 'events' || !layer.sounds.length) return;
      let at = d.nextAt[i] ?? Infinity;
      if (at < now - 0.5) at = now; // a throttled tab: don't play a backlog
      while (at < horizon) {
        const { rng } = d;
        const spec = layer.sounds[rng.int(0, layer.sounds.length - 1)];
        const pitch = rng.float(layer.pitch?.[0] ?? 1, layer.pitch?.[1] ?? 1);
        const g = rng.float(layer.gain?.[0] ?? 1, layer.gain?.[1] ?? 1);
        const spread = layer.spread ?? 0.6;
        const pan = rng.float(-spread, spread);
        const count = layer.burst ? rng.int(layer.burst.count[0], layer.burst.count[1]) : 1;
        if (spec) {
          const scaled = scaleSpec(spec, { pitch });
          for (let k = 0; k < count; k++) {
            const jitter = k === 0 ? 1 : rng.float(0.94, 1.06);
            const t = at + k * (layer.burst?.gap ?? 0);
            scheduleSpec(
              ctx,
              d.gain,
              jitter === 1 ? scaled : scaleSpec(scaled, { pitch: jitter }),
              t,
              {
                gain: g,
                pan,
              },
            );
          }
        }
        at += rng.float(layer.every[0], layer.every[1]);
      }
      d.nextAt[i] = at;
    });
  }
}

function startBed(
  ctx: AudioContext,
  out: AudioNode,
  bed: AmbienceBed,
  now: number,
  rng: Rng,
): AudioScheduledSourceNode[] {
  const sources: AudioScheduledSourceNode[] = [];
  let src: AudioScheduledSourceNode;
  if (bed.source === 'noise') {
    const n = ctx.createBufferSource();
    n.buffer = longNoiseBuffer(ctx);
    n.loop = true;
    // Each bed starts somewhere else in the loop, so two beds never line up.
    n.loopStart = 0;
    src = n;
    sources.push(n);
    n.start(now, rng.float(0, 4.5));
  } else {
    const o = ctx.createOscillator();
    o.type = bed.source;
    o.frequency.value = bed.freq ?? 110;
    src = o;
    sources.push(o);
    o.start(now);
  }
  const filter = ctx.createBiquadFilter();
  filter.type = bed.filter.type;
  filter.frequency.value = bed.filter.freq;
  filter.Q.value = bed.filter.q ?? 0.7;
  const gain = ctx.createGain();
  const depth = Math.min(1, Math.max(0, bed.swell?.depth ?? 0));
  gain.gain.value = bed.gain * (1 - depth / 2);
  src.connect(filter).connect(gain);
  let node: AudioNode = gain;
  if (bed.pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = bed.pan;
    node = node.connect(p);
  }
  node.connect(out);
  if (bed.swell && depth > 0) {
    sources.push(lfo(ctx, bed.swell.rate, (bed.gain * depth) / 2, gain.gain, now));
  }
  if (bed.sweep) sources.push(lfo(ctx, bed.sweep.rate, bed.sweep.depth, filter.frequency, now));
  return sources;
}

/** A slow sine moving `param` by ±`depth`. */
function lfo(
  ctx: AudioContext,
  rate: number,
  depth: number,
  param: AudioParam,
  now: number,
): OscillatorNode {
  const o = ctx.createOscillator();
  o.frequency.value = rate;
  const g = ctx.createGain();
  g.gain.value = depth;
  o.connect(g).connect(param);
  o.start(now);
  return o;
}

function isHidden(): boolean {
  return typeof document !== 'undefined' && document.hidden;
}
