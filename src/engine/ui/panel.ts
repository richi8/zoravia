import { Container, Graphics } from 'pixi.js';
import type { UiTheme } from './theme';

/** Rounded, bordered background box. Call `resize` to set its size. */
export class Panel {
  readonly view = new Container({ label: 'panel' });
  private readonly bg = new Graphics();
  private w = 0;
  private h = 0;

  constructor(private theme: UiTheme) {
    this.view.addChild(this.bg);
  }

  get width(): number {
    return this.w;
  }

  get height(): number {
    return this.h;
  }

  resize(width: number, height: number): void {
    this.w = width;
    this.h = height;
    this.draw();
  }

  setTheme(theme: UiTheme): void {
    this.theme = theme;
    this.draw();
  }

  private draw(): void {
    const { colors, radius, borderWidth } = this.theme;
    const inset = borderWidth / 2;
    this.bg
      .clear()
      .roundRect(inset, inset, this.w - borderWidth, this.h - borderWidth, radius)
      .fill({ color: colors.panel, alpha: colors.panelAlpha })
      .stroke({ color: colors.border, width: borderWidth });
  }
}
