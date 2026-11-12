import { describe, expect, it } from 'vitest';
import { blendPacked, packColor, PixelBuffer, unpackColor } from './pixel-buffer';
import { bayer4, rampIndex } from './ramp';
import { WeatherSim, type WeatherSpec } from './weather';

describe('pixel buffer', () => {
  it('packs and unpacks colors as RGBA bytes', () => {
    const buf = new PixelBuffer(2, 1);
    buf.data[0] = packColor(0x112233);
    expect([...buf.bytes.slice(0, 4)]).toEqual([0x11, 0x22, 0x33, 0xff]);
    expect(unpackColor(packColor(0xabcdef))).toBe(0xabcdef);
  });

  it('blends toward a color and ignores dots off the buffer', () => {
    expect(unpackColor(blendPacked(packColor(0x000000), 0xffffff, 0.5))).toBe(0x7f7f7f);
    expect(unpackColor(blendPacked(packColor(0x204060), 0xffffff, 0))).toBe(0x204060);
    const buf = new PixelBuffer(2, 2);
    buf.fill(0);
    buf.dot(-1, 0, 0xffffff, 1);
    buf.dot(5, 5, 0xffffff, 1);
    expect(buf.data.every((p) => p === packColor(0))).toBe(true);
  });
});

describe('ramp', () => {
  it('maps light to tones, clamps, and dithers only near band edges', () => {
    expect(rampIndex(4, 0, 0, 0, 3)).toBe(0);
    expect(rampIndex(4, 1, 0, 0, 3)).toBe(3);
    expect(rampIndex(4, -2, 0, 0, 3)).toBe(0);
    expect(rampIndex(1, 0.7, 0, 0, 3)).toBe(0);
    // In the middle of a band every pixel gets the same tone.
    const mid = new Set<number>();
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) mid.add(rampIndex(4, 1 / 3, x, y, 3));
    expect([...mid]).toEqual([1]);
    // On the edge both tones appear (dither).
    const edge = new Set<number>();
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) edge.add(rampIndex(4, 0.5, x, y, 3));
    expect(edge.size).toBe(2);
    // Hard edges without dithering.
    expect(rampIndex(4, 0.49, 3, 3, 99)).toBe(1);
    expect(bayer4(0, 0)).toBeGreaterThan(0);
  });
});

const SPEC: WeatherSpec = {
  haze: { color: 0x334455, alpha: 0.2, wave: { amp: 0.05, freq: 0.03, speed: 1 } },
  layers: [
    {
      count: 50,
      shape: 'streak',
      vx: [-20, -40],
      vy: [200, 300],
      color: 0xffffff,
      alpha: [0.4, 0.8],
      splash: { color: 0xffffff, duration: 0.2 },
    },
    {
      count: 30,
      shape: 'dot',
      vx: [30, 60],
      vy: [10, 20],
      sway: { amp: 5, freq: 2 },
      color: 0x888888,
      alpha: [1, 1],
      bigFrom: 0.5,
    },
  ],
};

function run(seed: string, steps: number): PixelBuffer {
  const sim = new WeatherSim(SPEC, seed, 120, 80);
  for (let i = 0; i < steps; i++) sim.update(1 / 60);
  const buf = new PixelBuffer(120, 80);
  buf.fill(0x102030);
  sim.draw(buf);
  return buf;
}

describe('weather', () => {
  it('is deterministic for a seed', () => {
    expect(run('a', 90).data).toEqual(run('a', 90).data);
    expect(run('a', 90).data).not.toEqual(run('b', 90).data);
  });

  it('keeps every particle near the screen over a long run', () => {
    const sim = new WeatherSim(SPEC, 1, 120, 80);
    expect(sim.count).toBe(80);
    for (let i = 0; i < 60 * 30; i++) sim.update(1 / 60);
    expect(sim.count).toBe(80);
    for (const p of sim.particles()) {
      expect(p.x).toBeGreaterThan(-60);
      expect(p.x).toBeLessThan(200);
      expect(p.y).toBeGreaterThan(-50);
      expect(p.y).toBeLessThan(90);
    }
  });

  it('tints the whole screen with haze', () => {
    const buf = run('a', 0);
    expect(buf.data.every((p) => p !== packColor(0x102030))).toBe(true);
  });

  it('follows a resize', () => {
    const sim = new WeatherSim(SPEC, 1, 100, 100);
    sim.resize(200, 50);
    for (const p of sim.particles()) {
      expect(p.x).toBeLessThanOrEqual(200);
      expect(p.y).toBeLessThanOrEqual(50);
    }
  });
});
