/**
 * Songs: looping, step-sequenced music as plain data (C25).
 *
 * A `Song` is a grid of steps (`stepsPerBeat` per beat, `length` steps per loop) and a list of
 * tracks. Each track plays one `Instrument` and holds notes (start step, length in steps, MIDI
 * pitch, velocity). An instrument is a list of voices, each a `Tone` template that a note
 * fills in with its pitch and length. Everything here is pure, so songs can be generated,
 * checked and tested without Web Audio; `MusicPlayer` plays them.
 *
 * Hand-written music uses two small text formats (`parseNotes`, `parseHits`).
 */

import { clampFreq, curvePoints, midiHz, type Curve, type SoundSpec, type Tone } from './spec';

/** One oscillator (or noise) of an instrument. A note fills in pitch and length. */
export interface InstrumentVoice extends Omit<Tone, 'dur' | 'freq'> {
  /** Pitch as multipliers of the note's frequency, over the tone. Default 1. */
  readonly pitch?: Curve;
  /** Fixed length in seconds (drums, plucks). Default: the note's length + `release`. */
  readonly length?: number;
  /** Seconds the tone rings past the note's length. Default 0.08. */
  readonly release?: number;
}

export interface Instrument {
  readonly voices: readonly InstrumentVoice[];
}

export interface SongNote {
  readonly step: number;
  /** Length in steps. */
  readonly len: number;
  /** MIDI note number (60 = C4). */
  readonly pitch: number;
  /** Velocity 0–1. Default 1. */
  readonly vel?: number;
}

export interface SongTrack {
  readonly instrument: string;
  readonly notes: readonly SongNote[];
  /** Default 1. */
  readonly gain?: number;
  /** −1 to 1. Default 0. */
  readonly pan?: number;
}

export interface Song {
  /** Stable id: the player keeps each song's position by it. */
  readonly id: string;
  readonly bpm: number;
  readonly stepsPerBeat: number;
  readonly beatsPerBar: number;
  /** Steps in one loop. */
  readonly length: number;
  readonly instruments: Readonly<Record<string, Instrument>>;
  readonly tracks: readonly SongTrack[];
  /** Delay of every second step, as a part of a step (0 = straight). Default 0. */
  readonly swing?: number;
  /** Overall gain. Default 1. */
  readonly gain?: number;
}

export function stepSeconds(song: Song): number {
  return 60 / song.bpm / song.stepsPerBeat;
}

export function barSteps(song: Song): number {
  return song.stepsPerBeat * song.beatsPerBar;
}

/** Length of one loop in seconds. */
export function songSeconds(song: Song): number {
  return song.length * stepSeconds(song);
}

/** Time of a step from the loop's start, swing included. */
export function stepTime(song: Song, step: number): number {
  const odd = step % 2 === 1 ? (song.swing ?? 0) : 0;
  return (step + odd) * stepSeconds(song);
}

export interface StepNote {
  readonly track: SongTrack;
  readonly note: SongNote;
}

/** Notes by start step (index = step in the loop). Build once per song. */
export function indexSong(song: Song): readonly (readonly StepNote[])[] {
  const out: StepNote[][] = Array.from({ length: song.length }, () => []);
  for (const track of song.tracks) {
    for (const note of track.notes) {
      if (note.step >= 0 && note.step < song.length) out[note.step]?.push({ track, note });
    }
  }
  return out;
}

/** The tones of one note on an instrument, starting at 0. */
export function noteSpec(
  instrument: Instrument,
  pitch: number,
  seconds: number,
  vel = 1,
): SoundSpec {
  const hz = midiHz(pitch);
  const tones: Tone[] = instrument.voices.map((v) => {
    const { pitch: mult = 1, length, release = 0.08, gain = 0.5, ...rest } = v;
    const freq = curvePoints(mult).map((m) => clampFreq(hz * m));
    return {
      ...rest,
      freq: freq.length === 1 ? (freq[0] ?? hz) : freq,
      dur: length ?? seconds + release,
      gain: gain * vel,
    };
  });
  return { tones };
}

