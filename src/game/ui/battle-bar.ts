/**
 * Battle UI after the G2 review (option B, user pick): the moves are always on screen as
 * cards in the bottom bar, battle text is a timed caption at the top of the battlefield (no
 * key to advance it), `L` opens the whole battle log, and the end of a battle shows one
 * results panel that `E` closes. All sizes are game pixels.
 */

import { Container, Graphics, Rectangle } from 'pixi.js';
import {
  GridCursor,
  uiSound,
  type TooltipContent,
  type TooltipLayer,
  type UiInput,
  type Widget,
} from '@engine/ui';
import { conditionColors, paper, type ConditionId, type TypeId } from '../style/tokens';
import { CHIP_SIZE, ConditionChip, KeyHint, TypeBadge } from './badges';
import { keyHint, keysHint, upDownHint } from '@game/input/key-hint';
import type { MoveView } from './panels';
import { drawPaper } from './skin';
import { uiText } from './text';

export interface MoveBarTips {
  readonly layer: TooltipLayer;
  type(type: TypeId): TooltipContent;
  condition(id: ConditionId): TooltipContent;
}

export interface MoveBarOptions {
  readonly tips?: MoveBarTips;
  /** A move card was picked (keyboard or click). */
  readonly onSelect: (slot: number) => void;
  /** `Q` / back on the bar. */
  readonly onBack: () => void;
  /** A click on a key in the side column. */
  readonly onKey: (key: 'items' | 'run' | 'log') => void;
}

const SIDE_W = 66;
const GAP = 3;

/**
 * The move cards (left to right) and a column of key hints. Focus it on the player's turn;
 * blurred, it stays visible but dimmed. It draws into `display` (kept in the HUD); `view` is
 * an empty anchor for the focus stack, which attaches and detaches it.
 */
export class MoveBar implements Widget<Container> {
  readonly view = new Container({ label: 'move-bar-focus' });
  readonly display = new Container({ label: 'move-bar' });
  private readonly cardsLayer = new Container();
  private readonly side = new Container();
  private cursor = new GridCursor(0, 1);
  private moves: readonly MoveView[] = [];
  private enabled: readonly boolean[] = [];
  private cards: { view: Container; bg: Graphics; w: number }[] = [];
  private unregister: (() => void)[] = [];
  private focused = false;
  private pendingHover: number | undefined;
  private pendingClick: number | undefined;
  private w = 300;
  private h = 60;
  private canRun = true;

  constructor(private readonly options: MoveBarOptions) {
    this.display.addChild(this.cardsLayer, this.side);
    this.display.interactiveChildren = false;
    this.redraw();
  }

  get width(): number {
    return this.w;
  }

  resize(w: number, h: number): void {
    this.w = Math.round(w);
    this.h = Math.round(h);
    this.build();
  }

  /** The active Zorling's moves (with live hints) and which can be used now. */
  set(moves: readonly MoveView[], enabled: readonly boolean[], canRun: boolean): void {
    const keep = this.cursor.index;
    this.moves = moves;
    this.enabled = enabled;
    this.canRun = canRun;
    this.cursor = new GridCursor(moves.length, Math.max(1, moves.length), (i) => !!enabled[i]);
    if (keep >= 0 && enabled[keep]) this.cursor.set(keep);
    this.build();
  }

  focus(): void {
    this.focused = true;
    this.display.interactiveChildren = true;
    this.redraw();
  }

  blur(): void {
    this.focused = false;
    this.display.interactiveChildren = false;
    this.pendingClick = undefined;
    this.pendingHover = undefined;
    this.redraw();
  }

  contains(x: number, y: number): boolean {
    const b = this.display.getBounds();
    return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
  }

  handleInput(input: UiInput): void {
    if (this.pendingHover !== undefined) {
      if (this.cursor.set(this.pendingHover)) {
        uiSound('move');
        this.redraw();
      }
      this.pendingHover = undefined;
    }
    if (this.pendingClick !== undefined) {
      const i = this.pendingClick;
      this.pendingClick = undefined;
      if (this.enabled[i]) {
        this.cursor.set(i);
        this.redraw();
        uiSound('select');
        this.options.onSelect(i);
        return;
      }
      uiSound('blocked');
    }
    const dir = input.direction();
    if ((dir === 'left' || dir === 'right') && this.cursor.move(dir)) {
      uiSound('move');
      this.redraw();
    }
    if (input.confirmPressed()) {
      if (this.cursor.index >= 0) {
        uiSound('select');
        this.options.onSelect(this.cursor.index);
      } else uiSound('blocked');
    } else if (input.backPressed()) {
      this.options.onBack();
    }
  }

