/**
 * Procedural composer (C25): turns an `Arrangement` (key, mode, tempo, chord progressions,
 * instruments, patterns) and a seed into a looping `Song`. Pure and deterministic: the same
 * arrangement and seed always give the same notes.
 *
 * How a song is built:
 * - **Form.** Sections of 8 bars. Field music is A B A′ C (C is a break: no melody, the
 *   arpeggio carries it), battle music is A B. One chord per bar; each section plays its
 *   4-chord progression twice.
 * - **Melody.** A 2-bar motif, then the same motif moved to fit the next chords (so the ear
 *   hears it again), a new 2-bar idea, and a cadence. Rhythms come from small libraries of
 *   one-bar cells (calm or busy). Pitches walk the scale in small steps and land on chord
 *   tones on strong beats; a leap is followed by a step back. Sections end on the tonic
 *   (or the fifth, halfway).
 * - **Accompaniment.** Pad chords, a bass pattern, an optional arpeggio and drum patterns,
 *   with a fill at the end of each section.
 */

import { hashString, Rng } from '@engine/core';
import {
  parseHits,
  type Instrument,
  type Song,
  type SongNote,
  type SongTrack,
} from '@engine/audio';
import { DRUM_PITCH, INSTRUMENTS, MUSIC_MIX, type InstrumentId } from './instruments';

export const STEPS_PER_BEAT = 4;
export const BEATS_PER_BAR = 4;
export const BAR = STEPS_PER_BEAT * BEATS_PER_BAR;
export const SECTION_BARS = 8;

export type BassPattern = 'roots' | 'walk' | 'pulse' | 'octaves' | 'gallop' | 'drone';
export type ArpPattern = 'up' | 'updown' | 'broken';
export type Form = 'field' | 'battle';

export interface Arrangement {
  readonly bpm: number;
  /** MIDI note of the tonic in the melody's octave. */
  readonly root: number;
  /** Seven semitone offsets from the tonic. */
  readonly scale: readonly number[];
  /** Progressions of 4 scale degrees (0 = tonic): [0] for A sections, [1] for B. */
  readonly progressions: readonly (readonly number[])[];
  readonly form: Form;
  readonly swing?: number;
  readonly gain?: number;
  readonly lead: {
    readonly instrument: InstrumentId;
    /** 0 = calm, 1 = busy. */
    readonly density: number;
    /** Lowest and highest scale degree (0 = `root`). */
    readonly range: readonly [number, number];
    readonly gain?: number;
  };
  /** A second line a third under the melody in B and A′. */
  readonly counter?: { readonly instrument: InstrumentId; readonly gain?: number };
  readonly pad?: {
    readonly instrument: InstrumentId;
    /** Semitones from `root`. */
    readonly octave: number;
    readonly sevenths?: boolean;
    /** `hold` = one chord per bar, `stabs` = short off-beat chords. */
    readonly style?: 'hold' | 'stabs';
    readonly gain?: number;
  };
  readonly bass: {
    readonly instrument: InstrumentId;
    readonly octave: number;
    readonly pattern: BassPattern;
    readonly gain?: number;
  };
  readonly arp?: {
    readonly instrument: InstrumentId;
    readonly octave: number;
    /** Steps per note (1 = sixteenths). */
    readonly rate: number;
    readonly pattern: ArpPattern;
    /** Plays from this section on (0 = A). Default 0. */
    readonly from?: number;
    readonly gain?: number;
  };
  /** One-bar drum lines (16 characters, see `parseHits`). */
  readonly drums?: readonly {
    readonly instrument: InstrumentId;
    readonly hits: string;
    /** Plays from this section on. Default 0. */
    readonly from?: number;
    readonly gain?: number;
  }[];
  /** A snare/tom fill in the last bar of each section. */
  readonly fills?: boolean;
}

interface Section {
  readonly kind: 'A' | 'B' | "A'" | 'C';
  readonly chords: readonly number[];
  /** The last section ends on the tonic; the others on the fifth or the tonic. */
  readonly end: 'tonic' | 'fifth';
}

