/**
 * Focusable list (`columns: 1`) or grid menu with a highlighted, wrapping cursor.
 *
 * Keyboard: directions move (with auto-repeat), confirm selects, back calls `onBack`.
 * Mouse: hovering an item moves the cursor, left click selects it (right click = back via
 * the input bindings). Pointer events are queued and applied in `handleInput`, so all menu
 * logic still runs inside the fixed step.
 */

import { Container, Graphics, Rectangle, Text, type TextStyleOptions } from 'pixi.js';
import type { Widget } from './focus-stack';
import { GridCursor } from './grid-cursor';
import { Panel } from './panel';
import type { UiTheme } from './theme';
import type { UiInput } from './ui-input';

export interface MenuItem {
  readonly label: string;
  readonly disabled?: boolean;
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
}

interface Row {
  readonly view: Container;
  readonly bg: Graphics;
  readonly text: Text;
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
    this.redraw();
  }

  handleInput(input: UiInput): void {
    if (this.pendingHover !== undefined) {
      if (this.cursor.set(this.pendingHover)) this.highlightChanged();
      this.pendingHover = undefined;
    }
    if (this.pendingClick !== undefined) {
      const i = this.pendingClick;
      this.pendingClick = undefined;
      if (this.enabled(i)) {
        this.cursor.set(i);
        this.redraw();
        this.options.onSelect(i, this);
        return;
      }
    }
    const dir = input.direction();
    if (dir && this.cursor.move(dir)) this.highlightChanged();
    if (input.confirmPressed() && this.cursor.index >= 0) {
      this.options.onSelect(this.cursor.index, this);
    } else if (input.backPressed()) {
      this.options.onBack?.(this);
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
    const widest = Math.max(0, ...texts.map((t) => t.width));
    this.cellH = theme.font.lineHeight + theme.spacing.item * 2;
    const titleH = this.titleText ? this.titleText.height + theme.spacing.item : 0;
    const gap = theme.spacing.column;
    const naturalCell = marker + widest + theme.spacing.item * 2;
    const outerW = this.options.width ?? Math.ceil(pad * 2 + naturalCell * cols + gap * (cols - 1));
    this.cellW = (outerW - pad * 2 - gap * (cols - 1)) / cols;

    texts.forEach((text, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const view = new Container();
      view.position.set(pad + col * (this.cellW + gap), pad + titleH + row * this.cellH);
      const bg = new Graphics();
      text.position.set(theme.spacing.item + marker, (this.cellH - text.height) / 2);
      view.addChild(bg, text);
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
      this.rows.push({ view, bg, text });
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
      if (selected) {
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
