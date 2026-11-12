import { describe, expect, it } from 'vitest';
import * as m from './math';

describe('scalar math', () => {
  it('clamp / clamp01', () => {
    expect(m.clamp(5, 0, 3)).toBe(3);
    expect(m.clamp(-1, 0, 3)).toBe(0);
    expect(m.clamp(2, 0, 3)).toBe(2);
    expect(m.clamp01(1.5)).toBe(1);
  });

  it('lerp / inverseLerp / remap', () => {
    expect(m.lerp(10, 20, 0.25)).toBe(12.5);
    expect(m.inverseLerp(10, 20, 15)).toBe(0.5);
    expect(m.inverseLerp(5, 5, 5)).toBe(0);
    expect(m.remap(5, 0, 10, 100, 200)).toBe(150);
  });

  it('smoothstep', () => {
    expect(m.smoothstep(0, 1, -1)).toBe(0);
    expect(m.smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(m.smoothstep(0, 1, 2)).toBe(1);
  });

  it('mod is non-negative', () => {
    expect(m.mod(-1, 4)).toBe(3);
    expect(m.mod(5, 4)).toBe(1);
  });

  it('approxEqual / roundTo', () => {
    expect(m.approxEqual(0.1 + 0.2, 0.3)).toBe(true);
    expect(m.approxEqual(1, 1.1)).toBe(false);
    expect(m.roundTo(1.23456, 2)).toBe(1.23);
  });
});

describe('Vec2', () => {
  const a = m.vec2(3, 4);
  const b = m.vec2(1, -2);

  it('arithmetic returns new vectors', () => {
    expect(m.add(a, b)).toEqual({ x: 4, y: 2 });
    expect(m.sub(a, b)).toEqual({ x: 2, y: 6 });
    expect(m.scale(a, 2)).toEqual({ x: 6, y: 8 });
    expect(a).toEqual({ x: 3, y: 4 });
  });

  it('dot / length / distance / manhattan', () => {
    expect(m.dot(a, b)).toBe(-5);
    expect(m.length(a)).toBe(5);
    expect(m.distance(a, b)).toBeCloseTo(Math.hypot(2, 6));
    expect(m.manhattan(a, b)).toBe(8);
  });

  it('normalize, including zero vector', () => {
    const n = m.normalize(a);
    expect(n.x).toBeCloseTo(0.6);
    expect(n.y).toBeCloseTo(0.8);
    expect(m.normalize(m.ZERO)).toEqual({ x: 0, y: 0 });
  });

  it('lerpVec / equals', () => {
    expect(m.lerpVec(m.vec2(0, 0), m.vec2(10, 20), 0.5)).toEqual({ x: 5, y: 10 });
    expect(m.equals(a, m.vec2(3, 4))).toBe(true);
    expect(m.equals(a, m.vec2(3.05, 4), 0.1)).toBe(true);
    expect(m.equals(a, b)).toBe(false);
  });
});
