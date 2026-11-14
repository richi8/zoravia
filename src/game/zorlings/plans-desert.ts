/**
 * Desert body plans (C35a), the Emberwaste kit: lizard, scorpion, beetle, cactus, tortoise,
 * sandworm, vulture, fennec. Same model space as `build.ts`: facing right, ground at y = 0.
 */

import {
  capsule,
  circle,
  ellipse,
  intersect,
  polygon,
  union,
  type Primitive,
} from '@engine/render/sdf-sprite';
import type { Builder } from './parts';
import {
  addBack,
  addHorns,
  addTail,
  addWings,
  curve,
  deg,
  dirPt,
  ellipseRidge,
  flame,
  G,
  jointed,
  lens,
  pincer,
  R,
  type EyeSpec,
  type Pt,
} from './parts';
import { headScale } from './plans-wild';

/** Everything above `y` (cuts shapes flat, e.g. at a rim or the ground). */
const above = (y: number): Primitive =>
  polygon([
    [-300, -300],
    [300, -300],
    [300, y],
    [-300, y],
  ]);

/** Lizard / salamander: low, long body, sprawled legs, wedge head, long tail on the ground. */
function lizard(b: Builder): void {
  const { body, parts } = b.g;
  const hs = headScale(b);
  const legLen = 8 + 7 * body.limbs;
  const rx = 15 + 7 * body.length;
  const ry = 6 + 2.5 * body.height + 3 * body.bulk;
  const cy = -(legLen + ry * 0.45);
  const legR = 2.5 + 1.5 * body.bulk;
  const socks = -legLen * 0.45;

  const r = (6.5 + 3 * body.head) * hs;
  const hx = rx + r * 0.55;
  const hy = cy - ry * 0.45 - r * 0.35;

  // Tail: long and low, sweeping back along the ground with a lift at the tip.
  const tailLen = 20 + 12 * body.length;
  const tail = curve(
    -rx * 0.8,
    cy + ry * 0.1,
    deg(172),
    deg(-38),
    tailLen,
    ry * 0.8,
    legR * 0.35,
    6,
  );
  b.add(
    union(
      [
        ellipse(0, cy, rx, ry),
        ellipse(rx * 0.55, cy - ry * 0.1, rx * 0.4, ry * 0.95),
        capsule(rx * 0.7, cy - ry * 0.2, hx - r * 0.4, hy + r * 0.2, ry * 0.75, r * 0.55),
        tail.prim,
      ],
      3,
    ),
    b.skin({ stripes: true }),
    10,
    { group: G.body },
  );

  // Sprawled legs: upper leg out to an elbow above the ground, foot planted forward.
  const legSkin = b.skin({ belly: false, spots: false, stripes: false, socksBelow: socks });
  for (const [lx, far, front] of [
    [rx * 0.5, true, true],
    [-rx * 0.5, true, false],
    [rx * 0.62, false, true],
    [-rx * 0.4, false, false],
  ] as const) {
    const x = far ? lx - 3 : lx;
    const o = far ? { depth: 1 } : {};
    const z = far ? 8 : 9;
    const elbow: Pt = [x + (front ? -2 : 3), cy + ry * 0.55 + legLen * 0.2];
    const foot: Pt = [x + (front ? 3 : 1), -legR * 0.6];
    b.add(jointed([x, cy + ry * 0.1], elbow, foot, legR * 1.1, legR * 0.8), legSkin, z, o);
    // Splayed toes.
    for (let i = 0; i < 3; i++) {
      const [tx, ty] = dirPt(foot[0], foot[1], deg(-25 + i * 25), legR * 1.6);
      b.add(
        capsule(foot[0], foot[1], tx, Math.min(ty, -0.5), legR * 0.45, legR * 0.3),
        legSkin,
        z,
        {
          ...o,
          thin: true,
        },
      );
    }
  }

  // Wedge head.
  b.setBone('head', [hx - r * 0.6, hy + r * 0.3]);
  const eye: EyeSpec = { x: hx + r * 0.05, y: hy - r * 0.3, r: r * 0.28 };
  const long = parts.snout === 'long';
  b.add(
    union(
      [
        ellipse(hx, hy, r * 1.05, r * 0.72),
        ellipse(hx + r * (long ? 0.95 : 0.7), hy + r * 0.15, r * (long ? 0.85 : 0.6), r * 0.42),
      ],
      2,
    ),
    b.skin({ belly: false, spots: false, stripes: false, mask: eye }),
    12,
    { group: G.head },
  );
  // Lower jaw line.
  const jx = hx + r * (long ? 1.65 : 1.2);
  b.add(capsule(hx - r * 0.2, hy + r * 0.42, jx, hy + r * 0.32, 0.5, 0.4), R.primary, 12.4, {
    lines: false,
    flatTone: 3,
    thin: true,
  });
  b.add(circle(jx - r * 0.12, hy, r * 0.09), R.dark, 12.5, { lines: false, thin: true });
  // Bulging brow.
  b.add(circle(eye.x, eye.y - r * 0.05, r * 0.38), R.primary, 12.3, { group: G.head });
  b.eyes.push(eye);
  if (parts.mouth !== 'none') b.mouth = { x: hx + r * 0.75, y: hy + r * 0.45 };
  b.tuskRoot = [hx + r * 0.9, hy + r * 0.45];

  if (parts.ears === 'fin') {
    // Neck frill.
    const fx = hx - r * 0.75;
    b.add(
      polygon(
        [
          [fx + r * 0.3, hy - r * 0.2],
          [fx - r * 0.6, hy - r * 1.3],
          [fx - r * 0.9, hy - r * 0.3],
          [fx - r * 0.6, hy + r * 0.9],
          [fx + r * 0.3, hy + r * 0.5],
        ],
        1,
      ),
      R.secondary,
      11.5,
    );
  }
  addHorns(b, parts.horns, hx - r * 0.1, hy + r * 0.25, r * 0.9);
  b.bone = 'body';

  // Tail tip.
  const [ex, ey] = tail.end;
  if (parts.tail === 'flame') {
    b.add(flame(ex, ey, legR * 2.4, deg(-100)), R.flame, 10.2);
    b.add(flame(ex, ey + 1, legR * 1.3, deg(-100)), R.flameCore, 10.3, { lines: false });
  } else if (parts.tail === 'club') {
    b.add(circle(ex, ey, legR * 1.4), R.accent, 10.2);
  } else if (parts.tail === 'leaf') {
    b.add(lens(ex, ey, ...dirPt(ex, ey, tail.endAngle, legR * 4), legR * 2), R.secondary, 10.2);
  } else if (parts.tail === 'bolt' || parts.markings === 'tip') {
    b.add(circle(ex, ey, legR * 0.6), R.secondary, 10.2, { lines: false });
  }
  addBack(b, parts.back, ellipseRidge(0, cy, rx, ry, -0.75, 0.6, 5), 6 + 3 * body.bulk);
}

