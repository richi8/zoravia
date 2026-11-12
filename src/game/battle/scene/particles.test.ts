import { describe, expect, it } from 'vitest';
import { lineCells, particleSize, ParticleSystem } from './particles';
import { barCover } from './transition';

describe('particles', () => {
  it('moves particles and drops them at the end of their life', () => {
    const ps = new ParticleSystem();
    ps.spawn({ x: 0, y: 0, vx: 10, ay: 20, life: 0.5, color: 1 });
    ps.spawn({ x: 0, y: 0, life: 0.1, color: 2, size: 4, shrink: true });
    ps.update(0.05);
    expect(ps.count).toBe(2);
    expect(ps.particles[0]?.x).toBeCloseTo(0.5);
    expect(ps.particles[0]?.vy).toBeCloseTo(1);
    const shrinking = ps.particles[1];
    expect(shrinking && particleSize(shrinking)).toBe(2);
    ps.update(0.1);
    expect(ps.count).toBe(1);
    ps.update(1);
    expect(ps.count).toBe(0);
  });

  it('draws lines as connected whole pixels', () => {
    const cells = lineCells(0, 0, 5, 2);
    expect(cells[0]).toEqual([0, 0]);
    expect(cells[cells.length - 1]).toEqual([5, 2]);
    cells.slice(1).forEach(([bx, by], i) => {
      const [ax, ay] = cells[i] ?? [bx, by];
      expect(Math.max(Math.abs(bx - ax), Math.abs(by - ay))).toBe(1);
    });
  });
});

describe('battle transition', () => {
  it('covers every bar fully at full cover, none at zero, later bars later', () => {
    for (let i = 0; i < 18; i++) {
      expect(barCover(0, i, 18)).toBe(0);
      expect(barCover(1, i, 18)).toBe(1);
    }
    expect(barCover(0.4, 0, 18)).toBeGreaterThan(barCover(0.4, 17, 18));
  });
});
