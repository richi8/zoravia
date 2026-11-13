/**
 * The game's instrument presets (C25). Procedural songs and hand-written pack themes both
 * name instruments from this list. Levels are set so a full arrangement sits under the
 * sound effects.
 */

import type { Instrument } from '@engine/audio/song';

export const INSTRUMENT_IDS = [
  // Leads
  'flute',
  'ocarina',
  'reed',
  'squareLead',
  'brass',
  'bell',
  'strings',
  // Chords and arpeggios
  'pad',
  'glassPad',
  'harp',
  'pluck',
  'oud',
  'celesta',
  'organ',
  // Bass
  'bass',
  'bassPulse',
  'drone',
  // Drums
  'kick',
  'snare',
  'hat',
  'shaker',
  'clap',
  'tom',
  'timpani',
  'doum',
  'tek',
  'chime',
] as const;

export type InstrumentId = (typeof INSTRUMENT_IDS)[number];

/**
 * Overall music level: every song's gain is multiplied by it, so a full arrangement sits
 * under the sound effects (measured: music RMS ≈ 0.04–0.06, a hit ≈ 0.045, peaks ≤ 0.35).
 */
export const MUSIC_MIX = 0.33;

/** Default pitch of drum hits (MIDI), for `hits` tracks without one. */
export const DRUM_PITCH: Partial<Record<InstrumentId, number>> = {
  kick: 36,
  snare: 50,
  hat: 72,
  shaker: 72,
  clap: 60,
  tom: 45,
  timpani: 38,
  doum: 43,
  tek: 72,
  chime: 96,
};

