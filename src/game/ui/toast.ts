/**
 * Toasts (C32): small paper banners that slide down at the top of the screen for quest and
 * badge news, without stopping play. They queue: one shows at a time, each for a few
 * seconds. Call `update` every frame and `layout` when the screen size changes.
 */

import { Container, Graphics } from 'pixi.js';
import { BADGE_NOTE, QUEST_NOTE } from '@game/story';
import { paper } from '../style/tokens';
import { drawPaper } from './skin';
import { uiText } from './text';

export interface Toast {
  /** Small caps line ("Quest complete"). */
  readonly title: string;
  readonly text: string;
  /** A badge or completed quest: gold edge. */
  readonly big?: boolean;
}

/** Seconds a toast stays (after sliding in). */
const HOLD = 2.6;
const SLIDE = 0.18;

/** Quest and badge notes as toasts; every other note stays a dialog page. */
export function splitNotes(notes: readonly string[]): {
  toasts: Toast[];
  pages: string[];
} {
  const toasts: Toast[] = [];
  const pages: string[] = [];
  for (const n of notes) {
    if (n.startsWith(QUEST_NOTE.done))
      toasts.push({ title: 'Quest complete', text: n.slice(QUEST_NOTE.done.length), big: true });
    else if (n.startsWith(QUEST_NOTE.started))
      toasts.push({ title: 'New quest', text: n.slice(QUEST_NOTE.started.length) });
    else if (n.startsWith(QUEST_NOTE.updated))
      toasts.push({ title: 'Quest updated', text: n.slice(QUEST_NOTE.updated.length) });
    else if (n.startsWith(BADGE_NOTE))
      toasts.push({
        title: 'Badge',
        text: n.slice(BADGE_NOTE.length).replace(/!$/, ''),
        big: true,
      });
    else pages.push(n);
  }
  return { toasts, pages };
}

export class ToastQueue {
  readonly view = new Container({ label: 'toasts' });
  private readonly queue: Toast[] = [];
  private current: { box: Container; t: number; h: number } | undefined;
  private width = 480;
  private top = 30;

  get showing(): string | undefined {
    return this.current ? (this.current.box.label ?? undefined) : undefined;
  }

  get pending(): number {
    return this.queue.length + (this.current ? 1 : 0);
  }

  push(...toasts: Toast[]): void {
    this.queue.push(...toasts);
  }

  /** Screen width and the y the toast slides down to. */
  layout(width: number, top: number): void {
    this.width = width;
    this.top = top;
    if (this.current) this.place(this.current);
  }

  update(dt: number): void {
    if (!this.current) {
      const next = this.queue.shift();
      if (!next) return;
      const box = this.build(next);
      this.view.addChild(box);
      this.current = { box, t: 0, h: box.height };
    }
    const c = this.current;
    c.t += dt;
    if (c.t >= SLIDE * 2 + HOLD) {
      c.box.destroy({ children: true });
      this.current = undefined;
      return;
    }
    this.place(c);
  }

  private place(c: { box: Container; t: number; h: number }): void {
    const inT = Math.min(1, c.t / SLIDE);
    const outT = Math.max(0, (c.t - SLIDE - HOLD) / SLIDE);
    const shown = (1 - (1 - inT) ** 2) * (1 - outT * outT);
    c.box.alpha = Math.min(1, shown * 1.5);
    c.box.position.set(
      Math.round((this.width - c.box.width) / 2),
      Math.round(this.top - (1 - shown) * (c.h + this.top)),
    );
  }

  private build(t: Toast): Container {
    const box = new Container({ label: `${t.title}: ${t.text}` });
    const title = uiText('label', t.title, t.big ? paper.title : paper.inkDim);
    const text = uiText('name', t.text, paper.ink);
    const w = Math.ceil(Math.max(title.width, text.width)) + 24;
    const h = Math.ceil(title.height + text.height) + 10;
    const g = new Graphics();
    drawPaper(g, 0, 0, w, h, { radius: 3 });
    if (t.big) g.rect(3, 2, w - 6, 2).fill({ color: paper.cursor });
    title.position.set(Math.round((w - title.width) / 2), 5);
    text.position.set(Math.round((w - text.width) / 2), Math.round(5 + title.height));
    box.addChild(g, title, text);
    return box;
  }
}