/** Where each track's notes sit, and whether the song is well formed. */
export function songProblems(song: Song): string[] {
  const out: string[] = [];
  if (!(song.bpm > 0)) out.push('bpm must be positive');
  if (!(song.length > 0)) out.push('length must be positive');
  song.tracks.forEach((t, i) => {
    if (!song.instruments[t.instrument])
      out.push(`track ${i}: unknown instrument "${t.instrument}"`);
    for (const n of t.notes) {
      if (n.step < 0 || n.step >= song.length || n.len <= 0) {
        out.push(`track ${i}: note at step ${n.step} (len ${n.len}) is outside the loop`);
        break;
      }
    }
  });
  return out;
}

// ─── Text formats ───────────────────────────────────────────────────────────────────────

export class NoteParseError extends Error {
  constructor(
    message: string,
    readonly token: number,
  ) {
    super(message);
    this.name = 'NoteParseError';
  }
}

export interface ParsedTrack {
  readonly notes: SongNote[];
  /** Steps the text covers (rests included). */
  readonly steps: number;
}

const NOTE_NAMES: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** MIDI number of a note name like `C4`, `F#3`, `Bb2`. Undefined if it isn't one. */
export function noteNumber(name: string): number | undefined {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) return undefined;
  const base = NOTE_NAMES[m[1] ?? ''] ?? 0;
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + base + acc;
}

/**
 * Parses a melody line. Tokens are separated by spaces:
 * - `C4`, `F#3`, `Bb2`: a note; `C4+E4+G4`: a chord; `.`: a rest.
 * - `:n` after a token sets its length in steps (`E5:4`). The length carries on to the
 *   following tokens until another one is given. The first default is 1.
 * - `!` after a token plays it accented, `?` softly (`C4:2!`).
 * - `|` marks a bar; it is ignored, and only makes lines easier to read.
 */
export function parseNotes(text: string): ParsedTrack {
  const notes: SongNote[] = [];
  let step = 0;
  let len = 1;
  const tokens = text.split(/\s+/).filter((t) => t && t !== '|');
  tokens.forEach((raw, i) => {
    const m = /^([^:!?]+)(?::(\d+))?([!?])?$/.exec(raw);
    if (!m) throw new NoteParseError(`Can't read "${raw}"`, i);
    if (m[2] !== undefined) {
      len = Number(m[2]);
      if (len < 1 || len > 256) throw new NoteParseError(`Length of "${raw}" must be 1–256`, i);
    }
    const vel = m[3] === '!' ? 1 : m[3] === '?' ? 0.55 : 0.8;
    const head = m[1] ?? '';
    if (head !== '.') {
      for (const name of head.split('+')) {
        const pitch = noteNumber(name);
        if (pitch === undefined) throw new NoteParseError(`"${name}" is not a note`, i);
        notes.push({ step, len, pitch, vel });
      }
    }
    step += len;
  });
  return { notes, steps: step };
}

/**
 * Parses a drum line: one character per step. `x` hits, `o` hits softly, `.` rests; spaces
 * and `|` are ignored. Every hit has length 1 and `pitch`.
 */
export function parseHits(text: string, pitch: number): ParsedTrack {
  const notes: SongNote[] = [];
  let step = 0;
  let token = 0;
  for (const c of text) {
    if (c === ' ' || c === '|' || c === '\n') continue;
    if (c === 'x' || c === 'o') notes.push({ step, len: 1, pitch, vel: c === 'x' ? 1 : 0.5 });
    else if (c !== '.') throw new NoteParseError(`"${c}" is not a hit (use x, o or .)`, token);
    step++;
    token++;
  }
  return { notes, steps: step };
}

/** Repeats a track's notes to fill `length` steps (a 1-bar drum line in an 8-bar song). */
export function loopNotes(notes: readonly SongNote[], steps: number, length: number): SongNote[] {
  if (steps <= 0) return [];
  const out: SongNote[] = [];
  for (let off = 0; off < length; off += steps) {
    for (const n of notes) {
      if (off + n.step < length) out.push({ ...n, step: off + n.step });
    }
  }
  return out;
}
