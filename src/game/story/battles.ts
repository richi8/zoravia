/**
 * Story battles (C27): turns a dialogue node's `battle` into a battle setup for the current
 * party. Pure.
 *
 * - **Trainer**: the team for the badges held, scaled by `perBadge` for every badge above
 *   that team's own threshold (story boss scaling), plus `rematch.levels` once beaten. A
 *   member with `boss` fights in boss form. Trainer battles can't be run from.
 * - **Boss**: not done yet → a wild boss battle (Subdued, then caught; one per save). Done
 *   and the boss has a `rematch` → a boss battle `rematch.levels` higher that it faints in
 *   (no catch). Done without a rematch → no battle.
 * - Prize: first win the prize, first rematch win the rematch prize, then nothing.
 */

import { bossZorling, type BattleSetup } from '@game/battle/logic';
import { trainerTeam, type GameContent, type TrainerMember } from '@game/data';
import {
  bossDone,
  bossRematches,
  trainerWins,
  winPrize,
  type ApplyOptions,
  type Party,
} from '@game/player';
import { createZorling, LEVEL_LIMIT, type Zorling } from '@game/progression';
import { holds } from './conditions';

export interface StoryBattle {
  readonly setup: BattleSetup;
  /** Name for battle text ("Rival Mira sent out …"); for a boss rematch, the boss's name. */
  readonly trainer?: string;
  /** Money a win pays. */
  readonly prize: number;
  /** What `applyBattleResult` should log (prize included). */
  readonly apply: ApplyOptions;
  /** A rematch of a trainer or boss already beaten. */
  readonly rematch: boolean;
}

/** Who a story battle is against (a dialogue node's `battle`). */
export type BattleRef = { readonly trainer: string } | { readonly boss: string };

/** Levels story bosses gain per badge held: the trainer's `perBadge` (DESIGN: ~+4). */
export function scaledLevel(base: number, extra: number): number {
  return Math.max(1, Math.min(LEVEL_LIMIT, base + extra));
}

/**
 * The battle a dialogue node starts, for this party, or undefined when there is none (a
 * boss already done that has no rematch).
 */
export function storyBattle(
  content: GameContent,
  party: Party,
  battle: BattleRef,
  seed: number,
): StoryBattle | undefined {
  return 'trainer' in battle
    ? trainerBattle(content, party, battle.trainer, seed)
    : bossBattle(content, party, battle.boss, seed);
}

export function trainerBattle(
  content: GameContent,
  party: Party,
  id: string,
  seed: number,
): StoryBattle {
  const t = content.trainers.require(id);
  const held = party.badges.length;
  const team = trainerTeam(t, held);
  const wins = trainerWins(party.trainers, id);
  const rematch = wins > 0;
  const extra =
    t.perBadge * Math.max(0, held - team.badges) + (rematch ? (t.rematch?.levels ?? 0) : 0);
  let boss: BattleSetup['boss'];
  const opponent = team.team.map((m, i) => {
    if (m.boss) boss = { id: m.boss, slot: i };
    const base = m.instead?.find((x) => holds(content, party, x.if))?.level ?? m.level;
    return member(content, party, m, `trainer-${id}-${i}`, scaledLevel(base, extra));
  });
  const prize = winPrize(wins, t.prize, t.rematch);
  return {
    setup: {
      kind: 'trainer',
      seed,
      player: party.team,
      opponent,
      bag: party.bag,
      ...(boss ? { boss } : {}),
    },
    trainer: t.name,
    prize,
    apply: {
      opponents: opponent.map((z) => z.species),
      prize,
      trainer: id,
    },
    rematch,
  };
}

/**
 * A trainer's Zorling. A boss member is not logged in the boss log: beating a story boss's
 * Titan in a trainer battle does not count as beating the wild Titan (one per save).
 */
function member(
  content: GameContent,
  party: Party,
  m: TrainerMember,
  uid: string,
  level: number,
): Zorling {
  if (m.boss) {
    const z = bossZorling(content, m.boss, { uid, level });
    return m.moves ? { ...z, moves: [...m.moves] } : z;
  }
  const alt = m.instead?.find((x) => holds(content, party, x.if));
  const z = createZorling(content, { uid, species: alt?.species ?? m.species, level });
  return m.moves && !alt ? { ...z, moves: [...m.moves] } : z;
}

export function bossBattle(
  content: GameContent,
  party: Party,
  id: string,
  seed: number,
): StoryBattle | undefined {
  const boss = content.bosses.require(id);
  const done = bossDone(party.bosses, id);
  if (done && !boss.rematch) return undefined;
  const level = done ? scaledLevel(boss.level, boss.rematch?.levels ?? 0) : boss.level;
  const opponent = [bossZorling(content, id, { uid: `boss-${id}`, level })];
  const setup: BattleSetup = {
    kind: done ? 'trainer' : 'wild',
    seed,
    player: party.team,
    opponent,
    bag: party.bag,
    boss: { id },
  };
  const prize = done ? winPrize(1 + bossRematches(party.bosses, id), 0, boss.rematch) : 0;
  return {
    setup,
    ...(done ? { trainer: boss.name } : {}),
    prize,
    apply: {
      opponents: [boss.species],
      prize,
      boss: id,
      ...(done ? { rematch: true } : {}),
    },
    rematch: done,
  };
}
