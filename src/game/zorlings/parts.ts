/**
 * Zorling part library: the shape builder, ramps, and reusable parts (ears, horns, tails,
 * back features, wings) that body plans (`build.ts`, `plans-wild.ts`) assemble.
 *
 * Model space: the Zorling faces right (+x), y points down, the ground is y = 0, and a typical
 * body is ~50–90 units across (the renderer fits it to the sprite size). Eyes and mouths are
 * not shapes: they are returned as specs and drawn as pixel stamps (`render.ts`) so they stay
 * crisp and readable at every size.
 */

import { hashString } from '@engine/core';
import {
  capsule,
  circle,
  ellipse,
  intersect,
  polygon,
  union,
  type Primitive,
  type Ramp,
  type Shape,
  type SpriteModel,
  type SurfacePoint,
} from '@engine/render/sdf-sprite';
import type { PartKind, ZorlingGenome } from './genome';
import { FIXED, makeRamp } from './palette';

/** Ramp indices in every Zorling model. */
export const R = {
  primary: 0,
  secondary: 1,
  belly: 2,
  accent: 3,
  white: 4,
  dark: 5,
  flame: 6,
  flameCore: 7,
} as const;

export interface EyeSpec {
  readonly x: number;
  readonly y: number;
  /** Radius in model units. */
  readonly r: number;
  /** The far eye in a 3/4 view: drawn narrower. */
  readonly far?: boolean;
}

export interface MouthSpec {
  readonly x: number;
  readonly y: number;
}

export interface ZorlingModel extends SpriteModel {
  readonly eyes: readonly EyeSpec[];
  readonly mouth: MouthSpec | null;
}

export type RampSel = number | ((p: SurfacePoint) => number);
export type Pt = readonly [number, number];

interface AddOptions {
  readonly group?: number;
  readonly lines?: boolean;
  readonly depth?: number;
  readonly thin?: boolean;
  readonly flatTone?: number;
}

export const G = { body: 1, head: 2 } as const;

export class Builder {
  readonly shapes: Shape[] = [];
  readonly eyes: EyeSpec[] = [];
  mouth: MouthSpec | null = null;

  constructor(readonly g: ZorlingGenome) {}

  add(prim: Primitive, ramp: RampSel, z: number, o: AddOptions = {}): void {
    this.shapes.push({ prim, ramp, z, ...o });
  }

  /** Per-pixel material for body surfaces: base color plus belly and markings. */
  skin(
    opts: {
      belly?: boolean;
      spots?: boolean;
      stripes?: boolean;
      socksBelow?: number;
      mask?: EyeSpec;
    } = {},
  ): RampSel {
    const { g } = this;
    const m = g.parts.markings;
    const belly = opts.belly !== false && g.belly;
    const spots = opts.spots !== false && m === 'spots';
    const stripes = opts.stripes !== false && m === 'stripes';
    const socks = m === 'socks' ? opts.socksBelow : undefined;
    const mask = m === 'mask' ? opts.mask : undefined;
    const seed = g.seed;
    if (!belly && !spots && !stripes && socks === undefined && !mask) return R.primary;
    return (p) => {
      if (socks !== undefined && p.y > socks) return R.secondary;
      if (mask && Math.hypot((p.x - mask.x + mask.r * 0.7) / 2.3, p.y - mask.y) < mask.r * 1.25)
        return R.secondary;
      if (belly && p.ny > 0.42) return R.belly;
      if (spots && p.ny < 0.3 && onSpot(p.x, p.y, seed)) return R.secondary;
      if (stripes && p.ny < 0.3 && stripe(p.x, p.y)) return R.secondary;
      return R.primary;
    };
  }

  model(): ZorlingModel {
    const { palette } = this.g;
    const ramps: Ramp[] = [];
    ramps[R.primary] = makeRamp(palette.primary);
    ramps[R.secondary] = makeRamp(palette.secondary);
    ramps[R.belly] = makeRamp(palette.belly);
    ramps[R.accent] = makeRamp(palette.accent);
    ramps[R.white] = FIXED.white;
    ramps[R.dark] = FIXED.dark;
    ramps[R.flame] = FIXED.flame;
    ramps[R.flameCore] = FIXED.flameCore;
    return { shapes: this.shapes, ramps, eyes: this.eyes, mouth: this.mouth };
  }
}

