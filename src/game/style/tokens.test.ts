import { describe, expect, it } from 'vitest';
import { contrastRatio, deltaE } from '@engine/core/color';
import { EASINGS } from '@engine/core/easing';
import { tokensToCss, tokensToCssVars } from './css';
import { createUiTheme } from './theme';
import {
  CONDITION_IDS,
  TYPE_IDS,
  brand,
  conditionColors,
  lightSurface,
  motion,
  paper,
  surface,
  typeColors,
} from './tokens';

const pairs = <T>(xs: readonly T[]): [T, T][] =>
  xs.flatMap((a, i) => xs.slice(i + 1).map((b): [T, T] => [a, b]));

describe('design tokens', () => {
  it('has exactly the 8 DESIGN.md types and conditions', () => {
    expect(Object.keys(typeColors).sort()).toEqual([...TYPE_IDS].sort());
    expect(Object.keys(conditionColors).sort()).toEqual([...CONDITION_IDS].sort());
    // Each type applies exactly one condition.
    expect(new Set(CONDITION_IDS.map((id) => conditionColors[id].type)).size).toBe(8);
  });

  it('keeps type colors clearly distinct from each other', () => {
    for (const [a, b] of pairs(TYPE_IDS)) {
      expect(deltaE(typeColors[a].base, typeColors[b].base), `${a} vs ${b}`).toBeGreaterThan(20);
    }
  });

  it('keeps condition colors clearly distinct from each other', () => {
    for (const [a, b] of pairs(CONDITION_IDS)) {
      const d = deltaE(conditionColors[a].color, conditionColors[b].color);
      expect(d, `${a} vs ${b}`).toBeGreaterThan(15);
    }
  });

  it('labels on type badges and condition chips are readable (≥ 4.5:1)', () => {
    for (const id of TYPE_IDS) {
      const t = typeColors[id];
      expect(contrastRatio(t.on, t.base), id).toBeGreaterThanOrEqual(4.5);
    }
    for (const id of CONDITION_IDS) {
      const c = conditionColors[id];
      expect(contrastRatio(c.on, c.color), id).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('type and condition colors stand out from the dark UI (≥ 3:1)', () => {
    for (const id of TYPE_IDS) {
      expect(contrastRatio(typeColors[id].base, surface.base), id).toBeGreaterThanOrEqual(3);
    }
    for (const id of CONDITION_IDS) {
      if (id === 'muddy') continue; // dark by nature; always drawn with a light outline/label
      expect(contrastRatio(conditionColors[id].color, surface.base), id).toBeGreaterThanOrEqual(3);
    }
  });

  it('UI text meets WCAG AA on its surfaces', () => {
    for (const bg of [surface.background, surface.base, surface.raised]) {
      expect(contrastRatio(surface.text, bg)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(surface.textDim, bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(surface.cursorText, surface.cursorBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(brand.sunbeam, surface.base)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(lightSurface.text, lightSurface.background)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(lightSurface.textDim, lightSurface.background)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it('storybook paper UI text is readable', () => {
    for (const bg of [paper.base, paper.well]) {
      expect(contrastRatio(paper.ink, bg)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(paper.inkDim, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(paper.title, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(paper.warn, bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(paper.ink, paper.cursor)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(paper.keyInk, paper.key)).toBeGreaterThanOrEqual(4.5);
    // Disabled text is decorative but must still be visibly lighter than normal text.
    expect(contrastRatio(paper.inkDisabled, paper.base)).toBeLessThan(
      contrastRatio(paper.inkDim, paper.base),
    );
    expect(contrastRatio(paper.inkDisabled, paper.base)).toBeGreaterThanOrEqual(1.8);
  });

  it('motion easings name real easing functions; durations fit the design', () => {
    for (const name of Object.values(motion.easing)) expect(EASINGS[name]).toBeTypeOf('function');
    expect(motion.duration.battleActionMax).toBeLessThanOrEqual(1.5);
    for (const v of Object.values(motion.duration)) expect(v).toBeGreaterThan(0);
  });
});

describe('derived outputs', () => {
  it('builds the UI theme from tokens', () => {
    const theme = createUiTheme();
    expect(theme.colors.text).toBe(surface.text);
    expect(theme.colors.cursorBg).toBe(surface.cursorBg);
    expect(theme.font.family).toContain('Nunito');
    expect(theme.motion.textSpeed).toBe(motion.text.charsPerSecond);
  });

  it('builds the storybook game-screen theme', () => {
    const theme = createUiTheme({ screen: true });
    expect(theme.colors.panel).toBe(paper.base);
    expect(theme.colors.text).toBe(paper.ink);
    expect(theme.colors.cursorBg).toBe(paper.cursor);
    expect(theme.skin).toBeDefined();
    expect(theme.font.size).toBeLessThanOrEqual(12);
  });

  it('exposes tokens as CSS variables', () => {
    const vars = tokensToCssVars();
    expect(vars['--z-ink-900']).toBe('#14172e');
    expect(vars['--z-type-fire']).toBe('#ff6b3d');
    expect(vars['--z-cond-wet']).toBe('#4fb3ff');
    expect(vars['--z-surface-text-dim']).toBe('#a3a9c8');
    expect(vars['--z-space-md']).toBe('12px');
    expect(vars['--z-paper-base']).toBe('#f6ead0');
    expect(vars['--z-text-2xl']).toBe('32px');
    expect(vars['--z-duration-hit-stop']).toBe('60ms');
    expect(vars['--z-font-display']).toContain('Fredoka');
    for (const v of Object.values(vars)) expect(v).not.toMatch(/undefined|NaN/);
    expect(tokensToCss()).toMatch(/^:root \{\n {2}--z-/);
  });
});
