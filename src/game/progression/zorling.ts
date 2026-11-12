/**
 * Zorling instances: one owned (or wild) Zorling with a level, XP, current HP, up to 3 moves,
 * an optional nickname and an optional Titan mark. All functions are pure: they return a new
 * instance plus events describing what happened, for the UI to show in order.
 */

import { ref, type BaseStats, type Species } from '@game/data';
import type { GameContent } from '@game/data';
import { z } from 'zod';
import {
  LEVEL_LIMIT,
  OVER_CAP_XP_MULTIPLIER,
  levelCap,
  levelForXp,
  statsAt,
  xpForLevel,
} from './rules';

/** Move slots per Zorling (DESIGN.md "Creatures"). */
export const MOVE_SLOTS = 3;
export const NICKNAME_MAX = 12;

export const zorlingSchema = z
  .strictObject({
    /** Unique per save; given by whoever creates the Zorling (save/storage). */
    uid: z.string().min(1).max(64),
    species: ref,
    nickname: z.string().min(1).max(NICKNAME_MAX).optional(),
    level: z.number().int().min(1).max(LEVEL_LIMIT),
    /** Total XP earned, not XP into the current level. */
    xp: z.number().int().min(0).max(xpForLevel(LEVEL_LIMIT)),
    /** Current HP. 0 = fainted. */
    hp: z.number().int().min(0),
    moves: z.array(ref).min(1).max(MOVE_SLOTS),
    titanMark: z.boolean().default(false),
  })
  .refine((z) => levelForXp(z.xp) === z.level, { message: 'Level does not match XP' });

export type Zorling = Readonly<Omit<z.output<typeof zorlingSchema>, 'moves'>> & {
  readonly moves: readonly string[];
};

export type ProgressEvent =
  | { readonly kind: 'xp'; readonly amount: number; readonly reduced: boolean }
  | { readonly kind: 'levelUp'; readonly level: number }
  | { readonly kind: 'learned'; readonly move: string; readonly replaced?: string }
  /** All slots are full: the player picks a move to replace, or skips (`learnMove`). */
  | { readonly kind: 'moveOffer'; readonly move: string }
  | { readonly kind: 'canEvolve'; readonly into: string }
  | { readonly kind: 'evolved'; readonly from: string; readonly into: string };

export interface ProgressResult {
  readonly zorling: Zorling;
  readonly events: readonly ProgressEvent[];
}

export interface CreateOptions {
  readonly uid: string;
  readonly species: string;
  readonly level: number;
  readonly nickname?: string;
  readonly titanMark?: boolean;
}

/** A new Zorling at full HP that knows the last (up to 3) moves its learnset gives by `level`. */
export function createZorling(content: GameContent, opts: CreateOptions): Zorling {
  const species = content.species.require(opts.species);
  if (!Number.isInteger(opts.level) || opts.level < 1 || opts.level > LEVEL_LIMIT) {
    throw new Error(`Level must be 1–${LEVEL_LIMIT}, got ${opts.level}`);
  }
  const known = species.learnset.filter((l) => l.level <= opts.level).map((l) => l.move);
  const base: Zorling = {
    uid: opts.uid,
    species: species.id,
    level: opts.level,
    xp: xpForLevel(opts.level),
    hp: 0,
    moves: known.slice(-MOVE_SLOTS),
    titanMark: opts.titanMark ?? false,
  };
  const z = opts.nickname === undefined ? base : setNickname(base, opts.nickname);
  return { ...z, hp: statsOf(content, z).hp };
}

/** Current battle stats (HP here is max HP). */
export function statsOf(content: GameContent, z: Zorling): BaseStats {
  return statsAt(content.species.require(z.species).baseStats, z.level, z.titanMark);
}

/** Nickname if set, otherwise the species name. */
export function displayName(content: GameContent, z: Zorling): string {
  return z.nickname ?? content.species.require(z.species).name;
}

/**
 * Cleans a nickname: trims and collapses spaces. Empty means "no nickname". Throws if it is
 * longer than `NICKNAME_MAX` or contains control characters.
 */
export function normalizeNickname(raw: string): string | undefined {
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) throw new Error('Nickname has control characters');
  const name = raw.trim().replace(/\s+/g, ' ');
  if ([...name].length > NICKNAME_MAX) {
    throw new Error(`Nickname is longer than ${NICKNAME_MAX} characters`);
  }
  return name || undefined;
}

/** Sets or clears (empty string) the nickname. */
export function setNickname(z: Zorling, raw: string): Zorling {
  const nickname = normalizeNickname(raw);
  const { nickname: _old, ...rest } = z;
  return nickname === undefined ? rest : { ...rest, nickname };
}

/** Whether it has reached its evolution level. */
export function canEvolve(content: GameContent, z: Zorling): boolean {
  const evo = content.species.require(z.species).evolution;
  return evo !== undefined && z.level >= evo.level;
}

/**
 * Adds XP. Below the soft cap XP counts in full; the part at or above it is multiplied by
 * `OVER_CAP_XP_MULTIPLIER`. Each level gained may teach moves (or offer them when all slots
 * are full). Max HP gained is added to current HP, unless fainted.
 */
