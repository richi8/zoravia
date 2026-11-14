import { spriteHash, type PixelSprite } from '@engine/render/sdf-sprite';
import { describe, expect, it } from 'vitest';
import { TYPE_IDS } from '../style/tokens';
import { toHsl } from '@engine/core/color';
import {
  BODY_PLANS,
  CLASSIC_PLANS,
  generateGenome,
  MOODS,
  PART_KINDS,
  zorlingGenomeSchema,
} from './genome';
import { renderZorling } from './render';

const opaque = (s: PixelSprite): number => {
  let n = 0;
  for (let i = 3; i < s.data.length; i += 4) if (s.data[i]) n++;
  return n;
};

/** Rows/columns that contain at least one opaque pixel. */
const extent = (s: PixelSprite) => {
  let minX = s.width;
  let maxX = -1;
  let minY = s.height;
  let maxY = -1;
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      if (!s.data[(y * s.width + x) * 4 + 3]) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, maxX, minY, maxY };
};

describe('genome', () => {
  it('same seed + options → same genome', () => {
    expect(generateGenome('emberfox')).toEqual(generateGenome('emberfox'));
    expect(generateGenome(42, { plan: 'blob' })).toEqual(generateGenome(42, { plan: 'blob' }));
    expect(generateGenome('a')).not.toEqual(generateGenome('b'));
  });

  it('respects forced plan and type', () => {
    for (const plan of BODY_PLANS) {
      for (const type of TYPE_IDS) {
        const g = generateGenome(`${plan}-${type}`, { plan, type });
        expect(g.plan).toBe(plan);
        expect(g.types[0]).toBe(type);
        expect(new Set(g.types).size).toBe(g.types.length);
      }
    }
  });

  it('is plain JSON that validates against the schema', () => {
    for (let i = 0; i < 50; i++) {
      const g = generateGenome(i);
      const copy: unknown = JSON.parse(JSON.stringify(g));
      expect(zorlingGenomeSchema.parse(copy)).toEqual(g);
    }
    expect(() => zorlingGenomeSchema.parse({ ...generateGenome(1), plan: 'unicorn' })).toThrow();
  });

  it('rolls every mood, respects a forced mood, and dark Zorlings are dark with glowing eyes', () => {
    const seen = new Set(Array.from({ length: 200 }, (_, i) => generateGenome(i).mood));
    expect([...seen].sort()).toEqual([...MOODS].sort());
    for (let i = 0; i < 30; i++) {
      const g = generateGenome(`dark${i}`, { mood: 'dark' });
      expect(g.mood).toBe('dark');
      expect(toHsl(g.palette.primary).l).toBeLessThan(0.3);
      expect(toHsl(g.palette.eye).l).toBeGreaterThan(0.5);
    }
  });

  it('a numeric seed is stored as-is; string seeds become numbers', () => {
    expect(generateGenome(1234).seed).toBe(1234);
    expect(Number.isInteger(generateGenome('x').seed)).toBe(true);
  });

  it('uses every part kind across many seeds (the library is reachable)', () => {
    const seen = new Map<string, Set<string>>();
    for (let i = 0; i < 2000; i++) {
      const plan = BODY_PLANS[i % BODY_PLANS.length];
      const g = generateGenome(i, plan ? { plan } : {});
      for (const [slot, kind] of Object.entries(g.parts)) {
        if (!seen.has(slot)) seen.set(slot, new Set());
        seen.get(slot)?.add(kind);
      }
    }
    for (const [slot, kinds] of Object.entries(PART_KINDS)) {
      expect([...(seen.get(slot) ?? [])].sort()).toEqual([...kinds].sort());
    }
  });
});

