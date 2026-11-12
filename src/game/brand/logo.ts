/**
 * The Zoravia logo, generated in code as SVG (no image files, no fonts).
 *
 * A dragon crest: an upright rust-orange dragon (horned head with open jaws, S-neck with a
 * mane and teal belly plates, thighs and claws, a tail ending in a spiral) with huge teal
 * wings spread behind the gold "ZORAVIA" name; navy outline around everything. Every part is
 * shaded (light rim top-left, dark rim bottom-right).
 *
 * The game shows it as pixel art: `pixelateSvg(logoSvg(), width, LOGO_PIXEL_OPTIONS)` snaps it
 * to `logoColors` and adds a scale texture to the body. Coordinates: the name is centered on
 * (0, 44), about 620 units wide.
 *
 * Concept: the user's Nano Banana sketch (C07 review), rebuilt as geometry; to be revisited.
 */

import { toCss } from '@engine/core/color';
import type { PixelateOptions } from '@engine/render/pixelate';
import { logoColors as L } from '../style/tokens';
import { UPPER, layoutWord, piecePaths } from './glyphs';

const c = toCss;
const NAVY = c(L.navy);

type Pt = readonly [number, number];
const poly = (pts: readonly Pt[]): string => 'M' + pts.map(([x, y]) => `${x} ${y}`).join('L') + 'Z';
const mirrorPts = (pts: readonly Pt[]): Pt[] => pts.map(([x, y]): Pt => [-x, y]);

// ------------------------------------------------------------------ anatomy

const HEAD =
  'M0 -200L40 -224L72 -210L118 -174L134 -156L100 -150L64 -142L114 -132L106 -118L52 -116L18 -136L-6 -166Z';
const BROW = 'M44 -214L86 -196L76 -188L42 -200Z';
const HORN_1 = 'M22 -214C2 -252 -20 -284 -50 -306C-28 -272 -14 -244 4 -202Z';
const HORN_2 = 'M4 -198C-20 -228 -42 -250 -70 -258C-46 -236 -28 -218 -10 -186Z';
const NECK =
  'M-6 -170C-44 -140 -64 -92 -60 -40C-56 0 -34 22 -22 44L54 44C42 14 4 -6 2 -40C0 -76 14 -110 38 -134Z';
const BELLY_STRIP =
  'M30 -128C10 -104 -4 -74 -2 -40C0 -8 24 14 36 44L52 44C40 14 14 -6 12 -40C10 -74 22 -104 42 -126Z';
const MANE: readonly Pt[][] = [
  [
    [-4, -188],
    [-36, -214],
    [-22, -172],
  ],
  [
    [-20, -164],
    [-58, -180],
    [-38, -144],
  ],
  [
    [-38, -136],
    [-78, -144],
    [-52, -112],
  ],
  [
    [-52, -102],
    [-92, -104],
    [-60, -78],
  ],
  [
    [-58, -66],
    [-98, -62],
    [-60, -42],
  ],
  [
    [-58, -30],
    [-94, -20],
    [-52, -6],
  ],
];
const TORSO = 'M-66 84C-84 128 -62 178 -4 184C52 188 84 152 74 84Z';
const THIGH_L = 'M-46 104C-104 98 -122 160 -94 190L-62 196C-80 168 -70 136 -30 132Z';
const FOOT_L: Pt[] = [
  [-96, 186],
  [-60, 190],
  [-56, 210],
  [-104, 208],
];
const THIGH_R = 'M40 130C86 132 104 182 86 210L56 210C66 186 56 166 30 160Z';
const FOOT_R: Pt[] = [
  [52, 202],
  [92, 202],
  [98, 222],
  [48, 222],
];
const TAIL: readonly { d: string; w: number }[] = [
  { d: 'M-20 176C-60 210 -90 236 -60 262', w: 46 },
  { d: 'M-60 262C-30 290 80 290 150 262', w: 36 },
  { d: 'M150 262C206 240 228 190 200 160', w: 26 },
  { d: 'M200 160C176 132 136 146 140 176C144 198 172 196 176 180', w: 16 },
];

