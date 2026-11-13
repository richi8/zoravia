/**
 * Storage screen (C22, Zorling centers only): the hotbar team on the left, the storage box
 * as a grid of portraits on the right (it scrolls by rows). Pick a Zorling up and put it on
 * another one to swap them, or on an empty spot to move it (deposit / withdraw).
 *
 * Keyboard: W A S D move (left of the box's first column is the team), E pick up / put down,
 * Q cancel / leave. Mouse: hover a slot, click to pick up / put down.
 */

import { Container, Graphics, Rectangle } from 'pixi.js';
import { type UiInput, type Widget } from '@engine/ui';
import { paper } from '../style/tokens';
import { KeyHint, TypeBadge, row } from './badges';
import { HpBar } from './bars';
import { drawPaper, drawWell } from './skin';
import { uiText } from './text';
import { PointerQueue, portraitSlot, SLOT, type ZorlingView } from './zorling-view';

export type StorageSpot = { readonly area: 'team' | 'storage'; readonly index: number };

export interface StorageOptions {
  readonly team: readonly ZorlingView[];
  readonly storage: readonly ZorlingView[];
  /** Whether the Zorling at `from` may go onto `to` (swap, or move onto an empty spot). */
  readonly canMove: (from: StorageSpot, to: StorageSpot) => boolean;
  /** Does the move; returns the new team and storage views. */
  readonly onMove: (
    from: StorageSpot,
    to: StorageSpot,
  ) => { team: readonly ZorlingView[]; storage: readonly ZorlingView[] };
  readonly onBack: (panel: StoragePanel) => void;
}

const COLS = 7;
const ROWS = 4;
const GAP = 3;
const TEAM_X = 8;
const BOX_X = 62;
const TOP = 22;
const W = BOX_X + COLS * (SLOT + GAP) + 6;
const H = TOP + ROWS * (SLOT + GAP) + 44;

export class StoragePanel implements Widget<Container> {
  static readonly WIDTH = W;
  static readonly HEIGHT = H;
  readonly view = new Container({ label: 'storage' });
  private readonly dynamic = new Container();
  private team: readonly ZorlingView[];
  private storage: readonly ZorlingView[];
  private at: StorageSpot = { area: 'team', index: 0 };
  private held: StorageSpot | undefined;
  private scroll = 0;
  private focused = false;
  private message = '';
  private readonly pointer = new PointerQueue<'team' | 'storage'>(() => this.focused);

  constructor(private readonly options: StorageOptions) {
    this.team = options.team;
    this.storage = options.storage;
    const bg = drawPaper(new Graphics(), 0, 0, W, H);
    bg.rect(BOX_X - 7, TOP, 1, ROWS * (SLOT + GAP)).fill({ color: paper.shade });
    const title = uiText('label', 'Storage', paper.title);
    title.position.set(7, 6);
    this.view.addChild(bg, title, this.dynamic);
    this.view.eventMode = 'static';
    this.view.hitArea = new Rectangle(0, 0, W, H);
    this.build();
  }

  get state(): { at: StorageSpot; held: StorageSpot | undefined; scroll: number } {
    return { at: this.at, held: this.held, scroll: this.scroll };
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
    this.pointer.clear();
    this.build();
  }

  /** Box cells: every stored Zorling plus one empty cell to deposit into. */
  private get cells(): number {
    return this.storage.length + 1;
  }

  handleInput(input: UiInput): void {
    const p = this.pointer.take();
    if (p) {
      const spot = { area: p.kind, index: p.index };
      const same = spot.area === this.at.area && spot.index === this.at.index;
      if (!same) this.go(spot);
      if (p.click) this.confirm();
      return;
    }
    const dir = input.direction();
    if (dir) this.step(dir);
    if (input.confirmPressed()) this.confirm();
    else if (input.backPressed()) this.back();
  }

  private step(dir: 'up' | 'down' | 'left' | 'right'): void {
    const { at } = this;
    if (at.area === 'team') {
      if (dir === 'up' || dir === 'down') {
        const n = 3;
        this.go({ area: 'team', index: (at.index + (dir === 'down' ? 1 : n - 1)) % n });
      } else {
        // Into the box, on the visible row next to this team slot.
        const r = Math.min(this.scroll + at.index, Math.floor((this.cells - 1) / COLS));
        const col = dir === 'right' ? 0 : COLS - 1;
        this.go({ area: 'storage', index: Math.min(r * COLS + col, this.cells - 1) });
      }
      return;
    }
    const col = at.index % COLS;
    const r = Math.floor(at.index / COLS);
    const rows = Math.ceil(this.cells / COLS);
    if (dir === 'left' && col === 0) {
      this.go({ area: 'team', index: Math.min(2, Math.max(0, r - this.scroll)) });
    } else if (dir === 'right' && (col === COLS - 1 || at.index === this.cells - 1)) {
      this.go({ area: 'team', index: Math.min(2, Math.max(0, r - this.scroll)) });
    } else if (dir === 'left' || dir === 'right') {
      this.go({ area: 'storage', index: at.index + (dir === 'right' ? 1 : -1) });
    } else {
      let nr = r + (dir === 'down' ? 1 : -1);
      if (nr < 0) nr = rows - 1;
      if (nr >= rows) nr = 0;
      this.go({ area: 'storage', index: Math.min(nr * COLS + col, this.cells - 1) });
    }
  }