  private build(): void {
    for (const off of this.unregister) off();
    this.unregister = [];
    for (const c of this.cardsLayer.removeChildren()) c.destroy({ children: true });
    for (const c of this.side.removeChildren()) c.destroy({ children: true });
    this.cards = [];
    const n = Math.max(1, this.moves.length);
    const cardsW = this.w - SIDE_W - GAP;
    const cw = Math.floor((cardsW - GAP * (n - 1)) / n);
    this.moves.forEach((m, i) => {
      const card = this.card(m, cw);
      card.view.position.set(i * (cw + GAP), 0);
      card.view.eventMode = 'static';
      card.view.cursor = 'pointer';
      card.view.hitArea = new Rectangle(0, 0, cw, this.h);
      card.view.on('pointerover', () => (this.pendingHover = i));
      card.view.on('pointertap', () => (this.pendingClick = i));
      this.cardsLayer.addChild(card.view);
      this.cards.push(card);
    });
    this.buildSide(cardsW + GAP);
    this.redraw();
  }

  private card(m: MoveView, w: number): { view: Container; bg: Graphics; w: number } {
    const view = new Container({ label: `move:${m.name}` });
    const bg = new Graphics();
    view.addChild(bg);
    const add = <T extends Container>(c: T, x: number, y: number): T => {
      c.position.set(Math.round(x), Math.round(y));
      view.addChild(c);
      return c;
    };
    add(uiText('name', m.name), 6, 3);
    const badge = add(new TypeBadge(m.type), 6, 18);
    const tips = this.options.tips;
    if (tips) this.unregister.push(tips.layer.register(badge, () => tips.type(m.type)));
    let x = 6 + Math.ceil(badge.width) + 3;
    if (m.applies) {
      const id = m.applies;
      const chip = add(new ConditionChip(id), x, 18);
      if (tips) this.unregister.push(tips.layer.register(chip, () => tips.condition(id)));
      x += CHIP_SIZE + 3;
      if (m.power <= 0) add(uiText('label', conditionColors[id].label, paper.inkDim), x, 20);
    }
    const stats = m.power > 0 ? `Pow ${m.power} · Acc ${m.accuracy}` : `Status · Acc ${m.accuracy}`;
    add(uiText('label', stats, paper.inkDim), 6, 32);
    if (m.tip) {
      add(
        uiText('label', m.tip.text, m.tip.good ? paper.title : paper.inkDim, {
          wordWrap: true,
          wordWrapWidth: w - 12,
          lineHeight: 8,
        }),
        6,
        42,
      );
    }
    return { view, bg, w };
  }

  private buildSide(x0: number): void {
    const bg = new Graphics();
    drawPaper(bg, 0, 0, SIDE_W, this.h);
    this.side.addChild(bg);
    this.side.position.set(x0, 0);
    const rows: [string, string, 'items' | 'run' | 'log' | undefined, boolean][] = [
      [keyHint('inventory'), 'Items', 'items', true],
      [keyHint('back'), 'Run', 'run', this.canRun],
      [keyHint('log'), 'Log', 'log', true],
      [keysHint('hotbar1', 'hotbar2', 'hotbar3'), 'Switch', undefined, true],
    ];
    rows.forEach(([key, label, action, on], i) => {
      const hint = new KeyHint(key, label);
      hint.position.set(6, 6 + i * 12);
      hint.alpha = on ? 1 : 0.4;
      if (action && on) {
        hint.eventMode = 'static';
        hint.cursor = 'pointer';
        hint.hitArea = new Rectangle(-2, -2, SIDE_W - 8, 12);
        hint.on('pointertap', () => this.options.onKey(action));
      }
      this.side.addChild(hint);
    });
  }

  private redraw(): void {
    this.cards.forEach((c, i) => {
      const sel = this.focused && i === this.cursor.index;
      drawPaper(c.bg.clear(), 0, 0, c.w, this.h, { fill: sel ? paper.cursor : paper.base });
      c.view.alpha = this.focused ? (this.enabled[i] ? 1 : 0.4) : 0.55;
    });
    this.side.alpha = this.focused ? 1 : 0.55;
  }
}

/**
 * One line of battle text at the top of the battlefield (wraps; no key to advance it). The
 * scene decides how long each line stays.
 */
export class BattleCaption extends Container {
  /** Seconds to fade in or out (C32). */
  static readonly FADE = 0.12;
  private readonly box = new Container();
  private readonly bg = new Graphics();
  private readonly text = uiText('body', '', paper.ink, { wordWrap: true, align: 'center' });
  private maxW = 260;
  private shown = false;
  private appear = 0;

  constructor() {
    super({ label: 'caption' });
    this.box.addChild(this.bg, this.text);
    this.addChild(this.box);
    this.visible = false;
  }

  get current(): string {
    return this.shown ? this.text.text : '';
  }

  /** Room for the caption: centered in `area`, at most `maxW` wide. */
  setMaxWidth(maxW: number): void {
    this.maxW = Math.round(maxW);
    if (this.shown) this.draw(this.text.text);
  }

  show(line: string): void {
    // A new caption over a shown one swaps in place; from hidden it fades and slides in.
    if (!this.shown) this.appear = 0;
    this.shown = true;
    this.visible = true;
    this.draw(line);
    this.pose();
  }

  hide(): void {
    this.shown = false;
  }

