/**
 * The "wild" body plans: realistic animals (feline, canine, raptor, insect, fish) and monsters
 * (dragon, bat, golem). Same model space as `build.ts`: facing right, ground at y = 0.
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
import {
  addBack,
  addEars,
  addHorns,
  addTail,
  curve,
  deg,
  dirPt,
  ellipseRidge,
  flame,
  G,
  lens,
  R,
  type EyeSpec,
  type Pt,
} from './parts';

// ---------------------------------------------------------------------------------------------
// Wings that spread (bats, dragons, raptors)

interface WingOptions {
  /** Shoulder. */
  readonly x: number;
  readonly y: number;
  readonly span: number;
  /** Arm direction for a wing extending to the right (+x); mirrored when `side` is -1. */
  readonly arm: number;
  readonly side: 1 | -1;
  readonly z: number;
  readonly far?: boolean;
  /** Rig bone (default: `wingFar` when `far`, else `wingNear`). */
  readonly bone?: 'wingFar' | 'wingNear';
}

/** Runs `draw` on the wing's bone (pivot at the shoulder), then restores the bone. */
function onWingBone(b: Builder, w: WingOptions, draw: () => void): void {
  const prev = b.setBone(w.bone ?? (w.far ? 'wingFar' : 'wingNear'), [w.x, w.y]);
  draw();
  b.bone = prev;
}

/** Bat/dragon wing: arm and finger bones with a scalloped membrane between them. */
export function membraneWing(b: Builder, w: WingOptions): void {
  onWingBone(b, w, () => membraneShapes(b, w));
}

function membraneShapes(b: Builder, w: WingOptions): void {
  const { x: sx, y: sy, span, arm, side } = w;
  const m = ([px, py]: Pt): Pt => [sx + (px - sx) * side, py];
  const W = dirPt(sx, sy, arm, span * 0.42);
  const fingers = [10, 45, 85].map((da, i) =>
    dirPt(W[0], W[1], arm + deg(da), span * ([0.62, 0.66, 0.5][i] ?? 0.5)),
  );
  const [F1, F2, F3] = fingers as [Pt, Pt, Pt];
  const B: Pt = [sx + span * 0.04, sy + span * 0.4];
  const scallop = (a: Pt, c: Pt): Pt => {
    const mx = (a[0] + c[0]) / 2;
    const my = (a[1] + c[1]) / 2;
    return [mx + (W[0] - mx) * 0.25, my + (W[1] - my) * 0.25];
  };
  const o = w.far ? { depth: 1 } : {};
  const pts: Pt[] = [[sx, sy], W, F1, scallop(F1, F2), F2, scallop(F2, F3), F3, scallop(F3, B), B];
  b.add(polygon(pts.map(m), 0.5), R.secondary, w.z, o);
  const [ws, we] = [m([sx, sy]), m(W)];
  const bones: Primitive[] = [capsule(ws[0], ws[1], we[0], we[1], span * 0.05, span * 0.035)];
  for (const f of fingers) {
    const t = m(f);
    bones.push(capsule(we[0], we[1], t[0], t[1], span * 0.03, span * 0.012));
  }
  b.add(union(bones), R.primary, w.z + 0.05, { ...o, thin: true, lines: false });
  // Thumb claw at the wrist.
  const c0 = m(dirPt(W[0], W[1], arm - deg(40), span * 0.1));
  b.add(
    polygon([[we[0] - span * 0.025, we[1]], [we[0] + span * 0.025, we[1]], c0]),
    R.accent,
    w.z + 0.1,
    { ...o, thin: true },
  );
}

/** Spread bird wing: covert feathers on the arm, long primaries fanning from the wrist. */
export function featherWing(b: Builder, w: WingOptions): void {
  onWingBone(b, w, () => featherShapes(b, w));
}

