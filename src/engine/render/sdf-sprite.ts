/**
 * Pure pixel-art sprite rasterizer: describe a figure as signed-distance shapes, get back
 * RGBA pixels with hard edges, flat shading bands, a 1-pixel outer outline and lines between
 * overlapping parts.
 *
 * No canvas or DOM: the same model renders to the exact same bytes everywhere (Node tests,
 * every browser), which is what makes generated sprites reproducible from a seed.
 *
 * Coordinates are "model units" (any scale, y down); `rasterize` maps a model-space box onto
 * the pixel grid. Shading assumes each shape is a soft, pillow-like volume: its normal is
 * derived from the distance field, lit from the upper left, and snapped to the shape's color
 * ramp (light → dark).
 */

/** Signed distance: < 0 inside, > 0 outside (model units). */
export type DistanceFn = (x: number, y: number) => number;

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface Primitive {
  readonly d: DistanceFn;
  readonly bounds: Bounds;
}

const bbox = (minX: number, minY: number, maxX: number, maxY: number): Bounds => ({
  minX,
  minY,
  maxX,
  maxY,
});

export function unionBounds(list: readonly Bounds[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of list) {
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  return bbox(minX, minY, maxX, maxY);
}

// ---------------------------------------------------------------------------------------------
// Primitives (formulas after Inigo Quilez's 2D distance functions).

export function circle(cx: number, cy: number, r: number): Primitive {
  return {
    d: (x, y) => Math.hypot(x - cx, y - cy) - r,
    bounds: bbox(cx - r, cy - r, cx + r, cy + r),
  };
}

/** Ellipse rotated by `angle` radians. Approximate distance (exact on the boundary). */
export function ellipse(cx: number, cy: number, rx: number, ry: number, angle = 0): Primitive {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const m = Math.min(rx, ry);
  const ex = Math.hypot(rx * cos, ry * sin);
  const ey = Math.hypot(rx * sin, ry * cos);
  return {
    d: (x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      const lx = (dx * cos + dy * sin) / rx;
      const ly = (-dx * sin + dy * cos) / ry;
      return (Math.hypot(lx, ly) - 1) * m;
    },
    bounds: bbox(cx - ex, cy - ey, cx + ex, cy + ey),
  };
}

/** Segment a→b with radius `ra` at a and `rb` at b (tapered capsule). */
export function capsule(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  ra: number,
  rb = ra,
): Primitive {
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy || 1e-9;
  return {
    d: (x, y) => {
      const px = x - ax;
      const py = y - ay;
      const t = Math.max(0, Math.min(1, (px * vx + py * vy) / len2));
      return Math.hypot(px - vx * t, py - vy * t) - (ra + (rb - ra) * t);
    },
    bounds: bbox(
      Math.min(ax - ra, bx - rb),
      Math.min(ay - ra, by - rb),
      Math.max(ax + ra, bx + rb),
      Math.max(ay + ra, by + rb),
    ),
  };
}

/** Closed polygon (any winding), optionally rounded by `round` units. */
export function polygon(points: readonly (readonly [number, number])[], round = 0): Primitive {
  const n = points.length;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    d: (x, y) => {
      const [x0, y0] = points[0] ?? [0, 0];
      let d = (x - x0) ** 2 + (y - y0) ** 2;
      let s = 1;
      for (let i = 0, j = n - 1; i < n; j = i, i++) {
        const [xi, yi] = points[i] ?? [0, 0];
        const [xj, yj] = points[j] ?? [0, 0];
        const ex = xj - xi;
        const ey = yj - yi;
        const wx = x - xi;
        const wy = y - yi;
        const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey || 1e-9)));
        const bx = wx - ex * t;
        const by = wy - ey * t;
        d = Math.min(d, bx * bx + by * by);
        const c1 = y >= yi;
        const c2 = y < yj;
        const c3 = ex * wy > ey * wx;
        if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
      }
      return s * Math.sqrt(d) - round;
    },
    bounds: bbox(
      Math.min(...xs) - round,
      Math.min(...ys) - round,
      Math.max(...xs) + round,
      Math.max(...ys) + round,
    ),
  };
}

