import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadGameContent, TILE_TALL } from '@game/data';
import { decodeRegion, encodeRegion, loadRegion, WorldMap } from '@game/world/map';
import { corePack } from '@packs/core';
import { asciiMap } from './ascii';
import { regionConfigSchema, type RegionConfigInput } from './config';
import { buildRegion, file, readGenerated, regionDir, regionDirs, stringifyMap } from './files';
import { generateRegion } from './generate';
import { applyOverlay, OverlayError, type OverlayInput } from './overlay';

const CONFIG: RegionConfigInput = {
  name: 'Gen test',
  biome: 'forest',
  seed: 77,
  width: 64,
  height: 48,
  zones: {
    inner: { name: 'Inner', tier: 't1' },
    east: { name: 'East', tier: 't2' },
    west: { name: 'West', tier: 't2' },
    outer: { name: 'Outer', tier: 't3' },
  },
};
const gen = (patch: Partial<RegionConfigInput> = {}): WorldMap =>
  generateRegion(regionConfigSchema.parse({ ...CONFIG, ...patch }));

describe('region generator', () => {
  it('is deterministic per seed', () => {
    const a = encodeRegion(gen());
    expect(encodeRegion(gen())).toEqual(a);
    expect(encodeRegion(gen({ seed: 78 }))).not.toEqual(a);
  });

  it.each(['forest', 'desert', 'frozen'] as const)(
    '%s: every exit is reachable from the spawn',
    (biome) => {
      const m = gen({ biome });
      const spawn = m.anchors['spawn'];
      const seen = m.reachableFrom(spawn?.x ?? -1, spawn?.y ?? -1);
      expect(Object.keys(m.connections).sort()).toEqual(['east', 'north', 'south', 'west']);
      for (const c of Object.values(m.connections)) expect(seen[c.y * m.width + c.x]).toBe(1);
    },
  );

  it('lays tiers out as rings around the hub and closes the edges', () => {
    const m = gen();
    const spawn = m.anchors['spawn'] ?? { x: 0, y: 0 };
    const dist: Record<string, number[]> = {};
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) {
        const z = m.zoneAt(x, y);
        if (z) (dist[z.tier] ??= []).push(Math.hypot(x - spawn.x, y - spawn.y));
      }
    }
    const mean = (t: string): number => {
      const d = dist[t] ?? [];
      return d.reduce((a, b) => a + b, 0) / d.length;
    };
    expect(mean('t1')).toBeLessThan(mean('t2'));
    expect(mean('t2')).toBeLessThan(mean('t3'));
    expect(m.zoneAt(spawn.x, spawn.y)).toBeUndefined(); // town
    // Both t2 sectors exist.
    const keys = new Set<string>();
    for (let i = 0; i < m.zoneIndex.length; i++)
      keys.add(m.zones[(m.zoneIndex[i] ?? 0) - 1]?.key ?? '');
    expect(keys).toContain('east');
    expect(keys).toContain('west');
    // The border is blocked except where paths leave.
    const exits = new Set(Object.values(m.connections).map((c) => `${c.x},${c.y}`));
    let open = 0;
    for (let x = 0; x < m.width; x++) {
      for (const y of [0, m.height - 1]) if (!m.blocked(x, y) && !exits.has(`${x},${y}`)) open++;
    }
    expect(open).toBeLessThanOrEqual(8); // only the path's own width next to each exit
  });

  it('writes a valid map', () => {
    expect(() => buildFrom(gen(), {})).not.toThrow();
  });
});

