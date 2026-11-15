/**
 * The map window (C36c, layout A "Ledger" from the preview round): one window for the map,
 * the Atlas and the quest log. It replaces the `M` map, the C36b Atlas and the `J` quest log.
 *
 * - **Left:** one world map. Every region is drawn at its world place (`world/world-layout.ts`),
 *   tinted by tier and fogged where unexplored, with markers and place names; parchment fills
 *   the space between regions, and the sea the gap a ferry crosses. It pans around the player
 *   at 1 px per tile. `Z` zooms out to ½ px per tile (region names instead of place names,
 *   no trainer dots); the map still follows the selection.
 * - **Right:** expandable groups, Zones, Bosses and Quests, each with a count. Zones and
 *   Bosses are sorted by region under small region subheadings; quests are split into active
 *   and done and keep the "New" tag. One group is open at a time. A summary of the selection
 *   sits under the groups.
 *
 * Keys: `W/S` move through headers and rows (the map pans to the selection, which blinks),
 * `E` opens or closes a group (on a row: the details card), `F` the details card, `Z` zoom,
 * `Q` closes (the card first).
 *
 * Mouse: click a header to open or close it, a row to select it (and again for the card), the
 * map to pick the nearest known zone or fight, a scroll arrow or a key hint. Drag the map to pan
 * it (it follows the selection again once the selection moves). The wheel scrolls the list, or
 * over the map zooms. Any click closes the card; right click is Back, as everywhere.
 *
 * Everything comes in as `AtlasRegion` models, so nothing undiscovered can show: unknown
 * entries read "???", and a region not explored yet shows no rows.
 */

import { Container, Graphics, Rectangle, Sprite, Texture, TilingSprite } from 'pixi.js';
import type { UiInput, Widget } from '@engine/ui';
import type { QuestLogEntry } from '@game/story';
import type {
  AtlasFight,
  AtlasMarkerKind,
  AtlasProgress,
  AtlasRegion,
  ZoneRun,
  AtlasZone,
} from '@game/world/atlas';
import { placeLabels } from './label-layout';
import { FOG_HATCH_EVERY, FOG_HATCH_RGB, FOG_RGB, TIER_TINTS } from '@game/world/map/minimap';
import { paper } from '../style/tokens';
import { KeyHint, row } from './badges';
import { keyHint, upDownHint } from '@game/input/key-hint';
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

/** The player's marker: bright gold, stands out on green and blue. */
const YOU = 0xffd23f;
const SEA = 0x9cc4cf;
const SEA_WAVE = 0x86b2c0;
const TIER_LABEL = { t1: 'T1', t2: 'T2', t3: 'T3', danger: '!!' } as const;

/**
 * The tier chip in a zone row: its fill (the tier's map tint) and label ink, at least 4.5:1
 * (C38 accessibility pass). The T3 chip is a touch lighter than its map tint so dark ink reads.
 */
export const TIER_CHIPS: Readonly<Record<keyof typeof TIER_LABEL, { fill: number; ink: number }>> =
  {
    t1: { fill: TIER_TINTS.t1, ink: paper.ink },
    t2: { fill: TIER_TINTS.t2, ink: paper.ink },
    t3: { fill: 0xde7848, ink: paper.ink },
    danger: { fill: TIER_TINTS.danger, ink: 0xffffff },
  };

let hatch: Texture | undefined;

/**
 * Blank parchment with the fog's hatching, one tile per pixel (shared, never freed): the
 * ground between regions matches their unexplored land, so no region edge shows.
 */
function hatchTexture(): Texture {
  if (hatch) return hatch;
  const n = FOG_HATCH_EVERY;
  const canvas = document.createElement('canvas');
  canvas.width = n;
  canvas.height = n;
  const ctx = canvas.getContext('2d');
  const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
  if (ctx) {
    ctx.fillStyle = hex(FOG_RGB);
    ctx.fillRect(0, 0, n, n);
    ctx.fillStyle = hex(FOG_HATCH_RGB);
    for (let y = 0; y < n; y++) ctx.fillRect((n - y) % n, y, 1, 1);
  }
  hatch = Texture.from(canvas);
  hatch.source.scaleMode = 'nearest';
  return hatch;
}

/**
 * Where a place name may sit (px from under its place, C36d): under it, above its marker,
 * or one row further down.
 */
const LABEL_OFFSETS = [0, -14, 9] as const;

/** A place name drawn on a map: small caps on a paper strip, centered under (x, y). */
export function mapLabel(text: string, x: number, y: number): Container {
  const c = new Container();
  const t = uiText('label', text, paper.ink);
  const w = Math.ceil(t.width) + 4;
  const bg = new Graphics().rect(0, 0, w, 8).fill({ color: paper.base, alpha: 0.88 });
  t.position.set(2, 0);
  c.addChild(bg, t);
  c.position.set(Math.round(x - w / 2), Math.round(y));
  return c;
}

export const GROUPS = ['Zones', 'Bosses', 'Quests'] as const;
export type GroupId = (typeof GROUPS)[number];

/** A region on the world map: its Atlas model and its world place (tiles). */
export interface MapWindowRegion {
  readonly atlas: AtlasRegion;
  readonly x: number;
  readonly y: number;
}

/** A quest log entry; `fresh` started or moved on since the log was last looked at. */
export type MapWindowQuest = QuestLogEntry & { readonly fresh?: boolean };

/** A small marker in world tiles (a center or shop near the player). */
export interface MapWindowMarker {
  readonly x: number;
  readonly y: number;
  readonly color: number;
}

