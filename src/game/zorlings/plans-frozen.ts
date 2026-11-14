/**
 * Frozen-coast body plans (C35a), the Rimeholm kit: pinniped (seal / walrus), tusker (mammoth),
 * jelly, crab, angler, mustelid (stoat / otter), owl, caribou, urchin. Facing right, ground at y = 0.
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
  addEars,
  addHorns,
  addTail,
  addWings,
  curve,
  deg,
  dirPt,
  ellipseRidge,
  G,
  jointed,
  lens,
  pincer,
  R,
  type EyeSpec,
  type Pt,
} from './parts';
import { headScale } from './plans-wild';

/** Pinniped (seal / sea lion / walrus): chest up on flippers, body tapering to rear flippers. */
function pinniped(b: Builder): void {
  const { body, parts } = b.g;
  const hs = headScale(b);
  const rx = 20 + 8 * body.length;
  const ry = 9 + 3 * body.height + 4 * body.bulk;
  const lift = 6 + 8 * body.limbs; // how high the chest is raised
  const cy = -ry;
  const r = (8.5 + 3.5 * body.head) * hs;
  const chestX = rx * 0.45;
  const chestY = cy - lift * 0.6;
  const hx = chestX + r * 0.55;
  const hy = chestY - ry * 0.75 - r * 0.45;

  const eye: EyeSpec = { x: hx + r * 0.28, y: hy - r * 0.15, r: r * 0.27 };
  // Body: a teardrop from raised chest to a tapered rear on the ground.
  b.add(
    union(
      [
        ellipse(chestX * 0.2, cy + 1, rx * 0.75, ry),
        circle(chestX, chestY, ry * 1.08),
        capsule(-rx * 0.4, cy + ry * 0.2, -rx * 1.0, -ry * 0.35, ry * 0.8, ry * 0.35),
        capsule(chestX, chestY, hx - r * 0.2, hy + r * 0.3, ry * 0.8, r * 0.75),
      ],
      5,
    ),
    b.skin(),
    10,
    { group: G.body },
  );
  // Fur ruff marking for frost babies: handled by skin. Front flippers.
  for (const far of [true, false]) {
    const fx = chestX + (far ? -2 : 3);
    const fy = chestY + ry * 0.5;
    const tip: Pt = [fx + 7 + 4 * body.limbs, -0.8];
    b.add(
      lens(fx, fy, tip[0], tip[1], 6 + 2 * body.bulk),
      R.secondary,
      far ? 8 : 11,
      far ? { depth: 1 } : {},
    );
  }
  // Rear flippers, fanned behind.
  const tx = -rx * 1.0;
  const ty = -ry * 0.35;
  b.setBone('tail', [tx + 2, ty]);
  for (const [a, far] of [
    [deg(195), true],
    [deg(165), false],
  ] as const) {
    const [ex, ey] = dirPt(tx, ty, a, 9 + 4 * body.length);
    b.add(
      lens(tx + 1, ty, ex, Math.min(ey, -0.5), 6),
      R.secondary,
      far ? 6 : 6.5,
      far ? { depth: 1 } : {},
    );
  }
  b.bone = 'body';

  // Head with whisker pads.
  b.setBone('head', [hx - r * 0.4, hy + r * 0.6]);
  b.add(circle(hx, hy, r), b.skin({ belly: false, spots: false, stripes: false, mask: eye }), 12, {
    group: G.head,
  });
  const long = parts.snout === 'long';
  const sx = hx + r * (long ? 0.95 : 0.78);
  const sy = hy + r * 0.3;
  for (const dy of [0, 1]) {
    b.add(
      circle(sx - r * 0.12 + dy * r * 0.12, sy + dy * r * 0.12, r * (long ? 0.38 : 0.32)),
      R.belly,
      12.2,
      {
        group: 27,
      },
    );
  }
  b.add(ellipse(sx + r * 0.2, sy - r * 0.2, r * 0.16, r * 0.11), R.dark, 12.5, {
    lines: false,
    thin: true,
  });
  // Whiskers.
  for (let i = 0; i < 3; i++) {
    const [wx, wy] = dirPt(sx + r * 0.2, sy + r * 0.05, deg(-15 + i * 18), r * 0.7);
    b.add(capsule(sx + r * 0.2, sy + r * 0.05, wx, wy, 0.3, 0.25), R.dark, 12.6, {
      lines: false,
      thin: true,
    });
  }
  b.eyes.push(eye);
  if (parts.mouth !== 'none') b.mouth = { x: sx, y: sy + r * 0.35 };
  b.tuskRoot = [sx - r * 0.05, sy + r * 0.25];

  addEars(b, parts.ears === 'none' ? 'none' : 'round', hx - r * 0.2, hy + r * 0.25, r * 0.6);
  addHorns(b, parts.horns, hx, hy, r);
  b.bone = 'body';
  addBack(
    b,
    parts.back,
    ellipseRidge(chestX * 0.2, cy + 1, rx * 0.75, ry, -0.7, 0.3, 4),
    6 + 3 * body.bulk,
  );
}