export function onSpot(x: number, y: number, seed: number): boolean {
  const cell = 7;
  const cx = Math.floor(x / cell);
  const cy = Math.floor(y / cell);
  const h = hashString(`${seed}:${cx}:${cy}`);
  if (h % 3 === 0) return false;
  const ox = (cx + 0.3 + ((h >>> 4) % 40) / 100) * cell;
  const oy = (cy + 0.3 + ((h >>> 10) % 40) / 100) * cell;
  const r = 1.5 + ((h >>> 16) % 10) / 10;
  return Math.hypot(x - ox, y - oy) < r;
}

export function stripe(x: number, y: number): boolean {
  const t = (x * 0.92 + y * 0.3) / 7.5;
  return t - Math.floor(t) < 0.3;
}

// ---------------------------------------------------------------------------------------------
// Shape helpers

export const deg = (d: number): number => (d * Math.PI) / 180;
export const dirPt = (x: number, y: number, angle: number, len: number): Pt => [
  x + Math.cos(angle) * len,
  y + Math.sin(angle) * len,
];

/** Pointed leaf / lens from a to b, `width` at the middle. */
export function lens(ax: number, ay: number, bx: number, by: number, width: number): Primitive {
  const c = Math.hypot(bx - ax, by - ay) / 2;
  const s = Math.max(0.5, width / 2);
  const rad = (c * c + s * s) / (2 * s);
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const px = -(by - ay) / (2 * c || 1);
  const py = (bx - ax) / (2 * c || 1);
  const off = rad - s;
  return intersect(
    circle(mx + px * off, my + py * off, rad),
    circle(mx - px * off, my - py * off, rad),
  );
}

/** Flame: a teardrop base with three tongues rising along `angle` (usually up). */
export function flame(x: number, y: number, size: number, angle: number): Primitive {
  const perp = angle + Math.PI / 2;
  const tongue = (side: number, len: number, lean: number): Primitive => {
    const [bx, by] = dirPt(x, y, perp, side * size * 0.28);
    const [mx, my] = dirPt(bx, by, angle + lean * 0.5, size * len * 0.55);
    const [tx, ty] = dirPt(mx, my, angle + lean, size * len * 0.5);
    return union([
      capsule(bx, by, mx, my, size * 0.3, size * 0.18),
      capsule(mx, my, tx, ty, size * 0.18, size * 0.02),
    ]);
  };
  return union(
    [
      circle(x, y, size * 0.45),
      tongue(0, 1.35, deg(-12)),
      tongue(-1, 0.95, deg(-25)),
      tongue(1, 0.85, deg(15)),
    ],
    size * 0.15,
  );
}

/** Lightning bolt pointing along `angle`. */
export function bolt(x: number, y: number, size: number, angle: number): Primitive {
  const pts: Pt[] = [
    [0, -0.18],
    [0.45, -0.32],
    [0.4, -0.05],
    [1.0, -0.25],
    [0.5, 0.18],
    [0.55, -0.02],
    [0, 0.18],
  ];
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return polygon(
    pts.map(([u, v]) => [x + (u * c - v * s) * size, y + (u * s + v * c) * size] as const),
    0.6,
  );
}

/** A curved chain of tapered capsules (tails, horns, necks). */
export function curve(
  x: number,
  y: number,
  angle: number,
  bend: number,
  len: number,
  r0: number,
  r1: number,
  segments = 3,
): { prim: Primitive; end: Pt; endAngle: number } {
  const parts: Primitive[] = [];
  let px = x;
  let py = y;
  let a = angle;
  const step = len / segments;
  for (let i = 0; i < segments; i++) {
    const [nx, ny] = dirPt(px, py, a, step);
    const ra = r0 + ((r1 - r0) * i) / segments;
    const rb = r0 + ((r1 - r0) * (i + 1)) / segments;
    parts.push(capsule(px, py, nx, ny, ra, rb));
    px = nx;
    py = ny;
    a += bend / segments;
  }
  return { prim: union(parts), end: [px, py], endAngle: a };
}

// ---------------------------------------------------------------------------------------------
// Part library. Each takes an anchor in model space and a size.