/** Right wing (mirrored for the left); the wrist sits high above the shoulder. */
const WING = {
  shoulder: [24, -70] as Pt,
  wrist: [120, -292] as Pt,
  outline: [
    [24, -70],
    [120, -292],
    [214, -246],
    [520, 24],
    [436, 4],
    [452, 120],
    [366, 70],
    [330, 214],
    [262, 92],
    [190, 80],
    [150, 30],
    [60, -10],
  ] as Pt[],
  innerShade: [
    [60, -14],
    [150, 26],
    [190, 76],
    [262, 88],
    [240, -40],
    [120, -150],
  ] as Pt[],
  fingers: [
    [520, 24],
    [452, 120],
    [330, 214],
    [190, 80],
  ] as Pt[],
};

/** Viewboxes: the whole crest, and a square crop on the head (favicon / small icon). */
const VIEW = {
  full: { x: -560, y: -340, w: 1120, h: 660 },
  emblem: { x: -120, y: -335, w: 270, h: 270 },
} as const;

// ------------------------------------------------------------------ drawing helpers

class Painter {
  private n = 0;
  constructor(private readonly prefix: string) {}

  id(): string {
    return `${this.prefix}-${this.n++}`;
  }

  /** Shape with navy outline, light rim top-left, base middle, dark rim bottom-right. */
  shaded(d: string, light: number, base: number, dark: number, rim = 7, outline = 6): string {
    const id = this.id();
    const fill = (dx: number, dy: number, color: number): string =>
      `<path transform="translate(${dx} ${dy})" d="${d}" fill="${c(color)}"/>`;
    return (
      `<defs><clipPath id="${id}"><path d="${d}"/></clipPath>` +
      `<clipPath id="${id}-d"><path transform="translate(${rim} ${rim * 1.2})" d="${d}"/></clipPath></defs>` +
      `<path d="${d}" fill="${NAVY}" stroke="${NAVY}" stroke-width="${outline * 2}" stroke-linejoin="round"/>` +
      `<g clip-path="url(#${id})">` +
      fill(0, 0, light) +
      fill(rim, rim * 1.2, dark) +
      `<g clip-path="url(#${id}-d)">${fill(-rim * 1.3, -rim * 1.5, base)}</g>` +
      `</g>`
    );
  }
}

/** A tapering, shaded tube along cubic segments. */
function tube(segs: readonly { d: string; w: number }[]): string {
  const layer = (
    w: (s: number) => number,
    color: number,
    off: (s: number) => Pt = () => [0, 0],
  ): string =>
    segs
      .map((s) => {
        const [dx, dy] = off(s.w);
        return `<path transform="translate(${dx} ${dy})" d="${s.d}" fill="none" stroke="${c(color)}" stroke-width="${w(s.w)}" stroke-linecap="round"/>`;
      })
      .join('');
  return (
    layer((w) => w + 12, L.navy) +
    layer((w) => w, L.rustDark) +
    layer(
      (w) => w * 0.72,
      L.rust,
      () => [-2, -3],
    ) +
    layer(
      (w) => w * 0.22,
      L.rustLight,
      (w) => [-w * 0.2, -w * 0.24],
    )
  );
}

function claws(x: number, y: number): string {
  return [0, 1, 2]
    .map((i) => {
      const cx = x + i * 16;
      return `<path d="M${cx} ${y}L${cx + 6} ${y + 16}L${cx + 12} ${y}Z" fill="${c(L.cream)}" stroke="${NAVY}" stroke-width="3" stroke-linejoin="round"/>`;
    })
    .join('');
}

