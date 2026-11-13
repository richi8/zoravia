/**
 * What the overworld screens (party, storage, relearner) show about one owned Zorling, plus
 * the small helpers they share: a portrait slot and a pointer queue for hover/click rows.
 */

import { Container, Graphics, Rectangle, Sprite, type Texture } from 'pixi.js';
import { paper, type TypeId } from '../style/tokens';
import { drawWell } from './skin';

export interface MoveLine {
  readonly name: string;
  readonly type: TypeId;
  readonly power: number;
  readonly accuracy: number;
}

export interface ZorlingView {
  readonly uid: string;
  /** Nickname or species name. */
  readonly name: string;
  readonly species: string;
  readonly level: number;
  readonly types: readonly TypeId[];
  readonly hp: number;
  readonly maxHp: number;
  /** Progress to the next level, 0–1. */
  readonly xp: number;
  /** XP still needed for the next level. */
  readonly toNext: number;
  readonly stats: { readonly attack: number; readonly defense: number; readonly speed: number };
  readonly trait?: { readonly name: string; readonly description: string };
  readonly moves: readonly MoveLine[];
  readonly titan: boolean;
  /** Species name it can evolve into now (it reached the level and waited). */
  readonly evolveInto?: string;
  /** 32×32 portrait. */
  readonly portrait: Texture;
}

export const SLOT = 34;

/** A 34×34 well with the portrait; `on` fills it with the cursor color, `frame` outlines it. */
export function portraitSlot(
  portrait: Texture | undefined,
  opts: { on?: boolean; frame?: boolean; dim?: boolean } = {},
): Container {
  const c = new Container();
  const g = new Graphics();
  drawWell(g, 0, 0, SLOT, SLOT);
  if (opts.on) g.rect(1, 1, SLOT - 2, SLOT - 2).fill({ color: paper.cursor });
  c.addChild(g);
  if (portrait) {
    const s = new Sprite(portrait);
    s.position.set(1, 1);
    if (opts.dim) s.alpha = 0.4;
    c.addChild(s);
  }
  if (opts.frame) {
    const f = new Graphics();
    f.rect(0, 0, SLOT, 1)
      .rect(0, SLOT - 1, SLOT, 1)
      .rect(0, 0, 1, SLOT)
      .rect(SLOT - 1, 0, 1, SLOT);
    f.fill({ color: paper.accent });
    c.addChild(f);
  }
  c.hitArea = new Rectangle(0, 0, SLOT, SLOT);
  return c;
}

/**
 * Pointer events on rows, queued so a widget applies them inside its fixed-step
 * `handleInput` (like the engine's `Menu`).
 */
export class PointerQueue<K extends string> {
  private pending: { kind: K; index: number; click: boolean } | undefined;

  constructor(private readonly active: () => boolean) {}

  bind(view: Container, kind: K, index: number): void {
    view.eventMode = 'static';
    view.cursor = 'pointer';
    view.on('pointerover', () => {
      if (this.active()) this.pending = { kind, index, click: false };
    });
    view.on('pointertap', (e) => {
      if (this.active() && e.button === 0) this.pending = { kind, index, click: true };
    });
  }

  take(): { kind: K; index: number; click: boolean } | undefined {
    const p = this.pending;
    this.pending = undefined;
    return p;
  }

  clear(): void {
    this.pending = undefined;
  }
}
