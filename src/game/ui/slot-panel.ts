/**
 * Save slot cards (C33): the title screen's slot list for loading and for a new game. Each
 * card shows the team's portraits, the lead's name and level, where the player is, badges,
 * Zorlings caught, play time and when it was saved. Empty and unreadable slots say so.
 *
 * Keyboard: W/S choose, E pick, Q back. Mouse: hover and click a card.
 */

import { Container, Graphics, Rectangle, type Texture } from 'pixi.js';
import { GridCursor, uiSound, type UiInput, type Widget } from '@engine/ui';
import { formatPlaytime, type SlotInfo } from '@game/save';
import { paper } from '../style/tokens';
import { KeyHint, row } from './badges';
import { keyHint } from '@game/input/key-hint';
import { drawCursor, drawPaper, drawWell } from './skin';
import { uiText } from './text';
import { PointerQueue, portraitSlot, SLOT } from './zorling-view';

export interface SlotPanelOptions {
  readonly title: string;
  readonly slots: readonly SlotInfo[];
  /** What E does, for the key hint ("Load", "Start here"). */
  readonly action: string;
  /** A short line under the cards (e.g. that saves only last this session). */
  readonly note?: string;
  readonly portrait: (species: string) => Texture;
  readonly onSelect: (info: SlotInfo, panel: SlotPanel) => void;
  readonly onBack: (panel: SlotPanel) => void;
}

const W = 292;
const CARD_H = 46;
const GAP = 4;
const TOP = 19;

export class SlotPanel implements Widget<Container> {
  readonly view = new Container({ label: 'slots' });
  private readonly bg = new Graphics();
  private readonly dynamic = new Container();
  private readonly cursor: GridCursor;
  private slots: readonly SlotInfo[];
  private focused = false;
  private readonly pointer = new PointerQueue<'card'>(() => this.focused);

  constructor(private readonly options: SlotPanelOptions) {
    this.slots = options.slots;
    this.cursor = new GridCursor(this.slots.length, 1);
    this.view.addChild(this.bg, this.dynamic);
    this.view.eventMode = 'static';
    this.build();
  }

  get width(): number {
    return W;
  }

  get height(): number {
    return TOP + this.slots.length * (CARD_H + GAP) + (this.options.note ? 30 : 18);
  }

  get index(): number {
    return this.cursor.index;
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

  contains(x: number, y: number): boolean {
    const p = this.view.toLocal({ x, y });
    return p.x >= 0 && p.y >= 0 && p.x <= W && p.y <= this.height;
  }

  dismiss(): void {
    this.options.onBack(this);
  }

  /** New slot infos (after a delete), keeping the cursor. */
  setSlots(slots: readonly SlotInfo[], index = this.cursor.index): void {
    this.slots = slots;
    this.cursor.reset(slots.length);
    this.cursor.set(Math.min(index, slots.length - 1));
    this.build();
  }

  select(index: number): void {
    this.cursor.set(index);
    this.build();
  }

  handleInput(input: UiInput): void {
    const p = this.pointer.take();
    if (p) {
      const was = this.cursor.index;
      if (this.cursor.set(p.index)) {
        uiSound('move');
        this.build();
      }
      if (p.click && was === p.index) this.pick();
      return;
    }
    const dir = input.direction();
    if ((dir === 'up' || dir === 'down') && this.cursor.move(dir)) {
      uiSound('move');
      this.build();
    }
    if (input.confirmPressed()) this.pick();
    else if (input.backPressed()) {
      uiSound('back');
      this.options.onBack(this);
    }
  }

  private pick(): void {
    const info = this.slots[this.cursor.index];
    if (!info) return;
    uiSound('select');
    this.options.onSelect(info, this);
  }

  private build(): void {
    for (const c of this.dynamic.removeChildren()) c.destroy({ children: true });
    const h = this.height;
    drawPaper(this.bg.clear(), 0, 0, W, h);
    const add = <T extends Container>(c: T, x: number, y: number): T => {
      c.position.set(Math.round(x), Math.round(y));
      this.dynamic.addChild(c);
      return c;
    };
    add(uiText('label', this.options.title, paper.title), 7, 6);
    this.slots.forEach((info, i) => {
      const card = add(new Container(), 5, TOP + i * (CARD_H + GAP));
      const g = new Graphics();
      const sel = i === this.cursor.index;
      if (sel) drawCursor(g, 0, 0, W - 10, CARD_H, this.focused);
      else drawWell(g, 0, 0, W - 10, CARD_H);
      card.addChild(g);
      this.card(card, info);
      card.hitArea = new Rectangle(0, 0, W - 10, CARD_H);
      this.pointer.bind(card, 'card', i);
    });
    const by = TOP + this.slots.length * (CARD_H + GAP);
    if (this.options.note) add(uiText('body', this.options.note, paper.inkDim), 8, by - 1);
    const hints = [
      new KeyHint(keyHint('confirm'), this.options.action),
      new KeyHint(keyHint('back'), 'Back'),
    ];
    for (const k of hints) this.dynamic.addChild(k);
    row(hints, 8, 7, h - 12);
  }

  private card(card: Container, info: SlotInfo): void {
    const put = <T extends Container>(c: T, x: number, y: number): T => {
      c.position.set(Math.round(x), Math.round(y));
      card.addChild(c);
      return c;
    };
    const textX = 4 + 3 * (SLOT + 2) + 6;
    if (info.state !== 'ok') {
      put(uiText('name', `Slot ${info.slot}`, paper.inkDim), textX, 5);
      const line =
        info.state === 'empty'
          ? 'Empty'
          : `Can't be read: ${info.problems[0] ?? 'unknown problem'}`;
      put(
        uiText('body', line, info.state === 'empty' ? paper.inkDim : paper.warn, {
          wordWrap: true,
          wordWrapWidth: W - 10 - textX - 6,
        }),
        textX,
        20,
      );
      return;
    }
    const s = info.summary;
    for (let k = 0; k < 3; k++) {
      const species = s.species[k];
      put(
        portraitSlot(species ? this.options.portrait(species) : undefined),
        4 + k * (SLOT + 2),
        6,
      );
    }
    put(uiText('name', `${s.lead}  Lv ${s.level}`), textX, 3);
    const slot = uiText('label', `Slot ${info.slot}`, paper.inkDim);
    put(slot, W - 16 - slot.width, 6);
    const badges = s.badges === 1 ? '1 badge' : `${s.badges} badges`;
    put(uiText('body', `${s.place} · ${badges} · ${s.caught} caught`, paper.ink), textX, 17);
    const backup = info.fromBackup ? ' · from backup' : '';
    put(
      uiText(
        'label',
        `${formatPlaytime(s.playtime)} played · saved ${shortDate(s.savedAt)}${backup}`,
        paper.inkDim,
      ),
      textX,
      31,
    );
  }
}

/** "13 Nov, 08:49" in local time. */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '?';
  const month = d.toLocaleString('en', { month: 'short' });
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${d.getDate()} ${month}, ${time}`;
}