/** Union; with `k > 0` the joints blend smoothly over about `k` units. */
export function union(parts: readonly Primitive[], k = 0): Primitive {
  return {
    d: (x, y) => {
      let d = Infinity;
      for (const p of parts) {
        const e = p.d(x, y);
        if (k > 0 && Number.isFinite(d)) {
          const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (e - d)) / k));
          d = e + (d - e) * h - k * h * (1 - h);
        } else d = Math.min(d, e);
      }
      return d;
    },
    bounds: unionBounds(parts.map((p) => p.bounds)),
  };
}

/** `a` with `b` cut away. */
export function subtract(a: Primitive, b: Primitive): Primitive {
  return { d: (x, y) => Math.max(a.d(x, y), -b.d(x, y)), bounds: a.bounds };
}

/** Area inside both. */
export function intersect(a: Primitive, b: Primitive): Primitive {
  return {
    d: (x, y) => Math.max(a.d(x, y), b.d(x, y)),
    bounds: bbox(
      Math.max(a.bounds.minX, b.bounds.minX),
      Math.max(a.bounds.minY, b.bounds.minY),
      Math.min(a.bounds.maxX, b.bounds.maxX),
      Math.min(a.bounds.maxY, b.bounds.maxY),
    ),
  };
}

// ---------------------------------------------------------------------------------------------
// Model

/** Shading tones of one material, light → dark (at least 2), plus its outline color. */
export interface Ramp {
  readonly tones: readonly number[];
  readonly outline: number;
}

/** What `ramp` functions see for each pixel. */
export interface SurfacePoint {
  /** Model coordinates. */
  readonly x: number;
  readonly y: number;
  /** Surface normal (z points at the viewer). */
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
  /** Signed distance to the shape edge (negative inside). */
  readonly d: number;
}

export interface Shape {
  readonly prim: Primitive;
  /** Index into `SpriteModel.ramps`, or a function picking one per pixel (markings). */
  readonly ramp: number | ((p: SurfacePoint) => number);
  /** Draw order: higher is in front. */
  readonly z: number;
  /**
   * Shapes with the same group are one volume: no part lines between them.
   * Default: a unique group per shape.
   */
  readonly group?: number;
  /** Draws a line where this shape covers a shape behind it. Default true. */
  readonly lines?: boolean;
  /** Extra shading bands (1 = one tone darker), e.g. for far legs. Default 0. */
  readonly depth?: number;
  /** Grows the shape by up to half a pixel so thin parts survive small sizes. */
  readonly thin?: boolean;
  /** Flat: no shading, always the given tone index. */
  readonly flatTone?: number;
}

/** A pixel stamp drawn after shading (eyes, mouths): pixel coordinates relative to `x, y`. */
export interface Stamp {
  /** Model coordinates of the anchor. */
  readonly x: number;
  readonly y: number;
  /** `[dx, dy, color]` in pixels, relative to the anchor's pixel. */
  readonly pixels: readonly (readonly [number, number, number])[];
}

export interface SpriteModel {
  readonly shapes: readonly Shape[];
  readonly ramps: readonly Ramp[];
}

export interface RasterOptions {
  readonly width: number;
  readonly height: number;
  /** Model-space rectangle mapped onto the full pixel grid. */
  readonly view: Bounds;
  /** Light direction (toward the light). Default: upper left, in front. */
  readonly light?: readonly [number, number, number];
  /** Lambert thresholds between tones, high → low. Default `[0.86, 0.5, 0.18]`. */
  readonly bands?: readonly number[];
  /** Lines between overlapping parts. Default true. */
  readonly partLines?: boolean;
  /** 1-pixel outline around the whole figure. Default true. */
  readonly outline?: boolean;
  /** Called with the pixel scale to produce stamps (eyes, mouths…). */
  readonly stamps?: (pxPerUnit: number) => readonly Stamp[];
}

export interface PixelSprite {
  readonly width: number;
  readonly height: number;
  /** RGBA, straight alpha (0 or 255), row-major. */
  readonly data: Uint8ClampedArray;
}

const DEFAULT_LIGHT: readonly [number, number, number] = [-0.5, -0.62, 0.6];
const DEFAULT_BANDS: readonly number[] = [0.86, 0.5, 0.18];

