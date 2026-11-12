/**
 * Battle AI: picks a choice for a side from `legalChoices`. Pure and deterministic: its
 * randomness is a child stream split from the battle RNG (which it does not advance), so the
 * same state always gives the same choice and the engine's own rolls are not affected.
 *
 * - `wild`: picks one of its moves at random.
 * - `trainer`: scores every move by expected damage, reactions it sets off and conditions it
 *   sets up for its team, and switches to a teammate that can exploit a condition on the foe.
 *   Against a boss it also weighs the Armor: hits on it count ×0.3, and breaking it is worth
 *   a bonus (as is setting up the condition that breaks it).
 */

import { Rng } from '@engine/core';
import type { GameContent } from '@game/data';
import { armorHit, breaksArmor, hpUnit } from './boss';
import { legalChoices, legalReplacements } from './engine';
import { ARMOR_DAMAGE_MULTIPLIER, computeDamage, DAMAGE_ROLL_MEAN, hitChance } from './rules';
import {
  activeOf,
  foe,
  type BattleState,
  type Choice,
  type Combatant,
  type SideId,
  type Status,
} from './state';
import { fumbleChance, immunityTo, statMultiplier, statusWith, typePower } from './status';

export type AiStyle = 'wild' | 'trainer';

/** Extra value (in foe max-HP fractions) for a move that should knock the foe out. */
export const AI_KO_BONUS = 0.5;
/** Value of setting up a condition a teammate (or the user) can exploit, times apply chance. */
export const AI_COMBO_SETUP = 0.3;
/** Value of a condition nobody on the team can exploit (only its side effect). */
export const AI_PLAIN_SETUP = 0.08;
/** Extra value for a reaction that leaves an effect (Frozen, Rooted, Overload, …). */
export const AI_LINGERING_BONUS = 0.15;
/** A switch is valued at the teammate's best move times this (it costs a turn and a hit). */
export const AI_SWITCH_DISCOUNT = 0.7;
/** A switch must beat the best move by this much (unless the active Zorling is Frozen, …). */
export const AI_SWITCH_MARGIN = 0.1;
/** Extra value for a hit that breaks a boss's Armor. */
export const AI_ARMOR_BREAK_BONUS = 0.25;
/** Extra value (times apply chance) for setting up a condition whose reaction breaks Armor. */
export const AI_ARMOR_SETUP_BONUS = 0.15;
/** Random noise added to each score so equal options vary. */
export const AI_NOISE = 0.03;

/** The AI's choice for `side` this turn (phase `'choose'`). */
export function aiChoice(
  content: GameContent,
  state: BattleState,
  side: SideId,
  style: AiStyle,
): Choice {
  const choices = legalChoices(content, state, side);
  const wait = choices.find((c) => c.kind === 'wait');
  if (wait) return wait; // a Subdued boss
  const rng = aiRng(state, side);
  const moves = choices.filter((c) => c.kind === 'move');
  if (moves.length === 0) throw new Error(`Side ${side} has no move to choose`);
  if (style === 'wild') return rng.pick(moves);

  const best = (kind: Choice['kind']) => {
    let top: { choice: Choice; score: number } | undefined;
    for (const choice of choices) {
      if (choice.kind !== kind) continue;
      const score = (scoreChoice(content, state, side, choice) ?? 0) + rng.float(0, AI_NOISE);
      if (!top || score > top.score) top = { choice, score };
    }
    return top;
  };
  const move = best('move');
  const swap = best('switch');
  // A Zorling that will lose its move anyway switches for free (no margin).
  const lost = statusWith(content, activeOf(state, side), 'skipTurn') !== undefined;
  const margin = lost ? 0 : AI_SWITCH_MARGIN;
  if (swap && move && swap.score > move.score + margin) return swap.choice;
  return move?.choice ?? rng.pick(moves);
}

/** The AI's replacement after a faint (phase `'replace'`): the best matchup on its bench. */
export function aiReplacement(content: GameContent, state: BattleState, side: SideId): number {
  const slots = legalReplacements(state, side);
  const first = slots[0];
  if (first === undefined) throw new Error(`Side ${side} has nothing to send in`);
  const target = activeOf(state, foe(side));
  const team = state.sides[side].team;
  let best = first;
  let bestScore = -Infinity;
  for (const slot of slots) {
    const c = team[slot];
    if (!c) continue;
    const score = bestMoveValue(content, c, target, team);
    if (score > bestScore) [best, bestScore] = [slot, score];
  }
  return best;
}

function aiRng(state: BattleState, side: SideId): Rng {
  return Rng.fromState(state.rng).split(`ai:${side}:${state.turn}`);
}

