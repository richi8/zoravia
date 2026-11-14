import { describe, expect, it } from 'vitest';
import { falloff, LightMap } from './lighting';
import { irisRadius } from './iris';
import { packColor, unpackColor } from './pixel-buffer';

describe('LightMap', () => {
  const frame = (w: number, h: number, rgb: number): Uint32Array =>
    new Uint32Array(w * h).fill(packColor(rgb));

  it('leaves the frame alone in full daylight', () => {
    const map = new LightMap();
    map.begin(4, 4);
    const data = frame(4, 4, 0x808080);
    map.apply(data, { ambient: [1, 1, 1] });
    expect(unpackColor(data[0] ?? 0)).toBe(0x808080);
  });

  it('darkens by the ambient and lifts pixels inside a light', () => {
    const map = new LightMap();
    map.begin(40, 10);
    map.add({ x: 5, y: 5, radius: 8, color: 0xffffff, strength: 1 });
    const data = frame(40, 10, 0x808080);
    map.apply(data, { ambient: [0.5, 0.5, 0.5] });
    const lit = unpackColor(data[5 * 40 + 5] ?? 0) & 0xff;
    const dark = unpackColor(data[5 * 40 + 35] ?? 0) & 0xff;
    expect(dark).toBe(0x40);
    expect(lit).toBeGreaterThan(0x80);
  });

  it('swaps emissive pixels only when nothing was drawn over them', () => {
    const map = new LightMap();
    map.begin(2, 1);
    const data = frame(2, 1, 0x101010);
    const from = data[0] ?? 0;
    map.emit(0, from, packColor(0xffcc00));
    map.emit(1, from, packColor(0xffcc00));
    data[1] = packColor(0x202020); // an actor drawn over the window
    map.apply(data, { ambient: [0.5, 0.5, 0.5] });
    expect(unpackColor(data[0] ?? 0)).toBe(0xffcc00);
    expect(unpackColor(data[1] ?? 0)).toBe(0x101010);
  });

  it('falls off smoothly to nothing at the radius', () => {
    expect(falloff(0)).toBe(1);
    expect(falloff(1)).toBe(0);
    expect(falloff(0.5)).toBeCloseTo(0.5);
  });
});

describe('iris', () => {
  it('is wide open at 0 and closed at 1', () => {
    expect(irisRadius(0, 480, 270, 240, 135)).toBeGreaterThan(Math.hypot(240, 135));
    expect(irisRadius(1, 480, 270, 240, 135)).toBe(0);
  });
});
