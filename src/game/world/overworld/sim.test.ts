import { describe, expect, it } from 'vitest';
import { Rng } from '@engine/core/rng';
import { definePack } from '@engine/packs';
import type { BattleResult } from '@game/battle/logic';
import { loadGameContent, type NpcInput } from '@game/data';
import { applyBattleResult, healTeam, newParty, teamDown, type Party } from '@game/player';
import { createZorling } from '@game/progression';
import { corePack } from '@packs/core';
import { loadRegion, type WorldMap } from '../map';
import type { TileRect } from '../terrain';
import type { NpcActor } from './actors';
import { Roamer, ROAM, dirsToward } from './actors';
import { DIR_STEP, type Dir, type IntentFn, type Tile } from './mover';
import { outfitOf, OUTFIT_IDS } from './outfits';
import { OverworldSim, pickSpawn, SPAWN, type SimEvent } from './sim';

const DT = 1 / 60;
const content = loadGameContent([corePack]);
const MAP = 'core:test-region';
const map = loadRegion(content, MAP);
const none: IntentFn = () => undefined;
const hold =
  (dir: Dir): IntentFn =>
  () => ({ dir });

const viewAround = (t: Tile): TileRect => ({ x: t.x - 15, y: t.y - 8, width: 30, height: 17 });

function run(sim: OverworldSim, seconds: number, intent = none, view?: TileRect): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    out.push(...sim.update(DT, intent, view ?? viewAround(sim.player.destination)));
  }
  return out;
}

/** A walkable tile of `zone` whose `dir` neighbour is walkable and in the same zone. */
function spotIn(m: WorldMap, zone: string, dir: Dir, from: Tile = { x: 0, y: 0 }): Tile {
  const [dx, dy] = DIR_STEP[dir];
  let best: Tile | undefined;
  let bestD = Infinity;
  for (let y = 1; y < m.height - 1; y++) {
    for (let x = 1; x < m.width - 1; x++) {
      const ok = (tx: number, ty: number): boolean =>
        !m.blocked(tx, ty) && m.zoneAt(tx, ty)?.key === zone;
      if (!ok(x, y) || !ok(x + dx, y + dy)) continue;
      const d = Math.abs(x - from.x) + Math.abs(y - from.y);
      if (d < bestD) [best, bestD] = [{ x, y }, d];
    }
  }
  if (!best) throw new Error(`No spot in ${zone}`);
  return best;
}

describe('npcs registry', () => {
  it('loads the core test NPCs on the test region', () => {
    expect(content.npcs.size).toBeGreaterThanOrEqual(5);
    const elder = content.npcs.require('core:test-elder');
    expect(elder.behavior.kind).toBe('look');
    expect(elder.look.hair).toBe('grey');
  });

  it('rejects an unknown anchor, a missing map, and anchor plus x/y', () => {
    const bad = (npc: NpcInput): (() => unknown) => {
      const mod = definePack({
        manifest: { id: 'mod', version: '1.0.0', dependsOn: ['core'] },
        content: { npcs: { bad: npc } },
      });
      return () => loadGameContent([corePack, mod]);
    };
    expect(bad({ name: 'A', map: MAP, anchor: 'nowhere', lines: ['Hi'] })).toThrow(
      /no anchor "nowhere"/,
    );
    expect(bad({ name: 'A', map: 'core:atlantis', x: 1, y: 1, lines: ['Hi'] })).toThrow(
      /Unknown maps "core:atlantis"/,
    );
    expect(bad({ name: 'A', map: MAP, anchor: 'elder', x: 1, y: 1, lines: ['Hi'] })).toThrow(
      /either anchor or x\/y/,
    );
    expect(bad({ name: 'A', map: MAP, x: 500, y: 1, lines: ['Hi'] })).toThrow(/outside map/);
  });

  it('has a palette for every outfit', () => {
    for (const outfit of OUTFIT_IDS) {
      const o = outfitOf({ outfit, hair: 'brown', skin: 'warm' });
      expect(o.jacket).toBeGreaterThan(0);
    }
  });
});

