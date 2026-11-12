/**
 * Battle HUD pieces: the info card of a Zorling in battle (name, level, HP, types,
 * conditions, XP for your own) and the hotbar (team slots 1–3).
 *
 * Components take plain view data (`CombatantView`); they know nothing about the battle
 * engine. Tooltip text comes from the caller (`HudTips`), since descriptions are content.
 */

import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import {
  pixelRoundRect,
  pixelRoundStroke,
  type TooltipContent,
  type TooltipLayer,
} from '@engine/ui';
import { paper, type ConditionId, type TypeId } from '../style/tokens';
import { CHIP_SIZE, ConditionChip, TypeBadge } from './badges';
import { HpBar, XpBar, hpColor } from './bars';
import { drawPaper, drawWell } from './skin';
import { uiText } from './text';

export interface CombatantView {
  readonly name: string;
  readonly level: number;
  readonly types: readonly TypeId[];
  readonly hp: number;
  readonly maxHp: number;
  readonly conditions: readonly { readonly id: ConditionId; readonly turns: number }[];
  /** XP progress to the next level, 0–1 (own Zorlings only). */
  readonly xp?: number;
  /** 32×32 portrait for the hotbar. */
  readonly portrait?: Texture;
}

export interface HudTips {
  readonly layer: TooltipLayer;
  type(type: TypeId): TooltipContent;
  condition(id: ConditionId, turns: number): TooltipContent;
  zorling?(view: CombatantView, slot: number): TooltipContent;
}

export interface CardOptions {
  /** `ally` shows HP numbers and XP. */
  readonly side: 'foe' | 'ally';
  readonly width?: number;
  readonly tips?: HudTips;
}

export class CombatantCard extends Container {
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly hpBar: HpBar;
  private readonly nameText = uiText('name', '');
  private readonly level = uiText('number', '');
  private readonly lvLabel = uiText('label', 'Lv', paper.inkDim);
  private readonly hpNumbers = uiText('number', '');
  private readonly xpBar: XpBar | undefined;
  private readonly chips = new Container({ label: 'chips' });
  private unregister: (() => void)[] = [];
  private view: CombatantView | undefined;

  constructor(private readonly options: CardOptions) {
    super({ label: `card:${options.side}` });
    const ally = options.side === 'ally';
    const w = (this.cardWidth = options.width ?? (ally ? 162 : 150));
    this.cardHeight = ally ? 47 : 41;
    const bg = drawPaper(new Graphics(), 0, 0, w, this.cardHeight);
    const hpLabel = uiText('label', 'HP', paper.inkDim);
    hpLabel.position.set(6, 15);
    this.hpBar = new HpBar(w - 24);
    this.hpBar.position.set(18, 16);
    this.nameText.position.set(6, 2);
    this.chips.position.set(6, 25);
    this.addChild(bg, this.nameText, this.level, this.lvLabel, hpLabel, this.hpBar, this.chips);
    if (ally) {
      this.addChild(this.hpNumbers);
      const xpLabel = uiText('label', 'XP', paper.inkDim);
      xpLabel.position.set(6, 38);
      this.xpBar = new XpBar(w - 24);
      this.xpBar.position.set(18, 40);
      this.addChild(xpLabel, this.xpBar);
    }
  }

  get current(): CombatantView | undefined {
    return this.view;
  }

  /** Shows `view`; HP animates when only HP changed and `animate` is set. */
  set(view: CombatantView, animate = false): void {
    const w = this.cardWidth;
    this.view = view;
    this.nameText.text = view.name;
    this.level.text = String(view.level);
    this.level.position.set(Math.round(w - 6 - this.level.width), 3);
    this.lvLabel.position.set(Math.round(this.level.x - this.lvLabel.width - 2), 6);
    this.hpBar.set(view.maxHp > 0 ? view.hp / view.maxHp : 0, animate);
    this.hpNumbers.text = `${view.hp}/${view.maxHp}`;
    this.hpNumbers.position.set(Math.round(w - 6 - this.hpNumbers.width), 24);
    this.xpBar?.set(view.xp ?? 0);
    this.rebuildChips(view);
  }

  update(dt: number): void {
    this.hpBar.update(dt);
  }

