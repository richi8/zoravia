import { describe, expect, it } from 'vitest';
import { fbm, hash2, valueNoise } from './noise';

describe('noise', () => {
  it('is deterministic and in [0, 1)', () => {
    for (let i = 0; i < 500; i++) {
      const x = i * 1.37 - 200;
      const y = i * 0.71;
      for (const v of [hash2(i, -i, 5), valueNoise(x, y, 5), fbm(x, y, 5)]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
      expect(valueNoise(x, y, 5)).toBe(valueNoise(x, y, 5));
    }
  });

  it('depends on the seed', () => {
    expect(hash2(3, 4, 1)).not.toBe(hash2(3, 4, 2));
  });

  it('value noise hits the lattice hash at integer points and is smooth between', () => {
    expect(valueNoise(3, 4, 9)).toBe(hash2(3, 4, 9));
    for (let i = 0; i < 200; i++) {
      const x = i * 0.05;
      expect(Math.abs(valueNoise(x + 0.001, 2.3, 9) - valueNoise(x, 2.3, 9))).toBeLessThan(0.01);
    }
  });
});
