/**
 * Zorling palettes: a few base colors per genome (type-driven), expanded into pixel-art ramps
 * (highlight, base, shade, deep shade + outline) with hue shifting — highlights lean warm,
 * shadows lean cool — the classic pixel-art way to keep shading lively.
 */

import type { Rng } from '@engine/core';
import { fromHsl, mix, rotateHueToward, toHsl } from '@engine/core/color';
import type { Ramp } from '@engine/render/sdf-sprite';
import { z } from 'zod';
import { ink, typeColors, type TypeId } from '../style/tokens';
import type { BodyPlan, Mood } from './genome';

export interface ZorlingPalette {
  /** Main body color. */
  readonly primary: number;
  /** Markings, wings, tail tips, fins. */
  readonly secondary: number;
  /** Belly / underside / muzzle. */
  readonly belly: number;
  /** Horns, claws, spikes, beaks. */
  readonly accent: number;
  /** Iris color for big eyes. */
  readonly eye: number;
}

const color = z.number().int().min(0).max(0xffffff);
export const zorlingPaletteSchema = z.object({
  primary: color,
  secondary: color,
  belly: color,
  accent: color,
  eye: color,
}) satisfies z.ZodType<ZorlingPalette>;

/** Secondary color candidates per type. */
const SECONDARY: { readonly [T in TypeId]: readonly number[] } = {
  fire: [0xffd23f, 0xffe6b0, 0x5a2f2a, 0xd8342a],
  water: [0xbfe9ff, 0x24479c, 0xf2fbff, 0x3fcfbe],
  nature: [0xff8fb1, 0x8a5a3a, 0xd8f080, 0xffd23f],
  electric: [0x2f2c40, 0xfff7d6, 0x4f8fff, 0xff9a3d],
  ice: [0xf4fdff, 0x3d6fd8, 0xb8a8ff, 0x5ad0e0],
  earth: [0x6a5444, 0xead2a2, 0x9ba1aa, 0x6e9450],
  wind: [0xf6f4ff, 0x7fd0ff, 0xffc0e0, 0x5a4fa0],
  metal: [0x3a4258, 0x4fd8ff, 0xe0b040, 0xc85050],
};

/** Accent (horn/claw/beak) candidates per type. */
const ACCENT: { readonly [T in TypeId]: readonly number[] } = {
  fire: [0xffd23f, 0xf0e2c0, 0x3a2a30],
  water: [0xf0e2c0, 0xffe27a, 0x8fe3f5],
  nature: [0xf0e2c0, 0x8a5a3a, 0xffd23f],
  electric: [0xffd23f, 0x3a3050, 0xf0e2c0],
  ice: [0xe8fbff, 0x8fe3f5, 0xb8a8ff],
  earth: [0xf0e2c0, 0x6a5444, 0xa8b0b8],
  wind: [0xffd23f, 0xf0e2c0, 0xffa53d],
  metal: [0x4fd8ff, 0xe0b040, 0xd6dde8],
};

const EYES = [ink[950], ink[950], 0x2a3f8f, 0x7a2f1a, 0x1f6b4a] as const;

const CREAM = 0xfff3dc;

/** Bright glow per type: eyes and accents of dark Zorlings. */
const GLOW: { readonly [T in TypeId]: number } = {
  fire: 0xffb02e,
  water: 0x4fe8ff,
  nature: 0xb6ff5a,
  electric: 0xfff04a,
  ice: 0xc8f8ff,
  earth: 0xffc24a,
  wind: 0xe0c8ff,
  metal: 0xff4a5a,
};

/** The bright glow color of a type (dark Zorlings' eyes, Titan auras). */
export function glowColor(type: TypeId): number {
  return GLOW[type];
}

