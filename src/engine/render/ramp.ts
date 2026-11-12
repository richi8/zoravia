/**
 * Picks a tone from a color ramp (dark → light) for a light value, with optional ordered
 * (Bayer 4×4) dithering near the band edges. Keeps procedural art on a small palette.
 */

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** Bayer 4×4 threshold for a pixel, in (0, 1). */
export function bayer4(x: number, y: number): number {
  return BAYER[(y & 3) * 4 + (x & 3)] ?? 0.5;
}

/**
 * Index into a ramp of `n` tones for `light` (0 = darkest, 1 = lightest).
 * `sharpness` sets the dither band: 1 = dither the whole step, ~3 = a narrow band at each
 * edge, ≥ 50 = hard edges (no dithering).
 */
export function rampIndex(
  n: number,
  light: number,
  x: number,
  y: number,
  sharpness: number,
): number {
  if (n <= 1) return 0;
  const v = Math.min(Math.max(light, 0), 0.9999) * (n - 1);
  let i = Math.floor(v);
  const f = Math.min(Math.max((v - i - 0.5) * sharpness + 0.5, 0), 1);
  if (f > bayer4(x, y)) i++;
  return Math.min(Math.max(i, 0), n - 1);
}