function featherShapes(b: Builder, w: WingOptions): void {
  const { x: sx, y: sy, span, arm, side } = w;
  const m = ([px, py]: Pt): Pt => [sx + (px - sx) * side, py];
  const W = dirPt(sx, sy, arm, span * 0.45);
  const L = (a: Pt, c: Pt, width: number): Primitive => {
    const [p, q] = [m(a), m(c)];
    return lens(p[0], p[1], q[0], q[1], width);
  };
  const feathers: Primitive[] = [];
  for (let i = 0; i < 5; i++) {
    const base = dirPt(W[0], W[1], arm + deg(180), span * 0.06 * i);
    const tip = dirPt(base[0], base[1], arm + deg(-8 + i * 21), span * (0.62 - i * 0.06));
    feathers.push(L(base, tip, span * 0.14));
  }
  for (let i = 0; i < 4; i++) {
    const t = 0.2 + i * 0.22;
    const base: Pt = [sx + (W[0] - sx) * t, sy + (W[1] - sy) * t];
    const tip = dirPt(base[0], base[1], arm + deg(100 - i * 8), span * 0.34);
    feathers.push(L(base, tip, span * 0.15));
  }
  const o = w.far ? { depth: 1 } : {};
  feathers.push(L([sx, sy], W, span * 0.3));
  const reach = span * 0.55;
  b.add(
    union(feathers, 1),
    (p) => (Math.hypot(p.x - sx, p.y - sy) > reach ? R.secondary : R.primary),
    w.z,
    o,
  );
}

/** Head-size factor by mood: cute Zorlings have big heads, fierce/dark ones smaller. */
export function headScale(b: Builder): number {
  return b.g.mood === 'cute' ? 1.14 : b.g.mood === 'fierce' ? 0.9 : 0.94;
}

// ---------------------------------------------------------------------------------------------
// Plans

/** Feline and canine: lithe four-legged hunters with haunches and digitigrade hind legs. */
function lithe(b: Builder, canine: boolean): void {
  const { body, parts } = b.g;
  const hs = headScale(b);
  const legLen = 14 + 8 * body.limbs;
  const rx = 14 + 6 * body.length;
  const ry = 7 + 2.5 * body.height + 2 * body.bulk + (canine ? 1.5 : 0);
  const cy = -(legLen + ry * 0.45);
  const legR = 2 + 1 * body.bulk + (canine ? 0.6 : 0);
  const socks = -legLen * 0.35;

  const r = 7.5 * hs + (canine ? 2 : 2.5) * body.head;
  const hx = rx * 0.85 + r * 0.7;
  const hy = cy - ry * 0.9 - r * 0.7;

  b.add(
    union(
      [
        ellipse(0, cy, rx, ry),
        ellipse(rx * 0.5, cy - ry * 0.05, rx * 0.38, ry * 1.2),
        ellipse(-rx * 0.6, cy, rx * 0.36, ry * 1.12),
        capsule(rx * 0.6, cy - ry * 0.4, hx - r * 0.3, hy + r * 0.3, r * 0.55, r * 0.5),
      ],
      4,
    ),
    b.skin(),
    10,
    { group: G.body },
  );

  const legSkin = b.skin({ belly: false, spots: false, stripes: false, socksBelow: socks });
  for (const far of [true, false]) {
    const o = far ? { depth: 1 } : {};
    const dx = far ? -3 : 0;
    const z = far ? 8 : 9;
    // Front leg: straight, paw forward.
    const fx = rx * 0.55 + dx;
    b.add(
      capsule(fx, cy + ry * 0.2, fx + 0.5, -legR * 0.8, legR * 1.05, legR * 0.85),
      legSkin,
      z,
      o,
    );
    b.add(ellipse(fx + legR * 0.6, -legR * 0.6, legR * 1.2, legR * 0.65), legSkin, z, {
      ...o,
      group: far ? 30 : 31,
    });
    // Hind leg: thigh, then hock angled back, foot down.
    const tx = -rx * 0.55 + dx;
    const hock: Pt = [tx - rx * 0.22, -legLen * 0.4];
    b.add(
      union([
        ellipse(tx, cy + ry * 0.35, ry * 0.75, ry * 1.05, deg(20)),
        capsule(tx, cy + ry * 0.8, hock[0], hock[1], legR * 1.2, legR * 0.85),
        capsule(hock[0], hock[1], hock[0] + 2, -legR * 0.8, legR * 0.85, legR * 0.8),
      ]),
      legSkin,
      z,
      o,
    );
    b.add(ellipse(hock[0] + 2 + legR * 0.6, -legR * 0.6, legR * 1.2, legR * 0.65), legSkin, z, {
      ...o,
      group: far ? 32 : 33,
    });
  }

  b.setBone('head', [hx - r * 0.5, hy + r * 0.6]);
  const eye: EyeSpec = { x: hx + r * 0.32, y: hy - r * 0.12, r: r * (canine ? 0.24 : 0.28) };
  b.add(
    ellipse(hx, hy, r * 1.02, r * 0.9),
    b.skin({ belly: false, spots: false, stripes: false, mask: eye }),
    12,
    { group: G.head },
  );
  const muzzle = b.g.belly ? R.belly : R.primary;
  if (canine && parts.snout === 'long') {
    b.add(
      capsule(hx + r * 0.3, hy + r * 0.25, hx + r * 1.45, hy + r * 0.38, r * 0.45, r * 0.28),
      muzzle,
      12,
      { group: G.head },
    );
    b.add(circle(hx + r * 1.62, hy + r * 0.28, r * 0.16), R.dark, 12.5, {
      lines: false,
      thin: true,
    });
    if (parts.mouth !== 'none') b.mouth = { x: hx + r * 1.05, y: hy + r * 0.62 };
  } else {
    const mx = hx + r * (canine ? 0.95 : 0.78);
    b.add(ellipse(mx, hy + r * 0.32, r * (canine ? 0.6 : 0.42), r * 0.33), muzzle, 12, {
      group: G.head,
    });
    b.add(
      polygon([
        [mx + r * 0.22, hy + r * 0.08],
        [mx + r * 0.5, hy + r * 0.1],
        [mx + r * 0.42, hy + r * 0.26],
      ]),
      R.dark,
      12.5,
      { lines: false, thin: true },
    );
    if (parts.mouth !== 'none') b.mouth = { x: mx + r * 0.1, y: hy + r * 0.62 };
  }
  b.eyes.push(eye);

  addEars(b, parts.ears, hx + r * 0.1, hy + r * 0.05, r * (canine ? 1.1 : 1.2));
  addHorns(b, parts.horns, hx, hy, r);
  b.bone = 'body';
  const tx = -rx * 0.95;
  const ty = cy - ry * 0.25;
  if (parts.tail === 'thin') {
    b.setBone('tail', [tx, ty]);
    const len = 22 + 10 * body.length;
    const c = curve(tx, ty, deg(-172), deg(80), len, legR * 0.75, legR * 0.5, 5);
    b.add(c.prim, b.skin({ belly: false, spots: false }), 6);
    if (parts.markings === 'tip') {
      b.add(circle(c.end[0], c.end[1], legR * 0.75), R.secondary, 6.1, { lines: false });
    }
    b.bone = 'body';
  } else addTail(b, parts.tail, tx, ty, deg(-160), 16 + 10 * body.length, legR * 1.5);
  addBack(b, parts.back, ellipseRidge(0, cy, rx, ry, -0.4, 0.55, 4), 6 + 3 * body.bulk);
}