/** Scorpion: segmented body, big pincers, eight thin legs, a stinger tail arched overhead. */
function scorpion(b: Builder): void {
  const { body, parts } = b.g;
  const hs = headScale(b);
  const legLen = 8 + 6 * body.limbs;
  const rx = 13 + 5 * body.length;
  const ry = 5.5 + 2 * body.height + 2.5 * body.bulk;
  const cy = -(legLen + ry * 0.3);

  // Legs: four per side, knees up, feet spread.
  for (const far of [true, false]) {
    const o = far ? { depth: 1, thin: true } : { thin: true };
    const z = far ? 4 : 10.5;
    for (let i = 0; i < 4; i++) {
      const x0 = rx * (0.3 - i * 0.25) - (far ? 2.5 : 0);
      const spread = (i - 1.2) * 3.5;
      const knee: Pt = [x0 + spread, cy - ry * 0.2];
      const foot: Pt = [x0 + spread * 2 + (i < 2 ? 2 : -2), -0.6];
      b.add(jointed([x0, cy + ry * 0.4], knee, foot, 1.4, 0.6), R.primary, z, o);
    }
  }

  // Body: head shield in front, then abdomen plates.
  const segs: Primitive[] = [ellipse(rx * 0.42, cy, rx * 0.48, ry)];
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    segs.push(ellipse(-rx * (0.05 + t * 0.55), cy - t * 1.5, rx * 0.3, ry * (0.98 - t * 0.22)));
  }
  b.add(union(segs, 1.2), b.skin({ belly: false }), 10, { group: G.body });
  for (let i = 0; i < 3; i++) {
    const x = -rx * (0.2 + i * 0.22);
    b.add(capsule(x, cy - ry * 0.9, x + 1.2, cy + ry * 0.6, 0.45, 0.45), R.primary, 10.3, {
      lines: false,
      flatTone: 3,
      thin: true,
    });
  }

  const eye: EyeSpec = { x: rx * 0.7, y: cy - ry * 0.4, r: ry * 0.36 * hs };
  b.eyes.push({ x: rx * 0.42, y: cy - ry * 0.45, r: eye.r * 0.85, far: true }, eye);
  if (parts.mouth !== 'none') b.mouth = { x: rx * 0.85, y: cy + ry * 0.35 };
  addHorns(b, parts.horns, rx * 0.6, cy + ry * 0.2, ry);

  // Pincers held forward; the near one bigger and in front.
  const clawR = 3.2 + 2 * body.bulk + 1.2 * body.limbs;
  for (const far of [true, false]) {
    const o = far ? { depth: 1 } : {};
    const z = far ? 8 : 13;
    const s = far ? 0.8 : 1;
    const sx = rx * 0.8 - (far ? 3 : 0);
    const sy = cy + ry * 0.3;
    const elbow: Pt = [sx + 5 * s, sy + 2];
    const wrist: Pt = [sx + (9 + 5 * body.limbs) * s, sy - (far ? 6 : 3)];
    b.add(jointed([sx, sy], elbow, wrist, 1.6 * s + body.bulk * 0.8, 1.8 * s), R.primary, z, o);
    const [cx, ccy] = dirPt(wrist[0], wrist[1], deg(-15), clawR * 0.9 * s);
    pincer(b, cx, ccy, clawR * s, deg(-15), z + 0.1, o);
  }

  addTail(
    b,
    'stinger',
    -rx * 0.9,
    cy - ry * 0.3,
    deg(-150),
    26 + 10 * body.length + 8 * body.height,
    ry * 0.7,
  );
  addBack(b, parts.back, ellipseRidge(rx * 0.1, cy, rx * 0.9, ry, -0.4, 0.6, 3), 4 + 2 * body.bulk);
}