/** Tusker (mammoth): high shoulders, pillar legs, low head with trunk and tusks, shaggy fur. */
function tusker(b: Builder): void {
  const { body, parts } = b.g;
  const hs = headScale(b);
  const legLen = 9 + 8 * body.limbs;
  const rx = 18 + 8 * body.length;
  const ry = 12 + 4 * body.height + 4 * body.bulk;
  const cy = -(legLen + ry * 0.6);
  const legR = 4.5 + 2.5 * body.bulk;
  const socks = -legLen * 0.35;

  const r = (9 + 4 * body.head) * hs;
  const hx = rx * 0.85 + r * 0.3;
  const hy = cy - ry * 0.25;

  // Body with a shoulder hump; the back slopes down to the rump.
  b.add(
    union(
      [
        ellipse(0, cy, rx, ry),
        circle(rx * 0.4, cy - ry * 0.35, ry * 0.95),
        ellipse(-rx * 0.5, cy + ry * 0.05, rx * 0.5, ry * 0.85),
      ],
      6,
    ),
    b.skin(),
    10,
    { group: G.body },
  );
  // Shaggy fringe: strands hanging from the belly and chest.
  const strands: Primitive[] = [];
  for (let k = 0; k < 8; k++) {
    const x = -rx * 0.7 + (k / 7) * rx * 1.45;
    const top = cy + ry * 0.55;
    const len = ry * (0.5 + (k % 2) * 0.25);
    strands.push(lens(x, top, x - 1.5, top + len, 3.5 + 1.5 * body.bulk));
  }
  b.add(union(strands, 0.5), R.primary, 10.4, { depth: 1 });
  for (const [lx, far] of [
    [rx * 0.5, true],
    [-rx * 0.55, true],
    [rx * 0.62, false],
    [-rx * 0.42, false],
  ] as const) {
    const x = far ? lx - 4 : lx;
    b.add(
      capsule(x, cy + ry * 0.3, x, -legR * 0.9, legR * 1.1, legR),
      b.skin({ belly: false, spots: false, stripes: false, socksBelow: socks }),
      far ? 8 : 9,
      far ? { depth: 1 } : {},
    );
    // Toenails.
    b.add(ellipse(x + legR * 0.5, -1.2, legR * 0.4, 1.2), R.ivory, far ? 8.1 : 9.1, {
      lines: false,
      thin: true,
      ...(far ? { depth: 1 } : {}),
    });
  }

  // Head: a dome, low in front of the hump, and a trunk.
  b.setBone('head', [hx - r * 0.6, hy - r * 0.2]);
  const eye: EyeSpec = { x: hx + r * 0.25, y: hy - r * 0.15, r: r * 0.22 };
  b.add(
    union([circle(hx, hy, r), circle(hx - r * 0.25, hy - r * 0.55, r * 0.75)], 3),
    b.skin({ belly: false, spots: false, stripes: false, mask: eye }),
    12,
    { group: G.head },
  );
  const trunkLen = parts.snout === 'long' ? r * 2.4 + legLen * 0.6 : r * 1.3;
  const trunk = curve(
    hx + r * 0.6,
    hy + r * 0.3,
    deg(70),
    deg(parts.snout === 'long' ? -40 : 20),
    trunkLen,
    r * 0.42,
    r * 0.22,
    5,
  );
  b.add(trunk.prim, R.primary, 12.2, { group: G.head });
  b.add(circle(trunk.end[0], trunk.end[1], r * 0.24), R.primary, 12.25, { group: G.head });
  b.eyes.push(eye);
  if (parts.mouth !== 'none') b.mouth = { x: hx + r * 0.45, y: hy + r * 0.75 };
  b.tuskRoot = [hx + r * 0.55, hy + r * 0.55];

  // Ears: flat, against the head.
  if (parts.ears !== 'none') {
    const big = parts.ears === 'long';
    b.add(
      ellipse(
        hx - r * 0.55,
        hy + r * 0.05,
        r * (big ? 0.55 : 0.4),
        r * (big ? 0.75 : 0.5),
        deg(10),
      ),
      R.primary,
      12.3,
      { depth: 1 },
    );
  }
  addHorns(b, parts.horns, hx, hy, r * 1.25);
  b.bone = 'body';
  addTail(b, parts.tail, -rx * 0.95, cy - ry * 0.1, deg(-200), 8 + 4 * body.length, legR * 0.6);
  addBack(
    b,
    parts.back,
    ellipseRidge(0, cy - ry * 0.15, rx, ry * 1.1, -0.7, 0.45, 5),
    7 + 3 * body.bulk,
  );
}