/** Model-space bounds of everything in the model. */
export function modelBounds(model: SpriteModel): Bounds {
  return unionBounds(model.shapes.map((s) => s.prim.bounds));
}

export function rasterize(model: SpriteModel, options: RasterOptions): PixelSprite {
  const { width: W, height: H, view } = options;
  const upp = (view.maxX - view.minX) / W; // model units per pixel (x)
  const uppY = (view.maxY - view.minY) / H;
  const N = W * H;
  const light = normalize3(options.light ?? DEFAULT_LIGHT);
  const bands = options.bands ?? DEFAULT_BANDS;

  // Front-to-back order; stable for equal z (later shapes in front).
  const order = model.shapes.map((s, i) => ({ s, i })).sort((a, b) => b.s.z - a.s.z || b.i - a.i);

  const owner = new Int32Array(N).fill(-1);
  const dist = new Float32Array(N);
  const px = (i: number): number => view.minX + ((i % W) + 0.5) * upp;
  const py = (i: number): number => view.minY + (Math.floor(i / W) + 0.5) * uppY;

  // 1) Coverage: the front-most shape containing each pixel center.
  for (let i = 0; i < N; i++) {
    const x = px(i);
    const y = py(i);
    for (const { s, i: si } of order) {
      const b = s.prim.bounds;
      const grow = s.thin ? upp * 0.5 : 0;
      if (x < b.minX - grow || x > b.maxX + grow || y < b.minY - grow || y > b.maxY + grow) {
        continue;
      }
      const d = s.prim.d(x, y);
      if (d < grow) {
        owner[i] = si;
        dist[i] = d - grow;
        break;
      }
    }
  }

  // 2) Per-shape depth (deepest visible point) so every part shades like a soft volume.
  const thickness = new Float32Array(model.shapes.length).fill(upp);
  for (let i = 0; i < N; i++) {
    const o = owner[i] ?? -1;
    if (o >= 0) thickness[o] = Math.max(thickness[o] ?? 0, -(dist[i] ?? 0));
  }

  // 3) Shade.
  const out = new Uint8ClampedArray(N * 4);
  const color = new Int32Array(N).fill(-1);
  const rampOf = new Int32Array(N).fill(0);
  const eps = upp * 0.5;
  for (let i = 0; i < N; i++) {
    const o = owner[i] ?? -1;
    if (o < 0) continue;
    const s = model.shapes[o];
    if (!s) continue;
    const x = px(i);
    const y = py(i);
    const f = s.prim.d;
    let gx = f(x + eps, y) - f(x - eps, y);
    let gy = f(x, y + eps) - f(x, y - eps);
    const gl = Math.hypot(gx, gy) || 1;
    gx /= gl;
    gy /= gl;
    const depth = Math.min(1, Math.max(0, -(dist[i] ?? 0) / (thickness[o] ?? 1)));
    const nz = Math.sqrt(1 - (1 - depth) ** 2);
    const side = Math.sqrt(Math.max(0, 1 - nz * nz));
    const n = { x, y, nx: gx * side, ny: gy * side, nz, d: dist[i] ?? 0 };
    const rampIndex = typeof s.ramp === 'number' ? s.ramp : s.ramp(n);
    const ramp = model.ramps[rampIndex];
    if (!ramp) throw new Error(`rasterize: unknown ramp ${rampIndex}`);
    rampOf[i] = rampIndex;
    let tone: number;
    if (s.flatTone !== undefined) tone = s.flatTone;
    else {
      const lambert = n.nx * light[0] + n.ny * light[1] + n.nz * light[2];
      tone = bands.findIndex((t) => lambert >= t);
      if (tone < 0) tone = bands.length;
      tone += s.depth ?? 0;
    }
    tone = Math.max(0, Math.min(ramp.tones.length - 1, tone));
    color[i] = ramp.tones[tone] ?? 0;
  }

  // 4) Part lines: where a lined shape meets a different group behind it, darken the
  //    behind pixel with the front shape's outline color.
  if (options.partLines ?? true) {
    const lineColor = new Int32Array(N).fill(-1);
    for (let i = 0; i < N; i++) {
      const o = owner[i] ?? -1;
      if (o < 0) continue;
      const s = model.shapes[o];
      if (!s || s.lines === false) continue;
      const x = i % W;
      const y = Math.floor(i / W);
      for (const [dx, dy] of NEIGHBORS4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        const oj = owner[j] ?? -1;
        if (oj < 0 || oj === o) continue;
        const t = model.shapes[oj];
        if (!t) continue;
        if ((t.group ?? -1 - oj) === (s.group ?? -1 - o)) continue;
        if (t.z >= s.z) continue;
        lineColor[j] = model.ramps[rampOf[i] ?? 0]?.outline ?? 0;
      }
    }
    for (let i = 0; i < N; i++) if ((lineColor[i] ?? -1) >= 0) color[i] = lineColor[i] ?? 0;
  }

  // 5) Stamps.
  if (options.stamps) {
    for (const st of options.stamps(1 / upp)) {
      const ax = Math.floor((st.x - view.minX) / upp);
      const ay = Math.floor((st.y - view.minY) / uppY);
      for (const [dx, dy, c] of st.pixels) {
        const x = ax + dx;
        const y = ay + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const j = y * W + x;
        if ((owner[j] ?? -1) < 0) continue; // stamps stay on the figure
        color[j] = c;
      }
    }
  }

  // 6) Outer outline.
  if (options.outline ?? true) {
    const edge = new Int32Array(N).fill(-1);
    for (let i = 0; i < N; i++) {
      if ((owner[i] ?? -1) >= 0) continue;
      const x = i % W;
      const y = Math.floor(i / W);
      for (const [dx, dy] of NEIGHBORS4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if ((owner[j] ?? -1) < 0) continue;
        edge[i] = model.ramps[rampOf[j] ?? 0]?.outline ?? 0;
        break;
      }
    }
    for (let i = 0; i < N; i++) if ((edge[i] ?? -1) >= 0) color[i] = edge[i] ?? 0;
  }

  for (let i = 0; i < N; i++) {
    const c = color[i] ?? -1;
    if (c < 0) continue;
    out[i * 4] = (c >> 16) & 255;
    out[i * 4 + 1] = (c >> 8) & 255;
    out[i * 4 + 2] = c & 255;
    out[i * 4 + 3] = 255;
  }
  return { width: W, height: H, data: out };
}

