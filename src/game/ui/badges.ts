/**
 * Small UI pieces: type badges, condition chips (with turns-left pips) and key hints.
 * All sizes are game pixels; text is smooth (see `text.ts`).
 */

import { Container, Graphics } from 'pixi.js';
import { darken } from '@engine/core/color';
import { pixelBitmap, pixelRoundRect } from '@engine/ui';
import { conditionColors, paper, typeColors, type ConditionId, type TypeId } from '../style/tokens';
import { CONDITION_ICONS, TYPE_ICONS } from './icons';
import { uiText } from './text';

/** Height of badges and chips (without the turns pips). */
export const CHIP_SIZE = 11;

/** Colored pill with the type icon and (optionally) its name. */
export class TypeBadge extends Container {
  constructor(
    readonly type: TypeId,
    options: { readonly label?: boolean } = {},
  ) {
    super({ label: `type:${type}` });
    const tc = typeColors[type];
    const g = new Graphics();
    this.addChild(g);
    let w = CHIP_SIZE;
    if (options.label ?? true) {
      const text = uiText('label', tc.label, tc.on);
      w = CHIP_SIZE + Math.ceil(text.width) + 3;
      text.position.set(CHIP_SIZE - 1, Math.round((CHIP_SIZE - 1 - text.height) / 2));
      this.addChild(text);
    }
    pixelRoundRect(g, 0, 0, w, CHIP_SIZE, 2, darken(tc.base, 0.35));
    pixelRoundRect(g, 0, 0, w, CHIP_SIZE - 1, 2, tc.base);
    pixelBitmap(g, TYPE_ICONS[type], 2, 1, tc.on);
    this.setChildIndex(g, 0);
  }
}

/** Square condition icon; `turns` (0–3) shows as pips under it. */
export class ConditionChip extends Container {
  private readonly pips = new Graphics();

  constructor(
    readonly condition: ConditionId,
    turns?: number,
  ) {
    super({ label: `condition:${condition}` });
    const cc = conditionColors[condition];
    const g = new Graphics();
    pixelRoundRect(g, 0, 0, CHIP_SIZE, CHIP_SIZE, 2, darken(cc.color, 0.4));
    pixelRoundRect(g, 0, 0, CHIP_SIZE, CHIP_SIZE - 1, 2, cc.color);
    pixelBitmap(g, CONDITION_ICONS[condition], 2, 1, cc.on);
    this.addChild(g, this.pips);
    if (turns !== undefined) this.setTurns(turns);
  }

  setTurns(turns: number, max = 3): void {
    const cc = conditionColors[this.condition];
    this.pips.clear();
    for (let i = 0; i < max; i++) {
      this.pips.rect(1 + i * 3, CHIP_SIZE + 1, 2, 1).fill({
        color: i < turns ? darken(cc.color, 0.25) : paper.shade,
      });
    }
  }
}

/** Key cap plus a label, e.g. `[E] SELECT`. */
export class KeyHint extends Container {
  constructor(key: string, label: string) {
    super({ label: `key:${key}` });
    const g = new Graphics();
    const k = uiText('label', key, paper.keyInk);
    const t = uiText('label', label, paper.inkDim);
    const kw = Math.max(7, Math.ceil(k.width) + 4);
    pixelRoundRect(g, 0, 0, kw, 9, 1, paper.key);
    k.position.set(Math.round((kw - k.width) / 2), Math.round((9 - k.height) / 2));
    t.position.set(kw + 3, Math.round((9 - t.height) / 2));
    this.addChild(g, k, t);
  }
}

/** Lays children out in a row with `gap` px between them; returns the row width. */
export function row(children: readonly Container[], gap: number, x = 0, y = 0): number {
  let cx = x;
  for (const c of children) {
    c.position.set(Math.round(cx), y);
    cx += Math.ceil(c.width) + gap;
  }
  return Math.max(0, cx - x - gap);
}

/**
 * Small colored pill with a short label and optional turns pips: statuses without an icon
 * (a reaction's lingering effect such as Rooted or Frozen) and boss states (Armor, Subdued).
 */
export class StatusPill extends Container {
  constructor(label: string, color: number, on: number, turns?: number, maxTurns = 3) {
    super({ label: `pill:${label}` });
    const g = new Graphics();
    const text = uiText('label', label, on);
    const w = Math.ceil(text.width) + 6;
    pixelRoundRect(g, 0, 0, w, CHIP_SIZE, 2, darken(color, 0.4));
    pixelRoundRect(g, 0, 0, w, CHIP_SIZE - 1, 2, color);
    text.position.set(3, Math.round((CHIP_SIZE - 1 - text.height) / 2));
    this.addChild(g, text);
    if (turns !== undefined) {
      for (let i = 0; i < maxTurns; i++) {
        g.rect(1 + i * 3, CHIP_SIZE + 1, 2, 1).fill({
          color: i < turns ? darken(color, 0.25) : paper.shade,
        });
      }
    }
  }
}