/** Jellyfish: a floating bell with a scalloped rim, frilly oral arms and trailing tendrils. */
function jelly(b: Builder): void {
  const { body, parts } = b.g;
  const rx = 15 + 6 * body.bulk + 2 * body.length;
  const ry = 14 + 6 * body.height;
  const tendrilLen = 16 + 12 * body.limbs;
  const rim = -(tendrilLen + 3); // bottom of the bell
  const cy = rim;

  // Tendrils first (behind), wavy, swaying on the tail bone.
  b.setBone('tail', [0, rim]);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const x = -rx * 0.8 + (i / (n - 1)) * rx * 1.6;
    const far = i % 2 === 1;
    const s = i % 2 ? 1 : -1;
    const len = tendrilLen * (0.85 + ((i * 7) % 3) * 0.08);
    const a = curve(x, rim, deg(90), deg(45 * s), len * 0.5, 0.75, 0.55, 3);
    const c = curve(a.end[0], a.end[1], a.endAngle, deg(-80 * s), len * 0.5, 0.55, 0.3, 3);
    b.add(union([a.prim, c.prim]), R.secondary, far ? 5 : 8.5, {
      thin: true,
      lines: false,
      ...(far ? { depth: 1 } : {}),
    });
  }
  // Oral arms: frilly ribbons under the middle.
  for (const [dx, far] of [
    [-rx * 0.15, true],
    [rx * 0.2, false],
  ] as const) {
    const c = curve(dx, rim, deg(95), deg(far ? -25 : 25), tendrilLen * 0.7, 2.6, 0.8, 4);
    const frills: Primitive[] = [c.prim];
    for (let k = 1; k <= 3; k++) {
      const t = k / 4;
      const [fx, fy] = dirPt(dx, rim, deg(95), tendrilLen * 0.7 * t);
      frills.push(circle(fx + (k % 2 ? 1.6 : -1.6), fy, 2.2 - t));
    }
    b.add(union(frills, 1), R.belly, far ? 6 : 9.5, far ? { depth: 1 } : {});
  }
  b.bone = 'body';

  // Bell: a dome cut flat at the rim, with scallops.
  const dome = intersect(
    ellipse(0, cy, rx, ry),
    polygon([
      [-300, -300],
      [300, -300],
      [300, rim - 1],
      [-300, rim - 1],
    ]),
  );
  const scallops: Primitive[] = [];
  for (let i = 0; i < 7; i++) {
    const x = -rx * 0.88 + (i / 6) * rx * 1.76;
    scallops.push(circle(x, rim - 1.8, rx * 0.15));
  }
  b.add(union([dome, ...scallops], 1.2), b.skin({ belly: false }), 10, { group: G.body });
  // Inner glow: the translucent lower bell.
  b.add(ellipse(0, rim - ry * 0.12, rx * 0.8, ry * 0.28), R.belly, 10.5, {
    lines: false,
    group: G.body,
  });

  const er = Math.min(rx, ry) * 0.17;
  const ey = cy - ry * 0.4;
  b.eyes.push({ x: rx * 0.05, y: ey, r: er * 0.9, far: true }, { x: rx * 0.5, y: ey, r: er });
  if (parts.mouth !== 'none') b.mouth = { x: rx * 0.3, y: ey + er * 1.9 };
  addHorns(b, parts.horns, rx * 0.15, cy - ry * 0.6, ry * 0.75);
  if (parts.back !== 'none') {
    addBack(b, parts.back, ellipseRidge(0, cy, rx, ry, -0.6, 0.6, 5), 4 + 2 * body.bulk);
  }
}