/** Beetle: a high domed shell (split elytra), small head, horn or mandibles, six legs. */
function beetle(b: Builder): void {
  const { body, parts } = b.g;
  const hs = headScale(b);
  const legLen = 5 + 5 * body.limbs;
  const rx = 15 + 6 * body.length;
  const ry = 10 + 5 * body.height + 2 * body.bulk;
  const cy = -(legLen + ry * 0.45);

  for (const far of [true, false]) {
    const o = far ? { depth: 1, thin: true } : { thin: true };
    const z = far ? 4 : 9.6;
    [-1, 0, 1].forEach((i) => {
      const x0 = rx * 0.25 * i - (far ? 2 : 0);
      const knee: Pt = [x0 + i * 5, cy + ry * 0.35];
      const foot: Pt = [x0 + i * 8 + 1, -0.6];
      b.add(jointed([x0, cy + ry * 0.2], knee, foot, 1.6, 0.8), R.dark, z, o);
    });
  }

  // Under-body, then the shell over it.
  b.add(ellipse(0, cy + ry * 0.25, rx * 0.95, ry * 0.5), R.primary, 9.8, { depth: 1 });
  const shell = intersect(ellipse(-rx * 0.08, cy, rx, ry), above(0));
  b.add(shell, b.skin({ belly: false }), 10, { group: G.body });
  // Elytra seam and rim.
  const seam = curve(rx * 0.55, cy - ry * 0.8, deg(200), deg(-50), rx * 1.25, 0.55, 0.45, 4);
  b.add(seam.prim, R.primary, 10.4, { lines: false, flatTone: 3, thin: true });
  b.add(
    intersect(
      ellipse(-rx * 0.08, cy, rx, ry),
      ellipse(-rx * 0.08, cy + ry * 0.95, rx * 1.1, ry * 0.4),
    ),
    R.secondary,
    10.3,
    { lines: false },
  );

  // Head and pronotum.
  const pr = ry * 0.55;
  const px = rx * 0.78;
  const py = cy + ry * 0.05;
  b.add(ellipse(px, py, pr * 0.9, pr), R.primary, 10.6, { group: 26 });
  const r = (4.5 + 2 * body.head) * hs;
  const hx = px + pr * 0.75 + r * 0.5;
  const hy = py + pr * 0.25;
  b.setBone('head', [hx - r * 0.8, hy]);
  b.add(circle(hx, hy, r), R.primary, 11, { group: G.head });
  b.eyes.push({ x: hx + r * 0.25, y: hy - r * 0.15, r: r * 0.42 });

  const A = R.accent;
  if (parts.horns === 'single' || parts.horns === 'curved') {
    // Rhinoceros horn sweeping up from the snout.
    const c = curve(hx + r * 0.4, hy - r * 0.2, deg(-35), deg(-70), r * 3.2, r * 0.5, r * 0.1, 4);
    b.add(c.prim, A, 12.5);
    if (parts.horns === 'curved') {
      const c2 = curve(
        px + pr * 0.2,
        py - pr * 0.8,
        deg(-30),
        deg(40),
        r * 2.4,
        r * 0.35,
        r * 0.1,
        3,
      );
      b.add(c2.prim, A, 10.7);
    }
  } else if (parts.horns === 'pair') {
    // Stag mandibles: an upper and a lower jaw reaching forward and curving shut.
    const L = r * (3.4 + 1.4 * body.length);
    const up = curve(hx + r * 0.6, hy - r * 0.15, deg(-30), deg(85), L, r * 0.55, r * 0.12, 5);
    const lo = curve(
      hx + r * 0.6,
      hy + r * 0.45,
      deg(15),
      deg(-65),
      L * 0.75,
      r * 0.45,
      r * 0.12,
      5,
    );
    b.add(up.prim, A, 12.5);
    b.add(lo.prim, A, 12.4, { depth: 1 });
    // A tooth on the upper jaw.
    const [tx, ty] = dirPt(hx + r * 0.6, hy - r * 0.15, deg(-10), L * 0.5);
    b.add(
      polygon([
        [tx - r * 0.25, ty],
        [tx + r * 0.25, ty],
        [tx, ty + r * 0.45],
      ]),
      A,
      12.45,
      { thin: true },
    );
  } else if (parts.horns === 'nubs') {
    b.add(circle(hx + r * 0.5, hy - r * 0.8, r * 0.3), A, 12.5);
  }
  // Antennae.
  const ant = curve(hx + r * 0.2, hy - r * 0.8, deg(-80), deg(70), 6 + 3 * body.limbs, 0.6, 0.5, 3);
  b.add(ant.prim, R.dark, 12, { thin: true });
  b.add(circle(ant.end[0], ant.end[1], 1.2), R.dark, 12, { thin: true });
  b.bone = 'body';

  if (parts.wings !== 'none') {
    for (const far of [true, false]) {
      const [wx, wy] = [-rx * 0.1 - (far ? 2 : 0), cy - ry * 0.75];
      b.setBone(far ? 'wingFar' : 'wingNear', [wx, wy]);
      const [ex, ey] = dirPt(wx, wy, deg(far ? -150 : -135), 18 + 8 * body.limbs);
      b.add(lens(wx, wy, ex, ey, 7), R.belly, far ? 3 : 9.9, far ? { depth: 1 } : {});
    }
    b.bone = 'body';
  }
  if (parts.back === 'spikes' || parts.back === 'crystals') {
    addBack(b, parts.back, ellipseRidge(-rx * 0.08, cy, rx, ry, -0.5, 0.4, 3), 4 + 2 * body.bulk);
  }
}

