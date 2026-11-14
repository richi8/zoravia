/**
 * Legendary dragon plans (C35a): one per region, each built around its element, with glowing
 * details in the `R.glow` ramp. Leafwyrm (forest), magmadrake (volcano), frostwyrm (ice).
 */

import {
  capsule,
  circle,
  ellipse,
  polygon,
  union,
  type Primitive,
} from '@engine/render/sdf-sprite';
import type { Builder } from './parts';
import { addEars, curve, deg, dirPt, flame, G, lens, R, type EyeSpec, type Pt } from './parts';
import { headScale, membraneWing } from './plans-wild';

/** A dragon head facing right: skull, long snout, brow, nostril. Returns the head radius. */
function dragonHead(b: Builder, hx: number, hy: number, r: number, tilt = 0): EyeSpec {
  const eye: EyeSpec = { x: hx + r * 0.15, y: hy - r * 0.3, r: r * 0.26 };
  b.add(
    union(
      [
        ellipse(hx, hy, r * 1.05, r * 0.8, deg(tilt)),
        capsule(hx + r * 0.4, hy + r * 0.05, hx + r * 1.7, hy + r * 0.3, r * 0.55, r * 0.38),
      ],
      2,
    ),
    R.primary,
    12,
    { group: G.head },
  );
  // Jaw.
  b.add(
    capsule(hx + r * 0.1, hy + r * 0.55, hx + r * 1.5, hy + r * 0.6, r * 0.3, r * 0.2),
    R.belly,
    11.9,
    {},
  );
  b.add(circle(hx + r * 1.75, hy + r * 0.12, r * 0.11), R.dark, 12.5, { lines: false, thin: true });
  b.add(
    polygon([
      [eye.x - r * 0.5, eye.y - r * 0.3],
      [eye.x + r * 0.5, eye.y - r * 0.15],
      [eye.x - r * 0.35, eye.y - r * 0.55],
    ]),
    R.primary,
    12.6,
    { depth: 1, lines: false, thin: true },
  );
  b.eyes.push(eye);
  b.mouth = { x: hx + r * 1.2, y: hy + r * 0.6 };
  return eye;
}

/** Catmull-Rom point along a polyline at t ∈ [0, 1]. */
function catmull(p: readonly Pt[], t: number): Pt {
  const n = p.length - 1;
  const f = Math.min(n - 1e-9, Math.max(0, t * n));
  const i = Math.floor(f);
  const u = f - i;
  const at = (k: number): Pt => p[Math.min(n, Math.max(0, k))] ?? [0, 0];
  const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
  const c = (a: number, b: number, c2: number, d: number): number =>
    0.5 *
    (2 * b +
      (-a + c2) * u +
      (2 * a - 5 * b + 4 * c2 - d) * u * u +
      (-a + 3 * b - 3 * c2 + d) * u * u * u);
  return [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])];
}

