import {
  AmbiencePlayer,
  AudioEngine,
  MusicPlayer,
  songSeconds,
  type Ambience,
  type Song,
} from '@engine/audio';
import { battleSong, biomeAmbience, bossSong, fieldSong, themeSong } from '@game/audio';
import { loadGameContent } from '@game/data';
import { BIOME_IDS, BIOMES } from '@game/world/biomes';
import { corePack } from '@packs/core';
import { h, type LabSection } from '../dom';

/**
 * Music board (C25): every biome's field, battle and composed boss music, the pack's
 * hand-written boss themes, and each biome's ambience. Clicking another song crossfades to
 * it, the same way the game does. Each song shows its notes as a piano roll.
 */
export const musicSection: LabSection = {
  id: 'music',
  title: 'Music & ambience',
  chunk: 'C25',
  ready: true,
  render(el) {
    const audio = new AudioEngine();
    const music = new MusicPlayer(audio);
    const ambience = new AmbiencePlayer(audio);
    const now = h('p', { class: 'mus-now' }, 'Nothing playing.');
    const roll = h('canvas', { class: 'mus-roll', width: 960, height: 120 });
    let song: Song | undefined;
    let amb: Ambience | undefined;
    const status = (): void => {
      const parts = [
        song ? `♪ ${song.id} · ${song.bpm} bpm · ${songSeconds(song).toFixed(0)} s loop` : '',
        amb ? `≈ ${amb.id}` : '',
      ].filter(Boolean);
      now.textContent = parts.length ? parts.join('   ') : 'Nothing playing.';
    };
    const playSong = (s: Song): void => {
      audio.unlock(); // the click is the user gesture
      music.play(s, { fade: 1.2 });
      song = s;
      drawRoll(roll, s);
      status();
    };
    const playAmb = (a: Ambience): void => {
      audio.unlock();
      ambience.play(a);
      amb = a;
      status();
    };
    const button = (label: string, sub: string, onClick: () => void): HTMLElement => {
      const b = h(
        'button',
        { class: 'snd-btn', type: 'button' },
        h('code', {}, label),
        h('small', {}, sub),
      );
      b.addEventListener('click', onClick);
      return b;
    };
    const songButton = (label: string, s: Song): HTMLElement =>
      button(label, `${s.bpm} bpm · ${songSeconds(s).toFixed(0)} s`, () => playSong(s));

    const content = loadGameContent([corePack]);
    const biomes = BIOME_IDS.map((b) =>
      h(
        'div',
        {},
        h('h3', {}, BIOMES[b].label),
        h(
          'div',
          { class: 'snd-grid' },
          songButton('Field', fieldSong(b)),
          songButton('Battle', battleSong(b)),
          songButton('Boss (composed)', bossSong(b)),
          button('Ambience', b, () => playAmb(biomeAmbience(b))),
          button('Ambience + rain', `${b}+core:wet`, () => playAmb(biomeAmbience(b, ['core:wet']))),
        ),
      ),
    );
    const themes = content.music.values().map((m) => songButton(m.name, themeSong(content, m.id)));

    const stop = h('button', { class: 'snd-reroll', type: 'button' }, 'Stop music');
    stop.addEventListener('click', () => {
      music.stop(1);
      song = undefined;
      status();
    });
    const stopAmb = h('button', { class: 'snd-reroll', type: 'button' }, 'Stop ambience');
    stopAmb.addEventListener('click', () => {
      ambience.stop(1.5);
      amb = undefined;
      status();
    });

    el.append(
      h(
        'p',
        { class: 'lead' },
        'Field and battle music is composed from each biome’s style (key, mode, tempo, instruments, patterns) by a seeded composer, so it is the same every time. Bosses play a hand-written theme from the pack, or boss music composed from the biome’s battle style. Click another song while one plays to hear the crossfade. Music and ambience play together, as in the game.',
      ),
      h('div', { class: 'mus-bar' }, stop, stopAmb, now),
      roll,
      ...biomes,
      h('h3', {}, 'Hand-written boss themes (pack data)'),
      h('div', { class: 'snd-grid' }, ...themes),
    );
  },
};

/** Piano roll: one row per pitch, one color per track. */
function drawRoll(canvas: HTMLCanvasElement, song: Song): void {
  const g = canvas.getContext('2d');
  if (!g) return;
  const { width: w, height: hgt } = canvas;
  g.clearRect(0, 0, w, hgt);
  let lo = 127;
  let hi = 0;
  for (const t of song.tracks) {
    for (const n of t.notes) {
      lo = Math.min(lo, n.pitch);
      hi = Math.max(hi, n.pitch);
    }
  }
  const rows = Math.max(1, hi - lo + 1);
  const sx = w / song.length;
  const sy = hgt / rows;
  const colors = [
    '#e8a33d',
    '#58a6e8',
    '#7bc86c',
    '#c77ddb',
    '#e86b6b',
    '#9aa3ad',
    '#d8c25a',
    '#5ac7c0',
  ];
  g.fillStyle = getComputedStyle(canvas).color || '#888';
  g.globalAlpha = 0.25;
  const bar = song.stepsPerBeat * song.beatsPerBar;
  for (let s = 0; s < song.length; s += bar) g.fillRect(Math.round(s * sx), 0, 1, hgt);
  g.globalAlpha = 0.9;
  song.tracks.forEach((t, i) => {
    g.fillStyle = colors[i % colors.length] ?? '#888';
    for (const n of t.notes) {
      g.fillRect(
        n.step * sx,
        hgt - (n.pitch - lo + 1) * sy,
        Math.max(1, n.len * sx - 1),
        Math.max(1, sy - 0.5),
      );
    }
  });
  g.globalAlpha = 1;
}