/** Cactus: a ribbed column on root feet, arms bent upward, spines, and a flower on top. */
function cactus(b: Builder): void {
  const { body, parts } = b.g;
  const w = 8 + 4 * body.bulk;
  const h = 36 + 18 * body.height;
  const top = -h;

  // Root feet: stubby, under the trunk.
  for (const far of [true, false]) {
    const fx = far ? -w * 0.5 : w * 0.45;
    b.add(ellipse(fx + 1.5, -2.2, w * 0.42, 2.4), R.primary, far ? 8 : 10.5, {
      depth: far ? 2 : 1,
    });
  }
  // Trunk.
  b.add(
    capsule(0, -w * 0.8, 0, top + w, w, w * 0.92),
    b.skin({ belly: false, stripes: false }),
    10,
    {
      group: G.body,
    },
  );
  // Ribs: vertical grooves.
  for (const fx of [-0.5, 0.05, 0.6]) {
    const x = w * fx;
    b.add(capsule(x, top + w * 0.6, x, -w * 0.5, 0.5, 0.5), R.primary, 10.2, {
      lines: false,
      flatTone: 3,
      thin: true,
    });
  }
  // Arms: out, then up, below the face.
  const armR = w * 0.45;
  const arms: [number, number][] =
    body.limbs > 0.6
      ? [
          [1, 0.38],
          [-1, 0.5],
        ]
      : body.limbs > 0.3
        ? [[-1, 0.45]]
        : [[1, 0.4]];
  for (const [side, at] of arms) {
    const sy = -h * at;
    const ex = side * (w + armR * 1.5);
    const up = h * (0.18 + 0.12 * body.limbs);
    const far = side < 0;
    b.add(
      union(
        [
          capsule(side * w * 0.5, sy, ex, sy, armR, armR),
          capsule(ex, sy, ex, sy - up, armR, armR * 0.9),
        ],
        2.5,
      ),
      R.primary,
      9,
      far ? { depth: 1 } : {},
    );
  }
  // Spines: tiny light ticks along the outline.
  const spines: Primitive[] = [];
  for (let i = 0; i < 6; i++) {
    const y = top + w * 0.9 + (i / 5) * (h - w * 2);
    for (const s of [-1, 1]) {
      const x = s * w * 0.98;
      const [tx, ty] = dirPt(x, y, s > 0 ? deg(-25) : deg(205), 2.2);
      spines.push(capsule(x, y, tx, ty, 0.45, 0.2));
    }
  }
  b.add(union(spines), R.belly, 10.6, { lines: false, thin: true });

  // Face near the top.
  const ey = top + w * 1.2;
  const er = w * 0.26;
  b.eyes.push({ x: -w * 0.05, y: ey, r: er * 0.9, far: true }, { x: w * 0.5, y: ey, r: er });
  if (parts.mouth !== 'none') b.mouth = { x: w * 0.25, y: ey + er * 1.9 };

  // Flower (tuft) or bud (round) on top.
  if (parts.ears === 'tuft' || parts.ears === 'round') {
    const fy = top + w * 0.1;
    const big = parts.ears === 'tuft';
    const pr = w * (big ? 0.4 : 0.28);
    const petals: Primitive[] = [];
    const k = big ? 5 : 3;
    for (let i = 0; i < k; i++) {
      const a = deg(-90 + (i - (k - 1) / 2) * 36);
      const [tx, ty] = dirPt(w * 0.1, fy, a, pr * 1.8);
      petals.push(lens(w * 0.1, fy, tx, ty, pr));
    }
    b.add(union(petals, 0.5), R.secondary, 12);
    b.add(circle(w * 0.1, fy - pr * 0.2, pr * 0.45), R.accent, 12.1);
  }
  addHorns(b, parts.horns, w * 0.25, top + w * 0.9, w);
  if (parts.back === 'spikes') {
    const ridge: [number, number, number][] = [0, 1, 2].map((i) => {
      const a = deg(-150 + i * 30);
      return [Math.cos(a) * w * 0.9, top + w + Math.sin(a) * w * 0.9, a];
    });
    addBack(b, 'spikes', ridge, 5);
  }
}

