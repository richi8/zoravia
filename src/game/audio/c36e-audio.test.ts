import { describe, expect, it } from 'vitest';
import { isLowHp } from '@game/battle/scene/low-hp';
import { BLIP_PITCH, BlipCounter, speakerPitch } from './blip';
import { SCREEN_PAN, screenPan } from './scene-audio';
import { SFX } from './sfx';

describe('C36e sounds', () => {
  it('low HP is under a quarter, and not fainted', () => {
    expect(isLowHp(24, 100)).toBe(true);
    expect(isLowHp(25, 100)).toBe(false);
    expect(isLowHp(0, 100)).toBe(false);
    expect(isLowHp(1, 3)).toBe(false);
    expect(isLowHp(1, 5)).toBe(true);
  });

  it('has a short low-HP sting and a text blip', () => {
    expect(SFX['battle.lowHp'].tones.length).toBeGreaterThan(0);
    for (const t of SFX['battle.lowHp'].tones) expect((t.at ?? 0) + t.dur).toBeLessThan(0.5);
    expect(SFX['world.blip'].tones[0]?.dur).toBeLessThan(0.05);
  });

  it('pitches each speaker the same way every time, within range', () => {
    const names = ['Mira', 'Picnicker Nell', 'Elder Bram', 'Ranger Tova', 'Shopkeeper'];
    const pitches = names.map(speakerPitch);
    for (const p of pitches) {
      expect(p).toBeGreaterThanOrEqual(BLIP_PITCH[0]);
      expect(p).toBeLessThanOrEqual(BLIP_PITCH[1]);
    }
    expect(speakerPitch('Mira')).toBe(pitches[0]);
    expect(new Set(pitches).size).toBeGreaterThan(3);
  });

  it('blips every third letter, ignoring spaces and punctuation', () => {
    const c = new BlipCounter();
    expect(c.typed('H')).toBe(true);
    expect(c.typed('i')).toBe(false);
    expect(c.typed(', ')).toBe(false);
    expect(c.typed('t')).toBe(false);
    expect(c.typed('h')).toBe(true);
    // A burst of text blips once.
    expect(new BlipCounter().typed('Hello there')).toBe(true);
  });

  it('pans with the place on screen', () => {
    expect(screenPan(0, 480)).toBeCloseTo(-SCREEN_PAN);
    expect(screenPan(240, 480)).toBeCloseTo(0);
    expect(screenPan(480, 480)).toBeCloseTo(SCREEN_PAN);
    expect(screenPan(-100, 480)).toBeCloseTo(-SCREEN_PAN);
    expect(screenPan(10, 0)).toBe(0);
  });
});
