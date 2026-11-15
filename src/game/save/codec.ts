/**
 * Game state ↔ save data (C23). `toSave` writes the state as plain JSON-safe data;
 * `readSave` migrates any older version, checks the shape, then checks the save against the
 * loaded content.
 *
 * Content check: a save that names species, moves, items, bosses, badges, trainers or maps the loaded packs
 * don't have is refused with a list of what is missing (a pack was removed). Values that only
 * drifted because a pack changed its numbers are repaired instead: HP above the new max HP and
 * bag counts above a new bag cap are lowered, and a quest at a step its pack no longer has
 * goes back to the quest's first step.
 */

import type { Facing, GameContent } from '@game/data';
import type { Party, QuestLog } from '@game/player';
import { statsOf, type Zorling } from '@game/progression';
import { migrate, SaveError } from './migrate';
import { SAVE_FORMAT, SAVE_VERSION, type SaveData } from './schema';

/** A map, a tile on it, and a facing. */
export interface Place {
  readonly map: string;
  readonly x: number;
  readonly y: number;
  readonly facing: Facing;
}

/** Everything a save keeps. Wild Zorlings and NPC positions are not kept (they respawn). */
export interface GameState {
  readonly party: Party;
  /** Where the player stands. */
  readonly place: Place;
  /** The last Zorling center used (where the player wakes up after losing). */
  readonly respawn?: Place;
  /** Seconds played. */
  readonly playtime: number;
}

export function toSave(content: GameContent, state: GameState, now = new Date()): SaveData {
  const packs = Object.fromEntries(content.loaded.packs.map((p) => [p.id, p.version]));
  const data: SaveData = {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    savedAt: now.toISOString(),
    packs,
    playtime: Math.round(state.playtime * 10) / 10,
    place: placeOut(content, state.place),
    ...(state.respawn ? { respawn: placeOut(content, state.respawn) } : {}),
    party: state.party,
  } as SaveData;
  // A deep, plain copy: nothing shared with the live state, nothing that is not JSON.
  return JSON.parse(JSON.stringify(data)) as SaveData;
}

/** Reads a raw save (any known version) into game state, or throws `SaveError`. */
export function readSave(content: GameContent, raw: unknown): GameState {
  return fromSave(content, migrate(raw));
}

export function fromSave(content: GameContent, data: SaveData): GameState {
  const missing = missingContent(content, data);
  if (missing.length) {
    const packs = Object.keys(data.packs);
    const hint = packs.length ? ` (saved with packs: ${packs.join(', ')})` : '';
    throw new SaveError([`content not loaded${hint}: ${missing.join(', ')}`]);
  }
  const p = data.party;
  const uids = [...p.team, ...p.storage].map((z) => z.uid);
  const twice = uids.filter((u, i) => uids.indexOf(u) !== i);
  if (twice.length) throw new SaveError([`Zorling uid used twice: ${twice.join(', ')}`]);

  const fit = (z: Zorling): Zorling => ({ ...z, hp: Math.min(z.hp, statsOf(content, z).hp) });
  const bag = Object.fromEntries(
    Object.entries(p.bag).map(([id, n]) => [
      id,
      Math.min(n, content.items.require(id).bagCap ?? n),
    ]),
  );
  const party: Party = {
    team: p.team.map(fit),
    storage: p.storage.map(fit),
    bag,
    money: p.money,
    dex: p.dex,
    bosses: p.bosses,
    flags: p.flags,
    quests: fitQuests(content, p.quests),
    badges: [...new Set(p.badges)],
    trainers: p.trainers,
  };
  return {
    party,
    place: placeIn(content, data.place),
    ...(data.respawn ? { respawn: placeIn(content, data.respawn) } : {}),
    playtime: data.playtime,
  };
}

/** The map's origin now: where its first shipped tile sits (C36). */
const originOf = (content: GameContent, map: string): readonly [number, number] =>
  content.maps.get(map)?.origin ?? [0, 0];

function placeOut(content: GameContent, p: Place): SaveData['place'] {
  const [ox, oy] = originOf(content, p.map);
  return {
    map: p.map as SaveData['place']['map'],
    x: p.x,
    y: p.y,
    facing: p.facing,
    origin: [ox, oy],
  };
}

/** A saved place on today's map: moved by however far the map's origin moved since (C36). */
function placeIn(content: GameContent, p: SaveData['place']): Place {
  const [ox, oy] = originOf(content, p.map);
  return { map: p.map, x: p.x + ox - p.origin[0], y: p.y + oy - p.origin[1], facing: p.facing };
}

/** Ids the save names that the loaded content does not have, sorted. */
function missingContent(content: GameContent, data: SaveData): string[] {
  const missing = new Set<string>();
  const need = (has: (id: string) => boolean, id: string): void => {
    if (!has(id)) missing.add(id);
  };
  const p = data.party;
  for (const z of [...p.team, ...p.storage]) {
    need((id) => content.species.has(id), z.species);
    for (const m of z.moves) need((id) => content.moves.has(id), m);
  }
  for (const id of Object.keys(p.bag)) need((i) => content.items.has(i), id);
  for (const id of [...p.dex.seen, ...p.dex.caught]) need((i) => content.species.has(i), id);
  for (const id of Object.keys(p.bosses)) need((i) => content.bosses.has(i), id);
  for (const id of Object.keys(p.quests)) need((i) => content.quests.has(i), id);
  for (const id of p.badges) need((i) => content.badges.has(i), id);
  for (const id of Object.keys(p.trainers)) need((i) => content.trainers.has(i), id);
  for (const place of [data.place, data.respawn]) {
    if (place) need((i) => content.maps.has(i), place.map);
  }
  return [...missing].sort();
}

/** Active quests at a step that no longer exists restart at their first step. */
function fitQuests(content: GameContent, log: QuestLog): QuestLog {
  return Object.fromEntries(
    Object.entries(log).map(([id, q]) => {
      if (q.state !== 'active') return [id, q];
      const steps = content.quests.require(id).steps;
      if (steps.some((s) => s.id === q.step)) return [id, q];
      return [id, { state: 'active', step: steps[0]?.id ?? q.step }];
    }),
  );
}