/** Leafwyrm: a long eastern dragon floating in an S-curve, antlers, leaf mane, a glowing pearl. */
function leafwyrm(b: Builder): void {
  const { body } = b.g;
  const hs = headScale(b);
  const r0 = 5.5 + 2.5 * body.bulk;
  const k = 1 + 0.25 * body.length;
  const h = 1 + 0.25 * body.height;
  // An S-coil floating above the ground: tail low at the back, a dip, then the neck rising.
  const anchors: Pt[] = [
    [-42 * k, -22 * h],
    [-30 * k, -34 * h],
    [-16 * k, -32 * h],
    [-4 * k, -18 * h],
    [9 * k, -16 * h],
    [17 * k, -30 * h],
    [13 * k, -46 * h],
    [18 * k, -58 * h],
  ];
  const pts: [number, number, number][] = [];
  const n = 29;
  for (let i = 0; i < n; i++) {
    const [x, y] = catmull(anchors, i / (n - 1));
    const t = i / (n - 1);
    const rad = t < 0.3 ? r0 * (0.3 + 2.3 * t) : r0 * (1 - 0.15 * (t - 0.3));
    pts.push([x, y, rad]);
  }
  const segs: Primitive[] = [];
  for (let i = 1; i < n; i++) {
    const [ax, ay, ar] = pts[i - 1] ?? [0, 0, 1];
    const [bx, by, br] = pts[i] ?? [0, 0, 1];
    segs.push(capsule(ax, ay, bx, by, ar, br));
  }
  b.add(union(segs, 2), b.skin({ stripes: false }), 10, { group: G.body });
  // Leaf mane on the back side of the coil (left of the direction of travel).
  for (let i = 3; i < n - 2; i += 2) {
    const [x, y, rad] = pts[i] ?? [0, 0, 1];
    const [x2, y2] = pts[i + 1] ?? [0, 0, 1];
    const dir = Math.atan2(y2 - y, x2 - x);
    const out = dir - Math.PI / 2;
    const [bx, by] = dirPt(x, y, out, rad * 0.7);
    const [tx, ty] = dirPt(bx, by, out - deg(35), r0 * 2.1);
    b.add(lens(bx, by, tx, ty, r0 * 1.1), R.secondary, 7);
  }
  // Leaf fan at the tail tip, on the tail bone.
  const [tx0, ty0] = pts[0] ?? [0, 0];
  b.setBone('tail', [tx0 + 3, ty0]);
  for (const a of [150, 185, 220]) {
    const [ex, ey] = dirPt(tx0, ty0, deg(a), r0 * 3);
    b.add(lens(tx0, ty0, ex, ey, r0 * 1.3), R.secondary, 6);
  }
  b.bone = 'body';
  // Four small clawed legs; the front pair holds a glowing pearl.
  const legAt = [10, 12, 17, 19];
  legAt.forEach((at, i) => {
    const [x, y, rad] = pts[at] ?? [0, 0, 1];
    const far = i % 2 === 0;
    const [fx, fy] = [x + 3, y + rad + 6];
    b.add(
      capsule(x, y + rad * 0.5, fx, fy, 1.8, 1.4),
      R.primary,
      far ? 8 : 10.5,
      far ? { depth: 1 } : {},
    );
    b.add(circle(fx + 1, fy + 0.5, 1.4), R.accent, far ? 8.1 : 10.6, {
      thin: true,
      ...(far ? { depth: 1 } : {}),
    });
  });
  const [px, py] = pts[19] ?? [0, 0];
  b.add(circle(px + 6, py + r0 + 7, 3.8), R.glow, 10.7, { flatTone: 0 });
  b.add(circle(px + 5, py + r0 + 6, 1.2), R.white, 10.8, { lines: false, flatTone: 0 });

  // Head at the front end, with antlers, whiskers and ears.
  const [nx, ny] = pts[n - 1] ?? [0, 0];
  const r = (8 + 2.5 * body.head) * hs;
  const hx = nx + r * 0.5;
  const hy = ny - r * 0.1;
  b.setBone('head', [nx, ny]);
  dragonHead(b, hx, hy, r);
  for (const far of [true, false]) {
    const x = hx - r * (far ? 0.5 : 0.15);
    const y = hy - r * 0.6;
    const main = curve(x, y, deg(-120), deg(55), r * 2.4, r * 0.18, r * 0.08, 4);
    const tines: Primitive[] = [main.prim];
    for (let i = 1; i <= 2; i++) {
      const t = curve(x, y, deg(-120), deg(55) * (i / 3), r * 2.4 * (i / 3), r * 0.15, r * 0.1, 2);
      const [ex, ey] = dirPt(t.end[0], t.end[1], t.endAngle - deg(65), r * 0.8);
      tines.push(capsule(t.end[0], t.end[1], ex, ey, r * 0.12, r * 0.06));
    }
    b.add(union(tines), R.accent, far ? 11 : 13.5, { thin: true, ...(far ? { depth: 1 } : {}) });
  }
  // Long whiskers trailing back.
  for (const dy of [0, 0.25]) {
    const w = curve(
      hx + r * 1.6,
      hy + r * (0.2 + dy),
      deg(160),
      deg(-60),
      r * 2.6,
      r * 0.09,
      r * 0.05,
      4,
    );
    b.add(w.prim, R.glow, 12.7, { lines: false, thin: true, flatTone: 1 });
  }
  addEars(b, 'fin', hx - r * 0.5, hy + r * 0.1, r);
  b.bone = 'body';
}

