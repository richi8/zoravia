/**
 * Dialog box with typewriter text, an optional speaker name, and a blinking "more" marker.
 * `E` advances (hold to speed up), `Q` finishes the current page.
 * A left click anywhere on screen while the dialog is focused works like `Q` while the page
 * is typing and like `E` once it is finished — so click once to show the page, again to go on.
 * Pages are word-wrapped up front so words never jump lines while typing.
 */

import { CanvasTextMetrics, Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Widget } from './focus-stack';
import { Panel } from './panel';
import type { UiTheme } from './theme';
import { Typewriter } from './typewriter';
import type { UiInput } from './ui-input';

export interface DialogOptions {
  readonly pages: readonly string[];
  readonly theme: UiTheme;
  readonly width: number;
  /** Visible text lines. Default 3. */
  readonly lines?: number;
  readonly speaker?: string;
  readonly onDone?: (dialog: DialogBox) => void;
}

export class DialogBox implements Widget<Container> {
  readonly view = new Container({ label: 'dialog' });
  readonly typewriter: Typewriter;
  private readonly panel: Panel;
  private readonly body: Text;
  private readonly more = new Graphics();
  private readonly wrapped: string[];
  private blinkTime = 0;
  private doneFired = false;
  /** Confirm held during the last input step (speeds up typing). */
  private held = false;

  constructor(private readonly options: DialogOptions) {
    const { theme, width } = options;
    const pad = theme.spacing.panel;
    const lines = options.lines ?? 3;
    const style = new TextStyle({
      fontFamily: theme.font.family,
      fontSize: theme.font.size,
      lineHeight: theme.font.lineHeight,
      fill: theme.colors.text,
      wordWrap: true,
      wordWrapWidth: width - pad * 2,
    });
    // Pre-wrap each page with the real font metrics, then reveal the wrapped string.
    this.wrapped = options.pages.map((p) =>
      CanvasTextMetrics.measureText(p, style).lines.join('\n'),
    );
    this.typewriter = new Typewriter(this.wrapped, {
      charsPerSecond: theme.motion.textSpeed,
      fastMultiplier: theme.motion.textFastMultiplier,
    });

    this.panel = new Panel(theme);
    this.panel.resize(width, pad * 2 + theme.font.lineHeight * lines);
    this.body = new Text({ text: '', style: { ...style, wordWrap: false } });
    this.body.position.set(pad, pad);
    this.view.addChild(this.panel.view, this.body, this.more);

    if (options.speaker) {
      const name = new Text({
        text: options.speaker,
        style: {
          fontFamily: theme.font.family,
          fontSize: theme.font.titleSize,
          fontWeight: '700',
          fill: theme.colors.title,
        },
      });
      const tag = new Panel(theme);
      const tagPad = Math.max(2, Math.round(pad / 2));
      tag.resize(Math.ceil(name.width) + tagPad * 2, Math.ceil(name.height) + tagPad);
      tag.view.position.set(pad, -tag.height + theme.borderWidth);
      name.position.set(tagPad, Math.round(tagPad / 2));
      tag.view.addChild(name);
      this.view.addChild(tag.view);
    }

    if (theme.skin?.more) {
      theme.skin.more(this.more);
      this.more.position.set(width - pad, this.panel.height - pad);
    } else {
      const s = theme.font.size * 0.3;
      this.more.poly([-s, -s * 0.6, s, -s * 0.6, 0, s * 0.6]).fill({ color: theme.colors.accent });
      this.more.position.set(width - pad, this.panel.height - pad * 0.9);
    }
    this.more.visible = false;

    this.view.eventMode = 'static';
    this.view.cursor = 'pointer';
  }

  get width(): number {
    return this.panel.width;
  }

  get height(): number {
    return this.panel.height;
  }

  get done(): boolean {
    return this.typewriter.done;
  }

  blur(): void {
    this.held = false;
  }

  handleInput(input: UiInput): void {
    // Clicks are taken from anywhere on screen (the dialog is modal while focused).
    const click = input.pointerPressed() !== undefined;
    const typing = !this.typewriter.pageComplete;
    const changed = this.typewriter.update(0, {
      confirmPressed: input.confirmPressed() || (click && !typing),
      confirmHeld: false,
      backPressed: input.backPressed() || (click && typing),
    });
    this.held = input.confirmHeld(); // applied as speed-up in update()
    if (changed) this.refresh();
  }

  update(dt: number): void {
    if (this.typewriter.done) {
      if (!this.doneFired) {
        this.doneFired = true;
        this.options.onDone?.(this);
      }
      return;
    }
    if (
      this.typewriter.update(dt, {
        confirmPressed: false,
        confirmHeld: this.held,
        backPressed: false,
      })
    ) {
      this.refresh();
    }
    this.blinkTime = (this.blinkTime + dt) % this.options.theme.motion.blink;
    this.more.visible =
      this.typewriter.pageComplete && this.blinkTime < this.options.theme.motion.blink * 0.6;
  }

  private refresh(): void {
    this.body.text = this.typewriter.visibleText;
    if (!this.typewriter.pageComplete) this.blinkTime = 0;
  }
}
