/**
 * Region 1, Verdale (C28): the whole region is walkable and its zones carry the right tier
 * metadata. Also covers the town pieces the map uses (building footprints, bridges, doors).
 */

import { describe, expect, it } from 'vitest';
import { loadGameContent, TIER_LEVELS } from '@game/data';
import { loadRegion } from '@game/world/map';
import { OverworldSim } from '@game/world/overworld/sim';
import { propFootprint } from '@game/world/props';
import { corePack } from '@packs/core';

const content = loadGameContent([corePack]);
const map = loadRegion(content, 'core:verdale');
const spawn = map.anchors['spawn'] ?? { x: -1, y: -1 };
const reach = map.reachableFrom(spawn.x, spawn.y);
const at = (x: number, y: number): number => y * map.width + x;

describe('Verdale map', () => {
  it('is a 200×200 forest region named Verdale', () => {
    expect([map.name, map.biome, map.width, map.height]).toEqual(['Verdale', 'forest', 200, 200]);
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

  it('puts towns outside zones and the big sites in the right tiers', () => {
    for (const town of ['town-willowmere', 'town-fernhollow', 'town-galecrest', 'spawn']) {
      const a = map.anchors[town] ?? { x: 0, y: 0 };
      expect(map.zoneAt(a.x, a.y), town).toBeUndefined();
    }
    const tierAt = (id: string): string | undefined => {
      const a = map.anchors[id] ?? { x: 0, y: 0 };
      return map.zoneAt(a.x, a.y)?.tier;
    };
    expect(tierAt('titan-hollow-oak')).toBe('t2');
    expect(tierAt('titan-sunken-hollow')).toBe('t2');
    expect(tierAt('legendary')).toBe('t3');
    expect(tierAt('boss-crown-rock')).toBe('t3');
    const kinds = (k: string): number =>
      Object.values(map.anchors).filter((a) => a.kind === k).length;
    expect(kinds('secret')).toBe(3);
    expect(kinds('landmark')).toBe(3);
    expect(
      Object.values(map.connections)
        .map((c) => c.kind)
        .sort(),
    ).toEqual(['ferry', 'pass']);
  });

  it('has a Zorling center in every town, with its healer next to the door', () => {
    const centers = map.props.filter((p) => p.kind === 'center');
    expect(centers).toHaveLength(3);
    const sim = new OverworldSim({ content, mapId: 'core:verdale', map, seed: 1 });
    for (const c of centers) {
      expect(map.doorAt(c.tx, c.ty)).toBe('center');
      // Facing the door from the tile below talks to the town's healer.
      sim.player.place({ x: c.tx, y: c.ty + 1 }, 'up');
      const o = sim.facing();
      expect(o?.kind === 'npc' && o.npc.npc.role?.kind).toBe('center');
    }
    expect(map.props.filter((p) => p.kind === 'shop').every((s) => map.doorAt(s.tx, s.ty))).toBe(
      true,
    );
  });

  it('blocks building footprints and opens bridges over water', () => {
    for (const p of map.props.filter((q) => ['center', 'shop', 'house'].includes(q.kind))) {
      const [x0, y0, w, h] = propFootprint(p.kind, p.tx, p.ty, p.variant);
      for (let y = y0; y < y0 + h; y++)
        for (let x = x0; x < x0 + w; x++)
          expect(map.blocked(x, y), `${p.kind} ${x},${y}`).toBe(true);
      expect(map.blocked(p.tx, p.ty + 1), `${p.kind} doorstep`).toBe(false);
    }
    const bridges = map.props.filter((p) => p.kind.startsWith('bridge'));
    expect(bridges.length).toBeGreaterThan(20);
    const overWater = bridges.filter((b) => map.liquidBlocks(b.tx, b.ty));
    expect(overWater.length).toBeGreaterThan(10);
    for (const b of overWater) expect(map.blocked(b.tx, b.ty)).toBe(false);
  });
});