describe('NPCs in the overworld', () => {
  it('stand on their spot, block the player and can be faced', () => {
    const sim = new OverworldSim({ content, mapId: MAP, map, seed: 1 });
    const elder = sim.npcs.find((n) => n.npc.id === 'core:test-elder') as NpcActor;
    const a = map.anchors['elder'] as Tile;
    expect([elder.mover.tx, elder.mover.ty]).toEqual([a.x, a.y]);
    expect(sim.blocked(a.x, a.y)).toBe(true);
    sim.player.place({ x: a.x + 1, y: a.y }, 'left');
    const o = sim.facing();
    expect(o?.kind === 'npc' && o.npc).toBe(elder);
    elder.faceToward(sim.player.destination);
    expect(elder.mover.facing).toBe('right');
  });

  it('stand still, look around, or wander within their radius', () => {
    const sim = new OverworldSim({ content, mapId: MAP, map, seed: 7 });
    const by = (id: string): NpcActor => sim.npcs.find((n) => n.npc.id === id) as NpcActor;
    const shop = by('core:test-shopkeeper');
    const elder = by('core:test-elder');
    const kid = by('core:test-kid');
    const facings = new Set<Dir>();
    const tiles = new Set<string>();
    for (let i = 0; i < 60 * 60; i++) {
      sim.update(DT, none, viewAround(sim.player.destination));
      facings.add(elder.mover.facing);
      tiles.add(`${kid.mover.tx},${kid.mover.ty}`);
      expect(Math.abs(kid.mover.tx - kid.home.x)).toBeLessThanOrEqual(3);
      expect(Math.abs(kid.mover.ty - kid.home.y)).toBeLessThanOrEqual(3);
    }
    expect([shop.mover.tx, shop.mover.ty, shop.mover.facing]).toEqual([
      shop.home.x,
      shop.home.y,
      'down',
    ]);
    expect([elder.mover.tx, elder.mover.ty]).toEqual([elder.home.x, elder.home.y]);
    expect(facings.size).toBeGreaterThan(2);
    expect(tiles.size).toBeGreaterThan(3);
  });

  it('do not move while talking', () => {
    const sim = new OverworldSim({ content, mapId: MAP, map, seed: 3 });
    const kid = sim.npcs.find((n) => n.npc.id === 'core:test-kid') as NpcActor;
    kid.talking = true;
    const at = [kid.mover.tx, kid.mover.ty, kid.mover.facing];
    run(sim, 20);
    expect([kid.mover.tx, kid.mover.ty, kid.mover.facing]).toEqual(at);
  });
});