/** Crab: a wide shell on spiky legs, eyes on stalks, two big raised claws. */
function crab(b: Builder): void {
  const { body, parts } = b.g;
  const hs = headScale(b);
  const legLen = 7 + 5 * body.limbs;
  const rx = 13 + 4 * body.length + 2 * body.bulk;
  const ry = 8 + 3 * body.height + 2 * body.bulk;
  const cy = -(legLen + ry * 0.35);

  // Walking legs: four per side, two reaching back and two forward, knees arched up.
  for (const far of [true, false]) {
    const o = far ? { depth: 1 } : {};
    const z = far ? 4 : 10.5;
    const dx = far ? -3 : 0;
    for (let i = 0; i < 4; i++) {
      const side = i < 2 ? -1 : 1;
      const k = i % 2 === 0 ? 1 : 0; // outer leg first
      const hip: Pt = [dx + side * rx * (0.3 + k * 0.2), cy + ry * 0.55];
      const knee: Pt = [dx + side * (rx * 0.8 + k * 5), cy - ry * (0.1 + k * 0.15) - (far ? 2 : 0)];
      const foot: Pt = [dx + side * (rx * 0.95 + k * 7), -0.5];
      b.add(jointed(hip, knee, foot, 1.7 + 0.5 * body.bulk, 0.6), R.primary, z, o);
    }
  }

  // Shell: wide and flat, with a spiky front rim.
  b.add(
    union([ellipse(0, cy, rx, ry), ellipse(0, cy + ry * 0.35, rx * 0.88, ry * 0.65)], 2),
    b.skin({ belly: false }),
    10,
    { group: G.body },
  );
  b.add(ellipse(rx * 0.05, cy + ry * 0.75, rx * 0.72, ry * 0.25), R.belly, 10.2, { lines: false });
  for (let i = 0; i < 3; i++) {
    const a = deg(-35 + i * 20);
    const [x, y] = [rx * Math.cos(a) * 0.95, cy + ry * Math.sin(a) * 0.95];
    b.add(
      polygon(
        [dirPt(x, y, a - deg(70), 1.8), dirPt(x, y, a, 3.2), dirPt(x, y, a + deg(70), 1.8)],
        0.3,
      ),
      R.accent,
      9.9,
      { thin: true },
    );
  }

  // Eye stalks.
  const er = (2.3 + 1.2 * body.head) * hs;
  for (const far of [true, false]) {
    const sx = rx * (far ? 0.2 : 0.45);
    const top: Pt = [sx + 1.5, cy - ry - 3 - 3 * body.head];
    b.add(capsule(sx, cy - ry * 0.6, top[0], top[1], 1.3, 1.1), R.primary, far ? 9.7 : 10.6, {
      thin: true,
      ...(far ? { depth: 1 } : {}),
    });
    b.add(circle(top[0], top[1], er * 1.2), R.primary, far ? 9.75 : 10.65, far ? { depth: 1 } : {});
    b.eyes.push({ x: top[0] + er * 0.15, y: top[1], r: er, ...(far ? { far: true } : {}) });
  }
  if (parts.mouth !== 'none') b.mouth = { x: rx * 0.72, y: cy + ry * 0.4 };

  // Claws raised in front of the shell; the near one bigger.
  const clawR = 4.5 + 2.5 * body.bulk + 1.5 * body.limbs;
  for (const far of [true, false]) {
    const o = far ? { depth: 1 } : {};
    const z = far ? 8 : 13;
    const s = far ? 0.75 : 1;
    const sx = rx * 0.75 - (far ? 4 : 0);
    const sy = cy + ry * 0.5;
    const elbow: Pt = [sx + 6 * s, sy + 1];
    const wrist: Pt = [sx + 8 * s, sy - 6 * s];
    b.add(jointed([sx, sy], elbow, wrist, 2.2 * s, 2.4 * s), R.primary, z, o);
    const [cx, ccy] = dirPt(wrist[0], wrist[1], deg(-55), clawR * 0.8 * s);
    pincer(b, cx, ccy, clawR * s, deg(-50), z + 0.1, o);
  }
  addHorns(b, parts.horns, rx * 0.3, cy - ry * 0.3, ry);
  if (parts.back !== 'none') {
    addBack(b, parts.back, ellipseRidge(0, cy, rx, ry, -0.6, 0.5, 4), 4 + 2 * body.bulk);
  }
}

