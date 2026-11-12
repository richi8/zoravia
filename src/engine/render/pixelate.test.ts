import { describe, expect, it } from 'vitest';
import { onScalePattern, quantizePixels } from './pixelate';

const px = (...rgba: number[][]): Uint8ClampedArray => new Uint8ClampedArray(rgba.flat());

describe('quantizePixels', () => {
  it('snaps opaque pixels to the nearest palette color', () => {
    const data = px([250, 10, 10, 255], [20, 20, 240, 200]);
    quantizePixels(data, 2, { palette: [0xff0000, 0x0000ff] });
    expect([...data]).toEqual([255, 0, 0, 255, 0, 0, 255, 255]);
  });

  it('makes faint pixels fully transparent', () => {
    const data = px([255, 255, 255, 50], [255, 255, 255, 120]);
    quantizePixels(data, 2, { palette: [0xffffff] });
    expect(data[3]).toBe(0);
    expect(data[7]).toBe(255);
  });

  it('applies the texture only on the pattern and only to mapped colors', () => {
    const width = 8;
    const data = new Uint8ClampedArray(width * 4 * 4);
    for (let i = 0; i < data.length; i += 4) data.set([200, 80, 30, 255], i); // ≈ rust
    quantizePixels(data, width, { palette: [0xc9541c, 0x8e3512], texture: { 0xc9541c: 0x8e3512 } });
    for (let p = 0; p < width * 4; p++) {
      const dark = data[p * 4] === 0x8e;
      expect(dark).toBe(onScalePattern(p % width, Math.floor(p / width)));
    }
  });
});

describe('onScalePattern', () => {
  it('staggers dots on every other row', () => {
    expect(onScalePattern(0, 0)).toBe(true);
    expect(onScalePattern(1, 0)).toBe(false);
    expect(onScalePattern(0, 1)).toBe(false);
    expect(onScalePattern(2, 2)).toBe(true);
    expect(onScalePattern(0, 2)).toBe(false);
  });
});
