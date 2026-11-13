import { AudioEngine, renderSpec, specDuration, type SoundSpec } from '@engine/audio';
import { spriteToCanvas } from '@engine/render/sprite-canvas';
import { cryFor, SFX, speciesCry } from '@game/audio';
import { loadGameContent } from '@game/data';
import { generateGenome } from '@game/zorlings/genome';
import { renderZorling } from '@game/zorlings/render';
import { speciesLook } from '@game/zorlings/species-look';
import { corePack } from '@packs/core';
import { h, type LabSection } from '../dom';

/**
 * Sound board (C24): every sound effect and the cry of every core species, each with its
 * waveform (rendered offline). Click to play.
 */
export const soundSection: LabSection = {
  id: 'sound',
  title: 'Sound',
  chunk: 'C24',
  ready: true,
  render(el) {
    const audio = new AudioEngine();
    const play = (spec: SoundSpec): void => {
      audio.unlock(); // the click is the user gesture
      audio.play(spec);
    };
    const button = (label: string, spec: SoundSpec, art?: HTMLElement): HTMLElement => {
      const wave = h('canvas', { class: 'snd-wave', width: 160, height: 32 });
      void drawWave(wave, spec);
      const b = h(
        'button',
        {
          class: art ? 'snd-btn snd-art' : 'snd-btn',
          type: 'button',
          title: `${specDuration(spec).toFixed(2)} s`,
        },
        art ?? null,
        h('code', {}, label),
        wave,
      );
      b.addEventListener('click', () => play(spec));
      return b;
    };

    const groups = new Map<string, HTMLElement[]>();
    for (const [id, spec] of Object.entries(SFX)) {
      const group = id.split('.')[0] ?? '';
      groups.set(group, [...(groups.get(group) ?? []), button(id, spec)]);
    }
    const names: Record<string, string> = {
      ui: 'UI',
      move: 'Moves (one per type)',
      battle: 'Battle',
      world: 'Overworld',
    };

    const content = loadGameContent([corePack]);
    const cries = content.species.values().map((s) => {
      const art = spriteToCanvas(renderZorling(speciesLook(content, s.id).genome, { size: 32 }), 1);
      return button(s.name, speciesCry(content, s.id), art);
    });
    const titans = [
      button('Thornwing Titan', speciesCry(content, 'core:thornwing', { boss: 'titan' })),
      button('Glacivar (legendary)', speciesCry(content, 'core:glacivar', { boss: 'legendary' })),
    ];
    const random = h('div', { class: 'snd-grid' });
    const reroll = (): void => {
      const base = Math.floor(Math.random() * 1e6);
      random.replaceChildren(
        ...Array.from({ length: 12 }, (_, i) => {
          const g = generateGenome(base + i);
          const art = spriteToCanvas(renderZorling(g, { size: 32 }), 1);
          return button(`${g.plan} · ${g.mood} · ${g.types[0]}`, cryFor(g), art);
        }),
      );
    };
    reroll();
    const again = h('button', { class: 'snd-reroll', type: 'button' }, 'New random genomes');
    again.addEventListener('click', reroll);

    el.append(
      h(
        'p',
        { class: 'lead' },
        'Everything is synthesized with Web Audio from small specs (oscillators, noise, envelopes, filter sweeps). Cries come from the genome: the body plan picks the voice, size lowers the pitch, mood shapes it and the first type adds a texture. Click to play.',
      ),
      ...[...groups].flatMap(([g, buttons]) => [
        h('h3', {}, names[g] ?? g),
        h('div', { class: 'snd-grid' }, ...buttons),
      ]),
      h('h3', {}, 'Cries · core species'),
      h('div', { class: 'snd-grid' }, ...cries),
      h('h3', {}, 'Cries · boss forms'),
      h('div', { class: 'snd-grid' }, ...titans),
      h('h3', {}, 'Cries · random genomes'),
      again,
      random,
    );
  },
};

async function drawWave(canvas: HTMLCanvasElement, spec: SoundSpec): Promise<void> {
  if (typeof OfflineAudioContext === 'undefined') return;
  const buf = await renderSpec(spec, 22_050);
  const data = buf.getChannelData(0);
  const g = canvas.getContext('2d');
  if (!g) return;
  const { width: w, height: hgt } = canvas;
  const color = getComputedStyle(canvas).color || '#888';
  g.clearRect(0, 0, w, hgt);
  g.fillStyle = color;
  // Scaled to the sound's own peak, so quiet sounds still show their shape.
  let max = 1e-6;
  for (const v of data) max = Math.max(max, Math.abs(v));
  const per = Math.max(1, Math.floor(data.length / w));
  for (let x = 0; x < w; x++) {
    let peak = 0;
    for (let i = x * per; i < (x + 1) * per && i < data.length; i++)
      peak = Math.max(peak, Math.abs(data[i] ?? 0));
    const bar = Math.max(1, Math.round((peak / max) * hgt));
    g.fillRect(x, Math.round((hgt - bar) / 2), 1, bar);
  }
}
