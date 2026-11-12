/**
 * Content → UI kit view data for the battle screen: move info with a live tip against the
 * foe, bag tabs, HUD card views (conditions, lingering effects, Armor) and tooltip text.
 * Pure (no rendering), so the wording and the tips are unit-tested.
 */

import type { TooltipContent } from '@engine/ui';
import type { GameContent, Item } from '@game/data';
import type { Bag } from '@game/inventory';
import { conditionIdOf, styleTypes, typeIdOf } from '@game/style/ids';
import {
  conditionColors,
  ink,
  semantic,
  typeColors,
  type ConditionId,
  type TypeId,
} from '@game/style/tokens';
import type { BagItem, BagTab } from '@game/ui/bag';
import type { CombatantView, PillView } from '@game/ui/battle-hud';
import type { MoveView } from '@game/ui/panels';
import type { ShownZorling } from '../present';

/** The move info panel's data, with the most useful fact against `foe` as the tip. */
export function moveViewFor(
  content: GameContent,
  moveId: string,
  foe: ShownZorling | undefined,
): MoveView {
  const move = content.moves.require(moveId);
  const type = typeIdOf(move.type) ?? 'metal';
  const applies =
    move.applyChance > 0 ? conditionIdOf(content.types.require(move.type).applies) : undefined;
  const exploits = content.reactions
    .values()
    .filter((r) => r.type === move.type)
    .flatMap((r) => {
      const c = conditionIdOf(r.condition);
      return c ? [c] : [];
    });
  const view: MoveView = {
    name: move.name,
    type,
    power: move.power,
    accuracy: move.accuracy,
    ...(applies ? { applies } : {}),
    exploits,
  };
  const tip = foe ? moveTip(content, moveId, foe) : undefined;
  return tip ? { ...view, tip } : view;
}

