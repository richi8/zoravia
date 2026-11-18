/**
 * Dex screen (C22, `B`): every species in Dex order on the left (unseen ones as "???"),
 * the selected one on the right. Seen species show their sprite, name and types; caught ones
 * also their description. Since C42 it has tabs: All, then one per region, each with its own
 * "Seen · Caught / total", and a seen species lists the zones the player found it in.
 *
 * Keyboard: W/S choose (the list scrolls), A/D page, Z/Tab next tab, Q back. Mouse:
 * hover/click rows, click a tab, the wheel scrolls the list (C43).
 */

import { Container, Graphics, Rectangle, Sprite, type Texture } from 'pixi.js';
import { GridCursor, type UiInput, type Widget, uiSound, WheelSteps } from '@engine/ui';
import { paper, type TypeId } from '../style/tokens';
import { KeyHint, TypeBadge, row } from './badges';
import { keyHint, leftRightHint, upDownHint } from '@game/input/key-hint';
import { drawCursor, drawPaper, drawWell } from './skin';
import { uiText } from './text';
import { PointerQueue } from './zorling-view';

export interface DexRow {
  readonly number: number;
  readonly species: string;
  readonly name: string;
  readonly seen: boolean;
  readonly caught: boolean;
  readonly types: readonly TypeId[];
  readonly description: string;
  /** Zones the player found it in (C42); empty for unseen species. */
  readonly habitat: readonly string[];
}

/** A tab (C42): All, or one region's species. */
export interface DexTab {
  readonly name: string;
  readonly rows: readonly DexRow[];
}

/**
 * Where the Dex was left (C44): the tab and each tab's cursor and scroll. The owner keeps it
 * and passes it in; the panel opens there and writes every change back.
 */
export interface DexMemory {
  tab: number;
  kept: { index: number; scroll: number }[];
}

export interface DexOptions {
  readonly tabs: readonly DexTab[];
  readonly memory?: DexMemory;
  /** 64×64 sprite of a seen species (made on demand). */
  readonly sprite: (species: string) => Texture | undefined;
  /** `zoom` (Z / Tab) this step: the next tab. */
  readonly pressed: (action: 'zoom') => boolean;
  readonly onBack: (panel: DexPanel) => void;
}

const W = 330;
const H = 196;
const LIST_W = 140;
const ROW_H = 15;
const TOP = 20;
const VISIBLE = 10;
const ART = 64;
/** Lowest y the detail text may reach (above the key hints). */
const TEXT_BOTTOM = H - 18;

export class DexPanel implements Widget<Container> {
  static readonly WIDTH = W;
  static readonly HEIGHT = H;
  readonly view = new Container({ label: 'dex' });
  private readonly dynamic = new Container();
  private cursor: GridCursor;
  private scroll = 0;
  private tab = 0;
  /** Cursor and scroll of each tab, kept while another tab shows. */
  private readonly kept: { index: number; scroll: number }[];
  private focused = false;
  private readonly pointer = new PointerQueue<'row' | 'tab'>(() => this.focused);
  private readonly wheel = new WheelSteps();

  constructor(private readonly options: DexOptions) {
    const bg = drawPaper(new Graphics(), 0, 0, W, H);
    bg.rect(LIST_W + 8, TOP, 1, H - TOP - 18).fill({ color: paper.shade });
    const title = uiText('label', 'Dex', paper.title);
    title.position.set(7, 6);
    this.view.addChild(bg, title, this.dynamic);
    const m = options.memory;
    this.kept = options.tabs.map((_, i) => ({ ...(m?.kept[i] ?? { index: 0, scroll: 0 }) }));
    if (m && m.tab >= 0 && m.tab < options.tabs.length) this.tab = m.tab;
    this.cursor = new GridCursor(this.rows.length, 1);
    const k = this.kept[this.tab];
    if (k) {
      this.cursor.set(Math.min(k.index, Math.max(0, this.rows.length - 1)));
      this.scroll = Math.max(0, Math.min(k.scroll, this.rows.length - VISIBLE));
    }
    this.view.eventMode = 'static';
    this.view.hitArea = new Rectangle(0, 0, W, H);
    this.build();
  }

  private get rows(): readonly DexRow[] {
    return this.options.tabs[this.tab]?.rows ?? [];
  }

  /** The tab showing (0 = All). */
  get tabIndex(): number {
    return this.tab;
  }

  /** Shows tab `i` (wraps), where its cursor was left. */
  showTab(i: number): void {
    const n = this.options.tabs.length;
    if (n <= 1) return;
    const next = ((i % n) + n) % n;
    if (next === this.tab) return;
    this.kept[this.tab] = { index: this.cursor.index, scroll: this.scroll };
    this.tab = next;
    const k = this.kept[next] ?? { index: 0, scroll: 0 };
    this.cursor = new GridCursor(this.rows.length, 1);
    this.cursor.set(k.index);
    this.scroll = k.scroll;
    uiSound('move');
    this.build();
  }