/** Tortoise: a high domed shell with scutes, stumpy legs, head on a short neck. */
function tortoise(b: Builder): void {
  const { body, parts } = b.g;
  const hs = headScale(b);
  const legLen = 5 + 5 * body.limbs;
  const rx = 17 + 6 * body.length + 2 * body.bulk;
  const ry = 13 + 6 * body.height;
  const rim = -(legLen + 2);
  const cy = rim;
  const legR = 3.5 + 2 * body.bulk;
  const socks = -legLen * 0.5;

  const legSkin = b.skin({ belly: false, spots: false, stripes: false, socksBelow: socks });
  for (const [lx, far] of [
    [rx * 0.55, true],
    [-rx * 0.55, true],
    [rx * 0.45, false],
    [-rx * 0.65, false],
  ] as const) {
    const x = far ? lx - 3 : lx;
    b.add(
      capsule(x, rim - 3, x + 1, -legR * 0.8, legR, legR * 0.9),
      legSkin,
      far ? 8 : 9,
      far ? { depth: 1 } : {},
    );
    // Toes.
    b.add(ellipse(x + legR * 0.4, -1, legR * 0.5, 1), R.accent, far ? 8.1 : 9.1, {
      lines: false,
      thin: true,
      ...(far ? { depth: 1 } : {}),
    });
  }

  // Head on a neck reaching forward and up.
  const r = (6 + 2.5 * body.head) * hs;
  const neck = curve(
    rx * 0.75,
    rim - 2,
    deg(-20),
    deg(-25),
    8 + 6 * body.limbs,
    r * 0.55,
    r * 0.5,
    3,
  );
  b.add(neck.prim, R.primary, 9.5, { group: 28 });
  const [nx, ny] = neck.end;
  const hx = nx + r * 0.5;
  const hy = ny - r * 0.2;
  b.setBone('head', [nx - r * 0.3, ny + r * 0.3]);
  const eye: EyeSpec = { x: hx + r * 0.25, y: hy - r * 0.2, r: r * 0.28 };
  b.add(
    ellipse(hx, hy, r * 1.1, r * 0.85),
    b.skin({ belly: false, spots: false, stripes: false, mask: eye }),
    12,
    {
      group: G.head,
    },
  );
  b.add(
    polygon([
      [hx + r * 0.7, hy + r * 0.05],
      [hx + r * 1.25, hy + r * 0.2],
      [hx + r * 0.75, hy + r * 0.55],
    ]),
    R.accent,
    12.3,
    {
      thin: true,
    },
  );
  b.eyes.push(eye);
  if (parts.mouth !== 'none') b.mouth = { x: hx + r * 0.6, y: hy + r * 0.55 };
  addHorns(b, parts.horns, hx, hy, r);
  b.bone = 'body';

  // Shell: dome over the rim, scutes in a darker tone, a pale rim band.
  const dome = intersect(ellipse(0, cy, rx, ry), above(cy + 2));
  b.add(dome, R.secondary, 10, { group: G.body });
  b.add(
    intersect(ellipse(0, cy, rx * 1.04, ry * 0.35), ellipse(0, cy + 2, rx * 1.06, ry * 0.45)),
    R.belly,
    10.4,
    {},
  );
  const scutes: Primitive[] = [];
  for (const [fx, fy] of [
    [0, -0.65],
    [-0.45, -0.45],
    [0.45, -0.45],
    [-0.7, -0.15],
    [0.7, -0.15],
    [-0.22, -0.2],
    [0.22, -0.2],
  ] as const) {
    scutes.push(ellipse(rx * fx, cy + ry * fy, rx * 0.17, ry * 0.15));
  }
  b.add(union(scutes), R.secondary, 10.2, { depth: 1 });
  addTail(b, parts.tail, -rx * 0.95, rim - 1, deg(170), 6, legR * 0.6);
  addBack(b, parts.back, ellipseRidge(0, cy, rx, ry, -0.5, 0.5, 4), 6 + 3 * body.bulk);
  if (parts.markings === 'tip' || b.g.types.includes('fire')) {
    // A caldera on the shell: a vent with a lick of flame.
    if (parts.back === 'none') {
      b.add(flame(0, cy - ry * 0.92, 5 + 2 * body.bulk, deg(-90)), R.flame, 10.6);
      b.add(flame(0, cy - ry * 0.9, 3 + body.bulk, deg(-90)), R.flameCore, 10.7, { lines: false });
    }
  }
}

