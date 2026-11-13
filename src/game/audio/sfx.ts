/**
 * The game's sound effects (C24): every UI, battle and overworld sound as a `SoundSpec`.
 * All of them are synthesized; there are no audio files.
 */

import { midiHz, type SoundSpec, type Tone, type Wave } from '@engine/audio';
import type { TypeId } from '../style/tokens';

const hz = midiHz;

interface NoteOptions {
  readonly wave?: Wave;
  /** Seconds per beat. */
  readonly beat?: number;
  readonly gain?: number;
  readonly at?: number;
  /** Note length as a part of its slot (1 = legato). */
  readonly legato?: number;
  readonly hold?: number;
  readonly detune?: number;
}

/** A melody: `[midi note, beats]` pairs (a note of `null` is a rest). */
function notes(seq: readonly (readonly [number | null, number])[], o: NoteOptions = {}): Tone[] {
  const beat = o.beat ?? 0.1;
  let t = o.at ?? 0;
  const out: Tone[] = [];
  for (const [note, beats] of seq) {
    const len = beats * beat;
    if (note !== null) {
      out.push({
        wave: o.wave ?? 'square',
        at: t,
        dur: len * (o.legato ?? 0.9),
        freq: hz(note),
        gain: o.gain ?? 0.18,
        hold: o.hold ?? 0.3,
        ...(o.detune ? { detune: o.detune } : {}),
      });
    }
    t += len;
  }
  return out;
}

/** The same melody an octave down on a soft triangle (cheap "chord" body). */
function bass(seq: readonly (readonly [number | null, number])[], o: NoteOptions = {}): Tone[] {
  return notes(
    seq.map(([n, b]) => [n === null ? null : n - 12, b] as const),
    { wave: 'triangle', gain: 0.22, ...o },
  );
}

// ---------------------------------------------------------------- UI

const ui = {
  'ui.move': { tones: [{ wave: 'square', dur: 0.035, freq: 1320, gain: 0.07 }] },
  'ui.select': {
    tones: [
      { wave: 'square', dur: 0.05, freq: 988, gain: 0.09 },
      { wave: 'square', at: 0.045, dur: 0.07, freq: 1480, gain: 0.09 },
    ],
  },
  'ui.back': {
    tones: [
      { wave: 'square', dur: 0.05, freq: 880, gain: 0.08 },
      { wave: 'square', at: 0.045, dur: 0.07, freq: 587, gain: 0.08 },
    ],
  },
  'ui.blocked': {
    tones: [
      { wave: 'square', dur: 0.07, freq: 196, gain: 0.1 },
      { wave: 'square', at: 0.08, dur: 0.09, freq: 185, gain: 0.1 },
    ],
  },
  'ui.open': {
    tones: [{ wave: 'triangle', dur: 0.09, freq: [660, 1320], gain: 0.2 }],
  },
  'ui.advance': { tones: [{ wave: 'triangle', dur: 0.05, freq: 1760, gain: 0.12 }] },
} satisfies Record<string, SoundSpec>;

// ---------------------------------------------------------------- moves (one per type)

