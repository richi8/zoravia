/**
 * Overworld character sprites (C20): 16×24 pixel art drawn from small run-length row
 * templates in code, then outlined in navy. Chosen at the C20 preview rounds (2026-11-12),
 * after the user's reference sheet: big round hair with a dithered crown and side-swept
 * fringe, plain 2×2 eyes, a flat side profile (no nose), a jacket with gold trim and a
 * satchel.
 *
 * Every facing has one fixed head and torso, so the face never changes between frames; only
 * the legs and arms move, and the body dips one pixel on step frames. Colors come from an
 * `Outfit`, so NPCs can reuse the same body. Pure: no DOM.
 */

import { packColor } from '@engine/render/pixel-buffer';
import type { Dir } from './mover';

export const CHARACTER_W = 16;
export const CHARACTER_H = 24;
/** Walk cycle length in frames: stand, step, stand, step (other leg). */
export const WALK_FRAMES = 4;

export interface Outfit {
  readonly hair: number;
  readonly hairShade: number;
  readonly hairShine: number;
  readonly skin: number;
  readonly eye: number;
  readonly jacket: number;
  readonly jacketShade: number;
  readonly trim: number;
  readonly trimShade: number;
  readonly pants: number;
  readonly boots: number;
  readonly bag: number;
  readonly strap: number;
  readonly outline: number;
}

/** The player: teal jacket with gold trim, teal pants (the reference colors). */
export const PLAYER_OUTFIT: Outfit = {
  hair: 0x443432,
  hairShade: 0x2a1e26,
  hairShine: 0x5e4a44,
  skin: 0xf2c496,
  eye: 0x0e0c26,
  jacket: 0x1a5260,
  jacketShade: 0x123a46,
  trim: 0xe8a232,
  trimShade: 0xb07028,
  pants: 0x1e8a80,
  boots: 0x6a402a,
  bag: 0x8a5a34,
  strap: 0x5a3622,
  outline: 0x0e0c26,
};

/** Packed RGBA pixels (0 = transparent), row-major. */
export interface CharacterFrame {
  readonly width: number;
  readonly height: number;
  readonly data: Uint32Array;
}

export type CharacterSheet = Readonly<Record<Dir, readonly CharacterFrame[]>>;

/** Run-length row: `"6. 8h"` = 6 empty, 8 hair. Padded with empties to the sprite width. */
function row(spec: string): string {
  let r = '';
  for (const t of spec.trim().split(/\s+/)) r += t.slice(-1).repeat(Number(t.slice(0, -1)));
  if (r.length > CHARACTER_W) throw new Error(`Sprite row too long: "${spec}"`);
  return r.padEnd(CHARACTER_W, '.');
}
const rows = (list: readonly string[]): string[] => list.map(row);

// h hair · H hair shade · s skin · e eye · j jacket · J jacket shade · g trim · G trim shade
// p pants · b boots
type Facing = 'down' | 'up' | 'right';

const HEAD: Readonly<Record<Facing, readonly string[]>> = {
  down: rows([
    '5. 6h',
    '3. 10h',
    '2. 12h',
    '1. 14h',
    '1. 9h 1s 4h',
    '1. 3h 9s 2h',
    '1. 2h 1s 2e 4s 2e 1s 2h',
    '1. 1H 1h 1s 2e 4s 2e 1s 1h 1H',
    '2. 1H 10s 1H',
    '3. 10s',
    '4. 8s',
  ]),
  up: rows([
    '5. 6h',
    '3. 10h',
    '2. 12h',
    '1. 14h',
    '1. 14h',
    '1. 14h',
    '1. 14h',
    '1. 14h',
    '1. 1H 12h 1H',
    '2. 2H 8h 2H',
    '4. 3H 2s 3H',
  ]),
  right: rows([
    '4. 7h',
    '2. 11h',
    '1. 13h',
    '1. 14h',
    '1. 11h 1s 2h',
    '1. 7h 6s 1h',
    '1. 6h 3s 2e 2s',
    '1. 1H 5h 3s 2e 2s',
    '2. 1H 4h 7s',
    '3. 2H 1h 7s',
    '6. 6s',
  ]),
};

