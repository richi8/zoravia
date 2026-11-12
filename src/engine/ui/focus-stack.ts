/**
 * Stack of focusable widgets for nested menus and dialogs.
 *
 * Only the top widget receives input; all stay visible. Opening or closing a widget blurs
 * / focuses the right one and suppresses held keys, so the `E` that opened a submenu does
 * not also act inside it. Renderer-agnostic via attach/detach callbacks.
 */

import type { UiInput } from './ui-input';

export interface Widget<V = unknown> {
  readonly view: V;
  focus?(): void;
  blur?(): void;
  /** Called once per step while this widget is on top. */
  handleInput(input: UiInput): void;
  /** Called once per step for every widget on the stack. */
  update?(dt: number): void;
}

export interface FocusHost<V> {
  attach(view: V): void;
  detach(view: V): void;
}

export class FocusStack<V = unknown> {
  private readonly widgets: Widget<V>[] = [];
  /** Called when the last widget is removed. */
  onEmpty: (() => void) | undefined;

  constructor(
    private readonly host: FocusHost<V>,
    private readonly input: UiInput,
  ) {}

  get top(): Widget<V> | undefined {
    return this.widgets[this.widgets.length - 1];
  }

  get size(): number {
    return this.widgets.length;
  }

  includes(widget: Widget<V>): boolean {
    return this.widgets.includes(widget);
  }

  push(widget: Widget<V>): void {
    if (this.widgets.includes(widget)) return;
    this.top?.blur?.();
    this.widgets.push(widget);
    this.host.attach(widget.view);
    widget.focus?.();
    this.input.suppressHeld();
  }

  /** Removes the top widget. */
  pop(): Widget<V> | undefined {
    const top = this.top;
    if (top) this.remove(top);
    return top;
  }

  /** Removes `widget` (and everything above it). */
  remove(widget: Widget<V>): void {
    const i = this.widgets.indexOf(widget);
    if (i < 0) return;
    const removed = this.widgets.splice(i);
    for (const w of removed.reverse()) {
      w.blur?.();
      this.host.detach(w.view);
    }
    this.top?.focus?.();
    this.input.suppressHeld();
    if (this.widgets.length === 0) this.onEmpty?.();
  }

  update(dt: number): void {
    this.top?.handleInput(this.input);
    for (const w of [...this.widgets]) w.update?.(dt);
  }
}