/** Sandworm: a thick ringed worm arching out of the ground, a round toothed maw in front. */
function sandworm(b: Builder): void {
  const { body, parts } = b.g;
  const r0 = 7 + 4 * body.bulk;
  const L = 34 + 12 * body.length;
  const rise = 22 + 14 * body.height;
  const pts: [number, number, number][] = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    // Rear half lies along the ground; the front half arcs up and leans forward.
    const x = -L * 0.6 + t * L;
    const lift = t < 0.45 ? 0 : Math.sin(((t - 0.45) / 0.55) * Math.PI * 0.6) * rise;
    const rad = r0 * (t < 0.15 ? 0.55 + 3 * t : 1) * (0.9 + 0.1 * t);
    pts.push([x, -rad - lift, rad]);
  }
  const segs: Primitive[] = [];
  for (let i = 1; i < n; i++) {
    const [ax, ay, ar] = pts[i - 1] ?? [0, 0, 1];
    const [bx, by, br] = pts[i] ?? [0, 0, 1];
    segs.push(capsule(ax, ay, bx, by, ar, br));
  }
  b.add(union(segs, 2), b.skin({ stripes: false }), 10, { group: G.body });
  // Rings.
  for (let i = 2; i < n - 1; i += 2) {
    const [x, y, rad] = pts[i] ?? [0, 0, 1];
    b.add(capsule(x - 0.5, y - rad * 0.95, x + 0.5, y + rad * 0.95, 0.5, 0.5), R.primary, 10.2, {
      lines: false,
      flatTone: 3,
      thin: true,
    });
  }
  // The maw: a disc facing forward with a ring of teeth.
  const [hx, hy, hr] = pts[n - 1] ?? [0, 0, 1];
  const mx = hx + hr * 0.55;
  b.add(ellipse(mx, hy, hr * 0.5, hr * 1.05), R.belly, 11, {});
  b.add(ellipse(mx + hr * 0.12, hy, hr * 0.3, hr * 0.72), R.dark, 11.1, { lines: false });
  for (let i = 0; i < 5; i++) {
    const a = deg(-80 + i * 40);
    const [tx, ty] = [mx + Math.cos(a) * hr * 0.2, hy + Math.sin(a) * hr * 0.72];
    b.add(
      polygon([
        [tx, ty - 1.2],
        [tx, ty + 1.2],
        [tx + 2.4, ty],
      ]),
      R.white,
      11.2,
      { lines: false, thin: true },
    );
  }
  b.eyes.push({ x: hx - hr * 0.35, y: hy - hr * 0.75, r: hr * 0.22 });
  addHorns(b, parts.horns, hx - hr * 0.2, hy, hr * 0.9);
  const ridge: [number, number, number][] = pts
    .slice(2, n - 2)
    .filter((_, i) => i % 2 === 0)
    .map(([x, y, rad]) => [x, y - rad + 1.5, deg(-100)]);
  addBack(b, parts.back, ridge, 6 + 3 * body.bulk);
  if (parts.tail === 'flame') {
    const [tx, ty] = pts[0] ?? [0, 0];
    b.add(flame(tx - 2, ty, 5, deg(-120)), R.flame, 9.8);
  }
}

