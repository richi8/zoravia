/**
 * Boss simulation: plays whole boss battles with a scripted player, for tests and balance
 * reports (C31). Pure and deterministic like the engine.
 */

import type { GameContent } from '@game/data';
import type { Bag } from '@game/inventory';
import type { Zorling } from '@game/progression';
import { aiChoice, aiReplacement } from './ai';
import { armorHit, bossZorling } from './boss';
import { createBattle, legalChoices, legalReplacements, step } from './engine';
import { DAMAGE_ROLL_MEAN, computeDamage, hitChance } from './rules';
import {
  activeOf,
  needsReplacement,
  OPPONENT,
  PLAYER,
  type BattleOutcome,
  type BattleState,
  type Choice,
} from './state';
import { typePower } from './status';

/**
 * How the simulated player fights:
 * - `reactions`: the trainer AI (sets up conditions, switches in to react, breaks Armor).
 * - `brute`: always the hardest-hitting move on its own (ignores conditions and reactions),
 *   never switches by choice.
 * Both drink `potion` on the active Zorling below `potionBelow` of max HP while any is left.
 */
export interface SimPolicy {
  readonly style: 'reactions' | 'brute';
  readonly potion?: string;
  readonly potionBelow?: number;
}

export interface BossSimSetup {
  readonly boss: string;
  readonly level?: number;
  readonly team: readonly Zorling[];
  readonly bag: Bag;
  readonly policy: SimPolicy;
  readonly seed: number;
  /** Battle weather of the lair's zone (C34: an ash storm sets both Zorlings Burning). */
  readonly weather?: readonly string[];
  /** Safety stop. */
  readonly maxTurns?: number;
}

export interface BossSimResult {
  readonly outcome: BattleOutcome | 'timeout';
  readonly turns: number;
  readonly potionsUsed: number;
  readonly armorBreaks: number;
  readonly reactions: number;
  /** The boss's HP left at the end, as a fraction of its max HP. */
  readonly bossHpLeft: number;
}

/** Plays one boss battle (wild, the boss alone) to the end. */
export function simulateBoss(content: GameContent, setup: BossSimSetup): BossSimResult {
  const boss = bossZorling(content, setup.boss, {
    uid: 'boss',
    ...(setup.level === undefined ? {} : { level: setup.level }),
  });
  let { state } = createBattle(content, {
    kind: 'wild',
    seed: setup.seed,
    player: setup.team,
    opponent: [boss],
    bag: setup.bag,
    boss: { id: setup.boss },
    ...(setup.weather ? { weather: setup.weather } : {}),
  });
  let potionsUsed = 0;
  let armorBreaks = 0;
  let reactions = 0;
  const maxTurns = setup.maxTurns ?? 200;
  while (state.phase !== 'ended' && state.turn <= maxTurns) {
    if (state.phase === 'replace') {
      const side = needsReplacement(state, PLAYER) ? PLAYER : OPPONENT;
      const to =
        side === PLAYER
          ? aiReplacement(content, state, PLAYER)
          : (legalReplacements(state, OPPONENT)[0] ?? 0);
      state = step(content, state, { kind: 'replace', side, to }).state;
      continue;
    }
    const player = playerChoice(content, state, setup.policy);
    if (player.kind === 'item' && player.target !== undefined) potionsUsed++;
    const opponent = aiChoice(content, state, OPPONENT, 'trainer');
    const r = step(content, state, { kind: 'turn', player, opponent });
    for (const e of r.events) {
      if (e.kind === 'armorBroken') armorBreaks++;
      if (e.kind === 'reaction' && e.side === OPPONENT) reactions++;
    }
    state = r.state;
  }
  return {
    outcome: state.outcome ?? 'timeout',
    turns: state.turn - 1,
    potionsUsed,
    armorBreaks,
    reactions,
    bossHpLeft: activeOf(state, OPPONENT).hp / activeOf(state, OPPONENT).stats.hp,
  };
}

function playerChoice(content: GameContent, state: BattleState, policy: SimPolicy): Choice {
  const legal = legalChoices(content, state, PLAYER);
  const capture = legal.find((c) => c.kind === 'item' && c.target === undefined);
  if (capture && activeOf(state, OPPONENT).boss?.subdued) return capture;
  const active = activeOf(state, PLAYER);
  const below = policy.potionBelow ?? 0.4;
  if (policy.potion && active.hp < active.stats.hp * below) {
    const slot = state.sides[PLAYER].active;
    const potion = legal.find(
      (c) => c.kind === 'item' && c.item === policy.potion && c.target === slot,
    );
    if (potion) return potion;
  }
  if (policy.style === 'reactions') return aiChoice(content, state, PLAYER, 'trainer');
  return bruteMove(content, state, legal);
}

/** The move with the highest expected damage on its own (no reactions, no setup). */
function bruteMove(content: GameContent, state: BattleState, legal: readonly Choice[]): Choice {
  const user = activeOf(state, PLAYER);
  const target = activeOf(state, OPPONENT);
  let best: Choice | undefined;
  let bestValue = -1;
  for (const c of legal) {
    if (c.kind !== 'move') continue;
    const move = content.moves.require(user.moves[c.slot] ?? '');
    const damage = computeDamage({
      level: user.zorling.level,
      power: move.power,
      attack: user.stats.attack,
      defense: target.stats.defense,
      effectiveness: content.effectiveness(move.type, target.types),
      roll: DAMAGE_ROLL_MEAN,
      multiplier: typePower(content, user, move.type) * armorHit(content, target).multiplier,
    });
    const value = move.power > 0 ? damage * hitChance(move.accuracy) : 0;
    if (value > bestValue) [best, bestValue] = [c, value];
  }
  if (!best) throw new Error('No move to choose');
  return best;
}