/** Live hint: a reaction first, then Armor, then effectiveness, then a condition warning. */
export function moveTip(
  content: GameContent,
  moveId: string,
  foe: ShownZorling,
): { text: string; good: boolean } | undefined {
  const move = content.moves.require(moveId);
  if (move.power > 0) {
    for (const s of foe.statuses) {
      if (s.origin !== 'condition') continue;
      const r = content.reactionFor(s.id, move.type);
      if (!r) continue;
      const cond = content.conditions.require(s.id).name;
      const mult = r.damageMultiplier !== 1 ? ` ×${r.damageMultiplier}` : '';
      const breaks =
        foe.boss &&
        foe.armor === 'armored' &&
        content.bosses.require(foe.boss).armor?.breaks.includes(r.id);
      return {
        text: `Foe is ${cond}: ${r.name}${mult}${breaks ? ', breaks Armor!' : ''}`,
        good: true,
      };
    }
  }
  if (foe.armor === 'armored' && move.power > 0) {
    return { text: 'Armor: plain hits deal far less', good: false };
  }
  if (move.power > 0) {
    const eff = content.effectiveness(move.type, foe.types);
    if (eff > 1) return { text: `Super effective (×${round2(eff)})`, good: true };
    if (eff < 1) return { text: `Not very effective (×${round2(eff)})`, good: false };
  }
  if (move.applyChance > 0) {
    const cond = content.types.require(move.type).applies;
    const name = content.conditions.require(cond).name;
    const foeExploits = content.reactionsOn(cond).find((r) => foe.types.includes(r.type));
    if (foeExploits) {
      return {
        text: `Careful: the foe's ${content.types.require(foeExploits.type).name} moves exploit ${name}`,
        good: false,
      };
    }
    if (move.power === 0) return { text: `Sets up ${name} for a combo`, good: true };
  }
  return undefined;
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Item look: sprite and tint (potions by strength, capture items red). */
export function itemLook(item: Item): { sprite: 'potion' | 'orb'; tint: number } {
  if (item.effect.kind === 'capture') return { sprite: 'orb', tint: 0xff5c6c };
  const amount = item.effect.amount;
  if (amount === 'full') return { sprite: 'potion', tint: 0xffc94a };
  return { sprite: 'potion', tint: amount >= 80 ? 0x5ab0ff : 0xff5c8a };
}

/** Bag tabs for the battle bag (only items it holds), potions first. */
export function bagTabsFor(content: GameContent, bag: Bag): BagTab[] {
  const entries = Object.entries(bag)
    .filter(([, n]) => n > 0)
    .map(([id, count]) => ({ item: content.items.require(id), count }));
  const toView = ({ item, count }: { item: Item; count: number }): BagItem => ({
    id: item.id,
    name: item.name,
    count,
    ...(item.bagCap !== undefined ? { cap: item.bagCap } : {}),
    ...itemLook(item),
    description: `${item.description}${item.effect.kind === 'heal' ? ' Using it costs your turn.' : ''}`,
    targeted: item.effect.kind === 'heal',
  });
  const order = (a: { item: Item }, b: { item: Item }): number => a.item.price - b.item.price;
  return [
    {
      label: 'Potions',
      items: entries
        .filter((e) => e.item.category === 'potion')
        .sort(order)
        .map(toView),
    },
    {
      label: 'Capture',
      items: entries
        .filter((e) => e.item.category === 'capture')
        .sort(order)
        .map(toView),
    },
  ];
}

/** Pill for a status without a condition icon (a reaction's lingering effect). */
function lingeringPill(content: GameContent, id: string, turns: number): PillView {
  const r = content.reactions.get(id);
  const t = r ? typeIdOf(r.type) : undefined;
  const color = t ? typeColors[t].base : 0xcccccc;
  return {
    label: r?.name ?? id,
    color,
    on: ink[950],
    turns,
    tip: {
      title: r?.name ?? id,
      body: `${r?.description ?? ''} ${turns} turn${turns === 1 ? '' : 's'} left.`.trim(),
    },
  };
}

/** Boss pills: Armor (holding or broken) and Subdued. */
function bossPills(content: GameContent, z: ShownZorling): PillView[] {
  if (!z.boss) return [];
  const boss = content.bosses.require(z.boss);
  if (z.subdued) {
    return [
      {
        label: 'Subdued',
        color: semantic.success,
        on: ink[950],
        tip: { title: 'Subdued', body: 'Defeated! Any capture item catches it now.' },
      },
    ];
  }
  if (z.armor === 'none' || !boss.armor) return [];
  const breakers = boss.armor.breaks.map((id) => content.reactions.require(id).name).join(' or ');
  return [
    z.armor === 'armored'
      ? {
          label: 'Armor',
          color: semantic.titan,
          on: ink[950],
          tip: { title: 'Armor', body: `Takes far less damage. A ${breakers} reaction breaks it.` },
        }
      : {
          label: 'Broken',
          color: semantic.danger,
          on: 0xffffff,
          tip: { title: 'Armor broken', body: 'Takes ×1.5 damage until it re-arms.' },
        },
  ];
}

/** The HUD card / hotbar view of a shown Zorling (without portrait). */
export function cardView(content: GameContent, z: ShownZorling): CombatantView {
  const conditions: { id: ConditionId; turns: number }[] = [];
  const pills: PillView[] = [];
  for (const s of z.statuses) {
    const c = s.origin === 'condition' ? conditionIdOf(s.id) : undefined;
    if (c) conditions.push({ id: c, turns: s.turns });
    else pills.push(lingeringPill(content, s.id, s.turns));
  }
  pills.push(...bossPills(content, z));
  return {
    name: z.name,
    level: z.level,
    types: styleTypes(z.types),
    hp: z.hp,
    maxHp: z.maxHp,
    conditions,
    xp: z.xp,
    ...(pills.length ? { pills } : {}),
  };
}

/** Type tooltip: what it beats and resists, and its condition. */
export function typeTip(content: GameContent, type: TypeId): TooltipContent {
  const t = content.types.values().find((x) => typeIdOf(x.id) === type);
  if (!t) return { title: typeColors[type].label };
  const names = (ids: readonly string[]): string =>
    ids.map((id) => content.types.require(id).name).join(', ') || 'nothing';
  return {
    title: `${t.name} type`,
    body: `Strong against ${names(t.strongAgainst)}. Resists ${names(t.resists)}. Its moves apply ${content.conditions.require(t.applies).name}.`,
  };
}

/** Condition tooltip: its effect and which reactions use it up. */
export function conditionTip(
  content: GameContent,
  id: ConditionId,
  turns?: number,
): TooltipContent {
  const c = content.conditions.values().find((x) => conditionIdOf(x.id) === id);
  if (!c) return { title: conditionColors[id].label };
  const reacts = content
    .reactionsOn(c.id)
    .map((r) => `${content.types.require(r.type).name} → ${r.name}`)
    .join(', ');
  const left = turns !== undefined ? ` ${turns} turn${turns === 1 ? '' : 's'} left.` : '';
  return {
    title: c.name,
    body: `${c.description}${left}${reacts ? ` Exploited by ${reacts}.` : ''}`,
  };
}