const FRONT = rows([
  '5. 6g',
  '3. 1g 2j 1g 2s 1g 2j 1g',
  '2. 1g 4j 1g 1j 4j 1g',
  '2. 1j 1J 3j 1g 1G 3j 1J 1j',
  '2. 1j 1J 8g 1J 1j',
  '2. 2g 8p 2g',
  '2. 2s 8p 2s',
]);
const BACK = rows([
  '5. 6g',
  '3. 1g 8j 1g',
  '2. 1g 10j 1g',
  '2. 1j 1J 8j 1J 1j',
  '2. 1j 1J 8g 1J 1j',
  '2. 2g 8p 2g',
  '2. 2s 8p 2s',
]);
const LEGS = {
  stand: rows(['4. 3p 2. 3p', '4. 3p 2. 3p', '4. 3b 2. 3b']),
  step: rows(['4. 3p 2. 3p', '4. 3b 2. 3p', '9. 3b']),
};
/** Side view (facing right): torso rows then leg rows. */
const SIDE = {
  stand: rows([
    '5. 5g',
    '4. 1g 6j 1g',
    '4. 7j 1g',
    '4. 2j 2J 3j 1g',
    '4. 2g 2J 4g',
    '5. 1p 2g 3p',
    '5. 1p 2s 3p',
    '6. 4p',
    '6. 4p',
    '6. 5b',
  ]),
  forward: rows([
    '5. 5g',
    '4. 1g 6j 1g',
    '4. 7j 1g',
    '4. 4j 2J 1j 1g',
    '4. 4g 2J 2g',
    '5. 4p 2g',
    '5. 4p 2s',
    '5. 2p 2. 2p',
    '4. 2p 4. 2p',
    '3. 3b 4. 3b',
  ]),
  back: rows([
    '5. 5g',
    '4. 1g 6j 1g',
    '4. 7j 1g',
    '3. 2J 6j 1g',
    '3. 2J 6g',
    '2. 2g 1. 6p',
    '2. 2s 1. 6p',
    '5. 2p 2. 2p',
    '4. 2p 4. 2p',
    '3. 3b 4. 3b',
  ]),
};
const TORSO_ROWS = 7;
/** Hair shine pixels per facing, relative to the head's top-left. */
const SHINE: Readonly<Record<Facing, readonly (readonly [number, number])[]>> = {
  down: [
    [4, 2],
    [5, 2],
    [6, 1],
    [11, 3],
  ],
  right: [
    [7, 2],
    [8, 2],
    [9, 1],
    [12, 3],
  ],
  up: [
    [6, 5],
    [7, 4],
    [10, 5],
  ],
};
const HEAD_Y = 1;
const TORSO_Y = 12;

