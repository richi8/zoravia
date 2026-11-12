import { describe, expect, it } from 'vitest';
import { AssertionError } from './assert';
import { hashString, Rng } from './rng';

const take = (rng: Rng, n: number): number[] => Array.from({ length: n }, () => rng.nextU32());

describe('Rng determinism', () => {
  it('same numeric seed → same sequence', () => {
    expect(take(new Rng(42), 100)).toEqual(take(new Rng(42), 100));
  });

  it('same string seed → same sequence', () => {
    expect(take(new Rng('zoravia'), 100)).toEqual(take(new Rng('zoravia'), 100));
  });

  it('different seeds → different sequences', () => {
    expect(take(new Rng(1), 10)).not.toEqual(take(new Rng(2), 10));
    expect(take(new Rng('a'), 10)).not.toEqual(take(new Rng('b'), 10));
  });

  it('is stable across versions (golden values)', () => {
    // If this fails, the algorithm changed and every saved seed / replay would break.
    // Only update these values deliberately, and log it.
    expect(take(new Rng(12345), 5)).toMatchInlineSnapshot(`
      [
        2142345551,
        3083893245,
        1997626643,
        3123200824,
        1123390551,
      ]
    `);
    expect(hashString('core:emberfox')).toMatchInlineSnapshot(`2188545444`);
  });

  it('all helper methods are deterministic for the same seed', () => {
    const run = (rng: Rng): unknown[] => [
      rng.next(),
      rng.float(-5, 5),
      rng.int(1, 6),
      rng.chance(0.5),
      rng.pick(['a', 'b', 'c']),
      rng.weighted(['x', 'y', 'z'], (s) => (s === 'x' ? 1 : 3)),
      rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8]),
    ];
    expect(run(new Rng('helpers'))).toEqual(run(new Rng('helpers')));
  });
});

describe('Rng state', () => {
  it('getState / fromState resumes exactly', () => {
    const rng = new Rng(7);
    take(rng, 13);
    const state = rng.getState();
    const expected = take(rng, 50);
    expect(take(Rng.fromState(state), 50)).toEqual(expected);
  });

  it('state is JSON-serializable', () => {
    const rng = new Rng('save');
    take(rng, 3);
    const restored = Rng.fromState(JSON.parse(JSON.stringify(rng.getState())));
    expect(take(restored, 20)).toEqual(take(rng, 20));
  });

  it('clone is independent', () => {
    const rng = new Rng(9);
    const copy = rng.clone();
    expect(copy.nextU32()).toBe(rng.nextU32());
    copy.nextU32();
    expect(copy.getState()).not.toEqual(rng.getState());
  });

  it('fromState rejects invalid state', () => {
    expect(() => Rng.fromState([1, 2, 3, -1])).toThrow(AssertionError);
    expect(() => Rng.fromState([1, 2, 3, 0.5])).toThrow(AssertionError);
  });
});

describe('Rng.split (streams)', () => {
  it('does not advance the parent', () => {
    const a = new Rng(100);
    const b = new Rng(100);
    a.split('battle');
    a.split('loot');
    expect(take(a, 20)).toEqual(take(b, 20));
  });

  it('same state + label → same child; different labels → different children', () => {
    const rng = new Rng(100);
    expect(take(rng.split('battle'), 20)).toEqual(take(rng.split('battle'), 20));
    expect(take(rng.split('battle'), 20)).not.toEqual(take(rng.split('loot'), 20));
  });

  it('child differs from the parent stream', () => {
    const rng = new Rng(100);
    expect(take(rng.split('x'), 20)).not.toEqual(take(rng.clone(), 20));
  });

  it('child depends on parent position', () => {
    const rng = new Rng(100);
    const early = take(rng.split('x'), 10);
    rng.nextU32();
    expect(take(rng.split('x'), 10)).not.toEqual(early);
  });

  it('adding a new stream does not shift an existing one', () => {
    const withExtra = new Rng('world');
    withExtra.split('weather');
    const plain = new Rng('world');
    expect(take(withExtra.split('spawns'), 10)).toEqual(take(plain.split('spawns'), 10));
  });
});

describe('Rng ranges and distribution', () => {
  it('next() is in [0, 1)', () => {
    const rng = new Rng(1);
    for (let i = 0; i < 10_000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int() is inclusive and covers the range roughly uniformly', () => {
    const rng = new Rng(2);
    const counts = new Map<number, number>();
    const n = 60_000;
    for (let i = 0; i < n; i++) {
      const v = rng.int(1, 6);
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    for (const c of counts.values()) expect(Math.abs(c - n / 6)).toBeLessThan(n * 0.01);
  });

  it('int() handles single-value and negative ranges', () => {
    const rng = new Rng(3);
    expect(rng.int(5, 5)).toBe(5);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(-3, -1);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThanOrEqual(-1);
    }
  });

  it('int() rejects bad bounds', () => {
    const rng = new Rng(3);
    expect(() => rng.int(5, 1)).toThrow(AssertionError);
    expect(() => rng.int(0.5, 2)).toThrow(AssertionError);
  });

  it('chance() edges', () => {
    const rng = new Rng(4);
    for (let i = 0; i < 1000; i++) {
      expect(rng.chance(0)).toBe(false);
      expect(rng.chance(1)).toBe(true);
    }
  });

  it('weighted() follows weights and never picks zero weight', () => {
    const rng = new Rng(5);
    const items = ['common', 'rare', 'never'] as const;
    const w = { common: 9, rare: 1, never: 0 };
    const counts = { common: 0, rare: 0, never: 0 };
    for (let i = 0; i < 20_000; i++) counts[rng.weighted(items, (x) => w[x])]++;
    expect(counts.never).toBe(0);
    expect(counts.rare / 20_000).toBeCloseTo(0.1, 1);
  });

  it('weighted() rejects zero total and negative weights', () => {
    const rng = new Rng(5);
    expect(() => rng.weighted(['a'], () => 0)).toThrow(AssertionError);
    expect(() => rng.weighted(['a'], () => -1)).toThrow(AssertionError);
  });

  it('pick() throws on empty array', () => {
    expect(() => new Rng(6).pick([])).toThrow(AssertionError);
  });

  it('shuffle() returns a permutation and leaves input untouched', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const out = new Rng(7).shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
    expect(out).not.toEqual(input);
  });

  it('rejects non-finite numeric seeds', () => {
    expect(() => new Rng(Number.NaN)).toThrow(AssertionError);
  });
});
