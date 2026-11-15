import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@engine/core/color';
import { PixelBuffer } from '@engine/render/pixel-buffer';
import { loadGameContent } from '@game/data';
import { GAME_VERSION } from '@game/index';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  defaultSettings,
  gameSettings,
  installSettings,
} from '@game/settings';
import { paper } from '@game/style/tokens';
import { TIER_CHIPS } from '@game/ui/map-window';
import { BIOMES, TILE } from '@game/world/biomes';
import { loadRegion } from '@game/world/map';
import { TerrainStream } from '@game/world/overworld/stream';
import { corePack } from '@packs/core';
import pkg from '../../../package.json';

const content = loadGameContent([corePack]);

describe('terrain drawing with a fractional camera (C38 resize RangeError)', () => {
  const map = loadRegion(content, 'core:test-region');
  const stream = new TerrainStream(map, BIOMES[map.biome]);

  it('never writes past the buffer, whatever the camera fraction', () => {
    for (const [w, h] of [
      [481, 271],
      [521, 293],
      [555, 300],
    ] as const) {
      const buf = new PixelBuffer(w, h);
      for (const f of [0.25, 0.5, 0.75, 0.9]) {
        const camX = 40 * TILE - w / 2 + f;
        const camY = 40 * TILE - h / 2 + f;
        expect(() => stream.draw(buf, camX, camY, 0.5)).not.toThrow();
      }
    }
  });

  it('draws a fractional camera like the whole-pixel one below it', () => {
    const a = new PixelBuffer(481, 271);
    const b = new PixelBuffer(481, 271);
    stream.draw(a, 40 * TILE - 240.5, 40 * TILE - 135.5, 0.5);
    stream.draw(b, 40 * TILE - 241, 40 * TILE - 136, 0.5);
    expect(a.data).toEqual(b.data);
  });
});

describe('accessibility pass (C38)', () => {
  it('secondary and warning text reach 4.5:1 on every paper surface, the cursor row too', () => {
    for (const bg of [paper.base, paper.well, paper.shade, paper.cursor, paper.light]) {
      expect(contrastRatio(paper.inkDim, bg), bg.toString(16)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(paper.ink, bg), bg.toString(16)).toBeGreaterThanOrEqual(7);
    }
  });

  it('tier chip labels in the map window reach 4.5:1', () => {
    for (const [tier, chip] of Object.entries(TIER_CHIPS))
      expect(contrastRatio(chip.ink, chip.fill), tier).toBeGreaterThanOrEqual(4.5);
  });

  const memory = (raw?: string) => {
    const m = new Map<string, string>(raw ? [[SETTINGS_KEY, raw]] : []);
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => m.set(k, v),
    };
  };

  it('reduced motion turns shake and flashes off by default', () => {
    expect(defaultSettings()).toEqual(DEFAULT_SETTINGS);
    expect(defaultSettings({ reducedMotion: true })).toMatchObject({
      shake: false,
      flashes: false,
    });
    installSettings(memory(), { reducedMotion: true });
    expect(gameSettings()).toMatchObject({ shake: false, flashes: false, textSpeed: 'normal' });
  });

  it('a stored choice wins over the device hint', () => {
    installSettings(memory(JSON.stringify({ shake: true })), { reducedMotion: true });
    expect(gameSettings()).toMatchObject({ shake: true, flashes: false });
    installSettings(memory());
    expect(gameSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('release (C38)', () => {
  it('shows the package version on the title screen', () => {
    expect(GAME_VERSION).toBe(`v${pkg.version}`);
  });
});
