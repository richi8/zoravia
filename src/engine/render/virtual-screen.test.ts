import { describe, expect, it } from 'vitest';
import { fitVirtual, toVirtual } from './virtual-screen';

const SCREEN = { width: 480, height: 270 };

describe('fitVirtual', () => {
  it('picks the largest whole-number scale and centers (letterbox)', () => {
    expect(fitVirtual(1920, 1080, 1, SCREEN)).toMatchObject({ scale: 4, x: 0, y: 0 });
    const f = fitVirtual(1280, 800, 1, SCREEN);
    expect(f.scale).toBe(2);
    expect(f).toMatchObject({ x: 160, y: 130, width: 960, height: 540 });
  });

  it('scales in device pixels on HiDPI screens', () => {
    const f = fitVirtual(1280, 720, 2, SCREEN); // 2560×1440 device px
    expect(f.scale).toBe(5);
    expect(f.cssScale).toBe(2.5);
    expect(f.width).toBe(1200);
    // offsets land on whole device pixels
    expect((f.x * 2) % 1).toBe(0);
    expect((f.y * 2) % 1).toBe(0);
  });

  it('handles fractional devicePixelRatio and 4K', () => {
    const f = fitVirtual(1536, 864, 1.25, SCREEN); // 1920×1080 device px
    expect(f.scale).toBe(4);
    expect(fitVirtual(3840, 2160, 1, SCREEN).scale).toBe(8);
  });

  it('never goes below scale 1', () => {
    const f = fitVirtual(300, 200, 1, SCREEN);
    expect(f.scale).toBe(1);
    expect(f.x).toBeLessThan(0);
  });

  it('maps canvas coordinates to game pixels', () => {
    const f = fitVirtual(1280, 800, 1, SCREEN);
    expect(toVirtual(f, 160, 130)).toEqual({ x: 0, y: 0 });
    expect(toVirtual(f, 160 + 959, 130 + 539)).toEqual({ x: 479.5, y: 269.5 });
  });
});
