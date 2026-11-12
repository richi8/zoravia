/**
 * Small math and 2D vector helpers. Vectors are plain immutable objects so they
 * can live in serializable state; every helper returns a new vector.
 */

export const EPSILON = 1e-9;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

/** Linear interpolation; `t` is not clamped. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Inverse of `lerp`: where `value` lies between `a` and `b` (0..1 when inside). Returns 0 if `a === b`. */
export function inverseLerp(a: number, b: number, value: number): number {
  return a === b ? 0 : (value - a) / (b - a);
}

/** Maps `value` from range [inMin, inMax] to [outMin, outMax]; not clamped. */
export function remap(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  return lerp(outMin, outMax, inverseLerp(inMin, inMax, value));
}

/** Hermite smoothstep between `edge0` and `edge1`. */
export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01(inverseLerp(edge0, edge1, value));
  return t * t * (3 - 2 * t);
}

/** Modulo that is always non-negative for positive `n` (`mod(-1, 4) === 3`). */
export function mod(value: number, n: number): number {
  return ((value % n) + n) % n;
}

export function approxEqual(a: number, b: number, epsilon = EPSILON): boolean {
  return Math.abs(a - b) <= epsilon;
}

/** Rounds to `decimals` decimal places. */
export function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

// ---------------------------------------------------------------------------
// Vec2
// ---------------------------------------------------------------------------

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export function vec2(x = 0, y = 0): Vec2 {
  return { x, y };
}

export const ZERO: Vec2 = Object.freeze(vec2(0, 0));

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function length(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Grid distance (4-directional movement). */
export function manhattan(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Unit vector in the same direction; the zero vector stays zero. */
export function normalize(v: Vec2): Vec2 {
  const len = length(v);
  return len < EPSILON ? ZERO : { x: v.x / len, y: v.y / len };
}

export function lerpVec(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

export function equals(a: Vec2, b: Vec2, epsilon = 0): boolean {
  return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;
}
