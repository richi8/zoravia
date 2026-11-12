import { Container, Graphics, Text } from 'pixi.js';
import type { FpsCounter } from './fps-counter';

/** Small top-left panel showing FPS, frame times and update steps. Refreshes 4×/second. */
export class FpsOverlay {
  readonly view = new Container({ label: 'fps-overlay' });
  private readonly bg = new Graphics();
  private readonly text = new Text({
    text: '',
    style: { fontFamily: 'monospace', fontSize: 12, fill: 0xd8f5c8, lineHeight: 15 },
  });
  private sinceRefresh = Infinity;

  constructor(private readonly counter: FpsCounter) {
    this.text.position.set(8, 6);
    this.view.addChild(this.bg, this.text);
    this.view.position.set(8, 8);
    this.view.eventMode = 'none';
  }

  get visible(): boolean {
    return this.view.visible;
  }

  set visible(value: boolean) {
    this.view.visible = value;
    this.sinceRefresh = Infinity;
  }

  /** Call once per rendered frame. */
  refresh(frameMs: number, extra: { steps: number; scenes: string }): void {
    if (!this.view.visible) return;
    this.sinceRefresh += frameMs;
    if (this.sinceRefresh < 250) return;
    this.sinceRefresh = 0;
    const s = this.counter.stats;
    this.text.text =
      `FPS   ${s.fps.toFixed(1)}\n` +
      `frame ${s.avgMs.toFixed(2)}ms (max ${s.maxMs.toFixed(1)})\n` +
      `slow  ${s.slowFrames}  steps ${extra.steps}\n` +
      `scene ${extra.scenes}`;
    this.bg
      .clear()
      .roundRect(0, 0, this.text.width + 16, this.text.height + 12, 4)
      .fill({ color: 0x000000, alpha: 0.6 });
  }
}
