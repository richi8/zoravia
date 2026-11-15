/**
 * Battle backdrops per biome, drawn in code into the pixel layer and extended to any screen
 * size (C36e, picked from a preview round on 2026-11-15):
 * - **forest** (Verdale): the C10 sky bands, clouds, hills, tree line and grass.
 * - **desert** (Emberwaste), "Ember dusk": a violet-orange sky, a lava-lit volcano, basalt
 *   ridges and ground with glowing cracks.
 * - **frozen** (Rimeholm), "Aurora pines": a night sky with aurora ribbons and stars, a snowy
 *   pine line and a snowfield.
 *
 * A danger zone draws its biome's backdrop in a darker dusk-violet tone (`dangerTone`).
 * Everything goes through `rect` + `fill`, so the drawing is the same for any painter.
 */

import type { BiomeId } from '@game/world/biomes';

export interface Platforms {
  readonly foe: { readonly x: number; readonly y: number };
  readonly ally: { readonly x: number; readonly y: number };
}

/** The part of Pixi's `Graphics` the backdrop uses. */
export interface Painter {
  clear(): unknown;
  rect(x: number, y: number, w: number, h: number): unknown;
  fill(style: { color: number }): unknown;
}

/** Which backdrop to draw. */
export interface BackdropKind {
  readonly biome: BiomeId;
  /** A danger zone: the same backdrop in the darker dusk tone. */
  readonly danger?: boolean;
}

/** Platform centers for a screen size (game pixels). */
export function platforms(width: number, height: number): Platforms {
  const extra = height - 270;
  return {
    foe: { x: Math.round(width * 0.75), y: Math.round(120 + extra * 0.35) },
    ally: { x: Math.round(Math.max(120, width * 0.27)), y: height - 70 },
  };
}

const mix = (a: number, b: number, t: number): number => {
  const ch = (s: number): number => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/** Danger zones: a color a little desaturated, then pulled toward dusk violet. Pure. */
export function dangerTone(c: number): number {
  const l = Math.round(0.3 * ((c >> 16) & 255) + 0.55 * ((c >> 8) & 255) + 0.15 * (c & 255));
  return mix(mix(c, (l << 16) | (l << 8) | l, 0.3), 0x2a1d44, 0.42);
}

/** Draws the backdrop for `kind` (default: the forest). */
export function drawBackdrop(
  g: Painter,
  width: number,
  height: number,
  kind: BackdropKind = { biome: 'forest' },
): void {
  g.clear();
  const p: Painter = kind.danger
    ? {
        clear: () => g.clear(),
        rect: (x, y, w, h) => g.rect(x, y, w, h),
        fill: ({ color }) => g.fill({ color: dangerTone(color) }),
      }
    : g;
  DRAW[kind.biome](p, width, height);
}

const DRAW: Readonly<Record<BiomeId, (g: Painter, w: number, h: number) => void>> = {
  forest,
  desert,
  frozen,
};

// ------------------------------------------------------------------ shared pieces

function ellipseRows(
  g: Painter,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: number,
): void {
  for (let j = -ry; j <= ry; j++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (j * j) / (ry * ry))));
    if (half > 0) g.rect(cx - half, cy + j, half * 2, 1);
  }
  g.fill({ color });
}

/** The horizon line: a little below the foe's platform. */
const horizonOf = (width: number, height: number): number =>
  Math.round(platforms(width, height).foe.y + 16);

/** Sky bands from the top to the horizon, with dithered edges. */
function sky(g: Painter, width: number, horizon: number, bands: readonly number[]): void {
  const bandH = horizon / bands.length;
  bands.forEach((c, i) => {
    g.rect(0, Math.round(i * bandH), width, Math.ceil(bandH) + 1);
    g.fill({ color: c });
  });
  for (let i = 1; i < bands.length; i++) {
    const y = Math.round(i * bandH) - 2;
    for (let x = y & 1; x < width; x += 2) g.rect(x, y, 1, 1);
    for (let x = (y + 1) & 1; x < width; x += 4) g.rect(x, y + 1, 1, 1);
    g.fill({ color: bands[i] ?? 0 });
  }
}

/** A filled ridge: every column from `top(x)` down to `bottom`. */
function ridge(
  g: Painter,
  width: number,
  bottom: number,
  top: (x: number) => number,
  color: number,
): void {
  for (let x = 0; x < width; x++) {
    const y = Math.round(top(x));
    if (y < bottom) g.rect(x, y, 1, bottom - y);
  }
  g.fill({ color });
}

