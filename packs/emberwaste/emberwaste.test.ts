/**
 * Region 2, Emberwaste (C34): the map is walkable as a whole, its zones carry the right tier
 * metadata and ash storms, its towns have working centers, and Ember Pass links it to Verdale
 * both ways.
 */

import { describe, expect, it } from 'vitest';
import { loadGameContent, TIER_LEVELS } from '@game/data';
import { linkedArrival, loadRegion } from '@game/world/map';
import { OverworldSim } from '@game/world/overworld/sim';
import { propFootprint } from '@game/world/props';
import { corePack } from '@packs/core';
import { SHIPPED_PACKS } from '@packs/index';

const content = loadGameContent([...SHIPPED_PACKS]);
const ID = 'emberwaste:emberwaste';
const map = loadRegion(content, ID);
const spawn = map.anchors['spawn'] ?? { x: -1, y: -1 };
const reach = map.reachableFrom(spawn.x, spawn.y);
const at = (x: number, y: number): number => y * map.width + x;

describe('Emberwaste map', () => {
  it('is a 280×200 desert region named Emberwaste (200×200 plus the Ashen Rift, C36)', () => {
    expect([map.name, map.biome, map.width, map.height]).toEqual([
      'Emberwaste',
      'desert',
      280,
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
    expect(walkable).toBeGreaterThan(20000);
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
    expect(map.zones).toHaveLength(13);
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
    expect(tiers).toEqual({ t1: 3, t2: 5, t3: 3, danger: 2 });
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

  it('has ash storms that set battles Burning in four zones, with ash in the air', () => {
    const stormy = map.zones.filter((z) => z.battleWeather?.length);
    expect(stormy.map((z) => z.key).sort()).toEqual([
      'ashfall',
      'caldera',
      'cinder-dunes',
      'cinder-rift',
    ]);
    for (const z of stormy) {
      expect(z.battleWeather).toEqual(['core:burning']);
      expect(z.weather).toBe('ash');
    }
    // The Dunewyrm Titan's lair is in a storm, so its Armor-breaking Steam Burst is set up.
    const lair = map.anchors['titan-sunken-sands'] ?? { x: 0, y: 0 };
    expect(map.zoneAt(lair.x, lair.y)?.battleWeather).toEqual(['core:burning']);
    // So is the Elder Dunewyrm's (C36).
    const sink = map.anchors['glass-sink'] ?? { x: 0, y: 0 };
    expect(map.zoneAt(sink.x, sink.y)?.battleWeather).toEqual(['core:burning']);
  });

  it('puts towns outside zones and the big sites in the right tiers', () => {
    for (const town of ['town-cinderwell', 'town-kilnreach', 'town-slagwatch', 'spawn']) {
      const a = map.anchors[town] ?? { x: 0, y: 0 };
      expect(map.zoneAt(a.x, a.y), town).toBeUndefined();
    }
    const tierAt = (id: string): string | undefined => {
      const a = map.anchors[id] ?? { x: 0, y: 0 };
      return map.zoneAt(a.x, a.y)?.tier;
    };
    expect(tierAt('titan-sunken-sands')).toBe('t2');
    expect(tierAt('titan-old-foundry')).toBe('t2');
    expect(tierAt('legendary')).toBe('t3');
    expect(tierAt('boss-cap-works')).toBe('t3');
    const kinds = (k: string): number =>
      Object.values(map.anchors).filter((a) => a.kind === k).length;
    // The Ashen Rift (C36) adds a secret, a landmark, two lairs and its heart.
    expect(kinds('secret')).toBe(4);
    expect(kinds('landmark')).toBe(4);
    expect(kinds('heart')).toBe(1);
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

  it('blocks building footprints and opens bridges over lava', () => {
    for (const p of map.props.filter((q) => ['center', 'shop', 'house'].includes(q.kind))) {
      const [x0, y0, w, h] = propFootprint(p.kind, p.tx, p.ty, p.variant);
      for (let y = y0; y < y0 + h; y++)
        for (let x = x0; x < x0 + w; x++)
          expect(map.blocked(x, y), `${p.kind} ${x},${y}`).toBe(true);
      expect(map.blocked(p.tx, p.ty + 1), `${p.kind} doorstep`).toBe(false);
    }
    const overLava = map.props.filter(
      (b) => b.kind.startsWith('bridge') && map.liquidBlocks(b.tx, b.ty),
    );
    expect(overLava.length).toBeGreaterThan(5);
    for (const b of overLava) expect(map.blocked(b.tx, b.ty)).toBe(false);
  });
});

describe('Ember Pass', () => {
  it('leads from Verdale to Emberwaste and back, facing into each map', () => {
    const there = linkedArrival(content, 'core:verdale', 'ember-pass');
    expect(there).toMatchObject({ map: ID, connection: 'ember-pass', x: 0, facing: 'right' });
    const back = linkedArrival(content, ID, 'ember-pass');
    expect(back).toMatchObject({ map: 'core:verdale', connection: 'ember-pass', facing: 'left' });
    const verdale = loadRegion(content, 'core:verdale');
    expect(back?.x).toBe(verdale.width - 1);
    // Both ends stand on walkable tiles.
    expect(map.blocked(there?.x ?? 0, there?.y ?? 0)).toBe(false);
    expect(verdale.blocked(back?.x ?? 0, back?.y ?? 0)).toBe(false);
  });

  it('leads nowhere while the other region is not loaded', () => {
    const coreOnly = loadGameContent([corePack]);
    expect(linkedArrival(coreOnly, 'core:verdale', 'ember-pass')).toBeUndefined();
    expect(linkedArrival(coreOnly, 'core:verdale', 'ferry')).toBeUndefined();
  });
});