/** Score of a choice, or null for choices the trainer AI never makes (items, running). */
function scoreChoice(
  content: GameContent,
  state: BattleState,
  side: SideId,
  choice: Choice,
): number | null {
  const user = activeOf(state, side);
  const target = activeOf(state, foe(side));
  const team = state.sides[side].team;
  switch (choice.kind) {
    case 'move':
      // A Zorling that will lose its move (Frozen, Overload) gains nothing by attacking.
      if (statusWith(content, user, 'skipTurn')) return 0;
      return moveValue(content, user, target, user.moves[choice.slot] ?? '', team);
    case 'switch': {
      const mate = team[choice.to];
      if (!mate) return null;
      // Only the foe's conditions that are still there next turn count.
      const later: Combatant = { ...target, statuses: target.statuses.filter(survivesTurn) };
      return bestMoveValue(content, mate, later, team) * AI_SWITCH_DISCOUNT;
    }
    case 'item':
    case 'run':
    case 'wait':
      return null;
  }
}

/** Whether a status is still active after this turn's countdown. */
function survivesTurn(s: Status): boolean {
  return s.turnsLeft - (s.fresh ? 0 : 1) > 0;
}

function bestMoveValue(
  content: GameContent,
  user: Combatant,
  target: Combatant,
  team: readonly Combatant[],
): number {
  return Math.max(0, ...user.moves.map((m) => moveValue(content, user, target, m, team)));
}

/**
 * Expected value of a move, in fractions of the target's max HP (without a boss aura, so a
 * boss's hits weigh the same against setup and switching): damage (with the reaction
 * it would set off), a bonus for a knockout, and the worth of the condition it may apply,
 * all times the chance it lands.
 */
export function moveValue(
  content: GameContent,
  user: Combatant,
  target: Combatant,
  moveId: string,
  team: readonly Combatant[],
): number {
  const move = content.moves.require(moveId);
  const lands =
    hitChance(
      move.accuracy,
      statMultiplier(content, user, 'accuracy'),
      statMultiplier(content, target, 'evasion'),
    ) *
    (1 - fumbleChance(content, user));

  let value = 0;
  let statuses = target.statuses;
  let knocksOut = false;
  if (move.power > 0) {
    const reacting = target.statuses.find(
      (s) => s.origin === 'condition' && content.reactionFor(s.id, move.type),
    );
    const reaction = reacting && content.reactionFor(reacting.id, move.type);
    const armor = armorHit(content, target, reaction?.id);
    const damage = computeDamage({
      level: user.zorling.level,
      power: move.power,
      attack: user.stats.attack * statMultiplier(content, user, 'attack'),
      defense: target.stats.defense * statMultiplier(content, target, 'defense'),
      effectiveness: content.effectiveness(move.type, target.types),
      roll: DAMAGE_ROLL_MEAN,
      multiplier:
        (reaction?.damageMultiplier ?? 1) * typePower(content, user, move.type) * armor.multiplier,
      ignoreDefense: reaction?.ignoreDefense ?? false,
    });
    knocksOut = damage >= target.hp;
    if (armor.breaks) value += AI_ARMOR_BREAK_BONUS;
    value += Math.min(damage, target.hp) / hpUnit(target) + (knocksOut ? AI_KO_BONUS : 0);
    if (reaction?.lingering) value += AI_LINGERING_BONUS;
    if (reacting) statuses = statuses.filter((s) => s !== reacting);
  }

  if (move.applyChance > 0 && !knocksOut) {
    value += move.applyChance * setupValue(content, target, statuses, move.type, team);
  }
  return value * lands;
}

/** Worth of putting the move type's condition on the target. */
function setupValue(
  content: GameContent,
  target: Combatant,
  statuses: readonly Status[],
  moveType: string,
  team: readonly Combatant[],
): number {
  const condition = content.conditionOf(moveType).id;
  if (immunityTo(content, target, condition)) return 0;
  const has = statuses.find((s) => s.origin === 'condition' && s.id === condition);
  if (has && survivesTurn(has)) return 0; // already set up
  // Reactions a living teammate (or the user) could set off on this condition.
  const usable = team.flatMap((c) =>
    c.hp > 0
      ? c.moves.flatMap((m) => {
          const mv = content.moves.require(m);
          const r = mv.power > 0 ? content.reactionFor(condition, mv.type) : undefined;
          return r ? [r.id] : [];
        })
      : [],
  );
  if (usable.length === 0) return AI_PLAIN_SETUP;
  if (target.boss?.armor !== 'armored') return AI_COMBO_SETUP;
  // Against Armor only a breaking reaction pays off in full.
  if (usable.some((r) => breaksArmor(content, target, r))) {
    return AI_COMBO_SETUP + AI_ARMOR_SETUP_BONUS;
  }
  return AI_COMBO_SETUP * ARMOR_DAMAGE_MULTIPLIER;
}
