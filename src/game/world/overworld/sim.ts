/**
 * The overworld simulation (C21): the player, the map's NPCs and the roaming wild Zorlings
 * on one tile grid, without any drawing.
 *
 * - Everyone blocks everyone: an actor stands on its tile and reserves the tile it walks to.
 * - Wild Zorlings spawn from the zone spawn tables (weights, fixed levels) in the area around
 *   the view, mostly in tall grass, never right next to the player, and only off screen once
 *   the area is filled. Far ones despawn. They stay in their zone.
 * - Walking into a roaming Zorling (or one chasing the player catching it) is an encounter.
 * - `facing()` is what the player would talk to or touch with `E`.
 * - NPCs with a `when` condition come and go (C27): `present` says which NPCs are there. One
 *   that should appear waits until its tile is free.
 *
 * Deterministic for a seed: every random choice comes from split `Rng` streams.
 */

import { Rng, type Seed } from '@engine/core/rng';
import type { GameContent } from '@game/data';
import { npcPlace, type Npc } from '@game/data/npcs';
import type { WorldMap, Zone } from '@game/world/map';
import type { TileRect } from '@game/world/terrain';
import { NpcActor, Roamer, ROAM, type Blocked, type Temperament } from './actors';

/** How far (tiles) from a door its service NPC may stand. */
const DOOR_REACH = 6;
import { DIR_STEP, GridMover, type Dir, type IntentFn, type MoveEvent, type Tile } from './mover';

/** Starting values, tuned in C31. */
export const SPAWN = {
  /** At most this many roaming Zorlings at once. */
  max: 8,
  /** One Zorling per this many zone tiles in the active area. */
  tilesPer: 70,
  /** Tiles around the view (each side) where Zorlings live; spawns go here. */
  margin: 6,
  /** Zorlings farther than this outside the view despawn. */
  despawn: 12,
  /** Seconds between spawn attempts. */
  interval: 0.5,
  /** Never spawn within this many tiles (Manhattan) of the player. */
  playerGap: 4,
  /** Chance a spawn spot outside tall grass is kept (tall grass is preferred). */
  openGround: 0.35,
} as const;

export type SimEvent =
  | { readonly kind: 'encounter'; readonly roamer: Roamer }
  | { readonly kind: 'player'; readonly event: MoveEvent };

export type Occupant =
  | { readonly kind: 'npc'; readonly npc: NpcActor }
  | { readonly kind: 'wild'; readonly roamer: Roamer };

export interface SimOptions {
  readonly content: GameContent;
  readonly mapId: string;
  readonly map: WorldMap;
  readonly seed: Seed;
  readonly start?: Tile;
  readonly facing?: Dir;
}

/** A species and level from a zone's spawn table. */
export function pickSpawn(zone: Zone, rng: Rng): { species: string; level: number } {
  const s = rng.weighted(zone.spawns, (e) => e.weight);
  const [lo, hi] = s.levels ?? zone.levels;
  return { species: s.species, level: rng.int(lo, hi) };
}

export function pickTemperament(rng: Rng): Temperament {
  const entries = Object.entries(ROAM.temperaments) as [Temperament, number][];
  return rng.weighted(entries, ([, w]) => w)[0];
}

export class OverworldSim {
  readonly map: WorldMap;
  readonly player: GridMover;
  /** NPCs on the map now. */
  readonly npcs: NpcActor[] = [];
  /** Every NPC of the map, there or not, in pack order. */
  readonly allNpcs: readonly NpcActor[];
  private isPresent: (npc: Npc) => boolean = () => true;
  readonly roamers: Roamer[] = [];
  private readonly spawnRng: Rng;
  private readonly battleRng: Rng;
  private readonly seed: Rng;
  private nextId = 1;
  private spawnTimer = 0;
  private filled = false;

  constructor(options: SimOptions) {
    const { content, map } = options;
    this.map = map;
    this.seed = new Rng(options.seed);
    this.spawnRng = this.seed.split('spawn');
    this.battleRng = this.seed.split('battle');
    const spawn = options.start ??
      map.anchors['spawn'] ?? { x: map.width >> 1, y: map.height >> 1 };
    this.player = new GridMover(
      { x: spawn.x, y: spawn.y },
      options.facing ?? (map.anchors['spawn']?.facing as Dir | undefined) ?? 'down',
    );
    const npcRng = this.seed.split('npcs');
    this.allNpcs = content.npcs
      .values()
      .filter((n: Npc) => n.map === options.mapId)
      .map((n) => {
        const p = npcPlace(n, map);
        return new NpcActor(n, { x: p.x, y: p.y }, p.facing, npcRng.split(n.id));
      });
    this.npcs.push(...this.allNpcs);
  }