/** Anglerfish: a round body, a huge toothy mouth, small fins, and a glowing lure. */
function angler(b: Builder): void {
  const { body, parts } = b.g;
  const rx = 17 + 6 * body.length + 3 * body.bulk;
  const ry = 14 + 5 * body.height + 2 * body.bulk;
  const cy = -(ry + 4);

  b.add(
    union([ellipse(0, cy, rx, ry), ellipse(rx * 0.35, cy + ry * 0.1, rx * 0.65, ry * 0.95)], 4),
    b.skin({ stripes: true }),
    10,
    {
      group: G.body,
    },
  );
  // Mouth: a wide dark gape across the front with fangs.
  const mx = rx * 0.55;
  const my = cy + ry * 0.35;
  const mouth = intersect(
    ellipse(mx + rx * 0.2, my, rx * 0.55, ry * 0.32),
    ellipse(0, cy, rx * 1.02, ry * 1.02),
  );
  b.add(mouth, R.dark, 10.6, { lines: false });
  for (let i = 0; i < 5; i++) {
    const tx = mx - rx * 0.1 + i * rx * 0.13;
    const top = my - ry * 0.22 + Math.abs(i - 3) * 0.6;
    b.add(
      polygon([
        [tx - 1.3, top],
        [tx + 1.3, top],
        [tx, top + 3.2 + (i % 2)],
      ]),
      R.white,
      10.7,
      { lines: false, thin: true },
    );
    const bot = my + ry * 0.24 - Math.abs(i - 3) * 0.6;
    if (i % 2 === 0)
      b.add(
        polygon([
          [tx - 1.2, bot],
          [tx + 1.2, bot],
          [tx + 0.3, bot - 2.8],
        ]),
        R.white,
        10.7,
        { lines: false, thin: true },
      );
  }
  // Tail and fins.
  const tx = -rx * 0.95;
  b.setBone('tail', [tx + 2, cy]);
  const L = ry * 0.9;
  b.add(
    polygon(
      [
        [tx + 2, cy],
        [tx - L, cy - L * 0.8],
        [tx - L * 0.6, cy],
        [tx - L, cy + L * 0.7],
      ],
      1,
    ),
    R.secondary,
    6,
  );
  b.bone = 'body';
  b.add(lens(rx * 0.05, cy + ry * 0.5, -rx * 0.3, cy + ry * 1.05, ry * 0.4), R.secondary, 12);
  b.add(lens(-rx * 0.1, cy - ry * 0.85, -rx * 0.55, cy - ry * 1.15, ry * 0.4), R.secondary, 7);
  b.eyes.push({ x: rx * 0.45, y: cy - ry * 0.3, r: ry * 0.2 });
  // Lure: always.
  const c = curve(rx * 0.35, cy - ry * 0.9, deg(-80), deg(115), ry * 1.5, 1, 0.7, 4);
  b.add(c.prim, R.primary, 9, { thin: true });
  b.add(circle(c.end[0], c.end[1] + 1, 2.8 + body.head), R.accent, 9.1, { flatTone: 0 });
  addBack(b, parts.back, ellipseRidge(0, cy, rx, ry, -0.7, 0.1, 4), 5 + 3 * body.bulk);
}

