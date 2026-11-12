/** Builds the engine's `UiTheme` from the design tokens. */

import type { UiTheme } from '@engine/ui';
import { storybookSkin } from '../ui/skin';
import {
  brand,
  fonts,
  fontSize,
  lineHeight,
  motion,
  paper,
  radius,
  space,
  surface,
} from './tokens';

export interface UiThemeOptions {
  /**
   * The in-game theme for the 480×270 game screen (sizes in game pixels): storybook paper
   * panels drawn as pixel art, smooth text (C10).
   */
  readonly screen?: boolean;
}

export function createUiTheme(options: UiThemeOptions = {}): UiTheme {
  const textMotion = {
    textSpeed: motion.text.charsPerSecond,
    textFastMultiplier: motion.text.fastMultiplier,
    blink: motion.text.blink,
  };
  if (options.screen) {
    return {
      colors: {
        panel: paper.base,
        panelAlpha: 1,
        border: paper.edge,
        text: paper.ink,
        textDim: paper.inkDim,
        textDisabled: paper.inkDisabled,
        cursorBg: paper.cursor,
        cursorText: paper.ink,
        accent: paper.accent,
        title: paper.title,
      },
      font: { family: fonts.ui, size: 10, titleSize: 8, lineHeight: 12 },
      spacing: { panel: 6, item: 0, column: 4 },
      radius: 2,
      borderWidth: 1,
      skin: storybookSkin,
      motion: textMotion,
    };
  }
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
    motion: textMotion,
  };
}

/** The game's UI theme in CSS pixels (lab pages without the game screen). */
export const ZORAVIA_THEME: UiTheme = createUiTheme();

/** The in-game UI theme on the 480×270 game screen (storybook paper, C10). */
export const ZORAVIA_SCREEN_THEME: UiTheme = createUiTheme({ screen: true });
