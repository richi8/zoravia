import { describe, expect, it } from 'vitest';
import { loadGameContent } from '@game/data';
import { readSave } from '@game/save';
import { SHIPPED_PACKS } from '@packs/index';
import v5 from '../../../tests/fixtures/saves/v5.json';
import v6 from '../../../tests/fixtures/saves/v6.json';
import { BIOMES } from './biomes';
import { exploredData, exploredMap } from './explore';
import { rideSeconds, voyage } from './overworld/boat';
import { worldBounds, worldLayout } from './world-layout';
import { composeWorld, worldFor, type World } from './world-compose';

const content = loadGameContent([...SHIPPED_PACKS]);
const world = worldFor(content, 'core:verdale');
const region = (id: string) => {
  const r = world.region(id);
  if (!r) throw new Error(`no ${id}`);
  return r;
};
const V = region('core:verdale');
const E = region('emberwaste:emberwaste');
const R = region('rimeholm:rimeholm');

/** Walkable tiles reachable from `from` by 4-way steps. */
function reach(w: World, from: { x: number; y: number }): Uint8Array {
  return w.map.reachableFrom(from.x, from.y);
}

describe('world composition (C37)', () => {
  it('places every region at its C36c world place', () => {
    const layout = worldLayout(content);
    const b = worldBounds(layout);
    expect([world.map.width, world.map.height]).toEqual([b.width, b.height]);
    for (const l of layout) {
      const r = region(l.map);
      expect([r.x, r.y]).toEqual([l.x - b.x, l.y - b.y]);
      expect(r.layout).toEqual({ x: l.x, y: l.y });
    }
    // Same object for the same content: composed once.
    expect(worldFor(content, 'emberwaste:emberwaste')).toBe(world);
  });

  it('copies each region tile for tile, with unique zone and anchor keys', () => {
    for (const r of world.regions) {
      for (let i = 0; i < 400; i++) {
        const x = (i * 37) % r.map.width;
        const y = (i * 53) % r.map.height;
        expect(world.map.tall(r.x + x, r.y + y)).toBe(r.map.tall(x, y));
        expect(world.map.zoneAt(r.x + x, r.y + y)?.name).toBe(r.map.zoneAt(x, y)?.name);
        expect(world.regionAt(r.x + x, r.y + y)).toBe(r);
        expect(world.biomeAt(r.x + x, r.y + y)).toBe(r.biome);
      }
    }
    const keys = world.map.zones.map((z) => z.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain('core:verdale/meadow');
    expect(world.map.anchors['core:verdale/spawn']).toEqual({
      ...V.map.anchors['spawn'],
      x: (V.map.anchors['spawn']?.x ?? 0) + V.x,
      y: (V.map.anchors['spawn']?.y ?? 0) + V.y,
    });
  });

  it('converts world tiles and region tiles both ways', () => {
    expect(world.toWorld('emberwaste:emberwaste', 0, 104)).toEqual({ x: E.x, y: E.y + 104 });
    expect(world.toLocal(E.x, E.y + 104)).toEqual({ region: E, x: 0, y: 104 });
    expect(world.toWorld('gone:map', 1, 1)).toBeUndefined();
    // Filler between Verdale and Rimeholm belongs to no region.
    expect(world.toLocal(V.x + 88, V.y + 290)).toBeUndefined();
  });

  it('keeps nothing outside a region walkable', () => {
    const { map } = world;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (world.regionAt(x, y)) continue;
        expect(map.blocked(x, y), `filler (${x}, ${y})`).toBe(true);
      }
    }
  });

  it('lays open sea between Verdale and Rimeholm, water even next to the desert', () => {
    const { map } = world;
    for (let y = V.y + V.map.height + 1; y < R.y - 1; y++) {
      for (let x = 0; x < map.width; x++) {
        expect(map.liquidCorners(x, y), `sea (${x}, ${y})`).toBe(4);
        expect(world.lookAt(x, y).liquid).toBe('water');
      }
    }
    // South of Emberwaste the sea keeps the desert's look, but it is water.
    const south = world.lookAt(E.x + 100, E.y + E.map.height + 5);
    expect(south.ramps.ground).toEqual(BIOMES.desert.ramps.ground);
    expect(south.liquid).toBe('water');
  });

  it('turns the double tree wall into one border, open only at Ember Pass', () => {
    const seam = E.x;
    const from = Math.max(V.y, E.y);
    const to = Math.min(V.y + V.map.height, E.y + E.map.height);
    const open: number[] = [];
    let innerSolid = 0;
    let rows = 0;
    for (let y = from; y < to; y++) {
      const a = world.map.blocked(seam - 1, y);
      const b = world.map.blocked(seam, y);
      expect(a, `row ${y}: both sides open or both closed`).toBe(b);
      if (!a) {
        open.push(y - V.y);
        continue;
      }
      rows++;
      if (world.map.blocked(seam - 2, y)) innerSolid++;
      if (world.map.blocked(seam + 1, y)) innerSolid++;
    }
    // Only the pass road is open (Verdale rows 182–186).
    expect(open).toEqual([182, 183, 184, 185, 186]);
    // The rows behind the line thin out: no second solid wall.
    expect(innerSolid / (rows * 2)).toBeLessThan(0.6);
    // Walking from Verdale's spawn reaches Emberwaste's Cinderwell through the pass.
    const seen = reach(world, world.toWorld('core:verdale', 100, 228) ?? { x: 0, y: 0 });
    const ember = world.toWorld('emberwaste:emberwaste', 20, 104) ?? { x: 0, y: 0 };
    expect(seen[ember.y * world.map.width + ember.x]).toBe(1);
  });

  it('builds the ferry from the link and its route data, both piers on the water', () => {
    expect(world.ferries).toHaveLength(1);
    const f = world.ferries[0];
    if (!f) return;
    expect(f.a.region).toBe(V);
    expect(f.b.region).toBe(R);
    expect(f.a.tile).toEqual({ x: V.x + 88, y: V.y + 279 });
    expect(f.b.tile).toEqual({ x: R.x + 100, y: R.y + 0 });
    expect(f.a.facing).toBe('up');
    expect(f.b.facing).toBe('down');
    expect(f.route[0]).toEqual(f.a.dock);
    expect(f.route[f.route.length - 1]).toEqual(f.b.dock);
    // Every step of the route is open water (blocked for walking).
    for (let i = 1; i < f.route.length; i++) {
      const a = f.route[i - 1] ?? { x: 0, y: 0 };
      const b = f.route[i] ?? { x: 0, y: 0 };
      const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      for (let k = 0; k <= n; k++) {
        const x = Math.round(a.x + ((b.x - a.x) * k) / n);
        const y = Math.round(a.y + ((b.y - a.y) * k) / n);
        expect(world.map.liquidCorners(x, y), `route (${x}, ${y})`).toBe(4);
      }
    }
    // Facing the boat from either pier boards it, the other way round too.
    expect(world.ferryAt(f.a.tile, f.a.front)?.to).toBe(f.b);
    expect(world.ferryAt(f.b.tile, f.b.front)?.to).toBe(f.a);
    expect(world.ferryAt(f.a.front, f.a.tile)).toBeUndefined();
    expect(world.ferryFrom('rimeholm:rimeholm', 'ferry')?.to).toBe(f.a);
    // About 10–15 s on the water.
    const s = rideSeconds(voyage(f.route));
    expect(s).toBeGreaterThanOrEqual(10);
    expect(s).toBeLessThanOrEqual(15);
  });

  it('places every NPC of every region at its world tile', () => {
    const npcs = world.npcs(content);
    const inWorld = content.npcs.values().filter((n) => world.region(n.map));
    expect(npcs).toHaveLength(inWorld.length);
    const gus = npcs.find((p) => p.npc.id === 'core:ferryman-gus');
    const a = V.map.anchors['ferryman'];
    expect(gus && [gus.x, gus.y]).toEqual([V.x + (a?.x ?? 0), V.y + (a?.y ?? 0)]);
    expect(gus?.npc.ferry).toBe('ferry');
  });

  it('composes a map without a world place on its own (the debug map)', () => {
    const w = worldFor(content, 'core:test-region');
    expect(w.regions.map((r) => [r.id, r.x, r.y])).toEqual([['core:test-region', 0, 0]]);
    expect([w.map.width, w.map.height]).toEqual([
      w.regions[0]?.map.width,
      w.regions[0]?.map.height,
    ]);
    expect(w.ferries).toEqual([]);
  });

  it('rejects an empty world', () => {
    expect(() => composeWorld(content, [])).toThrow();
  });

  it('loads the v5 and v6 saves at the same place, with the same exploration', () => {
    for (const raw of [v5, v6]) {
      const s = readSave(content, raw);
      const t = world.toWorld(s.place.map, s.place.x, s.place.y);
      expect(t, s.place.map).toBeDefined();
      if (!t) continue;
      const back = world.toLocal(t.x, t.y);
      expect(back && { map: back.region.id, x: back.x, y: back.y }).toEqual({
        map: s.place.map,
        x: s.place.x,
        y: s.place.y,
      });
      expect(world.map.blocked(t.x, t.y)).toBe(false);
      // Exploration stays per region: read and written back unchanged.
      for (const [id, data] of Object.entries(s.explored)) {
        const r = world.region(id);
        if (!r) continue;
        expect(exploredData(r.map, exploredMap(r.map, data))).toEqual(data);
      }
    }
    expect(readSave(content, v6).place.map).toBe('emberwaste:emberwaste');
  });
});