/** Mustelid (stoat, otter, wolverine): a long low body, short legs, round head and ears. */
function mustelid(b: Builder): void {
  const { body, parts } = b.g;
  const hs = headScale(b);
  const legLen = 5 + 5 * body.limbs;
  const rx = 17 + 7 * body.length;
  const ry = 6 + 2 * body.height + 3.5 * body.bulk;
  const cy = -(legLen + ry * 0.55);
  const legR = 2.4 + 1.6 * body.bulk;
  const socks = -legLen * 0.4;
  const r = (7 + 3 * body.head) * hs;
  const hx = rx + r * 0.35;
  const hy = cy - ry * 0.9 - r * 0.3;

  // Arched back: a bump in the middle, like a stoat mid-bound.
  b.add(
    union(
      [
        ellipse(0, cy, rx, ry),
        ellipse(-rx * 0.2, cy - ry * 0.35, rx * 0.55, ry * 0.95),
        capsule(rx * 0.6, cy - ry * 0.2, hx - r * 0.3, hy + r * 0.3, ry * 0.85, r * 0.6),
      ],
      4,
    ),
    b.skin(),
    10,
    { group: G.body },
  );
  const legSkin = b.skin({ belly: false, spots: false, stripes: false, socksBelow: socks });
  for (const [lx, far] of [
    [rx * 0.6, true],
    [-rx * 0.65, true],
    [rx * 0.7, false],
    [-rx * 0.55, false],
  ] as const) {
    const x = far ? lx - 3 : lx;
    b.add(
      capsule(x, cy + ry * 0.3, x + 1, -legR * 0.8, legR * 1.1, legR * 0.9),
      legSkin,
      far ? 8 : 9,
      far ? { depth: 1 } : {},
    );
  }
  b.setBone('head', [hx - r * 0.5, hy + r * 0.5]);
  const eye: EyeSpec = { x: hx + r * 0.3, y: hy - r * 0.15, r: r * 0.25 };
  b.add(
    ellipse(hx, hy, r * 1.05, r * 0.85),
    b.skin({ belly: false, spots: false, stripes: false, mask: eye }),
    12,
    { group: G.head },
  );
  const sx = hx + r * 0.8;
  b.add(ellipse(sx, hy + r * 0.25, r * 0.45, r * 0.32), R.belly, 12.1, { group: 30 });
  b.add(circle(sx + r * 0.38, hy + r * 0.12, r * 0.13), R.dark, 12.5, { lines: false, thin: true });
  b.eyes.push(eye);
  if (parts.mouth !== 'none') b.mouth = { x: sx, y: hy + r * 0.55 };
  addEars(b, parts.ears === 'none' ? 'none' : 'round', hx - r * 0.05, hy + r * 0.2, r * 0.85);
  addHorns(b, parts.horns, hx, hy, r);
  b.bone = 'body';
  const tail = parts.tail === 'none' ? 'thin' : parts.tail;
  addTail(b, tail, -rx * 0.95, cy - ry * 0.1, deg(-175), 16 + 10 * body.length, legR * 1.4);
  addBack(
    b,
    parts.back,
    ellipseRidge(-rx * 0.2, cy - ry * 0.35, rx * 0.55, ry * 0.95, -0.7, 0.6, 4),
    5 + 3 * body.bulk,
  );
}

/** Owl: a round body and big head with a facial disc, ear tufts, folded wings, feathered feet. */
function owl(b: Builder): void {
  const { body, parts } = b.g;
  const legLen = 3 + 3 * body.limbs;
  const rx = 13 + 4 * body.bulk + 2 * body.length;
  const ry = 15 + 4 * body.height;
  const cy = -(legLen + ry * 0.9);
  const r = 11 + 3 * body.head;
  const hx = rx * 0.15;
  const hy = cy - ry * 0.7 - r * 0.45;

  for (const [lx, far] of [
    [-3, true],
    [4, false],
  ] as const) {
    const o = far ? { depth: 1 } : {};
    b.add(ellipse(lx, -2.2, 3.2, 2.4), R.primary, far ? 8 : 10.8, o);
    for (let i = 0; i < 3; i++) {
      b.add(circle(lx + 1 + i * 1.6, -0.8, 0.8), R.accent, far ? 8.1 : 10.9, {
        ...o,
        thin: true,
        lines: false,
      });
    }
  }
  b.add(union([ellipse(0, cy, rx, ry), circle(hx, hy, r)], 6), b.skin(), 10, { group: G.body });
  // Facial disc.
  b.add(ellipse(hx + r * 0.25, hy + r * 0.05, r * 0.85, r * 0.72), R.belly, 10.6, {
    group: G.body,
  });
  const er = r * 0.28;
  b.eyes.push(
    { x: hx - r * 0.12, y: hy - r * 0.05, r: er, far: true },
    { x: hx + r * 0.55, y: hy - r * 0.05, r: er * 1.05 },
  );
  b.add(
    polygon([
      [hx + r * 0.12, hy + r * 0.2],
      [hx + r * 0.42, hy + r * 0.2],
      [hx + r * 0.27, hy + r * 0.55],
    ]),
    R.accent,
    10.8,
    {
      thin: true,
    },
  );
  // Ear tufts.
  if (parts.ears !== 'none') {
    for (const [ex, far] of [
      [hx - r * 0.55, true],
      [hx + r * 0.45, false],
    ] as const) {
      const base: Pt = [ex, hy - r * 0.7];
      const tip = dirPt(base[0], base[1], deg(far ? -120 : -70), r * 0.75);
      b.add(
        lens(base[0], base[1], tip[0], tip[1], r * 0.4),
        R.secondary,
        far ? 9 : 10.9,
        far ? { depth: 1 } : {},
      );
    }
  }
  addHorns(b, parts.horns, hx, hy, r);
  // Chest bars.
  if (parts.markings !== 'none' && parts.markings !== 'frost') {
    for (let i = 0; i < 3; i++) {
      const y = cy + ry * (-0.1 + i * 0.3);
      b.add(capsule(rx * 0.05, y, rx * 0.55, y + 1, 0.6, 0.6), R.secondary, 10.5, {
        lines: false,
        thin: true,
      });
    }
  }
  const tx = -rx * 0.6;
  const ty = cy + ry * 0.7;
  b.setBone('tail', [tx, ty]);
  b.add(lens(tx, ty, tx - 8 - 3 * body.length, ty + 6, 5), R.secondary, 6);
  b.bone = 'body';
  addWings(b, 'feather', -rx * 0.1, cy - ry * 0.3, 17 + 6 * body.limbs);
  addBack(b, parts.back, ellipseRidge(0, cy, rx, ry, -0.85, -0.4, 3), 5 + 2 * body.bulk);
}

