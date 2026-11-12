/**
 * What the battle screen currently shows. The engine hands over the state after a whole turn
 * plus the events that led there; the scene plays the events one by one, and this mirror
 * follows along so the HUD always matches what the player has seen so far. Pure.
 */

import type { GameContent } from '@game/data';
import { displayName } from '@game/progression';
import type {
  ArmorState,
  BattleEvent,
  BattleKind,
  BattleState,
  Combatant,
  SideId,
  StatusOrigin,
} from '../logic';

export interface ShownStatus {
  readonly id: string;
  readonly origin: StatusOrigin;
  readonly turns: number;
}

export interface ShownZorling {
  readonly name: string;
  readonly species: string;
  readonly level: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly types: readonly string[];
  readonly moves: readonly string[];
  readonly statuses: readonly ShownStatus[];
  /** Boss entry id, or null. */
  readonly boss: string | null;
  readonly armor: ArmorState;
  readonly subdued: boolean;
  readonly titanMark: boolean;
  /** 0–1 progress to the next level (from the Zorling's XP). */
  readonly xp: number;
}

export interface ShownSide {
  readonly active: number;
  /** Whether the active Zorling is out (false before the first send-out and after a faint). */
  readonly onField: boolean;
  readonly team: readonly ShownZorling[];
}

export interface Shown {
  readonly kind: BattleKind;
  readonly sides: readonly [ShownSide, ShownSide];
}

/** XP progress within the current level, 0–1. */
export type XpProgress = (c: Combatant) => number;

function shownZorling(content: GameContent, c: Combatant, xp: XpProgress): ShownZorling {
  return {
    name: c.boss ? content.bosses.require(c.boss.id).name : displayName(content, c.zorling),
    species: c.zorling.species,
    level: c.zorling.level,
    hp: c.hp,
    maxHp: c.stats.hp,
    types: c.types,
    moves: c.moves,
    statuses: c.statuses.map((s) => ({ id: s.id, origin: s.origin, turns: s.turnsLeft })),
    boss: c.boss?.id ?? null,
    armor: c.boss?.armor ?? 'none',
    subdued: c.boss?.subdued ?? false,
    titanMark: c.zorling.titanMark,
    xp: xp(c),
  };
}

/**
 * The screen for a state. `beforeStart`: nobody is out yet and nobody has statuses (the
 * state `createBattle` returns already holds the weather conditions its events announce).
 */
export function shownFrom(
  content: GameContent,
  state: BattleState,
  xp: XpProgress = () => 0,
  beforeStart = false,
): Shown {
  const side = (id: SideId): ShownSide => {
    const s = state.sides[id];
    return {
      active: s.active,
      onField: !beforeStart && (s.team[s.active]?.hp ?? 0) > 0,
      team: s.team.map((c) => {
        const z = shownZorling(content, c, xp);
        return beforeStart ? { ...z, statuses: [] } : z;
      }),
    };
  };
  return { kind: state.kind, sides: [side(0), side(1)] };
}

/** The Zorling a side shows on the field (or last showed). */
export function shownActive(shown: Shown, side: SideId): ShownZorling {
  const s = shown.sides[side];
  const z = s.team[s.active];
  if (!z) throw new Error(`Side ${side} shows no Zorling in slot ${s.active}`);
  return z;
}

function withSide(shown: Shown, side: SideId, f: (s: ShownSide) => ShownSide): Shown {
  const sides: [ShownSide, ShownSide] = [shown.sides[0], shown.sides[1]];
  sides[side] = f(shown.sides[side]);
  return { ...shown, sides };
}

function withZorling(
  shown: Shown,
  side: SideId,
  slot: number,
  f: (z: ShownZorling) => ShownZorling,
): Shown {
  return withSide(shown, side, (s) => ({
    ...s,
    team: s.team.map((z, i) => (i === slot ? f(z) : z)),
  }));
}

const withActive = (shown: Shown, side: SideId, f: (z: ShownZorling) => ShownZorling): Shown =>
  withZorling(shown, side, shown.sides[side].active, f);

/** The screen after one event. */
export function applyShown(content: GameContent, shown: Shown, e: BattleEvent): Shown {
  switch (e.kind) {
    case 'sendOut':
      return withSide(shown, e.side, (s) => ({ ...s, active: e.slot, onField: true }));
    case 'switchOut':
      // Switching out clears the Zorling's statuses (no separate event).
      return withZorling(
        withSide(shown, e.side, (s) => ({ ...s, onField: false })),
        e.side,
        e.slot,
        (z) => ({ ...z, statuses: [] }),
      );
    case 'damage':
    case 'statusDamage':
      return withActive(shown, e.side, (z) => ({ ...z, hp: e.hp }));
    case 'heal':
      return withZorling(shown, e.side, e.slot, (z) => ({ ...z, hp: e.hp }));
    case 'fainted':
      return withSide(
        withZorling(shown, e.side, e.slot, (z) => ({ ...z, hp: 0, statuses: [] })),
        e.side,
        (s) => ({ ...s, onField: false }),
      );
    case 'subdued':
      return withZorling(shown, e.side, e.slot, (z) => ({
        ...z,
        hp: 0,
        statuses: [],
        subdued: true,
        armor: 'none',
      }));
    case 'armorBroken':
      return withActive(shown, e.side, (z) => ({ ...z, armor: 'broken' }));
    case 'armorRestored':
      return withActive(shown, e.side, (z) => ({ ...z, armor: 'armored' }));
    case 'conditionApplied':
      return withActive(shown, e.side, (z) => ({
        ...z,
        statuses: [
          ...z.statuses.filter((s) => s.id !== e.condition),
          { id: e.condition, origin: 'condition', turns: e.turns },
        ],
      }));
    case 'reaction': {
      const lingering = content.reactions.require(e.reaction).lingering;
      return withActive(shown, e.side, (z) => ({
        ...z,
        statuses: [
          ...z.statuses.filter((s) => s.id !== e.condition && s.id !== e.reaction),
          ...(lingering
            ? [{ id: e.reaction, origin: 'reaction' as const, turns: lingering.turns }]
            : []),
        ],
      }));
    }
    case 'statusEnded':
      return withActive(shown, e.side, (z) => ({
        ...z,
        statuses: z.statuses.filter((s) => s.id !== e.status),
      }));
    default:
      return shown;
  }
}

/**
 * Takes the status countdowns from the state after the turn (the engine counts them down at
 * the end of each turn without an event per countdown).
 */
export function syncStatuses(shown: Shown, state: BattleState): Shown {
  const sides = shown.sides.map((s, side) => ({
    ...s,
    team: s.team.map((z, slot) => {
      const c = state.sides[side as SideId].team[slot];
      return c
        ? {
            ...z,
            statuses: c.statuses.map((st) => ({
              id: st.id,
              origin: st.origin,
              turns: st.turnsLeft,
            })),
          }
        : z;
    }),
  })) as unknown as [ShownSide, ShownSide];
  return { ...shown, sides };
}
