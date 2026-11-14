/**
 * Battle transition: a quick white flash, then pixel bars sweep in from alternating sides
 * and cover the screen; at full cover the battle swaps in and the bars sweep out again.
 * It plays the battle-start whoosh (C24). The flash follows the Flashes setting (C33).
 */

import { Graphics, type Container } from 'pixi.js';
import type { Transition } from '@engine/scenes/scene-manager';
import { playSfx } from '@game/audio';
import { gameSettings } from '@game/settings';
import { ink } from '@game/style/tokens';

export interface BattleTransitionOptions {
  /** Seconds per half. Default 0.45. */
  readonly duration?: number;
  /** Bar height in game pixels. Default 15. */
  readonly bar?: number;
  readonly color?: number;
}

/** Cover of bar `i` of `n` at overall cover `amount` (bars start one after another). */
export function barCover(amount: number, i: number, n: number): number {
  const stagger = 0.5;
  const start = n > 1 ? (i / (n - 1)) * stagger : 0;
  return Math.min(1, Math.max(0, (amount - start) / (1 - stagger)));
}

export function battleTransition(
  layer: Container,
  getSize: () => { width: number; height: number },
  options: BattleTransitionOptions = {},
): Transition {
  const g = new Graphics();
  g.label = 'battle-transition';
  const bar = options.bar ?? 15;
  const color = options.color ?? ink[950];
  let last = 0;
  let coverIn = true;
  return {
    duration: options.duration ?? 0.45,
    begin() {
      last = 0;
      coverIn = true;
      layer.addChild(g);
      playSfx('world.battleStart');
    },
    setCover(amount) {
      if (amount < last) coverIn = false;
      last = amount;
      const { width, height } = getSize();
      const n = Math.ceil(height / bar);
      g.clear();
      for (let i = 0; i < n; i++) {
        const w = Math.round(width * barCover(amount, i, n));
        if (w <= 0) continue;
        const fromLeft = i % 2 === 0;
        g.rect(fromLeft ? 0 : width - w, i * bar, w, bar).fill({ color });
      }
      if (coverIn && amount < 0.25 && gameSettings().flashes) {
        // A white flash at the start (as the encounter begins); off in the settings (C33).
        const a = amount < 0.12 ? 0.85 : 0.85 * (1 - (amount - 0.12) / 0.13);
        g.rect(0, 0, width, height).fill({ color: 0xffffff, alpha: a });
      }
    },
    end() {
      g.clear();
      layer.removeChild(g);
    },
  };
}