  private rebuildChips(view: CombatantView): void {
    for (const off of this.unregister) off();
    this.unregister = [];
    for (const c of this.chips.removeChildren()) c.destroy({ children: true });
    const tips = this.options.tips;
    let x = 0;
    for (const type of view.types) {
      const badge = new TypeBadge(type);
      badge.x = x;
      x += Math.ceil(badge.width) + 3;
      this.chips.addChild(badge);
      if (tips) this.unregister.push(tips.layer.register(badge, () => tips.type(type)));
    }
    x += 2;
    for (const { id, turns } of view.conditions) {
      const chip = new ConditionChip(id, turns);
      chip.x = x;
      x += CHIP_SIZE + 2;
      this.chips.addChild(chip);
      if (tips) this.unregister.push(tips.layer.register(chip, () => tips.condition(id, turns)));
    }
  }
}

export interface HotbarSlotView {
  readonly view: CombatantView | undefined;
}

/** Team slots 1–3 with portrait, key number and a mini HP bar. */
export class Hotbar extends Container {
  static readonly SLOT_W = 36;
  static readonly SLOT_H = 56;
  static readonly GAP = 2;
  static readonly WIDTH = Hotbar.SLOT_W * 3 + Hotbar.GAP * 2;
  readonly slots: Container[] = [];
  private readonly views: (CombatantView | undefined)[] = [];
  private active = 0;
  private unregister: (() => void)[] = [];

  /** Called when a slot is clicked (mouse switching). */
  onSelect: ((slot: number) => void) | undefined;

  constructor(private readonly tips?: HudTips) {
    super({ label: 'hotbar' });
  }

  set(team: readonly (CombatantView | undefined)[], active: number): void {
    this.active = active;
    this.views.length = 0;
    this.views.push(...team);
    for (const off of this.unregister) off();
    this.unregister = [];
    for (const s of this.removeChildren()) s.destroy({ children: true });
    this.slots.length = 0;
    for (let i = 0; i < 3; i++) {
      const slot = this.buildSlot(i, team[i]);
      slot.x = i * (Hotbar.SLOT_W + Hotbar.GAP);
      this.addChild(slot);
      this.slots.push(slot);
      slot.eventMode = 'static';
      slot.cursor = 'pointer';
      slot.on('pointertap', (e) => {
        if (e.button === 0) this.onSelect?.(i);
      });
      const view = team[i];
      const tips = this.tips;
      if (view && tips?.zorling) {
        this.unregister.push(
          tips.layer.register(slot, () => tips.zorling?.(view, i) ?? { title: view.name }),
        );
      }
    }
  }

  get activeIndex(): number {
    return this.active;
  }

  private buildSlot(i: number, view: CombatantView | undefined): Container {
    const W = Hotbar.SLOT_W;
    const H = Hotbar.SLOT_H;
    const slot = new Container({ label: `slot${i + 1}` });
    const g = new Graphics();
    const active = i === this.active;
    drawPaper(g, 0, 0, W, H, active ? { fill: paper.cursor } : {});
    if (active) pixelRoundStroke(g, 0, 0, W, H, 2, paper.accent);
    drawWell(g, 2, 12, W - 4, 32);
    // Key cap.
    pixelRoundRect(g, 3, 3, 9, 8, 1, active ? paper.accent : paper.key);
    slot.addChild(g);
    const key = uiText('label', String(i + 1), paper.keyInk);
    key.position.set(Math.round(7.5 - key.width / 2), Math.round(7 - key.height / 2));
    slot.addChild(key);
    if (!view) return slot;
    const fainted = view.hp <= 0;
    if (view.portrait) {
      const p = new Sprite(view.portrait);
      p.position.set(2, 12);
      p.width = 32;
      p.height = 32;
      if (fainted) {
        p.tint = 0x9a8a7a;
        p.alpha = 0.6;
      }
      slot.addChild(p);
    }
    const lv = uiText('label', `Lv${view.level}`, paper.inkDim);
    lv.position.set(Math.round(W - 3 - lv.width), 3);
    slot.addChild(lv);
    const ratio = view.maxHp > 0 ? view.hp / view.maxHp : 0;
    const bar = new Graphics();
    bar.rect(4, 47, W - 8, 4).fill({ color: paper.track });
    const fw = Math.round((W - 10) * ratio);
    if (fw > 0) bar.rect(5, 48, fw, 2).fill({ color: hpColor(ratio) });
    slot.addChild(bar);
    return slot;
  }
}