export const INSTRUMENTS: Readonly<Record<InstrumentId, Instrument>> = {
  flute: {
    voices: [
      {
        wave: 'triangle',
        gain: 0.3,
        attack: 0.04,
        hold: 0.7,
        release: 0.12,
        vibrato: { rate: 5, depth: 10 },
      },
      { wave: 'sine', pitch: 2, gain: 0.05, attack: 0.05, hold: 0.6, release: 0.1 },
      {
        wave: 'noise',
        gain: 0.012,
        attack: 0.02,
        length: 0.08,
        filter: { type: 'bandpass', freq: 2400, q: 2 },
      },
    ],
  },
  ocarina: {
    voices: [
      {
        wave: 'sine',
        gain: 0.32,
        attack: 0.03,
        hold: 0.7,
        release: 0.1,
        vibrato: { rate: 4.5, depth: 8 },
      },
      { wave: 'triangle', pitch: 2, gain: 0.04, attack: 0.04, hold: 0.5, release: 0.08 },
    ],
  },
  reed: {
    voices: [
      {
        wave: 'sawtooth',
        gain: 0.11,
        attack: 0.07,
        hold: 0.75,
        release: 0.12,
        filter: { type: 'bandpass', freq: 1300, q: 1.6 },
        vibrato: { rate: 5.5, depth: 22 },
      },
      { wave: 'triangle', gain: 0.14, attack: 0.06, hold: 0.7, release: 0.1 },
    ],
  },
  squareLead: {
    voices: [
      {
        wave: 'square',
        gain: 0.075,
        attack: 0.008,
        hold: 0.7,
        release: 0.06,
        filter: { type: 'lowpass', freq: 3600 },
        vibrato: { rate: 6, depth: 7 },
      },
      {
        wave: 'square',
        gain: 0.045,
        attack: 0.008,
        hold: 0.7,
        release: 0.06,
        detune: 9,
        filter: { type: 'lowpass', freq: 2400 },
      },
    ],
  },
  brass: {
    voices: [
      {
        wave: 'sawtooth',
        gain: 0.1,
        attack: 0.03,
        hold: 0.8,
        release: 0.08,
        filter: { type: 'lowpass', freq: [700, 2600, 1500], q: 1.2 },
      },
      {
        wave: 'sawtooth',
        gain: 0.06,
        attack: 0.03,
        hold: 0.8,
        release: 0.08,
        detune: -8,
        filter: { type: 'lowpass', freq: 1800 },
      },
    ],
  },
  bell: {
    voices: [
      { wave: 'sine', gain: 0.22, attack: 0.002, length: 1.5 },
      { wave: 'sine', pitch: 2.76, gain: 0.06, attack: 0.002, length: 0.5 },
      { wave: 'sine', pitch: 5.4, gain: 0.025, attack: 0.002, length: 0.25 },
    ],
  },
  strings: {
    voices: [
      {
        wave: 'sawtooth',
        gain: 0.055,
        attack: 0.14,
        hold: 0.85,
        release: 0.3,
        detune: -7,
        filter: { type: 'lowpass', freq: 2000 },
        vibrato: { rate: 5, depth: 6 },
      },
      {
        wave: 'sawtooth',
        gain: 0.055,
        attack: 0.16,
        hold: 0.85,
        release: 0.3,
        detune: 7,
        filter: { type: 'lowpass', freq: 1700 },
      },
    ],
  },
  // Pads hold to the end of the note and ring past it, so chords overlap without a gap.
  pad: {
    voices: [
      {
        wave: 'sawtooth',
        gain: 0.035,
        attack: 0.3,
        hold: 0.95,
        release: 0.9,
        detune: -6,
        filter: { type: 'lowpass', freq: 900, q: 0.6 },
      },
      { wave: 'triangle', gain: 0.07, attack: 0.25, hold: 0.95, release: 0.9, detune: 6 },
    ],
  },
  glassPad: {
    voices: [
      {
        wave: 'sine',
        gain: 0.07,
        attack: 0.5,
        hold: 0.95,
        release: 1.2,
        vibrato: { rate: 0.4, depth: 6 },
      },
      { wave: 'triangle', pitch: 2, gain: 0.025, attack: 0.6, hold: 0.9, release: 1.2, detune: 5 },
    ],
  },
  harp: {
    voices: [
      { wave: 'triangle', gain: 0.17, attack: 0.002, length: 0.9 },
      { wave: 'sine', pitch: 2, gain: 0.04, attack: 0.002, length: 0.35 },
    ],
  },
  pluck: {
    voices: [
      {
        wave: 'square',
        gain: 0.07,
        attack: 0.002,
        length: 0.32,
        filter: { type: 'lowpass', freq: [3200, 500] },
      },
    ],
  },
  oud: {
    voices: [
      {
        wave: 'sawtooth',
        gain: 0.1,
        attack: 0.002,
        length: 0.45,
        filter: { type: 'bandpass', freq: [2600, 700], q: 2.5 },
      },
      { wave: 'triangle', gain: 0.08, attack: 0.002, length: 0.4 },
    ],
  },
  celesta: {
    voices: [
      { wave: 'sine', gain: 0.14, attack: 0.002, length: 0.8 },
      { wave: 'sine', pitch: 4, gain: 0.03, attack: 0.002, length: 0.2 },
    ],
  },
  organ: {
    voices: [
      { wave: 'sine', gain: 0.08, attack: 0.03, hold: 0.9, release: 0.1 },
      { wave: 'sine', pitch: 2, gain: 0.05, attack: 0.03, hold: 0.9, release: 0.1 },
      { wave: 'sine', pitch: 3, gain: 0.025, attack: 0.03, hold: 0.9, release: 0.1 },
    ],
  },
  bass: {
    voices: [
      { wave: 'triangle', gain: 0.34, attack: 0.008, hold: 0.55, release: 0.05 },
      {
        wave: 'square',
        gain: 0.045,
        attack: 0.008,
        hold: 0.4,
        release: 0.05,
        filter: { type: 'lowpass', freq: 450 },
      },
    ],
  },
  bassPulse: {
    voices: [
      {
        wave: 'sawtooth',
        gain: 0.15,
        attack: 0.004,
        hold: 0.35,
        release: 0.04,
        filter: { type: 'lowpass', freq: [1400, 280], q: 2 },
      },
      { wave: 'triangle', gain: 0.22, attack: 0.004, hold: 0.5, release: 0.04 },
    ],
  },
  drone: {
    voices: [
      {
        wave: 'sawtooth',
        gain: 0.05,
        attack: 0.8,
        hold: 0.9,
        release: 0.8,
        filter: { type: 'lowpass', freq: 500 },
      },
      { wave: 'triangle', gain: 0.1, attack: 0.8, hold: 0.9, release: 0.8 },
    ],
  },
  kick: {
    voices: [{ wave: 'sine', pitch: [3.2, 1], gain: 0.55, attack: 0.002, length: 0.24 }],
  },
  snare: {
    voices: [
      {
        wave: 'noise',
        gain: 0.22,
        attack: 0.002,
        length: 0.16,
        filter: { type: 'bandpass', freq: 2200, q: 0.8 },
      },
      { wave: 'triangle', pitch: [1.5, 1], gain: 0.18, attack: 0.002, length: 0.09 },
    ],
  },
  hat: {
    voices: [
      {
        wave: 'noise',
        gain: 0.07,
        attack: 0.001,
        length: 0.045,
        filter: { type: 'highpass', freq: 7500 },
      },
    ],
  },
  shaker: {
    voices: [
      {
        wave: 'noise',
        gain: 0.05,
        attack: 0.018,
        length: 0.07,
        filter: { type: 'bandpass', freq: 5500, q: 1.4 },
      },
    ],
  },
  clap: {
    voices: [
      {
        wave: 'noise',
        gain: 0.16,
        attack: 0.001,
        length: 0.03,
        filter: { type: 'bandpass', freq: 1500 },
      },
      {
        wave: 'noise',
        at: 0.012,
        gain: 0.16,
        attack: 0.001,
        length: 0.03,
        filter: { type: 'bandpass', freq: 1500 },
      },
      {
        wave: 'noise',
        at: 0.025,
        gain: 0.16,
        attack: 0.001,
        length: 0.12,
        filter: { type: 'bandpass', freq: 1300 },
      },
    ],
  },
  tom: {
    voices: [{ wave: 'sine', pitch: [1.6, 1], gain: 0.42, attack: 0.002, length: 0.28 }],
  },
  timpani: {
    voices: [
      { wave: 'sine', pitch: [1.15, 1], gain: 0.45, attack: 0.004, length: 1 },
      {
        wave: 'noise',
        gain: 0.05,
        attack: 0.002,
        length: 0.08,
        filter: { type: 'lowpass', freq: 400 },
      },
    ],
  },
  doum: {
    voices: [{ wave: 'sine', pitch: [1.5, 1], gain: 0.4, attack: 0.002, length: 0.26 }],
  },
  tek: {
    voices: [
      {
        wave: 'noise',
        gain: 0.09,
        attack: 0.001,
        length: 0.04,
        filter: { type: 'bandpass', freq: 3600, q: 3 },
      },
      { wave: 'sine', pitch: 1, gain: 0.05, attack: 0.001, length: 0.04 },
    ],
  },
  chime: {
    voices: [
      { wave: 'sine', gain: 0.05, attack: 0.002, length: 1.2 },
      { wave: 'sine', pitch: 2.4, gain: 0.02, attack: 0.002, length: 0.6 },
    ],
  },
};
