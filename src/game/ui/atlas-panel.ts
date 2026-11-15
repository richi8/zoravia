/**
 * The Atlas screen (C36b, layout A "Ledger" from the preview round): the region's map on the
 * left at 1 px per tile, tinted by tier, fogged where unexplored, with markers and place
 * names; three lists on the right (Zones, Bosses, Quests) and a detail box for the selection.
 *
 * Keys: `A/D` region, `W/S` select (the map follows and the selection blinks), `Tab` next list,
 * `F` a details card, `Q` closes (the card first). Everything comes in as an `AtlasRegion`
 * model, so nothing undiscovered can show: unknown entries read "???".
 */

import { Container, Graphics, Rectangle, Sprite, type Texture } from 'pixi.js';
import type { UiInput, Widget } from '@engine/ui';
import type { QuestLogEntry } from '@game/story';
import type {
  AtlasFight,
  AtlasMarkerKind,
  AtlasProgress,
  AtlasRegion,
  AtlasZone,
} from '@game/world/atlas';
import { TIER_TINTS } from '@game/world/map/minimap';
import { paper } from '../style/tokens';
import { KeyHint, row } from './badges';
import { mapLabel } from './map-panel';
import { drawCursor, drawPaper, drawWell } from './skin';
import { uiText } from './text';

/** Marker colors (as on the C36 World Atlas page). */
export const MARKER_COLORS: Readonly<Record<AtlasMarkerKind, number>> = {
  town: 0xffffff,
  trainer: 0x2f6fd0,
  rival: 0xd24c8a,
  trial: 0x2fa6a0,
  boss: 0xd23a3a,
  titan: 0xe08a1e,
  legendary: 0xe8b830,
  elder: 0x7a2fb0,
  keeper: 0x4a1a7a,
  gate: 0x222222,
};

const KIND_NAMES: Readonly<Record<AtlasMarkerKind, string>> = {
  town: 'Town',
  trainer: 'Trainer',
  rival: 'Rival',
  trial: 'Trial',
  boss: 'Region boss',
  titan: 'Titan',
  legendary: 'Legendary',
  elder: 'Elder Titan',
  keeper: 'Keeper',
  gate: 'Gate',
};

const TIER_LABEL = { t1: 'T1', t2: 'T2', t3: 'T3', danger: '!!' } as const;

const LISTS = ['Zones', 'Bosses', 'Quests'] as const;
type ListId = (typeof LISTS)[number];

export interface AtlasPanelOptions {
  readonly regions: readonly AtlasRegion[];
  /** Region shown first (the one the player is in). */
  readonly start: number;
  readonly progress: AtlasProgress;
  readonly quests: readonly QuestLogEntry[];
  /** The region's map: 1 px per tile, tier tint and fog. */
  readonly image: (region: number) => Texture;
  /** `inspect` (F) and `next_tab` (Tab) this step. */
  readonly pressed: (action: 'inspect' | 'next_tab') => boolean;
  readonly onBack: (panel: AtlasPanel) => void;
}

const W = 468;
const H = 258;
const MAP = { x: 8, y: 23, w: 202, h: 212 } as const;
const RIGHT = { x: 216, w: 246 } as const;
const LIST_Y = 36;
const LIST_H = 140;
const ROW_H = 12;
const ROWS = Math.floor((LIST_H - 4) / ROW_H);
const DETAIL_Y = LIST_Y + LIST_H + 4;
const DETAIL_H = 52;

export class AtlasPanel implements Widget<Container> {
  static readonly WIDTH = W;
  static readonly HEIGHT = H;
  readonly view = new Container({ label: 'atlas' });
  readonly width = W;
  readonly height = H;
  private readonly header = new Container();
  private readonly mapLayer = new Container();
  private readonly mapMask = new Graphics();
  private readonly right = new Container();
  private readonly card = new Container();
  private readonly blink = new Graphics();
  private region: number;
  private list: ListId = 'Zones';
  private index = 0;
  private time = 0;

