import { describe, expect, it } from 'vitest';
import { curvePoints, MAX_FREQ, MIN_FREQ, specDuration, type SoundSpec } from '@engine/audio';
import { loadGameContent } from '@game/data';
import { corePack } from '@packs/core';
import { speciesLook } from '../zorlings/species-look';
import { generateGenome } from '../zorlings/genome';
import { cryFor, speciesCry } from './cry';
import {
  DEFAULT_AUDIO,
  formatVolume,
  loadAudioSettings,
  saveAudioSettings,
  SETTINGS_KEY,
  stepVolume,
  type SettingsStorage,
} from './settings';
import { SFX } from './sfx';

const content = loadGameContent([corePack]);

/** Checks every number in a spec is usable by Web Audio. */
function expectValid(spec: SoundSpec, maxLength: number): void {
  expect(spec.tones.length).toBeGreaterThan(0);
  expect(specDuration(spec)).toBeLessThanOrEqual(maxLength);
  for (const t of spec.tones) {
    expect(t.dur).toBeGreaterThan(0);
    expect(t.at ?? 0).toBeGreaterThanOrEqual(0);
    expect(t.gain ?? 0.5).toBeGreaterThan(0);
    expect(t.gain ?? 0.5).toBeLessThanOrEqual(1);
    const freqs = [...curvePoints(t.freq ?? 440), ...curvePoints(t.filter?.freq ?? 440)];
    for (const f of freqs) {
      expect(Number.isFinite(f)).toBe(true);
      expect(f).toBeGreaterThanOrEqual(MIN_FREQ);
      expect(f).toBeLessThanOrEqual(MAX_FREQ);
    }
  }
}

const meanPitch = (spec: SoundSpec): number => {
  const f = spec.tones.filter((t) => t.wave !== 'noise').flatMap((t) => curvePoints(t.freq ?? 0));
  return f.reduce((a, b) => a + b, 0) / f.length;
};

describe('cries', () => {
  const species = content.species.values();

  it('same species → same cry; every species sounds different', () => {
    const seen = new Set<string>();
    for (const s of species) {
      const genome = speciesLook(content, s.id).genome;
      const a = JSON.stringify(cryFor(genome));
      // A fresh genome from the same seed (as after a reload) gives the very same cry.
      const again = JSON.stringify(cryFor(structuredClone(genome)));
      expect(again).toBe(a);
      expect(speciesCry(content, s.id)).toBe(speciesCry(content, s.id)); // cached
      expect(seen.has(a)).toBe(false);
      seen.add(a);
    }
    expect(seen.size).toBe(species.length);
  });

  it('every cry is valid and short', () => {
    for (const s of species) expectValid(speciesCry(content, s.id), 1.6);
    for (let seed = 0; seed < 200; seed++) expectValid(cryFor(generateGenome(seed)), 1.6);
  });

  it('bigger and boss forms sound deeper', () => {
    const line = content.evolutionLine('core:emberkit');
    const [baby, , final] = line.members;
    expect(baby && final).toBeTruthy();
    if (!baby || !final) return;
    expect(meanPitch(speciesCry(content, final.id))).toBeLessThan(
      meanPitch(speciesCry(content, baby.id)),
    );
    const titan = speciesCry(content, final.id, { boss: 'titan' });
    expect(meanPitch(titan)).toBeLessThan(meanPitch(speciesCry(content, final.id)));
  });

  it('body plans have their own voices', () => {
    const avian = cryFor(generateGenome(7, { plan: 'avian', mood: 'cute' }));
    const golem = cryFor(generateGenome(7, { plan: 'golem', mood: 'dark' }));
    expect(meanPitch(avian)).toBeGreaterThan(meanPitch(golem) * 4);
  });
});

describe('sound effects', () => {
  it('every effect is valid', () => {
    for (const [id, spec] of Object.entries(SFX)) {
      expect(() => expectValid(spec, 4.1), id).not.toThrow();
    }
  });

  it('UI sounds are short (they repeat while keys are held)', () => {
    for (const [id, spec] of Object.entries(SFX)) {
      if (id.startsWith('ui.')) expect(specDuration(spec), id).toBeLessThan(0.2);
    }
  });
});

describe('audio settings', () => {
  const memory = (): SettingsStorage & { data: Map<string, string> } => {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
    };
  };

  it('round-trips and falls back to defaults', () => {
    const store = memory();
    expect(loadAudioSettings(store)).toEqual(DEFAULT_AUDIO);
    expect(loadAudioSettings(undefined)).toEqual(DEFAULT_AUDIO);
    saveAudioSettings(store, { master: 0.5, music: 0, sfx: 1 });
    expect(loadAudioSettings(store)).toEqual({ master: 0.5, music: 0, sfx: 1 });
    store.data.set(SETTINGS_KEY, '{not json');
    expect(loadAudioSettings(store)).toEqual(DEFAULT_AUDIO);
    store.data.set(SETTINGS_KEY, JSON.stringify({ master: 7 }));
    expect(loadAudioSettings(store)).toEqual(DEFAULT_AUDIO);
    store.data.set(SETTINGS_KEY, JSON.stringify({ sfx: 0.3 }));
    expect(loadAudioSettings(store)).toEqual({ ...DEFAULT_AUDIO, sfx: 0.3 });
  });

  it('steps in tenths', () => {
    expect(stepVolume(0.8, 1)).toBe(0.9);
    expect(stepVolume(1, 1)).toBe(1);
    expect(stepVolume(0, -1)).toBe(0);
    expect(stepVolume(0.30000000000000004, 0)).toBe(0.3);
    expect(formatVolume(0)).toBe('Off');
    expect(formatVolume(0.7)).toBe('70%');
  });
});
