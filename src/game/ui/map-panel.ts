/**
 * Region map screen (C22, `M`): the region's minimap with the player (blinking), the zone
 * the player is in and the town's center and shop marked. C36b: unexplored land is blank
 * parchment, discovered places are labelled, and a region bigger than the screen shows the
 * part around the player. `E` opens the Atlas (when given), Q (or M) closes it.
 */

import { Container, Graphics, Rectangle, Sprite, type Texture } from 'pixi.js';
import { type UiInput, type Widget } from '@engine/ui';
import { paper } from '../style/tokens';
import { KeyHint, row } from './badges';
import { drawPaper, drawWell } from './skin';
import { uiText } from './text';

/** The player's marker: bright gold, stands out on green and blue. */
const YOU = 0xffd23f;

export interface MapMarker {
  readonly x: number;
  readonly y: number;
  readonly color: number;
  readonly label: string;
}

/** A place name drawn on the map (tile coordinates). */
export interface MapLabel {
  readonly x: number;
  readonly y: number;
  readonly text: string;
}

export interface MapPanelOptions {
  readonly title: string;
  /** Where the player is ("Sunny Meadow · Lv 3–8"). */
  readonly place: string;
  /** Minimap texture, `scale` px per tile. */
  readonly image: Texture;
  readonly scale: number;
  /** Largest map area shown (px); a bigger map is cropped around the player. */
  readonly view?: { readonly width: number; readonly height: number };
  readonly player: { readonly x: number; readonly y: number };
  readonly markers: readonly MapMarker[];
  readonly labels?: readonly MapLabel[];
  /** `E`: open the Atlas (C36b). */
  readonly onAtlas?: (panel: MapPanel) => void;
  readonly onBack: (panel: MapPanel) => void;
}

/** A place name on a map: small caps on a paper strip, centered under (x, y). */
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

export class MapPanel implements Widget<Container> {
  readonly view = new Container({ label: 'map' });
  width: number;
  readonly height: number;
  private readonly you = new Graphics();
  private time = 0;
  /** Key hints that work as buttons (mouse). */
  private readonly buttons: { view: Container; act: () => void }[] = [];

  constructor(private readonly options: MapPanelOptions) {
    const { image, scale } = options;
    const mw = Math.min(image.width, options.view?.width ?? image.width);
    const mh = Math.min(image.height, options.view?.height ?? image.height);
    this.width = Math.max(mw + 16, 220);
    this.height = mh + 50;
    const bg = drawPaper(new Graphics(), 0, 0, this.width, this.height);
    const mx = Math.round((this.width - mw) / 2);
    const my = 20;
    drawWell(bg, mx - 2, my - 2, mw + 4, mh + 4);
    const title = uiText('label', options.title, paper.title);
    title.position.set(7, 6);
    const place = uiText('label', options.place, paper.inkDim);
    place.position.set(Math.round(this.width - 8 - place.width), 6);

    // Everything on the map lives in `inner`, shifted so the player is centered, clipped.
    const p = options.player;
    const clamp = (v: number, size: number, view: number): number =>
      Math.max(0, Math.min(size - view, Math.round(v - view / 2)));
    const ox = clamp(p.x * scale + scale / 2, image.width, mw);
    const oy = clamp(p.y * scale + scale / 2, image.height, mh);
    const inner = new Container();
    inner.position.set(mx - ox, my - oy);
    const mask = new Graphics().rect(mx, my, mw, mh).fill({ color: 0xffffff });
    inner.mask = mask;
    const map = new Sprite(image);
    const marks = new Graphics();
    const legend: Container[] = [];
    const labels = new Set<string>();
    for (const m of options.markers) {
      const x = m.x * scale;
      const y = m.y * scale;
      marks.rect(x - 2, y - 2, scale + 4, scale + 4).fill({ color: paper.edge });
      marks.rect(x - 1, y - 1, scale + 2, scale + 2).fill({ color: m.color });
      if (labels.has(m.label)) continue;
      labels.add(m.label);
      const item = new Container();
      const dot = new Graphics();
      dot.rect(0, 1, 5, 5).fill({ color: paper.edge }).rect(1, 2, 3, 3).fill({ color: m.color });
      const text = uiText('label', m.label, paper.inkDim);
      text.position.set(8, 0);
      item.addChild(dot, text);
      legend.push(item);
    }
    inner.addChild(map, marks);
    for (const l of options.labels ?? [])
      inner.addChild(mapLabel(l.text, l.x * scale + scale / 2, l.y * scale + scale + 2));
    this.you.rect(-3, -3, scale + 6, scale + 6).fill({ color: paper.edge });
    this.you.rect(-2, -2, scale + 4, scale + 4).fill({ color: YOU });
    this.you.position.set(p.x * scale, p.y * scale);
    inner.addChild(this.you);
    const youKey = new Container();
    const yd = new Graphics();
    yd.rect(0, 1, 5, 5).fill({ color: paper.edge }).rect(1, 2, 3, 3).fill({ color: YOU });
    const yt = uiText('label', 'You', paper.inkDim);
    yt.position.set(8, 0);
    youKey.addChild(yd, yt);
    this.view.addChild(bg, title, place, inner, mask);
    const atlas = options.onAtlas;
    const hints: KeyHint[] = [];
    if (atlas) {
      const h = new KeyHint('E', 'Atlas');
      this.buttons.push({ view: h, act: () => atlas(this) });
      hints.push(h);
    }
    const close = new KeyHint('Q', 'Close');
    this.buttons.push({ view: close, act: () => options.onBack(this) });
    hints.push(close);
    const items = [youKey, ...legend, ...hints];
    this.view.addChild(...items);
    row(items, 10, 7, this.height - 14);
    // A long legend widens the panel.
    const last = items[items.length - 1];
    const need = last ? Math.ceil(last.x + last.width + 8) : 0;
    if (need > this.width) {
      const grow = need - this.width;
      this.width = need;
      drawPaper(bg.clear(), 0, 0, this.width, this.height);
      drawWell(bg, mx + Math.floor(grow / 2) - 2, my - 2, mw + 4, mh + 4);
      inner.x += Math.floor(grow / 2);
      mask
        .clear()
        .rect(mx + Math.floor(grow / 2), my, mw, mh)
        .fill({ color: 0xffffff });
      place.x = Math.round(this.width - 8 - place.width);
    }
    this.view.eventMode = 'static';
    this.view.hitArea = new Rectangle(0, 0, this.width, this.height);
  }

