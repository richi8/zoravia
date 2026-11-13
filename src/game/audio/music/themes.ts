/** Hand-written pack music (`content.music`) as playable songs (C25). */

import {
  loopNotes,
  noteNumber,
  parseHits,
  parseNotes,
  type Instrument,
  type Song,
  type SongTrack,
} from '@engine/audio';
import { musicSteps, type GameContent } from '@game/data';
import { DRUM_PITCH, INSTRUMENTS, MUSIC_MIX } from './instruments';

const cache = new WeakMap<GameContent, Map<string, Song>>();

/** The song of a `music` entry. Cached per content. */
export function themeSong(content: GameContent, id: string): Song {
  let byId = cache.get(content);
  if (!byId) {
    byId = new Map();
    cache.set(content, byId);
  }
  const hit = byId.get(id);
  if (hit) return hit;
  const m = content.music.require(id);
  const length = musicSteps(m);
  const instruments: Record<string, Instrument> = {};
  const tracks: SongTrack[] = m.tracks.map((t) => {
    instruments[t.instrument] = INSTRUMENTS[t.instrument];
    const parsed =
      t.notes !== undefined
        ? parseNotes(t.notes)
        : parseHits(t.hits ?? '', noteNumber(t.pitch ?? '') ?? DRUM_PITCH[t.instrument] ?? 60);
    const notes = loopNotes(parsed.notes, parsed.steps, length).map((n) =>
      t.transpose ? { ...n, pitch: n.pitch + t.transpose } : n,
    );
    return { instrument: t.instrument, notes, gain: t.gain, ...(t.pan ? { pan: t.pan } : {}) };
  });
  const song: Song = {
    id: `theme:${m.id}`,
    bpm: m.bpm,
    stepsPerBeat: m.stepsPerBeat,
    beatsPerBar: m.beatsPerBar,
    length,
    instruments,
    tracks,
    ...(m.swing ? { swing: m.swing } : {}),
    gain: m.gain * MUSIC_MIX,
  };
  byId.set(id, song);
  return song;
}
