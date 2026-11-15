/**
 * Dialog box with typewriter text, an optional speaker name, and a blinking "more" marker.
 * `E` advances (hold to speed up), `Q` finishes the current page.
 * A left click anywhere on screen while the dialog is focused works like `Q` while the page
 * is typing and like `E` once it is finished — so click once to show the page, again to go on.
 * Pages are word-wrapped up front so words never jump lines while typing; a page longer than
 * the box continues on extra pages.
 * With `onLastPage`, the box stays on its last page once it is shown (for a choice menu on
 * top) and the owner removes it.
 */

import { CanvasTextMetrics, Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Widget } from './focus-stack';
import { Panel } from './panel';
import type { UiTheme } from './theme';
import { Typewriter } from './typewriter';
import type { UiInput } from './ui-input';
import { uiSound } from './ui-sound';

export interface DialogOptions {
  readonly pages: readonly string[];
  readonly theme: UiTheme;
  readonly width: number;
  /** Visible text lines. Default 3. */
  readonly lines?: number;
  readonly speaker?: string;
  readonly onDone?: (dialog: DialogBox) => void;
  /**
   * Called once when the last page is fully shown. The box then stays on it (confirm no
   * longer closes it) and `onDone` never fires.
   */
  readonly onLastPage?: (dialog: DialogBox) => void;
  /**
   * Called as the typewriter reveals text on its own (not when a page is skipped), with the
   * characters revealed since the last call: the hook for text blips.
   */
  readonly onType?: (revealed: string) => void;
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
  private lastFired = false;
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
    // Pre-wrap each page with the real font metrics, then reveal the wrapped string. A page
    // that wraps to more lines than the box shows goes on over the next pages.
    this.wrapped = options.pages.flatMap((p) => {
      const all = CanvasTextMetrics.measureText(p, style).lines;
      const out: string[] = [];
      for (let i = 0; i < all.length; i += lines) out.push(all.slice(i, i + lines).join('\n'));
      return out.length ? out : [''];
    });
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

  /** Holding on the last page (see `onLastPage`). */
  private get holding(): boolean {
    return (
      this.options.onLastPage !== undefined &&
      this.typewriter.isLastPage &&
      this.typewriter.pageComplete
    );
  }

  handleInput(input: UiInput): void {
    if (this.holding) return;
    // Clicks are taken from anywhere on screen (the dialog is modal while focused).
    const click = input.pointerPressed() !== undefined;
    const typing = !this.typewriter.pageComplete;
    const advance = !typing && (input.confirmPressed() || click);
    const changed = this.typewriter.update(0, {
      confirmPressed: input.confirmPressed() || (click && !typing),
      confirmHeld: false,
      backPressed: input.backPressed() || (click && typing),
    });
    this.held = input.confirmHeld(); // applied as speed-up in update()
    if (advance && changed) uiSound('advance');
    if (changed) this.refresh();
  }

  update(dt: number): void {
    if (this.holding) {
      this.more.visible = false;
      if (!this.lastFired) {
        this.lastFired = true;
        this.options.onLastPage?.(this);
      }
      return;
    }
    if (this.typewriter.done) {
      if (!this.doneFired) {
        this.doneFired = true;
        this.options.onDone?.(this);
      }
      return;
    }
    const page = this.typewriter.page;
    const before = this.typewriter.visibleText.length;
    if (
      this.typewriter.update(dt, {
        confirmPressed: false,
        confirmHeld: this.held,
        backPressed: false,
      })
    ) {
      if (this.typewriter.page === page && this.options.onType) {
        const text = this.typewriter.visibleText;
        if (text.length > before) this.options.onType(text.slice(before));
      }
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
