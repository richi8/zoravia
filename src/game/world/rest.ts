/**
 * Resting at a campfire (C40, DESIGN.md → Team): every team Zorling still standing heals to
 * full HP; fainted ones stay fainted. Resting costs time: the day clock moves on
 * `REST.hours` and the nearby wild Zorlings respawn (the scene clears them). The fire then
 * burns down to embers and catches again `REST.cooldown` seconds later. A fire is not a respawn point,
 * storage or move relearner. Pure.
 */

import type { GameContent } from '@game/data';
import { healed, type Party } from '@game/player';
import { DAY_LENGTH } from './lighting';

export const REST = {
  /** In-game hours the clock moves on while resting. */
  hours: 6,
  /** Seconds of play before a fire burns again after a rest (C40: 10 min, user pick). */
  cooldown: 10 * 60,
} as const;

/** Day-clock seconds one rest takes. */
export const REST_SECONDS = (DAY_LENGTH * REST.hours) / 24;

/** The camp state a save keeps. */
export interface CampState {
  /** Seconds the day clock runs ahead of the play time (rests move it on). */
  readonly clock: number;
  /** Fire key → play time when the player last rested there (`fireKey`). */
  readonly fires: Readonly<Record<string, number>>;
}

export const NO_CAMP: CampState = { clock: 0, fires: {} };

/**
 * A fire's key: its region map and its tile counted from the map's `origin` (the region's
 * first shipped tile), so the key stays the same when the map grows north or west (C36).
 */
export function fireKey(
  map: string,
  x: number,
  y: number,
  origin: readonly [number, number],
): string {
  return `${map}:${x - origin[0]},${y - origin[1]}`;
}

/** The day clock (seconds) at `playtime`. */
export const dayClock = (camp: CampState, playtime: number): number => playtime + camp.clock;

/** Whether the fire `key` burns at `playtime` (else it is embers). */
export function fireLit(camp: CampState, key: string, playtime: number): boolean {
  const at = camp.fires[key];
  return at === undefined || playtime - at >= REST.cooldown;
}

/** Heals every team Zorling that is still standing to full HP. */
export function restParty(content: GameContent, party: Party): Party {
  return { ...party, team: party.team.map((z) => (z.hp > 0 ? healed(content, z) : z)) };
}

/**
 * Rests at the burning fire `key`: the clock moves on, the fire burns down. Fires that
 * burn again are dropped from the record. Throws when the fire is embers.
 */
export function restAt(camp: CampState, key: string, playtime: number): CampState {
  if (!fireLit(camp, key, playtime)) throw new Error(`fire ${key} is burnt down`);
  const fires: Record<string, number> = {};
  for (const [k, at] of Object.entries(camp.fires))
    if (playtime - at < REST.cooldown) fires[k] = at;
  fires[key] = playtime;
  return { clock: camp.clock + REST_SECONDS, fires };
}
