/**
 * Dex screen (C22, `B`): every species in Dex order on the left (unseen ones as "???"),
 * the selected one on the right. Seen species show their sprite, name and types; caught ones
 * also their description.
 *
 * Keyboard: W/S choose (the list scrolls), A/D page, Q back. Mouse: hover/click rows.
 */

import { Container, Graphics, Rectangle, Sprite, type Texture } from 'pixi.js';
import { GridCursor, type UiInput, type Widget, uiSound } from '@engine/ui';
import { paper, type TypeId } from '../style/tokens';
import { KeyHint, TypeBadge, row } from './badges';
import { drawCursor, drawPaper, drawWell } from './skin';
import { uiText } from './text';
import { PointerQueue } from './zorling-view';

export interface DexRow {
  readonly number: number;
  readonly name: string;
  readonly seen: boolean;
  readonly caught: boolean;
  readonly types: readonly TypeId[];
  readonly description: string;
}

export interface DexOptions {
  readonly rows: readonly DexRow[];
  /** 64×64 sprite of a seen species (made on demand). */
  readonly sprite: (index: number) => Texture | undefined;
  readonly onBack: (panel: DexPanel) => void;
}

const W = 330;
const H = 196;
const LIST_W = 140;
const ROW_H = 15;
const TOP = 20;
const VISIBLE = 10;
const ART = 64;

export class DexPanel implements Widget<Container> {
  static readonly WIDTH = W;
  static readonly HEIGHT = H;
  readonly view = new Container({ label: 'dex' });
  private readonly dynamic = new Container();
  private readonly cursor: GridCursor;
  private scroll = 0;
  private focused = false;
  private readonly pointer = new PointerQueue<'row'>(() => this.focused);

  constructor(private readonly options: DexOptions) {
    const bg = drawPaper(new Graphics(), 0, 0, W, H);
    bg.rect(LIST_W + 8, TOP, 1, H - TOP - 18).fill({ color: paper.shade });
    const title = uiText('label', 'Dex', paper.title);
    title.position.set(7, 6);
    const seen = options.rows.filter((r) => r.seen).length;
    const caught = options.rows.filter((r) => r.caught).length;
    const count = uiText('label', `Seen ${seen} · Caught ${caught}`, paper.inkDim);
    count.position.set(Math.round(W - 8 - count.width), 6);
    this.view.addChild(bg, title, count, this.dynamic);
    this.cursor = new GridCursor(options.rows.length, 1);
    this.view.eventMode = 'static';
    this.view.hitArea = new Rectangle(0, 0, W, H);
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
    if (p) {
      if (this.cursor.set(p.index)) this.changed();
      return;
    }
    const dir = input.direction();
    if ((dir === 'up' || dir === 'down') && this.cursor.move(dir)) this.changed();
    else if (dir === 'left' || dir === 'right') {
      const n = this.options.rows.length;
      const step = dir === 'right' ? VISIBLE : -VISIBLE;
      const next = Math.max(0, Math.min(n - 1, this.cursor.index + step));
      if (this.cursor.set(next)) this.changed();
    }
    if (input.backPressed()) {
      uiSound('back');
      this.options.onBack(this);
    }
  }

  private changed(): void {
    uiSound('move');
    const i = this.cursor.index;
    if (i < this.scroll) this.scroll = i;
    if (i >= this.scroll + VISIBLE) this.scroll = i - VISIBLE + 1;
    this.build();
  }

  private build(): void {
    for (const c of this.dynamic.removeChildren()) c.destroy({ children: true });
    const add = <T extends Container>(c: T, x = 0, y = 0): T => {
      c.position.set(Math.round(x), Math.round(y));
      this.dynamic.addChild(c);
      return c;
    };
    const { rows } = this.options;
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
      const tex = d.seen ? this.options.sprite(this.cursor.index) : undefined;
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
      add(
        uiText('body', text, d.caught ? paper.ink : paper.inkDim, {
          wordWrap: true,
          wordWrapWidth: W - dx - 8,
        }),
        dx,
        TOP + ART + 10,
      );
    }

    const hints = [
      new KeyHint('W S', 'Choose'),
      new KeyHint('A D', 'Page'),
      new KeyHint('Q', 'Back'),
    ];
    for (const h of hints) this.dynamic.addChild(h);
    row(hints, 8, 7, H - 13);
  }
}
