/**
 * What statuses and traits mean in battle: stat multipliers, trapping, skipped turns, fumbles,
 * immunities and type power. Pure lookups over the content; nothing here changes state.
 */

import type { GameContent, ModifiableStat, StatusEffect, TraitEffect } from '@game/data';
import type { Combatant, Status } from './state';

/** The effects a status has while active. */
export function statusEffects(content: GameContent, status: Status): readonly StatusEffect[] {
  if (status.origin === 'condition') return content.conditions.require(status.id).effects;
  return content.reactions.require(status.id).lingering?.effects ?? [];
}

function effectsOf(content: GameContent, c: Combatant): StatusEffect[] {
  return c.statuses.flatMap((s) => statusEffects(content, s));
}

/** The first status with an effect of `kind`, if any. */
export function statusWith(
  content: GameContent,
  c: Combatant,
  kind: StatusEffect['kind'],
): Status | undefined {
  return c.statuses.find((s) => statusEffects(content, s).some((e) => e.kind === kind));
}

/** Product of every active multiplier on a stat (1 = unchanged). */
export function statMultiplier(content: GameContent, c: Combatant, stat: ModifiableStat): number {
  let m = 1;
  for (const e of effectsOf(content, c))
    if (e.kind === 'stat' && e.stat === stat) m *= e.multiplier;
  return m;
}

/** Speed after statuses, used for turn order and running. */
export function effectiveSpeed(content: GameContent, c: Combatant): number {
  return c.stats.speed * statMultiplier(content, c, 'speed');
}

/** Chance (0–1) that a chosen move fails; several fumble effects combine. */
export function fumbleChance(content: GameContent, c: Combatant): number {
  let keep = 1;
  for (const e of effectsOf(content, c)) if (e.kind === 'fumble') keep *= 1 - e.chance;
  return 1 - keep;
}

/** Whether the Zorling cannot switch out. */
export function isTrapped(content: GameContent, c: Combatant): boolean {
  return statusWith(content, c, 'trapped') !== undefined;
}

/** The trait effects of a Zorling's species (none without a trait). */
export function traitEffects(content: GameContent, c: Combatant): readonly TraitEffect[] {
  const trait = content.species.require(c.zorling.species).trait;
  return trait ? content.traits.require(trait).effects : [];
}

/** The trait that keeps a condition off this Zorling, if any. */
export function immunityTo(content: GameContent, c: Combatant, condition: string): string | null {
  const trait = content.species.require(c.zorling.species).trait;
  if (!trait) return null;
  const immune = content.traits
    .require(trait)
    .effects.some((e) => e.kind === 'conditionImmunity' && e.condition === condition);
  return immune ? trait : null;
}

/** Damage multiplier from the user's trait for a move type (e.g. Kindling: Fire ×1.2). */
export function typePower(content: GameContent, c: Combatant, moveType: string): number {
  let m = 1;
  for (const e of traitEffects(content, c)) {
    if (e.kind === 'typePower' && e.type === moveType) m *= e.multiplier;
  }
  return m;
}

/** Extra turns conditions applied by this Zorling last (trait `conditionTurns`). */
export function conditionTurnBonus(content: GameContent, c: Combatant): number {
  let n = 0;
  for (const e of traitEffects(content, c)) if (e.kind === 'conditionTurns') n += e.turns;
  return n;
}
