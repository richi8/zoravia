import { describe, expect, it } from 'vitest';
import {
  barSteps,
  indexSong,
  loopNotes,
  NoteParseError,
  noteNumber,
  noteSpec,
  parseHits,
  parseNotes,
  songProblems,
  songSeconds,
  stepTime,
  type Instrument,
  type Song,
} from './song';

const inst: Instrument = {
  voices: [
    { wave: 'triangle', gain: 0.4 },
    { wave: 'sine', pitch: [2, 1], gain: 0.2, length: 0.3 },
  ],
};

const song = (extra: Partial<Song> = {}): Song => ({
  id: 'test',
  bpm: 120,
  stepsPerBeat: 4,
  beatsPerBar: 4,
  length: 32,
  instruments: { lead: inst },
  tracks: [{ instrument: 'lead', notes: parseNotes('C4:4 E4 G4 C5 | .:8 G4:8').notes }],
  ...extra,
});

describe('note text', () => {
  it('reads note names', () => {
    expect(noteNumber('C4')).toBe(60);
    expect(noteNumber('A4')).toBe(69);
    expect(noteNumber('F#3')).toBe(54);
    expect(noteNumber('Bb2')).toBe(46);
    expect(noteNumber('C-1')).toBe(0);
    expect(noteNumber('H2')).toBeUndefined();
    expect(noteNumber('c4')).toBeUndefined();
  });

  it('parses notes, chords, rests, carried lengths and accents', () => {
    const p = parseNotes('C4:2 D4 | E4+G4:4! . F4?');
    expect(p.steps).toBe(2 + 2 + 4 + 4 + 4);
    expect(p.notes.map((n) => [n.step, n.len, n.pitch])).toEqual([
      [0, 2, 60],
      [2, 2, 62],
      [4, 4, 64],
      [4, 4, 67],
      [12, 4, 65],
    ]);
    expect(p.notes[2]?.vel).toBe(1);
    expect(p.notes[4]?.vel).toBeLessThan(p.notes[0]?.vel ?? 0);
  });

  it('reports what it cannot read', () => {
    expect(() => parseNotes('C4 X9')).toThrow(NoteParseError);
    expect(() => parseNotes('C4:0')).toThrow(/1–256/);
    try {
      parseNotes('C4 D4 Q');
    } catch (e) {
      expect((e as NoteParseError).token).toBe(2);
    }
  });

  it('parses drum lines and loops them', () => {
    const p = parseHits('x.o. | x...', 36);
    expect(p.steps).toBe(8);
    expect(p.notes.map((n) => [n.step, n.vel])).toEqual([
      [0, 1],
      [2, 0.5],
      [4, 1],
    ]);
    expect(() => parseHits('x-x', 36)).toThrow(NoteParseError);
    const looped = loopNotes(p.notes, p.steps, 20);
    expect(looped.map((n) => n.step)).toEqual([0, 2, 4, 8, 10, 12, 16, 18]);
    expect(loopNotes(p.notes, 0, 20)).toEqual([]);
  });
});

describe('songs', () => {
  it('measures steps, bars and swing', () => {
    const s = song({ swing: 0.25 });
    expect(barSteps(s)).toBe(16);
    expect(songSeconds(s)).toBeCloseTo(4); // 32 sixteenths at 120 bpm
    expect(stepTime(s, 2)).toBeCloseTo(0.25);
    expect(stepTime(s, 1)).toBeCloseTo(0.125 * 1.25);
  });

  it('indexes notes by step and finds problems', () => {
    const s = song();
    const idx = indexSong(s);
    expect(idx).toHaveLength(32);
    expect(idx[0]?.map((n) => n.note.pitch)).toEqual([60]);
    expect(idx[24]?.map((n) => n.note.pitch)).toEqual([67]);
    expect(songProblems(s)).toEqual([]);
    expect(songProblems(song({ tracks: [{ instrument: 'nope', notes: [] }] }))).toHaveLength(1);
    expect(
      songProblems(
        song({ tracks: [{ instrument: 'lead', notes: [{ step: 40, len: 1, pitch: 60 }] }] }),
      ),
    ).toHaveLength(1);
  });

  it('turns a note into tones', () => {
    const spec = noteSpec(inst, 69, 0.5, 0.5);
    expect(spec.tones[0]?.freq).toBe(440);
    expect(spec.tones[0]?.dur).toBeCloseTo(0.58); // note + default release
    expect(spec.tones[0]?.gain).toBeCloseTo(0.2);
    expect(spec.tones[1]?.freq).toEqual([880, 440]);
    expect(spec.tones[1]?.dur).toBe(0.3); // fixed length
  });
});
