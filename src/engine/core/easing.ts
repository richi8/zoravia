/**
 * Easing functions `t ∈ [0, 1] → [0, 1]` (except `backOut`, which overshoots).
 * Design tokens refer to these by name.
 */

export type Easing = (t: number) => number;

export const linear: Easing = (t) => t;
export const quadIn: Easing = (t) => t * t;
export const quadOut: Easing = (t) => 1 - (1 - t) * (1 - t);
export const quadInOut: Easing = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const cubicOut: Easing = (t) => 1 - (1 - t) ** 3;
export const cubicInOut: Easing = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** Slight overshoot, for things that pop in. */
export const backOut: Easing = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

export const EASINGS = {
  linear,
  quadIn,
  quadOut,
  quadInOut,
  cubicOut,
  cubicInOut,
  backOut,
} as const satisfies Record<string, Easing>;

export type EasingName = keyof typeof EASINGS;