function feline(b: Builder): void {
  lithe(b, false);
}

function canine(b: Builder): void {
  lithe(b, true);
}

function dragon(b: Builder): void {
  const { body, parts } = b.g;
  const hs = headScale(b);
  const legLen = 10 + 6 * body.limbs;
  const rx = 15 + 6 * body.length;
  const ry = 9 + 3.5 * body.height + 2 * body.bulk;
  const cy = -(legLen + ry * 0.6);
  const legR = 3 + 1.6 * body.bulk;
  const r = (7.5 + 3 * body.head) * hs;

  const neck = curve(
    rx * 0.55,
    cy - ry * 0.3,
    deg(-60),
    deg(35),
    15 + 9 * body.height,
    r * 0.6,
    r * 0.5,
    3,
  );
  const [nx, ny] = neck.end;
  const hx = nx + r * 0.5;
  const hy = ny - r * 0.1;

  const tailLen = 30 + 12 * body.length;
  const tail = curve(
    -rx * 0.85,
    cy - ry * 0.05,
    deg(172),
    deg(-70),
    tailLen,
    legR * 0.95,
    legR * 0.3,
    6,
  );
  b.add(
    union(
      [ellipse(0, cy, rx, ry), circle(rx * 0.45, cy - ry * 0.1, ry * 0.95), neck.prim, tail.prim],
      3.5,
    ),
    b.skin({ stripes: true }),
    10,
    { group: G.body },
  );

  for (const [lx, far] of [
    [rx * 0.48, true],
    [-rx * 0.55, true],
    [rx * 0.6, false],
    [-rx * 0.42, false],
  ] as const) {
    const x = far ? lx - 3 : lx;
    const o = far ? { depth: 1 } : {};
    b.add(
      capsule(x, cy + ry * 0.2, x + 1.2, -legR * 0.8, legR * 1.1, legR * 0.9),
      R.primary,
      far ? 8 : 9,
      o,
    );
    // Claws.
    for (let i = 0; i < 2; i++) {
      const cx = x + legR * (0.4 + i * 0.7);
      b.add(
        polygon([
          [cx - 0.9, -1.2],
          [cx + 0.9, -1.2],
          [cx + 1.6, 0],
        ]),
        R.accent,
        far ? 8.1 : 9.1,
        { ...o, thin: true, lines: false },
      );
    }
  }

  b.setBone('head', [nx, ny]);
  const eye: EyeSpec = { x: hx + r * 0.1, y: hy - r * 0.28, r: r * 0.26 };
  b.add(ellipse(hx, hy, r * 1.1, r * 0.82, deg(6)), R.primary, 12, { group: G.head });
  const long = parts.snout === 'long';
  const sx = hx + r * (long ? 1.05 : 0.85);
  b.add(ellipse(sx, hy + r * 0.22, r * (long ? 0.85 : 0.6), r * 0.45), R.primary, 12, {
    group: G.head,
  });
  b.add(circle(sx + r * (long ? 0.65 : 0.45), hy + r * 0.02, r * 0.1), R.dark, 12.5, {
    lines: false,
    thin: true,
  });
  // Brow ridge over the eye.
  b.add(
    polygon([
      [eye.x - r * 0.45, eye.y - r * 0.32],
      [eye.x + r * 0.45, eye.y - r * 0.18],
      [eye.x - r * 0.3, eye.y - r * 0.5],
    ]),
    R.primary,
    12.6,
    { depth: 1, lines: false, thin: true },
  );
  b.eyes.push(eye);
  if (parts.mouth !== 'none') b.mouth = { x: sx + r * 0.1, y: hy + r * 0.6 };

  addEars(b, parts.ears, hx - r * 0.55, hy + r * 0.1, r);
  addHorns(
    b,
    parts.horns === 'none' ? 'curved' : parts.horns,
    hx - r * 0.35,
    hy + r * 0.05,
    r * 1.1,
  );
  b.bone = 'body';
  addBack(b, parts.back, ellipseRidge(0, cy, rx, ry, -0.85, 0.4, 5), 6 + 3 * body.bulk);

  // Tail tip.
  const [ex, ey] = tail.end;
  const a = tail.endAngle;
  if (parts.tail === 'flame') {
    b.add(flame(ex, ey, legR * 2.2, deg(-100)), R.flame, 10.2);
    b.add(flame(ex, ey + 1, legR * 1.2, deg(-100)), R.flameCore, 10.3, { lines: false });
  } else if (parts.tail === 'club') {
    b.add(circle(ex, ey, legR * 1.3), R.accent, 10.2);
  } else {
    const s = legR * 2.2;
    b.add(
      polygon(
        [
          dirPt(ex, ey, a + deg(90), s * 0.2),
          dirPt(ex, ey, a + deg(55), s * 0.75),
          dirPt(ex, ey, a, s * 1.3),
          dirPt(ex, ey, a - deg(55), s * 0.75),
          dirPt(ex, ey, a - deg(90), s * 0.2),
        ],
        0.5,
      ),
      parts.tail === 'leaf' ? R.secondary : R.accent,
      10.2,
    );
  }

  // Dragons always roll wings; only a young evolution stage has none (`variants.ts`).
  if (parts.wings === 'none') return;
  const span = 46 + 16 * body.limbs;
  const wing = parts.wings === 'feather' ? featherWing : membraneWing;
  wing(b, {
    x: rx * 0.25,
    y: cy - ry * 0.85,
    span: span * 0.9,
    arm: deg(-78),
    side: -1,
    z: 3,
    far: true,
  });
  wing(b, { x: rx * 0.05, y: cy - ry * 0.75, span, arm: deg(-62), side: -1, z: 11 });
}

