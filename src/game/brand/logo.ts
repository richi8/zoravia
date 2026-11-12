/**
 * The Zoravia logo, generated in code as SVG geometry (no font files involved, so it renders
 * identically in the DOM, as a favicon and as a Pixi texture).
 *
 * Wordmark: chunky stroke-built letters with round caps and joins. The "O" is the emblem — a
 * ring around three swirling petals, one per launch region (forest-lake teal, volcanic ember,
 * frozen-coast ice).
 *
 * Variants: `dark` (for dark backgrounds: gold fill, ink outline) and `light` (for light
 * backgrounds: teal fill, ink outline, softer shadow).
 */

import { toCss } from '@engine/core/color';
import { brand, ink, typeColors } from '../style/tokens';

export type LogoVariant = 'dark' | 'light';

/** Cap height of the letter centerlines, in logo units. */
const CAP = 100;
/** Letter stroke width. */
const STROKE = 24;
/** Extra outline width around each stroke (total, both sides). */
const OUTLINE = 14;
/** Drop-shadow offset (down). */
const SHADOW_Y = 8;
/** Default gap between letter centerline extents. */
const GAP = STROKE + 16;

interface Glyph {
  readonly width: number;
  /** Centerline path(s), origin at the glyph's top-left. */
  readonly d: string;
  /** Gap override before the next glyph (kerning). */
  readonly kernAfter?: number;
}

const GLYPHS = {
  Z: { width: 64, d: 'M0 0H64L0 100H64' },
  R: { width: 62, d: 'M0 100V0H34A25 25 0 0 1 34 50H0M30 50L62 100' },
  A: { width: 70, d: 'M0 100L35 0L70 100M13 64H57' },
  V: { width: 70, d: 'M0 0L35 100L70 0' },
  I: { width: 0, d: 'M0 0V100' },
} as const satisfies Record<string, Glyph>;

/** The "O": its centerline circle spans the full cap height. */
const EMBLEM_R = CAP / 2;

type Piece = { kind: 'glyph'; x: number; glyph: Glyph } | { kind: 'emblem'; x: number };

/** Petal (teardrop with a swirl), pointing up from the origin. */
const PETAL = 'M0 0C15 -6 21 -24 3 -35C-9 -28 -12 -12 0 0Z';
const PETAL_COLORS = [typeColors.nature.base, brand.ember, typeColors.ice.base] as const;

function layout(): { pieces: Piece[]; width: number } {
  const pieces: Piece[] = [];
  let x = 0;
  const seq = ['Z', 'O', 'R', 'A', 'V', 'I', 'A'] as const;
  seq.forEach((ch, i) => {
    if (ch === 'O') {
      pieces.push({ kind: 'emblem', x });
      x += EMBLEM_R * 2;
    } else {
      const glyph: Glyph = GLYPHS[ch];
      pieces.push({ kind: 'glyph', x, glyph });
      x += glyph.width;
    }
    if (i < seq.length - 1) {
      // A→V overlap their diagonals; tighten that pair.
      x += ch === 'A' && seq[i + 1] === 'V' ? 12 : GAP;
    }
  });
  return { pieces, width: x };
}

const PAD = (STROKE + OUTLINE) / 2 + 6;

/** Logo size in logo units (viewBox), including outline and shadow. */
export function logoSize(): { width: number; height: number } {
  return { width: layout().width + PAD * 2, height: CAP + PAD * 2 + SHADOW_Y };
}

function strokes(pieces: Piece[], dy: number): string {
  return pieces
    .map((p) =>
      p.kind === 'glyph'
        ? `<path transform="translate(${p.x} ${dy})" d="${p.glyph.d}"/>`
        : `<circle cx="${p.x + EMBLEM_R}" cy="${EMBLEM_R + dy}" r="${EMBLEM_R}"/>`,
    )
    .join('');
}

function petals(cx: number, cy: number, scale: number): string {
  const rings = PETAL_COLORS.map(
    (color, i) =>
      `<path transform="translate(${cx} ${cy}) rotate(${i * 120 + 15}) scale(${scale})" ` +
      `d="${PETAL}" fill="${toCss(color)}" stroke="${toCss(ink[950])}" stroke-width="${2 / scale}" stroke-linejoin="round"/>`,
  ).join('');
  return rings + `<circle cx="${cx}" cy="${cy}" r="${5 * scale}" fill="#ffffff"/>`;
}

interface Palette {
  fillTop: number;
  fillBottom: number;
  outline: number;
  shadow: number;
  shadowAlpha: number;
  core: number;
  rim: number | undefined;
}