const MOVE: Record<TypeId | 'status', SoundSpec> = {
  fire: {
    tones: [
      {
        wave: 'noise',
        dur: 0.45,
        gain: 0.35,
        attack: 0.04,
        filter: { type: 'bandpass', freq: [600, 2400, 900], q: 1.2 },
      },
      { wave: 'sawtooth', dur: 0.4, freq: [140, 70], gain: 0.12, attack: 0.03 },
      ...[0.08, 0.17, 0.24, 0.33].map((at): Tone => ({
        wave: 'noise',
        at,
        dur: 0.04,
        gain: 0.25,
        filter: { type: 'highpass', freq: 3000 },
      })),
    ],
  },
  water: {
    tones: [
      ...[0, 0.08, 0.15].map((at, i): Tone => ({
        wave: 'sine',
        at,
        dur: 0.09,
        freq: [300 + i * 80, 900 + i * 200],
        gain: 0.3,
      })),
      {
        wave: 'noise',
        at: 0.22,
        dur: 0.3,
        gain: 0.28,
        attack: 0.01,
        filter: { type: 'lowpass', freq: [3000, 500] },
      },
    ],
  },
  nature: {
    tones: [
      ...[0, 0.07, 0.15, 0.22].map((at, i): Tone => ({
        wave: 'noise',
        at,
        dur: 0.08,
        gain: 0.22,
        filter: { type: 'bandpass', freq: 2500 + (i % 2) * 1200, q: 3 },
      })),
      { wave: 'triangle', dur: 0.35, freq: [440, 660, 587], gain: 0.16, attack: 0.03 },
    ],
  },
  electric: {
    tones: [
      {
        wave: 'square',
        dur: 0.3,
        freq: [1600, 400],
        gain: 0.12,
        vibrato: { rate: 45, depth: 400 },
      },
      { wave: 'sawtooth', dur: 0.32, freq: 90, gain: 0.12, vibrato: { rate: 30, depth: 200 } },
      {
        wave: 'noise',
        at: 0.2,
        dur: 0.12,
        gain: 0.25,
        filter: { type: 'highpass', freq: 2500 },
      },
    ],
  },
  ice: {
    tones: [
      ...[2093, 2637, 3136, 2349].map((f, i): Tone => ({
        wave: 'sine',
        at: i * 0.06,
        dur: 0.25,
        freq: f,
        gain: 0.14,
      })),
      {
        wave: 'noise',
        dur: 0.4,
        gain: 0.12,
        attack: 0.05,
        filter: { type: 'highpass', freq: [5000, 8000] },
      },
    ],
  },
  earth: {
    tones: [
      { wave: 'sine', dur: 0.35, freq: [130, 45], gain: 0.5 },
      {
        wave: 'noise',
        dur: 0.45,
        gain: 0.35,
        attack: 0.02,
        filter: { type: 'lowpass', freq: [900, 200] },
      },
      {
        wave: 'noise',
        at: 0.18,
        dur: 0.2,
        gain: 0.2,
        filter: { type: 'lowpass', freq: 600 },
      },
    ],
  },
  wind: {
    tones: [
      {
        wave: 'noise',
        dur: 0.5,
        gain: 0.9,
        attack: 0.12,
        filter: { type: 'bandpass', freq: [400, 1800, 700], q: 5 },
      },
      {
        wave: 'noise',
        at: 0.08,
        dur: 0.4,
        gain: 0.5,
        attack: 0.1,
        pan: 0.4,
        filter: { type: 'bandpass', freq: [700, 2600, 900], q: 6 },
      },
    ],
  },
  metal: {
    tones: [
      {
        wave: 'noise',
        dur: 0.12,
        gain: 0.3,
        filter: { type: 'highpass', freq: [2000, 6000] },
      },
      { wave: 'sine', at: 0.08, dur: 0.4, freq: 880, gain: 0.16 },
      { wave: 'sine', at: 0.08, dur: 0.3, freq: 880 * 2.76, gain: 0.08 },
      { wave: 'square', at: 0.08, dur: 0.05, freq: 1760, gain: 0.06 },
    ],
  },
  status: {
    tones: [
      ...notes(
        [
          [79, 1],
          [83, 1],
          [86, 1],
          [91, 2],
        ],
        { wave: 'triangle', beat: 0.06, gain: 0.18 },
      ),
      {
        wave: 'noise',
        dur: 0.35,
        gain: 0.08,
        attack: 0.08,
        filter: { type: 'highpass', freq: 6000 },
      },
    ],
  },
};

const moveSfx = Object.fromEntries(
  Object.entries(MOVE).map(([type, spec]) => [`move.${type}`, spec]),
) as Record<`move.${TypeId | 'status'}`, SoundSpec>;

// ---------------------------------------------------------------- battle