/** A known link drawn on the map: a ferry route (with its sea) or a pass, in world tiles. */
export interface MapWindowLink {
  readonly kind: string;
  readonly a: { readonly x: number; readonly y: number };
  readonly b: { readonly x: number; readonly y: number };
  /** The boat's route between the ends (C37), drawn instead of a straight line. */
  readonly route?: readonly { readonly x: number; readonly y: number }[];
  readonly sea?: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

export interface MapWindowOptions {
  readonly regions: readonly MapWindowRegion[];
  /** World bounds in tiles. */
  readonly bounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  /** The region's map: 1 px per tile, tier tint and fog. */
  readonly image: (region: number) => Texture;
  /** The player, in world tiles, and where they are ("Fernwood · Lv 16–22"). */
  readonly player: { readonly x: number; readonly y: number };
  readonly place: string;
  readonly markers?: readonly MapWindowMarker[];
  readonly links?: readonly MapWindowLink[];
  readonly progress: AtlasProgress;
  readonly quests: readonly MapWindowQuest[];
  /** The group open at first (`J` opens Quests); none when undefined. */
  readonly open?: GroupId;
  /** `inspect` (F) and `zoom` (Z) this step. */
  readonly pressed: (action: 'inspect' | 'zoom') => boolean;
  /** The Quests group was opened (its "New" tags count as read). */
  readonly onQuestsShown?: () => void;
  readonly onBack: (panel: MapWindow) => void;
}

/** A clickable area in panel coordinates. */
interface Hit {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly act: () => void;
}

/** A line of the right side: a selectable header or row, or a subheading / note. */
type Line =
  | { readonly kind: 'header'; readonly group: GroupId }
  | { readonly kind: 'zone'; readonly region: number; readonly index: number }
  | { readonly kind: 'fight'; readonly region: number; readonly index: number }
  | { readonly kind: 'quest'; readonly index: number }
  | { readonly kind: 'sub'; readonly text: string }
  | { readonly kind: 'note'; readonly text: string };

type Selectable = Exclude<Line, { kind: 'sub' } | { kind: 'note' }>;

const isSelectable = (l: Line): l is Selectable => l.kind !== 'sub' && l.kind !== 'note';

const lineKey = (l: Selectable): string =>
  l.kind === 'header'
    ? `h:${l.group}`
    : l.kind === 'quest'
      ? `q:${l.index}`
      : `${l.kind}:${l.region}:${l.index}`;

/** How far (tiles) from an entry a click on the map still picks it. */
const PICK_SPOT = 10;
const PICK_ZONE = 24;

const W = 468;
const H = 258;
const MAP = { x: 8, y: 22, w: 282, h: 214 } as const;
const RIGHT = { x: 296, w: 166 } as const;
const LIST_Y = 22;
const LIST_H = 158;
const ROW_H = 12;
const ROWS = Math.floor((LIST_H - 4) / ROW_H);
const DETAIL_Y = LIST_Y + LIST_H + 4;
const DETAIL_H = MAP.y + MAP.h - DETAIL_Y;
/** Wheel pixels per list line, and per zoom step on the map. */
const WHEEL_LINE = 30;
const WHEEL_ZOOM = 90;
/** Pointer travel (px) that turns a press on the map into a drag. */
const DRAG_START = 3;
/** Map zoom levels (px per tile). */
const NEAR = 1;
const FAR = 0.5;

export class MapWindow implements Widget<Container> {
  static readonly WIDTH = W;
  static readonly HEIGHT = H;
  readonly view = new Container({ label: 'map-window' });
  readonly width = W;
  readonly height = H;
  private readonly header = new Container();
  private readonly mapLayer = new Container();
  private readonly mapMask = new Graphics();
  private readonly right = new Container();
  private readonly card = new Container();
  private readonly hintRow = new Container();
  private readonly blink = new Graphics();
  private readonly you = new Graphics();
  private group: GroupId | undefined;
  private selKey: string;
  private scale = NEAR;
  private time = 0;
  private questsShown = false;
  /** Clickable areas, rebuilt with the part they belong to. */
  private readonly hits: Record<'right' | 'hints', Hit[]> = { right: [], hints: [] };
  /** World tile at the map box's top-left corner (map clicks → tiles). */
  private origin = { x: 0, y: 0 };
  /** World tile the map is centered on after a drag; cleared when the selection moves. */
  private pan: { x: number; y: number } | undefined;
  /** A press on the map: a drag once it moves, else a click (picks on release). */
  private drag:
    | {
        readonly x: number;
        readonly y: number;
        readonly center: { x: number; y: number };
        moved: boolean;
      }
    | undefined;
  /** First line of the list shown (wheel and arrows scroll it; keys keep the selection in view). */
  private scroll = 0;
  private followSelection = true;
  /** Wheel pixels not yet turned into a list line or a zoom step. */
  private wheelLeft = 0;

  constructor(private readonly options: MapWindowOptions) {
    const bg = drawPaper(new Graphics(), 0, 0, W, H);
    drawWell(bg, MAP.x - 2, MAP.y - 2, MAP.w + 4, MAP.h + 4);
    this.mapMask.rect(MAP.x, MAP.y, MAP.w, MAP.h).fill({ color: 0xffffff });
    this.mapLayer.mask = this.mapMask;
    this.you.rect(-3, -3, 7, 7).fill({ color: paper.edge });
    this.you.rect(-2, -2, 5, 5).fill({ color: YOU });
    this.view.addChild(bg, this.header, this.mapLayer, this.mapMask, this.right, this.hintRow);
    this.view.addChild(this.card);
    this.view.eventMode = 'static';
    this.view.hitArea = new Rectangle(0, 0, W, H);
    this.group = options.open;
    this.selKey = `h:${options.open ?? 'Zones'}`;
    if (options.open === 'Quests') {
      // `J`: the first quest (the newest active one) is selected.
      const first = this.lines().find((l) => l.kind === 'quest');
      if (first && isSelectable(first)) this.selKey = lineKey(first);
      this.markQuestsShown();
    }
    this.buildHeader();
    this.rebuild();
  }

