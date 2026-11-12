/**
 * Seeded, deterministic, splittable random number generator.
 *
 * - Algorithm: sfc32 (32-bit state ×4, fast, good statistical quality).
 * - Seeding: numbers or strings, mixed through splitmix32 so similar seeds diverge.
 * - State is a plain `[a, b, c, d]` tuple of uint32 — serializable, so battle state
 *   can carry it and replays stay identical (`getState` / `Rng.fromState`).
 * - `split(label)` derives an independent child stream from the current state and a
 *   label *without* advancing the parent, so adding a new stream never shifts the
 *   numbers an existing stream produces.
 *
 * Never use `Math.random()` in game logic — use an `Rng`.
 */

import { assert, unreachable } from './assert';

export type RngState = readonly [number, number, number, number];
export type Seed = number | string;

/** Deterministic 32-bit hash of a string (FNV-1a followed by a murmur3 finalizer). */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return fmix32(h);
}

function fmix32(input: number): number {
  let h = input >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** splitmix32 step: returns [nextState, output]. */
function splitmix32(state: number): [number, number] {
  const next = (state + 0x9e3779b9) >>> 0;
  let z = next;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
  z ^= z >>> 15;
  return [next, z >>> 0];
}

function seedToU32(seed: Seed): number {
  if (typeof seed === 'string') return hashString(seed);
  assert(Number.isFinite(seed), `Rng seed must be a finite number, got ${seed}`);
  // Fold the high bits in so seeds above 2^32 still matter.
  return (Math.trunc(seed) ^ Math.trunc(seed / 0x1_0000_0000)) >>> 0;
}

function stateFromU32(seed: number): RngState {
  let s = seed;
  const out: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [next, value] = splitmix32(s);
    s = next;
    out.push(value);
  }
  const [a = 0, b = 0, c = 0, d = 0] = out;
  // sfc32 must not start from an all-zero state.
  return a | b | c | d ? [a, b, c, d] : [0x9e3779b9, b, c, d];
}

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: Seed) {
    [this.a, this.b, this.c, this.d] = stateFromU32(seedToU32(seed));
    // Warm up so the first outputs are well mixed.
    for (let i = 0; i < 12; i++) this.nextU32();
  }

  /** Restores a generator from `getState()` output. */
  static fromState(state: RngState): Rng {
    assert(state.length === 4, 'RngState must have 4 entries');
    for (const v of state) {
      assert(Number.isInteger(v) && v >= 0 && v <= 0xffffffff, `Invalid RngState value: ${v}`);
    }
    const rng = Object.create(Rng.prototype) as Rng;
    [rng.a, rng.b, rng.c, rng.d] = state;
    return rng;
  }

  /** Snapshot of the internal state (plain data, JSON-safe). */
  getState(): RngState {
    return [this.a, this.b, this.c, this.d];
  }

  /** Independent copy at the same position. */
  clone(): Rng {
    return Rng.fromState(this.getState());
  }

  /**
   * Derives a child stream from the current state and `label`. Does not advance this
   * generator. Same state + same label → same child; different labels → unrelated streams.
   */
  split(label: Seed): Rng {
    const labelHash = seedToU32(label);
    const mixed =
      fmix32(this.a ^ labelHash) ^
      fmix32(this.b + 0x632be5ab) ^
      fmix32(this.c ^ 0x85157af5) ^
      fmix32(this.d + labelHash);
    return new Rng(mixed >>> 0);
  }

  /** Next raw unsigned 32-bit integer. */
  nextU32(): number {
    const t = (((this.a + this.b) >>> 0) + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = (this.b ^ (this.b >>> 9)) >>> 0;
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = ((this.c << 21) | (this.c >>> 11)) >>> 0;
    this.c = (this.c + t) >>> 0;
    return t;
  }

  /** Float in [0, 1). */
  next(): number {
    return this.nextU32() / 0x1_0000_0000;
  }

  /** Float in [min, max). */
  float(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Integer in [min, max] (both inclusive), without modulo bias. */
  int(min: number, max: number): number {
    assert(Number.isInteger(min) && Number.isInteger(max), 'Rng.int bounds must be integers');
    assert(max >= min, `Rng.int: max (${max}) < min (${min})`);
    const span = max - min + 1;
    assert(span <= 0x1_0000_0000, 'Rng.int range too large');
    if (span === 0x1_0000_0000) return min + this.nextU32();
    // Rejection sampling: discard the top partial bucket.
    const limit = 0x1_0000_0000 - (0x1_0000_0000 % span);
    let x = this.nextU32();
    while (x >= limit) x = this.nextU32();
    return min + (x % span);
  }

  /** True with probability `p` (0..1). `chance(0)` is never true, `chance(1)` always. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Uniformly random element. Throws on an empty array. */
  pick<T>(items: readonly T[]): T {
    assert(items.length > 0, 'Rng.pick: empty array');
    return items[this.int(0, items.length - 1)] as T;
  }

  /**
   * Random element weighted by `weight(item)`. Weights must be finite and ≥ 0,
   * with a positive total.
   */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T {
    let total = 0;
    const weights = items.map((item) => {
      const w = weight(item);
      assert(Number.isFinite(w) && w >= 0, `Rng.weighted: invalid weight ${w}`);
      total += w;
      return w;
    });
    assert(total > 0, 'Rng.weighted: total weight must be > 0');
    let roll = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      const w = weights[i] ?? 0;
      if (roll < w) return items[i] as T;
      roll -= w;
    }
    // Floating-point edge: fall back to the last item with positive weight.
    for (let i = items.length - 1; i >= 0; i--) {
      if ((weights[i] ?? 0) > 0) return items[i] as T;
    }
    return unreachable('Rng.weighted: no positive weight');
  }

  /** Returns a new shuffled array (Fisher–Yates); the input is not modified. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const tmp = out[i] as T;
      out[i] = out[j] as T;
      out[j] = tmp;
    }
    return out;
  }
}
