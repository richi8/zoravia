import { describe, expect, it } from 'vitest';
import {
  bitmapRuns,
  bitmapSize,
  cornerInset,
  roundRectRuns,
  roundStrokeRuns,
  type PixelRun,
} from './pixel-shapes';
import { firstInReadingOrder, nearestInDirection } from './spatial-nav';

/** Rasterizes runs into a set of "x,y" keys. */
function pixels(runs: readonly PixelRun[]): Set<string> {
  const out = new Set<string>();
  for (const r of runs)
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) out.add(`${x},${y}`);
  return out;
}

function grid(runs: readonly PixelRun[], w: number, h: number): string {
  const p = pixels(runs);
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) row += p.has(`${x},${y}`) ? '#' : '.';
    rows.push(row);
  }
  return rows.join('/');
}

describe('pixel shapes', () => {
  it('corner insets', () => {
    expect([0, 1].map((j) => cornerInset(j, 1))).toEqual([1, 0]);
    expect([0, 1, 2].map((j) => cornerInset(j, 2))).toEqual([2, 1, 0]);
    expect(cornerInset(0, 0)).toBe(0);
  });

  it('rounded rect r=1 cuts only the corner pixels', () => {
    expect(grid(roundRectRuns(0, 0, 5, 4, 1), 5, 4)).toBe('.###./#####/#####/.###.');
  });

  it('rounded rect r=2 steps the corners', () => {
    expect(grid(roundRectRuns(0, 0, 6, 6, 2), 6, 6)).toBe(
      '..##../.####./######/######/.####./..##..',
    );
  });

  it('runs do not overlap and stay inside the box', () => {
    const runs = roundRectRuns(3, 4, 20, 9, 2);
    const total = runs.reduce((n, r) => n + r.w * r.h, 0);
    expect(pixels(runs).size).toBe(total);
    for (const r of runs) {
      expect(r.x).toBeGreaterThanOrEqual(3);
      expect(r.x + r.w).toBeLessThanOrEqual(23);
      expect(r.y + r.h).toBeLessThanOrEqual(13);
    }
  });

  it('outline is the border of the filled shape', () => {
    expect(grid(roundStrokeRuns(0, 0, 7, 6, 2), 7, 6)).toBe(
      '..###../.#...#./#.....#/#.....#/.#...#./..###..',
    );
    const fill = pixels(roundRectRuns(0, 0, 12, 8, 2));
    for (const p of pixels(roundStrokeRuns(0, 0, 12, 8, 2))) expect(fill.has(p)).toBe(true);
  });

  it('degenerate sizes', () => {
    expect(roundRectRuns(0, 0, 0, 5)).toEqual([]);
    expect(grid(roundRectRuns(0, 0, 3, 1, 2), 3, 1)).toBe('###');
  });

  it('bitmaps group runs by character', () => {
    const runs = bitmapRuns('##.a/.aa./....');
    expect(runs.get('#')).toEqual([{ x: 0, y: 0, w: 2, h: 1 }]);
    expect(runs.get('a')).toEqual([
      { x: 3, y: 0, w: 1, h: 1 },
      { x: 1, y: 1, w: 2, h: 1 },
    ]);
    expect(bitmapSize('##.a/.aa./..')).toEqual({ width: 4, height: 3 });
  });
});

describe('spatial navigation', () => {
  // 0 1 2
  // 3   4
  const rects = [
    { x: 0, y: 0, width: 10, height: 10 },
    { x: 20, y: 0, width: 10, height: 10 },
    { x: 40, y: 2, width: 10, height: 10 },
    { x: 0, y: 30, width: 10, height: 10 },
    { x: 38, y: 30, width: 10, height: 10 },
  ];

  it('moves along rows and columns', () => {
    expect(nearestInDirection(rects, 0, 'right')).toBe(1);
    expect(nearestInDirection(rects, 1, 'right')).toBe(2);
    expect(nearestInDirection(rects, 0, 'down')).toBe(3);
    expect(nearestInDirection(rects, 2, 'down')).toBe(4);
    expect(nearestInDirection(rects, 3, 'right')).toBe(4);
    expect(nearestInDirection(rects, 4, 'up')).toBe(2);
  });

  it('returns undefined at the edges', () => {
    expect(nearestInDirection(rects, 0, 'left')).toBeUndefined();
    expect(nearestInDirection(rects, 0, 'up')).toBeUndefined();
    expect(nearestInDirection([], 0, 'up')).toBeUndefined();
  });

  it('reading order starts top-left', () => {
    const [, r1, r2, , r4] = rects;
    expect(firstInReadingOrder([r4, r2, r1].filter((r) => r !== undefined))).toBe(2);
    expect(firstInReadingOrder([])).toBeUndefined();
  });
});
