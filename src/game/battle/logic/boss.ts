/**
 * Boss rules (DESIGN.md "Bosses"): the boss aura (more HP, an extra signature move, Armor),
 * the Armor cycle (×0.3 until the right reaction breaks it, ×1.5 for 2 turns, then it
 * re-arms), and the captured form (aura gone, Titan mark, keeps its signature move).
 * Pure lookups and builders; the engine does the state changes.
 */

import type { Boss, GameContent } from '@game/data';
import { createZorling, MOVE_SLOTS, type Zorling } from '@game/progression';
import { ARMOR_BROKEN_MULTIPLIER, ARMOR_DAMAGE_MULTIPLIER } from './rules';
import type { Combatant } from './state';

/** A boss's Zorling in its normal form (full HP, no aura yet) at its level or `level`. */
export function bossZorling(
  content: GameContent,
  bossId: string,
  opts: { readonly uid: string; readonly level?: number },
): Zorling {
  const boss = content.bosses.require(bossId);
  return createZorling(content, {
    uid: opts.uid,
    species: boss.species,
    level: opts.level ?? boss.level,
  });
}

/** Moves with the signature move added, keeping at most `max` (the oldest go first). */
export function withSignature(moves: readonly string[], signature: string, max: number): string[] {
  if (moves.includes(signature)) return [...moves];
  return [...moves, signature].slice(-max);
}

/** The boss entry of a combatant, if it fights in boss form. */
export function bossOf(content: GameContent, c: Combatant): Boss | undefined {
  return c.boss ? content.bosses.require(c.boss.id) : undefined;
}

/**
 * Max HP without the boss aura (the normal max HP for other Zorlings). Status HP loss and the
 * AI's damage values are measured in it, so the aura does not change their size.
 */
export function hpUnit(c: Combatant): number {
  return c.boss?.baseHp ?? c.stats.hp;
}

/** Whether a combatant is a boss that has been defeated and waits to be caught. */
export function isSubdued(c: Combatant): boolean {
  return c.boss?.subdued === true;
}

export interface ArmorHit {
  /** Damage multiplier from the target's Armor (1 without Armor). */
  readonly multiplier: number;
  /** The hit's reaction breaks the Armor. */
  readonly breaks: boolean;
}

/**
 * What a hit setting off `reaction` (or none) does against the target's Armor: armored ×0.3,
 * broken ×1.5. A breaking reaction shatters the Armor before the hit lands, so that hit
 * already counts ×1.5.
 */
export function armorHit(content: GameContent, target: Combatant, reaction?: string): ArmorHit {
  const armor = target.boss?.armor ?? 'none';
  if (armor === 'broken') return { multiplier: ARMOR_BROKEN_MULTIPLIER, breaks: false };
  if (armor !== 'armored') return { multiplier: 1, breaks: false };
  if (reaction !== undefined && breaksArmor(content, target, reaction)) {
    return { multiplier: ARMOR_BROKEN_MULTIPLIER, breaks: true };
  }
  return { multiplier: ARMOR_DAMAGE_MULTIPLIER, breaks: false };
}

/** Whether `reaction` is one that breaks the target's Armor (armored or not). */
export function breaksArmor(content: GameContent, target: Combatant, reaction: string): boolean {
  return bossOf(content, target)?.armor?.breaks.some((r) => r === reaction) ?? false;
}

/**
 * The Zorling a caught boss becomes: the aura is gone (normal HP and moves), a Titan keeps a
 * Titan mark, and it keeps its signature move. It comes with 1 HP (it was Subdued).
 */
export function capturedForm(content: GameContent, c: Combatant): Zorling {
  const boss = bossOf(content, c);
  if (!boss) return { ...c.zorling, hp: c.hp };
  return {
    ...c.zorling,
    titanMark: c.zorling.titanMark || boss.kind === 'titan',
    moves: withSignature(c.zorling.moves, boss.signatureMove, MOVE_SLOTS),
    hp: 1,
  };
}