  constructor(private readonly options: AtlasPanelOptions) {
    this.region = Math.max(0, Math.min(options.regions.length - 1, options.start));
    const bg = drawPaper(new Graphics(), 0, 0, W, H);
    drawWell(bg, MAP.x - 2, MAP.y - 2, MAP.w + 4, MAP.h + 4);
    this.mapMask.rect(MAP.x, MAP.y, MAP.w, MAP.h).fill({ color: 0xffffff });
    this.mapLayer.mask = this.mapMask;
    const hints = [
      new KeyHint('A/D', 'Region'),
      new KeyHint('W/S', 'Select'),
      new KeyHint('Tab', 'List'),
      new KeyHint('F', 'Details'),
      new KeyHint('Q', 'Close'),
    ];
    this.view.addChild(bg, this.header, this.mapLayer, this.mapMask, this.right, ...hints);
    row(hints, 10, 8, H - 14);
    this.view.addChild(this.card);
    this.view.eventMode = 'static';
    this.view.hitArea = new Rectangle(0, 0, W, H);
    this.rebuild();
  }

  /** The region shown (tests, debugging). */
  get current(): AtlasRegion | undefined {
    return this.options.regions[this.region];
  }

  get listShown(): ListId {
    return this.list;
  }

  get selected(): number {
    return this.index;
  }

  get cardOpen(): boolean {
    return this.card.children.length > 0;
  }

  contains(x: number, y: number): boolean {
    const p = this.view.toLocal({ x, y });
    return p.x >= 0 && p.y >= 0 && p.x <= W && p.y <= H;
  }

  dismiss(): void {
    this.options.onBack(this);
  }

  update(dt: number): void {
    this.time += dt;
    this.blink.visible = this.time % 0.8 < 0.55;
  }

  handleInput(input: UiInput): void {
    if (this.cardOpen) {
      if (input.backPressed() || input.confirmPressed() || this.options.pressed('inspect'))
        this.closeCard();
      return;
    }
    if (input.backPressed()) {
      this.options.onBack(this);
      return;
    }
    if (this.options.pressed('inspect')) {
      this.openCard();
      return;
    }
    if (this.options.pressed('next_tab')) {
      this.list = LISTS[(LISTS.indexOf(this.list) + 1) % LISTS.length] ?? 'Zones';
      this.index = 0;
      this.rebuild();
      return;
    }
    const d = input.direction();
    const n = this.rows();
    if (d === 'left' || d === 'right') {
      const count = this.options.regions.length;
      if (count < 2) return;
      this.region = (this.region + (d === 'right' ? 1 : count - 1)) % count;
      this.index = 0;
      this.rebuild();
    } else if ((d === 'up' || d === 'down') && n > 0) {
      this.index = (this.index + (d === 'down' ? 1 : n - 1)) % n;
      this.rebuild();
    }
  }

  // ------------------------------------------------------------ content

  private rows(): number {
    const r = this.current;
    if (!r) return 0;
    if (this.list === 'Zones') return r.zones.length;
    if (this.list === 'Bosses') return r.fights.length;
    return this.options.quests.length;
  }

  private rebuild(): void {
    this.buildHeader();
    this.buildMap();
    this.buildRight();
  }

  private buildHeader(): void {
    for (const c of this.header.removeChildren()) c.destroy({ children: true });
    const g = new Graphics();
    this.header.addChild(g);
    const title = uiText('name', 'Atlas', paper.title);
    title.position.set(8, 5);
    this.header.addChild(title);
    let x = Math.ceil(title.width) + 18;
    this.options.regions.forEach((r, i) => {
      const t = uiText('name', r.name, i === this.region ? paper.ink : paper.inkDim);
      const w = Math.ceil(t.width) + 10;
      if (i === this.region) g.rect(x, 5, w, 14).fill({ color: paper.cursor });
      t.position.set(x + 5, 5);
      this.header.addChild(t);
      x += w + 2;
    });
    const p = this.options.progress;
    const stats = uiText(
      'label',
      `Badges ${p.badges[0]}/${p.badges[1]} · Hearts ${p.hearts[0]}/${p.hearts[1]} · Dex ${p.dex[0]}/${p.dex[1]}`,
      paper.inkDim,
    );
    stats.position.set(Math.round(W - 8 - stats.width), 9);
    this.header.addChild(stats);
  }

  /** Where the map centers: the selection when it is known, else the region's middle. */
  private mapFocus(): { x: number; y: number; mark?: 'zone' | 'spot' } {
    const r = this.current;
    if (!r) return { x: 0, y: 0 };
    const mid = { x: r.width / 2, y: r.height / 2 };
    if (this.list === 'Zones') {
      const z = r.zones[this.index];
      return z?.known ? { x: z.x, y: z.y, mark: 'zone' } : mid;
    }
    if (this.list === 'Bosses') {
      const f = r.fights[this.index];
      return f?.known ? { x: f.x, y: f.y, mark: 'spot' } : mid;
    }
    return mid;
  }