describe('authored layout (C28)', () => {
  const LAYOUT: RegionConfigInput = {
    name: 'Layout test',
    biome: 'forest',
    seed: 5,
    width: 64,
    height: 64,
    zones: {
      near: { name: 'Near', tier: 't1' },
      far: { name: 'Far', tier: 't3' },
    },
    layout: {
      towns: { hub: { name: 'Hub', at: [32, 32], radius: 5 } },
      routes: [
        {
          points: [
            [32, 32],
            [32, 63],
          ],
        },
        {
          points: [
            [32, 32],
            [10, 12],
          ],
        },
      ],
      rivers: [
        {
          points: [
            [0, 44],
            [63, 44],
          ],
          width: 3,
        },
      ],
      lakes: [{ at: [50, 14], radius: [7, 6] }],
      islands: [{ at: [50, 14], radius: [2.5, 2] }],
      ponds: 0,
      clearings: [
        { id: 'lair', kind: 'lair', at: [10, 12], radius: 3 },
        { id: 'glade', kind: 'secret', at: [50, 30], radius: 2, ring: true, gap: 'west' },
      ],
      fords: [
        {
          points: [
            [41, 15],
            [48, 14],
          ],
        },
      ],
      zones: {
        near: { seeds: [[32, 32]] },
        far: {
          seeds: [
            [8, 8],
            [56, 56],
            [8, 56],
            [56, 8],
          ],
        },
      },
      exits: { south: { at: [32, 63], kind: 'pass' } },
    },
  };
  const make = (patch: Partial<RegionConfigInput> = {}): WorldMap =>
    generateRegion(regionConfigSchema.parse({ ...LAYOUT, ...patch }));
  const m = make();
  const spawn = m.anchors['spawn'] ?? { x: -1, y: -1 };
  const reach = m.reachableFrom(spawn.x, spawn.y);

  it('is deterministic per seed', () => {
    expect(encodeRegion(make())).toEqual(encodeRegion(m));
    expect(encodeRegion(make({ seed: 6 }))).not.toEqual(encodeRegion(m));
  });

  it('places towns, clearings and exits as anchors and connections', () => {
    expect(spawn).toMatchObject({ x: 32, y: 33, kind: 'spawn' });
    expect(m.anchors['town-hub']).toMatchObject({ x: 32, y: 32, kind: 'town' });
    expect(m.anchors['lair']).toMatchObject({ kind: 'lair' });
    expect(m.connections['south']).toMatchObject({ x: 32, y: 63, kind: 'pass' });
    expect(m.zoneAt(32, 32)).toBeUndefined();
    expect(m.zoneAt(32, 40)?.key).toBe('near');
    expect(m.zoneAt(4, 4)?.key).toBe('far');
  });

  it('bridges routes over rivers and makes fords walkable', () => {
    const bridges = m.props.filter((p) => p.kind === 'bridge-v');
    expect(bridges.length).toBeGreaterThan(0);
    expect(bridges.every((b) => Math.abs(b.tx - 32) <= 2)).toBe(true);
    expect(m.liquidCorners(32, 44)).toBe(4);
    expect(m.blocked(32, 44)).toBe(false);
    expect(reach[(m.connections['south']?.y ?? 0) * m.width + 32]).toBe(1);
    // The island is reached over the ford's lily pads.
    expect(reach[14 * m.width + 50]).toBe(1);
    expect(m.props.some((p) => p.kind === 'pad' && p.tx === 44)).toBe(true);
  });

  it('leaves every walkable tile reachable from the spawn', () => {
    for (let i = 0; i < reach.length; i++) {
      if (!m.blocked(i % m.width, Math.floor(i / m.width))) expect(reach[i]).toBe(1);
    }
    expect(reach[(m.anchors['glade']?.y ?? 0) * m.width + 50]).toBe(1);
  });

  it('rejects layout zones missing from "zones"', () => {
    const bad = structuredClone(LAYOUT);
    if (bad.layout) bad.layout.zones = { ...bad.layout.zones, nope: { seeds: [[1, 1]] } };
    expect(() => generateRegion(regionConfigSchema.parse(bad))).toThrow(/nope/);
  });
});

function buildFrom(m: WorldMap, overlay: OverlayInput): WorldMap {
  return decodeRegion(encodeRegion(applyOverlay(m, overlay)));
}