function bat(b: Builder): void {
  const { body, parts } = b.g;
  const hs = headScale(b);
  const rx = 8.5 + 3 * body.bulk;
  const ry = 9.5 + 3 * body.height;
  const cy = -(ry + 3);
  const r = (7 + 3 * body.head) * hs;
  const hx = 1;
  const hy = cy - ry * 0.95;

  b.add(union([ellipse(0, cy, rx, ry), circle(hx, hy, r)], 4), b.skin({ belly: false }), 10, {
    group: G.body,
  });
  if (b.g.belly) {
    b.add(ellipse(1, cy + ry * 0.2, rx * 0.55, ry * 0.6), R.belly, 10.5, {
      lines: false,
      group: G.body,
    });
  }
  // Big ears, splayed.
  const earH = r * (parts.ears === 'long' ? 1.55 : 1.15);
  for (const s of [-1, 1] as const) {
    const bx = hx + s * r * 0.5;
    const by = hy - r * 0.45;
    const tip = dirPt(bx, by, deg(-90 + s * 22), earH);
    b.add(
      polygon(
        [dirPt(bx, by, deg(s * 22 + 180), r * 0.42), tip, dirPt(bx, by, deg(s * 22), r * 0.42)],
        1,
      ),
      R.primary,
      11,
    );
    const inner = dirPt(bx, by, deg(-90 + s * 22), earH * 0.7);
    b.add(
      polygon(
        [dirPt(bx, by, deg(s * 22 + 180), r * 0.2), inner, dirPt(bx, by, deg(s * 22), r * 0.2)],
        0.5,
      ),
      R.belly,
      11.1,
      { lines: false },
    );
  }
  const er = r * 0.26;
  b.eyes.push({ x: hx - r * 0.32, y: hy, r: er }, { x: hx + r * 0.42, y: hy, r: er });
  b.add(
    ellipse(hx + r * 0.05, hy + r * 0.38, r * (parts.snout === 'long' ? 0.45 : 0.3), r * 0.24),
    R.belly,
    10.6,
    { lines: false },
  );
  b.add(circle(hx + r * 0.08, hy + r * 0.3, r * 0.1), R.dark, 10.7, { lines: false, thin: true });
  if (parts.mouth !== 'none') b.mouth = { x: hx + r * 0.05, y: hy + r * 0.58 };
  addHorns(b, parts.horns, hx, hy + r * 0.1, r * 0.8);
  if (parts.back === 'mane') {
    b.add(ellipse(hx, hy + r * 0.85, r * 1.0, r * 0.35), R.secondary, 10.8, { lines: true });
  }

  for (const s of [-1, 1] as const) {
    b.add(capsule(s * 3, -3, s * 3, -0.8, 1.2, 0.9), R.accent, 9, { thin: true });
    membraneWing(b, {
      x: s * rx * 0.7,
      y: cy - ry * 0.35,
      span: 26 + 12 * body.limbs,
      arm: deg(-30),
      side: s,
      z: 5,
      bone: s < 0 ? 'wingFar' : 'wingNear',
    });
  }
}

