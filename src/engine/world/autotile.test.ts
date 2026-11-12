import { describe, expect, it } from 'vitest';
import { CornerGrid, cornerMask, coverage, NE, NW, SE, SW, tileIs } from './autotile';

describe('corner autotiling', () => {
  it('stores (W+1)×(H+1) corners and clamps reads outside', () => {
    const g = CornerGrid.from(3, 2, (x, y) => x === 0 && y === 0);
    expect([g.cols, g.rows]).toEqual([4, 3]);
    expect(g.get(-5, -5)).toBe(1);
    expect(g.get(10, 10)).toBe(0);
  });

  it('builds 0–15 masks from the 4 corners', () => {
    const g = CornerGrid.from(2, 2, (x, y) => x === 1 && y === 1); // center corner only
    expect(cornerMask(g, 0, 0)).toBe(SE);
    expect(cornerMask(g, 1, 0)).toBe(SW);
    expect(cornerMask(g, 0, 1)).toBe(NE);
    expect(cornerMask(g, 1, 1)).toBe(NW);
    const full = CornerGrid.from(1, 1, () => true);
    expect(cornerMask(full, 0, 0)).toBe(NW | NE | SW | SE);
    expect(tileIs(full, 0, 0, 1)).toBe(true);
    expect(tileIs(g, 0, 0, 0)).toBe(false);
  });

  it('coverage equals the corner value at corners and blends inside', () => {
    const g = CornerGrid.from(2, 2, (x, y) => x === 1 && y === 1);
    expect(coverage(g, 16, 16, 16)).toBe(1);
    expect(coverage(g, 0, 0, 16)).toBe(0);
    expect(coverage(g, 8, 16, 16)).toBeCloseTo(0.5);
    expect(coverage(g, 8, 8, 16)).toBeCloseTo(0.25);
  });

  it('is continuous across tile borders (seamless edges)', () => {
    const g = CornerGrid.from(4, 4, (x, y) => (x * 7 + y * 3) % 3 === 0);
    for (let y = 0; y < 64; y++) {
      for (const border of [16, 32, 48]) {
        const left = coverage(g, border - 1e-6, y, 16);
        const right = coverage(g, border, y, 16);
        expect(Math.abs(left - right)).toBeLessThan(1e-4);
      }
    }
  });
});
