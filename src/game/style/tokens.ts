/**
 * Zoravia design tokens — the single source of truth for the game's look.
 *
 * Colors are `0xRRGGBB` numbers (Pixi-ready; `toCss` for the DOM). Durations are seconds.
 * The Pixi UI theme (`createUiTheme`), the lab's CSS variables (`tokensToCssVars`) and the
 * logo are all derived from this file — change a value here and everything follows.
 *
 * Type and condition colors are keyed by the core pack's ids (types/conditions arrive as
 * data in C12; they reference these colors by id).
 */

import type { EasingName } from '@engine/core';

/**
 * Minimum game screen in game pixels (DESIGN.md "Presentation"). The game renders at the
 * largest whole-number scale that keeps at least this much visible and fills the rest of the
 * window with more game pixels (e.g. 480×300 on a 16:10 window at ×3).
 */
export const SCREEN = { width: 480, height: 270 } as const;

/** Neutral scale: cool indigo "night sky". 950 = darkest. */
export const ink = {
  950: 0x0d0f1f,
  900: 0x14172e,
  800: 0x1d2142,
  700: 0x282d57,
  600: 0x3a406f,
  500: 0x555c8a,
  400: 0x7a81aa,
  300: 0xa3a9c8,
  200: 0xcbcee3,
  100: 0xe6e8f3,
  50: 0xf5f6fb,
} as const;

/** Brand colors. */
export const brand = {
  /** Lagoon teal — primary, interactive. */
  lagoon: 0x2ec4b6,
  lagoonDeep: 0x167069,
  /** Sunbeam gold — accent, titles, highlights. */
  sunbeam: 0xffc94a,
  /** Ember coral — secondary warm accent. */
  ember: 0xff7a59,
  /** Logo gradient stops (top → bottom). */
  logoTop: 0xffe27a,
  logoBottom: 0xff8a4c,
} as const;

/**
 * Logo palette (dragon crest). It is also the fixed palette of the logo's pixel-art version,
 * so every pixel snaps to one of these.
 */
export const logoColors = {
  navy: 0x141a3c,
  rustLight: 0xe8842c,
  rust: 0xc9541c,
  rustDark: 0x8e3512,
  tealLight: 0x3cc4ae,
  teal: 0x1f9a8a,
  tealDark: 0x14705f,
  goldLight: 0xf3cc55,
  gold: 0xe0aa22,
  goldDark: 0x9a6a10,
  cream: 0xf3dcb0,
  white: 0xffffff,
} as const;

/** Meaning-carrying colors. Never rely on color alone — pair with text/icons. */
export const semantic = {
  success: 0x5bd17d,
  warning: 0xffc94a,
  danger: 0xff5c6c,
  info: 0x5ab0ff,
  hpHigh: 0x5bd17d,
  hpMid: 0xffc94a,
  hpLow: 0xff5c6c,
  xp: 0x5ab0ff,
  shiny: 0xffe27a,
  /** Titan mark glow / boss aura. */
  titan: 0xffa53d,
  bossAura: 0xff4f7b,
  /** Reaction callouts ("Wildfire!"). */
  reaction: 0xffe27a,
} as const;

/** Dark UI surfaces (the game UI is dark). */
export const surface = {
  background: ink[950],
  base: ink[900],
  raised: ink[800],
  overlay: ink[700],
  border: ink[600],
  borderStrong: ink[500],
  text: ink[50],
  textDim: ink[300],
  textDisabled: ink[500],
  cursorBg: brand.lagoonDeep,
  cursorText: 0xffffff,
  focusRing: brand.lagoon,
} as const;

/** Light surfaces — for the light logo variant and any light-background presentation. */
export const lightSurface = {
  background: ink[50],
  base: 0xffffff,
  border: ink[200],
  text: ink[900],
  textDim: ink[600],
} as const;

export const TYPE_IDS = [
  'fire',
  'water',
  'nature',
  'electric',
  'ice',
  'earth',
  'wind',
  'metal',
] as const;
export type TypeId = (typeof TYPE_IDS)[number];

export interface TypeColor {
  readonly label: string;
  /** Main color: badges, VFX, palette seeds. */
  readonly base: number;
  /** Text/icon color to use on top of `base`. */
  readonly on: number;
}

