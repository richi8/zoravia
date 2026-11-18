/**
 * Focusable list (`columns: 1`) or grid menu with a highlighted, wrapping cursor.
 *
 * Keyboard: directions move (with auto-repeat), confirm selects, back calls `onBack`.
 * Mouse: hovering an item moves the cursor, left click selects it (right click = back via
 * the input bindings; a click outside the menu also acts as back, via `FocusStack`).
 * Pointer events are queued and applied in `handleInput`, so all menu
 * logic still runs inside the fixed step.
 * Steppers (C44): an item with `stepper` shows `‹ value ›` around its hint; clicking an arrow
 * calls `onStep` with -1 / +1 (the mouse twin of A/D on a value).
 */

import { Container, Graphics, Rectangle, Text, type TextStyleOptions } from 'pixi.js';
import type { Widget } from './focus-stack';
import { GridCursor } from './grid-cursor';
import { Panel } from './panel';
import type { UiTheme } from './theme';
import type { UiInput } from './ui-input';
import { uiSound } from './ui-sound';

export interface MenuItem {
  readonly label: string;
  readonly disabled?: boolean;
  /** Small graphic drawn before the label (e.g. a type icon); called on every rebuild. */
  readonly icon?: () => Container;
  /** Dim text right-aligned in the row (e.g. a key hint). */
  readonly hint?: string;
  /** Draw clickable ‹ › arrows around the hint; a click calls `onStep` (C44). */
  readonly stepper?: boolean;
}

export interface MenuOptions {
  readonly items: readonly MenuItem[];
  readonly theme: UiTheme;
  readonly columns?: number;
  readonly title?: string;
  /** Fixed outer width; default fits the widest label. */
  readonly width?: number;
  readonly onSelect: (index: number, menu: Menu) => void;
  readonly onBack?: (menu: Menu) => void;
  readonly onHighlight?: (index: number, menu: Menu) => void;
  /** A click on a stepper arrow: -1 (‹) or +1 (›). */
  readonly onStep?: (index: number, step: 1 | -1, menu: Menu) => void;
  /**
   * Least width of the value between the arrows. The slot is as wide as the widest stepper
   * value shown, and at least this, so the arrows don't move as values change.
   */
  readonly valueWidth?: number;
}

/** Width of one stepper arrow's hit box. */
const STEP_W = 10;

interface Row {
  readonly view: Container;
  readonly bg: Graphics;
  readonly text: Text;
  readonly hint: Text | undefined;
}

export class Menu implements Widget<Container> {
  readonly view = new Container({ label: 'menu' });
  readonly cursor: GridCursor;
  private readonly panel: Panel;
  private readonly rowsLayer = new Container();
  private titleText: Text | undefined;
  private items: MenuItem[];
  private rows: Row[] = [];
  private focused = false;
  private pendingHover: number | undefined;
  private pendingClick: number | undefined;
  private pendingStep: { index: number; step: 1 | -1 } | undefined;
  private cellW = 0;
  private cellH = 0;

  constructor(private readonly options: MenuOptions) {
    this.items = [...options.items];
    this.cursor = new GridCursor(this.items.length, options.columns ?? 1, (i) => this.enabled(i));
    this.panel = new Panel(options.theme);
    this.view.addChild(this.panel.view, this.rowsLayer);
    if (options.title) {
      this.titleText = new Text({
        text: options.title.toUpperCase(),
        style: this.style(options.theme.colors.title, options.theme.font.titleSize, '700'),
      });
      this.view.addChild(this.titleText);
    }
    this.build();
  }

  get width(): number {
    return this.panel.width;
  }

  get height(): number {
    return this.panel.height;
  }

  get index(): number {
    return this.cursor.index;
  }

  get selectedItem(): MenuItem | undefined {
    return this.items[this.cursor.index];
  }

  setItems(items: readonly MenuItem[]): void {
    this.items = [...items];
    this.cursor.reset(this.items.length);
    this.build();
  }

  setLabel(index: number, label: string): void {
    const item = this.items[index];
    const row = this.rows[index];
    if (!item || !row) return;
    this.items[index] = { ...item, label };
    row.text.text = label;
  }