describe('wild spawns', () => {
  it('pick species by weight and levels from the zone table', () => {
    const meadow = map.zones.find((z) => z.key === 'meadow');
    if (!meadow) throw new Error('no meadow');
    const rng = new Rng(5);
    const counts = new Map<string, number>();
    for (let i = 0; i < 4000; i++) {
      const s = pickSpawn(meadow, rng);
      counts.set(s.species, (counts.get(s.species) ?? 0) + 1);
      const [lo, hi] = s.species === 'core:voltbat' ? [5, 8] : meadow.levels;
      expect(s.level).toBeGreaterThanOrEqual(lo);
      expect(s.level).toBeLessThanOrEqual(hi);
    }
    // Weights 3 : 2 : 2 : 1.
    expect((counts.get('core:sproutle') ?? 0) / 4000).toBeCloseTo(3 / 8, 1);
    expect((counts.get('core:voltbat') ?? 0) / 4000).toBeCloseTo(1 / 8, 1);
  });

  it('fill the area around the view on zone tiles, away from the player, deterministically', () => {
    const start = spotIn(map, 'meadow', 'right', map.anchors['spawn']);
    const make = (): OverworldSim =>
      new OverworldSim({ content, mapId: MAP, map, seed: 42, start });
    const sim = make();
    run(sim, DT);
    expect(sim.roamers.length).toBeGreaterThan(0);
    expect(sim.roamers.length).toBeLessThanOrEqual(SPAWN.max);
    for (const r of sim.roamers) {
      const z = map.zoneAt(r.home.x, r.home.y);
      expect(z?.spawns.map((s) => s.species)).toContain(r.species);
      expect(r.level).toBeGreaterThanOrEqual(z?.levels[0] ?? 0);
      expect(r.level).toBeLessThanOrEqual(z?.levels[1] ?? 0);
      expect(map.blocked(r.home.x, r.home.y)).toBe(false);
      expect(Math.abs(r.home.x - start.x) + Math.abs(r.home.y - start.y)).toBeGreaterThanOrEqual(
        SPAWN.playerGap,
      );
    }
    const other = make();
    run(other, DT);
    const sig = (s: OverworldSim): string[] =>
      s.roamers.map((r) => `${r.species}@${r.home.x},${r.home.y}:${r.level}:${r.temperament}`);
    expect(sig(other)).toEqual(sig(sim));

    // They roam, but stay in their zone and never share a tile.
    run(sim, 30);
    run(other, 30);
    expect(sig(other)).toEqual(sig(sim));
    for (const r of sim.roamers) {
      expect(map.zoneAt(r.mover.tx, r.mover.ty)?.key).toBe(r.zone);
      expect(map.blocked(r.mover.tx, r.mover.ty)).toBe(false);
    }
    const tiles = sim.roamers.map((r) => `${r.mover.tx},${r.mover.ty}`);
    expect(new Set(tiles).size).toBe(tiles.length);
  });

  it('despawn when the view moves far away, and never spawn in town', () => {
    const start = spotIn(map, 'meadow', 'right', map.anchors['spawn']);
    const sim = new OverworldSim({ content, mapId: MAP, map, seed: 9, start });
    run(sim, 2);
    expect(sim.roamers.length).toBeGreaterThan(0);
    const far: TileRect = { x: 0, y: 0, width: 30, height: 17 };
    sim.update(DT, none, far);
    for (const r of sim.roamers) expect(r.home.x).toBeLessThan(30 + SPAWN.despawn + SPAWN.margin);
    // Town (no zone) never gets a spawn.
    const town = new OverworldSim({ content, mapId: MAP, map, seed: 9 });
    run(town, 10);
    for (const r of town.roamers) expect(map.zoneAt(r.home.x, r.home.y)).toBeDefined();
  });
});

describe('encounters', () => {
  /** A sim with no random spawns and one wild Zorling right of the player. */
  function oneWild(temperament: Roamer['temperament'], gap = 1) {
    const at = spotIn(map, 'meadow', 'right', map.anchors['spawn']);
    const sim = new OverworldSim({ content, mapId: MAP, map, seed: 1, start: at, facing: 'right' });
    // Use a view far from the meadow so nothing else spawns, then keep the roamer by hand.
    const wild = new Roamer(
      999,
      'core:sproutle',
      5,
      map.zoneAt(at.x, at.y)?.key ?? '',
      { x: at.x + gap, y: at.y },
      temperament,
      new Rng(1),
    );
    sim.roamers.push(wild);
    const view: TileRect = { x: at.x - 15, y: at.y - 8, width: 30, height: 17 };
    return { sim, wild, at, view };
  }

  it('walking into a roaming Zorling starts an encounter', () => {
    const { sim, wild, view } = oneWild('calm');
    // Freeze it in place: it is idle for its first moment, so walk at once.
    let events: SimEvent[] = [];
    for (let i = 0; i < 10 && !events.some((e) => e.kind === 'encounter'); i++) {
      events = sim.update(DT, hold('right'), view);
    }
    const enc = events.find((e) => e.kind === 'encounter');
    expect(enc?.kind === 'encounter' && enc.roamer).toBe(wild);
  });

  it('a Zorling that the player ran from does not start one during its cooldown', () => {
    const { sim, wild, view } = oneWild('calm');
    wild.spook(5);
    const events: SimEvent[] = [];
    for (let i = 0; i < 20; i++) events.push(...sim.update(DT, hold('right'), view));
    expect(events.some((e) => e.kind === 'encounter')).toBe(false);
  });

  it('a curious Zorling notices the player, shows "!", chases and starts one', () => {
    const { sim, wild, view } = oneWild('curious', 3);
    const events: SimEvent[] = [];
    let alerted = false;
    for (let i = 0; i < 60 * 4 && !events.some((e) => e.kind === 'encounter'); i++) {
      events.push(...sim.update(DT, none, view));
      if (wild.alert > 0) alerted = true;
    }
    expect(alerted).toBe(true);
    expect(wild.state).toBe('chase');
    expect(events.some((e) => e.kind === 'encounter' && e.roamer === wild)).toBe(true);
  });

  it('a shy Zorling runs away from the player', () => {
    const { sim, wild, at, view } = oneWild('shy', 2);
    run(sim, 1.5, none, view);
    expect(wild.state === 'flee' || wild.state === 'idle').toBe(true);
    const d = Math.abs(wild.mover.tx - at.x) + Math.abs(wild.mover.ty - at.y);
    expect(d).toBeGreaterThan(2);
  });

  it('chases step toward the player, larger axis first', () => {
    expect(dirsToward({ x: 0, y: 0 }, { x: 3, y: -1 })).toEqual(['right', 'up']);
    expect(dirsToward({ x: 0, y: 0 }, { x: 0, y: 2 })).toEqual(['down']);
    expect(ROAM.chaseSpeed).toBeLessThan(3.75);
  });
});