/** Composes a song. `id` names it (and seeds it unless `seed` is given). */
export function composeSong(id: string, a: Arrangement, seed: number = hashString(id)): Song {
  const rng = new Rng(seed);
  const sections = formOf(a);
  const length = sections.length * SECTION_BARS * BAR;
  const lead: SongNote[] = [];
  const counter: SongNote[] = [];
  const pad: SongNote[] = [];
  const bass: SongNote[] = [];
  const arp: SongNote[] = [];
  const fills: SongNote[] = [];

  // Motifs are written once and reused, so the A sections share a melody.
  const motifs = new Map<string, Phrase>();
  sections.forEach((s, i) => {
    const at = i * SECTION_BARS * BAR;
    const bars = Array.from({ length: SECTION_BARS }, (_, b) => s.chords[b % s.chords.length] ?? 0);
    if (s.kind !== 'C') {
      const melody = sectionMelody(rng.split(`melody:${s.kind}:${i}`), a, s, bars, motifs);
      for (const n of melody) lead.push(shift(n, at, a));
      if (a.counter && s.kind !== 'A') {
        for (const n of melody) counter.push(shift({ ...n, deg: n.deg - 2, vel: 0.7 }, at, a));
      }
    }
    bars.forEach((deg, b) => {
      const t = at + b * BAR;
      const next = bars[b + 1] ?? sections[i + 1]?.chords[0] ?? bars[0] ?? 0;
      if (a.pad) pad.push(...padBar(a, deg, t));
      bass.push(...bassBar(a, deg, next, t, rng));
      if (a.arp && i >= (a.arp.from ?? 0)) arp.push(...arpBar(a, deg, t));
    });
    if (a.fills) fills.push(...fillBar(at + (SECTION_BARS - 1) * BAR, a.form));
  });

  const instruments: Record<string, Instrument> = {};
  const tracks: SongTrack[] = [];
  const add = (inst: InstrumentId, notes: SongNote[], gain = 1, pan = 0): void => {
    if (!notes.length) return;
    instruments[inst] = INSTRUMENTS[inst];
    tracks.push({ instrument: inst, notes, gain, ...(pan ? { pan } : {}) });
  };
  add(a.lead.instrument, lead, a.lead.gain ?? 1);
  if (a.counter) add(a.counter.instrument, counter, (a.counter.gain ?? 1) * 0.6, -0.25);
  if (a.pad) add(a.pad.instrument, pad, a.pad.gain ?? 1);
  add(a.bass.instrument, bass, a.bass.gain ?? 1);
  if (a.arp) add(a.arp.instrument, arp, a.arp.gain ?? 1, 0.3);
  for (const d of a.drums ?? []) {
    const pitch = DRUM_PITCH[d.instrument] ?? 60;
    const one = parseHits(d.hits, pitch).notes;
    const notes: SongNote[] = [];
    sections.forEach((_, i) => {
      if (i < (d.from ?? 0)) return;
      for (let b = 0; b < SECTION_BARS; b++) {
        const t = (i * SECTION_BARS + b) * BAR;
        // The fill replaces the snare in the last bar of a section.
        if (a.fills && b === SECTION_BARS - 1 && d.instrument === 'snare') continue;
        for (const n of one) notes.push({ ...n, step: t + n.step });
      }
    });
    add(d.instrument, notes, d.gain ?? 1);
  }
  if (fills.length) {
    const snare = fills.filter((n) => n.pitch === SNARE);
    const tom = fills.filter((n) => n.pitch !== SNARE);
    if (snare.length) {
      instruments['snare'] = INSTRUMENTS.snare;
      tracks.push({ instrument: 'snare', notes: snare, gain: 0.9 });
    }
    if (tom.length) {
      instruments['tom'] = INSTRUMENTS.tom;
      tracks.push({ instrument: 'tom', notes: tom, gain: 0.8 });
    }
  }

  return {
    id,
    bpm: a.bpm,
    stepsPerBeat: STEPS_PER_BEAT,
    beatsPerBar: BEATS_PER_BAR,
    length,
    instruments,
    tracks,
    ...(a.swing ? { swing: a.swing } : {}),
    gain: (a.gain ?? 1) * MUSIC_MIX,
  };
}

function formOf(a: Arrangement): Section[] {
  const pa = a.progressions[0] ?? [0, 4, 5, 3];
  const pb = a.progressions[1] ?? pa;
  if (a.form === 'battle') {
    return [
      { kind: 'A', chords: pa, end: 'fifth' },
      { kind: 'B', chords: pb, end: 'tonic' },
    ];
  }
  return [
    { kind: 'A', chords: pa, end: 'fifth' },
    { kind: 'B', chords: pb, end: 'fifth' },
    { kind: "A'", chords: pa, end: 'tonic' },
    { kind: 'C', chords: pa, end: 'tonic' },
  ];
}

// ─── Pitch helpers ──────────────────────────────────────────────────────────────────────

/** MIDI pitch of a scale degree (any integer; 7 = the tonic an octave up). */
export function degreePitch(a: Arrangement, deg: number, octave = 0): number {
  const oct = Math.floor(deg / 7);
  const i = deg - oct * 7;
  return a.root + octave + oct * 12 + (a.scale[i] ?? 0);
}

