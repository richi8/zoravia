/**
 * Stateless, seeded 2D noise for procedural art: an integer hash, smooth value noise and a
 * small fractal sum. Pure functions of their inputs, so the same coordinates and seed give
 * the same value everywhere (tiles baked in separate chunks join without seams).
 */

/** Hash of an integer lattice point → float in [0, 1). */
export function hash2(x: number, y: number, seed: number): number {
  let h =
    Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1): lattice hashes blended with a smoothstep. */
export function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Three octaves of value noise (weights 0.6 / 0.3 / 0.1), in [0, 1). */
export function fbm(x: number, y: number, seed: number): number {
  return (
    valueNoise(x, y, seed) * 0.6 +
    valueNoise(x * 2, y * 2, seed + 7) * 0.3 +
    valueNoise(x * 4, y * 4, seed + 13) * 0.1
  );
}