/** Vulture: a hunched bird with broad folded wings, a bare neck and head, and a hooked beak. */
function vulture(b: Builder): void {
  const { body, parts } = b.g;
  const hs = headScale(b);
  const legLen = 6 + 5 * body.limbs;
  const rx = 14 + 5 * body.length;
  const ry = 13 + 4 * body.height + 2 * body.bulk;
  const cy = -(legLen + ry * 0.8);
  const r = (5.5 + 2 * body.head) * hs;

  // Legs and talons.
  for (const [lx, far] of [
    [-2, true],
    [4, false],
  ] as const) {
    const o = far ? { depth: 1, thin: true } : { thin: true };
    b.add(capsule(lx, cy + ry * 0.6, lx + 1, -1.5, 1.8, 1.5), R.accent, far ? 8 : 9, o);
    b.add(capsule(lx - 1, -1.2, lx + 5, -1.2, 1.3, 1), R.accent, far ? 8 : 9, o);
  }
  // Hunched body, tilted forward.
  b.add(ellipse(0, cy, rx, ry, deg(-20)), b.skin(), 10, { group: G.body });
  // Bare neck curving up and forward out of the ruff.
  const neck = curve(
    rx * 0.55,
    cy - ry * 0.55,
    deg(-60),
    deg(70),
    10 + 6 * body.height,
    r * 0.42,
    r * 0.36,
    3,
  );
  b.add(neck.prim, R.belly, 10.6, { group: 29 });
  const [nx, ny] = neck.end;
  const hx = nx + r * 0.4;
  const hy = ny;
  b.setBone('head', [nx - r * 0.2, ny + r * 0.3]);
  const eye: EyeSpec = { x: hx + r * 0.1, y: hy - r * 0.2, r: r * 0.3 };
  b.add(circle(hx, hy, r), R.belly, 12, { group: G.head });
  // Hooked beak.
  const bl = r * 1.3;
  const bx = hx + r * 0.6;
  b.add(
    polygon(
      [
        [bx, hy - r * 0.45],
        [bx + bl * 0.75, hy - r * 0.3],
        [bx + bl, hy + r * 0.15],
        [bx + bl * 0.8, hy + r * 0.55],
        [bx + bl * 0.6, hy + r * 0.2],
        [bx, hy + r * 0.35],
      ],
      0.4,
    ),
    R.accent,
    13,
  );
  b.eyes.push(eye);
  b.bone = 'body';
  // Ruff of feathers at the base of the neck.
  const tufts: Primitive[] = [];
  for (let i = 0; i < 5; i++) {
    const a = deg(-170 + i * 40);
    const [tx, ty] = dirPt(rx * 0.5, cy - ry * 0.5, a, r * 1.4);
    tufts.push(lens(rx * 0.5, cy - ry * 0.5, tx, ty, r * 0.9));
  }
  b.add(union(tufts, 1), R.secondary, 10.5);
  // Tail feathers and broad folded wing.
  const tx = -rx * 0.75;
  const ty = cy + ry * 0.5;
  b.setBone('tail', [tx, ty]);
  const fan: Primitive[] = [];
  for (let i = 0; i < 3; i++) {
    const [ex, ey] = dirPt(tx, ty, deg(140 + i * 12), 10 + 4 * body.length);
    fan.push(lens(tx, ty, ex, ey, 5));
  }
  b.add(union(fan, 1), R.secondary, 6);
  b.bone = 'body';
  addWings(b, 'feather', rx * 0.3, cy - ry * 0.4, 20 + 8 * body.limbs);
  addBack(
    b,
    parts.back === 'ruff' ? 'none' : parts.back,
    ellipseRidge(0, cy, rx, ry, -0.6, 0, 3),
    5,
  );
}

