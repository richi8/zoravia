/** Builds the engine's `UiTheme` from the design tokens. */

import type { UiTheme } from '@engine/ui';
import { brand, fonts, fontSize, lineHeight, motion, radius, space, surface } from './tokens';

export interface UiThemeOptions {
  /**
   * Size for the 480×270 game screen (game pixels) instead of CSS pixels. Interim until
   * C10 brings a pixel font and pixel UI kit.
   */
  readonly pixel?: boolean;
}

export function createUiTheme(options: UiThemeOptions = {}): UiTheme {
  const theme: UiTheme = {
    colors: {
      panel: surface.base,
      panelAlpha: 0.95,
      border: surface.border,
      text: surface.text,
      textDim: surface.textDim,
      textDisabled: surface.textDisabled,
      cursorBg: surface.cursorBg,
      cursorText: surface.cursorText,
      accent: brand.sunbeam,
      title: brand.sunbeam,
    },
    font: {
      family: fonts.ui,
      size: fontSize.lg,
      titleSize: fontSize.sm,
      lineHeight: Math.round(fontSize.lg * lineHeight.base),
    },
    spacing: { panel: space.lg, item: space.xs, column: space.md },
    radius: radius.lg,
    borderWidth: 2,
    motion: {
      textSpeed: motion.text.charsPerSecond,
      textFastMultiplier: motion.text.fastMultiplier,
      blink: motion.text.blink,
    },
  };
  if (!options.pixel) return theme;
  return {
    ...theme,
    font: { family: fonts.ui, size: 10, titleSize: 8, lineHeight: 13 },
    spacing: { panel: space.xs, item: 2, column: space['2xs'] },
    radius: radius.sm - 1,
    borderWidth: 1,
  };
}

/** The game's UI theme (CSS pixels, e.g. the lab). */
export const ZORAVIA_THEME: UiTheme = createUiTheme();

/** The UI theme on the 480×270 game screen. */
export const ZORAVIA_PIXEL_THEME: UiTheme = createUiTheme({ pixel: true });
