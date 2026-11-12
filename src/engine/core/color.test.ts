import { describe, expect, it } from 'vitest';
import * as c from './color';

describe('color', () => {
  it('converts between number, rgb and css', () => {
    expect(c.toRgb(0x1e2243)).toEqual({ r: 0x1e, g: 0x22, b: 0x43 });
    expect(c.fromRgb({ r: 300, g: -5, b: 16.4 })).toBe(0xff0010);
    expect(c.toCss(0x0000ff)).toBe('#0000ff');
    expect(c.parseHex('#1E2243')).toBe(0x1e2243);
    expect(c.parseHex('abc')).toBe(0xaabbcc);
    expect(() => c.parseHex('#12')).toThrow(/Invalid hex/);
    expect(c.toCssRgba(0xff8000, 0.5)).toBe('rgba(255, 128, 0, 0.5)');
  });

  it('mixes, lightens and darkens', () => {
    expect(c.mix(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(c.mix(0x123456, 0xabcdef, 0)).toBe(0x123456);
    expect(c.mix(0x123456, 0xabcdef, 1)).toBe(0xabcdef);
    expect(c.lighten(0x000000, 1)).toBe(0xffffff);
    expect(c.darken(0xffffff, 1)).toBe(0x000000);
  });

  it('computes WCAG luminance and contrast', () => {
    expect(c.luminance(0x000000)).toBe(0);
    expect(c.luminance(0xffffff)).toBeCloseTo(1, 6);
    expect(c.contrastRatio(0x000000, 0xffffff)).toBeCloseTo(21, 6);
    expect(c.contrastRatio(0x777777, 0x777777)).toBeCloseTo(1, 6);
    // Known reference: #767676 on white ≈ 4.54:1.
    expect(c.contrastRatio(0x767676, 0xffffff)).toBeCloseTo(4.54, 2);
    expect(c.readableOn(0xffff00)).toBe(0x000000);
    expect(c.readableOn(0x000080)).toBe(0xffffff);
  });

  it('measures perceptual distance', () => {
    expect(c.deltaE(0x336699, 0x336699)).toBe(0);
    expect(c.deltaE(0x000000, 0xffffff)).toBeCloseTo(100, 0);
    expect(c.deltaE(0xff0000, 0xfe0000)).toBeLessThan(1);
  });
});

describe('hsl', () => {
  it('round-trips colors through HSL', () => {
    for (const col of [0xff6b3d, 0x3d8bff, 0x4cbf56, 0x808080, 0x000000, 0xffffff, 0xffd23f]) {
      expect(c.deltaE(c.fromHsl(c.toHsl(col)), col)).toBeLessThan(1);
    }
    expect(c.toHsl(0xff0000)).toEqual({ h: 0, s: 1, l: 0.5 });
    expect(c.fromHsl({ h: 240, s: 1, l: 0.5 })).toBe(0x0000ff);
  });

  it('rotates hue along the shorter arc, capped', () => {
    expect(c.rotateHueToward(50, 250, 10)).toBe(40);
    expect(c.rotateHueToward(200, 250, 10)).toBe(210);
    expect(c.rotateHueToward(355, 10, 30)).toBe(10);
  });
});
