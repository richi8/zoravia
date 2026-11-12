/**
 * Bag panel (battle "Items" and the overworld bag): tabs, item list with counts against the
 * bag cap, details, then "use on" a team Zorling.
 *
 * Keyboard: W/S item, A/D tab, E use → A/D target, E confirm, Q back. Mouse: hover/click
 * rows, tabs and targets; right click / click outside = back (via `FocusStack`).
 */

import { Container, Graphics, Rectangle, Sprite } from 'pixi.js';
import { GridCursor, type UiInput, type Widget } from '@engine/ui';
import { paper } from '../style/tokens';
import { KeyHint, row } from './badges';
import type { CombatantView } from './battle-hud';
import type { ItemSprite } from './icons';
import { MoneyLabel, drawItem } from './panels';
import { drawCursor, drawPaper, drawWell } from './skin';
import { uiText } from './text';

export interface BagItem {
  readonly id: string;
  readonly name: string;
  readonly count: number;
  /** Bag cap for this item (potions: 5). Shown as `count/cap`. */
  readonly cap?: number;
  readonly sprite: ItemSprite;
  readonly tint: number;
  readonly description: string;
  /** Needs a target Zorling (potions). Default true. */
  readonly targeted?: boolean;
}

export interface BagTab {
  readonly label: string;
  readonly items: readonly BagItem[];
}

export interface BagOptions {
  readonly tabs: readonly BagTab[];
  readonly team: readonly (CombatantView | undefined)[];
  readonly money: number;
  readonly onUse: (item: BagItem, target: number | undefined, bag: BagPanel) => void;
  readonly onBack: (bag: BagPanel) => void;
}

const W = 300;
const H = 156;
const LIST_W = 164;
const ROW_H = 17;
const TOP = 18;

type Pointer = { kind: 'row' | 'tab' | 'target'; index: number; click: boolean };

export class BagPanel implements Widget<Container> {
  static readonly WIDTH = W;
  static readonly HEIGHT = H;
  readonly view = new Container({ label: 'bag' });
  private readonly dynamic = new Container();
  private tab = 0;
  private readonly cursor: GridCursor;
  private mode: 'list' | 'target' = 'list';
  private target = 0;
  private focused = false;
  private pointer: Pointer | undefined;

  constructor(private readonly options: BagOptions) {
    const bg = drawPaper(new Graphics(), 0, 0, W, H);
    bg.rect(LIST_W + 6, TOP, 1, H - TOP - 18).fill({ color: paper.shade });
    const title = uiText('label', 'Bag', paper.title);
    title.position.set(7, 6);
    const money = new MoneyLabel();
    money.set(options.money);
    money.position.set(Math.round(W - 8 - money.width), 5);
    this.view.addChild(bg, title, money, this.dynamic);
    this.cursor = new GridCursor(this.items.length, 1, (i) => (this.items[i]?.count ?? 0) > 0);
    this.view.eventMode = 'static';
    this.view.hitArea = new Rectangle(0, 0, W, H);
    this.build();
  }

  private get items(): readonly BagItem[] {
    return this.options.tabs[this.tab]?.items ?? [];
  }

  get selected(): BagItem | undefined {
    return this.items[this.cursor.index];
  }

  get state(): { tab: number; index: number; mode: 'list' | 'target'; target: number } {
    return { tab: this.tab, index: this.cursor.index, mode: this.mode, target: this.target };
  }

  contains(x: number, y: number): boolean {
    const p = this.view.toLocal({ x, y });
    return p.x >= 0 && p.y >= 0 && p.x <= W && p.y <= H;
  }

  dismiss(): void {
    this.back();
  }

  focus(): void {
    this.focused = true;
    this.build();
  }

  blur(): void {
    this.focused = false;
    this.pointer = undefined;
    this.build();
  }

  handleInput(input: UiInput): void {
    const p = this.pointer;
    this.pointer = undefined;
    if (p) {
      this.applyPointer(p);
      return;
    }
    const dir = input.direction();
    if (this.mode === 'list') {
      if (dir === 'up' || dir === 'down') {
        if (this.cursor.move(dir)) this.build();
      } else if (dir === 'left' || dir === 'right') {
        this.switchTab(dir === 'right' ? 1 : -1);
      }
    } else if (dir === 'left' || dir === 'right') {
      this.moveTarget(dir === 'right' ? 1 : -1);
    }
    if (input.confirmPressed()) this.confirm();
    else if (input.backPressed()) this.back();
  }

  private applyPointer(p: Pointer): void {
    if (p.kind === 'tab') {
      if (this.mode === 'list' && p.index !== this.tab) this.switchTab(p.index - this.tab);
      return;
    }
    if (p.kind === 'row' && this.mode === 'list') {
      if (this.cursor.set(p.index)) this.build();
      if (p.click && this.cursor.index === p.index) this.confirm();
      return;
    }
    if (p.kind === 'target' && this.mode === 'target' && this.options.team[p.index]) {
      this.target = p.index;
      this.build();
      if (p.click) this.confirm();
    }
  }

  private switchTab(delta: number): void {
    const n = this.options.tabs.length;
    if (n < 2) return;
    this.tab = (this.tab + delta + n) % n;
    this.cursor.reset(this.items.length);
    this.build();
  }

