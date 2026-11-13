/**
 * Party screen (C22, `P`): the hotbar team on the left, the selected Zorling's details on the
 * right (types, stats, XP, trait, moves). The team order is the hotbar order (`1 2 3`) and
 * can be changed here.
 *
 * Keyboard: W/S choose, E pick up → W/S → E put down (swap places), Q back / cancel.
 * With `onSelect` (C22b), E asks the caller instead (an options menu: reorder, evolve…),
 * which calls `hold` to start reordering. A Zorling that can evolve gets a gold mark.
 * Mouse: hover/click rows; clicking the selected row picks it up or puts it down.
 */

import { Container, Graphics, Rectangle } from 'pixi.js';
import { GridCursor, type UiInput, type Widget } from '@engine/ui';
import { paper } from '../style/tokens';
import { KeyHint, TypeBadge, row } from './badges';
import { HpBar, XpBar } from './bars';
import { drawCursor, drawPaper, drawWell } from './skin';
import { uiText } from './text';
import { PointerQueue, portraitSlot, SLOT, type ZorlingView } from './zorling-view';

export interface PartyOptions {
  readonly team: readonly ZorlingView[];
  /** Swap two team members (hotbar order). Returns the new views. */
  readonly onSwap: (a: number, b: number) => readonly ZorlingView[];
  readonly onBack: (panel: PartyPanel) => void;
  /** E on a team member when nothing is held. Default: pick it up to reorder. */
  readonly onSelect?: (index: number, panel: PartyPanel) => void;
}

const W = 340;
const H = 190;
const LIST_W = 132;
const ROW_H = 46;
const TOP = 20;

export class PartyPanel implements Widget<Container> {
  static readonly WIDTH = W;
  static readonly HEIGHT = H;
  readonly view = new Container({ label: 'party' });
  private readonly dynamic = new Container();
  private readonly cursor: GridCursor;
  private team: readonly ZorlingView[];
  private held: number | undefined;
  private focused = false;
  private readonly pointer = new PointerQueue<'row'>(() => this.focused);

  constructor(private readonly options: PartyOptions) {
    this.team = options.team;
    const bg = drawPaper(new Graphics(), 0, 0, W, H);
    bg.rect(LIST_W + 8, TOP, 1, H - TOP - 18).fill({ color: paper.shade });
    const title = uiText('label', 'Party', paper.title);
    title.position.set(7, 6);
    const order = uiText('label', 'Hotbar order 1 2 3', paper.inkDim);
    order.position.set(Math.round(LIST_W + 2 - order.width), 6);
    this.view.addChild(bg, title, order, this.dynamic);
    this.cursor = new GridCursor(this.team.length, 1);
    this.view.eventMode = 'static';
    this.view.hitArea = new Rectangle(0, 0, W, H);
    this.build();
  }