/** The 8 type colors (see DESIGN.md "Types"). */
export const typeColors: Readonly<Record<TypeId, TypeColor>> = {
  fire: { label: 'Fire', base: 0xff6b3d, on: ink[950] },
  water: { label: 'Water', base: 0x3d8bff, on: ink[950] },
  nature: { label: 'Nature', base: 0x4cbf56, on: ink[950] },
  electric: { label: 'Electric', base: 0xffd23f, on: ink[950] },
  ice: { label: 'Ice', base: 0x8fe3f5, on: ink[950] },
  earth: { label: 'Earth', base: 0xc08a4a, on: ink[950] },
  wind: { label: 'Wind', base: 0xb39dff, on: ink[950] },
  metal: { label: 'Metal', base: 0x9aa6b8, on: ink[950] },
};

export const CONDITION_IDS = [
  'burning',
  'wet',
  'overgrown',
  'charged',
  'chilled',
  'muddy',
  'airborne',
  'exposed',
] as const;
export type ConditionId = (typeof CONDITION_IDS)[number];

export interface ConditionColor {
  readonly label: string;
  /** The type that applies it. */
  readonly type: TypeId;
  readonly color: number;
  readonly on: number;
}

/** The 8 condition colors (see DESIGN.md "Conditions & reactions"). */
export const conditionColors: Readonly<Record<ConditionId, ConditionColor>> = {
  burning: { label: 'Burning', type: 'fire', color: 0xff4d2e, on: ink[950] },
  wet: { label: 'Wet', type: 'water', color: 0x4fb3ff, on: ink[950] },
  overgrown: { label: 'Overgrown', type: 'nature', color: 0x8fd94a, on: ink[950] },
  charged: { label: 'Charged', type: 'electric', color: 0xfff27a, on: ink[950] },
  chilled: { label: 'Chilled', type: 'ice', color: 0xd3f6ff, on: ink[950] },
  muddy: { label: 'Muddy', type: 'earth', color: 0x8b6b45, on: 0xffffff },
  airborne: { label: 'Airborne', type: 'wind', color: 0xe3dbff, on: ink[950] },
  exposed: { label: 'Exposed', type: 'metal', color: 0xff7ab6, on: ink[950] },
};

export const fonts = {
  /** Rounded, friendly display face: titles, big numbers, callouts. */
  display: "'Fredoka Variable', 'Fredoka', system-ui, sans-serif",
  /** Highly readable rounded sans: menus, dialog, body. */
  ui: "'Nunito Variable', 'Nunito', system-ui, sans-serif",
  mono: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
} as const;

/** Font sizes in CSS px. */
export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  hero: 72,
} as const;

export const fontWeight = {
  regular: 400,
  semibold: 600,
  bold: 700,
  black: 800,
} as const;

/** Line-height multipliers. */
export const lineHeight = {
  tight: 1.15,
  base: 1.4,
} as const;

/** Spacing scale, CSS px. */
export const space = {
  '3xs': 2,
  '2xs': 4,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 20,
  pill: 999,
} as const;

export const borderWidth = {
  thin: 1,
  base: 2,
  thick: 3,
} as const;

export const motion = {
  /** Durations, seconds. */
  duration: {
    instant: 0.08,
    fast: 0.14,
    base: 0.22,
    slow: 0.36,
    slower: 0.6,
    /** Scene / battle transition. */
    transition: 0.4,
    /** Freeze frame on a hit. */
    hitStop: 0.06,
    /** Upper bound for one battle action (DESIGN.md "Presentation"). */
    battleActionMax: 1.5,
  },
  easing: {
    enter: 'cubicOut',
    exit: 'quadIn',
    move: 'cubicInOut',
    pop: 'backOut',
  } satisfies Record<string, EasingName>,
  /** Dialog text. */
  text: {
    charsPerSecond: 40,
    fastMultiplier: 5,
    blink: 0.8,
  },
} as const;

export const tokens = {
  ink,
  brand,
  logoColors,
  semantic,
  surface,
  lightSurface,
  typeColors,
  conditionColors,
  fonts,
  fontSize,
  fontWeight,
  lineHeight,
  space,
  radius,
  borderWidth,
  motion,
} as const;

export type Tokens = typeof tokens;
