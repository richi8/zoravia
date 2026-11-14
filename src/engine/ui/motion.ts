/**
 * Open/close motion for focus-stack views (C32): a view fades in while rising a few pixels
 * into place, and fades out (sinking back) when it closes. It moves the view's `pivot`, not
 * its `position`, so layout code can keep placing views as before. Use it as (or inside) a
 * `FocusHost` and call `update` every frame.
 */

import type { Container } from 'pixi.js';
import type { FocusHost } from './focus-stack';

export interface MotionOptions {
  /** Seconds to open. Default 0.1. */
  readonly open?: number;
  /** Seconds to close. Default 0.08. */
  readonly close?: number;
  /** Pixels the view rises while opening. Default 4. */
  readonly rise?: number;
}

interface Moving {
  readonly view: Container;
  /** 0 = closed, 1 = open. */
  t: number;
  closing: boolean;
}

/** Ease-out (quadratic). */
const ease = (t: number): number => 1 - (1 - t) * (1 - t);

export class UiMotion implements FocusHost<Container> {
  private readonly moving: Moving[] = [];
  private readonly open: number;
  private readonly close: number;
  private readonly rise: number;

  constructor(
    private readonly layer: Container,
    options: MotionOptions = {},
  ) {
    this.open = options.open ?? 0.1;
    this.close = options.close ?? 0.08;
    this.rise = options.rise ?? 4;
  }

  /** Views still animating (for tests). */
  get active(): number {
    return this.moving.length;
  }

  attach(view: Container): void {
    const was = this.moving.find((m) => m.view === view);
    if (was) {
      was.closing = false;
    } else {
      this.moving.push({ view, t: 0, closing: false });
    }
    if (view.parent !== this.layer) this.layer.addChild(view);
    this.pose(view, was?.t ?? 0);
  }

  detach(view: Container): void {
    if (view.destroyed || this.close <= 0) {
      this.drop(view);
      return;
    }
    const m = this.moving.find((x) => x.view === view);
    if (m) m.closing = true;
    else this.moving.push({ view, t: 1, closing: true });
  }

  update(dt: number): void {
    for (const m of [...this.moving]) {
      if (m.view.destroyed) {
        this.remove(m);
        continue;
      }
      if (m.closing) {
        m.t -= dt / this.close;
        if (m.t <= 0) {
          this.drop(m.view);
          continue;
        }
      } else {
        m.t += dt / this.open;
        if (m.t >= 1) {
          this.pose(m.view, 1);
          this.remove(m);
          continue;
        }
      }
      this.pose(m.view, m.t);
    }
  }

  private pose(view: Container, t: number): void {
    const e = ease(Math.min(1, Math.max(0, t)));
    view.alpha = e;
    view.pivot.y = Math.round((e - 1) * this.rise);
  }

  private remove(m: Moving): void {
    const i = this.moving.indexOf(m);
    if (i >= 0) this.moving.splice(i, 1);
  }

  private drop(view: Container): void {
    const m = this.moving.find((x) => x.view === view);
    if (m) this.remove(m);
    if (!view.destroyed) {
      view.alpha = 1;
      view.pivot.y = 0;
      if (view.parent === this.layer) this.layer.removeChild(view);
    }
  }
}
