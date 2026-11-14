/**
 * Trainer and boss intro splash (C32, style "A · Slash band" from the C32 preview round): a
 * slanted ink band with gold edges slides in across the screen, the portrait comes in from
 * the left, the name lands big in the band with "VS". Boss battles use a deep red band and
 * tint. It plays over the start of a trainer or story-boss battle, then slides away.
 */

import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { brand } from '../style/tokens';
import { uiText } from './text';

export interface IntroSpec {
  /** Big line: the trainer's or boss's name. */
  readonly title: string;
  /** Small line under it ("Stormcatcher Vex", "Titan"); trainers show "VS" instead. */
  readonly subtitle?: string;
  readonly boss: boolean;
  readonly portrait: Texture;
  /** Whole-number scale of the portrait (pixel art). */
  readonly scale: number;
}

/** Timeline, seconds. */
const IN = 0.22;
const HOLD = 0.95;
const OUT = 0.2;
export const INTRO_SECONDS = IN + HOLD + OUT;

/** Band slope (px of rise per px across) and thickness. */
const SLOPE = 0.18;
const BAND = 78;

const easeOut = (t: number): number => 1 - (1 - t) ** 3;
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export class IntroSplash {
  readonly view = new Container({ label: 'intro-splash' });
  private readonly tint = new Graphics();
  private readonly band = new Graphics();
  private readonly portrait: Sprite;
  private readonly title;
  private readonly sub;
  private time: number;
  private w = 480;
  private h = 270;

  /** `delay`: seconds before it starts (e.g. while the battle transition uncovers). */
  constructor(
    private readonly spec: IntroSpec,
    delay = 0,
  ) {
    this.time = -delay;
    this.portrait = new Sprite(spec.portrait);
    this.portrait.scale.set(spec.scale);
    this.portrait.anchor.set(0.5, 1);
    const light = spec.boss ? 0xffd7dc : 0xfff4c8;
    this.title = uiText('callout', spec.title.toUpperCase(), light);
    this.sub = uiText('name', spec.subtitle ?? 'VS', spec.boss ? 0xffb0b8 : brand.sunbeam);
    this.view.addChild(this.tint, this.band, this.portrait, this.title, this.sub);
    this.view.eventMode = 'none';
    this.layout(this.w, this.h);
  }

  /** Removes the splash and frees its portrait texture. */
  destroy(): void {
    this.view.destroy({ children: true });
    this.spec.portrait.destroy(true);
  }

  get done(): boolean {
    return this.time >= INTRO_SECONDS;
  }

  layout(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.pose();
  }

  update(dt: number): void {
    this.time += dt;
    this.pose();
  }

  private pose(): void {
    const { w, h } = this;
    const t = this.time;
    const inK = easeOut(clamp01(t / IN));
    const outK = clamp01((t - IN - HOLD) / OUT);
    const shift = Math.round((1 - inK) * -w + outK * outK * w);
    const boss = this.spec.boss;
    this.tint
      .clear()
      .rect(0, 0, w, h)
      .fill({ color: boss ? 0x5a0f18 : 0x000000, alpha: (boss ? 0.45 : 0.35) * inK * (1 - outK) });

    // The band: a parallelogram through the middle, rising to the right.
    const cy = Math.round(h * 0.5);
    const top = (x: number): number => cy - BAND / 2 - (x - w / 2) * SLOPE;
    const g = this.band.clear();
    const x0 = shift - 40;
    const x1 = shift + w + 40;
    g.poly([x0, top(x0), x1, top(x1), x1, top(x1) + BAND, x0, top(x0) + BAND]).fill({
      color: boss ? 0x2a0a14 : 0x141a3c,
      alpha: 0.94,
    });
    for (const off of [0, BAND]) {
      g.poly([
        x0,
        top(x0) + off - 1,
        x1,
        top(x1) + off - 1,
        x1,
        top(x1) + off + 1,
        x0,
        top(x0) + off + 1,
      ]).fill({
        color: boss ? 0xff5c6c : brand.sunbeam,
      });
    }

    // Portrait from the left, standing on the band's lower edge; the name from the right.
    const px = Math.round(w * 0.2) + Math.round((1 - inK) * -w * 0.6) - Math.round(outK * outK * w);
    // Feet just inside the band's lower edge, clear of the battle's hotbar.
    this.portrait.position.set(px, Math.round(top(w * 0.2) + BAND - 4));
    this.portrait.alpha = 1 - outK;
    const nameX = Math.round(w * 0.64);
    const slide = Math.round((1 - inK) * w * 0.6 + outK * outK * w);
    this.title.position.set(
      Math.round(nameX - this.title.width / 2) + slide,
      Math.round(top(nameX) + BAND / 2 - this.title.height + 4),
    );
    this.sub.position.set(
      Math.round(nameX - this.sub.width / 2) + slide,
      Math.round(top(nameX) + BAND / 2 + 6),
    );
    this.title.alpha = this.sub.alpha = 1 - outK;
  }
}