const NEIGHBORS4: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function normalize3([x, y, z]: readonly [number, number, number]): [number, number, number] {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

/** Mirrors a sprite horizontally (e.g. the player's Zorling faces right, enemies face left). */
export function flipX(sprite: PixelSprite): PixelSprite {
  const { width: W, height: H, data } = sprite;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = (y * W + x) * 4;
      const b = (y * W + (W - 1 - x)) * 4;
      out[b] = data[a] ?? 0;
      out[b + 1] = data[a + 1] ?? 0;
      out[b + 2] = data[a + 2] ?? 0;
      out[b + 3] = data[a + 3] ?? 0;
    }
  }
  return { width: W, height: H, data: out };
}

/** FNV-1a hash of the pixels — a cheap fingerprint for "renders identically" checks. */
export function spriteHash(sprite: PixelSprite): string {
  let h = 0x811c9dc5;
  for (const v of sprite.data) {
    h ^= v;
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Tight model bounds, found by sampling the shapes on a `steps`-wide grid inside the
 * primitive bounds (which can be loose, e.g. for intersections). Accurate to one grid step.
 */
export function tightBounds(model: SpriteModel, steps = 192): Bounds {
  const loose = modelBounds(model);
  const step = Math.max(loose.maxX - loose.minX, loose.maxY - loose.minY) / steps;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let y = loose.minY; y <= loose.maxY; y += step) {
    for (let x = loose.minX; x <= loose.maxX; x += step) {
      for (const s of model.shapes) {
        const b = s.prim.bounds;
        if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) continue;
        if (s.prim.d(x, y) < 0) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          break;
        }
      }
    }
  }
  if (!Number.isFinite(minX)) return loose;
  return { minX: minX - step, minY: minY - step, maxX: maxX + step, maxY: maxY + step };
}
