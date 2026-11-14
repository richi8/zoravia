/**
 * Hand-written boss themes (C25). Format: `src/game/data/music.ts`. An 8-bar loop on an
 * eighth-note grid (`stepsPerBeat: 2`), so a length of 8 is one bar. Glacivar's theme moved to
 * the `rimeholm` pack with Glacivar (C35).
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
} satisfies Record<string, MusicInput>;
