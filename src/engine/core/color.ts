/**
 * Color helpers. Colors are `0xRRGGBB` numbers (what Pixi takes); `toCss` gives `#rrggbb`.
 * Pure functions, no rendering imports.
 */

export interface Rgb {
  /** 0–255 */
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const clampByte = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));

export function toRgb(color: number): Rgb {
  return { r: (color >> 16) & 0xff, g: (color >> 8) & 0xff, b: color & 0xff };
}

export function fromRgb({ r, g, b }: Rgb): number {
  return (clampByte(r) << 16) | (clampByte(g) << 8) | clampByte(b);
}

/** `0x1e2243` → `'#1e2243'`. */
export function toCss(color: number): string {
  return `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;
}

/** `'#1e2243'` or `'1e2243'` or `'#abc'` → number. Throws on anything else. */
export function parseHex(hex: string): number {
  const s = hex.startsWith('#') ? hex.slice(1) : hex;
  if (/^[0-9a-f]{3}$/i.test(s)) {
    return parseInt(
      s
        .split('')
        .map((c) => c + c)
        .join(''),
      16,
    );
  }
  if (/^[0-9a-f]{6}$/i.test(s)) return parseInt(s, 16);
  throw new Error(`Invalid hex color "${hex}"`);
}

/** `rgba(r, g, b, a)` for CSS. */
export function toCssRgba(color: number, alpha: number): string {
  const { r, g, b } = toRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Linear mix in sRGB: `t = 0` → `a`, `t = 1` → `b`. */
export function mix(a: number, b: number, t: number): number {
  const x = toRgb(a);
  const y = toRgb(b);
  return fromRgb({
    r: x.r + (y.r - x.r) * t,
    g: x.g + (y.g - x.g) * t,
    b: x.b + (y.b - x.b) * t,
  });
}

/** Mix toward white. */
export function lighten(color: number, amount: number): number {
  return mix(color, 0xffffff, amount);
}

/** Mix toward black. */
export function darken(color: number, amount: number): number {
  return mix(color, 0x000000, amount);
}

const channel = (c: number): number => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance, 0 (black) – 1 (white). */
export function luminance(color: number): number {
  const { r, g, b } = toRgb(color);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio, 1–21. AA body text needs ≥ 4.5, large text / UI shapes ≥ 3. */
export function contrastRatio(a: number, b: number): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Whichever of `dark` / `light` reads better on `background`. */
export function readableOn(background: number, dark = 0x000000, light = 0xffffff): number {
  return contrastRatio(background, dark) >= contrastRatio(background, light) ? dark : light;
}

/** CIE L*a*b* (D65), for perceptual distance checks. */
export function toLab(color: number): { l: number; a: number; b: number } {
  const { r, g, b } = toRgb(color);
  const R = channel(r);
  const G = channel(g);
  const B = channel(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** CIE76 ΔE: ~2.3 is a just-noticeable difference, > 20 is clearly distinct. */
export function deltaE(a: number, b: number): number {
  const x = toLab(a);
  const y = toLab(b);
  return Math.hypot(x.l - y.l, x.a - y.a, x.b - y.b);
}

/** HSL: hue in degrees [0, 360), saturation and lightness 0–1. */
export interface Hsl {
  readonly h: number;
  readonly s: number;
  readonly l: number;
}

export function toHsl(color: number): Hsl {
  const { r, g, b } = toRgb(color);
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === R) h = ((G - B) / d) % 6;
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  h *= 60;
  return { h: h < 0 ? h + 360 : h, s, l };
}

export function fromHsl({ h, s, l }: Hsl): number {
  const hh = (((h % 360) + 360) % 360) / 60;
  const S = Math.min(1, Math.max(0, s));
  const L = Math.min(1, Math.max(0, l));
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = L - c / 2;
  const [r, g, b] =
    hh < 1
      ? [c, x, 0]
      : hh < 2
        ? [x, c, 0]
        : hh < 3
          ? [0, c, x]
          : hh < 4
            ? [0, x, c]
            : hh < 5
              ? [x, 0, c]
              : [c, 0, x];
  return fromRgb({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 });
}

/** Moves hue `from` toward `to` (degrees) by at most `maxStep`, along the shorter arc. */
export function rotateHueToward(from: number, to: number, maxStep: number): number {
  const diff = ((to - from + 540) % 360) - 180;
  const step = Math.sign(diff) * Math.min(Math.abs(diff), maxStep);
  return (from + step + 360) % 360;
}