function raptor(b: Builder): void {
  const { body, parts } = b.g;
  const hs = headScale(b);
  const legLen = 7 + 7 * body.limbs;
  const rx = 11 + 4 * body.length;
  const ry = 15 + 4 * body.height + 2 * body.bulk;
  const cy = -(legLen + ry * 0.85);
  const r = (7 + 3 * body.head) * hs;
  const hx = rx * 0.4;
  const hy = cy - ry * 0.95;

  const eye: EyeSpec = { x: hx + r * 0.3, y: hy - r * 0.15, r: r * 0.27 };
  b.add(
    union([ellipse(0, cy, rx, ry, deg(-30)), circle(hx, hy, r)], 5),
    b.skin({ mask: eye }),
    10,
    { group: G.body },
  );
  // Eagle: pale head.
  if (parts.markings === 'tip') {
    b.add(circle(hx, hy, r * 1.0), R.belly, 10.4, { lines: false, group: G.body });
  }
  // Hooked beak.
  const bl = r * (0.75 + 0.3 * body.length);
  const bx = hx + r * 0.7;
  b.add(
    polygon(
      [
        [bx, hy - r * 0.35],
        [bx + bl * 0.75, hy - r * 0.2],
        [bx + bl, hy + r * 0.1],
        [bx + bl * 0.85, hy + r * 0.45],
        [bx + bl * 0.6, hy + r * 0.2],
        [bx, hy + r * 0.3],
      ],
      0.5,
    ),
    R.accent,
    13,
  );
  b.eyes.push(eye);
  // Brow.
  b.add(
    polygon([
      [eye.x - r * 0.5, eye.y - r * 0.25],
      [eye.x + r * 0.55, eye.y - r * 0.1],
      [eye.x - r * 0.35, eye.y - r * 0.45],
    ]),
    R.primary,
    12.6,
    { depth: 1, lines: false, thin: true },
  );

  // Legs: feathered thighs, scaly shanks, talons.
  for (const [lx, far] of [
    [-2, true],
    [3, false],
  ] as const) {
    const o = far ? { depth: 1 } : {};
    const z = far ? 8 : 11;
    b.add(
      ellipse(lx, cy + ry * 0.7, 3.5, 4.5),
      R.primary,
      far ? z : 10,
      far ? o : { group: G.body },
    );
    b.add(capsule(lx + 1, cy + ry * 0.75, lx + 1, -1.6, 1.7, 1.5), R.accent, z - 0.5, {
      ...o,
      thin: true,
    });
    for (const [ta, tl] of [
      [deg(-10), 4.5],
      [deg(160), 3],
    ] as const) {
      const [tx, ty] = dirPt(lx + 1, -1.3, ta, tl);
      b.add(capsule(lx + 1, -1.3, tx, ty, 1.2, 0.9), R.accent, z - 0.4, { ...o, thin: true });
      b.add(circle(tx + Math.cos(ta) * 0.8, ty + 0.4, 0.8), R.dark, z - 0.3, {
        ...o,
        thin: true,
        lines: false,
      });
    }
  }

  addEars(b, parts.ears === 'none' ? 'none' : 'tuft', hx - r * 0.3, hy, r);
  // Tail: long feathers fanning down-back.
  const tx = -rx * 0.55;
  const ty = cy + ry * 0.55;
  const fan: Primitive[] = [];
  for (let i = 0; i < 3; i++) {
    const [ex, ey] = dirPt(tx, ty, deg(125 + i * 14), 14 + 6 * body.length);
    fan.push(lens(tx, ty, ex, ey, 4.5));
  }
  b.setBone('tail', [tx, ty]);
  b.add(union(fan, 1), parts.tail === 'flame' ? R.flame : R.secondary, 6);
  b.bone = 'body';

  const span = 36 + 14 * body.limbs;
  featherWing(b, {
    x: rx * 0.15,
    y: cy - ry * 0.5,
    span: span * 0.9,
    arm: deg(-78),
    side: -1,
    z: 3,
    far: true,
  });
  featherWing(b, { x: -rx * 0.05, y: cy - ry * 0.35, span, arm: deg(-52), side: -1, z: 9 });
}