/** The scale degrees of a chord (root, third, fifth and, optionally, seventh). */
function chordDegrees(deg: number, sevenths = false): number[] {
  return sevenths ? [deg, deg + 2, deg + 4, deg + 6] : [deg, deg + 2, deg + 4];
}

/** True if `deg` is a chord tone of the chord on `chord` (any octave). */
function inChord(deg: number, chord: number): boolean {
  const d = (((deg - chord) % 7) + 7) % 7;
  return d === 0 || d === 2 || d === 4;
}

/** The chord tone nearest to `deg` inside the range. */
function nearestChordTone(deg: number, chord: number, lo: number, hi: number): number {
  for (let d = 0; d <= 4; d++) {
    for (const c of [deg - d, deg + d]) if (c >= lo && c <= hi && inChord(c, chord)) return c;
  }
  return Math.min(hi, Math.max(lo, deg));
}

// ─── Melody ─────────────────────────────────────────────────────────────────────────────

interface MelodyNote {
  readonly step: number;
  readonly len: number;
  readonly deg: number;
  readonly vel: number;
}
type Phrase = readonly MelodyNote[];

/** One-bar rhythm cells: [start, length] in sixteenths. */
const CALM: readonly (readonly (readonly [number, number])[])[] = [
  [
    [0, 6],
    [6, 2],
    [8, 8],
  ],
  [
    [0, 4],
    [4, 4],
    [8, 4],
    [12, 4],
  ],
  [
    [0, 8],
    [8, 4],
    [12, 4],
  ],
  [
    [0, 4],
    [4, 2],
    [6, 2],
    [8, 8],
  ],
  [
    [0, 6],
    [6, 2],
    [8, 6],
    [14, 2],
  ],
  [
    [0, 2],
    [2, 2],
    [4, 4],
    [8, 8],
  ],
  [
    [4, 4],
    [8, 4],
    [12, 4],
  ],
  [
    [0, 12],
    [12, 4],
  ],
];
const BUSY: readonly (readonly (readonly [number, number])[])[] = [
  [
    [0, 2],
    [2, 2],
    [4, 2],
    [6, 2],
    [8, 4],
    [12, 4],
  ],
  [
    [0, 3],
    [3, 3],
    [6, 2],
    [8, 2],
    [10, 2],
    [12, 4],
  ],
  [
    [0, 4],
    [4, 2],
    [6, 2],
    [8, 2],
    [10, 2],
    [12, 2],
    [14, 2],
  ],
  [
    [0, 6],
    [6, 2],
    [8, 2],
    [10, 2],
    [12, 4],
  ],
  [
    [0, 2],
    [2, 4],
    [6, 2],
    [8, 4],
    [12, 2],
    [14, 2],
  ],
  [
    [0, 4],
    [4, 4],
    [8, 2],
    [10, 2],
    [12, 4],
  ],
];
const CADENCE_CALM: readonly (readonly (readonly [number, number])[])[] = [
  [
    [0, 4],
    [4, 4],
    [8, 8],
  ],
  [
    [0, 8],
    [8, 8],
  ],
  [[0, 16]],
];
const CADENCE_BUSY: readonly (readonly (readonly [number, number])[])[] = [
  [
    [0, 4],
    [4, 4],
    [8, 8],
  ],
  [
    [0, 2],
    [2, 2],
    [4, 4],
    [8, 8],
  ],
  [
    [0, 3],
    [3, 3],
    [6, 2],
    [8, 8],
  ],
];

function rhythm(
  rng: Rng,
  density: number,
  cadence: boolean,
): readonly (readonly [number, number])[] {
  const busy = rng.next() < density;
  const set = cadence ? (busy ? CADENCE_BUSY : CADENCE_CALM) : busy ? BUSY : CALM;
  return rng.pick(set);
}

