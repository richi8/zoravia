/**
 * New game screens (C33): the start region list and the starter choice.
 *
 * - `RegionPanel`: the regions a new game can start in (pack `starts`), with each region's
 *   description. W/S choose, E pick, Q back.
 * - `StarterPanel`: the region's starters side by side, each with its sprite, types and a few
 *   words on how it plays. A/D choose, E pick, Q back. The idle sprite bobs gently.
 */

import { Container, Graphics, Rectangle, Sprite, type Texture } from 'pixi.js';
import { GridCursor, uiSound, type UiInput, type Widget } from '@engine/ui';
import { paper, type TypeId } from '../style/tokens';
import { KeyHint, row, TypeBadge } from './badges';
import { drawCursor, drawPaper, drawWell } from './skin';
import { uiText } from './text';
import { PointerQueue } from './zorling-view';

export interface RegionChoice {
  readonly name: string;
  readonly description: string;
  /** "Starters: Sprigling, Drizzlet, Emberkit". */
  readonly detail: string;
}

export interface RegionPanelOptions {
  readonly regions: readonly RegionChoice[];
  readonly onSelect: (index: number, panel: RegionPanel) => void;
  readonly onBack: (panel: RegionPanel) => void;
}

const REGION_W = 300;
const LIST_W = 92;
const REGION_ROW = 15;
const REGION_H = 112;

export class RegionPanel implements Widget<Container> {
  readonly view = new Container({ label: 'regions' });
  private readonly dynamic = new Container();
  private readonly cursor: GridCursor;
  private focused = false;
  private readonly pointer = new PointerQueue<'row'>(() => this.focused);

  constructor(private readonly options: RegionPanelOptions) {
    this.cursor = new GridCursor(options.regions.length, 1);
    const bg = drawPaper(new Graphics(), 0, 0, REGION_W, REGION_H);
    bg.rect(LIST_W + 8, 18, 1, REGION_H - 36).fill({ color: paper.shade });
    const title = uiText('label', 'Where does your journey begin?', paper.title);
    title.position.set(7, 6);
    this.view.addChild(bg, title, this.dynamic);
    this.view.eventMode = 'static';
    this.view.hitArea = new Rectangle(0, 0, REGION_W, REGION_H);
    this.build();
  }

  get width(): number {
    return REGION_W;
  }

  get height(): number {
    return REGION_H;
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
    return p.x >= 0 && p.y >= 0 && p.x <= REGION_W && p.y <= REGION_H;
  }

  dismiss(): void {
    this.options.onBack(this);
  }

  handleInput(input: UiInput): void {
    const p = this.pointer.take();
    if (p) {
      const was = this.cursor.index;
      if (this.cursor.set(p.index)) uiSound('move');
      this.build();
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
    uiSound('select');
    this.options.onSelect(this.cursor.index, this);
  }

  private build(): void {
    for (const c of this.dynamic.removeChildren()) c.destroy({ children: true });
    const add = <T extends Container>(c: T, x: number, y: number): T => {
      c.position.set(Math.round(x), Math.round(y));
      this.dynamic.addChild(c);
      return c;
    };
    this.options.regions.forEach((r, i) => {
      const view = add(new Container(), 5, 18 + i * REGION_ROW);
      const g = new Graphics();
      if (i === this.cursor.index) drawCursor(g, 0, 0, LIST_W, REGION_ROW - 1, this.focused);
      view.addChild(g);
      const t = uiText('body', r.name);
      t.position.set(12, 1);
      view.addChild(t);
      view.hitArea = new Rectangle(0, 0, LIST_W, REGION_ROW - 1);
      this.pointer.bind(view, 'row', i);
    });
    const r = this.options.regions[this.cursor.index];
    const dx = LIST_W + 16;
    if (r) {
      add(uiText('name', r.name, paper.title), dx, 16);
      const d = add(
        uiText('body', r.description, paper.ink, {
          wordWrap: true,
          wordWrapWidth: REGION_W - dx - 8,
        }),
        dx,
        31,
      );
      add(
        uiText('label', r.detail, paper.inkDim, {
          wordWrap: true,
          wordWrapWidth: REGION_W - dx - 8,
        }),
        dx,
        Math.ceil(d.y + d.height + 4),
      );
    }
    const hints = [new KeyHint('E', 'Choose'), new KeyHint('Q', 'Back')];
    for (const h of hints) this.dynamic.addChild(h);
    row(hints, 8, 7, REGION_H - 12);
  }
}

// ------------------------------------------------------------------ starters

export interface StarterChoice {
  readonly name: string;
  readonly types: readonly TypeId[];
  readonly blurb: string;
  /** 64×64 sprite. */
  readonly art: Texture;
}

export interface StarterPanelOptions {
  readonly region: string;
  readonly level: number;
  readonly starters: readonly StarterChoice[];
  readonly onSelect: (index: number, panel: StarterPanel) => void;
  readonly onBack: (panel: StarterPanel) => void;
}

const COL_W = 112;
const COL_GAP = 6;
const ART = 72;
const STARTER_H = 190;

export class StarterPanel implements Widget<Container> {
  readonly view = new Container({ label: 'starters' });
  private readonly dynamic = new Container();
  private readonly cursor: GridCursor;
  private readonly sprites: Sprite[] = [];
  private focused = false;
  private time = 0;
  private readonly pointer = new PointerQueue<'col'>(() => this.focused);
  private readonly w: number;