const battle = {
  'battle.hit': {
    tones: [
      { wave: 'noise', dur: 0.12, gain: 0.4, filter: { type: 'lowpass', freq: [4000, 600] } },
      { wave: 'square', dur: 0.1, freq: [200, 70], gain: 0.16 },
    ],
  },
  'battle.hitStrong': {
    tones: [
      { wave: 'noise', dur: 0.2, gain: 0.5, filter: { type: 'lowpass', freq: [6000, 400] } },
      { wave: 'square', dur: 0.16, freq: [240, 50], gain: 0.2 },
      { wave: 'sine', dur: 0.25, freq: [110, 40], gain: 0.45 },
    ],
  },
  'battle.hitWeak': {
    tones: [
      { wave: 'noise', dur: 0.07, gain: 0.22, filter: { type: 'bandpass', freq: 1800, q: 2 } },
      { wave: 'square', dur: 0.06, freq: [330, 220], gain: 0.08 },
    ],
  },
  'battle.miss': {
    tones: [
      {
        wave: 'noise',
        dur: 0.22,
        gain: 0.5,
        attack: 0.05,
        filter: { type: 'bandpass', freq: [2400, 900], q: 4 },
      },
    ],
  },
  'battle.fumble': {
    tones: [
      { wave: 'square', dur: 0.12, freq: [700, 180], gain: 0.1, vibrato: { rate: 40, depth: 300 } },
      { wave: 'noise', at: 0.1, dur: 0.08, gain: 0.15, filter: { type: 'highpass', freq: 3000 } },
    ],
  },
  'battle.skipped': {
    tones: [
      { wave: 'triangle', dur: 0.12, freq: [392, 330], gain: 0.2 },
      { wave: 'triangle', at: 0.13, dur: 0.18, freq: [330, 262], gain: 0.2 },
    ],
  },
  'battle.reaction': {
    tones: [
      ...notes(
        [
          [72, 1],
          [79, 1],
          [84, 1],
          [88, 3],
        ],
        { beat: 0.05, gain: 0.15 },
      ),
      ...bass([[72, 6]], { beat: 0.05, gain: 0.25 }),
      {
        wave: 'noise',
        dur: 0.4,
        gain: 0.25,
        filter: { type: 'bandpass', freq: [800, 5000], q: 1 },
      },
    ],
  },
  'battle.armorBreak': {
    tones: [
      { wave: 'noise', dur: 0.5, gain: 0.3, filter: { type: 'highpass', freq: [1500, 4000] } },
      ...[1245, 1661, 2217, 1480].map((f, i): Tone => ({
        wave: 'sine',
        at: 0.03 + i * 0.05,
        dur: 0.3,
        freq: f,
        gain: 0.12,
      })),
      { wave: 'sine', dur: 0.3, freq: [90, 40], gain: 0.3 },
    ],
  },
  'battle.armorRestore': {
    tones: [
      { wave: 'sine', dur: 0.35, freq: [440, 880], gain: 0.2, attack: 0.1 },
      { wave: 'sine', dur: 0.35, freq: [660, 1320], gain: 0.12, attack: 0.1 },
      { wave: 'square', at: 0.32, dur: 0.08, freq: 1760, gain: 0.06 },
    ],
  },
  'battle.condition': {
    tones: [
      { wave: 'triangle', dur: 0.2, freq: [523, 1046], gain: 0.2 },
      {
        wave: 'sine',
        at: 0.06,
        dur: 0.25,
        freq: [784, 1568],
        gain: 0.12,
        vibrato: { rate: 9, depth: 40 },
      },
    ],
  },
  'battle.conditionBlocked': {
    tones: [
      { wave: 'square', dur: 0.08, freq: 523, gain: 0.08 },
      { wave: 'triangle', at: 0.05, dur: 0.2, freq: [262, 196], gain: 0.25 },
    ],
  },
  'battle.statusTick': {
    tones: [
      { wave: 'square', dur: 0.08, freq: [300, 200], gain: 0.1 },
      { wave: 'noise', dur: 0.1, gain: 0.15, filter: { type: 'lowpass', freq: 1500 } },
    ],
  },
  'battle.heal': {
    tones: [
      ...notes(
        [
          [72, 1],
          [76, 1],
          [79, 1],
          [84, 1],
          [88, 2],
        ],
        { wave: 'triangle', beat: 0.06, gain: 0.25 },
      ),
      { wave: 'sine', dur: 0.4, freq: [1046, 2093], gain: 0.06, attack: 0.1 },
    ],
  },
  'battle.statusEnded': {
    tones: [{ wave: 'triangle', dur: 0.15, freq: [880, 1320], gain: 0.15 }],
  },
  'battle.sendOut': {
    tones: [
      {
        wave: 'noise',
        dur: 0.18,
        gain: 0.4,
        attack: 0.03,
        filter: { type: 'bandpass', freq: [800, 3000], q: 2 },
      },
      { wave: 'square', at: 0.1, dur: 0.06, freq: [800, 1600], gain: 0.1 },
    ],
  },
  'battle.switchOut': {
    tones: [
      { wave: 'triangle', dur: 0.25, freq: [880, 220], gain: 0.2 },
      {
        wave: 'noise',
        dur: 0.22,
        gain: 0.12,
        attack: 0.05,
        filter: { type: 'bandpass', freq: [2500, 600], q: 2 },
      },
    ],
  },
  'battle.faint': {
    tones: [
      { wave: 'square', dur: 0.55, freq: [600, 330, 90], gain: 0.12, hold: 0.2 },
      { wave: 'triangle', dur: 0.6, freq: [300, 160, 45], gain: 0.25, hold: 0.2 },
    ],
  },
  'battle.subdued': {
    tones: [
      { wave: 'sine', dur: 0.5, freq: [180, 60], gain: 0.5 },
      { wave: 'noise', dur: 0.5, gain: 0.25, filter: { type: 'lowpass', freq: [1200, 150] } },
      {
        wave: 'triangle',
        at: 0.25,
        dur: 0.4,
        freq: 98,
        gain: 0.2,
        vibrato: { rate: 5, depth: 50 },
      },
    ],
  },
  'battle.item': {
    tones: [
      { wave: 'triangle', dur: 0.08, freq: 1175, gain: 0.18 },
      { wave: 'triangle', at: 0.07, dur: 0.14, freq: 1568, gain: 0.18 },
      { wave: 'noise', dur: 0.15, gain: 0.07, filter: { type: 'highpass', freq: 6000 } },
    ],
  },
  'battle.throw': {
    tones: [
      {
        wave: 'noise',
        dur: 0.4,
        gain: 0.5,
        attack: 0.08,
        filter: { type: 'bandpass', freq: [600, 2200, 800], q: 3 },
      },
      { wave: 'triangle', dur: 0.4, freq: [300, 700, 400], gain: 0.14 },
    ],
  },
  'battle.absorb': {
    tones: [
      {
        wave: 'sawtooth',
        dur: 0.25,
        freq: [200, 1600],
        gain: 0.08,
        filter: { type: 'lowpass', freq: 3000 },
      },
      { wave: 'sine', dur: 0.25, freq: [400, 2400], gain: 0.15 },
      { wave: 'square', at: 0.24, dur: 0.05, freq: 2093, gain: 0.07 },
    ],
  },
  'battle.drop': {
    tones: [
      { wave: 'sine', dur: 0.08, freq: [400, 180], gain: 0.35 },
      { wave: 'sine', at: 0.1, dur: 0.06, freq: [330, 180], gain: 0.18 },
    ],
  },
  'battle.wobble': {
    tones: [
      { wave: 'square', dur: 0.03, freq: 1046, gain: 0.08 },
      { wave: 'sine', at: 0.12, dur: 0.06, freq: [300, 200], gain: 0.25 },
      { wave: 'square', at: 0.2, dur: 0.03, freq: 932, gain: 0.07 },
    ],
  },
  'battle.caught': {
    tones: [
      ...notes(
        [
          [79, 1],
          [84, 1],
          [88, 1],
          [91, 3],
        ],
        { beat: 0.08, gain: 0.15 },
      ),
      ...bass(
        [
          [67, 3],
          [72, 3],
        ],
        { beat: 0.08 },
      ),
    ],
  },
  'battle.breakFree': {
    tones: [
      {
        wave: 'noise',
        dur: 0.15,
        gain: 0.35,
        filter: { type: 'bandpass', freq: [1000, 4000], q: 1 },
      },
      { wave: 'square', dur: 0.12, freq: [300, 900], gain: 0.12 },
      { wave: 'triangle', at: 0.1, dur: 0.2, freq: [700, 350], gain: 0.15 },
    ],
  },
  'battle.run': {
    tones: [0, 0.07, 0.14, 0.21].map((at, i): Tone => ({
      wave: 'noise',
      at,
      dur: 0.05,
      gain: 0.5 - i * 0.08,
      pan: i % 2 ? 0.3 : -0.3,
      filter: { type: 'bandpass', freq: 1800, q: 2 },
    })),
  },
  'battle.victory': {
    tones: [
      ...notes(
        [
          [72, 1],
          [72, 1],
          [72, 1],
          [76, 3],
          [74, 1],
          [76, 1],
          [79, 6],
        ],
        { beat: 0.09, gain: 0.14 },
      ),
      ...bass(
        [
          [60, 3],
          [64, 3],
          [67, 2],
          [67, 6],
        ],
        { beat: 0.09 },
      ),
    ],
  },
  'battle.defeat': {
    tones: [
      ...notes(
        [
          [67, 2],
          [66, 2],
          [65, 2],
          [64, 6],
        ],
        { wave: 'triangle', beat: 0.14, gain: 0.25 },
      ),
      ...bass([[52, 12]], { beat: 0.14, gain: 0.18 }),
    ],
  },
  'battle.levelUp': {
    tones: notes(
      [
        [72, 1],
        [76, 1],
        [79, 1],
        [84, 1],
        [null, 1],
        [79, 1],
        [84, 3],
      ],
      { beat: 0.07, gain: 0.14 },
    ),
  },
  'battle.learned': {
    tones: notes(
      [
        [76, 1],
        [79, 1],
        [83, 2],
      ],
      { wave: 'triangle', beat: 0.08, gain: 0.25 },
    ),
  },
} satisfies Record<string, SoundSpec>;