  private go(spot: StorageSpot): void {
    this.at = spot;
    this.message = '';
    if (spot.area === 'storage') {
      const r = Math.floor(spot.index / COLS);
      if (r < this.scroll) this.scroll = r;
      if (r >= this.scroll + ROWS) this.scroll = r - ROWS + 1;
    }
    this.build();
  }

  private zorlingAt(s: StorageSpot): ZorlingView | undefined {
    return (s.area === 'team' ? this.team : this.storage)[s.index];
  }

  private confirm(): void {
    if (!this.held) {
      if (this.zorlingAt(this.at)) this.held = this.at;
      this.build();
      return;
    }
    const from = this.held;
    const to = this.at;
    if (from.area === to.area && from.index === to.index) {
      this.held = undefined;
    } else if (this.options.canMove(from, to)) {
      const next = this.options.onMove(from, to);
      this.team = next.team;
      this.storage = next.storage;
      this.held = undefined;
      // Keep the cursor on a real cell after the lists repacked.
      if (this.at.area === 'team') {
        this.at = { area: 'team', index: Math.min(this.at.index, 2) };
      } else {
        this.at = { area: 'storage', index: Math.min(this.at.index, this.cells - 1) };
      }
    } else {
      this.message = 'Your team needs at least one Zorling.';
    }
    this.build();
  }

  private back(): void {
    if (this.held) {
      this.held = undefined;
      this.build();
    } else {
      this.options.onBack(this);
    }
  }

  private build(): void {
    for (const c of this.dynamic.removeChildren()) c.destroy({ children: true });
    const add = <T extends Container>(c: T, x = 0, y = 0): T => {
      c.position.set(Math.round(x), Math.round(y));
      this.dynamic.addChild(c);
      return c;
    };
    const isAt = (s: StorageSpot): boolean =>
      this.focused && s.area === this.at.area && s.index === this.at.index;
    const isHeld = (s: StorageSpot): boolean =>
      !!this.held && s.area === this.held.area && s.index === this.held.index;

    const count = uiText('label', `${this.storage.length} stored`, paper.inkDim);
    add(count, Math.round(W - 8 - count.width), 6);
    add(uiText('label', 'Team', paper.inkDim), TEAM_X, TOP - 9);
    add(uiText('label', 'Box', paper.inkDim), BOX_X, TOP - 9);

    for (let i = 0; i < 3; i++) {
      const s: StorageSpot = { area: 'team', index: i };
      const z = this.team[i];
      const slot = portraitSlot(z?.portrait, { on: isAt(s), frame: isHeld(s), dim: z?.hp === 0 });
      this.pointer.bind(slot, 'team', i);
      add(slot, TEAM_X, TOP + i * (SLOT + GAP));
      const key = uiText('label', String(i + 1), paper.inkDim);
      add(key, TEAM_X + SLOT + 3, TOP + i * (SLOT + GAP) + 1);
    }

    const rows = Math.ceil(this.cells / COLS);
    for (let r = this.scroll; r < Math.min(rows, this.scroll + ROWS); r++) {
      for (let c = 0; c < COLS; c++) {
        const index = r * COLS + c;
        if (index >= this.cells) break;
        const s: StorageSpot = { area: 'storage', index };
        const z = this.storage[index];
        const slot = portraitSlot(z?.portrait, { on: isAt(s), frame: isHeld(s) });
        this.pointer.bind(slot, 'storage', index);
        add(slot, BOX_X + c * (SLOT + GAP), TOP + (r - this.scroll) * (SLOT + GAP));
      }
    }
    if (rows > ROWS) {
      const label = `${this.scroll + 1}–${Math.min(rows, this.scroll + ROWS)} / ${rows}`;
      const t = uiText('label', `Rows ${label}`, paper.inkDim);
      add(t, Math.round(W - 8 - t.width), TOP - 9);
    }

    // Info line about the Zorling under the cursor (or the one being moved).
    const iy = TOP + ROWS * (SLOT + GAP) + 1;
    const g = add(new Graphics(), 0, 0);
    drawWell(g, 6, iy, W - 12, 24);
    const z = this.zorlingAt(this.at);
    if (this.message) {
      add(uiText('body', this.message, paper.warn), 11, iy + 6);
    } else if (z) {
      add(uiText('name', z.name), 11, iy + 1);
      add(uiText('label', `Lv ${z.level}`, paper.inkDim), 11, iy + 15);
      let bx = 120;
      for (const t of z.types) {
        const b = add(new TypeBadge(t), bx, iy + 3);
        bx += Math.ceil(b.width) + 3;
      }
      const bar = add(new HpBar(70), W - 92, iy + 6);
      bar.set(z.maxHp ? z.hp / z.maxHp : 0, false);
      add(uiText('label', `${z.hp}/${z.maxHp}`, paper.inkDim), W - 92, iy + 14);
    } else {
      const text = this.at.area === 'storage' ? 'Empty spot' : 'Empty slot';
      add(uiText('body', text, paper.inkDim), 11, iy + 6);
    }

    const held = this.held ? this.zorlingAt(this.held) : undefined;
    const hints = held
      ? [new KeyHint('E', 'Put here'), new KeyHint('Q', 'Cancel')]
      : [new KeyHint('E', 'Pick up'), new KeyHint('WASD', 'Move'), new KeyHint('Q', 'Leave')];
    for (const h of hints) this.dynamic.addChild(h);
    const hw = row(hints, 8, 7, H - 13);
    if (held) add(uiText('label', `Moving ${held.name}`, paper.title), 7 + hw + 12, H - 13);
  }
}