/** Pitches for a rhythm over the given chords, walking from `start`. */
function walk(
  rng: Rng,
  a: Arrangement,
  cells: readonly (readonly (readonly [number, number])[])[],
  chords: readonly number[],
  start: number,
  endOn?: number,
): MelodyNote[] {
  const [lo, hi] = a.lead.range;
  const out: MelodyNote[] = [];
  let deg = start;
  let dir = rng.chance(0.5) ? 1 : -1;
  let leapt = 0;
  cells.forEach((cell, b) => {
    const chord = chords[b] ?? 0;
    cell.forEach(([s, len], k) => {
      const strong = s % 8 === 0;
      const last = b === cells.length - 1 && k === cell.length - 1;
      if (out.length) {
        if (leapt) {
          deg -= leapt > 0 ? 1 : -1; // step back after a leap
          leapt = 0;
        } else {
          const r = rng.next();
          if (r < 0.62) deg += dir;
          else if (r < 0.82) deg += 2 * dir;
          else if (r < 0.9) {
            const l = (rng.chance(0.5) ? 3 : 4) * dir;
            deg += l;
            leapt = l;
          } else if (r < 0.96) dir = -dir;
          if (rng.chance(0.25)) dir = -dir;
        }
        if (deg > hi - 1) dir = -1;
        if (deg < lo + 1) dir = 1;
        deg = Math.min(hi, Math.max(lo, deg));
      }
      if (last && endOn !== undefined) {
        deg = nearestOf(deg, endOn, lo, hi);
      } else if (strong || len >= 8) {
        deg = nearestChordTone(deg, chord, lo, hi);
      }
      const vel = strong ? 0.9 : 0.72;
      out.push({ step: b * BAR + s, len, deg, vel });
    });
  });
  return out;
}

/** The degree `target` (any octave) nearest to `deg` inside the range. */
function nearestOf(deg: number, target: number, lo: number, hi: number): number {
  let best = target;
  let dist = Infinity;
  for (let o = -3; o <= 3; o++) {
    const c = target + o * 7;
    if (c >= lo && c <= hi && Math.abs(c - deg) < dist) {
      best = c;
      dist = Math.abs(c - deg);
    }
  }
  return best;
}

/** Moves a phrase onto new chords: same rhythm and contour, strong beats on chord tones. */
function transpose(p: Phrase, a: Arrangement, chords: readonly number[]): MelodyNote[] {
  const [lo, hi] = a.lead.range;
  const first = p[0];
  if (!first) return [];
  const target = nearestChordTone(first.deg, chords[0] ?? 0, lo, hi);
  let delta = target - first.deg;
  if (first.deg + delta > hi || first.deg + delta < lo) delta = 0;
  return p.map((n) => {
    let deg = Math.min(hi, Math.max(lo, n.deg + delta));
    const chord = chords[Math.floor(n.step / BAR)] ?? 0;
    if (n.step % 8 === 0) deg = nearestChordTone(deg, chord, lo, hi);
    return { ...n, deg };
  });
}

function sectionMelody(
  rng: Rng,
  a: Arrangement,
  s: Section,
  bars: readonly number[],
  motifs: Map<string, Phrase>,
): MelodyNote[] {
  const [lo, hi] = a.lead.range;
  const mid = Math.round((lo + hi) / 2);
  const key = s.kind === "A'" ? 'A' : s.kind;
  const density = a.lead.density + (s.kind === 'B' ? 0.15 : 0);
  const cells = (n: number, cadenceLast: boolean): (readonly (readonly [number, number])[])[] =>
    Array.from({ length: n }, (_, i) => rhythm(rng, density, cadenceLast && i === n - 1));

  // Bars 1–2: the motif (shared by A and A′).
  let m1 = motifs.get(key);
  if (!m1) {
    const start = s.kind === 'B' ? mid + 2 : mid;
    m1 = walk(
      rng,
      a,
      cells(2, false),
      bars.slice(0, 2),
      nearestChordTone(start, bars[0] ?? 0, lo, hi),
    );
    motifs.set(key, m1);
  }
  // Bars 3–4: the motif again on the next chords.
  const m1b = transpose(m1, a, bars.slice(2, 4));
  // Bars 5–6: a new idea (A′ varies it), bars 7–8: cadence.
  const after = m1b[m1b.length - 1]?.deg ?? mid;
  const m2Key = `${key}:m2`;
  let m2 = s.kind === "A'" ? undefined : motifs.get(m2Key);
  if (!m2) {
    m2 = walk(rng, a, cells(2, false), bars.slice(4, 6), after + (rng.chance(0.5) ? 1 : -1));
    if (s.kind !== "A'") motifs.set(m2Key, m2);
  }
  const before = m2[m2.length - 1]?.deg ?? mid;
  const endDeg = s.end === 'tonic' ? 0 : 4;
  const cadence = walk(rng, a, cells(2, true), bars.slice(6, 8), before, endDeg);

  return [
    ...m1,
    ...m1b.map((n) => ({ ...n, step: n.step + 2 * BAR })),
    ...m2.map((n) => ({ ...n, step: n.step + 4 * BAR })),
    ...cadence.map((n) => ({ ...n, step: n.step + 6 * BAR })),
  ];
}

function shift(n: MelodyNote, at: number, a: Arrangement): SongNote {
  return { step: at + n.step, len: n.len, pitch: degreePitch(a, n.deg), vel: n.vel };
}

