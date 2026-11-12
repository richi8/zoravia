import { describe, expect, it } from 'vitest';
import { emblemSvg, logoSize, logoSvg, svgDataUrl } from './logo';

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
  it('is deterministic and well-formed in both variants', () => {
    for (const variant of ['dark', 'light'] as const) {
      const a = logoSvg({ variant });
      expect(logoSvg({ variant })).toBe(a);
      expect(a.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
      expect(balanced(a)).toBe(true);
      expect(a).not.toMatch(/NaN|undefined/);
      expect(a).toContain('aria-label="Zoravia"');
    }
    expect(logoSvg({ variant: 'dark' })).not.toBe(logoSvg({ variant: 'light' }));
  });

  it('uses variant-specific gradient ids (two logos can share a page)', () => {
    expect(logoSvg({ variant: 'dark' })).toContain('url(#zoravia-logo-dark-fill)');
    expect(logoSvg({ variant: 'light' })).toContain('url(#zoravia-logo-light-fill)');
  });

  it('sizes to a requested height keeping the aspect ratio', () => {
    const { width, height } = logoSize();
    expect(width / height).toBeGreaterThan(3);
    const svg = logoSvg({ height: 60 });
    expect(svg).toContain(`width="${Math.round((60 * width) / height)}" height="60"`);
  });

  it('draws only geometry (no text/fonts, no external refs)', () => {
    for (const svg of [logoSvg(), emblemSvg()]) {
      expect(svg).not.toMatch(/<text|font-family|href="http/);
    }
  });

  it('emblem is square and encodes as a data URL', () => {
    const svg = emblemSvg({ size: 32 });
    expect(svg).toContain('width="32" height="32"');
    expect(balanced(svg)).toBe(true);
    expect(svgDataUrl(svg)).toMatch(/^data:image\/svg\+xml;charset=utf-8,%3Csvg/);
  });
});