  // ------------------------------------------------------------ state (tests, debugging)

  get openGroup(): GroupId | undefined {
    return this.group;
  }

  /** The selected line's key: `h:Zones`, `zone:0:3`, `fight:1:0`, `quest:2`. */
  get selected(): string {
    return this.selKey;
  }

  get zoom(): number {
    return this.scale;
  }

  get cardOpen(): boolean {
    return this.card.children.length > 0;
  }

  /** World tile at the map's center. */
  get center(): { x: number; y: number } {
    return {
      x: this.origin.x + MAP.w / 2 / this.scale,
      y: this.origin.y + MAP.h / 2 / this.scale,
    };
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
    const on = this.time % 0.8 < 0.55;
    this.blink.visible = on;
    this.you.visible = on;
  }

  handleInput(input: UiInput): void {
    if (this.drag) {
      const held = input.pointerHeld?.();
      if (held) this.dragTo(this.view.toLocal(held));
      else this.endDrag();
      return;
    }
    const p = input.pointerPressed();
    if (p) {
      this.click(this.view.toLocal(p), !!input.pointerHeld);
      return;
    }
    const wheel = input.wheel?.() ?? 0;
    const at = input.pointer?.();
    if (wheel && at) this.wheel(wheel, this.view.toLocal(at));
    if (this.cardOpen) {
      if (input.backPressed() || input.confirmPressed() || this.options.pressed('inspect'))
        this.closeCard();
      return;
    }
    if (input.backPressed()) {
      this.options.onBack(this);
      return;
    }
    if (this.options.pressed('zoom')) {
      this.toggleZoom();
      return;
    }
    if (this.options.pressed('inspect')) {
      this.openCard();
      return;
    }
    if (input.confirmPressed()) {
      this.activate();
      return;
    }
    const d = input.direction();
    if (d === 'up' || d === 'down') this.move(d === 'down' ? 1 : -1);
  }

  // ------------------------------------------------------------ actions (keys and mouse)

  /** `E`: a header opens or closes its group; a row opens its card. */
  private activate(): void {
    const sel = this.selection();
    if (sel?.kind === 'header') this.toggle(sel.group);
    else this.openCard();
  }

  /** Opens a group (closing the one open) or closes it; the header stays selected. */
  toggle(group: GroupId): void {
    this.group = this.group === group ? undefined : group;
    this.selKey = `h:${group}`;
    this.pan = undefined;
    this.followSelection = true;
    if (this.group === 'Quests') this.markQuestsShown();
    this.rebuild();
  }

  /** Zooms in or out around the map's center (a panned map stays where it is). */
  toggleZoom(): void {
    if (this.pan) this.pan = this.center;
    this.scale = this.scale === NEAR ? FAR : NEAR;
    this.buildMap();
    this.buildHints();
  }

  /** The wheel: over the list it scrolls the list, over the map it zooms. */
  private wheel(dy: number, p: { x: number; y: number }): void {
    const overList =
      p.x >= RIGHT.x && p.x < RIGHT.x + RIGHT.w && p.y >= LIST_Y && p.y < LIST_Y + LIST_H;
    const overMap = p.x >= MAP.x && p.x < MAP.x + MAP.w && p.y >= MAP.y && p.y < MAP.y + MAP.h;
    if (!overList && !overMap) return;
    // A trackpad sends many small steps; a wheel notch is about 100 px.
    this.wheelLeft += dy;
    const step = overList ? WHEEL_LINE : WHEEL_ZOOM;
    const n = Math.trunc(this.wheelLeft / step);
    if (!n) return;
    this.wheelLeft -= n * step;
    if (overList) this.scrollBy(n);
    else if (n > 0 === (this.scale === NEAR)) {
      this.wheelLeft = 0;
      this.toggleZoom();
    }
  }

  /** Scrolls the list by `lines` without moving the selection. */
  scrollBy(lines: number): void {
    this.scroll += lines;
    this.followSelection = false;
    this.buildRight();
  }

  private dragTo(p: { x: number; y: number }): void {
    const d = this.drag;
    if (!d) return;
    const dx = p.x - d.x;
    const dy = p.y - d.y;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < DRAG_START) return;
    d.moved = true;
    const s = this.scale;
    const before = this.origin;
    const next = this.originFor({ x: d.center.x - dx / s, y: d.center.y - dy / s });
    const ox = Math.round((before.x - next.x) * s);
    const oy = Math.round((before.y - next.y) * s);
    // Moving the built map is cheap; build it again only when its edge would show.
    if (Math.abs(ox) > MAP.w * 0.8 || Math.abs(oy) > MAP.h * 0.8) {
      this.pan = this.centerOf(next);
      this.buildMap();
      this.mapLayer.position.set(0, 0);
    } else this.mapLayer.position.set(ox, oy);
  }

  private endDrag(): void {
    const d = this.drag;
    this.drag = undefined;
    if (!d) return;
    if (!d.moved) {
      this.pickOnMap(
        this.origin.x + (d.x - MAP.x) / this.scale,
        this.origin.y + (d.y - MAP.y) / this.scale,
      );
      return;
    }
    const s = this.scale;
    const shift = this.mapLayer.position;
    this.pan = this.centerOf({ x: this.origin.x - shift.x / s, y: this.origin.y - shift.y / s });
    this.mapLayer.position.set(0, 0);
    this.buildMap();
  }

