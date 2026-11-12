import { describe, expect, it } from 'vitest';
import { toCss } from '@engine/core/color';
import { logoColors } from '../style/tokens';
import { LOGO_PIXEL_OPTIONS, logoSize, logoSvg, svgDataUrl } from './logo';

/** Minimal well-formedness check: every opened tag is closed in order. */
function balanced(svg: string): boolean {
  const stack: string[] = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) {
    const [, close, name, selfClose] = m;
    if (selfClose) continue;
    if (close) {
      if (stack.pop() !== name) return false;
    } else stack.push(name ?? '');
  }
  return stack.length === 0;
}

describe('logo', () => {
  it('is deterministic and well-formed (full crest and emblem crop)', () => {
    for (const crop of ['full', 'emblem'] as const) {
      const a = logoSvg({ crop });
      expect(logoSvg({ crop })).toBe(a);
      expect(a.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
      expect(balanced(a)).toBe(true);
      expect(a).not.toMatch(/NaN|undefined|Infinity/);
      expect(a).toContain('aria-label="Zoravia"');
    }
  });

  it('draws only geometry (no text/fonts, no external refs)', () => {
    expect(logoSvg()).not.toMatch(/<text|font-family|href="http/);
  });

  it('uses only logo palette colors', () => {
    const allowed = new Set(Object.values(logoColors).map(toCss));
    const used = new Set(logoSvg().match(/#[0-9a-f]{6}/g));
    for (const color of used) expect(allowed.has(color), color).toBe(true);
  });

  it('prefixes internal ids so several logos can share a page', () => {
    const a = logoSvg({ id: 'one' });
    const b = logoSvg({ id: 'two' });
    const ids = (s: string): string[] => [...s.matchAll(/id="([^"]+)"/g)].map((m) => m[1] ?? '');
    expect(ids(a).length).toBeGreaterThan(10);
    expect(ids(a).every((id) => id.startsWith('one-'))).toBe(true);
    expect(ids(a).filter((id) => ids(b).includes(id))).toEqual([]);
    // every url(#…) reference points at an id in the same document
    for (const [, ref] of a.matchAll(/url\(#([^)]+)\)/g)) expect(ids(a)).toContain(ref);
  });

  it('sizes to a requested height keeping the aspect ratio', () => {
    const { width, height } = logoSize();
    expect(width / height).toBeGreaterThan(1.5);
    expect(logoSvg({ height: 60 })).toContain(
      `width="${Math.round((60 * width) / height)}" height="60"`,
    );
    expect(logoSize('emblem').width).toBe(logoSize('emblem').height);
  });

  it('pixel options snap to the logo palette and texture the body', () => {
    expect(new Set(LOGO_PIXEL_OPTIONS.palette)).toEqual(new Set(Object.values(logoColors)));
    expect(LOGO_PIXEL_OPTIONS.texture?.[logoColors.rust]).toBe(logoColors.rustDark);
  });

  it('encodes as a data URL', () => {
    expect(svgDataUrl(logoSvg({ crop: 'emblem' }))).toMatch(
      /^data:image\/svg\+xml;charset=utf-8,%3Csvg/,
    );
  });
});