  private moveTarget(delta: number): void {
    for (let i = 1; i <= 3; i++) {
      const t = (this.target + delta * i + 3) % 3;
      if (this.options.team[t]) {
        this.target = t;
        break;
      }
    }
    this.build();
  }

  private confirm(): void {
    const item = this.selected;
    if (!item || item.count <= 0) return;
    if (this.mode === 'list') {
      if (item.targeted === false) {
        this.options.onUse(item, undefined, this);
        return;
      }
      this.mode = 'target';
      this.target = Math.max(0, this.options.team.findIndex(Boolean));
      this.build();
    } else {
      this.options.onUse(item, this.target, this);
    }
  }

  private back(): void {
    if (this.mode === 'target') {
      this.mode = 'list';
      this.build();
    } else {
      this.options.onBack(this);
    }
  }

  private queue(kind: Pointer['kind'], index: number, view: Container): void {
    view.eventMode = 'static';
    view.cursor = 'pointer';
    view.on('pointerover', () => {
      if (this.focused) this.pointer = { kind, index, click: false };
    });
    view.on('pointertap', (e) => {
      if (this.focused && e.button === 0) this.pointer = { kind, index, click: true };
    });
  }

  private build(): void {
    for (const c of this.dynamic.removeChildren()) c.destroy({ children: true });
    const add = <T extends Container>(c: T, x = 0, y = 0): T => {
      c.position.set(Math.round(x), Math.round(y));
      this.dynamic.addChild(c);
      return c;
    };

    // Tabs.
    let tx = 30;
    this.options.tabs.forEach((t, i) => {
      const on = i === this.tab;
      const tab = new Container();
      const label = uiText('label', t.label, on ? paper.ink : paper.inkDim);
      const tw = Math.ceil(label.width) + 8;
      const g = new Graphics();
      drawWell(g, 0, 0, tw, 9);
      if (on) g.rect(1, 1, tw - 2, 7).fill({ color: paper.cursor });
      label.position.set(4, Math.round((9 - label.height) / 2));
      tab.addChild(g, label);
      tab.hitArea = new Rectangle(0, 0, tw, 9);
      this.queue('tab', i, tab);
      add(tab, tx, 4);
      tx += tw + 3;
    });

    // List.
    const items = this.items;
    items.forEach((item, i) => {
      const y = TOP + i * ROW_H;
      const r = new Container();
      const g = new Graphics();
      const sel = i === this.cursor.index;
      if (sel) drawCursor(g, 0, 0, LIST_W, ROW_H - 1, this.focused && this.mode === 'list');
      drawItem(g, item.sprite, 9, 2, item.tint);
      const empty = item.count <= 0;
      const name = uiText('body', item.name, empty ? paper.inkDisabled : paper.ink);
      name.position.set(25, 2);
      const count = uiText(
        'label',
        item.cap ? `${item.count}/${item.cap}` : `×${item.count}`,
        empty ? paper.inkDisabled : paper.inkDim,
      );
      count.position.set(Math.round(LIST_W - 4 - count.width), 5);
      r.addChild(g, name, count);
      r.hitArea = new Rectangle(0, 0, LIST_W, ROW_H - 1);
      this.queue('row', i, r);
      add(r, 4, y);
    });
    if (items.length === 0) add(uiText('body', 'Nothing here yet.', paper.inkDim), 10, TOP + 2);

    // Details.
    const item = this.selected;
    const dx = LIST_W + 13;
    if (item) {
      const g = add(new Graphics(), dx, TOP + 2);
      drawItem(g, item.sprite, 0, 0, item.tint);
      add(uiText('name', item.name), dx + 16, TOP);
      const desc = uiText('body', item.description, paper.inkDim, {
        wordWrap: true,
        wordWrapWidth: W - dx - 8,
      });
      add(desc, dx, TOP + 17);
      if (item.targeted !== false) {
        const label = this.mode === 'target' ? 'Use on — A/D, E' : 'Use on';
        add(uiText('label', label, this.mode === 'target' ? paper.title : paper.inkDim), dx, 102);
        for (let t = 0; t < 3; t++) {
          const member = this.options.team[t];
          const slot = new Container();
          const sg = new Graphics();
          const on = this.mode === 'target' && t === this.target;
          drawWell(sg, 0, 0, 34, 34);
          if (on) sg.rect(1, 1, 32, 32).fill({ color: paper.cursor });
          slot.addChild(sg);
          if (member?.portrait) {
            const s = new Sprite(member.portrait);
            s.position.set(1, 1);
            slot.addChild(s);
          }
          if (on) {
            const frame = new Graphics();
            frame.rect(0, 0, 34, 1).rect(0, 33, 34, 1).rect(0, 0, 1, 34).rect(33, 0, 1, 34);
            frame.fill({ color: paper.accent });
            slot.addChild(frame);
          }
          slot.hitArea = new Rectangle(0, 0, 34, 34);
          this.queue('target', t, slot);
          add(slot, dx + t * 38, 110);
        }
      }
    }

    // Key hints.
    const hints =
      this.mode === 'list'
        ? [new KeyHint('E', 'Use'), new KeyHint('A D', 'Tab'), new KeyHint('Q', 'Back')]
        : [new KeyHint('E', 'Confirm'), new KeyHint('A D', 'Target'), new KeyHint('Q', 'Back')];
    for (const h of hints) this.dynamic.addChild(h);
    row(hints, 8, 7, H - 13);
  }
}
