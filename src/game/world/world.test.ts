import { describe, expect, it } from 'vitest';
import { contrastRatio, deltaE } from '@engine/core/color';
import { CornerGrid } from '@engine/world/autotile';
import { packColor, PixelBuffer } from '@engine/render/pixel-buffer';
import { WeatherSim } from '@engine/render/weather';
import { TerrainRenderer } from './animate';
import { BIOME_IDS, BIOMES, TILE } from './biomes';
import { buildProp, Painter, PROP_INFO, type PropKind } from './props';
import { bakeTerrain, LIQUID_STRIDE, type TerrainMap } from './terrain';
import { WEATHER, WEATHER_IDS } from './weather';

/** 8×6 tiles: a pond in the middle, a path along the bottom, a tree and tall grass. */
function testMap(): TerrainMap {
  return {
    width: 8,
    height: 6,
    seed: 5,
    liquid: CornerGrid.from(8, 6, (x, y) => x >= 3 && x <= 5 && y >= 1 && y <= 3),
    path: CornerGrid.from(8, 6, (_x, y) => y === 6),
    alt: CornerGrid.from(8, 6, (x) => x === 0),
    props: [
      { kind: 'tree', tx: 1, ty: 2, variant: 3 },
      { kind: 'rock', tx: 7, ty: 4 },
      { kind: 'pad', tx: 4, ty: 2 },
    ],
    tall: [[6, 1]],
  };
}

describe('biome palettes', () => {
  it('every biome has ramps for every material, dark → light', () => {
    for (const id of BIOME_IDS) {
      for (const ramp of Object.values(BIOMES[id].ramps)) {
        expect(ramp.length).toBeGreaterThanOrEqual(3);
        for (let i = 1; i < ramp.length; i++) {
          expect(contrastRatio(ramp[i] ?? 0, 0)).toBeGreaterThan(
            contrastRatio(ramp[i - 1] ?? 0, 0),
          );
        }
      }
    }
  });

  it('ground, path and liquid read as different surfaces', () => {
    for (const id of BIOME_IDS) {
      const { ramps } = BIOMES[id];
      const mid = (r: readonly number[]): number => r[Math.floor(r.length / 2)] ?? 0;
      expect(deltaE(mid(ramps.ground), mid(ramps.path))).toBeGreaterThan(10);
      expect(deltaE(mid(ramps.ground), mid(ramps.liquid))).toBeGreaterThan(20);
    }
  });
});

describe('props', () => {
  it('are deterministic, outlined and fit their sprite', () => {
    const painter = new Painter(BIOMES.forest);
    for (const kind of Object.keys(PROP_INFO) as PropKind[]) {
      const a = buildProp(painter, kind, 2);
      const b = buildProp(new Painter(BIOMES.forest), kind, 2);
      expect(a.data).toEqual(b.data);
      expect(a.data.length).toBe(a.width * a.height);
      if (kind !== 'flowers') expect(a.data.some((p) => p !== 0)).toBe(true);
    }
    // The tree has a tinted outline (darker than any of its fill tones).
    const tree = buildProp(painter, 'tree', 0);
    expect(tree.data.includes(painter.outline('foliage'))).toBe(true);
  });
});