  get state(): { index: number; held: number | undefined } {
    return { index: this.cursor.index, held: this.held };
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

  handleInput(input: UiInput): void {
    const p = this.pointer.take();
    if (p) {
      const was = this.cursor.index;
      if (this.cursor.set(p.index)) this.build();
      if (p.click && was === p.index) this.confirm();
      return;
    }
    const dir = input.direction();
    if ((dir === 'up' || dir === 'down') && this.cursor.move(dir)) this.build();
    if (input.confirmPressed()) this.confirm();
    else if (input.backPressed()) this.back();
  }

  private confirm(): void {
    const i = this.cursor.index;
    if (i < 0) return;
    if (this.held === undefined) {
      if (this.options.onSelect) {
        this.options.onSelect(i, this);
        return;
      }
      this.hold(i);
      return;
    } else {
      if (this.held !== i) this.team = this.options.onSwap(this.held, i);
      this.held = undefined;
    }
    this.build();
  }

  /** Picks up team member `index` to move it (reorder). */
  hold(index: number): void {
    if (this.team.length > 1 && this.team[index]) this.held = index;
    this.build();
  }

  /** New team views (after an evolution, a move change…). */
  setTeam(team: readonly ZorlingView[]): void {
    this.team = team;
    this.cursor.reset(team.length);
    this.build();
  }

  private back(): void {
    if (this.held !== undefined) {
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

    this.team.forEach((z, i) => {
      const r = new Container();
      const g = new Graphics();
      const sel = i === this.cursor.index;
      if (sel) drawCursor(g, 0, 0, LIST_W, ROW_H - 2, this.focused);
      r.addChild(g);
      const slot = portraitSlot(z.portrait, { frame: this.held === i, dim: z.hp <= 0 });
      slot.position.set(9, 5);
      r.addChild(slot);
      const key = new KeyHint(String(i + 1), '');
      key.position.set(9, 4);
      r.addChild(key);
      const name = uiText('name', z.name, z.hp <= 0 ? paper.inkDisabled : paper.ink);
      name.position.set(SLOT + 13, 3);
      const lv = uiText('label', `Lv ${z.level}`, paper.inkDim);
      lv.position.set(SLOT + 13, 17);
      const bar = new HpBar(LIST_W - SLOT - 20);
      bar.set(z.maxHp ? z.hp / z.maxHp : 0, false);
      bar.position.set(SLOT + 13, 27);
      const hp = uiText('label', z.hp <= 0 ? 'Fainted' : `${z.hp}/${z.maxHp}`, paper.inkDim);
      hp.position.set(Math.round(LIST_W - 6 - hp.width), 17);
      r.addChild(name, lv, bar, hp);
      if (z.evolveInto) {
        // Gold diamond after the name: ready to evolve.
        const mark = new Graphics();
        const mx = Math.round(name.x + name.width + 4);
        mark
          .rect(mx + 2, 7, 1, 1)
          .rect(mx + 1, 8, 3, 1)
          .rect(mx, 9, 5, 1);
        mark.rect(mx + 1, 10, 3, 1).rect(mx + 2, 11, 1, 1);
        mark.fill({ color: paper.cursor });
        mark.rect(mx + 2, 9, 1, 1).fill({ color: paper.accent });
        r.addChild(mark);
      }
      r.hitArea = new Rectangle(0, 0, LIST_W, ROW_H - 2);
      this.pointer.bind(r, 'row', i);
      add(r, 4, TOP + i * ROW_H);
    });

    const z = this.team[this.cursor.index];
    if (z) this.details(z, add);

    const hints =
      this.held === undefined
        ? [
            new KeyHint('E', this.options.onSelect ? 'Options' : 'Reorder'),
            new KeyHint('Q', 'Back'),
          ]
        : [new KeyHint('E', 'Put here'), new KeyHint('Q', 'Cancel')];
    for (const h of hints) this.dynamic.addChild(h);
    row(hints, 8, 7, H - 13);
    if (this.held !== undefined) {
      const name = this.team[this.held]?.name ?? '';
      add(uiText('label', `Moving ${name}`, paper.title), 120, H - 13);
    }
  }

  private details(z: ZorlingView, add: <T extends Container>(c: T, x?: number, y?: number) => T) {
    const dx = LIST_W + 16;
    const right = W - 8;
    add(uiText('name', z.name), dx, TOP - 2);
    if (z.name !== z.species || z.titan) {
      const sub = uiText('label', z.titan ? `${z.species} · Titan mark` : z.species, paper.inkDim);
      add(sub, Math.round(right - sub.width), TOP + 1);
    }
    let bx = dx;
    for (const t of z.types) {
      const b = add(new TypeBadge(t), bx, TOP + 13);
      bx += Math.ceil(b.width) + 3;
    }
    if (z.evolveInto) {
      const ready = uiText('label', `Can evolve into ${z.evolveInto}`, paper.title);
      add(ready, Math.round(right - ready.width), TOP + 15);
    }

    // Stats.
    const sy = TOP + 29;
    const g = add(new Graphics(), 0, 0);
    drawWell(g, dx, sy, right - dx, 22);
    const stats: [string, string][] = [
      ['HP', `${z.hp}/${z.maxHp}`],
      ['Atk', String(z.stats.attack)],
      ['Def', String(z.stats.defense)],
      ['Spd', String(z.stats.speed)],
    ];
    const colW = (right - dx) / stats.length;
    stats.forEach(([label, value], i) => {
      add(uiText('label', label, paper.inkDim), dx + 4 + i * colW, sy + 2);
      add(uiText('number', value), dx + 4 + i * colW, sy + 9);
    });

    // XP.
    const xy = sy + 27;
    add(uiText('label', `Lv ${z.level}`, paper.inkDim), dx, xy);
    const next = uiText('label', `${z.toNext} XP to next`, paper.inkDim);
    add(new XpBar(Math.round(right - dx - 34 - next.width), z.xp), dx + 28, xy + 2);
    add(next, Math.round(right - next.width), xy);

    // Trait.
    const ty = xy + 11;
    add(uiText('label', 'Trait', paper.inkDim), dx, ty);
    add(
      uiText('body', z.trait ? `${z.trait.name}: ${z.trait.description}` : '—', paper.ink, {
        wordWrap: true,
        wordWrapWidth: right - dx - 30,
        fontSize: 9,
        lineHeight: 10,
      }),
      dx + 30,
      ty - 2,
    );

    // Moves.
    const my = ty + 24;
    add(uiText('label', 'Moves', paper.inkDim), dx, my);
    z.moves.forEach((m, i) => {
      const y = my + 9 + i * 14;
      add(new TypeBadge(m.type, { label: false }), dx, y);
      add(uiText('body', m.name), dx + 15, y - 1);
      const stat = uiText(
        'label',
        `${m.power > 0 ? `Pow ${m.power}` : 'Status'} · Acc ${m.accuracy}`,
        paper.inkDim,
      );
      add(stat, Math.round(right - stat.width), y + 2);
    });
  }
}
