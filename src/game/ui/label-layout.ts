/**
 * Map labels that don't overlap (C36d). Labels are placed by priority (lower first, then in
 * the given order): each one tries its offsets in turn (under its place, above it, further
 * down) and takes the first where it overlaps no label placed before it, else it hides.
 * Pure: no drawing.
 */

export interface LabelBox {
  /** Left and top at offset 0, and the size, in px. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Lower goes first: towns 0, landmarks 1, secrets 2. */
  readonly priority: number;
}

/** The y offset each label takes, or undefined when it hides. */
export function placeLabels(
  boxes: readonly LabelBox[],
  offsets: readonly number[],
  gap = 1,
): (number | undefined)[] {
  const out: (number | undefined)[] = boxes.map(() => undefined);
  const placed: { x: number; y: number; w: number; h: number }[] = [];
  const prio = (i: number): number => (boxes[i] as LabelBox).priority;
  const order = boxes.map((_, i) => i).sort((a, b) => prio(a) - prio(b));
  for (const i of order) {
    const b = boxes[i] as LabelBox;
    for (const dy of offsets) {
      const r = { x: b.x, y: b.y + dy, w: b.w, h: b.h };
      const hit = placed.some(
        (p) =>
          r.x < p.x + p.w + gap &&
          p.x < r.x + r.w + gap &&
          r.y < p.y + p.h + gap &&
          p.y < r.y + r.h + gap,
      );
      if (hit) continue;
      placed.push(r);
      out[i] = dy;
      break;
    }
  }
  return out;
}