  get index(): number {
    return this.cursor.index;
  }

  contains(x: number, y: number): boolean {
    const p = this.view.toLocal({ x, y });
    return p.x >= 0 && p.y >= 0 && p.x <= W && p.y <= H;
  }

  dismiss(): void {
    this.options.onBack(this);
  }

  focus(): void {
    this.focused = true;
    this.build();
  }

  blur(): void {
    this.focused = false;
    this.pointer.clear();
    this.build();
  }

  handleInput(input: UiInput): void {
    const p = this.pointer.take();
    if (p?.kind === 'tab') {
      if (p.click) this.showTab(p.index);
      return;
    }
    if (p) {
      if (this.cursor.set(p.index)) this.changed();
      return;
    }
    if (this.options.pressed('zoom')) {
      this.showTab(this.tab + 1);
      return;
    }
    const lines = this.wheel.take(input.wheel?.() ?? 0);
    if (lines) {
      this.scrollBy(lines);
      return;
    }
    const dir = input.direction();
    if ((dir === 'up' || dir === 'down') && this.cursor.move(dir)) this.changed();
    else if (dir === 'left' || dir === 'right') {
      const n = this.rows.length;
      const step = dir === 'right' ? VISIBLE : -VISIBLE;
      const next = Math.max(0, Math.min(n - 1, this.cursor.index + step));
      if (this.cursor.set(next)) this.changed();
    }
    if (input.backPressed()) {
      uiSound('back');
      this.options.onBack(this);
    }
  }

  /**
   * The wheel (C43): scrolls the list; the cursor stays on a row that shows, so the entry on
   * the right is always the highlighted one.
   */
  scrollBy(lines: number): void {
    const max = Math.max(0, this.rows.length - VISIBLE);
    const next = Math.max(0, Math.min(max, this.scroll + lines));
    if (next === this.scroll) return;
    this.scroll = next;
    const i = this.cursor.index;
    this.cursor.set(Math.max(next, Math.min(next + VISIBLE - 1, i)));
    uiSound('move');
    this.build();
  }

  get scrollTop(): number {
    return this.scroll;
  }

  private changed(): void {
    uiSound('move');
    const i = this.cursor.index;
    if (i < this.scroll) this.scroll = i;
    if (i >= this.scroll + VISIBLE) this.scroll = i - VISIBLE + 1;
    this.build();
  }

  private build(): void {
    const memory = this.options.memory;
    if (memory) {
      this.kept[this.tab] = { index: this.cursor.index, scroll: this.scroll };
      memory.tab = this.tab;
      memory.kept = this.kept.map((k) => ({ ...k }));
    }
    for (const c of this.dynamic.removeChildren()) c.destroy({ children: true });
    const add = <T extends Container>(c: T, x = 0, y = 0): T => {
      c.position.set(Math.round(x), Math.round(y));
      this.dynamic.addChild(c);
      return c;
    };
    const { rows } = this;
    this.header(add);
    for (let i = this.scroll; i < Math.min(rows.length, this.scroll + VISIBLE); i++) {
      const d = rows[i];
      if (!d) continue;
      const r = new Container();
      const g = new Graphics();
      if (i === this.cursor.index) drawCursor(g, 0, 0, LIST_W, ROW_H - 1, this.focused);
      r.addChild(g);
      const num = uiText('label', String(d.number).padStart(3, '0'), paper.inkDim);
      num.position.set(9, 4);
      const name = uiText('body', d.seen ? d.name : '???', d.seen ? paper.ink : paper.inkDisabled);
      name.position.set(30, 1);
      r.addChild(num, name);
      if (d.caught) {
        const mark = new Graphics();
        // Small Zorb mark: caught.
        mark.circle(3, 3, 3).fill({ color: 0xff5c6c });
        mark.rect(0, 3, 7, 1).fill({ color: paper.edge });
        mark.position.set(LIST_W - 12, 4);
        r.addChild(mark);
      }
      r.hitArea = new Rectangle(0, 0, LIST_W, ROW_H - 1);
      this.pointer.bind(r, 'row', i);
      add(r, 4, TOP + (i - this.scroll) * ROW_H);
    }
    if (rows.length > VISIBLE) {
      const t = uiText(
        'label',
        `${this.scroll + 1}–${Math.min(rows.length, this.scroll + VISIBLE)} of ${rows.length}`,
        paper.inkDim,
      );
      add(t, Math.round(LIST_W + 4 - t.width), H - 26);
    }

    const d = rows[this.cursor.index];
    const dx = LIST_W + 16;
    if (d) {
      const g = add(new Graphics(), 0, 0);
      drawWell(g, dx, TOP, ART + 4, ART + 4);
      const tex = d.seen ? this.options.sprite(d.species) : undefined;
      if (tex) add(new Sprite(tex), dx + 2, TOP + 2);
      else {
        const q = uiText('name', '?', paper.inkDisabled, { fontSize: 28 });
        add(
          q,
          dx + 2 + Math.round((ART - q.width) / 2),
          TOP + 2 + Math.round((ART - q.height) / 2),
        );
      }
      const tx = dx + ART + 10;
      add(uiText('label', `No. ${String(d.number).padStart(3, '0')}`, paper.inkDim), tx, TOP + 2);
      add(uiText('name', d.seen ? d.name : '???'), tx, TOP + 11);
      if (d.seen) {
        let by = TOP + 27;
        for (const t of d.types) {
          add(new TypeBadge(t), tx, by);
          by += 14;
        }
      }
      const status = d.caught ? 'Caught' : d.seen ? 'Seen' : 'Not seen yet';
      add(uiText('label', status, d.caught ? paper.title : paper.inkDim), tx, TOP + 58);
      const text = d.caught
        ? d.description
        : d.seen
          ? 'Catch one to learn more about it.'
          : 'Explore to find this Zorling.';
      const body = add(
        uiText('body', text, d.caught ? paper.ink : paper.inkDim, {
          wordWrap: true,
          wordWrapWidth: W - dx - 8,
        }),
        dx,
        TOP + ART + 10,
      );
      if (d.seen && d.habitat.length) this.habitat(add, d.habitat, dx, body.y + body.height + 3);
    }

    const hints = [
      new KeyHint(upDownHint(), 'Choose'),
      new KeyHint(leftRightHint(), 'Page'),
      ...(this.options.tabs.length > 1 ? [new KeyHint(keyHint('zoom'), 'Region')] : []),
      new KeyHint(keyHint('back'), 'Back'),
    ];
    for (const h of hints) this.dynamic.addChild(h);
    row(hints, 8, 7, H - 13);
  }

