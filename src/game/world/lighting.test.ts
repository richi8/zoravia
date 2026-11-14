import { describe, expect, it } from 'vitest';
import { corePack } from '../../../packs/core';
import { loadGameContent } from '@game/data';
import { BIOMES, TILE } from './biomes';
import { DAY_LENGTH, dayLight, MOODS, nextPhaseStart, propLights, sceneLight } from './lighting';
import { loadRegion } from './map';
import { Atmosphere } from './overworld/atmosphere';
import { WorldFx } from './overworld/fx';
import { PixelBuffer } from '@engine/render/pixel-buffer';

const content = loadGameContent([corePack]);

describe('day/night', () => {
  it('starts in daylight and has a night', () => {
    expect(dayLight(0)).toMatchObject({ phase: 'day', lamps: 0, ambient: [1, 1, 1] });
    const night = dayLight(DAY_LENGTH * 0.7);
    expect(night.phase).toBe('night');
    expect(night.lamps).toBe(1);
    expect(night.ambient[0]).toBeLessThan(0.6);
  });

  it('loops every DAY_LENGTH seconds', () => {
    expect(dayLight(DAY_LENGTH * 3.7)).toEqual(dayLight(DAY_LENGTH * 0.7));
  });

  it('skips forward to the next phase', () => {
    const t = nextPhaseStart(10, 'night');
    expect(t).toBeGreaterThan(10);
    expect(dayLight(t + 1).phase).toBe('night');
    expect(nextPhaseStart(t + 1, 'night')).toBeCloseTo(t + DAY_LENGTH);
  });
});

describe('scene light', () => {
  it('multiplies moods into the ambient and lights runes at a shrine by day', () => {
    const l = sceneLight(
      dayLight(0),
      [{ mood: MOODS.shrine, weight: 1, x: 0, y: 0 }],
      [],
      0,
      0,
      480,
      270,
    );
    expect(l.frame.ambient).toEqual(MOODS.shrine.ambient);
    expect(Math.max(...l.glow.filter((g) => g !== undefined))).toBe(1);
    expect(l.lights).toHaveLength(1); // the shrine's sun
  });

  it('turns prop lights on only after dusk', () => {
    const props = [{ kind: 'lamp' as const, x: 100, y: 100 }];
    expect(sceneLight(dayLight(0), [], props, 0, 0, 480, 270).lights).toHaveLength(0);
    const night = sceneLight(dayLight(DAY_LENGTH * 0.7), [], props, 0, 0, 480, 270);
    expect(night.lights.length).toBeGreaterThan(0);
  });
});

describe('Verdale atmosphere', () => {
  const map = loadRegion(content, 'core:verdale');
  const biome = BIOMES[map.biome];

  it('finds lamps, windows and runes', () => {
    const kinds = new Set(propLights(map.toTerrainMap(), biome).map((l) => l.kind));
    expect(kinds).toEqual(new Set(['lamp', 'window', 'rune']));
  });

  it('eases a shrine mood in near the shrine and out far away', () => {
    const atm = new Atmosphere(map, biome, 1);
    const shrine = map.anchors['heartwood-shrine'];
    expect(shrine?.mood).toBe('shrine');
    atm.update(0, shrine?.x ?? 0, shrine?.y ?? 0, true);
    expect(atm.activeMoods().some((m) => m.mood === MOODS.shrine && m.weight === 1)).toBe(true);
    const spawn = map.anchors['spawn'];
    atm.update(0.1, spawn?.x ?? 0, spawn?.y ?? 0);
    const w = atm.activeMoods().find((m) => m.mood === MOODS.shrine)?.weight ?? 0;
    expect(w).toBeLessThan(1);
    expect(w).toBeGreaterThan(0.8);
  });

  it('lights Willowmere at night with glowing windows', () => {
    const atm = new Atmosphere(map, biome, 1);
    atm.resize(160, 120);
    const spawn = map.anchors['spawn'] ?? { x: 0, y: 0 };
    atm.update(0, spawn.x, spawn.y, true);
    const sink = atm.begin(DAY_LENGTH * 0.7, spawn.x * TILE - 80, spawn.y * TILE - 80);
    expect(sink).toBeDefined();
    expect(atm.lights.lightCount).toBeGreaterThan(0);
  });
});

describe('WorldFx', () => {
  it('spawns, moves and expires particles', () => {
    const fx = new WorldFx(3);
    fx.rustle(10, 10, [0x00ff00]);
    fx.dust(10, 10, 1, 0xffffff);
    fx.puff(20, 20);
    fx.sparkle(30, 30);
    expect(fx.count).toBeGreaterThan(20);
    const buf = new PixelBuffer(64, 64);
    fx.draw(buf, 0, 0);
    fx.update(2);
    expect(fx.count).toBe(0);
  });
});
