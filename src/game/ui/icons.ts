/**
 * Pixel icons as bitmaps (`/`-separated rows, `.` = empty), drawn with `pixelBitmap`.
 * Single-ink icons use `#`; multi-color sprites use the characters listed with them.
 *
 * Type and condition icons are keyed by the core ids (like their colors in the tokens).
 */

import type { ConditionId, TypeId } from '../style/tokens';

/** 7×7 type glyphs, drawn in the type's `on` color on the type color. */
export const TYPE_ICONS: Readonly<Record<TypeId, string>> = {
  fire: '...#.../..##.../..###../.#####./.##.##./.#...#./..###..',
  water: '...#.../..###../..###../.#####./.##.##./.#####./..###..',
  nature: '....###/..#####/.####.#/.###.##/.##.###/.#.###./#......',
  electric: '...###./..###../.###.../######./...###./..###../.##....',
  ice: '...#.../.#.#.#./..###../#######/..###../.#.#.#./...#...',
  earth: '...#.../..###../..####./.######/##.####/#######/.......',
  wind: '.####../#....#./....##./#####.#/......#/.####../#......',
  metal: '..###../.#####./##...##/##...##/##...##/.#####./..###..',
};

/** 7×7 condition glyphs, drawn in the condition's `on` color on the condition color. */
export const CONDITION_ICONS: Readonly<Record<ConditionId, string>> = {
  // Flame with a hot core.
  burning: '..#..#./.##.##./.######/#######/###.###/##...##/.##.##.',
  // Drop with a splash.
  wet: '...#.../..###../.#####./.##.##./.#####./..###../#.....#',
  // Sprout: two leaves on a stem.
  overgrown: '##...##/###.###/.##.##./...#.../...#.../.#####./.......',
  // Bolt with sparks.
  charged: '#...##./...##../..##..#/.######/..##.../.##..../##...#.',
  // Snowflake.
  chilled: '#.....#/.#.#.#./..###../.#####./..###../.#.#.#./#.....#',
  // Mud splat.
  muddy: '...#.../.#####./#######/.######/######./.#..##./.......',
  // Up arrow over a gust.
  airborne: '...#.../..###../.#.#.#./...#.../......./##.##.#/.##.##.',
  // Cracked shield.
  exposed: '#######/###.###/##.####/###.###/.##.##./..###../...#...',
};

/** Palette characters for item sprites: o outline, a main, b light, c dark, w white, g band. */
export interface ItemPalette {
  readonly o: number;
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly w: number;
  readonly g: number;
}

/** 12×12 item sprites. */
export const ITEM_SPRITES = {
  potion: [
    '....oooo....',
    '....owwo....',
    '.....oo.....',
    '....obbo....',
    '...obbbbo...',
    '..obaaaabo..',
    '..oaaaaaao..',
    '..oaaaaaco..',
    '..oaaaaaco..',
    '..oaacccco..',
    '...occcco...',
    '....oooo....',
  ].join('/'),
  orb: [
    '....oooo....',
    '..oobbbboo..',
    '.obbwbbbbbo.',
    '.obwbbbbbbo.',
    'obbbbbbbbbbo',
    'ooooogggoooo',
    'ooooogwgoooo',
    'oaaaagggaaao',
    '.oaaaaaaaco.',
    '.oaaaaaacco.',
    '..ooaccaoo..',
    '....oooo....',
  ].join('/'),
} as const;

export type ItemSprite = keyof typeof ITEM_SPRITES;

/** 7×8 coin (palette: a main, b light, c dark). */
export const COIN = '..ccc../.cbbac./cbbaaac/cbacaac/cbacaac/caaaaac/.caaac./..ccc..';