/** Ground from the horizon down in three bands, with a sparse dot texture. */
function ground(
  g: Painter,
  width: number,
  height: number,
  horizon: number,
  bands: readonly [number, number, number],
  dot: number,
): void {
  const gh = height - horizon;
  g.rect(0, horizon, width, Math.ceil(gh * 0.3));
  g.fill({ color: bands[0] });
  g.rect(0, horizon + Math.ceil(gh * 0.3), width, Math.ceil(gh * 0.35));
  g.fill({ color: bands[1] });
  g.rect(0, horizon + Math.ceil(gh * 0.65), width, gh);
  g.fill({ color: bands[2] });
  for (let y = horizon + 2; y < height; y += 3) {
    for (let x = (y * 7) % 23; x < width; x += 23) g.rect(x, y, 1, 1);
  }
  g.fill({ color: dot });
}

/** Both platforms in three tones (dark rim, top, highlight). */
function pads(
  g: Painter,
  width: number,
  height: number,
  tones: readonly [number, number, number],
): void {
  const p = platforms(width, height);
  for (const [c, rx, ry] of [
    [p.foe, 64, 13],
    [p.ally, 76, 16],
  ] as const) {
    ellipseRows(g, c.x, c.y + 2, rx, ry, tones[0]);
    ellipseRows(g, c.x, c.y, rx - 2, ry - 2, tones[1]);
    ellipseRows(g, c.x, c.y - 2, rx - 10, ry - 6, tones[2]);
  }
}

// ------------------------------------------------------------------ forest

function forest(g: Painter, width: number, height: number): void {
  const horizon = horizonOf(width, height);
  sky(g, width, horizon, [0x8fd0ee, 0xa2daf0, 0xb7e4f1, 0xcdeef2]);
  // Clouds.
  for (const [fx, cy, s] of [
    [0.15, 30, 1],
    [0.52, 18, 0.8],
    [0.88, 46, 1.1],
  ] as const) {
    const cx = Math.round(width * fx);
    ellipseRows(g, cx, cy, Math.round(22 * s), Math.round(6 * s), 0xffffff);
    ellipseRows(
      g,
      Math.round(cx - 8 * s),
      Math.round(cy - 4 * s),
      Math.round(10 * s),
      Math.round(6 * s),
      0xffffff,
    );
    ellipseRows(
      g,
      Math.round(cx + 9 * s),
      Math.round(cy - 5 * s),
      Math.round(9 * s),
      Math.round(7 * s),
      0xffffff,
    );
    g.rect(Math.round(cx - 20 * s), Math.round(cy + 4 * s), Math.round(40 * s), 1);
    g.fill({ color: 0xe2f3f8 });
  }
  // Hills and tree line.
  ridge(
    g,
    width,
    horizon,
    (x) => horizon - 32 + Math.round(10 * Math.sin(x / 47) + 6 * Math.sin(x / 19 + 1)),
    0x86c79a,
  );
  ridge(
    g,
    width,
    horizon,
    (x) => horizon - 14 - Math.round(5 * Math.abs(Math.sin(x / 9)) - 3 * Math.sin(x / 31)),
    0x5fae74,
  );
  ground(g, width, height, horizon, [0x8fd16b, 0x84c862, 0x79bd58], 0x6aad4c);
  pads(g, width, height, [0x5f9f45, 0x76b955, 0x88c863]);
}

// ------------------------------------------------------------------ desert: Ember dusk

