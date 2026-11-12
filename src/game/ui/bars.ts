/**
 * HP and XP bars. HP drains smoothly to a new value (green → yellow → red by ratio); the
 * lost part flashes as a pale "ghost" first, so a hit reads at a glance.
 */

import { Container, Graphics } from 'pixi.js';
import { darken, lighten } from '@engine/core/color';
import { pixelRoundRect } from '@engine/ui';
import { paper, semantic } from '../style/tokens';

/** HP color for a ratio (0–1). */
export function hpColor(ratio: number): number {
  return ratio > 0.5 ? semantic.hpHigh : ratio > 0.2 ? semantic.hpMid : semantic.hpLow;
}

/** Speed of the drain animation, fraction of the bar per second. */
const DRAIN_SPEED = 0.9;
/** Ghost delay before it catches up, seconds. */
const GHOST_HOLD = 0.35;

export class HpBar extends Container {
  static readonly HEIGHT = 6;
  private readonly g = new Graphics();
  private shown = 1;
  private target = 1;
  private ghost = 1;
  private ghostHold = 0;

  constructor(private readonly barWidth: number) {
    super({ label: 'hp-bar' });
    this.addChild(this.g);
    this.draw();
  }

  get ratio(): number {
    return this.target;
  }

  /** True while the bar is still moving to its target. */
  get animating(): boolean {
    return this.shown !== this.target || this.ghost !== this.shown;
  }

  set(ratio: number, animate = true): void {
    const r = Math.max(0, Math.min(1, ratio));
    if (!animate) {
      this.shown = this.ghost = this.target = r;
    } else {
      if (r < this.target) this.ghostHold = GHOST_HOLD;
      this.ghost = Math.max(this.ghost, this.shown);
      this.target = r;
    }
    this.draw();
  }

  update(dt: number): void {
    if (!this.animating) return;
    const step = DRAIN_SPEED * dt;
    if (this.shown < this.target) {
      this.shown = Math.min(this.target, this.shown + step);
      this.ghost = this.shown;
    } else if (this.shown > this.target) {
      this.shown = Math.max(this.target, this.shown - step);
    }
    if (this.ghostHold > 0) this.ghostHold -= dt;
    else if (this.ghost > this.shown) this.ghost = Math.max(this.shown, this.ghost - step);
    this.draw();
  }

  private draw(): void {
    const w = this.barWidth;
    const inner = w - 2;
    const g = this.g.clear();
    pixelRoundRect(g, 0, 0, w, HpBar.HEIGHT, 1, paper.track);
    const fw = this.shown > 0 ? Math.max(1, Math.round(inner * this.shown)) : 0;
    const gw = this.ghost > 0 ? Math.max(fw, Math.round(inner * this.ghost)) : 0;
    if (gw > fw) g.rect(1 + fw, 1, gw - fw, 4).fill({ color: paper.base });
    if (fw > 0) {
      const c = hpColor(this.shown);
      g.rect(1, 1, fw, 4).fill({ color: c });
      g.rect(1, 1, fw, 1).fill({ color: lighten(c, 0.35) });
      g.rect(1, 4, fw, 1).fill({ color: darken(c, 0.2) });
    }
  }
}

export class XpBar extends Container {
  static readonly HEIGHT = 3;
  private readonly g = new Graphics();

  constructor(
    private readonly barWidth: number,
    ratio = 0,
  ) {
    super({ label: 'xp-bar' });
    this.addChild(this.g);
    this.set(ratio);
  }

  set(ratio: number): void {
    const r = Math.max(0, Math.min(1, ratio));
    this.g.clear().rect(0, 0, this.barWidth, XpBar.HEIGHT).fill({ color: paper.track });
    const fw = Math.round((this.barWidth - 2) * r);
    if (fw > 0) this.g.rect(1, 1, fw, 1).fill({ color: semantic.xp });
  }
}
