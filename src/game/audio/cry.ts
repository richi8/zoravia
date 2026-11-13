/**
 * Zorling cries from the genome (C24). Pure and deterministic: the same genome always gives
 * the same `SoundSpec`, so a species always sounds the same (its look comes from its genome,
 * see `speciesLook`).
 *
 * - The body plan picks the voice: wave, base pitch and contour (a bark drops, a meow rises
 *   and falls, an insect buzzes, a golem rumbles).
 * - Size lowers the pitch: bigger and bulkier Zorlings (and later evolution stages) sound
 *   deeper and longer.
 * - Mood shapes it: cute is higher with a rising end, fierce is harsher (a sawtooth layer),
 *   dark is lower, slower and detuned.
 * - The first type adds a texture layer (fire crackle, water bubble, electric buzz, …).
 * - The seed rolls 1–3 syllables and small variations, so two species with the same plan
 *   still differ.
 */

import { Rng } from '@engine/core';
import { clampFreq, type SoundSpec, type Tone, type Wave } from '@engine/audio';
import type { GameContent } from '@game/data';
import type { BodyPlan, Mood, ZorlingGenome } from '../zorlings/genome';
import { battleLook } from '../zorlings/species-look';
import type { TypeId } from '../style/tokens';

interface Voice {
  readonly wave: Wave;
  /** Base pitch in Hz for a medium-sized Zorling. */
  readonly base: number;
  /** Pitch contour over one syllable, as multipliers of the base. */
  readonly contour: readonly number[];
  /** Syllable length range, seconds. */
  readonly len: readonly [number, number];
  readonly syllables: readonly [number, number];
  /** Breath noise layered under the voice, 0–1. */
  readonly breath: number;
  readonly vibrato?: { readonly rate: number; readonly depth: number };
  readonly filter?: number;
}

const VOICES: Record<BodyPlan, Voice> = {
  quadruped: {
    wave: 'square',
    base: 440,
    contour: [0.9, 1.15, 0.8],
    len: [0.14, 0.24],
    syllables: [1, 2],
    breath: 0.1,
    filter: 2600,
  },
  feline: {
    wave: 'triangle',
    base: 620,
    contour: [0.8, 1.3, 1.1, 0.7],
    len: [0.22, 0.34],
    syllables: [1, 2],
    breath: 0.05,
    vibrato: { rate: 7, depth: 25 },
  },
  canine: {
    wave: 'square',
    base: 380,
    contour: [1.2, 0.75],
    len: [0.08, 0.14],
    syllables: [2, 3],
    breath: 0.25,
    filter: 2000,
  },
  dragon: {
    wave: 'sawtooth',
    base: 210,
    contour: [0.8, 1.2, 1.05, 0.65],
    len: [0.35, 0.5],
    syllables: [1, 1],
    breath: 0.5,
    filter: 1800,
  },
  serpent: {
    wave: 'triangle',
    base: 300,
    contour: [1, 1.1, 0.85],
    len: [0.25, 0.4],
    syllables: [1, 2],
    breath: 0.7,
    vibrato: { rate: 12, depth: 40 },
  },
  avian: {
    wave: 'sine',
    base: 1250,
    contour: [0.8, 1.35, 1],
    len: [0.06, 0.11],
    syllables: [2, 3],
    breath: 0,
    vibrato: { rate: 18, depth: 60 },
  },
  raptor: {
    wave: 'sawtooth',
    base: 820,
    contour: [1.25, 1.1, 0.7],
    len: [0.2, 0.32],
    syllables: [1, 2],
    breath: 0.2,
    filter: 3500,
  },
  bat: {
    wave: 'square',
    base: 1600,
    contour: [1.2, 0.9, 1.15],
    len: [0.05, 0.09],
    syllables: [2, 3],
    breath: 0,
    filter: 5000,
  },
  insect: {
    wave: 'square',
    base: 900,
    contour: [1, 1.05, 0.95],
    len: [0.18, 0.3],
    syllables: [1, 2],
    breath: 0.1,
    vibrato: { rate: 38, depth: 120 },
    filter: 3000,
  },
  fish: {
    wave: 'sine',
    base: 520,
    contour: [0.7, 1.4, 0.8, 1.3],
    len: [0.12, 0.2],
    syllables: [1, 3],
    breath: 0.15,
    vibrato: { rate: 14, depth: 80 },
  },
  blob: {
    wave: 'sine',
    base: 280,
    contour: [0.8, 1.25, 0.75, 1.1],
    len: [0.18, 0.28],
    syllables: [1, 2],
    breath: 0.05,
    vibrato: { rate: 8, depth: 90 },
  },
  biped: {
    wave: 'triangle',
    base: 360,
    contour: [0.95, 1.2, 0.85],
    len: [0.14, 0.22],
    syllables: [1, 3],
    breath: 0.15,
  },
  golem: {
    wave: 'square',
    base: 130,
    contour: [1.05, 0.9, 0.8],
    len: [0.3, 0.45],
    syllables: [1, 2],
    breath: 0.6,
    filter: 900,
  },
};

const MOOD: Record<
  Mood,
  { pitch: number; stretch: number; endRise: number; harsh: number; detune: number }
> = {
  cute: { pitch: 1.25, stretch: 0.9, endRise: 1.2, harsh: 0, detune: 0 },
  fierce: { pitch: 0.9, stretch: 1, endRise: 0.85, harsh: 0.5, detune: 0 },
  dark: { pitch: 0.75, stretch: 1.2, endRise: 0.8, harsh: 0.2, detune: 18 },
};

export interface CryOptions {
  /** Titans and legendaries in boss form: deeper, longer and with more breath. */
  readonly boss?: boolean;
}