const PALETTES: Record<LogoVariant, Palette> = {
  dark: {
    fillTop: brand.logoTop,
    fillBottom: brand.logoBottom,
    outline: ink[950],
    shadow: 0x000000,
    shadowAlpha: 0.55,
    core: ink[900],
    rim: ink[600],
  },
  light: {
    fillTop: brand.lagoon,
    fillBottom: brand.lagoonDeep,
    outline: ink[900],
    shadow: ink[700],
    shadowAlpha: 0.25,
    core: ink[900],
    rim: undefined,
  },
};

export interface LogoOptions {
  readonly variant?: LogoVariant;
  /** Rendered height in px (width follows the aspect ratio). Omit for a fluid SVG. */
  readonly height?: number;
}

/** The full wordmark as an SVG document string. Deterministic. */
export function logoSvg(options: LogoOptions = {}): string {
  const variant = options.variant ?? 'dark';
  const pal = PALETTES[variant];
  const { pieces } = layout();
  const size = logoSize();
  const id = `zoravia-logo-${variant}`;
  const emblem = pieces.find((p) => p.kind === 'emblem');
  const ex = (emblem?.x ?? 0) + EMBLEM_R;
  const dims =
    options.height === undefined
      ? ''
      : ` width="${Math.round((options.height * size.width) / size.height)}" height="${options.height}"`;
  const common = `fill="none" stroke-linecap="round" stroke-linejoin="round"`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-PAD} ${-PAD} ${size.width} ${size.height}"${dims} role="img" aria-label="Zoravia">` +
    `<defs><linearGradient id="${id}-fill" x1="0" y1="${-STROKE / 2}" x2="0" y2="${CAP + STROKE / 2}" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="${toCss(pal.fillTop)}"/><stop offset="1" stop-color="${toCss(pal.fillBottom)}"/>` +
    `</linearGradient></defs>` +
    // Shadow, optional rim, outline, gradient fill, gloss.
    `<g ${common} stroke="${toCss(pal.shadow)}" stroke-opacity="${pal.shadowAlpha}" stroke-width="${STROKE + OUTLINE}">${strokes(pieces, SHADOW_Y)}</g>` +
    (pal.rim === undefined
      ? ''
      : `<g ${common} stroke="${toCss(pal.rim)}" stroke-width="${STROKE + OUTLINE + 6}">${strokes(pieces, 0)}</g>`) +
    `<g ${common} stroke="${toCss(pal.outline)}" stroke-width="${STROKE + OUTLINE}">${strokes(pieces, 0)}</g>` +
    `<circle cx="${ex}" cy="${EMBLEM_R}" r="${EMBLEM_R}" fill="${toCss(pal.core)}"/>` +
    `<g ${common} stroke="url(#${id}-fill)" stroke-width="${STROKE}">` +
    `${strokes(pieces, 0)}</g>` +
    `<g ${common} stroke="#ffffff" stroke-opacity="0.35" stroke-width="5">${strokes(pieces, -6)}</g>` +
    petals(ex, EMBLEM_R, 1.05) +
    `</svg>`
  );
}

/** Just the emblem (ring + petals), square. Used for the favicon. */
export function emblemSvg(options: { variant?: LogoVariant; size?: number } = {}): string {
  const pal = PALETTES[options.variant ?? 'dark'];
  const id = `zoravia-emblem-${options.variant ?? 'dark'}`;
  const r = EMBLEM_R;
  const half = r + (STROKE + OUTLINE) / 2 + 2;
  const dims =
    options.size === undefined ? '' : ` width="${options.size}" height="${options.size}"`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-half} ${-half} ${half * 2} ${half * 2}"${dims} role="img" aria-label="Zoravia emblem">` +
    `<defs><linearGradient id="${id}-fill" x1="0" y1="${-r - STROKE / 2}" x2="0" y2="${r + STROKE / 2}" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="${toCss(pal.fillTop)}"/><stop offset="1" stop-color="${toCss(pal.fillBottom)}"/>` +
    `</linearGradient></defs>` +
    `<circle r="${r}" fill="${toCss(pal.core)}" stroke="${toCss(pal.outline)}" stroke-width="${STROKE + OUTLINE}"/>` +
    `<circle r="${r}" fill="none" stroke="url(#${id}-fill)" stroke-width="${STROKE}"/>` +
    petals(0, 0, 1.05) +
    `</svg>`
  );
}

/** `data:` URL for an SVG string (for `<img>`, favicons, textures). */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Sets the page favicon to the emblem (replaces any existing icon link). */
export function installFavicon(doc: Document = document): void {
  let link = doc.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = doc.createElement('link');
    link.rel = 'icon';
    doc.head.appendChild(link);
  }
  link.type = 'image/svg+xml';
  link.href = svgDataUrl(emblemSvg());
}
