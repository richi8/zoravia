/**
 * Spatial navigation (pure): from one rectangle, find the nearest other rectangle in a
 * direction. Used to move a keyboard cursor between things laid out freely on screen
 * (e.g. inspecting icons for their tooltips).
 */

import type { Direction } from '../input/input-manager';

export interface NavRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Index of the rect nearest to `rects[from]` in `dir`, or `undefined` if there is none.
 * A candidate must lie in that direction (its center past the current center); distance
 * along the direction counts once, sideways offset counts double, so the cursor prefers
 * staying in the same row or column.
 */
export function nearestInDirection(
  rects: readonly NavRect[],
  from: number,
  dir: Direction,
): number | undefined {
  const a = rects[from];
  if (!a) return undefined;
  const ax = a.x + a.width / 2;
  const ay = a.y + a.height / 2;
  let best: number | undefined;
  let bestScore = Infinity;
  rects.forEach((b, i) => {
    if (i === from) return;
    const dx = b.x + b.width / 2 - ax;
    const dy = b.y + b.height / 2 - ay;
    const along = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
    const side = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (along <= 0.5) return;
    const score = along + side * 2;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

/** Index of the rect that reads first (top-most, then left-most). */
export function firstInReadingOrder(rects: readonly NavRect[]): number | undefined {
  let best: number | undefined;
  rects.forEach((r, i) => {
    const b = best === undefined ? undefined : rects[best];
    if (!b || r.y < b.y - 2 || (Math.abs(r.y - b.y) <= 2 && r.x < b.x)) best = i;
  });
  return best;
}