  private buildMap(): void {
    // The blink outlives the map it sits on.
    this.blink.removeFromParent();
    for (const c of this.mapLayer.removeChildren()) c.destroy({ children: true });
    const r = this.current;
    if (!r) return;
    const image = this.options.image(this.region);
    const f = this.mapFocus();
    const clamp = (v: number, size: number, view: number): number =>
      size <= view
        ? -Math.floor((view - size) / 2)
        : Math.max(0, Math.min(size - view, Math.round(v - view / 2)));
    const ox = clamp(f.x, image.width, MAP.w);
    const oy = clamp(f.y, image.height, MAP.h);
    const inner = new Container();
    inner.position.set(MAP.x - ox, MAP.y - oy);
    // Parchment around a map smaller than the box.
    const back = new Graphics().rect(ox, oy, MAP.w, MAP.h).fill({ color: 0xefe0c0 });
    inner.addChild(back, new Sprite(image));
    const marks = new Graphics();
    for (const m of r.markers) {
      const s = m.kind === 'town' ? 4 : m.kind === 'trainer' ? 2 : 3;
      const x = m.x - Math.floor(s / 2);
      const y = m.y - Math.floor(s / 2);
      marks.rect(x - 1, y - 1, s + 2, s + 2).fill({ color: paper.edge });
      marks.rect(x, y, s, s).fill({ color: MARKER_COLORS[m.kind], alpha: m.beaten ? 0.6 : 1 });
    }
    inner.addChild(marks);
    for (const p of r.places)
      if (p.kind !== 'zone' && p.kind !== 'lair')
        inner.addChild(mapLabel(p.name, p.x + 0.5, p.y + 3));
    this.blink.clear();
    if (f.mark === 'zone') {
      this.blink.rect(f.x - 12, f.y - 9, 24, 18).stroke({ color: paper.accent, width: 1 });
    } else if (f.mark === 'spot') {
      this.blink.rect(f.x - 4, f.y - 4, 9, 9).stroke({ color: paper.accent, width: 1 });
    }
    inner.addChild(this.blink);
    this.mapLayer.addChild(inner);
    if (!r.places.length) {
      const t = uiText('body', 'Not explored yet', paper.inkDim);
      t.position.set(
        Math.round(MAP.x + (MAP.w - t.width) / 2),
        Math.round(MAP.y + (MAP.h - t.height) / 2),
      );
      this.mapLayer.addChild(t);
    }
  }

  private buildRight(): void {
    for (const c of this.right.removeChildren()) c.destroy({ children: true });
    const r = this.current;
    if (!r) return;
    const g = new Graphics();
    this.right.addChild(g);
    // Tabs.
    let x = RIGHT.x;
    for (const id of LISTS) {
      const on = id === this.list;
      const t = uiText('label', id, on ? paper.title : paper.inkDim);
      const w = Math.ceil(t.width) + 10;
      g.rect(x, 22, w, 11).fill({ color: on ? paper.base : paper.well });
      if (on) g.rect(x, 32, w, 1).fill({ color: paper.accent });
      t.position.set(x + 5, 24);
      this.right.addChild(t);
      x += w + 2;
    }
    const count =
      this.list === 'Zones'
        ? `${r.zones.filter((z) => z.known).length} of ${r.zones.length} found`
        : this.list === 'Bosses'
          ? `${r.fights.filter((f) => f.result).length} of ${r.fights.length} done`
          : `${this.options.quests.filter((q) => q.done).length} of ${this.options.quests.length} done`;
    const c = uiText('label', count, paper.inkDim);
    c.position.set(Math.round(RIGHT.x + RIGHT.w - c.width), 24);
    this.right.addChild(c);

    drawWell(g, RIGHT.x, LIST_Y, RIGHT.w, LIST_H);
    const n = this.rows();
    const first = Math.max(0, Math.min(n - ROWS, this.index - Math.floor(ROWS / 2)));
    for (let i = first; i < Math.min(n, first + ROWS); i++) {
      const y = LIST_Y + 2 + (i - first) * ROW_H;
      if (i === this.index) drawCursor(g, RIGHT.x + 2, y, RIGHT.w - 4, ROW_H - 1, true);
      this.buildRow(g, i, RIGHT.x + 10, y);
    }
    if (!n) {
      const t = uiText(
        'body',
        this.list === 'Quests' ? 'No quests yet.' : 'Nothing here.',
        paper.inkDim,
      );
      t.position.set(RIGHT.x + 8, LIST_Y + 4);
      this.right.addChild(t);
    }
    if (first > 0)
      this.right.addChild(
        at(uiText('label', '▲', paper.inkDim), RIGHT.x + RIGHT.w - 9, LIST_Y + 1),
      );
    if (first + ROWS < n)
      this.right.addChild(
        at(uiText('label', '▼', paper.inkDim), RIGHT.x + RIGHT.w - 9, LIST_Y + LIST_H - 9),
      );

    drawWell(g, RIGHT.x, DETAIL_Y, RIGHT.w, DETAIL_H);
    this.buildDetail(g, RIGHT.x + 5, DETAIL_Y + 2);
  }