  /**
   * Which NPCs are there (C27, NPC `when`). Ones that leave vanish at once; ones that come
   * appear on their spot once nobody stands there. Call again whenever the answer may change.
   */
  present(isPresent: (npc: Npc) => boolean): void {
    this.isPresent = isPresent;
    this.syncNpcs();
  }

  private syncNpcs(): void {
    const next: NpcActor[] = [];
    for (const a of this.allNpcs) {
      const here = this.npcs.includes(a);
      if (!this.isPresent(a.npc)) continue;
      if (here || this.free(a)) next.push(a);
    }
    if (next.length === this.npcs.length && next.every((a, i) => a === this.npcs[i])) return;
    this.npcs.length = 0;
    this.npcs.push(...next);
  }

  /** Whether an NPC that is not there can appear on its tile now. */
  private free(a: NpcActor): boolean {
    const { tx, ty } = a.mover;
    const at = this.player.destination;
    if (covers(this.player, tx, ty) || (at.x === tx && at.y === ty)) return false;
    return this.occupant(tx, ty) === undefined;
  }

  /** Who stands on (or walks onto) a tile, besides the player. */
  occupant(x: number, y: number): Occupant | undefined {
    for (const npc of this.npcs) if (covers(npc.mover, x, y)) return { kind: 'npc', npc };
    for (const roamer of this.roamers)
      if (covers(roamer.mover, x, y)) return { kind: 'wild', roamer };
    return undefined;
  }

  /** Blocked for the player: the map, NPCs and wild Zorlings. */
  readonly blocked: Blocked = (x, y) => this.map.blocked(x, y) || this.occupant(x, y) !== undefined;

  /**
   * The tile in front of the standing player and who is on it. A building's door (C28)
   * counts as the nearest NPC offering its service (the healer by the center's door).
   */
  facing(): Occupant | undefined {
    if (this.player.moving) return undefined;
    const [dx, dy] = DIR_STEP[this.player.facing];
    const x = this.player.tx + dx;
    const y = this.player.ty + dy;
    const o = this.occupant(x, y);
    if (o) return o;
    const service = this.map.doorAt(x, y);
    if (!service) return undefined;
    let best: NpcActor | undefined;
    let bestD = DOOR_REACH + 1;
    for (const npc of this.npcs) {
      if (npc.npc.role?.kind !== service) continue;
      const d = Math.abs(npc.mover.tx - x) + Math.abs(npc.mover.ty - y);
      if (d < bestD) {
        best = npc;
        bestD = d;
      }
    }
    return best ? { kind: 'npc', npc: best } : undefined;
  }

  /** A seed for the next battle. */
  battleSeed(): number {
    return this.battleRng.nextU32();
  }

  remove(roamer: Roamer): void {
    const i = this.roamers.indexOf(roamer);
    if (i >= 0) this.roamers.splice(i, 1);
  }

  /** Removes every wild Zorling (e.g. after warping); the area fills again. */
  clearWild(): void {
    this.roamers.length = 0;
    this.filled = false;
    this.spawnTimer = 0;
  }