// ---------------------------------------------------------------- overworld

const world = {
  'world.encounter': {
    tones: [
      { wave: 'square', dur: 0.06, freq: 1568, gain: 0.12 },
      { wave: 'square', at: 0.07, dur: 0.14, freq: 2093, gain: 0.12 },
    ],
  },
  'world.battleStart': {
    tones: [
      {
        wave: 'noise',
        dur: 0.6,
        gain: 0.55,
        attack: 0.2,
        filter: { type: 'bandpass', freq: [300, 3000], q: 2 },
      },
      { wave: 'sawtooth', dur: 0.6, freq: [110, 440], gain: 0.12, attack: 0.1 },
    ],
  },
  'world.bump': {
    tones: [{ wave: 'sine', dur: 0.07, freq: [160, 90], gain: 0.3 }],
  },
  'world.heal': {
    tones: [
      ...notes(
        [
          [72, 2],
          [76, 2],
          [79, 2],
          [77, 1],
          [76, 1],
          [74, 2],
          [79, 2],
          [84, 4],
        ],
        { wave: 'triangle', beat: 0.1, gain: 0.25 },
      ),
      ...bass(
        [
          [60, 6],
          [65, 4],
          [67, 2],
          [60, 4],
        ],
        { wave: 'sine', beat: 0.1, gain: 0.25 },
      ),
    ],
  },
  'world.buy': {
    tones: [
      { wave: 'square', dur: 0.06, freq: 1976, gain: 0.08 },
      { wave: 'square', at: 0.06, dur: 0.2, freq: 2637, gain: 0.08 },
    ],
  },
  'world.save': {
    tones: notes(
      [
        [84, 1],
        [79, 1],
        [88, 2],
      ],
      { wave: 'triangle', beat: 0.08, gain: 0.22 },
    ),
  },
  'world.evolve': {
    tones: [
      {
        wave: 'sine',
        dur: 3,
        freq: [220, 440, 1760],
        gain: 0.2,
        attack: 0.5,
        hold: 0.7,
        vibrato: { rate: 6, depth: 30 },
      },
      { wave: 'triangle', dur: 3, freq: [330, 660, 2637], gain: 0.08, attack: 0.5, hold: 0.7 },
      ...notes(
        [
          [84, 1],
          [88, 1],
          [91, 1],
          [96, 4],
        ],
        { beat: 0.09, gain: 0.13, at: 3.1 },
      ),
    ],
  },
} satisfies Record<string, SoundSpec>;

export const SFX = { ...ui, ...moveSfx, ...battle, ...world };
export type SfxId = keyof typeof SFX;

export function moveSfxId(type: TypeId | undefined, status: boolean): SfxId {
  return status || !type ? 'move.status' : `move.${type}`;
}