/** The cry of a genome. */
export function cryFor(genome: ZorlingGenome, opts: CryOptions = {}): SoundSpec {
  const rng = new Rng(genome.seed).split('cry');
  const voice = VOICES[genome.plan];
  const mood = MOOD[genome.mood];
  const b = genome.body;
  const size = (b.bulk * 2 + b.height + b.length) / 4; // 0–1
  const boss = opts.boss ? { pitch: 0.75, stretch: 1.35 } : { pitch: 1, stretch: 1 };
  const pitch =
    voice.base * mood.pitch * boss.pitch * 2 ** ((0.5 - size) * 1.4) * rng.float(0.92, 1.08);
  const stretch = mood.stretch * boss.stretch * (0.85 + size * 0.35);

  const count = rng.int(voice.syllables[0], voice.syllables[1]);
  const tones: Tone[] = [];
  let at = 0;
  for (let s = 0; s < count; s++) {
    const last = s === count - 1;
    const dur = rng.float(voice.len[0], voice.len[1]) * stretch * (last && count > 1 ? 1.3 : 1);
    const sylPitch = pitch * (s === 0 ? 1 : rng.float(0.88, 1.12));
    const contour = voice.contour.map((k, i, all) => {
      const end = last && i === all.length - 1 ? mood.endRise : 1;
      return clampFreq(sylPitch * k * end * rng.float(0.96, 1.04));
    });
    const filter = voice.filter
      ? { filter: { type: 'lowpass' as const, freq: voice.filter * (0.7 + size * 0.2) } }
      : {};
    const vib = voice.vibrato
      ? {
          vibrato: { rate: voice.vibrato.rate * rng.float(0.85, 1.15), depth: voice.vibrato.depth },
        }
      : {};
    const attack = Math.min(0.04, dur * 0.2);
    tones.push({
      wave: voice.wave,
      at,
      dur,
      freq: contour,
      gain: 0.22,
      attack,
      hold: 0.35,
      ...filter,
      ...vib,
    });
    if (mood.harsh > 0 && voice.wave !== 'sawtooth') {
      tones.push({
        wave: 'sawtooth',
        at,
        dur,
        freq: contour.map((f) => f * 0.5),
        gain: 0.08 * mood.harsh,
        attack,
        hold: 0.3,
        filter: { type: 'lowpass', freq: 1800 },
      });
    }
    if (mood.detune) {
      tones.push({
        wave: voice.wave,
        at,
        dur,
        freq: contour,
        gain: 0.12,
        attack,
        hold: 0.35,
        detune: mood.detune,
        ...filter,
      });
    }
    const breath = voice.breath + (opts.boss ? 0.3 : 0);
    if (breath > 0) {
      tones.push({
        wave: 'noise',
        at,
        dur: dur * 1.05,
        gain: 0.2 * Math.min(1, breath),
        attack: attack * 2,
        hold: 0.2,
        filter: { type: 'bandpass', freq: contour.map((f) => f * 2), q: 1.5 },
      });
    }
    at += dur + rng.float(0.03, 0.07) * stretch;
  }
  const total = at;
  const texture = typeTexture(genome.types[0], pitch, total, rng.split('texture'));
  return { tones: [...tones, ...texture], gain: 0.9 };
}

/** A quiet layer for the first type. */
function typeTexture(type: TypeId, pitch: number, total: number, rng: Rng): Tone[] {
  switch (type) {
    case 'fire':
      return [0.2, 0.5, 0.8].map((k) => ({
        wave: 'noise' as const,
        at: total * k * rng.float(0.8, 1),
        dur: 0.03,
        gain: 0.14,
        filter: { type: 'highpass' as const, freq: 3500 },
      }));
    case 'water':
      return [
        { wave: 'sine', at: total * 0.7, dur: 0.08, freq: [pitch * 0.8, pitch * 2.4], gain: 0.12 },
      ];
    case 'nature':
      return [
        {
          wave: 'noise',
          dur: total,
          gain: 0.06,
          attack: total * 0.3,
          filter: { type: 'highpass', freq: 5000 },
        },
      ];
    case 'electric':
      return [
        {
          wave: 'square',
          at: total * 0.1,
          dur: total * 0.6,
          freq: pitch * 3,
          gain: 0.03,
          vibrato: { rate: 50, depth: 300 },
        },
      ];
    case 'ice':
      return [{ wave: 'sine', at: total * 0.5, dur: 0.35, freq: clampFreq(pitch * 4), gain: 0.06 }];
    case 'earth':
      return [{ wave: 'sine', dur: 0.15, freq: [90, 45], gain: 0.25 }];
    case 'wind':
      return [
        {
          wave: 'noise',
          dur: total,
          gain: 0.08,
          attack: total * 0.4,
          filter: { type: 'bandpass', freq: [600, 2400], q: 4 },
        },
      ];
    case 'metal':
      return [
        { wave: 'sine', at: total * 0.8, dur: 0.25, freq: clampFreq(pitch * 2.76), gain: 0.05 },
      ];
  }
}

const cache = new WeakMap<GameContent, Map<string, SoundSpec>>();

/** The cry of a species (from its battle look, so Titans in boss form sound deeper). */
export function speciesCry(
  content: GameContent,
  speciesId: string,
  opts: { readonly boss?: 'titan' | 'legendary'; readonly titanMark?: boolean } = {},
): SoundSpec {
  let byKey = cache.get(content);
  if (!byKey) cache.set(content, (byKey = new Map()));
  const key = `${speciesId}|${opts.boss ?? ''}|${opts.titanMark ? 1 : 0}`;
  const have = byKey.get(key);
  if (have) return have;
  const look = battleLook(content, speciesId, opts);
  const cry = cryFor(look.genome, { boss: opts.boss !== undefined });
  byKey.set(key, cry);
  return cry;
}
