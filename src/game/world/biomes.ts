/**
 * The three launch biomes' tile look: color ramps per material (dark → light), the liquid
 * kind, small ground details and default weather. Style "A · Storybook bright" (chosen
 * 2026-11-12, C11 preview round): light, friendly colors matching the paper UI, outlines
 * tinted from each object's own darkest tone, soft dithered shading.
 *
 * Interim home: when C19 adds biome data to packs, these definitions move to `packs/core`.
 */

import type { WeatherId } from './weather';

export const TILE = 16;

export type BiomeId = 'forest' | 'desert' | 'frozen';
export const BIOME_IDS: readonly BiomeId[] = ['forest', 'desert', 'frozen'];

/** Materials every biome provides a ramp for. */
export type Material =
  'ground' | 'alt' | 'path' | 'bank' | 'liquid' | 'tall' | 'foliage' | 'wood' | 'rock' | 'accent';

export interface Biome {
  readonly id: BiomeId;
  readonly label: string;
  /** Water ripples with foam, or flowing lava with a dark crust. */
  readonly liquid: 'water' | 'lava';
  readonly weather: WeatherId;
  /** Color ramps, dark → light. */
  readonly ramps: Readonly<Record<Material, readonly number[]>>;
  /** Shore foam (water) or hot sparks (lava). */
  readonly foam: number;
  /** Flower colors scattered on the ground (forest). */
  readonly flowers: readonly number[];
  /** Ground details: sparkles on snow, shine streaks on ice, pits in basalt. */
  readonly details: {
    readonly sparkle?: number;
    readonly iceStreaks?: boolean;
    readonly altPits?: number;
  };
}

/** Shared settings of the storybook tile style. */
export const TILE_STYLE = {
  /** Dither band width (`rampIndex` sharpness): narrow bands at tone edges. */
  sharpness: 3,
  /** Outlines: each material's darkest tone mixed this far toward `outlineInk`. */
  outlineInk: 0x10131f,
  outlineMix: 0.45,
  /** Light taken away under props (soft, palette-safe shadows). */
  shadow: 0.3,
  /** Light taken away on tall-grass tiles. */
  tallShade: 0.18,
} as const;

export const BIOMES: Readonly<Record<BiomeId, Biome>> = {
  forest: {
    id: 'forest',
    label: 'Forest & lakes',
    liquid: 'water',
    weather: 'rain',
    ramps: {
      ground: [0x5a9e48, 0x6fb556, 0x84c862, 0x9ad877],
      alt: [0x4b8f45, 0x5ea34e, 0x72b75a, 0x88c96a],
      path: [0xa98154, 0xc49c6a, 0xdcb986, 0xecd2a4],
      bank: [0xb9a26c, 0xd2bf8a, 0xe6d6a6],
      liquid: [0x2a66b8, 0x3a82d4, 0x56a2ea, 0x9ad6f8],
      tall: [0x2f7a36, 0x4a9a44, 0x6cba56, 0x9ad874],
      foliage: [0x2a6e3a, 0x3c8a46, 0x56a654, 0x78c266, 0xa2dc84],
      wood: [0x5a3a24, 0x76502f, 0x93683f],
      rock: [0x666c7a, 0x878e9a, 0xa8afb8, 0xcfd4da],
      accent: [0x2f7a3a, 0x4a9a48, 0x6ebc5c],
    },
    foam: 0xeaf7ff,
    flowers: [0xff7f98, 0xffd23f, 0xfdfdf6, 0xb79cff],
    details: {},
  },
  desert: {
    id: 'desert',
    label: 'Volcanic desert',
    liquid: 'lava',
    weather: 'ash',
    ramps: {
      ground: [0xc2804a, 0xd6985e, 0xe6b076, 0xf2c994],
      alt: [0x34282e, 0x4a3a3e, 0x605054, 0x786466],
      path: [0x8e5236, 0xa86644, 0xbe7c56, 0xd2966c],
      bank: [0x1e161c, 0x33252a, 0x4e342e],
      liquid: [0x9a1e16, 0xd8461c, 0xff8228, 0xffc84a],
      tall: [0x8a6a32, 0xa88844, 0xc6a65a, 0xe2c67c],
      foliage: [0x335f34, 0x467c40, 0x5e9a4c, 0x7eb664, 0xa2d082],
      wood: [0x4e3426, 0x6e4e38, 0x8e6e50],
      rock: [0x3e3034, 0x5a484a, 0x7a6662, 0x9c8680],
      accent: [0x7a1e14, 0xc8461e, 0xff8c3a, 0xffd88a],
    },
    foam: 0xfff1a8,
    flowers: [],
    details: { altPits: 0.05 },
  },
  frozen: {
    id: 'frozen',
    label: 'Frozen coast',
    liquid: 'water',
    weather: 'snow',
    ramps: {
      ground: [0xaabbd6, 0xc2d0e6, 0xd9e3f2, 0xf2f6fe],
      alt: [0x72aed2, 0x92c6e2, 0xb6dcf0, 0xdff3ff],
      path: [0x7a8498, 0x96a0b2, 0xb0b9c8, 0xc8d0dc],
      bank: [0x3c4558, 0x525d72, 0x6c788e],
      liquid: [0x13325e, 0x1b4b84, 0x2a6aa8, 0x68a8da],
      tall: [0x4e6a7a, 0x6c8a9a, 0x92b0be, 0xcbe2ec],
      foliage: [0x173f3c, 0x225650, 0x2f6e62, 0x438a78, 0x5ea492],
      wood: [0x40322e, 0x56443a, 0x6e584a],
      rock: [0x4e5464, 0x687080, 0x868e9e, 0xa8b0c0],
      accent: [0x3a8cc0, 0x6cc4ea, 0xb4ecff, 0xffffff],
    },
    foam: 0xf2fbff,
    flowers: [],
    details: { sparkle: 0.006, iceStreaks: true },
  },
};