  /** Moves the selection through headers and rows, wrapping around. */
  move(step: number): void {
    const sel = this.lines().filter(isSelectable);
    if (!sel.length) return;
    const i = sel.findIndex((l) => lineKey(l) === this.selKey);
    const next = sel[(((i + step) % sel.length) + sel.length) % sel.length];
    if (!next) return;
    this.selKey = lineKey(next);
    this.pan = undefined;
    this.followSelection = true;
    this.rebuild();
  }

  private selectLine(l: Selectable): void {
    this.selKey = lineKey(l);
    this.pan = undefined;
    this.followSelection = true;
    this.rebuild();
  }

  private markQuestsShown(): void {
    if (this.questsShown) return;
    this.questsShown = true;
    this.options.onQuestsShown?.();
  }

  /** A left click at a point in panel coordinates. */
  private click(p: { x: number; y: number }, canDrag = false): void {
    if (this.cardOpen) {
      this.closeCard();
      return;
    }
    const inside = (h: Hit): boolean =>
      p.x >= h.x && p.y >= h.y && p.x < h.x + h.w && p.y < h.y + h.h;
    const hit = [...this.hits.right, ...this.hits.hints].find(inside);
    if (hit) {
      hit.act();
      return;
    }
    const onMap = p.x >= MAP.x && p.y >= MAP.y && p.x < MAP.x + MAP.w && p.y < MAP.y + MAP.h;
    // A press on the map picks on release, unless it turns into a drag.
    if (onMap && canDrag) this.drag = { x: p.x, y: p.y, center: this.center, moved: false };
    else if (onMap)
      this.pickOnMap(
        this.origin.x + (p.x - MAP.x) / this.scale,
        this.origin.y + (p.y - MAP.y) / this.scale,
      );
  }

  /** Selects the known zone or fight nearest to a world tile, if one is close. */
  pickOnMap(wx: number, wy: number): void {
    let best: Selectable | undefined;
    let bestD = Infinity;
    const consider = (l: Selectable, x: number, y: number, reach: number): void => {
      const d = Math.hypot(x - wx, y - wy);
      if (d <= reach && d < bestD) {
        best = l;
        bestD = d;
      }
    };
    // Fights first: a spot is smaller than a zone, so it wins when both are in reach.
    const zonesToo = this.group !== 'Bosses';
    this.options.regions.forEach((r, region) => {
      r.atlas.fights.forEach((f, index) => {
        if (f.known) consider({ kind: 'fight', region, index }, r.x + f.x, r.y + f.y, PICK_SPOT);
      });
    });
    if (zonesToo && !best)
      this.options.regions.forEach((r, region) => {
        r.atlas.zones.forEach((z, index) => {
          if (z.known) consider({ kind: 'zone', region, index }, r.x + z.x, r.y + z.y, PICK_ZONE);
        });
      });
    const found = best as Selectable | undefined;
    if (!found) return;
    this.group = found.kind === 'fight' ? 'Bosses' : 'Zones';
    this.selectLine(found);
  }

  // ------------------------------------------------------------ content

  /** The right side's lines, top to bottom. */
  private lines(): Line[] {
    const out: Line[] = [];
    const { regions, quests } = this.options;
    for (const group of GROUPS) {
      out.push({ kind: 'header', group });
      if (group !== this.group) continue;
      if (group === 'Quests') {
        const active = quests.map((q, index) => ({ q, index })).filter(({ q }) => !q.done);
        const done = quests.map((q, index) => ({ q, index })).filter(({ q }) => q.done);
        if (!quests.length) out.push({ kind: 'note', text: 'No quests yet.' });
        if (active.length) out.push({ kind: 'sub', text: 'Active' });
        for (const { index } of active) out.push({ kind: 'quest', index });
        if (done.length) out.push({ kind: 'sub', text: `Done · ${done.length}` });
        for (const { index } of done) out.push({ kind: 'quest', index });
        continue;
      }
      regions.forEach((r, region) => {
        const a = r.atlas;
        const list = group === 'Zones' ? a.zones : a.fights;
        if (!list.length) return;
        out.push({ kind: 'sub', text: a.name });
        // A region not explored at all gives nothing away, not even how much it holds.
        if (!a.places.length && !list.some((e) => e.known)) {
          out.push({ kind: 'note', text: 'Not explored yet' });
          return;
        }
        const kind = group === 'Zones' ? 'zone' : 'fight';
        list.forEach((_, index) => out.push({ kind, region, index }));
      });
    }
    return out;
  }

  private selection(): Selectable | undefined {
    return this.lines()
      .filter(isSelectable)
      .find((l) => lineKey(l) === this.selKey);
  }

  private zoneOf(l: Selectable): AtlasZone | undefined {
    return l.kind === 'zone' ? this.options.regions[l.region]?.atlas.zones[l.index] : undefined;
  }

  private fightOf(l: Selectable): AtlasFight | undefined {
    return l.kind === 'fight' ? this.options.regions[l.region]?.atlas.fights[l.index] : undefined;
  }

  private rebuild(): void {
    // The selection may have closed with its group: fall back to the group's header.
    if (!this.selection()) this.selKey = `h:${this.group ?? 'Zones'}`;
    this.buildMap();
    this.buildRight();
    this.buildHints();
  }

  private buildHeader(): void {
    const title = uiText('name', 'Map', paper.title);
    title.position.set(8, 4);
    const place = uiText('label', this.options.place, paper.inkDim);
    place.position.set(Math.ceil(title.width) + 16, 8);
    const p = this.options.progress;
    const stats = uiText(
      'label',
      `Badges ${p.badges[0]}/${p.badges[1]} · Hearts ${p.hearts[0]}/${p.hearts[1]} · Dex ${p.dex[0]}/${p.dex[1]}`,
      paper.inkDim,
    );
    stats.position.set(Math.round(W - 8 - stats.width), 8);
    this.header.addChild(title, place, stats);
  }