/** Fennec: a small fox with huge ears, big eyes and a bushy tail. */
function fennec(b: Builder): void {
  const { body, parts } = b.g;
  const legLen = 9 + 6 * body.limbs;
  const rx = 11 + 4 * body.length;
  const ry = 7 + 2 * body.height + 2 * body.bulk;
  const cy = -(legLen + ry * 0.5);
  const legR = 1.8 + 0.8 * body.bulk;
  const socks = -legLen * 0.4;
  const r = 7.5 + 2.5 * body.head;
  const hx = rx * 0.85 + r * 0.45;
  const hy = cy - ry * 0.7 - r * 0.55;

  b.add(
    union(
      [
        ellipse(0, cy, rx, ry),
        capsule(rx * 0.6, cy - ry * 0.3, hx - r * 0.3, hy + r * 0.4, ry * 0.6, r * 0.5),
      ],
      4,
    ),
    b.skin(),
    10,
    { group: G.body },
  );
  const legSkin = b.skin({ belly: false, spots: false, stripes: false, socksBelow: socks });
  for (const [lx, far] of [
    [rx * 0.55, true],
    [-rx * 0.6, true],
    [rx * 0.65, false],
    [-rx * 0.5, false],
  ] as const) {
    const x = far ? lx - 2.5 : lx;
    b.add(
      capsule(x, cy + ry * 0.2, x + 0.6, -legR * 0.8, legR * 1.1, legR * 0.85),
      legSkin,
      far ? 8 : 9,
      far ? { depth: 1 } : {},
    );
  }
  b.setBone('head', [hx - r * 0.5, hy + r * 0.6]);
  const eye: EyeSpec = { x: hx + r * 0.3, y: hy - r * 0.05, r: r * 0.3 };
  b.add(
    ellipse(hx, hy, r, r * 0.88),
    b.skin({ belly: false, spots: false, stripes: false, mask: eye }),
    12,
    { group: G.head },
  );
  const mx = hx + r * 0.85;
  b.add(ellipse(mx, hy + r * 0.32, r * 0.48, r * 0.3), b.g.belly ? R.belly : R.primary, 12, {
    group: G.head,
  });
  b.add(circle(mx + r * 0.42, hy + r * 0.22, r * 0.12), R.dark, 12.5, { lines: false, thin: true });
  b.eyes.push(eye);
  if (parts.mouth !== 'none') b.mouth = { x: mx, y: hy + r * 0.6 };
  // Huge ears.
  const tipSel = parts.markings === 'tip' ? R.secondary : R.primary;
  for (const [ex, far, lean] of [
    [hx - r * 0.55, true, -32],
    [hx + r * 0.05, false, -8],
  ] as const) {
    const base: Pt = [ex, hy - r * 0.45];
    const tip = dirPt(base[0], base[1], deg(-90 + lean), r * (1.9 + 0.5 * body.head));
    const o = far ? { depth: 1 } : {};
    b.add(lens(base[0], base[1] + r * 0.2, tip[0], tip[1], r * 1.05), tipSel, far ? 11 : 13, o);
    if (!far) {
      const inner = dirPt(base[0], base[1], deg(-90 + lean), r * 1.5);
      b.add(lens(base[0], base[1], inner[0], inner[1], r * 0.55), R.belly, 13.1, { lines: false });
    }
  }
  addHorns(b, parts.horns, hx, hy, r);
  b.bone = 'body';
  // Bushy tail.
  addTail(b, 'fluffy', -rx * 0.9, cy - ry * 0.2, deg(-170), 18 + 8 * body.length, legR * 2.4);
  addBack(b, parts.back, ellipseRidge(0, cy, rx, ry, -0.5, 0.4, 3), 4 + 2 * body.bulk);
}

export const DESERT_PLANS = {
  lizard,
  scorpion,
  beetle,
  cactus,
  tortoise,
  sandworm,
  vulture,
  fennec,
} as const;