/** Ears on a head at (hx, hy) with radius r. */
export function addEars(
  b: Builder,
  kind: PartKind<'ears'>,
  hx: number,
  hy: number,
  r: number,
): void {
  if (kind === 'none') return;
  const tip = b.g.parts.markings === 'tip';
  const outer = tip ? R.secondary : R.primary;
  const place: readonly [number, number, boolean][] = [
    [hx - r * 0.55, hy - r * 0.62, true],
    [hx - r * 0.05, hy - r * 0.8, false],
  ];
  for (const [x, y, far] of place) {
    const z = far ? 11 : 13;
    const o = far ? { depth: 1 } : {};
    switch (kind) {
      case 'pointy': {
        const pts: Pt[] = [
          [x - r * 0.38, y + r * 0.25],
          [x + r * 0.32, y + r * 0.2],
          [x - r * 0.12, y - r * 0.85],
        ];
        b.add(polygon(pts, 1), outer, z, o);
        if (!far) {
          b.add(
            polygon(
              [
                [x - r * 0.2, y + r * 0.12],
                [x + r * 0.15, y + r * 0.1],
                [x - r * 0.1, y - r * 0.5],
              ],
              0.5,
            ),
            R.belly,
            z + 0.1,
            { lines: false },
          );
        }
        break;
      }
      case 'round':
        b.add(circle(x, y - r * 0.15, r * 0.36), outer, z, o);
        if (!far)
          b.add(circle(x + r * 0.03, y - r * 0.12, r * 0.18), R.belly, z + 0.1, { lines: false });
        break;
      case 'long': {
        const e = ellipse(x - r * 0.15, y - r * 0.75, r * 0.24, r * 0.78, deg(-18));
        b.add(e, outer, z, o);
        if (!far) {
          b.add(ellipse(x - r * 0.12, y - r * 0.7, r * 0.1, r * 0.52, deg(-18)), R.belly, z + 0.1, {
            lines: false,
          });
        }
        break;
      }
      case 'fin':
        b.add(
          polygon(
            [
              [x + r * 0.1, y + r * 0.35],
              [x - r * 0.9, y - r * 0.55],
              [x - r * 0.55, y + r * 0.05],
              [x - r * 0.95, y + r * 0.35],
            ],
            1,
          ),
          R.secondary,
          z,
          o,
        );
        break;
      case 'tuft':
        if (far) break;
        for (let i = 0; i < 3; i++) {
          const a = deg(-120 + i * 24);
          const [tx, ty] = dirPt(x + r * 0.2, y + r * 0.15, a, r * (0.95 - i * 0.15));
          b.add(lens(x + r * 0.2, y + r * 0.15, tx, ty, r * 0.32), R.secondary, z - i * 0.01);
        }
        break;
    }
  }
}

export function addHorns(
  b: Builder,
  kind: PartKind<'horns'>,
  hx: number,
  hy: number,
  r: number,
): void {
  if (kind === 'none') return;
  const A = R.accent;
  switch (kind) {
    case 'single': {
      const x = hx + r * 0.35;
      const y = hy - r * 0.75;
      const [tx, ty] = dirPt(x, y, deg(-70), r * 0.95);
      b.add(capsule(x, y, tx, ty, r * 0.2, r * 0.03), A, 13.5);
      break;
    }
    case 'pair':
      for (const [dx, far] of [
        [-0.35, true],
        [0.15, false],
      ] as const) {
        const x = hx + r * dx;
        const y = hy - r * 0.8;
        const [tx, ty] = dirPt(x, y, deg(far ? -100 : -80), r * 0.7);
        b.add(
          capsule(x, y, tx, ty, r * 0.17, r * 0.03),
          A,
          far ? 11 : 13.5,
          far ? { depth: 1 } : {},
        );
      }
      break;
    case 'curved':
      for (const far of [true, false]) {
        const x = hx + (far ? -r * 0.45 : -r * 0.05);
        const c = curve(x, hy - r * 0.75, deg(-120), deg(-110), r * 1.1, r * 0.22, r * 0.05);
        b.add(c.prim, A, far ? 11 : 13.5, far ? { depth: 1 } : {});
      }
      break;
    case 'antlers':
      for (const far of [true, false]) {
        const x = hx + (far ? -r * 0.45 : 0);
        const y = hy - r * 0.8;
        const main = curve(x, y, deg(-105), deg(-40), r * 1.2, r * 0.12, r * 0.06, 2);
        const [bx, by] = dirPt(x, y, deg(-100), r * 0.55);
        const [cx, cy] = dirPt(bx, by, deg(-55), r * 0.45);
        b.add(union([main.prim, capsule(bx, by, cx, cy, r * 0.09, r * 0.05)]), A, far ? 11 : 13.5, {
          thin: true,
          ...(far ? { depth: 1 } : {}),
        });
      }
      break;
    case 'nubs':
      b.add(circle(hx - r * 0.35, hy - r * 0.85, r * 0.16), A, 11, { depth: 1 });
      b.add(circle(hx + r * 0.2, hy - r * 0.9, r * 0.18), A, 13.5);
      break;
  }
}

