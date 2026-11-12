import { describe, expect, it } from 'vitest';
import {
  capsule,
  circle,
  ellipse,
  flipX,
  modelBounds,
  polygon,
  rasterize,
  tightBounds,
  intersect,
  spriteHash,
  union,
  type PixelSprite,
  type SpriteModel,
} from './sdf-sprite';

const ramp = (base: number) => ({
  tones: [base + 0x101010, base, base - 0x101010],
  outline: 0x010101,
});
const at = (s: PixelSprite, x: number, y: number): number => {
  const i = (y * s.width + x) * 4;
  return s.data[i + 3]
    ? ((s.data[i] ?? 0) << 16) | ((s.data[i + 1] ?? 0) << 8) | (s.data[i + 2] ?? 0)
    : -1;
};

describe('distance primitives', () => {
  it('circle, ellipse and capsule are negative inside, positive outside', () => {
    expect(circle(0, 0, 5).d(0, 0)).toBe(-5);
    expect(circle(0, 0, 5).d(8, 0)).toBe(3);
    expect(ellipse(0, 0, 10, 4).d(9, 0)).toBeLessThan(0);
    expect(ellipse(0, 0, 10, 4).d(0, 5)).toBeGreaterThan(0);
    const c = capsule(0, 0, 10, 0, 2, 1);
    expect(c.d(5, 0)).toBeCloseTo(-1.5);
    expect(c.d(5, 3)).toBeCloseTo(1.5);
  });

  it('polygon works for both windings', () => {
    const sq: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    for (const pts of [sq, [...sq].reverse()]) {
      const p = polygon(pts);
      expect(p.d(5, 5)).toBeCloseTo(-5);
      expect(p.d(15, 5)).toBeCloseTo(5);
    }
  });

  it('union bounds cover all parts', () => {
    const u = union([circle(0, 0, 1), circle(10, 5, 2)]);
    expect(u.bounds).toEqual({ minX: -1, minY: -1, maxX: 12, maxY: 7 });
    expect(u.d(10, 5)).toBe(-2);
  });
});

describe('rasterize', () => {
  const model: SpriteModel = {
    ramps: [ramp(0x808080), ramp(0x406080)],
    shapes: [
      { prim: circle(0, 0, 8), ramp: 0, z: 0 },
      { prim: circle(6, 0, 4), ramp: 1, z: 1 },
    ],
  };
  const view = { minX: -10, minY: -10, maxX: 10, maxY: 10 };

  it('fills shapes, shades by light, outlines the figure', () => {
    const s = rasterize(model, { width: 20, height: 20, view });
    expect(at(s, 0, 0)).toBe(-1); // corner: transparent
    expect(at(s, 10, 1)).toBe(0x010101); // top edge: outline
    // upper-left lit, lower-right darker
    expect(at(s, 6, 6)).toBe(0x909090);
    expect(at(s, 10, 16)).toBe(0x707070);
    // the front circle draws over the back one
    expect([0x507090, 0x406080, 0x305070]).toContain(at(s, 16, 10));
  });

  it('draws a part line where a front shape meets a different shape behind it', () => {
    const lined = rasterize(model, { width: 20, height: 20, view });
    const plain = rasterize(model, { width: 20, height: 20, view, partLines: false });
    let lines = 0;
    for (let y = 0; y < 20; y++)
      for (let x = 0; x < 20; x++) {
        if (at(lined, x, y) === 0x010101 && at(plain, x, y) !== 0x010101) lines++;
      }
    expect(lines).toBeGreaterThan(4);
  });

  it('is deterministic and flips cleanly', () => {
    const a = rasterize(model, { width: 24, height: 24, view });
    const b = rasterize(model, { width: 24, height: 24, view });
    expect(spriteHash(a)).toBe(spriteHash(b));
    expect(spriteHash(flipX(flipX(a)))).toBe(spriteHash(a));
    expect(spriteHash(flipX(a))).not.toBe(spriteHash(a));
  });

  it('draws stamps only on the figure', () => {
    const s = rasterize(model, {
      width: 20,
      height: 20,
      view,
      stamps: () => [
        {
          x: -5,
          y: -5,
          pixels: [
            [0, 0, 0xff00ff],
            [-8, -8, 0xff00ff],
          ],
        },
      ],
    });
    expect(at(s, 5, 5)).toBe(0xff00ff);
    expect(at(s, 0, 0)).toBe(-1);
  });

  it('finds tight bounds where primitive bounds are loose', () => {
    const lensModel: SpriteModel = {
      ramps: [ramp(0x808080)],
      shapes: [{ prim: intersect(circle(-8, 0, 10), circle(8, 0, 10)), ramp: 0, z: 0 }],
    };
    const t = tightBounds(lensModel);
    expect(t.minX).toBeGreaterThan(-3);
    expect(t.maxX).toBeLessThan(3);
    expect(t.maxY).toBeGreaterThan(5.5);
  });

  it('reports model bounds', () => {
    expect(modelBounds(model)).toEqual({ minX: -8, minY: -8, maxX: 10, maxY: 8 });
  });
});
