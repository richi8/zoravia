/**
 * Design tokens as CSS custom properties (`--z-ink-900`, `--z-type-fire`, `--z-space-md`, …),
 * so DOM pages (the lab, later HTML overlays) share the exact same values.
 */

import { toCss } from '@engine/core/color';
import { tokens, type Tokens } from './tokens';

const kebab = (s: string): string => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** Flat map of variable name → CSS value. */
export function tokensToCssVars(t: Tokens = tokens): Record<string, string> {
  const vars: Record<string, string> = {};
  const colors = (group: string, record: Readonly<Record<string | number, number>>): void => {
    for (const [k, v] of Object.entries(record)) vars[`--z-${group}-${kebab(k)}`] = toCss(v);
  };
  const px = (group: string, record: Readonly<Record<string, number>>): void => {
    for (const [k, v] of Object.entries(record)) vars[`--z-${group}-${kebab(k)}`] = `${v}px`;
  };

  colors('ink', t.ink);
  colors('brand', t.brand);
  colors('logo', t.logoColors);
  colors('semantic', t.semantic);
  colors('surface', t.surface);
  colors('light', t.lightSurface);
  for (const [id, c] of Object.entries(t.typeColors)) {
    vars[`--z-type-${id}`] = toCss(c.base);
    vars[`--z-type-${id}-on`] = toCss(c.on);
  }
  for (const [id, c] of Object.entries(t.conditionColors)) {
    vars[`--z-cond-${id}`] = toCss(c.color);
    vars[`--z-cond-${id}-on`] = toCss(c.on);
  }
  for (const [k, v] of Object.entries(t.fonts)) vars[`--z-font-${k}`] = v;
  px('text', t.fontSize);
  for (const [k, v] of Object.entries(t.fontWeight)) vars[`--z-weight-${k}`] = String(v);
  for (const [k, v] of Object.entries(t.lineHeight)) vars[`--z-leading-${k}`] = String(v);
  px('space', t.space);
  px('radius', t.radius);
  px('border', t.borderWidth);
  for (const [k, v] of Object.entries(t.motion.duration)) {
    vars[`--z-duration-${kebab(k)}`] = `${Math.round(v * 1000)}ms`;
  }
  return vars;
}

/** `:root { --z-…: …; }` stylesheet text. */
export function tokensToCss(t: Tokens = tokens): string {
  const body = Object.entries(tokensToCssVars(t))
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  return `:root {\n${body}\n}\n`;
}

/** Injects the variables into the document (idempotent). */
export function installCssVars(doc: Document = document): void {
  const id = 'zoravia-tokens';
  let el = doc.getElementById(id);
  if (!el) {
    el = doc.createElement('style');
    el.id = id;
    doc.head.appendChild(el);
  }
  el.textContent = tokensToCss();
}
