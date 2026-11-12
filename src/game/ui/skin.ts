/**
 * Storybook skin (C10): cream paper panels with a brown ink border, a highlight line on top
 * and a shade line at the bottom, all drawn as whole-pixel shapes (pixel art at any scale).
 */

import type { Graphics } from 'pixi.js';
import { pixelRoundRect, pixelTriangle, type UiSkin } from '@engine/ui';
import { paper } from '../style/tokens';

export interface PaperOptions {
  /** Fill color (default paper). */
  readonly fill?: number;
  /** Outer corner radius (default 2). */
  readonly radius?: number;
}

/** A paper panel `w × h` at (x, y). */
export function drawPaper(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  options: PaperOptions = {},
): Graphics {
  w = Math.round(w);
  h = Math.round(h);
  const r = options.radius ?? 2;
  pixelRoundRect(g, x, y, w, h, r, paper.edge);
  pixelRoundRect(g, x + 1, y + 1, w - 2, h - 2, Math.max(0, r - 1), options.fill ?? paper.base);
  if (w > 6 && h > 4) {
    g.rect(x + 2, y + 1, w - 4, 1).fill({ color: paper.light });
    g.rect(x + 2, y + h - 2, w - 4, 1).fill({ color: paper.shade });
  }
  return g;
}

/** A recessed area inside a panel (lists, portraits). */
export function drawWell(g: Graphics, x: number, y: number, w: number, h: number): Graphics {
  pixelRoundRect(g, x, y, w, h, 1, paper.well);
  g.rect(x + 1, y, Math.max(0, w - 2), 1).fill({ color: paper.shade });
  return g;
}

/** Cursor bar with the marker triangle (menus, lists). */
export function drawCursor(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  focused: boolean,
): Graphics {
  pixelRoundRect(g, x, y, w, h, 1, paper.cursor, focused ? 1 : 0.5);
  pixelTriangle(g, x + 2, y + Math.floor((h - 5) / 2), 5, focused ? paper.accent : paper.inkDim);
  return g;
}

export const storybookSkin: UiSkin = {
  panel: (g, w, h) => drawPaper(g, 0, 0, w, h),
  cursor: (g, w, h, focused) => drawCursor(g, 0, 0, w, h, focused),
  more: (g) => pixelTriangle(g, -6, -4, 5, paper.accent, 'down'),
};