/** Tail from (x, y), pointing along `angle`, `len` units long, base radius `r`. */
export function addTail(
  b: Builder,
  kind: PartKind<'tail'>,
  x: number,
  y: number,
  angle: number,
  len: number,
  r: number,
): void {
  if (kind === 'none') return;
  const tip = b.g.parts.markings === 'tip' ? R.secondary : R.primary;
  const z = 6;
  const stripes = b.skin({ belly: false, spots: false });
  switch (kind) {
    case 'thin': {
      const c = curve(x, y, angle, deg(-50), len, r * 0.55, r * 0.3);
      b.add(c.prim, stripes, z);
      b.add(circle(c.end[0], c.end[1], r * 0.55), tip, z + 0.1);
      break;
    }
    case 'fluffy': {
      const c = curve(x, y, angle, deg(-30), len * 0.35, r * 0.6, r * 0.7, 1);
      const [ex, ey] = dirPt(c.end[0], c.end[1], c.endAngle, len * 0.4);
      b.add(union([c.prim, ellipse(ex, ey, len * 0.5, r * 1.2, c.endAngle)], 3), stripes, z);
      if (tip === R.secondary) {
        const [fx, fy] = dirPt(ex, ey, c.endAngle, len * 0.38);
        b.add(ellipse(fx, fy, len * 0.18, r * 0.8, c.endAngle), tip, z + 0.1, { lines: false });
      }
      break;
    }
    case 'flame': {
      const c = curve(x, y, angle, deg(-40), len * 0.55, r * 0.55, r * 0.4, 2);
      b.add(c.prim, R.primary, z);
      const size = r * 1.9 + len * 0.22;
      const up = deg(-100);
      b.add(flame(c.end[0], c.end[1], size, up), R.flame, z + 0.1);
      b.add(flame(c.end[0], c.end[1] + size * 0.1, size * 0.55, up), R.flameCore, z + 0.2, {
        lines: false,
      });
      break;
    }
    case 'fin': {
      const c = curve(x, y, angle, deg(-25), len * 0.5, r * 0.6, r * 0.35, 2);
      b.add(c.prim, stripes, z);
      const [ex, ey] = c.end;
      const a = c.endAngle;
      const L = len * 0.55 + r;
      b.add(
        polygon(
          [
            [ex, ey],
            dirPt(ex, ey, a - deg(38), L),
            dirPt(ex, ey, a, L * 0.6),
            dirPt(ex, ey, a + deg(38), L),
          ],
          1,
        ),
        R.secondary,
        z - 0.1,
      );
      break;
    }
    case 'leaf': {
      const c = curve(x, y, angle, deg(-40), len * 0.5, r * 0.5, r * 0.3, 2);
      b.add(c.prim, R.primary, z);
      const [tx, ty] = dirPt(c.end[0], c.end[1], c.endAngle - deg(20), len * 0.8 + r);
      b.add(lens(c.end[0], c.end[1], tx, ty, r * 1.7 + len * 0.15), R.secondary, z + 0.1);
      break;
    }
    case 'club': {
      const c = curve(x, y, angle, deg(-20), len * 0.75, r * 0.6, r * 0.45, 2);
      b.add(c.prim, stripes, z);
      b.add(circle(c.end[0], c.end[1], r * 1.05), R.accent, z + 0.1);
      break;
    }
    case 'bolt': {
      const c = curve(x, y, angle, deg(-30), len * 0.45, r * 0.5, r * 0.4, 2);
      b.add(c.prim, R.primary, z);
      b.add(bolt(c.end[0], c.end[1], len * 0.75 + r, c.endAngle - deg(30)), R.secondary, z + 0.1);
      break;
    }
  }
}

/**
 * Back features along a ridge: `ridge` lists points on the top outline with the outward
 * angle there. Drawn behind the body so they grow out of it.
 */
