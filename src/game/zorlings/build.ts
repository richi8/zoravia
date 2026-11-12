/**
 * Genome → sprite model. Body plans assemble distance-field shapes from the part library
 * (`parts.ts`); the classic plans live here, the wilder ones in `plans-wild.ts`.
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
import type { ZorlingGenome } from './genome';
import {
  Builder,
  G,
  R,
  addBack,
  addEars,
  addHorns,
  addTail,
  addWings,
  deg,
  dirPt,
  ellipseRidge,
  type EyeSpec,
  type ZorlingModel,
} from './parts';
import { WILD_PLANS } from './plans-wild';

export { R, type EyeSpec, type MouthSpec, type ZorlingModel } from './parts';

// ---------------------------------------------------------------------------------------------
// Body plans

function quadruped(b: Builder): void {
  const { body, parts } = b.g;
  const legLen = 8 + 11 * body.limbs;
  const rx = 19 + 12 * body.length;
  const ry = 11 + 5 * body.height + 3 * body.bulk;
  const cy = -(legLen + ry * 0.55);
  const legR = 3.4 + 2.6 * body.bulk;
  const socks = -legLen * 0.38;

  const r = 9 + 6 * body.head;
  const hx = rx * 0.78 + r * 0.35;
  const hy = cy - ry * 0.7 - r * 0.55;

  b.add(
    union(
      [
        ellipse(0, cy, rx, ry),
        circle(rx * 0.45, cy - ry * 0.15, ry * 0.98),
        capsule(rx * 0.45, cy - ry * 0.2, hx - r * 0.2, hy + r * 0.25, r * 0.62, r * 0.55),
      ],
      6,
    ),
    b.skin(),
    10,
    { group: G.body },
  );

  for (const [lx, far] of [
    [rx * 0.48, true],
    [-rx * 0.6, true],
    [rx * 0.6, false],
    [-rx * 0.48, false],
  ] as const) {
    const x = far ? lx - 3 : lx;
    b.add(
      capsule(x, cy + ry * 0.2, x + 1.2, -legR * 0.85, legR * 1.05, legR * 0.85),
      b.skin({ belly: false, spots: false, stripes: false, socksBelow: socks }),
      far ? 8 : 9,
      far ? { depth: 1 } : {},
    );
  }

  b.setBone('head', [hx - r * 0.45, hy + r * 0.55]);
  const eye: EyeSpec = { x: hx + r * 0.32, y: hy - r * 0.12, r: r * 0.27 };
  b.add(circle(hx, hy, r), b.skin({ belly: false, stripes: false, spots: false, mask: eye }), 12, {
    group: G.head,
  });
  const long = parts.snout === 'long';
  const sx = hx + r * (long ? 0.9 : 0.72);
  const sy = hy + r * 0.32;
  const srx = r * (long ? 0.72 : 0.48);
  b.add(ellipse(sx, sy, srx, r * 0.38), b.g.belly ? R.belly : R.primary, 12, { group: G.head });
  b.add(circle(sx + srx * 0.85, sy - r * 0.2, r * 0.13), R.dark, 12.5, {
    lines: false,
    thin: true,
  });
  b.eyes.push(eye);
  if (parts.mouth !== 'none') b.mouth = { x: sx + srx * 0.25, y: sy + r * 0.25 };

  addEars(b, parts.ears, hx, hy, r);
  addHorns(b, parts.horns, hx, hy, r);
  b.bone = 'body';
  addTail(b, parts.tail, -rx * 0.88, cy - ry * 0.3, deg(-155), 14 + 10 * body.length, legR);
  addBack(b, parts.back, ellipseRidge(0, cy, rx, ry, -0.6, 0.25, 4), 7 + 3 * body.bulk);
  addWings(b, parts.wings, rx * 0.05, cy - ry * 0.6, 16 + 6 * body.limbs);
}

function serpent(b: Builder): void {
  const { body, parts } = b.g;
  const r0 = 5.5 + 3.5 * body.bulk;
  const L = 34 + 14 * body.length;
  const rise = 26 + 14 * body.height;
  const pts: [number, number, number][] = []; // x, y, radius
  const n = 20;
  const humpH = r0 * 1.5 + 6 * body.height;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const rad = t < 0.22 ? 1.6 + (r0 - 1.6) * (t / 0.22) : t > 0.78 ? r0 * 0.82 : r0;
    if (t <= 0.75) {
      // Ground section: humps with ground contact between them; the tail tip curls up.
      const u = t / 0.75;
      const x = -L + u * (L + 6);
      const hump = Math.max(0, Math.sin(Math.PI * 2 * (u * 1.55) - 0.5)) * humpH;
      const curl = u < 0.12 ? (0.12 - u) * 60 : 0;
      pts.push([x, -rad - hump - curl, rad]);
    } else {
      const u = (t - 0.75) / 0.25;
      pts.push([6 + Math.sin((u * Math.PI) / 2) * 9, -r0 - u * rise, rad]);
    }
  }
  const segs: Primitive[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay, ar] = pts[i - 1] ?? [0, 0, 1];
    const [bx, by, br] = pts[i] ?? [0, 0, 1];
    segs.push(capsule(ax, ay, bx, by, ar, br));
  }
  b.add(union(segs, 3), b.skin({ stripes: true }), 10, { group: G.body });

  const [nx, ny] = pts[pts.length - 1] ?? [0, 0];
  const r = 7 + 5 * body.head;
  const hx = nx + r * 0.55;
  const hy = ny - r * 0.35;
  b.setBone('head', [hx - r * 0.6, hy + r * 0.4]);
  const eye: EyeSpec = { x: hx + r * 0.2, y: hy - r * 0.25, r: r * 0.28 };
  b.add(
    ellipse(hx, hy, r * 1.2, r * 0.9, deg(-8)),
    b.skin({ belly: false, spots: false, stripes: false, mask: eye }),
    12,
    {
      group: G.head,
    },
  );
  const long = parts.snout === 'long';
  const sx = hx + r * (long ? 1.1 : 0.85);
  const sy = hy + r * 0.2;
  b.add(ellipse(sx, sy, r * (long ? 0.7 : 0.5), r * 0.45), R.primary, 12, { group: G.head });
  b.add(circle(sx + r * (long ? 0.55 : 0.4), sy - r * 0.22, r * 0.1), R.dark, 12.5, {
    lines: false,
    thin: true,
  });
  b.eyes.push(eye);
  if (parts.mouth !== 'none') b.mouth = { x: sx, y: sy + r * 0.3 };

  addEars(b, parts.ears, hx - r * 0.35, hy, r);
  addHorns(b, parts.horns, hx - r * 0.15, hy + r * 0.05, r);
  b.bone = 'body';
  const [tx, ty] = pts[0] ?? [0, 0];
  if (parts.tail !== 'thin')
    addTail(b, parts.tail, tx + 2, ty, deg(-160), 10 + 4 * body.length, 2.6);
  const ridge: [number, number, number][] = pts
    .slice(4, 15)
    .filter((_, i) => i % 2 === 0)
    .map(([x, y, rad]) => [x, y - rad + 1.5, deg(-95)]);
  addBack(b, parts.back, ridge, 7 + 4 * body.bulk);
  addWings(b, parts.wings, 4, -r0 * 1.6 - rise * 0.35, 14 + 6 * body.limbs);
}

function avian(b: Builder): void {
  const { body, parts } = b.g;
  const legLen = 6 + 9 * body.limbs;
  const rx = 14 + 6 * body.length;
  const ry = 12 + 4 * body.height + 2 * body.bulk;
  const cy = -(legLen + ry * 0.85);
  const r = 8 + 5 * body.head;
  const hx = rx * 0.5;
  const hy = cy - ry * 0.75;

  const eye: EyeSpec = { x: hx + r * 0.25, y: hy - r * 0.15, r: r * 0.3 };
  b.add(
    union([ellipse(0, cy, rx, ry, deg(-15)), circle(hx, hy, r)], 6),
    b.skin({ mask: eye }),
    10,
    { group: G.body },
  );
  const bl = r * (0.55 + 0.35 * body.length);
  b.add(
    polygon(
      [
        [hx + r * 0.75, hy - r * 0.22],
        [hx + r * 0.78, hy + r * 0.32],
        [hx + r * 0.75 + bl, hy + r * 0.12],
      ],
      0.9,
    ),
    R.accent,
    13,
  );
  b.eyes.push(eye);

  for (const [lx, far] of [
    [-3, true],
    [3, false],
  ] as const) {
    const top = cy + ry * 0.7;
    const o = far ? { depth: 1, thin: true } : { thin: true };
    b.add(capsule(lx, top, lx, -1.4, 1.6, 1.3), R.accent, far ? 8 : 9, o);
    b.add(capsule(lx - 1.5, -1.3, lx + 4, -1.3, 1.3, 1.1), R.accent, far ? 8 : 9, o);
  }

  addEars(b, parts.ears === 'none' ? 'none' : 'tuft', hx, hy, r);
  addHorns(b, parts.horns, hx, hy, r);
  // Tail feathers: a fan off the back.
  const tx = -rx * 0.85;
  const ty = cy + ry * 0.15;
  if (parts.tail === 'fluffy' || parts.tail === 'thin' || parts.tail === 'fin') {
    b.setBone('tail', [tx, ty]);
    const fan: Primitive[] = [];
    for (let i = 0; i < 3; i++) {
      const [ex, ey] = dirPt(tx, ty, deg(170 + i * 16), 12 + 6 * body.length - i * 2);
      fan.push(capsule(tx, ty, ex, ey, 3, 2.2));
    }
    b.add(union(fan, 2), R.secondary, 6);
    b.bone = 'body';
  } else addTail(b, parts.tail, tx, ty, deg(175), 10 + 6 * body.length, 3);
  addBack(b, parts.back, ellipseRidge(0, cy, rx, ry, -0.7, -0.1, 3), 5 + 2 * body.bulk);
  addWings(b, 'feather', -2, cy - ry * 0.15, 15 + 8 * body.limbs);
}

function blob(b: Builder): void {
  const { body, parts } = b.g;
  const rx = 20 + 8 * body.length;
  const ry = 17 + 7 * body.height;
  const cy = -ry * 0.95;
  const shape = intersect(
    union([ellipse(0, cy, rx, ry), ellipse(0, -ry * 0.35, rx * 1.08, ry * 0.42)], 5),
    polygon([
      [-200, -300],
      [200, -300],
      [200, 0],
      [-200, 0],
    ]),
  );
  b.add(shape, b.skin({ belly: false }), 10, { group: G.body });
  if (b.g.belly) {
    b.add(ellipse(rx * 0.3, -ry * 0.5, rx * 0.55, ry * 0.42), R.belly, 10.5, {
      lines: false,
      group: G.body,
    });
  }
  for (const [fx, far] of [
    [-rx * 0.45, true],
    [rx * 0.45, false],
  ] as const) {
    b.add(
      ellipse(fx + 3, -2.5, 6 + 2 * body.bulk, 3.5),
      R.primary,
      far ? 9 : 11,
      far ? { depth: 1 } : {},
    );
  }
  if (body.limbs > 0.55) {
    b.add(ellipse(rx * 0.92, cy + ry * 0.35, 4, 6, deg(-30)), R.primary, 11);
  }
  const er = Math.min(rx, ry) * 0.2;
  const ey = cy - ry * 0.12;
  b.eyes.push({ x: rx * 0.12, y: ey, r: er * 0.9, far: true }, { x: rx * 0.58, y: ey, r: er });
  if (parts.mouth !== 'none') b.mouth = { x: rx * 0.38, y: ey + er * 1.8 };

  addEars(b, parts.ears, rx * 0.15, cy - ry * 0.55, ry * 0.65);
  addHorns(b, parts.horns, rx * 0.2, cy - ry * 0.45, ry * 0.6);
  addTail(b, parts.tail, -rx * 0.9, cy + ry * 0.4, deg(-160), 12 + 6 * body.length, 3.5);
  const ridge = ellipseRidge(0, cy, rx, ry, -0.45, 0.2, parts.back === 'leaves' ? 2 : 3);
  addBack(b, parts.back, ridge, 6 + 3 * body.bulk);
  addWings(b, parts.wings, -rx * 0.35, cy - ry * 0.3, 12 + 5 * body.limbs);
}

function biped(b: Builder): void {
  const { body, parts } = b.g;
  const legLen = 6 + 8 * body.limbs;
  const legR = 3.8 + 2 * body.bulk;
  const rx = 11 + 5 * body.bulk + 2 * body.length;
  const ry = 13 + 5 * body.height;
  const cy = -(legLen + ry * 0.8);
  const r = 11 + 6 * body.head;
  const hx = 2;
  const hy = cy - ry * 0.75 - r * 0.72;
  const socks = -legLen * 0.45;

  for (const [lx, far] of [
    [-rx * 0.45, true],
    [rx * 0.35, false],
  ] as const) {
    const o = far ? { depth: 1 } : {};
    const sk = b.skin({ belly: false, spots: false, stripes: false, socksBelow: socks });
    b.add(
      capsule(lx, cy + ry * 0.4, lx + 1, -legR * 0.8, legR * 1.05, legR * 0.9),
      sk,
      far ? 7 : 9,
      o,
    );
    b.add(ellipse(lx + 3, -legR * 0.55, legR * 1.25, legR * 0.6), sk, far ? 7 : 9, {
      ...o,
      group: far ? 20 : 21,
    });
  }
  b.add(ellipse(0, cy, rx, ry), b.skin({ belly: false }), 10, { group: G.body });
  if (b.g.belly) {
    b.add(ellipse(rx * 0.35, cy + ry * 0.15, rx * 0.55, ry * 0.65), R.belly, 10.5, {
      lines: false,
      group: G.body,
    });
  }
  const armR = 2.8 + 1.4 * body.bulk;
  const armLen = 9 + 6 * body.limbs;
  for (const far of [true, false]) {
    const sx = far ? -rx * 0.5 : rx * 0.55;
    const sy = cy - ry * 0.4;
    const [ex, ey] = dirPt(sx, sy, deg(far ? 110 : 60), armLen);
    b.add(
      capsule(sx, sy, ex, ey, armR, armR * 0.9),
      b.skin({ belly: false, spots: false, stripes: false, socksBelow: ey - armR }),
      far ? 6 : 13,
      far ? { depth: 1 } : {},
    );
  }

  b.setBone('head', [hx, hy + r * 0.8]);
  const eyes: EyeSpec[] = [
    { x: hx + r * 0.0, y: hy + r * 0.02, r: r * 0.2, far: true },
    { x: hx + r * 0.5, y: hy + r * 0.02, r: r * 0.23 },
  ];
  const mask = parts.markings === 'mask' ? { x: hx + r * 0.25, y: hy, r: r * 0.32 } : undefined;
  b.add(
    circle(hx, hy, r),
    b.skin({ belly: false, spots: false, stripes: false, ...(mask ? { mask } : {}) }),
    12,
    {
      group: G.head,
    },
  );
  if (parts.snout === 'long') {
    b.add(ellipse(hx + r * 0.62, hy + r * 0.45, r * 0.42, r * 0.28), R.belly, 12.2, {
      lines: false,
    });
    b.add(circle(hx + r * 0.9, hy + r * 0.36, r * 0.09), R.dark, 12.5, {
      lines: false,
      thin: true,
    });
  }
  b.eyes.push(...eyes);
  if (parts.mouth !== 'none') b.mouth = { x: hx + r * 0.32, y: hy + r * 0.48 };

  addEars(b, parts.ears, hx, hy, r);
  addHorns(b, parts.horns, hx, hy, r);
  b.bone = 'body';
  addTail(b, parts.tail, -rx * 0.8, cy + ry * 0.45, deg(-170), 12 + 8 * body.length, legR * 0.9);
  const ridge: [number, number, number][] = [0, 1, 2].map((i) => {
    const t = deg(115 + i * 25);
    return [
      rx * Math.cos(t) * 0.92,
      cy - ry * Math.sin(t) * 0.92,
      Math.atan2(-Math.sin(t) / ry, Math.cos(t) / rx),
    ];
  });
  addBack(b, parts.back, ridge, 5 + 3 * body.bulk);
  addWings(b, parts.wings, -rx * 0.4, cy - ry * 0.5, 13 + 6 * body.limbs, 5);
}

const PLANS = { quadruped, serpent, avian, blob, biped, ...WILD_PLANS } as const;

/** Builds the sprite model for a genome (pure, deterministic). */
export function buildZorling(genome: ZorlingGenome): ZorlingModel {
  const b = new Builder(genome);
  PLANS[genome.plan](b);
  return b.model();
}