// ─── Accompaniment ──────────────────────────────────────────────────────────────────────

function padBar(a: Arrangement, deg: number, t: number): SongNote[] {
  const pad = a.pad;
  if (!pad) return [];
  // Voice the chord inside one octave above the pad's base, starting from its root.
  const degs = chordDegrees(deg, pad.sevenths).map((d) => (d >= 7 ? d - 7 : d));
  const pitches = degs.map((d) => degreePitch(a, d, pad.octave));
  if (pad.style === 'stabs') {
    const out: SongNote[] = [];
    for (const s of [2, 6, 10, 14]) {
      for (const p of pitches) out.push({ step: t + s, len: 1, pitch: p, vel: 0.7 });
    }
    return out;
  }
  return pitches.map((p) => ({ step: t, len: BAR, pitch: p, vel: 0.8 }));
}

function bassBar(a: Arrangement, deg: number, next: number, t: number, rng: Rng): SongNote[] {
  const { octave, pattern } = a.bass;
  const root = degreePitch(a, ((deg % 7) + 7) % 7, octave);
  const fifth = degreePitch(a, (((deg % 7) + 7) % 7) + 4, octave);
  const third = degreePitch(a, (((deg % 7) + 7) % 7) + 2, octave);
  const note = (step: number, len: number, pitch: number, vel = 0.85): SongNote => ({
    step: t + step,
    len,
    pitch,
    vel,
  });
  switch (pattern) {
    case 'roots':
      return [note(0, 8, root), note(8, 6, rng.chance(0.5) ? fifth : root, 0.7)];
    case 'drone':
      return [note(0, BAR, root, 0.8)];
    case 'walk': {
      const target = degreePitch(a, ((next % 7) + 7) % 7, octave);
      const approach = target + (target > fifth ? -1 : target < root ? 1 : -2);
      return [
        note(0, 4, root),
        note(4, 4, third, 0.7),
        note(8, 4, fifth, 0.75),
        note(12, 4, approach, 0.7),
      ];
    }
    case 'pulse':
      return [0, 2, 4, 6, 8, 10, 12, 14].map((s) => note(s, 2, root, s % 4 === 0 ? 0.9 : 0.65));
    case 'octaves':
      return [0, 2, 4, 6, 8, 10, 12, 14].map((s) =>
        note(s, 2, s % 4 === 2 ? root + 12 : root, s % 4 === 0 ? 0.9 : 0.7),
      );
    case 'gallop':
      return [0, 3, 4, 6, 8, 11, 12, 14].map((s) =>
        note(s, s === 0 || s === 8 ? 3 : 1, s === 12 ? fifth : root, s % 8 === 0 ? 0.95 : 0.7),
      );
  }
}

function arpBar(a: Arrangement, deg: number, t: number): SongNote[] {
  const arp = a.arp;
  if (!arp) return [];
  const [r = 0, th = 2, f = 4] = chordDegrees(deg);
  const order: Record<ArpPattern, number[]> = {
    up: [r, th, f, r + 7],
    updown: [r, th, f, r + 7, f, th],
    broken: [r, f, th, f],
  };
  const seq = order[arp.pattern];
  const out: SongNote[] = [];
  for (let s = 0, i = 0; s < BAR; s += arp.rate, i++) {
    const d = seq[i % seq.length] ?? r;
    out.push({
      step: t + s,
      len: arp.rate,
      pitch: degreePitch(a, d, arp.octave),
      vel: s % 4 === 0 ? 0.8 : 0.6,
    });
  }
  return out;
}

const SNARE = DRUM_PITCH.snare ?? 50;
const TOM = DRUM_PITCH.tom ?? 45;

function fillBar(t: number, form: Form): SongNote[] {
  if (form === 'battle') {
    return [
      ...[8, 10].map((s) => ({ step: t + s, len: 1, pitch: TOM + 5, vel: 0.9 })),
      ...[11, 12].map((s) => ({ step: t + s, len: 1, pitch: TOM, vel: 0.9 })),
      ...[13, 14, 15].map((s) => ({
        step: t + s,
        len: 1,
        pitch: SNARE,
        vel: 0.6 + (s - 13) * 0.2,
      })),
      { step: t + 4, len: 1, pitch: SNARE, vel: 1 },
    ];
  }
  return [
    { step: t + 4, len: 1, pitch: SNARE, vel: 0.6 },
    { step: t + 12, len: 1, pitch: TOM + 3, vel: 0.6 },
    { step: t + 14, len: 1, pitch: TOM, vel: 0.6 },
  ];
}