export function addBack(
  b: Builder,
  kind: PartKind<'back'>,
  ridge: readonly (readonly [number, number, number])[],
  size: number,
): void {
  if (kind === 'none' || ridge.length === 0) return;
  const z = 7;
  ridge.forEach(([x, y, a], i) => {
    const s = size * (0.75 + 0.25 * Math.sin((i / Math.max(1, ridge.length - 1)) * Math.PI));
    switch (kind) {
      case 'spikes': {
        const base = a + Math.PI / 2;
        b.add(
          polygon(
            [
              dirPt(x, y, base, s * 0.42),
              dirPt(x, y, a - deg(18), s * 1.05),
              dirPt(x, y, base, -s * 0.42),
            ],
            0.6,
          ),
          R.accent,
          z,
        );
        break;
      }
      case 'plates': {
        const [cx, cy] = dirPt(x, y, a, s * 0.35);
        b.add(ellipse(cx, cy, s * 0.42, s * 0.62, a + Math.PI / 2), R.secondary, z);
        break;
      }
      case 'leaves': {
        if (i % 2 === 1 && ridge.length > 2) break;
        const [tx, ty] = dirPt(x, y, a - deg(25), s * 1.3);
        b.add(lens(x, y, tx, ty, s * 0.65), R.secondary, z);
        break;
      }
      case 'crystals': {
        const base = a + Math.PI / 2;
        const w = s * 0.28;
        const h = s * (1.0 + (i % 2) * 0.35);
        b.add(
          polygon(
            [
              dirPt(x, y, base, w),
              dirPt(...dirPt(x, y, base, w), a, h * 0.75),
              dirPt(x, y, a, h),
              dirPt(...dirPt(x, y, base, -w), a, h * 0.75),
              dirPt(x, y, base, -w),
            ],
            0.3,
          ),
          R.accent,
          z,
        );
        break;
      }
      case 'mane': {
        // Fur tufts swept backward.
        const [tx, ty] = dirPt(x, y, a - deg(40), s * 1.1);
        b.add(lens(x, y, tx, ty, s * 0.5), R.secondary, z + 3.5, { group: 3 });
        break;
      }
      case 'sail':
        break;
    }
  });
  if (kind === 'sail') {
    const pts: Pt[] = ridge.map(([x, y]) => [x, y + size * 0.2]);
    const top: Pt[] = [...ridge]
      .reverse()
      .map(([x, y, a], i, arr) =>
        dirPt(x, y, a, size * (0.7 + 0.6 * Math.sin((i / Math.max(1, arr.length - 1)) * Math.PI))),
      );
    b.add(polygon([...pts, ...top], 1), R.secondary, z);
  }
}

/** A pair of wings at the shoulder; `size` ≈ wing length. Near wing in front. */
export function addWings(
  b: Builder,
  kind: PartKind<'wings'>,
  x: number,
  y: number,
  size: number,
  zFront = 14,
): void {
  if (kind === 'none') return;
  for (const far of [true, false]) {
    const ox = far ? x + size * 0.12 : x;
    const oy = far ? y - size * 0.08 : y;
    const z = far ? 2 : zFront;
    const o = far ? { depth: 1 } : {};
    const tilt = far ? deg(-12) : 0;
    if (kind === 'feather') {
      // Near wing folded along the side (feather tips at the back); far wing raised behind.
      const a = far ? deg(-160) : deg(168);
      const tip = dirPt(ox, oy, a, size);
      const parts: Primitive[] = [lens(ox + size * 0.08, oy, tip[0], tip[1], size * 0.62)];
      for (let i = 0; i < 3; i++) {
        const [bx, by] = dirPt(ox, oy, a + deg(far ? -4 : 4), size * (0.5 + i * 0.17));
        const [fx, fy] = dirPt(bx, by, a + deg(far ? -14 + i * 8 : 14 - i * 8), size * 0.42);
        parts.push(lens(bx, by, fx, fy, size * 0.2));
      }
      b.add(union(parts, 1.5), R.secondary, z, o);
    } else {
      const a0 = deg(-140) + tilt;
      const tip = dirPt(ox, oy, a0, size);
      const pts: Pt[] = [
        [ox, oy],
        tip,
        dirPt(ox, oy, a0 + deg(25), size * 0.7),
        dirPt(ox, oy, a0 + deg(42), size * 0.78),
        dirPt(ox, oy, a0 + deg(62), size * 0.55),
      ];
      b.add(polygon(pts, 0.8), R.secondary, z, o);
      b.add(capsule(ox, oy, tip[0], tip[1], size * 0.06, size * 0.03), R.accent, z + 0.1, {
        ...o,
        thin: true,
        lines: false,
      });
    }
  }
}

/** Upper outline of an ellipse as ridge points between `from` and `to` (fraction of rx). */
export function ellipseRidge(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  from: number,
  to: number,
  n: number,
): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const f = from + ((to - from) * i) / Math.max(1, n - 1);
    const t = Math.acos(Math.max(-1, Math.min(1, f)));
    const x = cx + rx * Math.cos(t);
    const y = cy - ry * Math.sin(t);
    const a = Math.atan2(-Math.sin(t) / ry, Math.cos(t) / rx);
    out.push([x - Math.cos(a) * 1.5, y - Math.sin(a) * 1.5, a]);
  }
  return out;
}
