/**
 * What the overworld screens (party, storage, relearner) show about one owned Zorling, plus
 * the small helpers they share: a portrait slot and a pointer queue for hover/click rows.
 */

import { Container, Graphics, Rectangle, Sprite, type Texture } from 'pixi.js';
import { paper, type TypeId } from '../style/tokens';
import type { UiInput } from '@engine/ui';
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

/** What a drag did this step (see `DragSpots`). */
export type DragStep<S> =
  | { readonly kind: 'none' }
  | { readonly kind: 'moving'; readonly from: S; readonly x: number; readonly y: number }
  | { readonly kind: 'drop'; readonly from: S; readonly to: S | undefined };

/**
 * Drag and drop between spots (C44: storage, party). Press on a spot, move a few pixels with
 * the button held and it is a drag; releasing drops on the spot under the pointer. A press
 * that never moves stays a plain click (the panel's `PointerQueue` handles it). Positions are
 * in the panel's local space (`toLocal`); `spotAt` maps one to a spot, or undefined.
 */
export class DragSpots<S> {
  private start: { spot: S; x: number; y: number } | undefined;
  private last = { x: 0, y: 0 };
  private moving = false;

  constructor(
    private readonly spotAt: (x: number, y: number) => S | undefined,
    private readonly canStart: (spot: S) => boolean,
    private readonly threshold = 4,
  ) {}

  get dragging(): boolean {
    return this.moving;
  }

  update(
    input: UiInput,
    toLocal: (p: { x: number; y: number }) => { x: number; y: number },
  ): DragStep<S> {
    const pressed = input.pointerPressed();
    if (pressed && !this.start) {
      const p = toLocal(pressed);
      const spot = this.spotAt(p.x, p.y);
      if (spot !== undefined && this.canStart(spot)) this.start = { spot, x: p.x, y: p.y };
      this.last = p;
      return { kind: 'none' };
    }
    const start = this.start;
    if (!start) return { kind: 'none' };
    const held = input.pointerHeld?.();
    if (held) {
      this.last = toLocal(held);
      if (!this.moving) {
        const dx = this.last.x - start.x;
        const dy = this.last.y - start.y;
        if (dx * dx + dy * dy >= this.threshold * this.threshold) this.moving = true;
      }
      return this.moving
        ? { kind: 'moving', from: start.spot, x: this.last.x, y: this.last.y }
        : { kind: 'none' };
    }
    const wasMoving = this.moving;
    this.cancel();
    return wasMoving
      ? { kind: 'drop', from: start.spot, to: this.spotAt(this.last.x, this.last.y) }
      : { kind: 'none' };
  }

  cancel(): void {
    this.start = undefined;
    this.moving = false;
  }
}

/** The portrait that follows the pointer during a drag. */
export function dragGhost(portrait: Texture): Container {
  const c = portraitSlot(portrait, { frame: true });
  c.alpha = 0.85;
  c.eventMode = 'none';
  return c;
}
