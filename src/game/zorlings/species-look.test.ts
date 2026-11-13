import { describe, expect, it } from 'vitest';
import { loadGameContent } from '@game/data';
import { corePack } from '@packs/core';
import { battleLook, speciesLook } from './species-look';
import { TITAN_SIZE } from './variants';

const content = loadGameContent([corePack]);

describe('species looks', () => {
  it('derives every stage of a line from the final form', () => {
    const a = speciesLook(content, 'core:emberkit');
    const b = speciesLook(content, 'core:blazekit');
    const c = speciesLook(content, 'core:infernyx');
    expect(c.genome.plan).toBe('feline');
    expect(c.genome.mood).toBe('fierce');
    // Emberkit starts out as a round blob, Blazekit is already a feline (`look.young`).
    expect(a.genome.plan).toBe('blob');
    expect(b.genome.plan).toBe('feline');
    expect(a.genome.palette.secondary).toBe(c.genome.palette.secondary);
    expect(a.fill).toBeLessThan(b.fill);
    expect(b.fill).toBeLessThan(c.fill);
    expect(speciesLook(content, 'core:emberkit')).toBe(a); // cached
  });

  it('uses the species types', () => {
    expect(speciesLook(content, 'core:voltbat').genome.types).toEqual(['electric', 'wind']);
    expect(speciesLook(content, 'core:ironshell').genome.types).toEqual(['metal']);
  });

  it('draws bosses and Titan marks big', () => {
    expect(battleLook(content, 'core:sproutle').size).toBe(96);
    const titan = battleLook(content, 'core:thornwing', { boss: 'titan' });
    expect(titan).toMatchObject({ size: TITAN_SIZE, titan: true });
    expect(titan.genome.body.bulk).toBeGreaterThan(
      speciesLook(content, 'core:thornwing').genome.body.bulk,
    );
    expect(battleLook(content, 'core:thornwing', { titanMark: true }).titan).toBe(true);
    expect(battleLook(content, 'core:glacivar')).toMatchObject({ size: TITAN_SIZE, titan: false });
  });

  it('rejects a look on an earlier stage', () => {
    const bad = {
      manifest: { id: 'mod', version: '1.0.0', dependsOn: ['core'] },
      patches: { species: { 'core:emberkit': { look: { seed: 1 } } } },
    };
    expect(() => loadGameContent([corePack, bad])).toThrow(/Only the final form/);
  });
});