function insect(b: Builder): void {
  const { body, parts } = b.g;
  const hs = headScale(b);
  const legLen = 5 + 4 * body.limbs;
  const ra = 13 + 6 * body.length;
  const rb = 8.5 + 4 * body.height;
  const cy = -(legLen + rb * 0.55);
  const ax = -ra * 0.55;
  const tr = 5 + 2 * body.bulk;
  const tx = tr * 0.6;
  const r = (5 + 2.5 * body.head) * hs;
  const hx = tx + tr + r * 0.6;
  const hy = cy - 2;

  // Legs first (behind the body), three per side.
  for (const far of [true, false]) {
    const o = far ? { depth: 1, thin: true } : { thin: true };
    const z = far ? 4 : 9.6;
    [-6, 0, 6].forEach((ox, i) => {
      const x0 = tx + ox * 0.5 - (far ? 2 : 0);
      const knee: Pt = [x0 + ox * 1.1 + (i - 1) * 4, cy + rb * 0.25];
      const foot: Pt = [x0 + ox * 1.5 + (i - 1) * 6, -0.8];
      b.add(
        union([
          capsule(x0, cy + rb * 0.2, knee[0], knee[1], 1.1, 0.9),
          capsule(knee[0], knee[1], foot[0], foot[1], 0.9, 0.6),
        ]),
        R.dark,
        z,
        o,
      );
    });
  }

  b.add(ellipse(ax, cy, ra, rb, deg(-6)), b.skin({ belly: false }), 10, { group: G.body });
  b.add(ellipse(tx, cy - 1, tr, tr * 0.95), R.primary, 10.5, { group: 25 });
  b.setBone('head', [hx - r * 0.8, hy + r * 0.2]);
  const eye: EyeSpec = { x: hx + r * 0.25, y: hy - r * 0.2, r: r * 0.42 };
  b.add(circle(hx, hy, r), R.primary, 11, { group: G.head });
  b.eyes.push(eye);

  // Antennae.
  for (const far of [true, false]) {
    const c = curve(
      hx + r * 0.2 - (far ? 1.5 : 0),
      hy - r * 0.8,
      deg(-70),
      deg(60),
      7 + 4 * body.limbs,
      0.7,
      0.5,
      3,
    );
    b.add(c.prim, R.dark, far ? 9 : 12, { thin: true, ...(far ? { depth: 1 } : {}) });
    b.add(circle(c.end[0], c.end[1], 1.1), R.dark, far ? 9 : 12, { thin: true });
  }

  // Horn / pincers.
  const A = R.accent;
  if (parts.horns === 'single') {
    const c = curve(hx + r * 0.6, hy - r * 0.2, deg(-20), deg(-55), r * 2.4, r * 0.4, r * 0.08, 3);
    b.add(c.prim, A, 12.5);
  } else if (parts.horns === 'pair' || parts.horns === 'antlers') {
    for (const far of [true, false]) {
      const c = curve(
        hx + r * 0.7,
        hy + r * 0.2 - (far ? 1 : 0),
        deg(-25),
        deg(70),
        r * 2.2,
        r * 0.3,
        r * 0.08,
        3,
      );
      b.add(c.prim, A, far ? 10.8 : 12.5, far ? { depth: 1 } : {});
    }
  } else {
    b.add(
      polygon([
        [hx + r * 0.7, hy + r * 0.2],
        [hx + r * 1.5, hy + r * 0.45],
        [hx + r * 0.8, hy + r * 0.65],
      ]),
      A,
      11.5,
      { thin: true },
    );
  }

  b.bone = 'body';
  if (parts.wings !== 'none') {
    // Raised translucent-looking wings (light ramp).
    for (const far of [true, false]) {
      const [wx, wy] = [tx - 1 - (far ? 2 : 0), cy - tr * 0.8];
      b.setBone(far ? 'wingFar' : 'wingNear', [wx, wy]);
      const [ex, ey] = dirPt(wx, wy, deg(far ? -140 : -125), 20 + 8 * body.limbs);
      b.add(
        lens(wx, wy, ex, ey, 7 + 2 * body.bulk),
        R.belly,
        far ? 3 : 13,
        far ? { depth: 1 } : {},
      );
    }
    b.bone = 'body';
  }
  addBack(b, parts.back, ellipseRidge(ax, cy, ra, rb, -0.5, 0.3, 3), 4 + 2 * body.bulk);
}

