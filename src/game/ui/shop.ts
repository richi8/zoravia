/**
 * Shop panel: price list with owned counts, quantity picker and money.
 *
 * Keyboard: W/S item, A/D quantity, E buy, Q leave. Mouse: hover/click rows (click on the
 * selected row buys), right click / click outside = leave.
 * Items at their bag cap show "FULL" and can't be selected; quantity is limited by the cap
 * and the money left.
 */

import { Container, Graphics, Rectangle } from 'pixi.js';
import { GridCursor, type UiInput, type Widget, uiSound } from '@engine/ui';
import { paper } from '../style/tokens';
import { KeyHint, row } from './badges';
import { keyHint, leftRightHint } from '@game/input/key-hint';
import type { ItemSprite } from './icons';
import { MoneyLabel, drawCoin, drawItem } from './panels';
import { drawCursor, drawPaper } from './skin';
import { uiText } from './text';

export interface ShopItem {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly owned: number;
  readonly cap?: number;
  readonly sprite: ItemSprite;
  readonly tint: number;
}

export interface ShopOptions {
  readonly title: string;
  readonly items: readonly ShopItem[];
  readonly money: () => number;
  readonly onBuy: (item: ShopItem, quantity: number, shop: ShopPanel) => void;
  readonly onBack: (shop: ShopPanel) => void;
  readonly width?: number;
}

const ROW_H = 17;
const TOP = 26;

export class ShopPanel implements Widget<Container> {
  readonly view = new Container({ label: 'shop' });
  readonly width: number;
  readonly height: number;
  private readonly dynamic = new Container();
  private readonly money = new MoneyLabel();
  private readonly cursor: GridCursor;
  private items: ShopItem[];
  private qty = 1;
  private focused = false;
  private pointer: { index: number; click: boolean } | undefined;

  constructor(private readonly options: ShopOptions) {
    this.items = [...options.items];
    this.width = options.width ?? 250;
    this.height = TOP + this.items.length * ROW_H + 18;
    const bg = drawPaper(new Graphics(), 0, 0, this.width, this.height);
    const title = uiText('label', options.title, paper.title);
    title.position.set(7, 6);
    const head = new Container();
    const cols: [string, number, 'l' | 'r'][] = [
      ['Item', 29, 'l'],
      ['Own', 150, 'l'],
      ['Price', this.width - 8, 'r'],
    ];
    for (const [t, x, a] of cols) {
      const l = uiText('label', t, paper.inkDim);
      l.position.set(Math.round(a === 'r' ? x - l.width : x), 16);
      head.addChild(l);
    }
    this.view.addChild(bg, title, head, this.money, this.dynamic);
    this.cursor = new GridCursor(this.items.length, 1, (i) => this.buyable(i));
    this.view.eventMode = 'static';
    this.view.hitArea = new Rectangle(0, 0, this.width, this.height);
    this.build();
  }

  get selected(): ShopItem | undefined {
    return this.items[this.cursor.index];
  }

  get quantity(): number {
    return this.qty;
  }

  /** Replace the item list (e.g. after buying, with new owned counts). */
  setItems(items: readonly ShopItem[]): void {
    const index = this.cursor.index;
    this.items = [...items];
    this.cursor.reset(this.items.length);
    if (this.buyable(index)) this.cursor.set(index);
    this.qty = Math.min(this.qty, this.maxQty());
    this.qty = Math.max(1, this.qty);
    this.build();
  }

  contains(x: number, y: number): boolean {
    const p = this.view.toLocal({ x, y });
    return p.x >= 0 && p.y >= 0 && p.x <= this.width && p.y <= this.height;
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
    this.build();
  }

