/** Builds the engine's `UiTheme` from the design tokens. */

import type { UiTheme } from '@engine/ui';
import { brand, fonts, fontSize, lineHeight, motion, radius, space, surface } from './tokens';

export function createUiTheme(): UiTheme {
  return {
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
}

/** The game's UI theme. */
export const ZORAVIA_THEME: UiTheme = createUiTheme();