  private text(
    role: 'body' | 'label' | 'name',
    s: string,
    color: number,
    x: number,
    y: number,
    right = false,
  ): number {
    const t = uiText(role, s, color);
    t.position.set(Math.round(right ? x - t.width : x), Math.round(y));
    this.right.addChild(t);
    return t.width;
  }

  private buildRow(g: Graphics, i: number, x: number, y: number): void {
    const r = this.current;
    if (!r) return;
    const end = RIGHT.x + RIGHT.w - 6;
    if (this.list === 'Zones') {
      const z = r.zones[i];
      if (!z) return;
      chip(g, z.known ? TIER_TINTS[z.tier] : paper.inkDisabled, x, y + 2);
      if (z.known) this.text('label', TIER_LABEL[z.tier], 0xffffff, x + 2, y + 2);
      if (!z.known) {
        this.text('body', '???', paper.inkDisabled, x + 17, y - 1);
        this.text('body', 'Lv ?', paper.inkDisabled, end - 62, y - 1, true);
        return;
      }
      this.text('body', z.name, paper.ink, x + 17, y - 1);
      this.text('body', `Lv ${z.levels[0]}–${z.levels[1]}`, paper.inkDim, end - 62, y - 1, true);
      const seen = z.spawns.filter((s) => s.seen).length;
      const caught = z.spawns.filter((s) => s.caught).length;
      this.text('body', `${seen}/${z.spawns.length}`, paper.inkDim, end - 30, y - 1, true);
      this.text('body', `★${caught}`, paper.inkDim, end - 8, y - 1, true);
      if (z.weather.length) g.rect(end - 4, y + 3, 4, 4).fill({ color: paper.accent });
    } else if (this.list === 'Bosses') {
      const f = r.fights[i];
      if (!f) return;
      g.rect(x - 1, y + 2, 7, 7).fill({ color: paper.edge });
      g.rect(x, y + 3, 5, 5).fill({ color: f.known ? MARKER_COLORS[f.kind] : paper.inkDisabled });
      this.text(
        'body',
        f.known ? f.name : '???',
        f.known ? paper.ink : paper.inkDisabled,
        x + 10,
        y - 1,
      );
      // What an unknown fight is stays hidden too.
      if (f.known) this.text('label', KIND_NAMES[f.kind], paper.inkDim, x + 128, y + 2);
      this.text(
        'body',
        f.known ? `Lv ${f.level}` : 'Lv ?',
        f.known ? paper.inkDim : paper.inkDisabled,
        end - 22,
        y - 1,
        true,
      );
      if (f.result)
        this.text('body', f.result === 'caught' ? '★' : '✓', paper.title, end, y - 1, true);
    } else {
      const q = this.options.quests[i];
      if (!q) return;
      this.text('body', q.done ? '✓' : '•', q.done ? paper.title : paper.inkDim, x, y - 1);
      this.text('body', q.name, q.done ? paper.inkDim : paper.ink, x + 10, y - 1);
      const steps = q.steps.filter((s) => s.done).length;
      if (!q.done) this.text('body', `step ${steps + 1}`, paper.inkDim, end, y - 1, true);
    }
  }

  /** Two or three lines about the selection, under the list. */
  private buildDetail(_g: Graphics, x: number, y: number): void {
    const lines = this.detailLines(false);
    const wrap = { wordWrap: true, wordWrapWidth: RIGHT.w - 10 };
    let yy = y;
    for (const [i, line] of lines.entries()) {
      const t = uiText(
        i === 0 ? 'name' : 'body',
        line,
        i === 0 ? paper.ink : paper.inkDim,
        i === 0 ? {} : wrap,
      );
      t.position.set(x, Math.round(yy));
      if (yy + t.height > DETAIL_Y + DETAIL_H + 1) {
        t.destroy();
        break;
      }
      this.right.addChild(t);
      yy += t.height;
    }
  }

