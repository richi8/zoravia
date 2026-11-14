/**
 * Quest log (C26, `J`): quests on the left (active first, then finished ones with a check),
 * the selected one on the right: who gave it, the summary, the steps reached so far (done
 * ones ticked, the current one in ink) and the reward.
 *
 * Keyboard: W/S choose (the list scrolls), Q back. Mouse: hover/click rows.
 */

import { Container, Graphics, Rectangle } from 'pixi.js';
import { GridCursor, type UiInput, type Widget, uiSound } from '@engine/ui';
import { paper } from '../style/tokens';
import { KeyHint, row } from './badges';
import { drawCursor, drawPaper } from './skin';
import { uiText } from './text';
import { PointerQueue } from './zorling-view';

export interface QuestRow {
  readonly name: string;
  readonly from: string | undefined;
  readonly summary: string;
  readonly done: boolean;
  readonly steps: readonly { readonly text: string; readonly done: boolean }[];
  readonly reward: string;
  /** Started or moved on since the log was last opened (C32): shows a "New" tag. */
  readonly fresh?: boolean;
}

export interface QuestPanelOptions {
  readonly rows: readonly QuestRow[];
  readonly onBack: (panel: QuestPanel) => void;
}

const W = 330;
const H = 196;
const LIST_W = 120;
const ROW_H = 15;
const TOP = 20;
const VISIBLE = 10;
/** Height of the right column (quest details). */
const DETAIL_H = H - TOP - 6;

export class QuestPanel implements Widget<Container> {
  static readonly WIDTH = W;
  static readonly HEIGHT = H;
  readonly view = new Container({ label: 'quests' });
  private readonly dynamic = new Container();
  private readonly cursor: GridCursor;
  private scroll = 0;
  private focused = false;
  private readonly pointer = new PointerQueue<'row'>(() => this.focused);

  constructor(private readonly options: QuestPanelOptions) {
    const bg = drawPaper(new Graphics(), 0, 0, W, H);
    bg.rect(LIST_W + 8, TOP, 1, H - TOP - 18).fill({ color: paper.shade });
    const title = uiText('label', 'Quests', paper.title);
    title.position.set(7, 6);
    const active = options.rows.filter((r) => !r.done).length;
    const done = options.rows.length - active;
    const count = uiText('label', `Active ${active} · Done ${done}`, paper.inkDim);
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
      drawTick(g, 6, 3, d.done, !d.done);
      r.addChild(g);
      const name = uiText('body', d.name, d.done ? paper.inkDim : paper.ink);
      name.position.set(18, 1);
      r.addChild(name);
      if (d.fresh) {
        const tag = uiText('label', 'New', paper.title);
        tag.position.set(Math.round(LIST_W - 4 - tag.width), 2);
        name.style.wordWrap = false;
        // Keep the name clear of the tag.
        if (name.x + name.width > tag.x - 3) name.scale.x = (tag.x - 3 - name.x) / name.width;
        r.addChild(tag);
      }
      r.hitArea = new Rectangle(0, 0, LIST_W, ROW_H - 1);
      this.pointer.bind(r, 'row', i);
      add(r, 4, TOP + (i - this.scroll) * ROW_H);
    }

    const d = rows[this.cursor.index];
    if (d) {
      // All steps if they fit; else the finished ones fold into one line, so the current
      // step and the reward always show. Anything still too tall is clipped.
      let detail = detailOf(d, false);
      if (detail.height > DETAIL_H) {
        detail.destroy({ children: true });
        detail = detailOf(d, true);
      }
      const clip = new Graphics().rect(0, 0, W - LIST_W - 16 - 6, DETAIL_H).fill(0xffffff);
      add(clip, LIST_W + 16, TOP);
      detail.mask = clip;
      add(detail, LIST_W + 16, TOP);
    }

    const hints = [new KeyHint('W S', 'Choose'), new KeyHint('Q', 'Back')];
    for (const h of hints) this.dynamic.addChild(h);
    row(hints, 8, 7, H - 13);
  }
}

/** The right column for one quest; `fold`: finished steps as a single line. */
function detailOf(d: QuestRow, fold: boolean): Container {
  const out = new Container();
  const add = <T extends Container>(c: T, x: number, y: number): T => {
    c.position.set(Math.round(x), Math.round(y));
    out.addChild(c);
    return c;
  };
  const wrap = W - LIST_W - 16 - 8;
  let y = 0;
  add(uiText('name', d.name), 0, y);
  y += 14;
  const status = d.done ? 'Done' : d.from ? `From ${d.from}` : 'Active';
  add(uiText('label', status, d.done ? paper.title : paper.inkDim), 0, y);
  y += 11;
  if (d.summary) {
    const s = add(
      uiText('body', d.summary, paper.ink, { wordWrap: true, wordWrapWidth: wrap }),
      0,
      y,
    );
    y += Math.ceil(s.height) + 5;
  }
  const done = d.steps.filter((st) => st.done);
  const steps =
    fold && done.length > 1
      ? [{ text: `${done.length} steps done`, done: true }, ...d.steps.filter((st) => !st.done)]
      : d.steps;
  for (const step of steps) {
    const g = add(new Graphics(), 0, y + 2);
    drawTick(g, 0, 0, step.done, !step.done);
    const t = add(
      uiText('body', step.text, step.done ? paper.inkDim : paper.ink, {
        wordWrap: true,
        wordWrapWidth: wrap - 12,
      }),
      12,
      y,
    );
    y += Math.ceil(t.height) + 2;
  }
  if (d.reward) {
    y += 4;
    add(uiText('label', 'Reward', paper.title), 0, y);
    add(uiText('body', d.reward, paper.ink, { wordWrap: true, wordWrapWidth: wrap }), 0, y + 9);
  }
  return out;
}

/** A 7×7 pixel box: ticked when done; the current step's box is gold. */
function drawTick(g: Graphics, x: number, y: number, done: boolean, current: boolean): void {
  g.rect(x, y, 7, 7).fill({ color: current ? paper.edge : paper.inkDim });
  g.rect(x + 1, y + 1, 5, 5).fill({ color: paper.base });
  if (current) g.rect(x + 2, y + 2, 3, 3).fill({ color: paper.accent });
  if (done) {
    // A small check mark.
    const ink = paper.title;
    g.rect(x + 1, y + 3, 1, 1).fill({ color: ink });
    g.rect(x + 2, y + 4, 1, 1).fill({ color: ink });
    g.rect(x + 3, y + 3, 1, 1).fill({ color: ink });
    g.rect(x + 4, y + 2, 1, 1).fill({ color: ink });
    g.rect(x + 5, y + 1, 1, 1).fill({ color: ink });
  }
}
