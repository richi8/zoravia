import { describe, expect, it } from 'vitest';
import { semantic } from '../style/tokens';
import { HpBar, hpColor } from './bars';

describe('HP bar', () => {
  it('colors by ratio', () => {
    expect(hpColor(1)).toBe(semantic.hpHigh);
    expect(hpColor(0.5)).toBe(semantic.hpMid);
    expect(hpColor(0.2)).toBe(semantic.hpLow);
  });

  it('drains smoothly to the target, then settles', () => {
    const bar = new HpBar(60);
    bar.set(1, false);
    expect(bar.animating).toBe(false);
    bar.set(0.4);
    expect(bar.ratio).toBe(0.4);
    expect(bar.animating).toBe(true);
    let t = 0;
    while (bar.animating && t < 5) {
      bar.update(1 / 60);
      t += 1 / 60;
    }
    expect(bar.animating).toBe(false);
    // 0.6 of the bar at 0.9/s plus the ghost hold: about a second, well under the 1.5 s limit.
    expect(t).toBeGreaterThan(0.6);
    expect(t).toBeLessThan(1.5);
  });

  it('heals upward without a ghost and clamps', () => {
    const bar = new HpBar(60);
    bar.set(0.2, false);
    bar.set(2);
    expect(bar.ratio).toBe(1);
    for (let i = 0; i < 120; i++) bar.update(1 / 60);
    expect(bar.animating).toBe(false);
  });
});
