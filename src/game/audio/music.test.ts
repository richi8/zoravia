import { definePack, PackError, type PackContent } from '@engine/packs';
import { parseNotes, songProblems, songSeconds, type Song } from '@engine/audio';
import { describe, expect, it } from 'vitest';
import { loadGameContent } from '@game/data';
import { BIOME_IDS } from '@game/world/biomes';
import { corePack } from '@packs/core';
import {
  BAR,
  battleMusic,
  battleSong,
  BIOME_MUSIC,
  biomeAmbience,
  bossSong,
  composeSong,
  fieldSong,
  SECTION_BARS,
  themeSong,
} from './music';

const content = loadGameContent([corePack]);

function lead(song: Song): readonly { step: number; pitch: number }[] {
  return song.tracks[0]?.notes ?? [];
}

describe('procedural music', () => {
  const all = BIOME_IDS.flatMap((b) => [fieldSong(b), battleSong(b), bossSong(b)]);

  it('every biome has well-formed field, battle and boss songs', () => {
    for (const s of all) {
      expect(songProblems(s), s.id).toEqual([]);
      expect(s.tracks.length, s.id).toBeGreaterThanOrEqual(4);
      for (const t of s.tracks) {
        for (const n of t.notes) {
          expect(n.pitch, `${s.id} ${t.instrument}`).toBeGreaterThanOrEqual(24);
          expect(n.pitch, `${s.id} ${t.instrument}`).toBeLessThanOrEqual(100);
          expect(n.step + n.len, s.id).toBeLessThanOrEqual(s.length);
        }
      }
    }
    expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
  });

  it('is deterministic, and the seed changes the melody', () => {
    const a = BIOME_MUSIC.forest.field;
    expect(composeSong('x', a, 7)).toEqual(composeSong('x', a, 7));
    expect(lead(composeSong('x', a, 7))).not.toEqual(lead(composeSong('x', a, 8)));
  });

  it('field songs are long and calm, battle songs short and fast', () => {
    for (const b of BIOME_IDS) {
      const field = fieldSong(b);
      const battle = battleSong(b);
      expect(field.length).toBe(4 * SECTION_BARS * BAR);
      expect(battle.length).toBe(2 * SECTION_BARS * BAR);
      expect(battle.bpm).toBeGreaterThan(field.bpm * 1.4);
      expect(songSeconds(field)).toBeGreaterThan(60);
      expect(songSeconds(battle)).toBeGreaterThan(20);
      // Battle melodies move more.
      expect(lead(battle).length / battle.length).toBeGreaterThan(
        lead(field).length / field.length,
      );
    }
  });

  it('keeps the melody in the key and brings the A theme back', () => {
    for (const b of BIOME_IDS) {
      const a = BIOME_MUSIC[b].field;
      const song = fieldSong(b);
      const pcs = new Set(a.scale.map((s) => (a.root + s) % 12));
      for (const n of lead(song)) expect(pcs.has(n.pitch % 12), `${b} ${n.pitch}`).toBe(true);
      // A′ (section 3) opens with the same two bars as A.
      const section = SECTION_BARS * BAR;
      const opening = (from: number): number[][] =>
        lead(song)
          .filter((n) => n.step >= from && n.step < from + 2 * BAR)
          .map((n) => [n.step - from, n.pitch]);
      expect(opening(2 * section)).toEqual(opening(0));
      // The last melody note of the loop is the tonic.
      const last = [...lead(song)].sort((x, y) => x.step - y.step).at(-1);
      expect((last?.pitch ?? 0) % 12).toBe(a.root % 12);
    }
  });

  it('biomes sound different', () => {
    const tempos = BIOME_IDS.map((b) => fieldSong(b).bpm);
    expect(new Set(tempos).size).toBe(3);
    const leads = BIOME_IDS.map((b) => fieldSong(b).tracks[0]?.instrument);
    expect(new Set(leads).size).toBe(3);
  });
});