  /** Where the map centers: the selection when it has a known place, else the player. */
  private mapFocus(): {
    x: number;
    y: number;
    mark?: 'zone' | 'spot';
    /** A zone's edge runs and its region's world place (C36d). */
    edge?: { readonly x: number; readonly y: number; readonly runs: readonly ZoneRun[] };
  } {
    const sel = this.selection();
    const you = this.options.player;
    if (!sel) return you;
    const r =
      sel.kind === 'zone' || sel.kind === 'fight' ? this.options.regions[sel.region] : undefined;
    const z = this.zoneOf(sel);
    if (r && z?.known) {
      const edge = { x: r.x, y: r.y, runs: z.edge };
      return { x: r.x + z.x, y: r.y + z.y, mark: 'zone', edge };
    }
    const f = this.fightOf(sel);
    if (r && f?.known) return { x: r.x + f.x, y: r.y + f.y, mark: 'spot' };
    return you;
  }

  /** The map's top-left world tile for a center, kept within the world (whole pixels). */
  private originFor(c: { x: number; y: number }): { x: number; y: number } {
    const s = this.scale;
    const b = this.options.bounds;
    const pad = 8;
    const clamp = (v: number, lo: number, size: number, view: number): number =>
      size + 2 * pad <= view
        ? lo + size / 2 - view / 2
        : Math.max(lo - pad, Math.min(lo + size + pad - view, v - view / 2));
    return {
      x: Math.round(clamp(c.x, b.x, b.width, MAP.w / s) * s) / s,
      y: Math.round(clamp(c.y, b.y, b.height, MAP.h / s) * s) / s,
    };
  }

  private centerOf(o: { x: number; y: number }): { x: number; y: number } {
    return { x: o.x + MAP.w / 2 / this.scale, y: o.y + MAP.h / 2 / this.scale };
  }