/** Caribou: a tall deer with a long face, a shaggy throat, and big swept antlers. */
function caribou(b: Builder): void {
  const { body, parts } = b.g;
  const legLen = 15 + 9 * body.limbs;
  const rx = 15 + 6 * body.length;
  const ry = 8 + 3 * body.height + 2.5 * body.bulk;
  const cy = -(legLen + ry * 0.5);
  const legR = 1.9 + 1 * body.bulk;
  const socks = -legLen * 0.3;
  const r = 6.5 + 2 * body.head;
  const hx = rx * 0.95 + r * 0.6;
  const hy = cy - ry * 1.2 - r * 1.2;

  b.add(
    union(
      [
        ellipse(0, cy, rx, ry),
        capsule(rx * 0.6, cy - ry * 0.2, hx - r * 0.3, hy + r * 0.4, ry * 0.7, r * 0.55),
      ],
      4,
    ),
    b.skin(),
    10,
    { group: G.body },
  );
  // Throat mane.
  const mane: Primitive[] = [];
  for (let i = 0; i < 3; i++) {
    const t = 0.3 + i * 0.22;
    const x = rx * 0.6 + (hx - rx * 0.6) * t + r * 0.3;
    const y = cy - ry * 0.2 + (hy - cy + ry * 0.2) * t + r * 0.3;
    mane.push(lens(x, y, x + 1, y + 6 + 2 * body.bulk, 4));
  }
  b.add(union(mane, 1), parts.markings === 'frost' ? R.frost : R.belly, 10.5);
  const legSkin = b.skin({ belly: false, spots: false, stripes: false, socksBelow: socks });
  for (const [lx, far] of [
    [rx * 0.55, true],
    [-rx * 0.6, true],
    [rx * 0.65, false],
    [-rx * 0.5, false],
  ] as const) {
    const x = far ? lx - 3 : lx;
    const o = far ? { depth: 1 } : {};
    b.add(
      capsule(x, cy + ry * 0.2, x + 0.8, -legR * 1.4, legR * 1.2, legR * 0.8),
      legSkin,
      far ? 8 : 9,
      o,
    );
    b.add(ellipse(x + 1.2, -legR * 0.8, legR * 1.15, legR * 0.85), R.dark, far ? 8.1 : 9.1, {
      ...o,
      thin: true,
    });
  }
  b.setBone('head', [hx - r * 0.5, hy + r * 0.7]);
  const eye: EyeSpec = { x: hx + r * 0.1, y: hy - r * 0.2, r: r * 0.26 };
  b.add(
    union(
      [
        ellipse(hx, hy, r * 0.9, r * 0.75),
        capsule(hx + r * 0.3, hy + r * 0.1, hx + r * 1.5, hy + r * 0.45, r * 0.55, r * 0.42),
      ],
      2,
    ),
    b.skin({ belly: false, spots: false, stripes: false, mask: eye }),
    12,
    { group: G.head },
  );
  b.add(circle(hx + r * 1.65, hy + r * 0.35, r * 0.22), R.dark, 12.5, { lines: false, thin: true });
  b.eyes.push(eye);
  if (parts.mouth !== 'none') b.mouth = { x: hx + r * 1.1, y: hy + r * 0.8 };
  addEars(b, parts.ears === 'none' ? 'none' : 'pointy', hx - r * 0.5, hy + r * 0.15, r * 0.7);
  // Antlers: swept back and up, with tines. Always (stage rules may turn them to nubs).
  const kind = parts.horns;
  if (kind === 'antlers' || kind === 'pair' || kind === 'curved' || kind === 'single') {
    for (const far of [true, false]) {
      const x = hx - r * (far ? 0.4 : 0.1);
      const y = hy - r * 0.6;
      const main = curve(x, y, deg(-115), deg(70), r * (3 + body.height), r * 0.2, r * 0.1, 4);
      const tines: Primitive[] = [main.prim];
      for (let i = 1; i <= 3; i++) {
        const t = curve(
          x,
          y,
          deg(-115),
          deg(70) * (i / 4),
          r * (3 + body.height) * (i / 4),
          r * 0.15,
          r * 0.1,
          2,
        );
        const [tx2, ty2] = dirPt(t.end[0], t.end[1], t.endAngle - deg(70), r * 0.9);
        tines.push(capsule(t.end[0], t.end[1], tx2, ty2, r * 0.13, r * 0.07));
      }
      b.add(union(tines), R.accent, far ? 11 : 13.5, { thin: true, ...(far ? { depth: 1 } : {}) });
    }
  } else addHorns(b, kind, hx, hy, r);
  b.bone = 'body';
  addTail(
    b,
    parts.tail === 'none' ? 'none' : 'fluffy',
    -rx * 0.95,
    cy - ry * 0.4,
    deg(-150),
    6,
    legR * 1.5,
  );
  addBack(b, parts.back, ellipseRidge(0, cy, rx, ry, -0.6, 0.4, 4), 5 + 2 * body.bulk);
}

