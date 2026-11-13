/**
 * Hand-written music (C25): boss themes and, later, story pieces. Field and battle music is
 * composed procedurally per biome; packs write music by hand when a moment deserves its own
 * theme. A boss names its theme with `theme`.
 *
 * Format: a tempo and grid, and tracks. Each track plays one of the game's instruments
 * (`INSTRUMENT_IDS`) and has either:
 * - `notes`: a melody line, e.g. `"E4:2 G4:1 B4 | E5:4 . D5+F5:2!"` (see `parseNotes`:
 *   note names, `+` chords, `.` rests, `:n` lengths in steps that carry on, `!` accent,
 *   `?` soft, `|` bar marks), or
 * - `hits`: a drum line, one character per step, `x` hit, `o` soft, `.` rest.
 *
 * A track shorter than the song repeats to fill it (a one-bar drum line), so its length must
 * divide the song's length (`bars` × `beatsPerBar` × `stepsPerBeat` steps).
 */

import { defineRegistry, type EntryOf, type EntryProblem } from '@engine/packs';
import { NoteParseError, noteNumber, parseHits, parseNotes } from '@engine/audio/song';
import { z } from 'zod';
import { INSTRUMENT_IDS } from '@game/audio/music/instruments';
import { name } from './common';

export const musicTrackSchema = z
  .strictObject({
    instrument: z.enum(INSTRUMENT_IDS),
    notes: z.string().min(1).optional(),
    hits: z.string().min(1).optional(),
    /** Pitch of `hits` (note name); omitted = the drum's own. */
    pitch: z
      .string()
      .refine((n) => noteNumber(n) !== undefined, 'Must be a note name like "C2"')
      .optional(),
    /** Semitones added to every note. */
    transpose: z.number().int().min(-36).max(36).default(0),
    gain: z.number().min(0).max(2).default(1),
    pan: z.number().min(-1).max(1).default(0),
  })
  .refine((t) => (t.notes === undefined) !== (t.hits === undefined), {
    message: 'A track has either "notes" or "hits"',
  });

export const musicSchema = z.strictObject({
  name,
  bpm: z.number().min(40).max(240),
  stepsPerBeat: z.number().int().min(1).max(8).default(4),
  beatsPerBar: z.number().int().min(2).max(7).default(4),
  bars: z.number().int().min(1).max(64),
  swing: z.number().min(0).max(0.5).default(0),
  gain: z.number().min(0).max(2).default(1),
  tracks: z.array(musicTrackSchema).min(1).max(12),
});

export type Music = EntryOf<typeof music>;
export type MusicInput = z.input<typeof musicSchema>;
export type MusicTrackData = z.output<typeof musicTrackSchema>;

type MusicLike = z.output<typeof musicSchema>;

export const music = defineRegistry('music', musicSchema, {
  check: (m) => checkMusic(m),
});

/** Steps in one loop of a piece. */
export function musicSteps(m: MusicLike): number {
  return m.bars * m.beatsPerBar * m.stepsPerBeat;
}

function checkMusic(m: MusicLike): EntryProblem[] {
  const out: EntryProblem[] = [];
  const total = musicSteps(m);
  m.tracks.forEach((t, i) => {
    const field = t.notes !== undefined ? 'notes' : 'hits';
    try {
      const parsed = t.notes !== undefined ? parseNotes(t.notes) : parseHits(t.hits ?? '', 60);
      if (parsed.steps === 0 || total % parsed.steps !== 0) {
        out.push({
          path: ['tracks', i, field],
          message: `Covers ${parsed.steps} steps; it must divide the song's ${total}`,
        });
      }
    } catch (e) {
      const msg = e instanceof NoteParseError ? `${e.message} (token ${e.token + 1})` : String(e);
      out.push({ path: ['tracks', i, field], message: msg });
    }
  });
  return out;
}