  contains(x: number, y: number): boolean {
    const p = this.view.toLocal({ x, y });
    return p.x >= 0 && p.y >= 0 && p.x <= this.width && p.y <= this.height;
  }

  dismiss(): void {
    this.options.onBack(this);
  }

  update(dt: number): void {
    this.time += dt;
    this.you.visible = this.time % 0.8 < 0.55;
  }

  handleInput(input: UiInput): void {
    const p = input.pointerPressed();
    if (p) {
      // A click on a key hint does what its key does.
      const at = this.view.toLocal(p);
      const b = this.buttons.find(
        ({ view: v }) =>
          at.x >= v.x && at.y >= v.y - 2 && at.x < v.x + v.width && at.y < v.y + v.height + 2,
      );
      b?.act();
      return;
    }
    if (input.confirmPressed() && this.options.onAtlas) this.options.onAtlas(this);
    else if (input.backPressed() || input.confirmPressed()) this.options.onBack(this);
  }
}

/** A small paper panel with a title, text and "Q Back" (empty screens, placeholders). */
export class NoticePanel implements Widget<Container> {
  readonly view = new Container({ label: 'notice' });
  readonly width: number;
  readonly height: number;

  constructor(
    title: string,
    text: string,
    private readonly onBack: (panel: NoticePanel) => void,
    width = 220,
  ) {
    this.width = width;
    const t = uiText('label', title, paper.title);
    t.position.set(7, 6);
    const body = uiText('body', text, paper.ink, { wordWrap: true, wordWrapWidth: width - 16 });
    body.position.set(8, 18);
    this.height = Math.ceil(18 + body.height + 22);
    const bg = drawPaper(new Graphics(), 0, 0, width, this.height);
    const hint = new KeyHint('Q', 'Back');
    hint.position.set(7, this.height - 13);
    this.view.addChild(bg, t, body, hint);
    this.view.eventMode = 'static';
    this.view.hitArea = new Rectangle(0, 0, width, this.height);
  }

  contains(x: number, y: number): boolean {
    const p = this.view.toLocal({ x, y });
    return p.x >= 0 && p.y >= 0 && p.x <= this.width && p.y <= this.height;
  }

  dismiss(): void {
    this.onBack(this);
  }

  handleInput(input: UiInput): void {
    if (input.backPressed() || input.confirmPressed()) this.onBack(this);
  }
}
