import { Graphics, type Container } from 'pixi.js';
import type { Transition } from '../scenes/scene-manager';

export interface IrisOptions {
  /** Seconds per half. Default 0.4. */
  readonly duration?: number;
  readonly color?: number;
  /** Row height of the stepped circle, px. Default 2 (crisp pixel edge). */
  readonly step?: number;
}

/** Hole radius at `cover` (0 = open, 1 = closed) for a screen of `w`×`h` around (`cx`, `cy`). */
export function irisRadius(cover: number, w: number, h: number, cx: number, cy: number): number {
  // Far enough to clear the farthest corner when open.
  const far = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) + 2;
  const t = Math.min(1, Math.max(0, cover));
  // Ease so the circle lingers a moment when small.
  return far * (1 - t) * (1 - t * 0.35);
}

/**
 * Iris wipe: a circle closes on a point (e.g. the player), then opens again around the point
 * `getCenter` gives at that moment. Drawn as rows of rects so the edge stays on the pixel grid.
 */
export function createIris(
  layer: Container,
  getSize: () => { width: number; height: number },
  getCenter: () => { x: number; y: number } | undefined,
  options: IrisOptions = {},
): Transition {
  const g = new Graphics();
  g.label = 'iris';
  const color = options.color ?? 0x0f1115;
  const step = options.step ?? 2;
  return {
    duration: options.duration ?? 0.4,
    begin() {
      layer.addChild(g);
    },
    setCover(amount) {
      const { width: w, height: h } = getSize();
      const c = getCenter() ?? { x: w / 2, y: h / 2 };
      const r = irisRadius(amount, w, h, c.x, c.y);
      g.clear();
      if (amount <= 0) return;
      for (let y = 0; y < h; y += step) {
        const dy = y + step / 2 - c.y;
        const half = r > Math.abs(dy) ? Math.sqrt(r * r - dy * dy) : -1;
        if (half < 0) {
          g.rect(0, y, w, step);
          continue;
        }
        const x0 = Math.max(0, Math.round(c.x - half));
        const x1 = Math.min(w, Math.round(c.x + half));
        if (x0 > 0) g.rect(0, y, x0, step);
        if (x1 < w) g.rect(x1, y, w - x1, step);
      }
      g.fill({ color });
    },
    end() {
      g.clear();
      layer.removeChild(g);
    },
  };
}
