/**
 * Web Audio playback for `SoundSpec`s (C24).
 *
 * Buses: `sfx`, `music` and `ambience` feed a `master` gain. Volumes are 0–1 and map to gain
 * as `v²`, which feels even across the slider.
 *
 * Browsers only let audio start after a user gesture, and creating an `AudioContext` earlier
 * logs a warning. So the context is created on the first key press or click (`attachUnlock`),
 * and sounds played before that are dropped. Without Web Audio (tests, old browsers) every
 * call is a silent no-op.
 */

import { curvePoints, specDuration, type Curve, type SoundSpec, type Tone } from './spec';

export type Bus = 'sfx' | 'music' | 'ambience';
export type VolumeChannel = Bus | 'master';

export interface PlayOptions {
  readonly bus?: Bus;
  /** Gain multiplier. Default 1. */
  readonly gain?: number;
  /** Stereo offset added to each tone's pan, −1 to 1. */
  readonly pan?: number;
  /** Seconds from now. Default 0. */
  readonly delay?: number;
  /**
   * Throttle key: a sound with the same key is skipped if one started less than `throttle`
   * seconds ago (menu ticks, text blips).
   */
  readonly key?: string;
  readonly throttle?: number;
}

/** Most voices playing at once; new sounds are dropped above it. */
export const MAX_VOICES = 48;
const SILENT = 0.0001;

export class AudioEngine {
  private ctx: AudioContext | undefined;
  private master: GainNode | undefined;
  private buses: Partial<Record<Bus, GainNode>> = {};
  private readonly volumes: Record<VolumeChannel, number> = {
    master: 1,
    sfx: 1,
    music: 1,
    ambience: 1,
  };
  private readonly lastPlayed = new Map<string, number>();
  private voices = 0;

  constructor(private readonly createContext: () => AudioContext | undefined = defaultContext) {}

  /** True once the context exists and runs. */
  get ready(): boolean {
    return this.ctx?.state === 'running';
  }

  /** Current time of the audio clock (0 before unlock). */
  get now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  /** The context, once unlocked (for C25's sequencer). */
  get context(): AudioContext | undefined {
    return this.ctx;
  }

  /** A bus's gain node, once unlocked (music and ambience connect here). */
  bus(bus: Bus): GainNode | undefined {
    return this.buses[bus];
  }

  volume(channel: VolumeChannel): number {
    return this.volumes[channel];
  }

  setVolume(channel: VolumeChannel, value: number): void {
    const v = Math.min(1, Math.max(0, value));
    this.volumes[channel] = v;
    const node = channel === 'master' ? this.master : this.buses[channel];
    if (node && this.ctx) node.gain.setTargetAtTime(v * v, this.ctx.currentTime, 0.02);
  }

