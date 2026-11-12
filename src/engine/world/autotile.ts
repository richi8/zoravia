/**
 * Corner-based ("dual grid") autotiling. A terrain layer is stored per tile **corner**
 * (vertex), not per tile: a map of W×H tiles has (W+1)×(H+1) corners. Each tile's look
 * follows from its 4 corners (16 cases), and inside a tile the layer's coverage is the
 * bilinear blend of those corners, so edges between layers come out rounded and join
 * seamlessly across tiles: along a shared tile edge only the two shared corners count.
 *
 * Renderers threshold `coverage` (plus a little noise) at 0.5 to get organic shorelines,
 * paths and patches for any shape without hand-drawn transition tiles.
 */

/** Corner bits for `cornerMask`. */
export const NW = 1;
export const NE = 2;
export const SW = 4;
export const SE = 8;

export class CornerGrid {
  /** Corners per row (tiles + 1). */
  readonly cols: number;
  /** Corner rows (tiles + 1). */
  readonly rows: number;
  readonly data: Uint8Array;

  constructor(
    readonly tilesWide: number,
    readonly tilesHigh: number,
  ) {
    this.cols = tilesWide + 1;
    this.rows = tilesHigh + 1;
    this.data = new Uint8Array(this.cols * this.rows);
  }

  /** Builds a grid by asking `inside(cx, cy)` for every corner. */
  static from(
    tilesWide: number,
    tilesHigh: number,
    inside: (cx: number, cy: number) => boolean,
  ): CornerGrid {
    const g = new CornerGrid(tilesWide, tilesHigh);
    for (let y = 0; y < g.rows; y++) {
      for (let x = 0; x < g.cols; x++) g.data[y * g.cols + x] = inside(x, y) ? 1 : 0;
    }
    return g;
  }

  /** Corner value (0/1); coordinates outside the grid clamp to the border. */
  get(cx: number, cy: number): number {
    const x = Math.min(Math.max(cx, 0), this.cols - 1);
    const y = Math.min(Math.max(cy, 0), this.rows - 1);
    return this.data[y * this.cols + x] ?? 0;
  }

  set(cx: number, cy: number, value: boolean): void {
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return;
    this.data[cy * this.cols + cx] = value ? 1 : 0;
  }
}

/** The tile's 4 corners as a 0–15 mask (`NW | NE | SW | SE`). */
export function cornerMask(g: CornerGrid, tx: number, ty: number): number {
  return (
    (g.get(tx, ty) ? NW : 0) |
    (g.get(tx + 1, ty) ? NE : 0) |
    (g.get(tx, ty + 1) ? SW : 0) |
    (g.get(tx + 1, ty + 1) ? SE : 0)
  );
}

/** True when all 4 corners of the tile are set (`value` = 1) or all clear (`value` = 0). */
export function tileIs(g: CornerGrid, tx: number, ty: number, value: 0 | 1): boolean {
  return cornerMask(g, tx, ty) === (value ? 15 : 0);
}

/**
 * Layer coverage at a pixel (0..1): bilinear blend of the 4 corners of the tile under the
 * pixel. `px`, `py` are pixels from the map's top-left, `tileSize` pixels per tile.
 */
export function coverage(g: CornerGrid, px: number, py: number, tileSize: number): number {
  const vx = px / tileSize;
  const vy = py / tileSize;
  const x0 = Math.floor(vx);
  const y0 = Math.floor(vy);
  const fx = vx - x0;
  const fy = vy - y0;
  const a = g.get(x0, y0);
  const b = g.get(x0 + 1, y0);
  const c = g.get(x0, y0 + 1);
  const d = g.get(x0 + 1, y0 + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