  private buildMap(): void {
    // The blink and the player's marker outlive the map they sit on.
    this.blink.removeFromParent();
    this.you.removeFromParent();
    for (const c of this.mapLayer.removeChildren()) c.destroy({ children: true });
    const s = this.scale;
    const f = this.mapFocus();
    const vw = MAP.w / s;
    const vh = MAP.h / s;
    const { x: ox, y: oy } = this.originFor(this.pan ?? f);
    this.origin = { x: ox, y: oy };
    // Built a box beyond each edge, so a drag can move it before building again.
    const mx = vw;
    const my = vh;
    const at = (wx: number, wy: number): [number, number] => [
      Math.round(MAP.x + (wx - ox) * s),
      Math.round(MAP.y + (wy - oy) * s),
    ];

    // The world, scaled: parchment, the sea of each ferry, then the regions.
    const world = new Container();
    world.scale.set(s);
    world.position.set(MAP.x - ox * s, MAP.y - oy * s);
    // Parchment in the world's hatch phase (a tile's x + y), as the fog of every region.
    const ground = new TilingSprite({
      texture: hatchTexture(),
      width: Math.ceil(vw + 2 * mx) + 2,
      height: Math.ceil(vh + 2 * my) + 2,
    });
    const gx = Math.floor(ox - mx) - 1;
    const gy = Math.floor(oy - my) - 1;
    ground.position.set(gx, gy);
    ground.tilePosition.set(-gx, -gy);
    world.addChild(ground);
    const sea = new Graphics();
    const links = this.options.links ?? [];
    for (const l of links) {
      if (!l.sea) continue;
      sea.rect(l.sea.x, l.sea.y, l.sea.width, l.sea.height).fill({ color: SEA });
      for (let y = l.sea.y + 2; y < l.sea.y + l.sea.height - 1; y += 5)
        for (let x = l.sea.x + ((y / 5) % 2) * 3; x < l.sea.x + l.sea.width - 2; x += 6)
          sea.rect(x, y, 2, 1).fill({ color: SEA_WAVE });
    }
    world.addChild(sea);
    this.options.regions.forEach((r, i) => {
      const sprite = new Sprite(this.options.image(i));
      sprite.position.set(r.x, r.y);
      world.addChild(sprite);
    });
    this.mapLayer.addChild(world);

    // On top, unscaled: routes, markers, names, the selection and the player.
    const top = new Graphics();
    for (const l of links) {
      if (!l.sea) continue;
      // A dotted line through the boat's route (C37), else straight across.
      const pts = [l.a, ...(l.route ?? []), l.b].map((p) => at(p.x, p.y));
      let walked = 0;
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1] as [number, number];
        const [bx, by] = pts[i] as [number, number];
        const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay)));
        for (let k = 0; k < n; k++, walked++) {
          if (walked % 6 !== 0) continue;
          top
            .rect(Math.round(ax + ((bx - ax) * k) / n), Math.round(ay + ((by - ay) * k) / n), 1, 1)
            .fill({ color: paper.edge });
        }
      }
    }
    for (const m of this.options.markers ?? []) {
      const [x, y] = at(m.x, m.y);
      top.rect(x - 2, y - 2, 5, 5).fill({ color: paper.edge });
      top.rect(x - 1, y - 1, 3, 3).fill({ color: m.color });
    }
    for (const r of this.options.regions)
      for (const m of r.atlas.markers) {
        if (s < NEAR && m.kind === 'trainer') continue;
        const size = m.kind === 'town' ? 4 : m.kind === 'trainer' ? 2 : 3;
        const [cx, cy] = at(r.x + m.x, r.y + m.y);
        const x = cx - Math.floor(size / 2);
        const y = cy - Math.floor(size / 2);
        top.rect(x - 1, y - 1, size + 2, size + 2).fill({ color: paper.edge });
        top
          .rect(x, y, size, size)
          .fill({ color: MARKER_COLORS[m.kind], alpha: m.beaten ? 0.6 : 1 });
      }
    this.mapLayer.addChild(top);
    const inView = (x: number, y: number): boolean =>
      x > MAP.x - MAP.w - 40 &&
      y > MAP.y - MAP.h - 10 &&
      x < MAP.x + 2 * MAP.w + 40 &&
      y < MAP.y + 2 * MAP.h + 10;
    // Names (C36d): towns first, then landmarks, then secrets; one that would overlap a name
    // placed before it moves above its place or further down, else it hides.
    const labels: { view: Container; priority: number }[] = [];
    for (const r of this.options.regions) {
      if (s >= NEAR) {
        for (const p of r.atlas.places) {
          if (p.kind === 'zone' || p.kind === 'lair') continue;
          const [x, y] = at(r.x + p.x + 0.5, r.y + p.y);
          if (!inView(x, y)) continue;
          const priority = p.kind === 'town' ? 0 : p.kind === 'secret' ? 2 : 1;
          labels.push({ view: mapLabel(p.name, x, y + 3), priority });
        }
      } else if (r.atlas.places.length) {
        // Zoomed out: the region's name in the middle of what is explored of it.
        const ps = r.atlas.places;
        const mx = ps.reduce((a, p) => a + p.x, 0) / ps.length;
        const my = ps.reduce((a, p) => a + p.y, 0) / ps.length;
        const [x, y] = at(r.x + mx, r.y + my);
        const t = uiText('name', r.atlas.name, paper.title);
        const w = Math.ceil(t.width) + 8;
        const box = new Container();
        box.addChild(new Graphics().rect(0, 0, w, 14).fill({ color: paper.base, alpha: 0.88 }), t);
        t.position.set(4, 0);
        box.position.set(Math.round(x - w / 2), Math.round(y - 7));
        labels.push({ view: box, priority: 0 });
      }
    }
    const placed = placeLabels(
      labels.map(({ view, priority }) => ({
        x: view.x,
        y: view.y,
        w: Math.ceil(view.width),
        h: Math.ceil(view.height),
        priority,
      })),
      s >= NEAR ? LABEL_OFFSETS : [0, 9, -9],
    );
    labels.forEach(({ view }, i) => {
      const dy = placed[i];
      if (dy === undefined) {
        view.destroy({ children: true });
        return;
      }
      view.y += dy;
      this.mapLayer.addChild(view);
    });
    this.blink.clear();
    if (f.edge?.runs.length) {
      // The zone's real edge tiles (C36d), within the built area.
      const e = f.edge;
      const x0 = ox - mx;
      const y0 = oy - my;
      const x1 = ox + vw + mx;
      const y1 = oy + vh + my;
      for (const [rx, ry, n] of e.runs) {
        const wx = e.x + rx;
        const wy = e.y + ry;
        if (wy < y0 || wy > y1 || wx + n < x0 || wx > x1) continue;
        const [x, y] = at(wx, wy);
        const [x2, y2] = at(wx + n, wy + 1);
        this.blink.rect(x, y, Math.max(1, x2 - x), Math.max(1, y2 - y)).fill({
          color: paper.accent,
        });
      }
      this.mapLayer.addChild(this.blink);
    } else if (f.mark) {
      const [x, y] = at(f.x, f.y);
      this.blink.rect(x - 4 + 0.5, y - 4 + 0.5, 9, 9).stroke({ color: paper.accent, width: 1 });
      this.mapLayer.addChild(this.blink);
    }
    const [px, py] = at(this.options.player.x, this.options.player.y);
    this.you.position.set(px, py);
    this.mapLayer.addChild(this.you);
    const scaleNote = uiText('label', s < NEAR ? 'Whole world · ½' : '', paper.inkDim);
    if (s < NEAR) {
      const w = Math.ceil(scaleNote.width) + 6;
      const tag = new Container();
      tag.addChild(
        new Graphics().rect(0, 0, w, 9).fill({ color: paper.base, alpha: 0.9 }),
        scaleNote,
      );
      scaleNote.position.set(3, 1);
      tag.position.set(MAP.x + MAP.w - w - 2, MAP.y + MAP.h - 11);
      this.mapLayer.addChild(tag);
    } else scaleNote.destroy();
  }

  private buildRight(): void {
    for (const c of this.right.removeChildren()) c.destroy({ children: true });
    const hits = this.hits.right;
    hits.length = 0;
    const g = new Graphics();
    this.right.addChild(g);
    drawWell(g, RIGHT.x, LIST_Y, RIGHT.w, LIST_H);
    const lines = this.lines();
    const n = lines.length;
    const selAt = Math.max(
      0,
      lines.findIndex((l) => isSelectable(l) && lineKey(l) === this.selKey),
    );
    // Keys keep the selection in view; the wheel and the arrows scroll freely.
    if (this.followSelection) {
      if (selAt < this.scroll) this.scroll = selAt;
      else if (selAt >= this.scroll + ROWS) this.scroll = selAt - ROWS + 1;
    }
    this.scroll = Math.max(0, Math.min(Math.max(0, n - ROWS), this.scroll));
    const first = this.scroll;
    const x = RIGHT.x + 2;
    const w = RIGHT.w - 4;
    for (let i = first; i < Math.min(n, first + ROWS); i++) {
      const l = lines[i];
      if (!l) continue;
      const y = LIST_Y + 2 + (i - first) * ROW_H;
      if (isSelectable(l)) {
        const on = lineKey(l) === this.selKey;
        if (on) drawCursor(g, x, y, w, ROW_H - 1, true);
        // A header opens or closes; a row is selected, and again opens its card.
        hits.push({
          x,
          y,
          w: w - 10,
          h: ROW_H,
          act: () =>
            l.kind === 'header' ? this.toggle(l.group) : on ? this.openCard() : this.selectLine(l),
        });
      }
      this.buildLine(g, l, x, y, w);
    }
    // Scroll arrows: a page up or down (added first, so they win over the rows they sit on).
    const page = (step: number): void => this.scrollBy(step * (ROWS - 1));
    if (first > 0) {
      hits.unshift({ x: RIGHT.x + RIGHT.w - 12, y: LIST_Y, w: 12, h: 12, act: () => page(-1) });
      this.label('▲', paper.inkDim, RIGHT.x + RIGHT.w - 9, LIST_Y + 1);
    }
    if (first + ROWS < n) {
      hits.unshift({
        x: RIGHT.x + RIGHT.w - 12,
        y: LIST_Y + LIST_H - 12,
        w: 12,
        h: 12,
        act: () => page(1),
      });
      this.label('▼', paper.inkDim, RIGHT.x + RIGHT.w - 9, LIST_Y + LIST_H - 9);
    }
    drawWell(g, RIGHT.x, DETAIL_Y, RIGHT.w, DETAIL_H);
    this.buildDetail(RIGHT.x + 5, DETAIL_Y + 2);
  }

  private label(s: string, color: number, x: number, y: number): void {
    const t = uiText('label', s, color);
    t.position.set(Math.round(x), Math.round(y));
    this.right.addChild(t);
  }

  private text(s: string, color: number, x: number, y: number, right = false): number {
    const t = uiText('body', s, color);
    t.position.set(Math.round(right ? x - t.width : x), Math.round(y));
    this.right.addChild(t);
    return t.width;
  }

  private buildLine(g: Graphics, l: Line, x: number, y: number, w: number): void {
    // Room on the right for the scroll arrows.
    const end = x + w - 12;
    const { regions, quests } = this.options;
    if (l.kind === 'sub') {
      const t = uiText('label', l.text, paper.inkDim);
      t.position.set(x + 3, y + 2);
      this.right.addChild(t);
      g.rect(x + 6 + Math.ceil(t.width), y + 6, Math.max(0, w - t.width - 12), 1).fill({
        color: paper.shade,
      });
      return;
    }
    if (l.kind === 'note') {
      this.text(l.text, paper.inkDisabled, x + 10, y - 1);
      return;
    }
    if (l.kind === 'header') {
      const open = this.group === l.group;
      const t = uiText('name', l.group, paper.title);
      t.position.set(x + 8, y - 2);
      this.right.addChild(t);
      this.text(open ? '▾' : '▸', paper.title, end, y - 1, true);
      const tail = this.text(this.count(l.group), paper.inkDim, end - 10, y - 1, true);
      if (l.group === 'Quests' && quests.some((q) => q.fresh))
        this.newTag(g, Math.round(end - 14 - tail - 22), y + 1);
      if (!open) g.rect(x + 2, y + ROW_H - 2, w - 4, 1).fill({ color: paper.shade });
      return;
    }
    if (l.kind === 'zone') {
      const z = regions[l.region]?.atlas.zones[l.index];
      if (!z) return;
      g.rect(x + 8, y + 2, 14, 8).fill({
        color: z.known ? TIER_CHIPS[z.tier].fill : paper.inkDisabled,
      });
      if (!z.known) {
        this.text('???', paper.inkDisabled, x + 25, y - 1);
        return;
      }
      const t = uiText('label', TIER_LABEL[z.tier], TIER_CHIPS[z.tier].ink);
      t.position.set(x + 10, y + 2);
      this.right.addChild(t);
      this.text(z.name, paper.ink, x + 25, y - 1);
      this.text(`${z.levels[0]}–${z.levels[1]}`, paper.inkDim, end, y - 1, true);
      return;
    }
    if (l.kind === 'fight') {
      const f = regions[l.region]?.atlas.fights[l.index];
      if (!f) return;
      g.rect(x + 9, y + 2, 7, 7).fill({ color: paper.edge });
      g.rect(x + 10, y + 3, 5, 5).fill({
        color: f.known ? MARKER_COLORS[f.kind] : paper.inkDisabled,
      });
      if (!f.known) {
        this.text('???', paper.inkDisabled, x + 20, y - 1);
        return;
      }
      this.text(f.name, paper.ink, x + 20, y - 1);
      const lv = this.text(`Lv ${f.level}`, paper.inkDim, end, y - 1, true);
      if (f.result)
        this.text(f.result === 'caught' ? '★' : '✓', paper.title, end - lv - 3, y - 1, true);
      return;
    }
    const q = quests[l.index];
    if (!q) return;
    this.text(q.done ? '✓' : '•', q.done ? paper.title : paper.inkDim, x + 9, y - 1);
    this.text(q.name, q.done ? paper.inkDim : paper.ink, x + 18, y - 1);
    if (q.fresh) this.newTag(g, end - 22, y + 1);
  }

  private newTag(g: Graphics, x: number, y: number): void {
    g.rect(x, y, 22, 9).fill({ color: paper.accent });
    const t = uiText('label', 'New', 0xffffff);
    t.position.set(Math.round(x + (22 - t.width) / 2), y + 1);
    this.right.addChild(t);
  }

  private count(group: GroupId): string {
    const all = this.options.regions.map((r) => r.atlas);
    if (group === 'Zones') {
      const zones = all.flatMap((a) => a.zones);
      return `${zones.filter((z) => z.known).length}/${zones.length}`;
    }
    if (group === 'Bosses') {
      const fights = all.flatMap((a) => a.fights);
      return `${fights.filter((f) => f.result).length}/${fights.length}`;
    }
    const active = this.options.quests.filter((q) => !q.done).length;
    return `${active} active`;
  }

  /** Two or three lines about the selection, under the groups. */
  private buildDetail(x: number, y: number): void {
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

  /** The selection in words; `full` for the F card. The first line is the title. */
  private detailLines(full: boolean): string[] {
    const sel = this.selection();
    if (!sel) return [];
    if (sel.kind === 'header') {
      if (full) return [];
      const hint =
        this.group === sel.group
          ? `${upDownHint()} to go through, ${keyHint('inspect')} for details.`
          : `${keyHint('confirm')} to open the list.`;
      return ['You are here', this.options.place, hint];
    }
    const region = sel.kind === 'quest' ? undefined : this.options.regions[sel.region]?.atlas.name;
    const z = this.zoneOf(sel);
    if (z) return zoneLines(z, region ?? '', full);
    const f = this.fightOf(sel);
    if (f) return fightLines(f, region ?? '', full);
    const q = sel.kind === 'quest' ? this.options.quests[sel.index] : undefined;
    if (!q) return [];
    const now = q.steps.find((s) => !s.done);
    if (!full)
      return [
        q.name,
        ...(q.from ? [`From ${q.from}`] : []),
        q.done ? 'Done.' : (now?.text ?? q.summary),
      ];
    return [
      q.fresh ? `${q.name} · New` : q.name,
      ...(q.from ? [`From ${q.from}`] : []),
      q.summary,
      ...q.steps.map((s) => `${s.done ? '✓' : '•'} ${s.text}`),
      ...(q.reward ? [`Reward: ${q.reward}`] : []),
    ];
  }

  openCard(): void {
    const lines = this.detailLines(true);
    if (!lines.length) return;
    const w = 230;
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
    const hint = new KeyHint(keyHint('inspect'), 'Close');
    hint.position.set(8, y + 4);
    const h = Math.min(H - 8, Math.ceil(y + 18));
    const bg = drawPaper(new Graphics(), 0, 0, w, h);
    const box = new Container();
    box.addChild(bg, ...items, hint);
    // Over the map, so the list stays in view.
    box.position.set(MAP.x + Math.round((MAP.w - w) / 2), Math.max(4, Math.round((H - h) / 2)));
    this.card.addChild(box);
  }

  private closeCard(): void {
    for (const c of this.card.removeChildren()) c.destroy({ children: true });
  }

  private buildHints(): void {
    for (const c of this.hintRow.removeChildren()) c.destroy({ children: true });
    this.hits.hints.length = 0;
    const sel = this.selection();
    const hints: [KeyHint, () => void][] = [
      [new KeyHint(upDownHint(), 'Move'), () => this.move(1)],
      [
        new KeyHint(
          keyHint('confirm'),
          sel?.kind === 'header' && this.group === sel.group ? 'Fold' : 'Open',
        ),
        () => this.activate(),
      ],
      [new KeyHint(keyHint('inspect'), 'Details'), () => this.openCard()],
      [
        new KeyHint(keyHint('zoom'), this.scale === NEAR ? 'Whole world' : 'Zoom in'),
        () => this.toggleZoom(),
      ],
      [new KeyHint(keyHint('back'), 'Close'), () => this.options.onBack(this)],
    ];
    const views = hints.map(([h]) => h);
    this.hintRow.addChild(...views);
    row(views, 10, 8, H - 14);
    for (const [h, act] of hints)
      this.hits.hints.push({ x: h.x, y: h.y - 2, w: h.width, h: h.height + 4, act });
  }
}