function fish(b: Builder): void {
  const { body, parts } = b.g;
  const hs = headScale(b);
  const rx = 20 + 8 * body.length;
  const ry = 10 + 7 * body.height;
  const cy = -(ry + 3);

  b.add(
    union(
      [
        ellipse(0, cy, rx, ry),
        ellipse(rx * 0.3, cy, rx * 0.62, ry * 1.05),
        capsule(-rx * 0.6, cy, -rx * 1.05, cy, ry * 0.55, ry * 0.22),
      ],
      4,
    ),
    b.skin({ stripes: true }),
    10,
    { group: G.body },
  );
  const tx = -rx * 1.05;
  const L = ry * 1.25;
  b.setBone('tail', [tx + 2, cy]);
  b.add(
    polygon(
      [
        [tx + 2, cy],
        [tx - L, cy - L * 0.9],
        [tx - L * 0.55, cy],
        [tx - L, cy + L * 0.8],
      ],
      1,
    ),
    R.secondary,
    6,
  );
  b.bone = 'body';
  if (parts.back === 'none' || parts.back === 'leaves' || parts.back === 'mane') {
    b.add(
      polygon(
        [
          [-rx * 0.3, cy - ry * 0.8],
          [-rx * 0.05, cy - ry * 1.6],
          [rx * 0.25, cy - ry * 0.85],
        ],
        1,
      ),
      R.secondary,
      7,
    );
  } else addBack(b, parts.back, ellipseRidge(0, cy, rx, ry, -0.6, 0.3, 4), 6 + 4 * body.bulk);
  // Pectoral fin and gill line.
  b.add(lens(rx * 0.2, cy + ry * 0.25, -rx * 0.15, cy + ry * 0.85, ry * 0.45), R.secondary, 12);
  b.add(
    curve(rx * 0.45, cy - ry * 0.55, deg(80), deg(30), ry * 1.0, 0.8, 0.6, 3).prim,
    R.primary,
    11,
    { lines: false, thin: true, flatTone: 3 },
  );
  const eye: EyeSpec = { x: rx * 0.62, y: cy - ry * 0.25, r: ry * 0.27 * hs };
  b.eyes.push(eye);
  if (parts.mouth !== 'none') b.mouth = { x: rx * 0.88, y: cy + ry * 0.2 };
  if (parts.ears === 'fin') {
    b.add(lens(rx * 0.1, cy - ry * 0.1, -rx * 0.25, cy - ry * 0.4, ry * 0.3), R.secondary, 11.5);
  }
  if (parts.horns === 'single') {
    // Angler lure.
    const c = curve(rx * 0.55, cy - ry * 0.9, deg(-80), deg(110), ry * 1.6, 0.9, 0.7, 4);
    b.add(c.prim, R.primary, 9, { thin: true });
    b.add(circle(c.end[0], c.end[1], 2.4), R.accent, 9.1, { flatTone: 0 });
  }
}