  /** Creates or resumes the context. Call from a user gesture. */
  unlock(): void {
    if (!this.ctx) {
      const ctx = this.createContext();
      if (!ctx) return;
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.volumes.master ** 2;
      this.master.connect(ctx.destination);
      for (const bus of ['sfx', 'music', 'ambience'] as const) {
        const g = ctx.createGain();
        g.gain.value = this.volumes[bus] ** 2;
        g.connect(this.master);
        this.buses[bus] = g;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Unlocks on the first key press, click or touch on `target`. Returns a disposer. */
  attachUnlock(target: Window = window): () => void {
    const events = ['keydown', 'pointerdown', 'touchend'] as const;
    const fn = (): void => {
      this.unlock();
      if (this.ready) for (const e of events) target.removeEventListener(e, fn);
    };
    for (const e of events) target.addEventListener(e, fn);
    return () => {
      for (const e of events) target.removeEventListener(e, fn);
    };
  }

  /** Plays a spec. Returns false if it was dropped (locked, throttled, too many voices). */
  play(spec: SoundSpec, opts: PlayOptions = {}): boolean {
    const ctx = this.ctx;
    const out = this.buses[opts.bus ?? 'sfx'];
    if (!ctx || !out || ctx.state !== 'running') return false;
    if (this.voices + spec.tones.length > MAX_VOICES) return false;
    const t0 = ctx.currentTime + 0.005 + (opts.delay ?? 0);
    if (opts.key !== undefined) {
      const last = this.lastPlayed.get(opts.key);
      if (last !== undefined && t0 - last < (opts.throttle ?? 0.03)) return false;
      this.lastPlayed.set(opts.key, t0);
    }
    const gain = (spec.gain ?? 1) * (opts.gain ?? 1);
    for (const tone of spec.tones) {
      this.voices++;
      scheduleTone(ctx, out, tone, t0, gain, opts.pan ?? 0, noiseBuffer(ctx), () => this.voices--);
    }
    return true;
  }
}

/**
 * Renders a spec offline into a stereo buffer (the lab's waveforms, tests in the browser).
 * Needs `OfflineAudioContext`.
 */
export async function renderSpec(spec: SoundSpec, sampleRate = 44_100): Promise<AudioBuffer> {
  const len = Math.max(1, Math.ceil((specDuration(spec) + 0.05) * sampleRate));
  const ctx = new OfflineAudioContext(2, len, sampleRate);
  const gain = spec.gain ?? 1;
  for (const tone of spec.tones) {
    scheduleTone(ctx, ctx.destination, tone, 0, gain, 0, noiseBuffer(ctx), () => {});
  }
  return ctx.startRendering();
}

/**
 * Schedules a spec at audio time `t0` into `out` (music and ambience players use this with
 * their own gain nodes). Calls `ended` once per tone when it stops.
 */
export function scheduleSpec(
  ctx: BaseAudioContext,
  out: AudioNode,
  spec: SoundSpec,
  t0: number,
  opts: { readonly gain?: number; readonly pan?: number; readonly ended?: () => void } = {},
): void {
  const gain = (spec.gain ?? 1) * (opts.gain ?? 1);
  const noise = noiseBuffer(ctx);
  for (const tone of spec.tones) {
    scheduleTone(ctx, out, tone, t0, gain, opts.pan ?? 0, noise, opts.ended ?? (() => {}));
  }
}

function scheduleTone(
  ctx: BaseAudioContext,
  out: AudioNode,
  tone: Tone,
  t0: number,
  gain: number,
  pan: number,
  noise: AudioBuffer,
  ended: () => void,
): void {
  const start = t0 + (tone.at ?? 0);
  const dur = Math.max(0.01, tone.dur);
  const end = start + dur;

  let src: OscillatorNode | AudioBufferSourceNode;
  if (tone.wave === 'noise') {
    const n = ctx.createBufferSource();
    n.buffer = noise;
    n.loop = true;
    src = n;
  } else {
    const o = ctx.createOscillator();
    o.type = tone.wave;
    ramp(o.frequency, tone.freq ?? 440, start, dur, ctx.sampleRate / 2);
    src = o;
  }
  if (tone.detune) src.detune.value = tone.detune;

  let lfo: OscillatorNode | undefined;
  if (tone.vibrato) {
    lfo = ctx.createOscillator();
    lfo.frequency.value = tone.vibrato.rate;
    const depth = ctx.createGain();
    depth.gain.value = tone.vibrato.depth;
    lfo.connect(depth).connect(src.detune);
  }

  let node: AudioNode = src;
  if (tone.filter) {
    const f = ctx.createBiquadFilter();
    f.type = tone.filter.type;
    f.Q.value = tone.filter.q ?? 1;
    ramp(f.frequency, tone.filter.freq, start, dur, ctx.sampleRate / 2);
    node = node.connect(f);
  }

  const env = ctx.createGain();
  const peak = Math.max(SILENT * 2, (tone.gain ?? 0.5) * gain);
  const attack = Math.min(dur * 0.9, Math.max(0.001, tone.attack ?? 0.005));
  const holdEnd = start + attack + (dur - attack) * Math.min(1, Math.max(0, tone.hold ?? 0));
  env.gain.setValueAtTime(SILENT, start);
  env.gain.linearRampToValueAtTime(peak, start + attack);
  env.gain.setValueAtTime(peak, holdEnd);
  env.gain.exponentialRampToValueAtTime(SILENT, end);
  node = node.connect(env);

  const p = Math.min(1, Math.max(-1, (tone.pan ?? 0) + pan));
  if (p !== 0 && ctx.createStereoPanner) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = p;
    node = node.connect(panner);
  }
  node.connect(out);

  src.onended = () => {
    ended();
    src.disconnect();
    env.disconnect();
    lfo?.disconnect();
  };
  src.start(start);
  src.stop(end + 0.02);
  lfo?.start(start);
  lfo?.stop(end + 0.02);
}

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
const longNoiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

/** One second of white noise per context (a fixed LCG, so it is the same every run). */
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buf = noiseBuffers.get(ctx);
  if (!buf) {
    buf = makeNoise(ctx, 1, 0x2545f491);
    noiseBuffers.set(ctx, buf);
  }
  return buf;
}

/**
 * Five seconds of white noise per context, for continuous beds (wind, rain, surf): a long loop
 * so its repeat can't be heard.
 */
export function longNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buf = longNoiseBuffers.get(ctx);
  if (!buf) {
    buf = makeNoise(ctx, 5, 0x6a09e667);
    longNoiseBuffers.set(ctx, buf);
  }
  return buf;
}

function makeNoise(ctx: BaseAudioContext, seconds: number, seed: number): AudioBuffer {
  const len = Math.round(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let s = seed;
  for (let i = 0; i < len; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    data[i] = s / 0x80000000 - 1;
  }
  return buf;
}

/**
 * Sets a frequency param to a curve: points spread evenly over `dur`, exponential between.
 * Values are kept between 1 Hz and `max` (the context's Nyquist frequency).
 */
function ramp(param: AudioParam, curve: Curve, start: number, dur: number, max: number): void {
  const pts = curvePoints(curve).map((v) => Math.min(max, Math.max(1, v)));
  const first = pts[0] ?? 440;
  param.setValueAtTime(first, start);
  for (let i = 1; i < pts.length; i++) {
    param.exponentialRampToValueAtTime(pts[i] ?? first, start + (dur * i) / (pts.length - 1));
  }
}

function defaultContext(): AudioContext | undefined {
  const Ctor =
    typeof window === 'undefined'
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  try {
    return Ctor ? new Ctor() : undefined;
  } catch {
    return undefined;
  }
}
