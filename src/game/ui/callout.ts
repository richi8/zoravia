/**
 * Short-lived battle text: reaction callouts ("Wildfire! ×2"), damage numbers and toasts.
 * Each one animates itself in `update(dt)` and reports `done` when it can be removed.
 */

import { Container, Graphics, type Text } from 'pixi.js';
import { easing } from '@engine/core';
import { pixelBitmap } from '@engine/ui';
import { motion, paper, semantic } from '../style/tokens';
import { drawPaper } from './skin';
import { uiText } from './text';

interface Animated {
  update(dt: number): void;
  readonly done: boolean;
}

/** Big pop-in text that holds, then floats up and fades. Centered on its position. */
export class Callout extends Container implements Animated {
  private t = 0;
  private readonly text: Text;

  constructor(
    text: string,
    color: number = semantic.reaction,
    private readonly size = 22,
    private readonly hold = 0.7,
  ) {
    super({ label: 'callout' });
    this.text = uiText('callout', text, color, { fontSize: size });
    this.text.anchor.set(0.5);
    this.addChild(this.text);
    this.scale.set(0);
  }

  get done(): boolean {
    return this.t >= this.duration;
  }

  private get duration(): number {
    return motion.duration.base + this.hold + motion.duration.slow;
  }

  update(dt: number): void {
    this.t += dt;
    const pop = motion.duration.base;
    if (this.t < pop) {
      this.scale.set(easing.backOut(this.t / pop));
      this.alpha = 1;
      return;
    }
    this.scale.set(1);
    const out = this.t - pop - this.hold;
    if (out > 0) {
      const k = Math.min(1, out / motion.duration.slow);
      this.text.y = -Math.round(this.size * 0.5 * easing.quadIn(k));
      this.alpha = 1 - k;
    }
  }
}

/** Damage / heal number: small callout that rises. */
export class FloatNumber extends Callout {
  constructor(amount: number, heal = false) {
    super(heal ? `+${amount}` : `-${amount}`, heal ? semantic.hpHigh : 0xffffff, 14, 0.45);
  }
}

/** Small paper note with an optional check icon (e.g. "Saved your game."). */
export class Toast extends Container implements Animated {
  private t = 0;

  constructor(
    message: string,
    private readonly hold = 1.6,
    icon = true,
  ) {
    super({ label: 'toast' });
    const text = uiText('body', message);
    const pad = icon ? 16 : 7;
    const w = Math.ceil(text.width) + pad + 8;
    const g = drawPaper(new Graphics(), 0, 0, w, 18);
    if (icon) pixelBitmap(g, '.###./#####/###.#/##.##/.###.', 6, 6, semantic.success);
    if (icon) pixelBitmap(g, '....#/...#./#.#../.#...', 6, 7, paper.ink);
    text.position.set(pad, 2);
    this.addChild(g, text);
    this.alpha = 0;
  }

  get done(): boolean {
    return this.t >= motion.duration.base * 2 + this.hold;
  }

  update(dt: number): void {
    this.t += dt;
    const fade = motion.duration.base;
    this.alpha =
      this.t < fade
        ? this.t / fade
        : this.t > fade + this.hold
          ? Math.max(0, 1 - (this.t - fade - this.hold) / fade)
          : 1;
  }
}

/** Holds animated pieces and removes them when done. */
export class EffectsLayer extends Container {
  constructor() {
    super({ label: 'effects' });
    this.eventMode = 'none';
  }

  add<T extends Container & Animated>(fx: T, x: number, y: number): T {
    fx.position.set(Math.round(x), Math.round(y));
    this.addChild(fx);
    return fx;
  }

  update(dt: number): void {
    for (const c of [...this.children]) {
      const fx = c as Container & Partial<Animated>;
      fx.update?.(dt);
      if (fx.done) fx.destroy({ children: true });
    }
  }

  clear(): void {
    for (const c of this.removeChildren()) c.destroy({ children: true });
  }
}
