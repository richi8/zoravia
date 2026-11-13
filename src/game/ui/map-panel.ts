/**
 * Region map screen (C22, `M`): the region's minimap with the player (blinking), the zone
 * the player is in and the town's center and shop marked. Q (or M) closes it.
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

export interface MapPanelOptions {
  readonly title: string;
  /** Where the player is ("Sunny Meadow · Lv 3–8"). */
  readonly place: string;
  /** Minimap texture, `scale` px per tile. */
  readonly image: Texture;
  readonly scale: number;
  readonly player: { readonly x: number; readonly y: number };
  readonly markers: readonly MapMarker[];
  readonly onBack: (panel: MapPanel) => void;
}

export class MapPanel implements Widget<Container> {
  readonly view = new Container({ label: 'map' });
  readonly width: number;
  readonly height: number;
  private readonly you = new Graphics();
  private time = 0;

  constructor(private readonly options: MapPanelOptions) {
    const { image, scale } = options;
    const mw = image.width;
    const mh = image.height;
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
    const map = new Sprite(image);
    map.position.set(mx, my);
    const marks = new Graphics();
    const legend: Container[] = [];
    const labels = new Set<string>();
    for (const m of options.markers) {
      const x = mx + m.x * scale;
      const y = my + m.y * scale;
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
    const p = options.player;
    this.you.rect(-3, -3, scale + 6, scale + 6).fill({ color: paper.edge });
    this.you.rect(-2, -2, scale + 4, scale + 4).fill({ color: YOU });
    this.you.position.set(mx + p.x * scale, my + p.y * scale);
    const youKey = new Container();
    const yd = new Graphics();
    yd.rect(0, 1, 5, 5).fill({ color: paper.edge }).rect(1, 2, 3, 3).fill({ color: YOU });
    const yt = uiText('label', 'You', paper.inkDim);
    yt.position.set(8, 0);
    youKey.addChild(yd, yt);
    this.view.addChild(bg, title, place, map, marks, this.you);
    const hints = [new KeyHint('Q', 'Close')];
    const items = [youKey, ...legend, ...hints];
    this.view.addChild(...items);
    row(items, 10, 7, this.height - 14);
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
    if (input.backPressed() || input.confirmPressed()) this.options.onBack(this);
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