describe('overlay', () => {
  const base = (): WorldMap => {
    const m = new WorldMap({ name: 'Base', biome: 'forest', seed: 1, width: 8, height: 6 });
    m.zones = [{ key: 'a', name: 'A', glyph: 'a', tier: 't1', levels: [3, 5], spawns: [] }];
    m.zoneIndex.fill(1);
    m.props = [
      { kind: 'tree', tx: 1, ty: 1 },
      { kind: 'rock', tx: 6, ty: 4 },
    ];
    m.anchors = { spawn: { x: 0, y: 0, kind: 'spawn' }, old: { x: 1, y: 0, kind: 'npc' } };
    m.refreshCollision();
    return m;
  };

  it('never changes its input', () => {
    const m = base();
    const before = encodeRegion(m);
    applyOverlay(m, {
      edits: [{ op: 'terrain', layer: 'liquid', set: true, rect: { x: 0, y: 0, w: 8, h: 6 } }],
    });
    expect(encodeRegion(m)).toEqual(before);
  });

  it('edits terrain by tile rect and by corner stamp', () => {
    const m = applyOverlay(base(), {
      edits: [
        { op: 'terrain', layer: 'liquid', set: true, rect: { x: 3, y: 2, w: 2, h: 2 } },
        { op: 'stamp', layer: 'liquid', at: [3, 2], rows: ['-.#'] },
        { op: 'stamp', layer: 'path', at: [0, 5], rows: ['##', '##'] },
      ],
    });
    expect(m.liquid.get(3, 2)).toBe(0);
    expect(m.liquid.get(4, 2)).toBe(1);
    expect(m.liquid.get(5, 4)).toBe(1);
    expect(m.liquid.get(6, 4)).toBe(0);
    expect(m.blocked(4, 3)).toBe(true);
    expect(m.path.get(1, 6)).toBe(1);
  });

  it('edits tall grass, props, collision and zones', () => {
    const m = applyOverlay(base(), {
      zones: { b: { name: 'B', glyph: 'b', tier: 't2', levels: [15, 16] } },
      edits: [
        { op: 'tall', set: true, rect: { x: 0, y: 3, w: 2, h: 1 } },
        { op: 'clearProps', rect: { x: 0, y: 0, w: 3, h: 3 } },
        { op: 'prop', kind: 'bush', at: [6, 4], variant: 2 },
        { op: 'collision', rect: { x: 5, y: 0, w: 1, h: 1 }, mode: 'block' },
        { op: 'collision', rect: { x: 6, y: 4, w: 1, h: 1 }, mode: 'open' },
        { op: 'zone', rect: { x: 4, y: 0, w: 4, h: 6 }, zone: 'b' },
        { op: 'zone', rect: { x: 0, y: 5, w: 1, h: 1 }, zone: null },
      ],
    });
    expect(m.tall(1, 3)).toBe(true);
    expect((m.flags[3 * 8 + 2] ?? 0) & TILE_TALL).toBe(0);
    expect(m.props).toEqual([{ kind: 'bush', tx: 6, ty: 4, variant: 2 }]);
    expect(m.blocked(1, 1)).toBe(false);
    expect(m.blocked(5, 0)).toBe(true);
    expect(m.blocked(6, 4)).toBe(false); // the bush is solid, but the tile is forced open
    expect(m.zoneAt(3, 0)?.key).toBe('a');
    expect(m.zoneAt(4, 0)?.key).toBe('b');
    expect(m.zoneAt(0, 5)).toBeUndefined();
  });

  it('patches, adds and removes zones, anchors and connections', () => {
    const m = applyOverlay(base(), {
      name: 'Renamed',
      zones: { a: { levels: [4, 5], spawns: [{ species: 'core:puddlit' }] } },
      anchors: { old: null, door: { x: 3, y: 3, kind: 'center' } },
      connections: { east: { x: 7, y: 2, kind: 'edge', to: 'core:other#west' } },
    });
    expect(m.name).toBe('Renamed');
    expect(m.zone('a')).toMatchObject({ name: 'A', glyph: 'a', levels: [4, 5] });
    expect(m.zone('a')?.spawns).toEqual([{ species: 'core:puddlit', weight: 1 }]);
    expect(Object.keys(m.anchors).sort()).toEqual(['door', 'spawn']);
    expect(m.connections['east']?.to).toBe('core:other#west');
    const gone = applyOverlay(base(), { zones: { a: null } });
    expect(gone.zones).toEqual([]);
    expect(gone.zoneAt(0, 0)).toBeUndefined();
  });

  it('lists every problem at once', () => {
    const run = (): WorldMap =>
      applyOverlay(base(), {
        zones: { c: { name: 'C' } },
        anchors: { far: { x: 50, y: 0 } },
        edits: [
          { op: 'tall', set: true, rect: { x: 6, y: 0, w: 4, h: 1 }, note: 'too wide' },
          { op: 'zone', rect: { x: 0, y: 0, w: 1, h: 1 }, zone: 'nope' },
          { op: 'stamp', layer: 'alt', at: [8, 0], rows: ['##'] },
        ],
      });
    expect(run).toThrow(OverlayError);
    try {
      run();
    } catch (e) {
      expect((e as OverlayError).problems).toEqual([
        'zones.c: a new zone needs name, glyph, tier and levels',
        'edits[0] (tall: too wide): rect (6, 0, 4×1) leaves the 8×6 map',
        'edits[1] (zone): unknown zone "nope"',
        'edits[2] (stamp): stamp at (8, 0) leaves the 9×7 corner grid',
        'anchors.far: (50, 0) is outside the map',
      ]);
    }
  });
});

