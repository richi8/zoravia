/**
 * Outfit palettes for overworld characters (C21). NPCs reuse the player's body (C20) in
 * other colors. Jacket/pants/trim sets are the color variants from the C20 preview rounds;
 * hair and skin vary on top. Pure data: no DOM.
 */

import { PLAYER_OUTFIT, type Outfit } from './character-sprite';

/** Jacket · pants · trim sets (the C20 preview variants). `teal` is the player's. */
export const OUTFIT_IDS = [
  'teal',
  'white',
  'red',
  'navy',
  'forest',
  'mustard',
  'black',
  'sky',
  'purple',
  'orange',
  'mono',
  'maroon',
] as const;
export type OutfitId = (typeof OUTFIT_IDS)[number];

export const HAIR_IDS = ['brown', 'dark', 'blonde', 'red', 'grey'] as const;
export type HairId = (typeof HAIR_IDS)[number];

export const SKIN_IDS = ['light', 'warm', 'tan', 'deep'] as const;
export type SkinId = (typeof SKIN_IDS)[number];

/** [jacket, jacket shade, pants, trim] */
const CLOTHES: Readonly<Record<OutfitId, readonly [number, number, number, number]>> = {
  teal: [PLAYER_OUTFIT.jacket, PLAYER_OUTFIT.jacketShade, PLAYER_OUTFIT.pants, PLAYER_OUTFIT.trim],
  white: [0xf4f2ec, 0xc4c8d4, 0x2f5bb8, 0xe8a232],
  red: [0xc8323a, 0x92222c, 0x2f5bb8, 0xe8a232],
  navy: [0x23315e, 0x18213f, 0xc29a64, 0xe8a232],
  forest: [0x2f6e3a, 0x214e29, 0x6e4a32, 0xe8c25a],
  mustard: [0xe0a826, 0xb0801a, 0x26365e, 0xf6efe0],
  black: [0x2a2a34, 0x1a1a22, 0x7a7e8a, 0xe8a232],
  sky: [0x5aa8e8, 0x3c80c0, 0xeceae4, 0xf0c050],
  purple: [0x6a3aa0, 0x4c2878, 0x3a3c48, 0xe8a232],
  orange: [0xf07a26, 0xc0581a, 0x26365e, 0xf6efe0],
  mono: [0xf4f2ec, 0xc4c8d4, 0x2a2a34, 0xd8403a],
  maroon: [0x7e2232, 0x5a1824, 0xb8a070, 0xe8c25a],
};

/** [hair, shade, shine] */
const HAIR: Readonly<Record<HairId, readonly [number, number, number]>> = {
  brown: [PLAYER_OUTFIT.hair, PLAYER_OUTFIT.hairShade, PLAYER_OUTFIT.hairShine],
  dark: [0x24202e, 0x14121c, 0x3a3446],
  blonde: [0xe0b85a, 0xb08838, 0xf2d684],
  red: [0xb4502c, 0x7e3420, 0xd2744a],
  grey: [0xb4b0b4, 0x84808a, 0xd8d4d6],
};

const SKIN: Readonly<Record<SkinId, number>> = {
  light: 0xf6d2b0,
  warm: PLAYER_OUTFIT.skin,
  tan: 0xd09a6a,
  deep: 0x8e5a3a,
};

function shade(c: number, k = 0.72): number {
  const r = Math.round(((c >> 16) & 255) * k);
  const g = Math.round(((c >> 8) & 255) * k);
  const b = Math.round((c & 255) * k);
  return (r << 16) | (g << 8) | b;
}

export interface OutfitSpec {
  readonly outfit: OutfitId;
  readonly hair: HairId;
  readonly skin: SkinId;
}

/** Full sprite palette for an outfit, hair and skin. */
export function outfitOf(spec: OutfitSpec): Outfit {
  const [jacket, jacketShade, pants, trim] = CLOTHES[spec.outfit];
  const [hair, hairShade, hairShine] = HAIR[spec.hair];
  return {
    ...PLAYER_OUTFIT,
    hair,
    hairShade,
    hairShine,
    skin: SKIN[spec.skin],
    jacket,
    jacketShade,
    pants,
    trim,
    trimShade: spec.outfit === 'teal' ? PLAYER_OUTFIT.trimShade : shade(trim),
  };
}
