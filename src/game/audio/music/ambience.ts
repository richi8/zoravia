/**
 * Ambience of each biome, plus weather layers (C25). Interim home next to `world/biomes.ts`.
 *
 * - Forest: a soft breeze and leaves, a far-off brook, birds calling in short bursts.
 * - Desert: a dry wind sweeping, the low rumble of lava, crackles and slow bubbles.
 * - Frozen coast: a hollow, whistling wind, surf rolling in, ice creaks, gulls far away.
 * - Rain (the `core:wet` weather): hiss, patter and drips on top of any biome.
 */

import type { Ambience, AmbienceLayer, SoundSpec } from '@engine/audio';
import type { BiomeId } from '@game/world/biomes';

const chirp = (a: number, b: number, dur = 0.07): SoundSpec => ({
  tones: [{ wave: 'sine', freq: [a, b, a * 0.9], dur, gain: 0.05, attack: 0.004 }],
});

const BIRDS: AmbienceLayer = {
  kind: 'events',
  sounds: [
    chirp(3200, 4200),
    chirp(4400, 3400, 0.09),
    chirp(2600, 3600, 0.05),
    {
      tones: [
        { wave: 'sine', freq: [2400, 3100], dur: 0.12, gain: 0.04 },
        { wave: 'sine', at: 0.16, freq: [2200, 1800], dur: 0.18, gain: 0.035 },
      ],
    },
  ],
  every: [2.5, 7],
  pitch: [0.85, 1.15],
  gain: [0.5, 1],
  spread: 0.8,
  burst: { count: [1, 4], gap: 0.13 },
};

/** Scales a set of layers (levels were evened out by measuring each ambience live). */
function level(k: number, layers: readonly AmbienceLayer[]): AmbienceLayer[] {
  return layers.map((l) =>
    l.kind === 'bed'
      ? { ...l, gain: l.gain * k }
      : { ...l, gain: [(l.gain?.[0] ?? 1) * k, (l.gain?.[1] ?? 1) * k] as const },
  );
}

/** Measured bus RMS after these levels: ≈ 0.011–0.013 per biome, ≈ 0.016 with rain. */
const LAYERS: Readonly<Record<BiomeId, readonly AmbienceLayer[]>> = {
  forest: level(2, [
    {
      kind: 'bed',
      source: 'noise',
      filter: { type: 'lowpass', freq: 500 },
      gain: 0.05,
      swell: { rate: 0.07, depth: 0.7 },
    },
    {
      kind: 'bed',
      source: 'noise',
      filter: { type: 'bandpass', freq: 3200, q: 0.8 },
      gain: 0.012,
      swell: { rate: 0.17, depth: 0.9 },
    },
    {
      kind: 'bed',
      source: 'noise',
      filter: { type: 'bandpass', freq: 1500, q: 1.5 },
      gain: 0.008,
      sweep: { rate: 0.3, depth: 300 },
      pan: -0.4,
    },
    BIRDS,
  ]),
  desert: level(1.25, [
    {
      kind: 'bed',
      source: 'noise',
      filter: { type: 'bandpass', freq: 500, q: 0.8 },
      gain: 0.06,
      swell: { rate: 0.05, depth: 0.8 },
      sweep: { rate: 0.07, depth: 220 },
    },
    {
      kind: 'bed',
      source: 'noise',
      filter: { type: 'lowpass', freq: 110 },
      gain: 0.14,
      swell: { rate: 0.11, depth: 0.5 },
    },
    {
      kind: 'events',
      sounds: [
        {
          tones: [
            { wave: 'noise', dur: 0.03, gain: 0.05, filter: { type: 'highpass', freq: 2500 } },
          ],
        },
        {
          tones: [
            {
              wave: 'noise',
              dur: 0.05,
              gain: 0.04,
              filter: { type: 'bandpass', freq: 1800, q: 2 },
            },
          ],
        },
      ],
      every: [0.3, 2.2],
      gain: [0.4, 1],
      spread: 0.9,
      burst: { count: [1, 3], gap: 0.05 },
    },
    {
      kind: 'events',
      sounds: [{ tones: [{ wave: 'sine', freq: [70, 150], dur: 0.18, gain: 0.12, attack: 0.02 }] }],
      every: [3, 8],
      pitch: [0.8, 1.3],
      spread: 0.5,
    },
  ]),
  frozen: level(2.4, [
    {
      kind: 'bed',
      source: 'noise',
      filter: { type: 'bandpass', freq: 750, q: 3 },
      gain: 0.04,
      swell: { rate: 0.06, depth: 0.85 },
      sweep: { rate: 0.05, depth: 320 },
    },
    {
      kind: 'bed',
      source: 'noise',
      filter: { type: 'lowpass', freq: 800 },
      gain: 0.06,
      swell: { rate: 0.11, depth: 0.95 },
      pan: 0.3,
    },
    {
      kind: 'events',
      sounds: [
        {
          tones: [
            {
              wave: 'sawtooth',
              freq: [90, 70],
              dur: 0.25,
              gain: 0.03,
              attack: 0.03,
              filter: { type: 'bandpass', freq: 600, q: 4 },
            },
          ],
        },
        { tones: [{ wave: 'sine', freq: [3200, 3000], dur: 0.25, gain: 0.015 }] },
      ],
      every: [4, 10],
      pitch: [0.8, 1.3],
      spread: 0.7,
    },
    {
      kind: 'events',
      sounds: [
        {
          tones: [
            {
              wave: 'triangle',
              freq: [1300, 1700, 1200],
              dur: 0.35,
              gain: 0.025,
              attack: 0.03,
              vibrato: { rate: 9, depth: 30 },
            },
          ],
        },
      ],
      every: [8, 18],
      pitch: [0.9, 1.1],
      spread: 0.9,
      burst: { count: [1, 3], gap: 0.4 },
    },
  ]),
};