describe('terrain bake', () => {
  it('is deterministic', () => {
    const a = bakeTerrain(testMap(), BIOMES.forest);
    const b = bakeTerrain(testMap(), BIOMES.forest);
    expect(a.base).toEqual(b.base);
    expect(a.overlay).toEqual(b.overlay);
    expect(a.liquid).toEqual(b.liquid);
  });

  it('records liquid pixels with a bank around them and leaves them out of the base', () => {
    const map = testMap();
    const bake = bakeTerrain(map, BIOMES.forest);
    expect(bake.liquid.length % LIQUID_STRIDE).toBe(0);
    const pond = bake.liquid.length / LIQUID_STRIDE;
    expect(pond).toBeGreaterThan(TILE * TILE * 2);
    // Center of the pond is liquid, a corner of the map is not.
    const isLiquid = new Set<number>();
    for (let j = 0; j < bake.liquid.length; j += LIQUID_STRIDE) isLiquid.add(bake.liquid[j] ?? -1);
    expect(isLiquid.has(2 * TILE * bake.width + 4 * TILE)).toBe(true);
    expect(isLiquid.has(0)).toBe(false);
    for (const i of isLiquid) expect(bake.base[i]).toBe(0);
    // Bank tones appear in the base.
    const bank = new Set(new Painter(BIOMES.forest).ramp('bank'));
    expect(bake.base.some((p) => bank.has(p))).toBe(true);
  });

  it('bakes in chunks that join without seams', () => {
    const map = testMap();
    const whole = bakeTerrain(map, BIOMES.desert);
    const left = bakeTerrain(map, BIOMES.desert, { x: 0, y: 0, width: 3, height: 6 });
    const right = bakeTerrain(map, BIOMES.desert, { x: 3, y: 0, width: 5, height: 6 });
    for (let y = 0; y < whole.height; y++) {
      for (let x = 0; x < whole.width; x++) {
        const part = x < left.width ? left : right;
        const i = y * part.width + (x - (part.x - whole.x));
        expect(part.base[i]).toBe(whole.base[y * whole.width + x]);
        expect(part.overlay[i]).toBe(whole.overlay[y * whole.width + x]);
      }
    }
  });

  it('records tall-grass tufts on their tiles', () => {
    const bake = bakeTerrain(testMap(), BIOMES.forest);
    expect(bake.tufts.length).toBe(6);
    for (const t of bake.tufts) {
      expect(Math.floor(t.x / TILE)).toBe(6);
      expect(Math.floor(t.y / TILE)).toBe(1);
    }
  });
});

describe('terrain animation', () => {
  it('animates liquid and grass over time but keeps the ground still', () => {
    for (const id of BIOME_IDS) {
      const map = testMap();
      const r = new TerrainRenderer(bakeTerrain(map, BIOMES[id]), BIOMES[id], map.seed);
      const frame = (t: number): Uint32Array => {
        const buf = new PixelBuffer(map.width * TILE, map.height * TILE);
        r.draw(buf, 0, 0, t);
        return buf.data;
      };
      const a = frame(0);
      const b = frame(1.3);
      expect(a).toEqual(frame(0));
      expect(a).not.toEqual(b);
      expect(a[0]).toBe(b[0]); // top-left is plain ground
    }
  });

  it('draws with a camera offset and clips at the screen edge', () => {
    const map = testMap();
    const r = new TerrainRenderer(bakeTerrain(map, BIOMES.frozen), BIOMES.frozen, map.seed);
    const full = new PixelBuffer(map.width * TILE, map.height * TILE);
    r.draw(full, 0, 0, 0.5);
    const shifted = new PixelBuffer(40, 30);
    shifted.fill(0x000000);
    r.draw(shifted, 20, 10, 0.5);
    expect(shifted.data[0]).toBe(full.data[10 * full.width + 20]);
    const outside = new PixelBuffer(10, 10);
    outside.fill(0x123456);
    r.draw(outside, -100, -100, 0);
    expect(outside.data.every((p) => p === packColor(0x123456))).toBe(true);
  });
});

describe('weather presets', () => {
  it('every preset runs and draws', () => {
    for (const id of WEATHER_IDS) {
      const sim = new WeatherSim(WEATHER[id], id, 480, 270);
      for (let i = 0; i < 120; i++) sim.update(1 / 60);
      const buf = new PixelBuffer(480, 270);
      buf.fill(0x406080);
      sim.draw(buf);
      const changed = buf.data.some((p) => p !== packColor(0x406080));
      expect(changed).toBe(id !== 'clear');
    }
  });

  it('each biome defaults to its weather', () => {
    expect(BIOME_IDS.map((id) => BIOMES[id].weather)).toEqual(['rain', 'ash', 'snow']);
  });
});
