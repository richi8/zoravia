import { Graphics, type Container } from 'pixi.js';
import type { Transition } from '../scenes/scene-manager';

export interface FadeOptions {
  /** Seconds per half (fade out, fade in). Default 0.25. */
  readonly duration?: number;
  /** Fill color. Default near-black. */
  readonly color?: number;
}

/**
 * Full-screen color fade. The overlay is added to `layer` while running and removed after.
 * `getSize` is read each frame so a resize mid-fade still covers the screen.
 */
export function createFade(
  layer: Container,
  getSize: () => { width: number; height: number },
  options: FadeOptions = {},
): Transition {
  const color = options.color ?? 0x0f1115;
  const overlay = new Graphics();
  overlay.label = 'fade';
  const redraw = (): void => {
    const { width, height } = getSize();
    overlay.clear().rect(0, 0, width, height).fill({ color });
  };
  return {
    duration: options.duration ?? 0.25,
    begin() {
      redraw();
      overlay.alpha = 0;
      layer.addChild(overlay);
    },
    setCover(amount) {
      redraw();
      overlay.alpha = amount;
    },
    end() {
      layer.removeChild(overlay);
    },
  };
}