/** Builds one frame as 0xRRGGBB values (0 = empty) before outlining. */
function drawFrame(o: Outfit, dir: Dir, frame: number): number[][] {
  const W = CHARACTER_W;
  const H = CHARACTER_H;
  const g: number[][] = Array.from({ length: H }, () => new Array<number>(W).fill(0));
  const pal: Readonly<Record<string, number>> = {
    h: o.hair,
    H: o.hairShade,
    s: o.skin,
    e: o.eye,
    j: o.jacket,
    J: o.jacketShade,
    g: o.trim,
    G: o.trimShade,
    p: o.pants,
    b: o.boots,
  };
  const set = (x: number, y: number, c: number): void => {
    const r = g[y];
    if (r && x >= 0 && x < W) r[x] = c;
  };
  const at = (x: number, y: number): number => g[y]?.[x] ?? 0;
  const put = (list: readonly string[], y0: number, flip = false): void => {
    list.forEach((line, j) => {
      for (let i = 0; i < line.length; i++) {
        const ch = line[i] ?? '.';
        if (ch !== '.') set(flip ? W - 1 - i : i, y0 + j, pal[ch] ?? 0);
      }
    });
  };
  const mirror = dir === 'left';
  const face: Facing = dir === 'left' ? 'right' : dir;
  const step = frame % 2 === 1;
  const bob = step ? 1 : 0;
  const ty = TORSO_Y + bob;

  if (face === 'right') {
    // Bag behind the hip, then legs, then torso (the dip hides the top leg row).
    for (let y = 0; y < 3; y++)
      for (let x = 2; x < 5; x++) set(x, ty + 4 + y, y === 0 ? o.strap : o.bag);
    const body = frame === 1 ? SIDE.forward : frame === 3 ? SIDE.back : SIDE.stand;
    put(body.slice(TORSO_ROWS), TORSO_Y + TORSO_ROWS);
    put(body.slice(0, TORSO_ROWS), ty);
    for (let k = 0; k < 4; k++) {
      const x = 10 - k;
      const y = ty + 1 + k;
      if (at(x, y) === o.jacket || at(x, y) === o.trim) set(x, y, o.strap);
    }
  } else {
    put(step ? LEGS.step : LEGS.stand, TORSO_Y + TORSO_ROWS, frame === 3);
    put(face === 'down' ? FRONT : BACK, ty);
    if (step) {
      // Arm swing: the arm opposite the stepping leg reaches one pixel lower.
      const right = (frame === 1) !== (face === 'up');
      for (const x of right ? [12, 13] : [2, 3]) {
        set(x, ty + 5, o.jacket);
        set(x, ty + 6, o.trim);
        set(x, ty + 7, o.skin);
      }
    }
    if (face === 'up') {
      for (let k = 0; k < 4; k++) {
        const x = 11 - k;
        const y = ty + 1 + k;
        const c = at(x, y);
        if (c === o.jacket || c === o.jacketShade || c === o.trim) set(x, y, o.strap);
      }
      for (let y = 0; y < 3; y++)
        for (let x = 3; x < 7; x++) set(x, ty + 4 + y, y === 0 ? o.strap : o.bag);
    }
  }

  const hy = HEAD_Y + bob;
  put(HEAD[face], hy);
  // Dithered crown and a soft shine: the same pixels in every frame of a facing.
  for (let y = 0; y < 3; y++)
    for (let x = 0; x < W; x++)
      if (at(x, hy + y) === o.hair && (x + y) % 2 === 0 && (y < 2 || x % 3 === 0))
        set(x, hy + y, o.hairShade);
  for (const [x, y] of SHINE[face]) set(x, hy + y, o.hairShine);
  if (face === 'down') {
    set(8, hy + 4, o.hairShade);
    set(3, hy + 5, o.hairShade);
  }
  if (mirror) for (const r of g) r.reverse();
  return g;
}

/** One frame with its navy outline, packed. */
export function buildCharacterFrame(o: Outfit, dir: Dir, frame: number): CharacterFrame {
  const g = drawFrame(o, dir, frame);
  const W = CHARACTER_W;
  const H = CHARACTER_H;
  const data = new Uint32Array(W * H);
  const outline = packColor(o.outline);
  const filled = (x: number, y: number): boolean => (g[y]?.[x] ?? 0) !== 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = g[y]?.[x] ?? 0;
      if (c) data[y * W + x] = packColor(c);
      else if (filled(x + 1, y) || filled(x - 1, y) || filled(x, y + 1) || filled(x, y - 1))
        data[y * W + x] = outline;
    }
  }
  return { width: W, height: H, data };
}

/** All four facings × `WALK_FRAMES` frames for an outfit. */
export function buildCharacterSheet(o: Outfit): CharacterSheet {
  const frames = (dir: Dir): CharacterFrame[] =>
    Array.from({ length: WALK_FRAMES }, (_, f) => buildCharacterFrame(o, dir, f));
  return { down: frames('down'), up: frames('up'), left: frames('left'), right: frames('right') };
}

/**
 * Walk-cycle frame for a distance walked (tiles): two frames per tile, starting on a step
 * so a single tile shows one stride. Standing always shows frame 0.
 */
export function walkFrame(walked: number, moving: boolean): number {
  if (!moving) return 0;
  return (Math.floor(walked * 2) + 1) % WALK_FRAMES;
}
