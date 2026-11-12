import { describe, expect, it } from 'vitest';
import {
  apply,
  boneMatrices,
  invert,
  multiply,
  poseModel,
  transformPrimitive,
  type Rig,
} from './rig';
import { aura, circle, rasterize, silhouette, spriteHash, type SpriteModel } from './sdf-sprite';

const close = (a: readonly number[], b: readonly number[]): void => {
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i] ?? NaN, 6));
};

describe('rig math', () => {
  it('inverts and multiplies affine matrices', () => {
    const m = [0.8, 0.6, -0.6, 0.8, 3, -2] as const;
    close(multiply(m, invert(m)), [1, 0, 0, 1, 0, 0]);
    const [x, y] = apply(m, 5, 7);
    close(apply(invert(m), x, y), [5, 7]);
  });

  it('rotates a bone about its pivot and children follow their parent', () => {
    const rig: Rig = { body: { pivot: [0, 0] }, head: { parent: 'body', pivot: [10, 0] } };
    const mats = boneMatrices(rig, { head: { rot: Math.PI / 2 } });
    // The pivot stays put; a point 5 units right of it swings down (y-down, clockwise).
    close(apply(mats.get('head') ?? [1, 0, 0, 1, 0, 0], 10, 0), [10, 0]);
    close(apply(mats.get('head') ?? [1, 0, 0, 1, 0, 0], 15, 0), [10, 5]);
    const moved = boneMatrices(rig, { body: { x: 2, y: -1 }, head: { rot: Math.PI / 2 } });
    close(apply(moved.get('head') ?? [1, 0, 0, 1, 0, 0], 15, 0), [12, 4]);
  });

  it('scales about the pivot (squash keeps the ground point)', () => {
    const rig: Rig = { body: { pivot: [0, 0] } };
    const m = boneMatrices(rig, { body: { sy: 1.5 } }).get('body') ?? [1, 0, 0, 1, 0, 0];
    close(apply(m, 0, 0), [0, 0]);
    close(apply(m, 0, -10), [0, -15]);
  });

  it('rejects unknown parents and cycles', () => {
    expect(() => boneMatrices({ a: { parent: 'x', pivot: [0, 0] } }, {})).toThrow(/unknown/);
    expect(() =>
      boneMatrices({ a: { parent: 'b', pivot: [0, 0] }, b: { parent: 'a', pivot: [0, 0] } }, {}),
    ).toThrow(/cycle/);
  });

  it('transformed primitives keep exact distances under rotation and move their bounds', () => {
    const c = circle(10, 0, 2);
    const m = boneMatrices({ b: { pivot: [0, 0] } }, { b: { rot: Math.PI / 2 } }).get('b');
    const t = transformPrimitive(c, m ?? [1, 0, 0, 1, 0, 0]);
    expect(t.d(0, 10)).toBeCloseTo(-2);
    expect(t.d(0, 13)).toBeCloseTo(1);
    expect(t.bounds.minY).toBeCloseTo(8);
    expect(t.bounds.maxY).toBeCloseTo(12);
  });
});

describe('posing and effects', () => {
  const model: SpriteModel = {
    ramps: [{ tones: [0xff0000, 0xcc0000, 0x990000, 0x660000], outline: 0x110000 }],
    shapes: [
      { prim: circle(0, -6, 6), ramp: 0, z: 0, bone: 'body' },
      { prim: circle(8, -6, 3), ramp: 0, z: 1, bone: 'arm' },
    ],
  };
  const rig: Rig = { body: { pivot: [0, 0] }, arm: { parent: 'body', pivot: [6, -6] } };
  const view = { minX: -16, minY: -20, maxX: 16, maxY: 4 };
  const draw = (m: SpriteModel) => rasterize(m, { width: 32, height: 24, view });

  it('the rest pose renders exactly like the unposed model', () => {
    expect(spriteHash(draw(poseModel(model, rig, {}, 'body')))).toBe(spriteHash(draw(model)));
  });

  it('a pose changes the pixels deterministically', () => {
    const pose = { arm: { rot: -1 } };
    const a = draw(poseModel(model, rig, pose, 'body'));
    expect(spriteHash(a)).not.toBe(spriteHash(draw(model)));
    expect(spriteHash(draw(poseModel(model, rig, pose, 'body')))).toBe(spriteHash(a));
  });

  it('silhouette and aura only touch the right pixels', () => {
    const s = draw(model);
    const white = silhouette(s, 0xffffff);
    for (let i = 0; i < s.data.length; i += 4) {
      expect(white.data[i + 3]).toBe(s.data[i + 3]);
      if (s.data[i + 3]) expect(white.data[i]).toBe(255);
    }
    const lit = aura(s, [{ color: 0x00ff00 }, { color: 0x00ff00, dither: true }]);
    let added = 0;
    for (let i = 0; i < s.data.length; i += 4) {
      if (s.data[i + 3]) expect([...lit.data.slice(i, i + 4)]).toEqual([...s.data.slice(i, i + 4)]);
      else if (lit.data[i + 3]) added++;
    }
    expect(added).toBeGreaterThan(0);
  });
});
