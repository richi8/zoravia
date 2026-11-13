/**
 * Hand-written boss themes (C25). Format: `src/game/data/music.ts`. Both are 8-bar loops on
 * an eighth-note grid (`stepsPerBeat: 2`), so a length of 8 is one bar.
 */

import type { MusicInput } from '@game/data';

const REST_7_BARS = '........ ........ ........ ........ ........ ........ ........';

export const music = {
  'titan-theme': {
    name: 'Wrath of the Titan',
    bpm: 150,
    stepsPerBeat: 2,
    bars: 8,
    gain: 0.85,
    tracks: [
      {
        instrument: 'brass',
        notes:
          'E4:2! G4:1 B4 E5:3 D#5:1 | E5:2! D5:1 C5 B4:2 G4 | A4:2! C5:1 E5 A5:3 G5:1 | F#5:2! E5:1 D#5 B4:4 |' +
          ' E5:1! F#5 G5:2 F#5:1 E5 D#5:2 | E5:2! G5 C6 B5:1 A5 | A5:2! F#5 D5 E5:1 F#5 | D#5:2! F#5 B5:4',
      },
      {
        instrument: 'strings',
        gain: 0.9,
        notes:
          'E3+G3+B3:8 | C3+E3+G3 | A2+C3+E3 | B2+D#3+F#3 | E3+G3+B3 | C3+E3+G3 | D3+F#3+A3 | B2+D#3+F#3',
      },
      {
        instrument: 'bassPulse',
        notes:
          'E2:1! E2 E3 E2 E2 E3 E2 E3 | C2! C2 C3 C2 C2 C3 C2 C3 | A1! A1 A2 A1 A1 A2 A1 A2 | B1! B1 B2 B1 B1 B2 D#2 F#2 |' +
          ' E2! E2 E3 E2 E2 E3 E2 E3 | C2! C2 C3 C2 C2 C3 C2 C3 | D2! D2 D3 D2 D2 D3 D2 D3 | B1! B1 B2 B1 B1 B2 B1 B2',
      },
      { instrument: 'timpani', gain: 0.8, notes: 'E2:8 C2 A1 B1 E2 C2 D2 B1' },
      { instrument: 'kick', hits: 'x..xx...' },
      { instrument: 'snare', hits: '..x...x.' },
      { instrument: 'hat', hits: 'oxoxoxox', gain: 0.8 },
      { instrument: 'tom', hits: `${REST_7_BARS} x.x.xxxx` },
    ],
  },
  'glacivar-theme': {
    name: 'The White Crown',
    bpm: 108,
    stepsPerBeat: 2,
    bars: 8,
    gain: 0.7,
    tracks: [
      {
        instrument: 'strings',
        gain: 1.2,
        notes:
          'D5:6! E5:1 F5 | D5:4 Bb4 | C5:6 A4:2 | G4:4 E4 | D5:2! F5 A5:4 | Bb5:4! A5:2 G5 | G5:2 F5 D5 Bb4 | A4:8',
      },
      {
        instrument: 'bell',
        gain: 0.45,
        transpose: 12,
        notes:
          'D5:1 F5 A5 F5 D5 F5 A5 F5 | Bb4 D5 F5 D5 Bb4 D5 F5 D5 | F4 A4 C5 A4 F4 A4 C5 A4 | C5 E5 G5 E5 C5 E5 G5 E5 |' +
          ' D5 F5 A5 F5 D5 F5 A5 F5 | Bb4 D5 F5 D5 Bb4 D5 F5 D5 | G4 Bb4 D5 Bb4 G4 Bb4 D5 Bb4 | A4 C#5 E5 C#5 A4 C#5 E5 C#5',
      },
      {
        instrument: 'glassPad',
        notes:
          'D4+F4+A4:8 | Bb3+D4+F4 | F3+A3+C4 | C4+E4+G4 | D4+F4+A4 | Bb3+D4+F4 | G3+Bb3+D4 | A3+C#4+E4',
      },
      {
        instrument: 'bass',
        notes:
          'D3:4! D3:2 A2 | Bb2:4! Bb2:2 F3 | F2:4! F2:2 C3 | C3:4! C3:2 G2 | D3:4! D3:2 A2 | Bb2:4! Bb2:2 F3 | G2:4! G2:2 D3 | A2:4! A2:2 E3',
      },
      { instrument: 'timpani', gain: 0.9, notes: 'D2:8 Bb1 F2 C2 D2 Bb1 G1 A1' },
      { instrument: 'hat', hits: 'o.o.o.o.', gain: 0.7 },
      { instrument: 'tom', hits: `${REST_7_BARS} x...x.xx` },
    ],
  },
} satisfies Record<string, MusicInput>;
