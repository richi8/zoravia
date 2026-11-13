/**
 * Music style of each biome (C25): the arrangements the composer turns into field and battle
 * music. Interim home next to `world/biomes.ts`; both move to packs together.
 *
 * - **Forest & lakes:** D major, a swung flute over harp and soft pads. Battle: B minor,
 *   square lead, pulsing octave bass, full kit.
 * - **Volcanic desert:** E Phrygian dominant (the bright-but-tense "desert" mode), a reed over
 *   a drone and oud, hand drums. Battle: the same mode, galloping bass, claps.
 * - **Frozen coast:** F Lydian, slow sparse bells over glass pads and a celesta, no drums.
 *   Battle: D harmonic minor, brass, an icy celesta ostinato.
 *
 * Boss music without a hand-written theme is derived from the biome's battle arrangement.
 */

import type { BiomeId } from '@game/world/biomes';
import type { Arrangement } from './compose';

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
} as const;

export interface BiomeMusic {
  readonly field: Arrangement;
  readonly battle: Arrangement;
}

const KIT_BATTLE = [
  { instrument: 'kick', hits: 'x.....x.x.......' },
  { instrument: 'snare', hits: '....x.......x...' },
  { instrument: 'hat', hits: 'x.o.x.o.x.o.x.oo', gain: 0.9 },
] as const;

export const BIOME_MUSIC: Readonly<Record<BiomeId, BiomeMusic>> = {
  forest: {
    field: {
      form: 'field',
      bpm: 96,
      root: 74, // D5
      scale: SCALES.major,
      progressions: [
        [0, 4, 5, 3],
        [3, 4, 2, 5],
      ],
      swing: 0.12,
      gain: 0.65,
      lead: { instrument: 'flute', density: 0.2, range: [-3, 8] },
      counter: { instrument: 'ocarina' },
      pad: { instrument: 'pad', octave: -24 },
      bass: { instrument: 'bass', octave: -36, pattern: 'roots' },
      arp: { instrument: 'harp', octave: -12, rate: 2, pattern: 'up', from: 1, gain: 0.8 },
      drums: [
        { instrument: 'shaker', hits: '..o...x...o...x.', from: 1 },
        { instrument: 'kick', hits: 'x.......x.......', gain: 0.5, from: 1 },
      ],
      fills: true,
    },
    battle: {
      form: 'battle',
      bpm: 146,
      root: 71, // B4
      scale: SCALES.harmonicMinor,
      progressions: [
        [0, 5, 3, 4],
        [5, 2, 3, 4],
      ],
      gain: 0.85,
      lead: { instrument: 'squareLead', density: 0.75, range: [-2, 9] },
      pad: { instrument: 'organ', octave: -12, style: 'stabs', gain: 1.2 },
      bass: { instrument: 'bassPulse', octave: -36, pattern: 'octaves' },
      arp: { instrument: 'pluck', octave: -12, rate: 1, pattern: 'broken', gain: 0.8 },
      drums: KIT_BATTLE,
      fills: true,
    },
  },
  desert: {
    field: {
      form: 'field',
      bpm: 84,
      root: 64, // E4
      scale: SCALES.phrygianDominant,
      progressions: [
        [0, 1, 0, 6],
        [3, 1, 6, 0],
      ],
      gain: 0.9,
      lead: { instrument: 'reed', density: 0.35, range: [-1, 10] },
      pad: { instrument: 'drone', octave: -12, gain: 0.9 },
      bass: { instrument: 'drone', octave: -24, pattern: 'drone', gain: 1.2 },
      arp: { instrument: 'oud', octave: -12, rate: 2, pattern: 'broken', from: 1 },
      drums: [
        { instrument: 'doum', hits: 'x.......x.......' },
        { instrument: 'tek', hits: '..x...x.....x...', from: 1 },
      ],
      fills: false,
    },
    battle: {
      form: 'battle',
      bpm: 152,
      root: 64,
      scale: SCALES.phrygianDominant,
      progressions: [
        [0, 1, 0, 1],
        [6, 5, 1, 0],
      ],
      gain: 0.72,
      lead: { instrument: 'squareLead', density: 0.7, range: [0, 10] },
      counter: { instrument: 'reed' },
      pad: { instrument: 'drone', octave: -12 },
      bass: { instrument: 'bassPulse', octave: -36, pattern: 'gallop' },
      arp: { instrument: 'oud', octave: -12, rate: 1, pattern: 'broken', gain: 0.8 },
      drums: [
        { instrument: 'kick', hits: 'x.......x.x.....' },
        { instrument: 'doum', hits: '......x.......x.', gain: 0.8 },
        { instrument: 'tek', hits: '..x.x...x.x.x.xx' },
        { instrument: 'clap', hits: '....x.......x...' },
      ],
      fills: true,
    },
  },
  frozen: {
    field: {
      form: 'field',
      bpm: 72,
      root: 77, // F5
      scale: SCALES.lydian,
      progressions: [
        [0, 1, 0, 4],
        [5, 3, 1, 4],
      ],
      gain: 0.85,
      lead: { instrument: 'bell', density: 0.05, range: [-3, 7] },
      pad: { instrument: 'glassPad', octave: -24, sevenths: true },
      bass: { instrument: 'bass', octave: -36, pattern: 'drone', gain: 0.6 },
      arp: { instrument: 'celesta', octave: -12, rate: 4, pattern: 'updown', gain: 0.8 },
      drums: [{ instrument: 'chime', hits: 'x...............', from: 1 }],
      fills: false,
    },
    battle: {
      form: 'battle',
      bpm: 138,
      root: 74, // D5
      scale: SCALES.harmonicMinor,
      progressions: [
        [0, 5, 6, 4],
        [3, 0, 1, 4],
      ],
      gain: 0.85,
      lead: { instrument: 'brass', density: 0.6, range: [-3, 7] },
      pad: { instrument: 'strings', octave: -24 },
      bass: { instrument: 'bassPulse', octave: -36, pattern: 'pulse' },
      arp: { instrument: 'celesta', octave: 0, rate: 1, pattern: 'up', gain: 0.7 },
      drums: KIT_BATTLE,
      fills: true,
    },
  },
};

/** Boss music derived from a battle arrangement: lower, a little slower, heavier. */
export function bossArrangement(battle: Arrangement): Arrangement {
  return {
    ...battle,
    gain: (battle.gain ?? 1) * 0.92,
    bpm: Math.round(battle.bpm * 0.92),
    root: battle.root - 2,
    scale: SCALES.harmonicMinor,
    progressions: [
      [0, 5, 1, 4],
      [0, 3, 5, 4],
    ],
    lead: { ...battle.lead, instrument: 'brass', density: 0.55 },
    counter: { instrument: 'strings', gain: 0.8 },
    pad: { instrument: 'strings', octave: -24 },
    bass: { instrument: 'bassPulse', octave: -36, pattern: 'gallop' },
    drums: [
      ...(battle.drums ?? []),
      { instrument: 'timpani', hits: 'x.......x.......', gain: 0.8 },
    ],
    fills: true,
  };
}
