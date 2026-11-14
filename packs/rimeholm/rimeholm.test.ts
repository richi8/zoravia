/**
 * Region 3, the Rimeholm Isles (C35): the map is walkable as a whole (islands joined by piers),
 * its zones carry the right tier metadata and sleet storms, its towns have working centers,
 * its skerries are scenery, the ferry links it to Verdale both ways, and Glacivar's theme
 * loops cleanly.
 */

import { songProblems } from '@engine/audio';
import { describe, expect, it } from 'vitest';
import { themeSong } from '@game/audio/music';
import { loadGameContent, TIER_LEVELS } from '@game/data';
import { linkedArrival, loadRegion } from '@game/world/map';
import { OverworldSim } from '@game/world/overworld/sim';
import { propFootprint } from '@game/world/props';
import { corePack } from '@packs/core';
import { emberwastePack } from '@packs/emberwaste';
import { SHIPPED_PACKS } from '@packs/index';

const content = loadGameContent([...SHIPPED_PACKS]);
const ID = 'rimeholm:rimeholm';
const map = loadRegion(content, ID);
const spawn = map.anchors['spawn'] ?? { x: -1, y: -1 };
const reach = map.reachableFrom(spawn.x, spawn.y);
const at = (x: number, y: number): number => y * map.width + x;

describe('Rimeholm map', () => {
  it('is a 200×200 frozen region named Rimeholm Isles', () => {
    expect([map.name, map.biome, map.width, map.height]).toEqual([
      'Rimeholm Isles',
      'frozen',
      200,
      200,
    ]);
  });

  it('is walkable as a whole: every walkable tile is reachable from the spawn', () => {
    let walkable = 0;
    let unreachable = 0;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.blocked(x, y)) continue;
        walkable++;
        if (!reach[at(x, y)]) unreachable++;
      }
    }
    expect(walkable).toBeGreaterThan(12000);
    expect(unreachable).toBe(0);
  });

  it('reaches every anchor, connection and zone', () => {
    for (const [id, a] of Object.entries(map.anchors)) {
      expect(reach[at(a.x, a.y)], `anchor ${id}`).toBe(1);
    }
    for (const [id, c] of Object.entries(map.connections)) {
      expect(reach[at(c.x, c.y)], `connection ${id}`).toBe(1);
    }
    const reached = new Set<string>();
    for (let i = 0; i < reach.length; i++) {
      if (!reach[i]) continue;
      const z = map.zoneAt(i % map.width, Math.floor(i / map.width));
      if (z) reached.add(z.key);
    }
    expect([...reached].sort()).toEqual(map.zones.map((z) => z.key).sort());
  });

  it('gives every zone levels inside its tier and a spawn table', () => {
    expect(map.zones).toHaveLength(11);
    for (const z of map.zones) {
      const [lo, hi] = TIER_LEVELS[z.tier];
      expect(z.levels[0], z.name).toBeGreaterThanOrEqual(lo);
      expect(z.levels[1], z.name).toBeLessThanOrEqual(hi);
      expect(z.spawns.length, z.name).toBeGreaterThan(0);
    }
    const tiers = map.zones.reduce<Record<string, number>>((n, z) => {
      n[z.tier] = (n[z.tier] ?? 0) + 1;
      return n;
    }, {});
    expect(tiers).toEqual({ t1: 3, t2: 5, t3: 3 });
  });

  it('rings the tiers around the hub town', () => {
    const dist: Record<string, number[]> = {};
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const z = map.zoneAt(x, y);
        if (z) (dist[z.tier] ??= []).push(Math.hypot(x - spawn.x, y - spawn.y));
      }
    }
    const mean = (t: string): number => {
      const d = dist[t] ?? [];
      return d.reduce((a, b) => a + b, 0) / d.length;
    };
    expect(mean('t1')).toBeLessThan(mean('t2'));
    expect(mean('t2')).toBeLessThan(mean('t3'));
  });

  it('has sleet storms that soak battles in three zones, with snow in the air', () => {
    const stormy = map.zones.filter((z) => z.battleWeather?.length);
    expect(stormy.map((z) => z.key).sort()).toEqual(['crown', 'sleet-fells', 'squall-reach']);
    for (const z of stormy) {
      expect(z.battleWeather).toEqual(['core:wet']);
      expect(z.weather).toBe('snow');
    }
    // The Floemaw Titan's lair is in a storm, so its Armor-breaking Frozen is set up.
    const lair = map.anchors['titan-tusk-rookery'] ?? { x: 0, y: 0 };
    expect(map.zoneAt(lair.x, lair.y)?.battleWeather).toEqual(['core:wet']);
  });

  it('puts towns outside zones and the big sites in the right tiers', () => {
    for (const town of ['town-brinewick', 'town-glimmerholm', 'town-rimeport', 'spawn']) {
      const a = map.anchors[town] ?? { x: 0, y: 0 };
      expect(map.zoneAt(a.x, a.y), town).toBeUndefined();
    }
    const tierAt = (id: string): string | undefined => {
      const a = map.anchors[id] ?? { x: 0, y: 0 };
      return map.zoneAt(a.x, a.y)?.tier;
    };
    expect(tierAt('titan-tusk-rookery')).toBe('t2');
    expect(tierAt('titan-thunder-eyrie')).toBe('t2');
    expect(tierAt('legendary')).toBe('t3');
    expect(tierAt('boss-stormspire')).toBe('t3');
    const kinds = (k: string): number =>
      Object.values(map.anchors).filter((a) => a.kind === k).length;
    expect(kinds('secret')).toBe(3);
    expect(kinds('landmark')).toBe(3);
  });

  it('has a Zorling center in every town, with its healer next to the door', () => {
    const centers = map.props.filter((p) => p.kind === 'center');
    expect(centers).toHaveLength(3);
    const sim = new OverworldSim({ content, mapId: ID, map, seed: 1 });
    for (const c of centers) {
      expect(map.doorAt(c.tx, c.ty)).toBe('center');
      sim.player.place({ x: c.tx, y: c.ty + 1 }, 'up');
      const o = sim.facing();
      expect(o?.kind === 'npc' && o.npc.npc.role?.kind).toBe('center');
    }
    const shops = map.props.filter((p) => p.kind === 'shop');
    expect(shops).toHaveLength(2);
    for (const s of shops) {
      sim.player.place({ x: s.tx, y: s.ty + 1 }, 'up');
      const o = sim.facing();
      expect(o?.kind === 'npc' && o.npc.npc.role?.kind).toBe('shop');
    }
  });

  it('blocks building footprints and joins the islands with piers', () => {
    for (const p of map.props.filter((q) => ['center', 'shop', 'house'].includes(q.kind))) {
      const [x0, y0, w, h] = propFootprint(p.kind, p.tx, p.ty, p.variant);
      for (let y = y0; y < y0 + h; y++)
        for (let x = x0; x < x0 + w; x++)
          expect(map.blocked(x, y), `${p.kind} ${x},${y}`).toBe(true);
      expect(map.blocked(p.tx, p.ty + 1), `${p.kind} doorstep`).toBe(false);
    }
    const piers = map.props.filter(
      (b) => b.kind.startsWith('bridge') && map.liquidBlocks(b.tx, b.ty),
    );
    expect(piers.length).toBeGreaterThan(100);
    for (const b of piers) expect(map.blocked(b.tx, b.ty)).toBe(false);
  });

  it('keeps the skerries as scenery: land the player cannot reach', () => {
    for (const [x, y] of [
      [20, 22],
      [168, 18],
      [96, 142],
      [22, 184],
    ] as const) {
      expect(map.liquidBlocks(x, y), `${x},${y} is land`).toBe(false);
      expect(map.blocked(x, y), `${x},${y} is blocked`).toBe(true);
    }
  });
});