/** Magmadrake: a massive rock-plated dragon with glowing lava cracks, horns and half-spread wings. */
function magmadrake(b: Builder): void {
  const { body } = b.g;
  const hs = headScale(b);
  const legLen = 11 + 5 * body.limbs;
  const rx = 21 + 6 * body.length;
  const ry = 13 + 3 * body.height + 3 * body.bulk;
  const cy = -(legLen + ry * 0.55);
  const legR = 4.5 + 2 * body.bulk;
  const r = (8.5 + 2.5 * body.head) * hs;

  const neck = curve(
    rx * 0.6,
    cy - ry * 0.3,
    deg(-40),
    deg(40),
    12 + 5 * body.height,
    r * 0.75,
    r * 0.6,
    3,
  );
  const [nx, ny] = neck.end;
  const tail = curve(
    -rx * 0.85,
    cy,
    deg(175),
    deg(-40),
    30 + 8 * body.length,
    legR * 1.2,
    legR * 0.5,
    6,
  );
  b.add(
    union(
      [ellipse(0, cy, rx, ry), circle(rx * 0.45, cy - ry * 0.2, ry * 1.05), neck.prim, tail.prim],
      4,
    ),
    b.skin({ stripes: false }),
    10,
    { group: G.body },
  );
  // Lava cracks across the flank.
  const cracks: Primitive[] = [];
  for (let i = 0; i < 4; i++) {
    const x = -rx * 0.55 + i * rx * 0.35;
    const a = curve(
      x,
      cy - ry * 0.5,
      deg(80 + (i % 2) * 20),
      deg(i % 2 ? -40 : 40),
      ry * 0.9,
      0.9,
      0.5,
      3,
    );
    cracks.push(a.prim);
  }
  b.add(union(cracks), R.glow, 10.3, { lines: false, thin: true, flatTone: 0 });
  // Glowing chest core.
  b.add(ellipse(rx * 0.7, cy + ry * 0.15, ry * 0.45, ry * 0.6), R.glow, 10.4, { flatTone: 1 });
  // Rock plates along the back.
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const x = -rx * 0.7 + t * rx * 1.3;
    const y = cy - ry * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)) - 1;
    const s = 6 + 3 * body.bulk + Math.sin(t * Math.PI) * 4;
    b.add(
      polygon(
        [
          [x - s * 0.55, y + 2],
          [x - s * 0.2, y - s * 1.1],
          [x + s * 0.35, y - s * 0.8],
          [x + s * 0.6, y + 2],
        ],
        0.8,
      ),
      R.secondary,
      7,
    );
    b.add(capsule(x, y - s * 0.6, x + 0.5, y + 1, 0.7, 0.7), R.glow, 7.1, {
      lines: false,
      thin: true,
      flatTone: 0,
    });
  }
  // Pillar legs with claws.
  for (const [lx, far] of [
    [rx * 0.5, true],
    [-rx * 0.55, true],
    [rx * 0.62, false],
    [-rx * 0.42, false],
  ] as const) {
    const x = far ? lx - 4 : lx;
    const o = far ? { depth: 1 } : {};
    b.add(
      capsule(x, cy + ry * 0.2, x + 1.5, -legR * 0.8, legR * 1.15, legR * 0.95),
      R.primary,
      far ? 8 : 9,
      o,
    );
    for (let i = 0; i < 3; i++) {
      const c = x + legR * (0.1 + i * 0.6);
      b.add(
        polygon([
          [c - 1, -1.4],
          [c + 1, -1.4],
          [c + 2, 0],
        ]),
        R.accent,
        far ? 8.1 : 9.1,
        { ...o, thin: true, lines: false },
      );
    }
  }
  // Magma club at the tail tip.
  const [ex, ey] = tail.end;
  b.add(circle(ex, ey, legR * 1.4), R.secondary, 10.2);
  b.add(flame(ex, ey - legR * 0.5, legR * 1.8, deg(-95)), R.flame, 10.3);
  b.add(flame(ex, ey - legR * 0.3, legR, deg(-95)), R.flameCore, 10.35, { lines: false });

  b.setBone('head', [nx, ny]);
  const hx = nx + r * 0.55;
  const hy = ny - r * 0.05;
  dragonHead(b, hx, hy, r, 8);
  // Great horns sweeping back then forward.
  for (const far of [true, false]) {
    const c = curve(
      hx - r * (far ? 0.6 : 0.3),
      hy - r * 0.55,
      deg(-160),
      deg(150),
      r * 2.4,
      r * 0.32,
      r * 0.06,
      5,
    );
    b.add(c.prim, R.accent, far ? 11 : 13.5, far ? { depth: 1 } : {});
  }
  // Smoke-lit nostril.
  b.add(flame(hx + r * 1.85, hy - r * 0.05, r * 0.5, deg(-60)), R.flame, 12.8, { lines: false });
  b.bone = 'body';

  const span = 44 + 14 * body.limbs;
  membraneWing(b, {
    x: rx * 0.3,
    y: cy - ry * 0.85,
    span: span * 0.85,
    arm: deg(-95),
    side: -1,
    z: 3,
    far: true,
  });
  membraneWing(b, { x: rx * 0.1, y: cy - ry * 0.75, span, arm: deg(-75), side: -1, z: 11 });
}