describe('renderZorling', () => {
  it('same genome → identical pixels, also after a JSON round-trip', () => {
    const g = generateGenome('zoravia:0');
    const again = zorlingGenomeSchema.parse(JSON.parse(JSON.stringify(g)));
    expect(spriteHash(renderZorling(again))).toBe(spriteHash(renderZorling(g)));
    expect(spriteHash(renderZorling(again, { size: 32 }))).toBe(
      spriteHash(renderZorling(g, { size: 32 })),
    );
  });

  it('different genomes look different', () => {
    const hashes = new Set(
      Array.from({ length: 24 }, (_, i) => spriteHash(renderZorling(generateGenome(i)))),
    );
    expect(hashes.size).toBe(24);
  });

  it('every body plan renders at battle and overworld size, filling the frame, feet down', () => {
    for (const plan of BODY_PLANS) {
      for (let i = 0; i < 12; i++) {
        const g = generateGenome(`${plan}:${i}`, { plan });
        for (const size of [96, 32]) {
          const s = renderZorling(g, { size });
          expect(s.width).toBe(size);
          expect(s.height).toBe(size);
          expect(opaque(s)).toBeGreaterThan(size * size * 0.12);
          const e = extent(s);
          // fitted: the larger dimension spans the frame (±2 px), feet on the bottom rows
          expect(Math.max(e.maxX - e.minX, e.maxY - e.minY)).toBeGreaterThanOrEqual(size - 4);
          expect(e.maxY).toBeGreaterThanOrEqual(size - 3);
        }
      }
    }
    // Renders ~550 sprites: ~3 s alone, over the 5 s default when the whole suite runs in parallel.
  }, 20_000);

  it('battle sprite uses a limited palette (pixel art, no anti-aliasing)', () => {
    for (let i = 0; i < 10; i++) {
      const s = renderZorling(generateGenome(i));
      const colors = new Set<number>();
      for (let p = 0; p < s.data.length; p += 4) {
        if (s.data[p + 3] === 0) continue;
        expect(s.data[p + 3]).toBe(255);
        colors.add(((s.data[p] ?? 0) << 16) | ((s.data[p + 1] ?? 0) << 8) | (s.data[p + 2] ?? 0));
      }
      expect(colors.size).toBeLessThanOrEqual(40);
    }
  });
});

describe('model kits (C35a)', () => {
  it('without a kit, plans roll from the classic set and parts are unchanged', () => {
    for (let i = 0; i < 60; i++) {
      const g = generateGenome(i);
      expect(CLASSIC_PLANS).toContain(g.plan);
      expect(generateGenome(i, { parts: {} })).toEqual(g);
    }
  });

  it('rolls the plan from the kit, and adds or removes part kinds', () => {
    const plans = ['crab', 'jelly'] as const;
    for (let i = 0; i < 40; i++) {
      expect(plans).toContain(generateGenome(i, { plans }).plan);
      const g = generateGenome(i, { plan: 'feline', parts: { back: { icicles: 50, none: 0 } } });
      expect(g.parts.back).not.toBe('none');
    }
    const icy = Array.from({ length: 40 }, (_, i) =>
      generateGenome(i, { plan: 'feline', parts: { back: { icicles: 50 } } }),
    );
    expect(icy.filter((g) => g.parts.back === 'icicles').length).toBeGreaterThan(25);
  });

  it('leaves slots the plan fixes alone, and falls back when a kit removes everything', () => {
    for (let i = 0; i < 20; i++) {
      // A scorpion always has its stinger; an avian always its beak.
      expect(
        generateGenome(i, { plan: 'scorpion', parts: { tail: { stinger: 0 } } }).parts.tail,
      ).toBe('stinger');
      expect(generateGenome(i, { plan: 'avian', parts: { snout: { short: 9 } } }).parts.snout).toBe(
        'beak',
      );
      const allGone = { pointy: 0, tuft: 0, round: 0 } as const;
      expect(['pointy', 'tuft', 'round']).toContain(
        generateGenome(i, { plan: 'feline', parts: { ears: allGone } }).parts.ears,
      );
    }
  });
});