/** Urchin: a round body covered in long spines, tiny tube feet, and a face peeking out. */
function urchin(b: Builder): void {
  const { body, parts } = b.g;
  const rr = 13 + 5 * body.bulk + 2 * body.height;
  const cy = -(rr + 3);
  // Tube feet.
  for (let i = 0; i < 5; i++) {
    const x = -rr * 0.6 + i * rr * 0.3;
    b.add(
      capsule(x, cy + rr * 0.8, x + 0.5, -1, 1.3, 1.1),
      R.belly,
      i % 2 ? 8 : 10.8,
      i % 2 ? { depth: 1 } : {},
    );
  }
  // Spines: all around except the bottom, long and short alternating.
  const spines: Primitive[] = [];
  const back: Primitive[] = [];
  const n = 14;
  const len = 7 + 6 * body.limbs;
  for (let i = 0; i < n; i++) {
    const a = deg(-200 + (i / (n - 1)) * 220);
    const [bx, by] = dirPt(0, cy, a, rr * 0.85);
    const [tx, ty] = dirPt(0, cy, a, rr + len * (i % 2 ? 0.6 : 1));
    spines.push(capsule(bx, by, tx, ty, 1.5, 0.3));
    const [cx, cyy] = dirPt(0, cy, a + deg(8), rr + len * 0.8);
    back.push(capsule(bx, by, cx, cyy, 1.3, 0.3));
  }
  const spineRamp = parts.back === 'icicles' ? R.frost : R.accent;
  b.add(union(back), spineRamp, 6, { depth: 1, thin: true });
  b.add(circle(0, cy, rr), b.skin({ belly: false }), 10, { group: G.body });
  b.add(union(spines), spineRamp, 11, { thin: true });
  const er = rr * 0.2;
  const ey = cy + rr * 0.1;
  b.eyes.push({ x: rr * 0.05, y: ey, r: er * 0.9, far: true }, { x: rr * 0.5, y: ey, r: er });
  if (parts.mouth !== 'none') b.mouth = { x: rr * 0.3, y: ey + er * 1.9 };
  addHorns(b, parts.horns, rr * 0.15, cy - rr * 0.3, rr * 0.7);
}

export const FROZEN_PLANS = {
  pinniped,
  tusker,
  jelly,
  crab,
  angler,
  mustelid,
  owl,
  caribou,
  urchin,
} as const;