describe('boss themes', () => {
  it('core themes load and loop cleanly', () => {
    for (const m of content.music) {
      const s = themeSong(content, m.id);
      expect(songProblems(s)).toEqual([]);
      expect(s.length).toBe(m.bars * m.beatsPerBar * m.stepsPerBeat);
      // Every track fills the loop: its notes reach the last bar.
      for (const t of s.tracks) {
        const end = Math.max(...t.notes.map((n) => n.step + n.len));
        expect(end, `${m.id} ${t.instrument}`).toBeGreaterThan(s.length - s.stepsPerBeat * 4);
      }
    }
    expect(themeSong(content, 'core:titan-theme')).toBe(themeSong(content, 'core:titan-theme'));
  });

  it('a boss plays its theme; a boss without one gets composed boss music', () => {
    expect(battleMusic(content, { biome: 'forest', boss: 'core:thornwing-titan' }).id).toBe(
      'theme:core:titan-theme',
    );
    expect(battleMusic(content, { biome: 'frozen', boss: 'core:glacivar' }).id).toBe(
      'theme:core:glacivar-theme',
    );
    expect(battleMusic(content, { biome: 'desert' }).id).toBe('battle:desert');
    const noTheme = withMod({
      bosses: {
        plain: {
          name: 'Plain Titan',
          kind: 'titan',
          species: 'core:ironshell',
          level: 20,
          signatureMove: 'core:bramble-gale',
        },
      },
    });
    expect(battleMusic(noTheme, { biome: 'desert', boss: 'mod:plain' }).id).toBe('boss:desert');
  });

  it('rejects bad note text and lengths that do not fit the loop', () => {
    const issues = modIssues({
      music: {
        bad: {
          name: 'Bad',
          bpm: 120,
          bars: 2,
          tracks: [
            { instrument: 'bell', notes: 'C4:4 Z4' },
            { instrument: 'kick', hits: 'x....' },
          ],
        },
      },
      bosses: {
        plain: {
          name: 'Plain Titan',
          kind: 'titan',
          species: 'core:ironshell',
          level: 20,
          signatureMove: 'core:bramble-gale',
          theme: 'mod:nope',
        },
      },
    });
    expect(issues.some((i) => /tracks\[0\]\.notes: "Z4" is not a note \(token 2\)/.test(i))).toBe(
      true,
    );
    expect(
      issues.some((i) => /tracks\[1\]\.hits: Covers 5 steps; it must divide the song's 32/.test(i)),
    ).toBe(true);
    // Schema problems are reported before the checks above run.
    const both = modIssues({
      music: {
        both: {
          name: 'Both',
          bpm: 120,
          bars: 1,
          tracks: [{ instrument: 'bell', notes: 'C4', hits: 'x' }],
        },
      },
    });
    expect(both).toEqual(['content.music.both.tracks[0]: A track has either "notes" or "hits"']);
    expect(issues.some((i) => /theme: Unknown music "mod:nope"/.test(i))).toBe(true);
  });

  it('the note format reads the core themes bar by bar', () => {
    for (const m of content.music) {
      for (const t of m.tracks) {
        if (!t.notes) continue;
        const bar = m.beatsPerBar * m.stepsPerBeat;
        for (const [i, text] of t.notes.split('|').entries()) {
          // Every bar mark sits on a bar line (lengths carry across bars, so parse cumulatively).
          const upTo = t.notes
            .split('|')
            .slice(0, i + 1)
            .join(' ');
          expect(
            parseNotes(upTo).steps % bar,
            `${m.id} ${t.instrument} bar ${i + 1}: ${text}`,
          ).toBe(0);
        }
      }
    }
  });
});

describe('ambience', () => {
  it('each biome has layers; weather adds rain', () => {
    for (const b of BIOME_IDS) {
      const a = biomeAmbience(b);
      expect(a.id).toBe(b);
      expect(a.layers.some((l) => l.kind === 'bed')).toBe(true);
      expect(a.layers.some((l) => l.kind === 'events')).toBe(true);
      const wet = biomeAmbience(b, ['core:wet', 'core:burning']);
      expect(wet.id).toBe(`${b}+core:wet`);
      expect(wet.layers.length).toBeGreaterThan(a.layers.length);
    }
  });
});

function withMod(content: PackContent) {
  return loadGameContent([corePack, modPack(content)]);
}

function modPack(content: PackContent) {
  return definePack({ manifest: { id: 'mod', version: '1.0.0', dependsOn: ['core'] }, content });
}

function modIssues(content: PackContent): string[] {
  try {
    withMod(content);
    return [];
  } catch (err) {
    if (err instanceof PackError) return err.issues.map((i) => `${i.path}: ${i.message}`);
    throw err;
  }
}