describe('The ferry', () => {
  it('leads from Verdale to Rimeholm and back, facing into each map', () => {
    const there = linkedArrival(content, 'core:verdale', 'ferry');
    expect(there).toMatchObject({ map: ID, connection: 'ferry', y: 0, facing: 'down' });
    const back = linkedArrival(content, ID, 'ferry');
    expect(back).toMatchObject({ map: 'core:verdale', connection: 'ferry', facing: 'up' });
    const verdale = loadRegion(content, 'core:verdale');
    expect(back?.y).toBe(verdale.height - 1);
    // Both ends stand on walkable tiles.
    expect(map.blocked(there?.x ?? 0, there?.y ?? 0)).toBe(false);
    expect(verdale.blocked(back?.x ?? 0, back?.y ?? 0)).toBe(false);
  });

  it('leads nowhere while Rimeholm is not loaded', () => {
    const noRimeholm = loadGameContent([corePack, emberwastePack]);
    expect(linkedArrival(noRimeholm, 'core:verdale', 'ferry')).toBeUndefined();
    expect(linkedArrival(noRimeholm, 'core:verdale', 'ember-pass')).toBeDefined();
  });
});

describe('Glacivar’s theme', () => {
  it('loads, is well formed and fills its loop', () => {
    const m = content.music.require('rimeholm:glacivar-theme');
    const s = themeSong(content, m.id);
    expect(songProblems(s)).toEqual([]);
    expect(s.length).toBe(m.bars * m.beatsPerBar * m.stepsPerBeat);
    for (const t of s.tracks) {
      const end = Math.max(...t.notes.map((n) => n.step + n.len));
      expect(end, t.instrument).toBeGreaterThan(s.length - s.stepsPerBeat * 4);
    }
    expect(content.bosses.require('rimeholm:glacivar').theme).toBe(m.id);
  });
});
