import { Container, Graphics, Text } from 'pixi.js';
import { math } from '@engine/core';
import type { Scene } from '@engine/scenes/scene-manager';

export interface PlaceholderOptions {
  readonly id: string;
  readonly title: string;
  readonly background: number;
  readonly accent: number;
}

/**
 * Debug placeholder: colored background, title, and a spinning square that is updated at
 * the fixed step and interpolated at render time (visual check for smooth 60fps).
 */
export class PlaceholderScene implements Scene<Container> {
  readonly id: string;
  readonly view = new Container();
  private readonly bg = new Graphics();
  private readonly square = new Graphics();
  private readonly title: Text;
  private readonly hint: Text;
  private angle = 0;
  private prevAngle = 0;

  constructor(private readonly options: PlaceholderOptions) {
    this.id = options.id;
    this.view.label = `scene:${options.id}`;
    this.title = new Text({
      text: options.title,
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 48,
        fontWeight: '700',
        fill: 0xffffff,
      },
    });
    this.hint = new Text({
      text: 'Space / Enter / click — switch scene    F3 — FPS overlay',
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 16, fill: 0xffffff },
    });
    this.hint.alpha = 0.7;
    this.title.anchor.set(0.5);
    this.hint.anchor.set(0.5);
    this.square.rect(-40, -40, 80, 80).fill({ color: options.accent });
    this.view.addChild(this.bg, this.square, this.title, this.hint);
  }

  update(dt: number): void {
    this.prevAngle = this.angle;
    this.angle += dt * Math.PI; // half a turn per second
  }

  render(alpha: number): void {
    this.square.rotation = math.lerp(this.prevAngle, this.angle, alpha);
  }

  resize(width: number, height: number): void {
    this.bg.clear().rect(0, 0, width, height).fill({ color: this.options.background });
    this.square.position.set(width / 2, height / 2 - 90);
    this.title.position.set(width / 2, height / 2 + 20);
    this.hint.position.set(width / 2, height / 2 + 80);
  }
}
