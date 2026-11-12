/**
 * UI theming hook. Widgets read every color, font size, spacing and timing from a `UiTheme`.
 * C07 provides the real design tokens; until then `DEFAULT_THEME` is a neutral placeholder.
 */

import type { Graphics } from 'pixi.js';

/**
 * Optional custom drawing for a theme (e.g. pixel-art panels). Coordinates are theme units
 * with the origin at the element's top-left corner.
 */
export interface UiSkin {
  /** Panel background and border, `w × h`. */
  panel(g: Graphics, w: number, h: number): void;
  /** Highlight behind the selected menu item, including any cursor marker. */
  cursor?(g: Graphics, w: number, h: number, focused: boolean): void;
  /** "More text" marker of a dialog, drawn around (0, 0) = its bottom-right anchor. */
  more?(g: Graphics): void;
}

export interface UiTheme {
  readonly colors: {
    readonly panel: number;
    readonly panelAlpha: number;
    readonly border: number;
    readonly text: number;
    readonly textDim: number;
    readonly textDisabled: number;
    readonly cursorBg: number;
    readonly cursorText: number;
    readonly accent: number;
    readonly title: number;
  };
  readonly font: {
    readonly family: string;
    readonly size: number;
    readonly titleSize: number;
    readonly lineHeight: number;
  };
  readonly spacing: {
    /** Inner padding of panels. */
    readonly panel: number;
    /** Vertical padding inside a menu row. */
    readonly item: number;
    /** Gap between grid columns. */
    readonly column: number;
  };
  readonly radius: number;
  readonly borderWidth: number;
  /** Custom drawing; without it widgets draw plain rounded rects. */
  readonly skin?: UiSkin;
  readonly motion: {
    /** Characters per second for dialog text. */
    readonly textSpeed: number;
    readonly textFastMultiplier: number;
    /** Blink period of the "more text" indicator, seconds. */
    readonly blink: number;
  };
}

export const DEFAULT_THEME: UiTheme = {
  colors: {
    panel: 0x161a22,
    panelAlpha: 0.94,
    border: 0x3a4456,
    text: 0xe8e6e3,
    textDim: 0x9aa3b2,
    textDisabled: 0x5a6272,
    cursorBg: 0x2d5d8a,
    cursorText: 0xffffff,
    accent: 0xf2c14e,
    title: 0xf2c14e,
  },
  font: { family: 'system-ui, sans-serif', size: 20, titleSize: 16, lineHeight: 28 },
  spacing: { panel: 16, item: 6, column: 12 },
  radius: 8,
  borderWidth: 2,
  motion: { textSpeed: 40, textFastMultiplier: 5, blink: 0.8 },
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** Returns `base` with `overrides` applied (one level of nesting). */
export function extendTheme(base: UiTheme, overrides: DeepPartial<UiTheme>): UiTheme {
  return {
    colors: { ...base.colors, ...overrides.colors },
    font: { ...base.font, ...overrides.font },
    spacing: { ...base.spacing, ...overrides.spacing },
    radius: overrides.radius ?? base.radius,
    borderWidth: overrides.borderWidth ?? base.borderWidth,
    ...(overrides.skin || base.skin ? { skin: (overrides.skin ?? base.skin) as UiSkin } : {}),
    motion: { ...base.motion, ...overrides.motion },
  };
}
