/**
 * Tooltips for things on screen (icons, badges, slots).
 *
 * - Mouse: hovering a registered target shows its tooltip after a short delay.
 * - Keyboard: `InspectWidget` (pushed on a `FocusStack`) puts a cursor on the targets; the
 *   arrows / WASD move it to the nearest target in that direction and its tooltip shows.
 *   Confirm or back closes it. So every tooltip is reachable without a mouse.
 *
 * Targets are Pixi containers; positions come from their bounds in the layer's coordinates.
 */

import { CanvasTextMetrics, Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Widget } from './focus-stack';
import { Panel } from './panel';
import { pixelRoundStroke } from './pixel-shapes';
import { firstInReadingOrder, nearestInDirection, type NavRect } from './spatial-nav';
import type { UiTheme } from './theme';
import type { UiInput } from './ui-input';
import { uiSound } from './ui-sound';

export interface TooltipContent {
  readonly title: string;
  readonly body?: string;
  /** Title color (default: theme title color). */
  readonly accent?: number;
}

export type TooltipSource = TooltipContent | (() => TooltipContent);

export interface TooltipLayerOptions {
  readonly theme: UiTheme;
  /** Visible area in layer coordinates (tooltips are kept inside it). */
  readonly area: () => { readonly width: number; readonly height: number };
  /** Seconds of hovering before a tooltip shows. Default 0.35. */
  readonly hoverDelay?: number;
  /** Maximum tooltip width. Default 150. */
  readonly maxWidth?: number;
}

interface Registered {
  readonly target: Container;
  readonly source: TooltipSource;
  readonly over: () => void;
  readonly out: () => void;
}

const GAP = 3;
const MARGIN = 4;

/** Owns the tooltip view and the registered targets. Put `view` above everything it covers. */
export class TooltipLayer {
  readonly view = new Container({ label: 'tooltips' });
  private readonly targets: Registered[] = [];
  private readonly tip = new Container({ label: 'tooltip' });
  private readonly panel: Panel;
  private readonly title: Text;
  private readonly body: Text;
  private hovered: Container | undefined;
  private hoverTime = 0;
  private shownFor: Container | undefined;
  /** While set (keyboard inspect), hover does not change the tooltip. */
  private pinned: Container | undefined;

  constructor(private readonly options: TooltipLayerOptions) {
    const { theme } = options;
    this.panel = new Panel(theme);
    this.title = new Text({
      text: '',
      style: {
        fontFamily: theme.font.family,
        fontSize: theme.font.size,
        fontWeight: '800',
        fill: theme.colors.title,
      },
    });
    this.body = new Text({ text: '', style: this.bodyStyle() });
    this.tip.addChild(this.panel.view, this.title, this.body);
    this.tip.visible = false;
    this.tip.eventMode = 'none';
    this.view.addChild(this.tip);
  }

  /** Shows `source` when `target` is hovered or inspected. Returns an unregister function. */
  register(target: Container, source: TooltipSource): () => void {
    const entry: Registered = {
      target,
      source,
      over: () => {
        this.hovered = target;
        this.hoverTime = 0;
      },
      out: () => {
        if (this.hovered === target) this.hovered = undefined;
      },
    };
    if (target.eventMode === 'passive' || target.eventMode === 'auto') target.eventMode = 'static';
    target.on('pointerover', entry.over);
    target.on('pointerout', entry.out);
    this.targets.push(entry);
    return () => this.unregister(target);
  }

  unregister(target: Container): void {
    const i = this.targets.findIndex((t) => t.target === target);
    if (i < 0) return;
    const [entry] = this.targets.splice(i, 1);
    if (entry) {
      target.off('pointerover', entry.over);
      target.off('pointerout', entry.out);
    }
    if (this.hovered === target) this.hovered = undefined;
    if (this.shownFor === target) this.hide();
    if (this.pinned === target) this.pinned = undefined;
  }

  /** Visible targets and their rects (layer coordinates), in registration order. */
  visibleTargets(): { readonly target: Container; readonly rect: NavRect }[] {
    return this.targets
      .filter((t) => isShown(t.target))
      .map((t) => ({ target: t.target, rect: this.rectOf(t.target) }));
  }

  rectOf(target: Container): NavRect {
    const b = target.getBounds();
    const p = this.view.toLocal({ x: b.x, y: b.y });
    const q = this.view.toLocal({ x: b.x + b.width, y: b.y + b.height });
    return { x: p.x, y: p.y, width: q.x - p.x, height: q.y - p.y };
  }

  /** Keyboard inspect: show `target`'s tooltip and ignore hover until `unpin`. */
  pin(target: Container): void {
    this.pinned = target;
    this.show(target);
  }

  unpin(): void {
    this.pinned = undefined;
    this.hide();
  }

  update(dt: number): void {
    if (this.pinned) {
      if (!isShown(this.pinned)) this.unpin();
      return;
    }
    if (this.hovered && isShown(this.hovered)) {
      this.hoverTime += dt;
      if (this.shownFor !== this.hovered && this.hoverTime >= (this.options.hoverDelay ?? 0.35)) {
        this.show(this.hovered);
      }
    } else if (this.shownFor) {
      this.hide();
    }
  }

