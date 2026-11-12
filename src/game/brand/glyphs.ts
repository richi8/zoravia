/**
 * Stroke-letter kit for code-generated logos. Glyphs are centerline paths (cap height 100,
 * baseline y = 100) that get stroked in layers (outline, fill, shading).
 */

export interface Glyph {
  readonly width: number;
  readonly d: string;
}

/** Cap height in glyph units. */
export const CAP = 100;

export const UPPER: Readonly<Record<string, Glyph>> = {
  Z: { width: 64, d: 'M0 0H64L0 100H64' },
  O: { width: 76, d: 'M38 0A38 50 0 1 1 38 100A38 50 0 1 1 38 0Z' },
  R: { width: 62, d: 'M0 100V0H34A25 25 0 0 1 34 50H0M30 50L62 100' },
  A: { width: 70, d: 'M0 100L35 0L70 100M13 64H57' },
  V: { width: 70, d: 'M0 0L35 100L70 0' },
  I: { width: 0, d: 'M0 0V100' },
};

export interface Piece {
  readonly ch: string;
  readonly glyph: Glyph;
  /** Glyph origin (top-left of the cap box). */
  readonly x: number;
}

export interface LayoutOptions {
  readonly set?: Readonly<Record<string, Glyph>>;
  /** Space between glyph boxes. */
  readonly gap: number;
  /** Per-pair gap override, e.g. `{ AV: 10 }`. */
  readonly kern?: Readonly<Record<string, number>>;
}

export function layoutWord(
  text: string,
  options: LayoutOptions,
): { pieces: Piece[]; width: number } {
  const set = options.set ?? UPPER;
  const pieces: Piece[] = [];
  let x = 0;
  [...text].forEach((ch, i) => {
    const glyph = set[ch];
    if (!glyph) throw new Error(`No glyph for "${ch}"`);
    pieces.push({ ch, glyph, x });
    x += glyph.width;
    const next = text[i + 1];
    if (next !== undefined) x += options.kern?.[ch + next] ?? options.gap;
  });
  return { pieces, width: x };
}

/** `<path>` elements for the pieces. */
export function piecePaths(pieces: readonly Piece[]): string {
  return pieces.map((p) => `<path transform="translate(${p.x} 0)" d="${p.glyph.d}"/>`).join('');
}