function desert(g: Painter, width: number, height: number): void {
  const horizon = horizonOf(width, height);
  sky(g, width, horizon, [0x6a4c7c, 0x9a5c76, 0xcf7c6a, 0xf0ac70]);
  // The volcano: a cone with a flat crater, its right side in shade, a glowing rim and smoke.
  const cx = Math.round(width * 0.6);
  const base = horizon - 14;
  const hgt = 64;
  const halfW = 86;
  const crater = 9;
  const top = base - hgt;
  const slope = (x: number): number => {
    const d = Math.abs(x - cx);
    return d < crater ? top + 1 : top + Math.round(((d - crater) / (halfW - crater)) ** 0.85 * hgt);
  };
  for (let x = cx - halfW; x <= cx + halfW; x++) g.rect(x, slope(x), 1, base - slope(x));
  g.fill({ color: 0x5c3c4e });
  for (let x = cx; x <= cx + halfW; x++) {
    if ((x & 1) === 0 || x - cx > crater + 4) g.rect(x, slope(x) + 2, 1, base - slope(x) - 2);
  }
  g.fill({ color: 0x4e3244 });
  g.rect(cx - crater, top, crater * 2, 2);
  g.fill({ color: 0xffa04c });
  ellipseRows(g, cx + 4, top - 8, 9, 4, 0x8a6478);
  ellipseRows(g, cx + 12, top - 17, 12, 5, 0x8a6478);
  ellipseRows(g, cx + 24, top - 25, 10, 4, 0x8a6478);
  // A lava streak down the slope.
  for (let k = 0; k < 40; k++) {
    g.rect(cx + 4 + Math.round(k * 0.6 + 2 * Math.sin(k / 3)), top + 3 + k, 1, 1);
  }
  g.fill({ color: 0xff8a3c });
  // Basalt ridges.
  ridge(
    g,
    width,
    horizon,
    (x) => horizon - 22 + Math.round(8 * Math.sin(x / 29) + 4 * Math.abs(Math.sin(x / 11))),
    0x7c5058,
  );
  ridge(g, width, horizon, (x) => horizon - 9 + Math.round(3 * Math.sin(x / 17 + 1)), 0x94605e);
  ground(g, width, height, horizon, [0xb97c5c, 0xab7052, 0x9c644a], 0x86543e);
  // Ember cracks.
  for (let y = horizon + 6; y < height; y += 11) {
    for (let x = (y * 17) % 53; x < width; x += 53) {
      g.rect(x, y, 4, 1);
      g.rect(x + 3, y + 1, 3, 1);
    }
  }
  g.fill({ color: 0xffa860 });
  pads(g, width, height, [0x5e3c46, 0x77505a, 0x8e6670]);
  const p = platforms(width, height);
  g.rect(p.ally.x - 30, p.ally.y + 4, 8, 1);
  g.rect(p.ally.x + 20, p.ally.y + 8, 6, 1);
  g.rect(p.foe.x - 18, p.foe.y + 5, 6, 1);
  g.fill({ color: 0xff9a50 });
}

// ------------------------------------------------------------------ frozen: Aurora pines

function frozen(g: Painter, width: number, height: number): void {
  const horizon = horizonOf(width, height);
  sky(g, width, horizon, [0x2c4a76, 0x3c6490, 0x5886aa, 0x88b2ca]);
  // Aurora ribbons: a solid top edge with a dithered curtain below.
  for (const [base, amp, color, ph] of [
    [26, 9, 0x7fe8c0, 0],
    [40, 7, 0xa8a0f0, 2],
  ] as const) {
    for (let x = 0; x < width; x++) {
      const y = Math.round(base + amp * Math.sin(x / 33 + ph) + 3 * Math.sin(x / 9));
      const len = 4 + Math.round(3 * Math.sin(x / 21 + ph));
      for (let k = 0; k < len; k++) if (k < 2 || (x + k) % 2 === 0) g.rect(x, y + k, 1, 1);
    }
    g.fill({ color });
  }
  // Stars.
  for (let i = 0; i < Math.round(width / 12); i++) g.rect((i * 97) % width, (i * 37) % 60, 1, 1);
  g.fill({ color: 0xffffff });
  // Far snowy hills, then the pine line with snow on the tips.
  ridge(
    g,
    width,
    horizon,
    (x) => horizon - 34 + Math.round(12 * Math.sin(x / 53) + 5 * Math.sin(x / 17)),
    0x9cb8cf,
  );
  const pine = (x: number): { y: number; t: number } => {
    const t = (x % 11) - 5;
    const tall = 18 + (Math.floor(x / 11) % 3) * 4;
    return { y: horizon - Math.round(tall - Math.abs(t) * 2.6), t };
  };
  ridge(g, width, horizon, (x) => pine(x).y, 0x3e6a76);
  for (let x = 0; x < width; x++) {
    const { y, t } = pine(x);
    if (Math.abs(t) < 4) g.rect(x, y, 1, 2);
  }
  g.fill({ color: 0xeaf3fa });
  ground(g, width, height, horizon, [0xe4eef7, 0xd8e6f2, 0xcadcec], 0xa9c3dc);
  for (let y = horizon + 5; y < height; y += 7) {
    for (let x = (y * 11) % 37; x < width; x += 37) g.rect(x, y, 1, 1);
  }
  g.fill({ color: 0xffffff });
  pads(g, width, height, [0x8eb0cf, 0xb4cfe6, 0xd8e8f5]);
}