export function gainXp(
  content: GameContent,
  z: Zorling,
  amount: number,
  opts: { readonly badges: number },
): ProgressResult {
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`Bad XP amount ${amount}`);
  const capXp = xpForLevel(levelCap(opts.badges));
  const full = Math.max(0, Math.min(Math.floor(amount), capXp - z.xp));
  const reducedPart = Math.floor((Math.floor(amount) - full) * OVER_CAP_XP_MULTIPLIER);
  const xp = Math.min(z.xp + full + reducedPart, xpForLevel(LEVEL_LIMIT));

  const events: ProgressEvent[] = [
    { kind: 'xp', amount: xp - z.xp, reduced: Math.floor(amount) > full },
  ];
  const species = content.species.require(z.species);
  const level = levelForXp(xp);
  let cur: Zorling = { ...z, xp };
  for (let l = z.level + 1; l <= level; l++) {
    cur = withLevel(content, cur, l);
    events.push({ kind: 'levelUp', level: l });
    cur = teachAt(species, l, cur, events);
  }
  if (level > z.level && species.evolution && canEvolve(content, cur)) {
    events.push({ kind: 'canEvolve', into: species.evolution.into });
  }
  return { zorling: cur, events };
}

/**
 * Gives each team member that has not fainted the full XP (team-wide shared XP).
 * Returns the new team and each member's events, in team order.
 */
export function shareXp(
  content: GameContent,
  team: readonly Zorling[],
  amount: number,
  opts: { readonly badges: number },
): { readonly team: readonly Zorling[]; readonly events: readonly (readonly ProgressEvent[])[] } {
  const results = team.map((z) =>
    z.hp > 0 ? gainXp(content, z, amount, opts) : { zorling: z, events: [] },
  );
  return { team: results.map((r) => r.zorling), events: results.map((r) => r.events) };
}

/**
 * Learns a move: into a free slot, over `replaceSlot`, or skipped when `replaceSlot` is
 * `null` (the "replace or skip" choice after a `moveOffer`).
 */
export function learnMove(
  content: GameContent,
  z: Zorling,
  move: string,
  replaceSlot: number | null,
): ProgressResult {
  content.moves.require(move);
  if (z.moves.includes(move)) throw new Error(`Already knows "${move}"`);
  if (replaceSlot === null) return { zorling: z, events: [] };
  if (z.moves.length < MOVE_SLOTS) {
    return { zorling: { ...z, moves: [...z.moves, move] }, events: [{ kind: 'learned', move }] };
  }
  const replaced = z.moves[replaceSlot];
  if (replaced === undefined) throw new Error(`No move slot ${replaceSlot}`);
  const moves = z.moves.map((m, i) => (i === replaceSlot ? move : m));
  return { zorling: { ...z, moves }, events: [{ kind: 'learned', move, replaced }] };
}

/** Learnset moves up to its level that it does not know (for the move relearner). */
export function relearnableMoves(content: GameContent, z: Zorling): string[] {
  const species = content.species.require(z.species);
  const moves = species.learnset.filter((l) => l.level <= z.level).map((l) => l.move);
  return [...new Set(moves)].filter((m) => !z.moves.includes(m));
}

/**
 * Evolves into the next stage (call after `canEvolve`; the player may also wait). Keeps level,
 * XP, moves, nickname and Titan mark; max HP gained is added to current HP. Moves the new
 * species learns at exactly the current level are taught or offered.
 */
export function evolve(content: GameContent, z: Zorling): ProgressResult {
  const from = content.species.require(z.species);
  if (!from.evolution || !canEvolve(content, z)) {
    throw new Error(`"${z.species}" cannot evolve at level ${z.level}`);
  }
  const into = content.species.require(from.evolution.into);
  const oldMax = statsOf(content, z).hp;
  let cur: Zorling = { ...z, species: into.id };
  cur = { ...cur, hp: z.hp > 0 ? z.hp + statsOf(content, cur).hp - oldMax : 0 };
  const events: ProgressEvent[] = [{ kind: 'evolved', from: from.id, into: into.id }];
  cur = teachAt(into, z.level, cur, events);
  return { zorling: cur, events };
}

/** Same Zorling at a new level, with max HP gained added to current HP. */
function withLevel(content: GameContent, z: Zorling, level: number): Zorling {
  const oldMax = statsOf(content, z).hp;
  const next = { ...z, level };
  return { ...next, hp: z.hp > 0 ? z.hp + statsOf(content, next).hp - oldMax : 0 };
}

/** Teaches (free slot) or offers (full) the moves `species` learns at `level`. */
function teachAt(species: Species, level: number, z: Zorling, events: ProgressEvent[]): Zorling {
  let cur = z;
  for (const { move } of species.learnset.filter((l) => l.level === level)) {
    if (cur.moves.includes(move)) continue;
    if (cur.moves.length < MOVE_SLOTS) {
      cur = { ...cur, moves: [...cur.moves, move] };
      events.push({ kind: 'learned', move });
    } else {
      events.push({ kind: 'moveOffer', move });
    }
  }
  return cur;
}
