import { describe, expect, it } from 'vitest';
import { fitVirtual, toVirtual } from './virtual-screen';

const MIN = { width: 480, height: 270 };

describe('fitVirtual', () => {
  it('uses the largest whole-number scale that keeps at least the minimum size', () => {
    expect(fitVirtual(1920, 1080, 1, MIN)).toEqual({
      scale: 4,
      cssScale: 4,
      width: 480,
      height: 270,
    });
    expect(fitVirtual(3840, 2160, 1, MIN).scale).toBe(8);
  });

  it('fills the window: other shapes show more game pixels, never bars', () => {
    expect(fitVirtual(1440, 900, 1, MIN)).toMatchObject({ scale: 3, width: 480, height: 300 });
    expect(fitVirtual(1280, 800, 1, MIN)).toMatchObject({ scale: 2, width: 640, height: 400 });
    expect(fitVirtual(2560, 1080, 1, MIN)).toMatchObject({ scale: 4, width: 640, height: 270 });
  });

  it('covers odd sizes completely (rounds up)', () => {
    const f = fitVirtual(1001, 701, 1, MIN);
    expect(f.scale).toBe(2);
    expect(f.width * f.scale).toBeGreaterThanOrEqual(1001);
    expect(f.height * f.scale).toBeGreaterThanOrEqual(701);
  });

  it('scales in device pixels on HiDPI screens', () => {
    const f = fitVirtual(1280, 720, 2, MIN); // 2560×1440 device px
    expect(f).toEqual({ scale: 5, cssScale: 2.5, width: 512, height: 288 });
    expect(fitVirtual(1536, 864, 1.25, MIN)).toMatchObject({ scale: 4, width: 480, height: 270 });
  });

  it('never goes below scale 1 (tiny windows show less)', () => {
    expect(fitVirtual(300, 200, 1, MIN)).toMatchObject({ scale: 1, width: 300, height: 200 });
  });

  it('maps canvas coordinates to game pixels', () => {
    const f = fitVirtual(1280, 800, 1, MIN);
    expect(toVirtual(f, 0, 0)).toEqual({ x: 0, y: 0 });
    expect(toVirtual(f, 1279, 799)).toEqual({ x: 639.5, y: 399.5 });
  });
});