  handleInput(input: UiInput): void {
    const p = this.pointer;
    this.pointer = undefined;
    if (p) {
      const was = this.cursor.index;
      if (this.cursor.set(p.index)) {
        uiSound('move');
        this.qty = 1;
        this.build();
      }
      if (p.click && was === p.index) this.buy();
      return;
    }
    const dir = input.direction();
    if (dir === 'up' || dir === 'down') {
      if (this.cursor.move(dir)) {
        uiSound('move');
        this.qty = 1;
        this.build();
      }
    } else if (dir === 'left' || dir === 'right') {
      const max = this.maxQty();
      const next =
        dir === 'right' ? (this.qty >= max ? 1 : this.qty + 1) : this.qty <= 1 ? max : this.qty - 1;
      if (next !== this.qty) {
        uiSound('move');
        this.qty = next;
        this.build();
      }
    }
    if (input.confirmPressed()) this.buy();
    else if (input.backPressed()) {
      uiSound('back');
      this.options.onBack(this);
    }
  }

  /** Most of the selected item the player can buy now (≥ 1 when buyable). */
  maxQty(): number {
    const item = this.selected;
    if (!item) return 1;
    const byMoney = Math.floor(this.options.money() / item.price);
    const byCap = item.cap !== undefined ? item.cap - item.owned : 99;
    return Math.max(1, Math.min(byMoney, byCap, 99));
  }

  private buyable(i: number): boolean {
    const item = this.items[i];
    return !!item && (item.cap === undefined || item.owned < item.cap);
  }

  private buy(): void {
    const item = this.selected;
    if (!item || !this.buyable(this.cursor.index)) {
      uiSound('blocked');
      return;
    }
    this.options.onBuy(item, this.qty, this);
  }

  private build(): void {
    for (const c of this.dynamic.removeChildren()) c.destroy({ children: true });
    const money = this.options.money();
    this.money.set(money);
    this.money.position.set(Math.round(this.width - 8 - this.money.width), 5);
    const W = this.width;
    this.items.forEach((item, i) => {
      const r = new Container();
      const g = new Graphics();
      const sel = i === this.cursor.index;
      const full = item.cap !== undefined && item.owned >= item.cap;
      const total = sel ? item.price * this.qty : item.price;
      const poor = total > money;
      if (sel) drawCursor(g, 0, 0, W - 8, ROW_H - 1, this.focused);
      drawItem(g, item.sprite, 9, 2, item.tint);
      const name = uiText('body', item.name, full ? paper.inkDisabled : paper.ink);
      name.position.set(25, 2);
      const own = full
        ? uiText('label', 'Full', paper.warn)
        : uiText(
            'label',
            item.cap !== undefined ? `${item.owned}/${item.cap}` : String(item.owned),
            paper.inkDim,
          );
      own.position.set(146, 5);
      const price = uiText(
        'number',
        String(total),
        full ? paper.inkDisabled : poor ? paper.warn : paper.ink,
      );
      price.position.set(Math.round(W - 12 - price.width), 2);
      drawCoin(g, Math.round(price.x - 10), 4);
      r.addChild(g, name, own, price);
      if (sel && this.qty > 1) {
        const q = uiText('label', `×${this.qty}`, paper.title);
        q.position.set(Math.round(price.x - 14 - q.width), 5);
        r.addChild(q);
      }
      r.hitArea = new Rectangle(0, 0, W - 8, ROW_H - 1);
      r.eventMode = 'static';
      r.cursor = full ? 'default' : 'pointer';
      r.on('pointerover', () => {
        if (this.focused) this.pointer = { index: i, click: false };
      });
      r.on('pointertap', (e) => {
        if (this.focused && e.button === 0) this.pointer = { index: i, click: true };
      });
      r.position.set(4, TOP + i * ROW_H);
      this.dynamic.addChild(r);
    });
    const hints = [
      new KeyHint(keyHint('confirm'), 'Buy'),
      new KeyHint(leftRightHint(), 'Qty'),
      new KeyHint(keyHint('back'), 'Leave'),
    ];
    for (const h of hints) this.dynamic.addChild(h);
    row(hints, 8, 7, this.height - 13);
  }
}