  show(target: Container): void {
    const entry = this.targets.find((t) => t.target === target);
    if (!entry) return;
    const content = typeof entry.source === 'function' ? entry.source() : entry.source;
    this.layout(content, this.rectOf(target));
    this.shownFor = target;
    this.tip.visible = true;
  }

  hide(): void {
    this.shownFor = undefined;
    this.tip.visible = false;
  }

  get visible(): boolean {
    return this.tip.visible;
  }

  /** The tooltip's current text (for tests and tools). */
  get text(): { title: string; body: string } {
    return { title: this.title.text, body: this.body.text };
  }

  private bodyStyle(): TextStyle {
    const { theme } = this.options;
    return new TextStyle({
      fontFamily: theme.font.family,
      fontSize: theme.font.size,
      lineHeight: theme.font.lineHeight,
      fill: theme.colors.text,
      wordWrap: true,
      wordWrapWidth: (this.options.maxWidth ?? 150) - theme.spacing.panel * 2,
    });
  }

  private layout(content: TooltipContent, rect: NavRect): void {
    const { theme } = this.options;
    const pad = theme.spacing.panel;
    this.title.text = content.title;
    this.title.style.fill = content.accent ?? theme.colors.title;
    const style = this.bodyStyle();
    const wrapped = content.body
      ? CanvasTextMetrics.measureText(content.body, style).lines.join('\n')
      : '';
    this.body.text = wrapped;
    this.body.visible = wrapped.length > 0;
    const titleH = Math.ceil(this.title.height);
    this.title.position.set(pad, pad - 1);
    this.body.position.set(pad, pad - 1 + titleH);
    const w = Math.ceil(Math.max(this.title.width, wrapped ? this.body.width : 0) + pad * 2);
    const h = Math.ceil(titleH + (wrapped ? this.body.height : 0) + pad * 2 - 1);
    this.panel.resize(w, h);

    const area = this.options.area();
    let x = Math.round(rect.x + rect.width / 2 - w / 2);
    x = Math.max(MARGIN, Math.min(area.width - MARGIN - w, x));
    let y = Math.round(rect.y + rect.height + GAP);
    if (y + h > area.height - MARGIN) y = Math.round(rect.y - GAP - h);
    this.tip.position.set(x, Math.max(MARGIN, y));
  }
}

function isShown(c: Container): boolean {
  if (c.destroyed) return false;
  for (let n: Container | null = c; n; n = n.parent) if (!n.visible) return false;
  return c.parent !== null;
}

export interface InspectOptions {
  readonly layer: TooltipLayer;
  /** Highlight color of the inspect cursor. */
  readonly color: number;
  /** Target to start on (default: the last one inspected, else the first in reading order). */
  readonly start?: Container;
  readonly onClose: (widget: InspectWidget) => void;
}

/**
 * Keyboard inspect mode: a blinking frame on one tooltip target, moved with the directions.
 * Confirm / back (or a click anywhere) closes it.
 */
export class InspectWidget implements Widget<Container> {
  readonly view = new Container({ label: 'inspect' });
  private readonly frame = new Graphics();
  private current: Container | undefined;
  private blink = 0;

  constructor(private readonly options: InspectOptions) {
    this.view.addChild(this.frame);
    this.view.eventMode = 'none';
  }

  get target(): Container | undefined {
    return this.current;
  }

  focus(): void {
    const targets = this.options.layer.visibleTargets();
    const start = this.options.start;
    const pick =
      start && targets.some((t) => t.target === start)
        ? start
        : targets[firstInReadingOrder(targets.map((t) => t.rect)) ?? -1]?.target;
    uiSound('open');
    this.select(pick);
  }

  blur(): void {
    this.options.layer.unpin();
    this.frame.clear();
  }

  contains(): boolean {
    return false;
  }

  dismiss(): void {
    this.options.onClose(this);
  }

  handleInput(input: UiInput): void {
    if (input.confirmPressed() || input.backPressed()) {
      uiSound('back');
      this.options.onClose(this);
      return;
    }
    const dir = input.direction();
    if (!dir) return;
    const targets = this.options.layer.visibleTargets();
    const from = targets.findIndex((t) => t.target === this.current);
    if (from < 0) {
      this.select(targets[firstInReadingOrder(targets.map((t) => t.rect)) ?? -1]?.target);
      return;
    }
    const next = nearestInDirection(
      targets.map((t) => t.rect),
      from,
      dir,
    );
    if (next !== undefined) {
      uiSound('move');
      this.select(targets[next]?.target);
    }
  }

  update(dt: number): void {
    this.blink = (this.blink + dt) % 0.8;
    this.frame.alpha = this.blink < 0.55 ? 1 : 0.35;
  }

  private select(target: Container | undefined): void {
    this.current = target;
    this.frame.clear();
    if (!target) {
      this.options.layer.unpin();
      return;
    }
    const r = this.options.layer.rectOf(target);
    const x = Math.round(r.x) - 2;
    const y = Math.round(r.y) - 2;
    pixelRoundStroke(
      this.frame,
      x,
      y,
      Math.round(r.width) + 4,
      Math.round(r.height) + 4,
      2,
      this.options.color,
    );
    this.options.layer.pin(target);
  }
}