function golem(b: Builder): void {
  const { body, parts } = b.g;
  const hs = headScale(b);
  const legLen = 6 + 5 * body.limbs;
  const rx = 15 + 6 * body.bulk;
  const ry = 15 + 5 * body.height;
  const cy = -(legLen + ry * 0.85);

  // Stubby legs.
  for (const far of [true, false]) {
    const x = far ? -rx * 0.45 : rx * 0.3;
    b.add(
      polygon(
        [
          [x - 5, cy + ry * 0.5],
          [x + 5, cy + ry * 0.5],
          [x + 6, 0],
          [x - 5, 0],
        ],
        2,
      ),
      R.primary,
      far ? 7 : 9,
      far ? { depth: 1 } : {},
    );
  }
  b.add(
    polygon(
      [
        [-rx, cy + ry * 0.55],
        [-rx * 0.9, cy - ry * 0.65],
        [-rx * 0.2, cy - ry],
        [rx * 0.75, cy - ry * 0.8],
        [rx, cy + ry * 0.15],
        [rx * 0.6, cy + ry],
        [-rx * 0.6, cy + ry],
      ],
      3,
    ),
    b.skin({ belly: false }),
    10,
    { group: G.body },
  );
  // Core gem.
  const gx = rx * 0.3;
  const gy = cy - ry * 0.05;
  b.add(
    polygon([
      [gx, gy - 4],
      [gx + 3, gy],
      [gx, gy + 4],
      [gx - 3, gy],
    ]),
    R.accent,
    10.6,
    { flatTone: 0 },
  );

  const r = (6 + 2 * body.head) * hs;
  const hx = rx * 0.4;
  const hy = cy - ry * 0.95;
  b.setBone('head', [hx, hy + r * 0.7]);
  b.add(
    polygon(
      [
        [hx - r, hy + r * 0.7],
        [hx - r * 0.8, hy - r * 0.8],
        [hx + r * 0.9, hy - r * 0.7],
        [hx + r * 1.1, hy + r * 0.6],
      ],
      2,
    ),
    R.primary,
    12,
    { group: G.head },
  );
  b.eyes.push(
    { x: hx - r * 0.05, y: hy - r * 0.05, r: r * 0.24, far: true },
    { x: hx + r * 0.6, y: hy - r * 0.05, r: r * 0.26 },
  );
  if (parts.mouth !== 'none') b.mouth = { x: hx + r * 0.3, y: hy + r * 0.45 };
  addHorns(b, parts.horns, hx, hy + r * 0.2, r);
  b.bone = 'body';

  // Arms ending in boulder fists.
  const armR = 4 + 2 * body.bulk;
  for (const far of [true, false]) {
    const sx = far ? -rx * 0.7 : rx * 0.7;
    const sy = cy - ry * 0.5;
    const ex = sx + (far ? -4 : 5);
    const ey = cy + ry * 0.45;
    const o = far ? { depth: 1 } : {};
    b.add(capsule(sx, sy, ex, ey, armR, armR * 0.9), R.primary, far ? 6 : 13, o);
    b.add(
      polygon(
        [
          [ex - armR * 1.3, ey - armR * 0.6],
          [ex + armR * 1.2, ey - armR * 0.9],
          [ex + armR * 1.4, ey + armR * 1.1],
          [ex - armR * 1.1, ey + armR * 1.2],
        ],
        1.5,
      ),
      R.primary,
      far ? 6.1 : 13.1,
      o,
    );
  }
  if (parts.tail === 'club') addTail(b, 'club', -rx * 0.9, cy + ry * 0.5, deg(170), 10, 3);
  const ridge: [number, number, number][] = [0, 1, 2].map((i) => {
    const t = i / 2;
    return [-rx * (0.85 - t * 0.6), cy - ry * (0.6 + t * 0.35), deg(-120 + i * 18)];
  });
  addBack(b, parts.back, ridge, 7 + 3 * body.bulk);
}

export const WILD_PLANS = { feline, canine, dragon, bat, raptor, insect, fish, golem } as const;