function zoneLines(z: AtlasZone, region: string, full: boolean): string[] {
  if (!z.known) return ['???', 'Not discovered yet. Walk in to chart it.'];
  const tier = z.tier === 'danger' ? 'danger zone' : `tier ${z.tier.slice(1)}`;
  const seen = z.spawns.filter((s) => s.seen).length;
  const caught = z.spawns.filter((s) => s.caught).length;
  const storm = z.weather.length ? `Storm: ${z.weather.join(', ')} on both sides.` : '';
  if (!full)
    return [
      z.name,
      `${region} · Lv ${z.levels[0]}–${z.levels[1]}`,
      `Seen ${seen}/${z.spawns.length} · Caught ${caught}${storm ? ' · Storm' : ''}`,
    ];
  const unseen = z.spawns.length - seen;
  return [
    `${z.name} · Lv ${z.levels[0]}–${z.levels[1]}`,
    `A ${tier} zone in ${region} with ${z.spawns.length} kinds of wild Zorlings.`,
    ...z.spawns
      .filter((s) => s.seen)
      .map((s) => `${s.name ?? '?'}: ${s.caught ? 'caught ★' : 'seen'}`),
    ...(unseen
      ? [unseen === z.spawns.length ? 'None seen yet.' : `${unseen} more not seen yet.`]
      : []),
    ...(storm ? [storm] : []),
  ];
}

function fightLines(f: AtlasFight, region: string, full: boolean): string[] {
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
  const lines = [f.name, `${kind} · Lv ${f.level} · ${status}`, ...(weak ? [weak] : [])];
  if (full) lines.push(f.where ? `Found in ${f.where}, ${region}.` : `In ${region}.`);
  return lines;
}