describe('party', () => {
  const z = (s: string, uid: string) => createZorling(content, { uid, species: s, level: 8 });
  const party: Party = newParty({
    team: [z('core:puddlit', 'a'), z('core:emberkit', 'b')],
    bag: { 'core:zorb': 2 },
    money: 100,
  });
  const result = (over: Partial<BattleResult>): BattleResult => ({
    outcome: 'win',
    team: party.team,
    xp: 0,
    progress: [],
    bag: { 'core:zorb': 1 },
    caught: null,
    ...over,
  });

  it('puts a catch on the team while there is room, then in storage', () => {
    const one = applyBattleResult(
      party,
      result({ outcome: 'caught', caught: z('core:sproutle', 'c') }),
    );
    expect(one.caughtTo).toBe('team');
    expect(one.party.team).toHaveLength(3);
    expect(one.party.bag).toEqual({ 'core:zorb': 1 });
    const two = applyBattleResult(
      one.party,
      result({ outcome: 'caught', team: one.party.team, caught: z('core:voltbat', 'd') }),
    );
    expect(two.caughtTo).toBe('storage');
    expect(two.party.storage.map((s) => s.uid)).toEqual(['d']);
  });

  it('knows when the team is down and heals it', () => {
    const down = { ...party, team: party.team.map((t) => ({ ...t, hp: 0 })) };
    expect(teamDown(down)).toBe(true);
    const healed = healTeam(content, down);
    expect(teamDown(healed)).toBe(false);
    expect(healed.team.map((t) => t.hp)).toEqual(party.team.map((t) => t.hp));
  });
});

describe('soak', () => {
  it('runs 10 minutes of random walking with encounters resolved, staying consistent', () => {
    const sim = new OverworldSim({ content, mapId: MAP, map, seed: 77 });
    const rng = new Rng(77);
    let dir: Dir = 'right';
    let encounters = 0;
    for (let i = 0; i < 60 * 600; i++) {
      if (i % 90 === 0) dir = rng.pick(['up', 'down', 'left', 'right'] as const);
      for (const e of sim.update(DT, hold(dir), viewAround(sim.player.destination))) {
        if (e.kind !== 'encounter') continue;
        encounters++;
        if (rng.chance(0.5)) sim.remove(e.roamer);
        else e.roamer.spook(4);
      }
      expect(sim.roamers.length).toBeLessThanOrEqual(SPAWN.max);
    }
    expect(encounters).toBeGreaterThan(0);
    const tiles = [
      sim.player,
      ...sim.npcs.map((n) => n.mover),
      ...sim.roamers.map((r) => r.mover),
    ].map((m) => `${m.tx},${m.ty}`);
    expect(new Set(tiles).size).toBe(tiles.length);
  });
});
