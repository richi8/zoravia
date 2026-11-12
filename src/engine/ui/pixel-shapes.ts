/**
 * Pixel-art shapes for Pixi `Graphics`: whole-pixel rectangles with stepped corners, 1-px
 * outlines, bitmaps from `'#.'` strings and cursor triangles. Drawn as a few rectangles (no
 * anti-aliasing), so at whole-number positions they look like pixel art at any scale.
 *
 * The geometry helpers (`roundRectRuns`, `bitmapRuns`) are pure and unit-tested.
 */

import type { Graphics } from 'pixi.js';

/** A horizontal run of pixels: `w` pixels starting at (x, y), 1 pixel tall unless `h` given. */
export interface PixelRun {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * Inset of row `j` (0-based from the nearest edge) for a stepped corner of radius `r`.
 * r = 1 cuts the corner pixel; r = 2 cuts 2 px on the outer row and 1 px on the next.
 */
export function cornerInset(j: number, r: number): number {
  if (r <= 0 || j >= r) return 0;
  if (r === 1) return 1;
  // r ≥ 2: classic pixel circle — r, then r-1, …, 1.
  return r - j;
}

/** Rectangles covering a rounded rect with stepped pixel corners. */
export function roundRectRuns(x: number, y: number, w: number, h: number, r = 1): PixelRun[] {
  w = Math.round(w);
  h = Math.round(h);
  if (w <= 0 || h <= 0) return [];
  const rr = Math.max(0, Math.min(r, Math.floor(Math.min(w, h) / 2)));
  const runs: PixelRun[] = [];
  for (let j = 0; j < rr; j++) {
    const inset = cornerInset(j, rr);
    runs.push({ x: x + inset, y: y + j, w: w - inset * 2, h: 1 });
  }
  if (h - rr * 2 > 0) runs.push({ x, y: y + rr, w, h: h - rr * 2 });
  for (let j = rr - 1; j >= 0; j--) {
    const inset = cornerInset(j, rr);
    runs.push({ x: x + inset, y: y + h - 1 - j, w: w - inset * 2, h: 1 });
  }
  return runs;
}

/**
 * Runs of a 1-px outline around a rounded rect (same corner shape as `roundRectRuns`).
 */
export function roundStrokeRuns(x: number, y: number, w: number, h: number, r = 1): PixelRun[] {
  w = Math.round(w);
  h = Math.round(h);
  if (w <= 0 || h <= 0) return [];
  if (w <= 2 || h <= 2) return roundRectRuns(x, y, w, h, r);
  const rr = Math.max(0, Math.min(r, Math.floor(Math.min(w, h) / 2)));
  const inset = (j: number): number => cornerInset(j, rr);
  const runs: PixelRun[] = [];
  // Top and bottom edges.
  runs.push({ x: x + inset(0), y, w: w - inset(0) * 2, h: 1 });
  runs.push({ x: x + inset(0), y: y + h - 1, w: w - inset(0) * 2, h: 1 });
  // Corner steps: on each row near a corner, the pixels between this row's and the previous
  // row's inset are part of the outline.
  for (let j = 1; j < rr; j++) {
    const a = inset(j);
    const len = Math.max(1, inset(j - 1) - a);
    for (const yy of [y + j, y + h - 1 - j]) {
      runs.push({ x: x + a, y: yy, w: len, h: 1 });
      runs.push({ x: x + w - a - len, y: yy, w: len, h: 1 });
    }
  }
  // Sides.
  const sideH = h - rr * 2;
  if (sideH > 0) {
    runs.push({ x, y: y + rr, w: 1, h: sideH });
    runs.push({ x: x + w - 1, y: y + rr, w: 1, h: sideH });
  }
  return runs;
}

/**
 * Runs for a bitmap written as rows separated by `/`; every character other than `.` and
 * space is a pixel, grouped by character (so one bitmap can carry several colors).
 */
export function bitmapRuns(bits: string): Map<string, PixelRun[]> {
  const out = new Map<string, PixelRun[]>();
  bits.split('/').forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row.charAt(x);
      let end = x + 1;
      while (end < row.length && row.charAt(end) === ch) end++;
      if (ch !== '.' && ch !== ' ') {
        const list = out.get(ch) ?? [];
        list.push({ x, y, w: end - x, h: 1 });
        out.set(ch, list);
      }
      x = end;
    }
  });
  return out;
}

/** Width and height of a `/`-separated bitmap. */
export function bitmapSize(bits: string): { width: number; height: number } {
  const rows = bits.split('/');
  return { width: Math.max(0, ...rows.map((r) => r.length)), height: rows.length };
}

function fillRuns(g: Graphics, runs: readonly PixelRun[], color: number, alpha = 1): Graphics {
  for (const r of runs) g.rect(r.x, r.y, r.w, r.h);
  if (runs.length) g.fill({ color, alpha });
  return g;
}

/** Fills a pixel rounded rect. */
export function pixelRoundRect(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: number,
  alpha = 1,
): Graphics {
  return fillRuns(g, roundRectRuns(x, y, w, h, r), color, alpha);
}

/** Draws a 1-px pixel outline of a rounded rect. */
export function pixelRoundStroke(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: number,
  alpha = 1,
): Graphics {
  return fillRuns(g, roundStrokeRuns(x, y, w, h, r), color, alpha);
}

/**
 * Draws a bitmap at (x, y). `colors` maps bitmap characters to colors; a plain number colors
 * every pixel (handy for single-ink icons written with `#`).
 */
export function pixelBitmap(
  g: Graphics,
  bits: string,
  x: number,
  y: number,
  colors: number | Readonly<Record<string, number>>,
  alpha = 1,
): Graphics {
  for (const [ch, runs] of bitmapRuns(bits)) {
    const color = typeof colors === 'number' ? colors : colors[ch];
    if (color === undefined) continue;
    fillRuns(
      g,
      runs.map((r) => ({ ...r, x: r.x + x, y: r.y + y })),
      color,
      alpha,
    );
  }
  return g;
}

/** Right-pointing cursor triangle, `size` px tall (odd sizes look best). */
export function pixelTriangle(
  g: Graphics,
  x: number,
  y: number,
  size: number,
  color: number,
  direction: 'right' | 'down' = 'right',
): Graphics {
  const half = Math.floor(size / 2);
  const runs: PixelRun[] = [];
  for (let i = 0; i < size; i++) {
    const len = half + 1 - Math.abs(i - half);
    runs.push(
      direction === 'right' ? { x, y: y + i, w: len, h: 1 } : { x: x + i, y, w: 1, h: len },
    );
  }
  return fillRuns(g, runs, color);
}