/** Rolls a palette from the type colors in `tokens.ts`, shaped by mood and body plan. */
export function generatePalette(
  rng: Rng,
  types: readonly TypeId[],
  mood: Mood = 'cute',
  plan?: BodyPlan,
): ZorlingPalette {
  const [t1 = 'fire', t2] = types;
  const p = toHsl(typeColors[t1].base);
  const hue = p.h + rng.float(-12, 12);
  let sat = Math.min(1, p.s * rng.float(0.72, 1.05));
  let light = Math.min(0.72, Math.max(0.36, p.l + rng.float(-0.1, 0.06)));
  if (mood === 'fierce') {
    sat = Math.min(1, sat * 1.05);
    light = Math.max(0.3, light - 0.08);
  }
  if (mood === 'dark') {
    sat *= rng.float(0.3, 0.6);
    light = rng.float(0.17, 0.27);
  }
  if (plan === 'golem') {
    sat *= 0.3;
    if (mood !== 'dark') light = rng.float(0.42, 0.55);
  }
  const primary = fromHsl({ h: hue, s: sat, l: light });
  const glow = GLOW[t2 && rng.chance(0.3) ? t2 : t1];
  let secondary =
    t2 && rng.chance(0.75)
      ? jitter(typeColors[t2].base, rng)
      : jitter(rng.pick(SECONDARY[t1]), rng);
  let accent = rng.pick(ACCENT[t2 && rng.chance(0.4) ? t2 : t1]);
  let belly = mix(primary, CREAM, rng.float(0.55, 0.75));
  let eye: number = rng.pick(EYES);
  if (mood === 'dark') {
    // Near-black body, deep secondary, glowing accents and eyes.
    const sh = toHsl(secondary);
    secondary = fromHsl({ h: sh.h, s: Math.min(1, sh.s * 0.7), l: Math.min(sh.l, 0.32) });
    accent = rng.chance(0.6) ? glow : 0xd8d4e8;
    belly = mix(primary, glow, 0.18);
    eye = glow;
  } else if (mood === 'fierce') {
    eye = rng.pick([0xffc22e, 0xff5a3a, 0x9cff3a, eye]);
  }
  if (plan === 'golem') accent = glow;
  return { primary, secondary, belly, accent, eye };
}

function jitter(c: number, rng: Rng): number {
  const h = toHsl(c);
  return fromHsl({ h: h.h + rng.float(-8, 8), s: h.s, l: h.l + rng.float(-0.05, 0.05) });
}

/** Expands one base color into a 4-tone ramp (light → dark) with a dark, tinted outline. */
export function makeRamp(base: number): Ramp {
  const { h, s, l } = toHsl(base);
  const light = fromHsl({
    h: rotateHueToward(h, 55, 10),
    s: Math.min(1, s * 1.02),
    l: Math.min(0.94, l + 0.13),
  });
  const shade = fromHsl({
    h: rotateHueToward(h, 250, 14),
    s: Math.min(1, s * 1.05 + 0.04),
    l: Math.max(0.12, l - 0.14),
  });
  const deep = fromHsl({
    h: rotateHueToward(h, 255, 24),
    s: Math.min(1, s * 0.95 + 0.05),
    l: Math.max(0.09, l - 0.27),
  });
  const outline = fromHsl({ h: rotateHueToward(h, 250, 30), s: Math.min(0.55, s * 0.6), l: 0.1 });
  return { tones: [light, base, shade, deep], outline };
}

/** Fixed ramps shared by all Zorlings. */
export const FIXED = {
  /** Eye whites, glints, fangs. */
  white: { tones: [0xffffff, 0xffffff, 0xd6dcf0, 0xa9b0cc], outline: ink[950] } satisfies Ramp,
  /** Pupils, mouths, noses. */
  dark: { tones: [0x3a3f5c, ink[900], ink[950], ink[950]], outline: ink[950] } satisfies Ramp,
  /** Flame tails: always bright, whatever the body colors. */
  flame: makeRamp(0xff7a2a),
  flameCore: { tones: [0xfff6c2, 0xffe27a, 0xffc94a, 0xffa53d], outline: 0x5a1f0a } satisfies Ramp,
  /** Frost tips, rime and icicles. */
  frost: { tones: [0xffffff, 0xe6f6ff, 0xb8dcf2, 0x86b4d8], outline: 0x1d3a5c } satisfies Ramp,
  /** Tusks. */
  ivory: { tones: [0xfffbea, 0xf2e6c4, 0xd6c49a, 0xb09a70], outline: 0x3a2a1a } satisfies Ramp,
} as const;
