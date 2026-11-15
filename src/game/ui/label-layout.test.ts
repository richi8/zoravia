import { describe, expect, it } from 'vitest';
import { placeLabels, type LabelBox } from './label-layout';

const box = (x: number, y: number, priority: number, w = 30): LabelBox => ({
  x,
  y,
  w,
  h: 8,
  priority,
});

describe('placeLabels (C36d)', () => {
  it('keeps labels that do not overlap where they are', () => {
    expect(placeLabels([box(0, 0, 0), box(40, 0, 1)], [0, -14, 9])).toEqual([0, 0]);
  });

  it('moves the lower priority label up or down, and hides it when nothing fits', () => {
    // The secret comes first in the list but the town is placed first.
    expect(placeLabels([box(10, 0, 2), box(0, 0, 0)], [0, -14, 9])).toEqual([-14, 0]);
    const crowd = [box(0, 0, 0), box(0, -14, 0), box(0, 9, 0), box(5, 0, 1)];
    expect(placeLabels(crowd, [0, -14, 9])).toEqual([0, 0, 0, undefined]);
  });

  it('never leaves two placed labels overlapping', () => {
    const boxes = Array.from({ length: 40 }, (_, i) =>
      box((i * 37) % 120, (i * 23) % 60, i % 3, 20 + (i % 4) * 8),
    );
    const dy = placeLabels(boxes, [0, -14, 9]);
    const shown = boxes.flatMap((b, i) =>
      dy[i] === undefined ? [] : [{ ...b, y: b.y + (dy[i] ?? 0) }],
    );
    for (const a of shown)
      for (const b of shown) {
        if (a === b) continue;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap).toBe(false);
      }
    expect(shown.length).toBeGreaterThan(5);
  });
});
