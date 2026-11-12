import { describe, expect, it } from 'vitest';
import { EASINGS } from './easing';

describe('easing', () => {
  it.each(Object.entries(EASINGS))('%s maps 0 → 0 and 1 → 1', (_name, ease) => {
    expect(ease(0)).toBeCloseTo(0, 9);
    expect(ease(1)).toBeCloseTo(1, 9);
  });

  it('out-easings are ahead of linear at the midpoint, in-easings behind', () => {
    expect(EASINGS.cubicOut(0.5)).toBeGreaterThan(0.5);
    expect(EASINGS.quadIn(0.5)).toBeLessThan(0.5);
    expect(EASINGS.quadInOut(0.5)).toBeCloseTo(0.5, 9);
  });

  it('backOut overshoots', () => {
    const peak = Math.max(...Array.from({ length: 101 }, (_, i) => EASINGS.backOut(i / 100)));
    expect(peak).toBeGreaterThan(1);
  });
});