  constructor(private readonly options: StarterPanelOptions) {
    const n = options.starters.length;
    this.w = 10 + n * COL_W + (n - 1) * COL_GAP;
    this.cursor = new GridCursor(n, n);
    const bg = drawPaper(new Graphics(), 0, 0, this.w, STARTER_H);
    const title = uiText('label', `Choose your first Zorling · ${options.region}`, paper.title);
    title.position.set(7, 6);
    this.view.addChild(bg, title, this.dynamic);
    this.view.eventMode = 'static';
    this.view.hitArea = new Rectangle(0, 0, this.w, STARTER_H);
    this.build();
  }

  get width(): number {
    return this.w;
  }

  get height(): number {
    return STARTER_H;
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
    return p.x >= 0 && p.y >= 0 && p.x <= this.w && p.y <= STARTER_H;
  }

  dismiss(): void {
    this.options.onBack(this);
  }

  update(dt: number): void {
    this.time += dt;
    // The highlighted starter hops softly; the others stand still.
    this.sprites.forEach((s, i) => {
      const hop = i === this.cursor.index ? Math.round(Math.abs(Math.sin(this.time * 4)) * 3) : 0;
      s.y = 22 + ART - 2 - s.height - hop;
    });
  }

  handleInput(input: UiInput): void {
    const p = this.pointer.take();
    if (p) {
      const was = this.cursor.index;
      if (this.cursor.set(p.index)) uiSound('move');
      this.build();
      if (p.click && was === p.index) this.pick();
      return;
    }
    const dir = input.direction();
    if ((dir === 'left' || dir === 'right') && this.cursor.move(dir)) {
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
    uiSound('select');
    this.options.onSelect(this.cursor.index, this);
  }

  private build(): void {
    for (const c of this.dynamic.removeChildren()) c.destroy({ children: true });
    this.sprites.length = 0;
    const add = <T extends Container>(parent: Container, c: T, x: number, y: number): T => {
      c.position.set(Math.round(x), Math.round(y));
      parent.addChild(c);
      return c;
    };
    this.options.starters.forEach((s, i) => {
      const col = add(this.dynamic, new Container(), 5 + i * (COL_W + COL_GAP), 0);
      const sel = i === this.cursor.index;
      const g = new Graphics();
      if (sel) drawCursor(g, 0, 18, COL_W, STARTER_H - 36, this.focused);
      drawWell(g, Math.round((COL_W - ART) / 2), 22, ART, ART);
      col.addChild(g);
      const sprite = add(col, new Sprite(s.art), Math.round((COL_W - s.art.width) / 2), 0);
      sprite.y = 22 + ART - 2 - sprite.height;
      this.sprites.push(sprite);
      const name = add(col, uiText('name', s.name), 0, 22 + ART + 3);
      name.x = Math.round((COL_W - name.width) / 2);
      const badges = s.types.map((t) => new TypeBadge(t));
      const bw = badges.reduce((a, b) => a + Math.ceil(b.width) + 3, -3);
      let bx = Math.round((COL_W - bw) / 2);
      for (const b of badges) {
        add(col, b, bx, 22 + ART + 18);
        bx += Math.ceil(b.width) + 3;
      }
      const blurb = add(
        col,
        uiText('body', s.blurb, sel ? paper.ink : paper.inkDim, {
          wordWrap: true,
          wordWrapWidth: COL_W - 10,
          align: 'center',
        }),
        0,
        22 + ART + 32,
      );
      blurb.x = Math.round((COL_W - blurb.width) / 2);
      col.hitArea = new Rectangle(0, 18, COL_W, STARTER_H - 36);
      this.pointer.bind(col, 'col', i);
    });
    const lv = uiText('label', `Starts at Lv ${this.options.level}`, paper.inkDim);
    this.dynamic.addChild(lv);
    lv.position.set(Math.round(this.w - 8 - lv.width), STARTER_H - 12);
    const hints = [
      new KeyHint('A D', 'Choose'),
      new KeyHint('E', 'Pick'),
      new KeyHint('Q', 'Back'),
    ];
    for (const h of hints) this.dynamic.addChild(h);
    row(hints, 8, 7, STARTER_H - 12);
    this.update(0);
  }
}
