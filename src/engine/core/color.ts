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