describe('shipped regions', () => {
  it('every map.json is up to date with its base and overlay', () => {
    const dirs = regionDirs();
    expect(dirs.map((d) => d.ref)).toContain('core/test-region');
    for (const r of dirs) {
      const shipped = readFileSync(file(r, 'map'), 'utf8');
      expect(shipped, `${r.ref}: run npm run world -- build`).toBe(stringifyMap(buildRegion(r)));
    }
  });

  it('the overlay overrides generated tiles in the map the game loads', () => {
    const r = regionDir('core/test-region');
    const generated = decodeRegion(readGenerated(r));
    const loaded = loadRegion(loadGameContent([corePack]), 'core:test-region');
    // Town pond: dry ground in the base, water in the game.
    expect(generated.liquidCorners(61, 53)).toBe(0);
    expect(loaded.liquidCorners(61, 53)).toBe(4);
    expect(loaded.blocked(61, 53)).toBe(true);
    // Zorling center footprint: forced blocked.
    expect(generated.blocked(48, 44)).toBe(false);
    expect(loaded.blocked(48, 44)).toBe(true);
    // Tall grass patch and a new zone.
    expect(generated.tall(65, 46)).toBe(false);
    expect(loaded.tall(65, 46)).toBe(true);
    expect(generated.zone('shore')).toBeUndefined();
    expect(loaded.zoneAt(35, 50)?.key).toBe('shore');
    expect(loaded.zone('meadow')?.spawns.length).toBeGreaterThan(0);
    // Away from the edits, the generated base is unchanged.
    expect(asciiMap(loaded, { rect: { x: 0, y: 0, width: 30, height: 30 } })).toBe(
      asciiMap(generated, { rect: { x: 0, y: 0, width: 30, height: 30 } }),
    );
  });
});

describe('map file layout', () => {
  it('keeps short arrays on one line and chunk rows one per line', () => {
    const text = stringifyMap({
      levels: [3, 8],
      rows: ['0'.repeat(40), '1'.repeat(40), '2'.repeat(40)],
    });
    expect(text).toContain('"levels": [3, 8]');
    expect(text.split('\n').filter((l) => l.includes('000'))).toHaveLength(1);
    expect(JSON.parse(text)).toEqual({
      levels: [3, 8],
      rows: ['0'.repeat(40), '1'.repeat(40), '2'.repeat(40)],
    });
  });
});