function wing(p: Painter, mirror: boolean): string {
  const f = (pts: readonly Pt[]): Pt[] => (mirror ? mirrorPts(pts) : [...pts]);
  const fp = (pt: Pt): Pt => (mirror ? [-pt[0], pt[1]] : pt);
  const [wx, wy] = fp(WING.wrist);
  const [sx, sy] = fp(WING.shoulder);
  const bone = (d: string, w: number): string =>
    `<path d="${d}" fill="none" stroke="${NAVY}" stroke-width="${w + 10}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${c(L.rust)}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" transform="translate(-2 -3)" fill="none" stroke="${c(L.rustLight)}" stroke-width="${w * 0.4}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const lead =
    'M' +
    f(WING.outline.slice(1, 4))
      .map(([x, y]) => `${x} ${y}`)
      .join('L');
  return (
    p.shaded(poly(f(WING.outline)), L.tealLight, L.teal, L.tealDark, 10, 8) +
    `<path d="${poly(f(WING.innerShade))}" fill="${c(L.tealDark)}" opacity="0.85"/>` +
    bone(lead, 18) +
    bone(`M${sx} ${sy}L${wx} ${wy}`, 20) +
    WING.fingers
      .map((pt) => {
        const [x, y] = fp(pt);
        return bone(`M${wx} ${wy}L${x} ${y}`, 10);
      })
      .join('')
  );
}

/** Blocky gold name: navy outline + drop, light top band, dark lower half. */
function name(p: Painter): string {
  const TW = 28;
  const { pieces, width } = layoutWord('ZORAVIA', { set: UPPER, gap: 38, kern: { AV: 16 } });
  const sc = 620 / (width + TW);
  const tx = -(width * sc) / 2;
  const ty = 44 - 50 * sc;
  const layer = (w: number, color: number, join: string, dy = 0): string =>
    `<g transform="translate(${tx} ${ty + dy}) scale(${sc})" fill="none" stroke="${c(color)}" stroke-width="${w}" ` +
    `stroke-linejoin="${join}" stroke-miterlimit="1.5" stroke-linecap="square">${piecePaths(pieces)}</g>`;
  const low = p.id();
  const top = p.id();
  return (
    `<defs><clipPath id="${low}"><rect x="-500" y="46" width="1000" height="200"/></clipPath>` +
    `<clipPath id="${top}"><rect x="-500" y="-100" width="1000" height="${ty + 10 * sc + 100}"/></clipPath></defs>` +
    layer(TW + 24, L.navy, 'round', 6) +
    layer(TW + 24, L.navy, 'round') +
    layer(TW, L.gold, 'miter') +
    `<g clip-path="url(#${low})">${layer(TW, L.goldDark, 'miter')}</g>` +
    `<g clip-path="url(#${top})">${layer(TW, L.goldLight, 'miter')}</g>`
  );
}

// ------------------------------------------------------------------ public API

export interface LogoOptions {
  /** `full` crest (default) or `emblem`: a square crop on the dragon's head. */
  readonly crop?: 'full' | 'emblem';
  /** Rendered height in px (width follows). Omit for a fluid SVG. */
  readonly height?: number;
  /** Prefix for internal ids; give each logo on the same page its own. Default `zl`. */
  readonly id?: string;
}

/** Logo size in logo units (viewBox). */
export function logoSize(crop: 'full' | 'emblem' = 'full'): { width: number; height: number } {
  const v = VIEW[crop];
  return { width: v.w, height: v.h };
}

/** The logo as an SVG document string. Deterministic. */
export function logoSvg(options: LogoOptions = {}): string {
  const p = new Painter(options.id ?? 'zl');
  const v = VIEW[options.crop ?? 'full'];
  const dims =
    options.height === undefined
      ? ''
      : ` width="${Math.round((options.height * v.w) / v.h)}" height="${options.height}"`;

  const silhouette =
    `<g fill="${NAVY}" stroke="${NAVY}" stroke-width="26" stroke-linejoin="round" stroke-linecap="round">` +
    `<path d="${poly(WING.outline)}"/><path d="${poly(mirrorPts(WING.outline))}"/>` +
    [HEAD, HORN_1, HORN_2, NECK, TORSO, THIGH_L, THIGH_R].map((d) => `<path d="${d}"/>`).join('') +
    MANE.map((m) => `<path d="${poly(m)}"/>`).join('') +
    TAIL.map((s) => `<path d="${s.d}" fill="none" stroke-width="${s.w + 36}"/>`).join('') +
    `</g>`;

  const body =
    tube(TAIL) +
    p.shaded(THIGH_R, L.rustLight, L.rust, L.rustDark) +
    p.shaded(poly(FOOT_R), L.rustLight, L.rust, L.rustDark, 4) +
    claws(54, 220) +
    p.shaded(TORSO, L.rustLight, L.rust, L.rustDark, 9) +
    `<path d="M-30 110H40M-36 132H46M-30 154H40" stroke="${c(L.tealDark)}" stroke-width="5" stroke-linecap="round" opacity="0.6"/>` +
    p.shaded(THIGH_L, L.rustLight, L.rust, L.rustDark) +
    p.shaded(poly(FOOT_L), L.rustLight, L.rust, L.rustDark, 4) +
    claws(-102, 206) +
    MANE.map((m) => p.shaded(poly(m), L.rust, L.rustDark, L.navy, 3, 4)).join('') +
    p.shaded(NECK, L.rustLight, L.rust, L.rustDark, 9) +
    p.shaded(BELLY_STRIP, L.tealLight, L.teal, L.tealDark, 4, 3) +
    `<path d="M22 -112L40 -108M10 -88L30 -86M4 -62L24 -62M2 -36L22 -38M8 -10L28 -14M18 16L38 10" stroke="${c(L.tealDark)}" stroke-width="5" stroke-linecap="round"/>` +
    p.shaded(HORN_2, L.goldLight, L.gold, L.goldDark, 4) +
    p.shaded(HORN_1, L.goldLight, L.gold, L.goldDark, 4) +
    p.shaded(HEAD, L.rustLight, L.rust, L.rustDark, 8) +
    // mouth interior, teeth
    `<path d="M64 -142L100 -150L112 -134Z" fill="${c(L.rustDark)}"/>` +
    `<path d="M76 -147L80 -138L84 -148ZM90 -149L94 -140L98 -150ZM82 -126L86 -134L90 -125ZM96 -128L100 -135L103 -126Z" fill="${c(L.white)}"/>` +
    p.shaded(BROW, L.rust, L.rustDark, L.navy, 2, 3) +
    // eye with pupil and glint, nostril, cheek spike
    `<path d="M52 -198L86 -190L60 -178Z" fill="${c(L.tealLight)}" stroke="${NAVY}" stroke-width="4" stroke-linejoin="round"/>` +
    `<path d="M66 -193L72 -184L64 -182Z" fill="${NAVY}"/><circle cx="60" cy="-191" r="2.5" fill="${c(L.white)}"/>` +
    `<circle cx="120" cy="-166" r="3.5" fill="${NAVY}"/>` +
    p.shaded(
      poly([
        [16, -146],
        [-12, -136],
        [8, -128],
      ]),
      L.goldLight,
      L.gold,
      L.goldDark,
      2,
      3,
    );

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${v.x} ${v.y} ${v.w} ${v.h}"${dims} role="img" aria-label="Zoravia">` +
    silhouette +
    wing(p, false) +
    wing(p, true) +
    body +
    name(p) +
    `</svg>`
  );
}

/** Pixel-art settings for the logo: snap to the logo palette, scale texture on the body. */
export const LOGO_PIXEL_OPTIONS: PixelateOptions = {
  palette: Object.values(L),
  texture: { [L.rust]: L.rustDark, [L.rustLight]: L.rust, [L.rustDark]: L.navy },
};

/** `data:` URL for an SVG string (for `<img>`, favicons, textures). */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Sets the page favicon to the dragon-head crop (replaces any existing icon link). */
export function installFavicon(doc: Document = document): void {
  let link = doc.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = doc.createElement('link');
    link.rel = 'icon';
    doc.head.appendChild(link);
  }
  link.type = 'image/svg+xml';
  link.href = svgDataUrl(logoSvg({ crop: 'emblem', id: 'favicon' }));
}
