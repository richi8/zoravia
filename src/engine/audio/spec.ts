/**
 * Sound specs: small, plain-data recipes for synthesized sounds (C24).
 *
 * A `SoundSpec` is a list of `Tone`s. Each tone is one oscillator (or white noise) with a
 * pitch curve, a simple envelope and an optional filter sweep and vibrato. Specs are pure data,
 * so they can be built and tested without Web Audio; `AudioEngine` renders them.
 */

export type Wave = 'sine' | 'square' | 'triangle' | 'sawtooth' | 'noise';

/** A value, or points spread evenly over the tone's length (exponential ramps between). */
export type Curve = number | readonly number[];

export interface ToneFilter {
  readonly type: 'lowpass' | 'highpass' | 'bandpass';
  /** Cutoff / center frequency in Hz. */
  readonly freq: Curve;
  readonly q?: number;
}

export interface Tone {
  readonly wave: Wave;
  /** Start offset in seconds. Default 0. */
  readonly at?: number;
  /** Length in seconds, attack included. */
  readonly dur: number;
  /** Pitch in Hz. Ignored for noise (shape noise with `filter`). */
  readonly freq?: Curve;
  /** Peak gain, 0–1. Default 0.5. */
  readonly gain?: number;
  /** Attack in seconds. Default 0.005. */
  readonly attack?: number;
  /** Part of the length (after the attack) held at the peak before the decay. Default 0. */
  readonly hold?: number;
  readonly filter?: ToneFilter;
  /** Pitch wobble: `rate` in Hz, `depth` in cents. */
  readonly vibrato?: { readonly rate: number; readonly depth: number };
  /** Fixed detune in cents. */
  readonly detune?: number;
  /** Stereo position, −1 (left) to 1 (right). */
  readonly pan?: number;
}

export interface SoundSpec {
  readonly tones: readonly Tone[];
  /** Overall gain. Default 1. */
  readonly gain?: number;
}

export const MIN_FREQ = 20;
export const MAX_FREQ = 18_000;

/** Length of a spec in seconds (end of its last tone). */
export function specDuration(spec: SoundSpec): number {
  let end = 0;
  for (const t of spec.tones) end = Math.max(end, (t.at ?? 0) + t.dur);
  return end;
}

/** The points of a curve (a single value is one point). */
export function curvePoints(curve: Curve): readonly number[] {
  return typeof curve === 'number' ? [curve] : curve;
}

export interface ScaleOptions {
  /** Pitch multiplier (filters follow). Default 1. */
  readonly pitch?: number;
  /** Time multiplier (2 = twice as long). Default 1. */
  readonly stretch?: number;
  /** Gain multiplier. Default 1. */
  readonly gain?: number;
}

const scaleCurve = (c: Curve, k: number): Curve =>
  typeof c === 'number' ? clampFreq(c * k) : c.map((v) => clampFreq(v * k));

export function clampFreq(f: number): number {
  return Math.min(MAX_FREQ, Math.max(MIN_FREQ, f));
}

/** A copy of `spec` with pitch, time and gain scaled. */
export function scaleSpec(spec: SoundSpec, opts: ScaleOptions): SoundSpec {
  const pitch = opts.pitch ?? 1;
  const stretch = opts.stretch ?? 1;
  const gain = opts.gain ?? 1;
  if (pitch === 1 && stretch === 1 && gain === 1) return spec;
  return {
    gain: (spec.gain ?? 1) * gain,
    tones: spec.tones.map((t) => ({
      ...t,
      ...(t.at !== undefined ? { at: t.at * stretch } : {}),
      dur: t.dur * stretch,
      ...(t.attack !== undefined ? { attack: t.attack * stretch } : {}),
      ...(t.freq !== undefined ? { freq: scaleCurve(t.freq, pitch) } : {}),
      ...(t.filter ? { filter: { ...t.filter, freq: scaleCurve(t.filter.freq, pitch) } } : {}),
    })),
  };
}

/** Plays `b` after `a` (with an optional gap). */
export function sequence(a: SoundSpec, b: SoundSpec, gap = 0): SoundSpec {
  const offset = specDuration(a) + gap;
  const k = (b.gain ?? 1) / (a.gain ?? 1);
  return {
    ...(a.gain !== undefined ? { gain: a.gain } : {}),
    tones: [
      ...a.tones,
      ...b.tones.map((t) => ({ ...t, at: (t.at ?? 0) + offset, gain: (t.gain ?? 0.5) * k })),
    ],
  };
}

/** Frequency of a MIDI note number (69 = A4 = 440 Hz). */
export function midiHz(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}