/** Frostwyrm: a rearing wyvern with wide crystal wings, an icicle crest and lightning veins. */
function frostwyrm(b: Builder): void {
  const { body } = b.g;
  const hs = headScale(b);
  const legLen = 12 + 6 * body.limbs;
  const rx = 11 + 3 * body.bulk;
  const ry = 16 + 4 * body.height;
  const cy = -(legLen + ry * 0.7);
  const r = (7 + 2 * body.head) * hs;

  // Upright body (leaning forward), long neck, and a tail sweeping back along the ground.
  const neck = curve(
    rx * 0.3,
    cy - ry * 0.75,
    deg(-80),
    deg(55),
    14 + 6 * body.height,
    r * 0.6,
    r * 0.45,
    4,
  );
  const tail = curve(
    -rx * 0.5,
    cy + ry * 0.6,
    deg(160),
    deg(-50),
    34 + 10 * body.length,
    rx * 0.55,
    1,
    7,
  );
  b.add(
    union([ellipse(0, cy, rx, ry, deg(-18)), neck.prim, tail.prim], 4),
    b.skin({ stripes: false }),
    10,
    { group: G.body },
  );
  b.add(ellipse(rx * 0.3, cy + ry * 0.1, rx * 0.5, ry * 0.75, deg(-18)), R.belly, 10.4, {
    lines: false,
  });
  // Crystal blade at the tail tip.
  const [ex, ey] = tail.end;
  const a = tail.endAngle;
  b.add(
    polygon(
      [
        dirPt(ex, ey, a + deg(90), 3),
        dirPt(ex, ey, a, 12),
        dirPt(ex, ey, a - deg(90), 3),
        dirPt(ex, ey, a + deg(180), 2),
      ],
      0.3,
    ),
    R.frost,
    10.2,
  );
  // Icicle spines down the back and tail.
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const [x, y] = dirPt(-rx * 0.6, cy - ry * 0.5 + t * ry * 0.9, deg(200), 1);
    const h = 7 - t * 3;
    b.add(
      polygon(
        [
          [x + 1.5, y],
          [x - h, y - h * 0.4],
          [x, y + 2.5],
        ],
        0.2,
      ),
      R.frost,
      7,
    );
  }
  // Hind legs: thigh, shin, big feet.
  for (const [lx, far] of [
    [-rx * 0.15, true],
    [rx * 0.25, false],
  ] as const) {
    const o = far ? { depth: 1 } : {};
    const x = far ? lx - 3 : lx;
    const knee: Pt = [x + 5, -legLen * 0.55];
    b.add(
      union([
        ellipse(x, cy + ry * 0.55, 5, 7, deg(-20)),
        capsule(x, cy + ry * 0.6, knee[0], knee[1], 3.5, 2.6),
        capsule(knee[0], knee[1], x + 1, -2, 2.6, 2.2),
      ]),
      R.primary,
      far ? 8 : 10.5,
      o,
    );
    b.add(ellipse(x + 3, -1.6, 4, 1.6), R.primary, far ? 8 : 10.5, o);
    for (let i = 0; i < 3; i++) {
      b.add(
        polygon([
          [x + 3 + i * 2, -1.2],
          [x + 4.5 + i * 2, -1.2],
          [x + 6 + i * 2, 0],
        ]),
        R.accent,
        far ? 8.1 : 10.6,
        { ...o, thin: true, lines: false },
      );
    }
  }
  // Lightning veins on the chest.
  const v = curve(rx * 0.1, cy - ry * 0.4, deg(70), deg(0), ry * 0.9, 0.7, 0.5, 4);
  const v2 = curve(rx * 0.1 + 2, cy - ry * 0.1, deg(100), deg(30), ry * 0.6, 0.6, 0.4, 3);
  b.add(union([v.prim, v2.prim]), R.glow2, 10.5, { lines: false, thin: true, flatTone: 0 });

  const [nx, ny] = neck.end;
  b.setBone('head', [nx, ny]);
  const hx = nx + r * 0.5;
  const hy = ny - r * 0.2;
  dragonHead(b, hx, hy, r, -6);
  // Icicle crest.
  for (let i = 0; i < 4; i++) {
    const [x, y] = [hx - r * (0.2 + i * 0.35), hy - r * (0.6 - i * 0.05)];
    const h = r * (1.6 - i * 0.25);
    b.add(
      polygon(
        [
          [x - r * 0.18, y],
          [x - h * 0.55, y - h],
          [x + r * 0.18, y],
        ],
        0.2,
      ),
      R.frost,
      i % 2 ? 11 : 13.4,
    );
  }
  b.bone = 'body';

  // Wide wings raised high: crystal membrane (frost) with glowing finger bones.
  const span = 58 + 16 * body.limbs;
  for (const [far, sx, sy, arm] of [
    [true, rx * 0.4, cy - ry * 0.8, deg(-105)],
    [false, rx * 0.05, cy - ry * 0.65, deg(-130)],
  ] as const) {
    const prev = b.setBone(far ? 'wingFar' : 'wingNear', [sx, sy]);
    const W = dirPt(sx, sy, arm, span * 0.4);
    const tips = (
      [
        [0, 0.6],
        [35, 0.62],
        [70, 0.5],
      ] as const
    ).map(([d, len]) => dirPt(W[0], W[1], arm + deg(d - 10), span * len));
    const base: Pt = [sx - span * 0.15, sy + span * 0.3];
    const sc = (a: Pt, c: Pt): Pt => {
      const mx = (a[0] + c[0]) / 2;
      const my = (a[1] + c[1]) / 2;
      return [mx + (W[0] - mx) * 0.3, my + (W[1] - my) * 0.3];
    };
    const [t0, t1, t2] = tips as [Pt, Pt, Pt];
    const pts: Pt[] = [[sx, sy], W, t0, sc(t0, t1), t1, sc(t1, t2), t2, sc(t2, base), base];
    const o = far ? { depth: 1 } : {};
    b.add(polygon(pts, 0.6), R.frost, far ? 3 : 11, o);
    const bones: Primitive[] = [capsule(sx, sy, W[0], W[1], 1.8, 1.3)];
    for (const t of tips) bones.push(capsule(W[0], W[1], t[0], t[1], 1, 0.4));
    b.add(union(bones), R.glow2, far ? 3.1 : 11.1, { ...o, thin: true, lines: false, flatTone: 0 });
    b.bone = prev;
  }
}

export const LEGENDARY_PLANS = { leafwyrm, magmadrake, frostwyrm } as const;