  /**
   * One frame. `intent` drives the player; `view` is the visible area in tiles. Returns the
   * player's move events and at most one encounter.
   */
  update(dt: number, intent: IntentFn, view: TileRect): SimEvent[] {
    const events: SimEvent[] = [];
    let encounter: Roamer | undefined;
    if (this.npcs.length < this.allNpcs.length) this.syncNpcs();
    for (const e of this.player.update(dt, intent, this.blocked)) {
      events.push({ kind: 'player', event: e });
      if (e.kind === 'bump') {
        const o = this.facing();
        if (o?.kind === 'wild' && o.roamer.cooldown <= 0) encounter ??= o.roamer;
      }
    }

    const at = this.player.destination;
    const playerOn = (x: number, y: number): boolean =>
      covers(this.player, x, y) || (x === at.x && y === at.y);

    for (const npc of this.npcs) {
      npc.update(dt, (x, y) => this.map.blocked(x, y) || playerOn(x, y) || this.takenBy(npc, x, y));
    }
    for (const r of this.roamers) {
      const zone = this.map.zoneAt(r.home.x, r.home.y)?.key;
      const blocked: Blocked = (x, y) =>
        this.map.blocked(x, y) ||
        this.map.zoneAt(x, y)?.key !== zone ||
        (r.state !== 'chase' &&
          (Math.abs(x - r.home.x) > ROAM.homeRadius || Math.abs(y - r.home.y) > ROAM.homeRadius)) ||
        playerOn(x, y) ||
        this.takenBy(r, x, y);
      if (r.update(dt, at, blocked) && !this.player.moving) encounter ??= r;
    }

    this.despawn(view);
    this.spawnTimer -= dt;
    if (!this.filled) {
      this.fill(view);
      this.filled = true;
    } else if (this.spawnTimer <= 0) {
      this.spawnTimer = SPAWN.interval;
      this.trySpawn(view, false);
    }

    if (encounter) events.push({ kind: 'encounter', roamer: encounter });
    return events;
  }

  /** Wild Zorlings wanted in the active area right now. */
  target(view: TileRect): number {
    const a = this.activeArea(view, SPAWN.margin);
    let tiles = 0;
    for (let y = a.y; y < a.y + a.height; y++) {
      for (let x = a.x; x < a.x + a.width; x++) if (this.map.zoneAt(x, y)?.spawns.length) tiles++;
    }
    return Math.min(SPAWN.max, Math.round(tiles / SPAWN.tilesPer));
  }

  private fill(view: TileRect): void {
    const want = this.target(view);
    for (let i = 0; i < want * 4 && this.roamers.length < want; i++) this.trySpawn(view, true);
  }

  private trySpawn(view: TileRect, initial: boolean): void {
    if (this.roamers.length >= this.target(view)) return;
    const rng = this.spawnRng;
    const a = this.activeArea(view, SPAWN.margin);
    for (let tries = 0; tries < 12; tries++) {
      const x = rng.int(a.x, a.x + a.width - 1);
      const y = rng.int(a.y, a.y + a.height - 1);
      const zone = this.map.zoneAt(x, y);
      if (!zone?.spawns.length) continue;
      if (this.map.blocked(x, y) || this.occupant(x, y) || covers(this.player, x, y)) continue;
      const p = this.player.destination;
      if (Math.abs(x - p.x) + Math.abs(y - p.y) < SPAWN.playerGap) continue;
      if (!initial && inside(view, x, y, 1)) continue;
      if (!this.map.tall(x, y) && !rng.chance(SPAWN.openGround)) continue;
      const id = this.nextId++;
      const { species, level } = pickSpawn(zone, rng);
      const own = this.seed.split(`wild-${id}`);
      this.roamers.push(
        new Roamer(id, species, level, zone.key, { x, y }, pickTemperament(own), own),
      );
      return;
    }
  }

  private despawn(view: TileRect): void {
    for (let i = this.roamers.length - 1; i >= 0; i--) {
      const r = this.roamers[i] as Roamer;
      if (!inside(view, r.mover.tx, r.mover.ty, SPAWN.despawn)) this.roamers.splice(i, 1);
    }
  }

  private activeArea(view: TileRect, margin: number): TileRect {
    const x0 = Math.max(0, view.x - margin);
    const y0 = Math.max(0, view.y - margin);
    const x1 = Math.min(this.map.width, view.x + view.width + margin);
    const y1 = Math.min(this.map.height, view.y + view.height + margin);
    return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) };
  }

  private takenBy(self: NpcActor | Roamer, x: number, y: number): boolean {
    const o = this.occupant(x, y);
    if (!o) return false;
    return (o.kind === 'npc' ? o.npc : o.roamer) !== self;
  }
}

function covers(m: GridMover, x: number, y: number): boolean {
  if (m.tx === x && m.ty === y) return true;
  const d = m.destination;
  return d.x === x && d.y === y;
}

function inside(r: TileRect, x: number, y: number, margin: number): boolean {
  return (
    x >= r.x - margin &&
    y >= r.y - margin &&
    x < r.x + r.width + margin &&
    y < r.y + r.height + margin
  );
}