const RAIN: readonly AmbienceLayer[] = level(0.45, [
  {
    kind: 'bed',
    source: 'noise',
    filter: { type: 'highpass', freq: 1400 },
    gain: 0.045,
    swell: { rate: 0.09, depth: 0.3 },
  },
  { kind: 'bed', source: 'noise', filter: { type: 'lowpass', freq: 380 }, gain: 0.05 },
  {
    kind: 'events',
    sounds: [{ tones: [{ wave: 'sine', freq: [1900, 900], dur: 0.04, gain: 0.03 }] }],
    every: [0.05, 0.35],
    pitch: [0.7, 1.4],
    gain: [0.3, 1],
    spread: 0.9,
  },
]);

export const WEATHER_AMBIENCE: Readonly<Record<string, readonly AmbienceLayer[]>> = {
  'core:wet': RAIN,
};

/** The ambience of a biome, with layers for the given weather conditions. */
export function biomeAmbience(biome: BiomeId, weather: readonly string[] = []): Ambience {
  const extra = weather.filter((w) => WEATHER_AMBIENCE[w]);
  return {
    id: [biome, ...extra].join('+'),
    layers: [...LAYERS[biome], ...extra.flatMap((w) => WEATHER_AMBIENCE[w] ?? [])],
  };
}

/**
 * Out on the sea (C37 ferry ride): surf swelling under the boat, wind over open water, gulls,
 * and the ferryman's oars dipping every stroke.
 */
const SEA: readonly AmbienceLayer[] = level(2.2, [
  {
    kind: 'bed',
    source: 'noise',
    filter: { type: 'lowpass', freq: 650 },
    gain: 0.06,
    swell: { rate: 0.16, depth: 0.9 },
  },
  {
    kind: 'bed',
    source: 'noise',
    filter: { type: 'bandpass', freq: 900, q: 2.5 },
    gain: 0.025,
    swell: { rate: 0.07, depth: 0.8 },
    sweep: { rate: 0.04, depth: 250 },
  },
  {
    kind: 'events',
    sounds: [
      {
        tones: [
          {
            wave: 'triangle',
            freq: [1400, 1750, 1250],
            dur: 0.32,
            gain: 0.025,
            attack: 0.03,
            vibrato: { rate: 8, depth: 30 },
          },
        ],
      },
    ],
    every: [5, 11],
    pitch: [0.9, 1.15],
    spread: 0.9,
    burst: { count: [1, 3], gap: 0.35 },
  },
  {
    kind: 'events',
    sounds: [
      {
        tones: [
          {
            wave: 'triangle',
            freq: [260, 140],
            dur: 0.18,
            gain: 0.03,
            attack: 0.01,
            filter: { type: 'lowpass', freq: 900 },
          },
        ],
      },
    ],
    every: [1.1, 1.4],
    pitch: [0.9, 1.1],
    spread: 0.3,
  },
]);

/** The ambience of a ferry ride over the sea (C37). */
export function seaAmbience(): Ambience {
  return { id: 'sea', layers: SEA };
}