  contains(x: number, y: number): boolean {
    const b = this.view.getBounds();
    return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
  }

  /** Click outside the menu: same as `back`. */
  dismiss(): void {
    this.options.onBack?.(this);
  }

  focus(): void {
    this.focused = true;
    this.view.interactiveChildren = true;
    this.redraw();
  }

  blur(): void {
    this.focused = false;
    this.view.interactiveChildren = false;
    this.pendingClick = undefined;
    this.pendingHover = undefined;
    this.pendingStep = undefined;
    this.redraw();
  }

  handleInput(input: UiInput): void {
    if (this.pendingStep) {
      const { index, step } = this.pendingStep;
      this.pendingStep = undefined;
      this.pendingClick = undefined;
      this.pendingHover = undefined;
      if (this.cursor.index !== index && this.cursor.set(index)) this.highlightChanged();
      this.options.onStep?.(index, step, this);
      return;
    }
    if (this.pendingHover !== undefined) {
      if (this.cursor.set(this.pendingHover)) {
        uiSound('move');
        this.highlightChanged();
      }
      this.pendingHover = undefined;
    }
    if (this.pendingClick !== undefined) {
      const i = this.pendingClick;
      this.pendingClick = undefined;
      if (this.enabled(i)) {
        this.cursor.set(i);
        this.redraw();
        uiSound('select');
        this.options.onSelect(i, this);
        return;
      }
      uiSound('blocked');
    }
    const dir = input.direction();
    if (dir && this.cursor.move(dir)) {
      uiSound('move');
      this.highlightChanged();
    }
    if (input.confirmPressed() && this.cursor.index >= 0) {
      uiSound('select');
      this.options.onSelect(this.cursor.index, this);
    } else if (input.confirmPressed()) {
      uiSound('blocked');
    } else if (input.backPressed() && this.options.onBack) {
      uiSound('back');
      this.options.onBack(this);
    }
  }

  private highlightChanged(): void {
    this.redraw();
    this.options.onHighlight?.(this.cursor.index, this);
  }

  private enabled(i: number): boolean {
    const item = this.items[i];
    return !!item && !item.disabled;
  }

  private style(fill: number, size: number, weight: '400' | '700' = '400'): TextStyleOptions {
    return { fontFamily: this.options.theme.font.family, fontSize: size, fill, fontWeight: weight };
  }

