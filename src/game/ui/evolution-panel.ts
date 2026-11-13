/**
 * Evolution (C22b): the Zorling turns into a white silhouette, the old and new silhouettes
 * swap faster and faster, a flash, and the new form fades in. `E` skips to the flash.
 * Calls `onDone` once at the end; the caller then closes it and tells what happened.
 */

import { Container, Graphics, Rectangle, Sprite, type Texture } from 'pixi.js';
import { type UiInput, type Widget } from '@engine/ui';
import { paper } from '../style/tokens';
import { drawPaper, drawWell } from './skin';
import { uiText } from './text';

export interface EvolutionOptions {
  readonly title: string;
  /** Colored sprites and white silhouettes of the old and new form (same size). */
  readonly from: { readonly color: Texture; readonly white: Texture };
  readonly into: { readonly color: Texture; readonly white: Texture };
  readonly onDone: (panel: EvolutionPanel) => void;
}

/** Timeline, seconds. */
const T = { glow: 0.6, swap: 1.1, flash: 3.1, reveal: 3.45, end: 4.1 } as const;
const W = 200;

export class EvolutionPanel implements Widget<Container> {
  readonly view = new Container({ label: 'evolution' });
  readonly width = W;
  readonly height: number;
  private readonly oldColor: Sprite;
  private readonly oldWhite: Sprite;
  private readonly newColor: Sprite;
  private readonly newWhite: Sprite;
  private readonly flash = new Graphics();
  private time = 0;
  private finished = false;

  constructor(private readonly options: EvolutionOptions) {
    const size = options.from.color.width;
    this.height = size + 40;
    const bg = drawPaper(new Graphics(), 0, 0, W, this.height);
    const ax = Math.round((W - size) / 2) - 2;
    drawWell(bg, ax, 20, size + 4, size + 4);
    const title = uiText('label', options.title, paper.title);
    title.position.set(Math.round((W - title.width) / 2), 7);
    const at = (t: Texture): Sprite => {
      const s = new Sprite(t);
      s.position.set(ax + 2, 22);
      return s;
    };
    this.oldColor = at(options.from.color);
    this.oldWhite = at(options.from.white);
    this.newColor = at(options.into.color);
    this.newWhite = at(options.into.white);
    this.flash.rect(ax + 2, 22, size, size).fill({ color: 0xffffff });
    this.view.addChild(bg, title, this.oldColor, this.newColor, this.oldWhite);
    this.view.addChild(this.newWhite, this.flash);
    this.view.eventMode = 'static';
    this.view.hitArea = new Rectangle(0, 0, W, this.height);
    this.apply();
  }

  /** Seconds into the animation. */
  get elapsed(): number {
    return this.time;
  }

  handleInput(input: UiInput): void {
    if (input.confirmPressed() && this.time < T.flash) this.time = T.flash;
  }

  update(dt: number): void {
    if (this.finished) return;
    this.time += dt;
    this.apply();
    if (this.time >= T.end) {
      this.finished = true;
      this.options.onDone(this);
    }
  }

  private apply(): void {
    const t = this.time;
    const showNew = t >= T.flash || (t >= T.swap && swapPhase(t));
    this.oldColor.visible = t < T.swap;
    this.newColor.visible = t >= T.flash;
    this.oldWhite.visible = !showNew && t >= T.glow * 0.5;
    this.oldWhite.alpha = clamp01((t - T.glow * 0.5) / (T.swap - T.glow * 0.5));
    this.newWhite.visible = showNew && t < T.end;
    this.newWhite.alpha = t >= T.reveal ? 1 - clamp01((t - T.reveal) / (T.end - T.reveal)) : 1;
    this.flash.visible = t >= T.flash && t < T.reveal;
    this.flash.alpha = 1 - clamp01((t - T.flash) / (T.reveal - T.flash));
  }
}

/** True on the "new form" half of the swap, which gets faster toward the flash. */
function swapPhase(t: number): boolean {
  const k = clamp01((t - T.swap) / (T.flash - T.swap));
  // Phase = ∫ frequency, frequency rising from 2 to 14 swaps per second.
  const seconds = t - T.swap;
  const phase = seconds * (2 + 6 * k);
  return Math.floor(phase * 2) % 2 === 1;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