  /**
   * The tabs after the title, and the tab's counts at the bottom right (next to the key
   * hints). When the tabs do not fit (many regions), only the one showing is named.
   */
  private header(add: <T extends Container>(c: T, x?: number, y?: number) => T): void {
    const rows = this.rows;
    const seen = rows.filter((r) => r.seen).length;
    const caught = rows.filter((r) => r.caught).length;
    const count = uiText('label', `Seen ${seen} · Caught ${caught} / ${rows.length}`, paper.inkDim);
    add(count, W - 8 - count.width, H - 12);
    const { tabs } = this.options;
    if (tabs.length <= 1) return;
    const x0 = 34;
    const labels = tabs.map((t, i) =>
      uiText('label', t.name, i === this.tab ? paper.title : paper.inkDim),
    );
    const width = labels.reduce((w, l) => w + Math.ceil(l.width), 0) + 8 * (labels.length - 1);
    const fits = x0 + width <= W - 8;
    let x = x0;
    labels.forEach((l, i) => {
      if (!fits && i !== this.tab) {
        l.destroy();
        return;
      }
      const t = new Container();
      t.addChild(l);
      if (i === this.tab) {
        const line = new Graphics();
        line.rect(0, Math.ceil(l.height), Math.ceil(l.width), 1).fill({ color: paper.title });
        t.addChild(line);
      }
      t.hitArea = new Rectangle(-2, -2, Math.ceil(l.width) + 4, Math.ceil(l.height) + 4);
      this.pointer.bind(t, 'tab', i);
      add(t, x, 6);
      x += Math.ceil(l.width) + 8;
    });
  }

  /** "Found in" and the zones, as many as fit above the key hints ("and 3 more"). */
  private habitat(
    add: <T extends Container>(c: T, x?: number, y?: number) => T,
    zones: readonly string[],
    x: number,
    y: number,
  ): void {
    const label = uiText('label', 'Found in', paper.inkDim);
    const style = { wordWrap: true, wordWrapWidth: W - x - 8 };
    const ty = y + Math.ceil(label.height) + 1;
    for (let n = zones.length; n >= 1; n--) {
      const more = zones.length - n;
      const line = zones.slice(0, n).join(', ') + (more ? `, and ${more} more` : '');
      const text = uiText('body', line, paper.ink, style);
      if (ty + text.height <= TEXT_BOTTOM || n === 1) {
        if (ty + text.height > TEXT_BOTTOM) {
          text.destroy();
          label.destroy();
          return;
        }
        add(label, x, y);
        add(text, x, ty);
        return;
      }
      text.destroy();
    }
  }
}