  private build(): void {
    const { theme } = this.options;
    const pad = theme.spacing.panel;
    const cols = this.cursor.columns;
    for (const r of this.rows) r.view.destroy({ children: true });
    this.rows = [];

    const marker = theme.font.size; // room for the cursor marker
    const texts = this.items.map(
      (item) =>
        new Text({ text: item.label, style: this.style(theme.colors.text, theme.font.size) }),
    );
    const icons = this.items.map((item) => item.icon?.());
    const hints = this.items.map((item) =>
      item.hint
        ? new Text({
            text: item.hint,
            style: this.style(theme.colors.textDim, theme.font.titleSize, '700'),
          })
        : undefined,
    );
    const iconW = (i: number): number => {
      const icon = icons[i];
      return icon ? Math.ceil(icon.width) + 3 : 0;
    };
    const slotW = Math.ceil(
      Math.max(
        this.options.valueWidth ?? 0,
        ...hints.map((h, i) => (h && this.items[i]?.stepper ? h.width : 0)),
      ),
    );
    const arrowsW = (i: number): number =>
      this.items[i]?.stepper ? STEP_W * 2 + slotW - (hints[i]?.width ?? 0) : 0;
    const widest = Math.max(
      0,
      ...texts.map((t, i) => t.width + iconW(i) + (hints[i] ? hints[i].width + 8 : 0) + arrowsW(i)),
    );
    this.cellH = theme.font.lineHeight + theme.spacing.item * 2;
    const titleH = this.titleText ? Math.ceil(this.titleText.height) + theme.spacing.item : 0;
    const gap = theme.spacing.column;
    const naturalCell = marker + widest + theme.spacing.item * 2;
    const outerW = this.options.width ?? Math.ceil(pad * 2 + naturalCell * cols + gap * (cols - 1));
    this.cellW = Math.floor((outerW - pad * 2 - gap * (cols - 1)) / cols);

    texts.forEach((text, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const view = new Container();
      view.position.set(pad + col * (this.cellW + gap), pad + titleH + row * this.cellH);
      const bg = new Graphics();
      const icon = icons[i];
      const x0 = theme.spacing.item + marker;
      text.position.set(x0 + iconW(i), Math.round((this.cellH - text.height) / 2));
      view.addChild(bg, text);
      if (icon) {
        icon.position.set(x0, Math.round((this.cellH - icon.height) / 2));
        view.addChild(icon);
      }
      const hint = hints[i];
      const right = this.cellW - theme.spacing.item - 4;
      const stepper = !!this.items[i]?.stepper;
      if (hint) {
        // A stepper's value is centered in a fixed slot between its arrows.
        const x = stepper ? right - STEP_W - slotW + (slotW - hint.width) / 2 : right - hint.width;
        hint.position.set(Math.round(x), Math.round((this.cellH - hint.height) / 2));
        view.addChild(hint);
      }
      if (hint && stepper) {
        const arrow = (label: string, x: number, step: 1 | -1): void => {
          const a = new Container();
          const t = new Text({
            text: label,
            style: this.style(theme.colors.accent, theme.font.titleSize, '700'),
          });
          t.position.set(Math.round((STEP_W - t.width) / 2), 0);
          a.addChild(t);
          a.position.set(Math.round(x), Math.round((this.cellH - t.height) / 2));
          a.hitArea = new Rectangle(0, -2, STEP_W, t.height + 4);
          a.eventMode = 'static';
          a.cursor = 'pointer';
          a.on('pointertap', (e) => {
            e.stopPropagation();
            if (this.focused && e.button === 0) this.pendingStep = { index: i, step };
          });
          view.addChild(a);
        };
        arrow('‹', right - STEP_W * 2 - slotW, -1);
        arrow('›', right - STEP_W, 1);
      }
      view.eventMode = 'static';
      view.cursor = 'pointer';
      view.hitArea = new Rectangle(0, 0, this.cellW, this.cellH);
      view.on('pointerover', () => {
        if (this.focused) this.pendingHover = i;
      });
      view.on('pointertap', (e) => {
        if (this.focused && e.button === 0) this.pendingClick = i;
      });
      this.rowsLayer.addChild(view);
      this.rows.push({ view, bg, text, hint });
    });

    this.titleText?.position.set(pad + theme.spacing.item, pad - 2);
    const outerH = Math.ceil(pad * 2 + titleH + this.cursor.rows * this.cellH);
    this.panel.resize(outerW, outerH);
    this.redraw();
  }

  private redraw(): void {
    const { colors, radius } = this.options.theme;
    this.rows.forEach((row, i) => {
      const item = this.items[i];
      const selected = i === this.cursor.index;
      row.bg.clear();
      const skin = this.options.theme.skin;
      if (selected && skin?.cursor) {
        skin.cursor(row.bg, this.cellW, this.cellH, this.focused);
      } else if (selected) {
        row.bg
          .roundRect(0, 0, this.cellW, this.cellH, Math.max(2, radius - 2))
          .fill({ color: colors.cursorBg, alpha: this.focused ? 1 : 0.45 });
        // Cursor marker: a small triangle left of the label.
        const s = this.options.theme.font.size * 0.35;
        const cx = this.options.theme.spacing.item + s;
        const cy = this.cellH / 2;
        row.bg
          .poly([cx - s * 0.6, cy - s, cx + s * 0.8, cy, cx - s * 0.6, cy + s])
          .fill({ color: this.focused ? colors.accent : colors.textDim });
      }
      row.text.style.fill = item?.disabled
        ? colors.textDisabled
        : selected
          ? colors.cursorText
          : colors.text;
      row.view.cursor = item?.disabled ? 'default' : 'pointer';
    });
  }
}