  /** The selection in words; `full` for the F card. First line is the title. */
  private detailLines(full: boolean): string[] {
    const r = this.current;
    if (!r) return [];
    if (this.list === 'Zones') {
      const z = r.zones[this.index];
      return z ? zoneLines(z, full) : [];
    }
    if (this.list === 'Bosses') {
      const f = r.fights[this.index];
      return f ? fightLines(f, full) : [];
    }
    const q = this.options.quests[this.index];
    if (!q) return [];
    const now = q.steps.find((s) => !s.done);
    if (!full) return [q.name, q.done ? 'Done.' : (now?.text ?? q.summary)];
    return [
      q.name,
      q.summary,
      ...q.steps.map((s) => `${s.done ? '✓' : '•'} ${s.text}`),
      ...(q.reward ? [`Reward: ${q.reward}`] : []),
      ...(q.from ? [`From ${q.from}`] : []),
    ];
  }

  private openCard(): void {
    const lines = this.detailLines(true);
    if (!lines.length) return;
    const w = 220;
    const items: Container[] = [];
    let y = 6;
    for (const [i, line] of lines.entries()) {
      const t = uiText(i === 0 ? 'name' : 'body', line, i === 0 ? paper.title : paper.ink, {
        wordWrap: true,
        wordWrapWidth: w - 16,
      });
      t.position.set(8, y);
      y += t.height + (i === 0 ? 2 : 0);
      items.push(t);
    }
    const hint = new KeyHint('F', 'Close');
    hint.position.set(8, y + 4);
    const h = Math.min(H - 8, Math.ceil(y + 18));
    const bg = drawPaper(new Graphics(), 0, 0, w, h);
    const box = new Container();
    box.addChild(bg, ...items, hint);
    box.position.set(RIGHT.x + Math.round((RIGHT.w - w) / 2), Math.max(4, Math.round((H - h) / 2)));
    this.card.addChild(box);
  }

  private closeCard(): void {
    for (const c of this.card.removeChildren()) c.destroy({ children: true });
  }
}

function at<T extends Container>(c: T, x: number, y: number): T {
  c.position.set(Math.round(x), Math.round(y));
  return c;
}

function chip(g: Graphics, color: number, x: number, y: number): void {
  g.rect(x, y, 14, 8).fill({ color });
}

function zoneLines(z: AtlasZone, full: boolean): string[] {
  if (!z.known) return ['???', 'Not discovered yet. Walk in to chart it.'];
  const tier = z.tier === 'danger' ? 'danger zone' : `tier ${z.tier.slice(1)}`;
  const head = `${z.name} · Lv ${z.levels[0]}–${z.levels[1]}`;
  const wild = z.spawns.map((s) => (s.seen ? `${s.name ?? '?'}${s.caught ? ' ★' : ''}` : '?'));
  const storm = z.weather.length ? `Storm: ${z.weather.join(', ')} on both sides.` : '';
  if (!full) return [head, `Wild: ${wild.join(', ')}`, ...(storm ? [storm] : [])];
  const unseen = z.spawns.filter((s) => !s.seen).length;
  return [
    head,
    `A ${tier} zone with ${z.spawns.length} kinds of wild Zorlings.`,
    ...z.spawns
      .filter((s) => s.seen)
      .map((s) => `${s.name ?? '?'}: ${s.caught ? 'caught ★' : 'seen'}`),
    ...(unseen ? [`${unseen === z.spawns.length ? 'None' : `${unseen} more`} not seen yet.`] : []),
    ...(storm ? [storm] : []),
  ];
}

function fightLines(f: AtlasFight, full: boolean): string[] {
  if (!f.known) return ['???', 'Somewhere you have not explored yet.'];
  const kind = KIND_NAMES[f.kind];
  const status = f.result === 'caught' ? 'caught' : f.result ? 'beaten' : 'not beaten yet';
  const armored =
    f.kind === 'titan' || f.kind === 'legendary' || f.kind === 'elder' || f.kind === 'boss';
  const weak = f.weakSpot
    ? `Weak spot: ${f.weakSpot.join(', ')}.`
    : armored
      ? 'Weak spot: ? (logged once beaten)'
      : '';
  const lines = [`${f.name}`, `${kind} · Lv ${f.level} · ${status}`, ...(weak ? [weak] : [])];
  if (full && f.where) lines.push(`Found in ${f.where}.`);
  return lines;
}