  /** Fades toward shown or hidden. */
  update(dt: number): void {
    if (!this.visible) return;
    const step = dt / BattleCaption.FADE;
    this.appear = this.shown ? Math.min(1, this.appear + step) : Math.max(0, this.appear - step);
    if (!this.shown && this.appear <= 0) this.visible = false;
    this.pose();
  }

  private pose(): void {
    this.box.alpha = this.appear;
    this.box.y = Math.round((1 - this.appear) * -3);
  }

  private draw(line: string): void {
    this.text.style.wordWrapWidth = this.maxW - 16;
    this.text.text = line;
    const w = Math.min(this.maxW, Math.ceil(this.text.width) + 16);
    const h = Math.ceil(this.text.height) + 8;
    this.bg.clear();
    drawPaper(this.bg, 0, 0, w, h, { radius: 3 });
    this.text.position.set(Math.round((w - this.text.width) / 2), 4);
  }
}

/** The whole battle so far (`L`). W/S scroll; E, Q or L close it. */
export class BattleLogPanel implements Widget<Container> {
  static readonly WIDTH = 300;
  static readonly ROWS = 12;
  readonly view = new Container({ label: 'battle-log' });
  private readonly rowsLayer = new Container();
  private top: number;

  constructor(
    private readonly lines: readonly string[],
    private readonly onClose: () => void,
  ) {
    const bg = new Graphics();
    drawPaper(bg, 0, 0, BattleLogPanel.WIDTH, this.height);
    const title = uiText('label', 'Battle log', paper.title);
    title.position.set(7, 5);
    const hints = new Container();
    const keys = [new KeyHint(upDownHint(), 'Scroll'), new KeyHint(keyHint('log'), 'Close')];
    keys[1]?.position.set(Math.ceil(keys[0]?.width ?? 0) + 8, 0);
    hints.addChild(...keys);
    hints.position.set(7, this.height - 13);
    this.view.addChild(bg, title, this.rowsLayer, hints);
    this.top = Math.max(0, lines.length - BattleLogPanel.ROWS);
    this.render();
  }

  get height(): number {
    return BattleLogPanel.ROWS * 11 + 32;
  }

  handleInput(input: UiInput): void {
    const dir = input.direction();
    const max = Math.max(0, this.lines.length - BattleLogPanel.ROWS);
    if (dir === 'up' && this.top > 0) {
      this.top--;
      this.render();
    } else if (dir === 'down' && this.top < max) {
      this.top++;
      this.render();
    }
    if (input.confirmPressed() || input.backPressed()) {
      uiSound('back');
      this.onClose();
    }
  }

  dismiss(): void {
    this.onClose();
  }

  contains(x: number, y: number): boolean {
    const b = this.view.getBounds();
    return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
  }

  private render(): void {
    for (const c of this.rowsLayer.removeChildren()) c.destroy();
    const shown = this.lines.slice(this.top, this.top + BattleLogPanel.ROWS);
    shown.forEach((line, i) => {
      const turn = line.startsWith('Turn ');
      const t = uiText(turn ? 'label' : 'body', line, turn ? paper.inkDim : paper.ink, {
        fontSize: turn ? 7 : 9,
      });
      // One row per line: long lines are cut with an ellipsis.
      while (t.width > BattleLogPanel.WIDTH - 16 && t.text.length > 4) {
        t.text = `${t.text.slice(0, -2)}…`;
      }
      t.position.set(8, 16 + i * 11 + (turn ? 2 : 0));
      this.rowsLayer.addChild(t);
    });
  }
}

/** The end of a battle: outcome, XP, level ups. Waits for `E` (the only text that does). */
export class BattleResultPanel implements Widget<Container> {
  static readonly WIDTH = 260;
  readonly view = new Container({ label: 'battle-result' });
  readonly height: number;
  private done = false;

  constructor(
    title: string,
    lines: readonly string[],
    private readonly onDone: () => void,
  ) {
    const bg = new Graphics();
    const head = uiText('name', title, paper.title);
    head.position.set(8, 5);
    const body = new Container();
    let y = 0;
    for (const line of lines) {
      const t = uiText('body', line, paper.ink, {
        wordWrap: true,
        wordWrapWidth: BattleResultPanel.WIDTH - 16,
      });
      t.position.set(0, y);
      body.addChild(t);
      y += Math.ceil(t.height) + 1;
    }
    body.position.set(8, 21);
    this.height = 21 + y + 18;
    drawPaper(bg, 0, 0, BattleResultPanel.WIDTH, this.height);
    const hint = new KeyHint(keyHint('confirm'), 'Continue');
    hint.position.set(BattleResultPanel.WIDTH - Math.ceil(hint.width) - 8, this.height - 13);
    this.view.addChild(bg, head, body, hint);
    this.view.eventMode = 'static';
    this.view.on('pointertap', () => this.close());
  }

  handleInput(input: UiInput): void {
    if (input.confirmPressed()) this.close();
  }

  private close(): void {
    if (this.done) return;
    this.done = true;
    uiSound('select');
    this.onDone();
  }
}
