/**
 * Battle panels: the message box (prompt + key hints), the move info panel shown next to the
 * move list, item icons and a few drawing helpers shared by the bag and shop.
 */

import { Container, Graphics } from 'pixi.js';
import { darken, lighten } from '@engine/core/color';
import { pixelBitmap, type TooltipContent, type TooltipLayer } from '@engine/ui';
import { brand, conditionColors, paper, type ConditionId, type TypeId } from '../style/tokens';
import { CHIP_SIZE, ConditionChip, KeyHint, TypeBadge, row } from './badges';
import { COIN, ITEM_SPRITES, type ItemSprite } from './icons';
import { drawPaper, drawWell } from './skin';
import { uiText } from './text';

/** Draws a 12×12 item sprite tinted with `tint`. */
export function drawItem(
  g: Graphics,
  sprite: ItemSprite,
  x: number,
  y: number,
  tint: number,
): void {
  pixelBitmap(g, ITEM_SPRITES[sprite], x, y, {
    o: paper.edge,
    a: tint,
    b: lighten(tint, 0.45),
    c: darken(tint, 0.3),
    w: 0xffffff,
    g: paper.shade,
  });
}

/** Draws the 7×8 coin. */
export function drawCoin(g: Graphics, x: number, y: number): void {
  pixelBitmap(g, COIN, x, y, {
    a: brand.sunbeam,
    b: lighten(brand.sunbeam, 0.5),
    c: darken(brand.sunbeam, 0.45),
  });
}

/** Coin + amount, right-aligned at `right`. */
export class MoneyLabel extends Container {
  private readonly g = new Graphics();
  private readonly text = uiText('number', '');

  constructor() {
    super({ label: 'money' });
    this.addChild(this.g, this.text);
  }

  set(amount: number, color: number = paper.ink): void {
    this.text.text = formatMoney(amount);
    this.text.style.fill = color;
    this.text.position.set(10, -1);
    this.g.clear();
    drawCoin(this.g, 0, 1);
  }
}

/** 1240 → "1 240" (thin grouping, no locale surprises). */
export function formatMoney(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Paper box with up to 3 lines of text and a row of key hints at the bottom. */
export class MessageBox extends Container {
  private readonly bg = new Graphics();
  private readonly lines = new Container();
  private readonly hints = new Container();
  private w = 0;
  private h = 0;

  constructor() {
    super({ label: 'message' });
    this.addChild(this.bg, this.lines, this.hints);
  }

  resize(w: number, h: number): void {
    this.w = Math.round(w);
    this.h = Math.round(h);
    drawPaper(this.bg.clear(), 0, 0, this.w, this.h);
    this.hints.position.set(7, this.h - 14);
  }

  set(text: string, hints: readonly [string, string][] = []): void {
    for (const c of this.lines.removeChildren()) c.destroy();
    for (const c of this.hints.removeChildren()) c.destroy({ children: true });
    text.split('\n').forEach((line, i) => {
      const t = uiText('body', line);
      t.position.set(7, 4 + i * 12);
      this.lines.addChild(t);
    });
    const keys = hints.map(([k, l]) => new KeyHint(k, l));
    if (keys.length) this.hints.addChild(...keys);
    row(keys, 8);
  }
}

export interface MoveView {
  readonly name: string;
  readonly type: TypeId;
  readonly power: number;
  readonly accuracy: number;
  readonly applies?: ConditionId;
  readonly exploits?: readonly ConditionId[];
  /** Live hint against the current foe (e.g. "Foe is Wet: Steam Burst ×1.75"). */
  readonly tip?: { readonly text: string; readonly good: boolean };
}

export interface MoveInfoTips {
  readonly layer: TooltipLayer;
  type(type: TypeId): TooltipContent;
  condition(id: ConditionId): TooltipContent;
}

/** Type, power, accuracy and the conditions a move applies / exploits. */
export class MoveInfoPanel extends Container {
  private readonly bg = new Graphics();
  private readonly content = new Container();
  private unregister: (() => void)[] = [];
  private w = 0;
  private h = 0;

  constructor(private readonly tips?: MoveInfoTips) {
    super({ label: 'move-info' });
    this.addChild(this.bg, this.content);
  }

  resize(w: number, h: number): void {
    this.w = Math.round(w);
    this.h = Math.round(h);
    drawPaper(this.bg.clear(), 0, 0, this.w, this.h);
  }

  set(move: MoveView): void {
    for (const off of this.unregister) off();
    this.unregister = [];
    for (const c of this.content.removeChildren()) c.destroy({ children: true });
    const tips = this.tips;
    const add = <T extends Container>(c: T, x: number, y: number): T => {
      c.position.set(Math.round(x), Math.round(y));
      this.content.addChild(c);
      return c;
    };

    const badge = add(new TypeBadge(move.type), 6, 5);
    if (tips) this.unregister.push(tips.layer.register(badge, () => tips.type(move.type)));
    let x = 6 + Math.ceil(badge.width) + 7;
    for (const [label, value] of [
      ['Pow', move.power > 0 ? String(move.power) : '—'],
      ['Acc', `${move.accuracy}`],
    ] as const) {
      const l = add(uiText('label', label, paper.inkDim), x, 7);
      x += Math.ceil(l.width) + 2;
      const v = add(uiText('number', value), x, 4);
      x += Math.ceil(v.width) + 8;
    }

    const condRow = (y: number, label: string, ids: readonly ConditionId[]): void => {
      add(uiText('label', label, paper.inkDim), 6, y + 2);
      if (ids.length === 0) {
        add(uiText('body', '—', paper.inkDim), 46, y - 1);
        return;
      }
      let cx = 46;
      for (const id of ids) {
        const chip = add(new ConditionChip(id), cx, y);
        if (tips) this.unregister.push(tips.layer.register(chip, () => tips.condition(id)));
        cx += CHIP_SIZE + 3;
        if (ids.length === 1) {
          add(uiText('body', conditionColors[id].label), cx, y - 1);
        }
      }
    };
    condRow(19, 'Applies', move.applies ? [move.applies] : []);
    condRow(32, 'Exploits', move.exploits ?? []);

    if (move.tip) {
      const g = add(new Graphics(), 0, 0);
      drawWell(g, 4, this.h - 15, this.w - 8, 11);
      const tag = add(
        uiText(
          'label',
          move.tip.good ? 'Combo' : 'Note',
          move.tip.good ? paper.title : paper.inkDim,
        ),
        7,
        this.h - 13,
      );
      add(uiText('label', move.tip.text, paper.ink), 7 + Math.ceil(tag.width) + 4, this.h - 13);
    }
  }
}
