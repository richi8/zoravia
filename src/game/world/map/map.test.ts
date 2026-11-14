import { describe, expect, it } from 'vitest';
import { definePack, PackError, type NamespacedId } from '@engine/packs';
import {
  loadGameContent,
  regionMapSchema,
  TILE_BLOCK,
  TILE_OPEN,
  TILE_TALL,
  type RegionMapData,
  type RegionMapInput,
} from '@game/data';
import { corePack } from '@packs/core';
import { decodeRegion, encodeRegion, loadRegion, WorldMap } from '.';

/** 10×7 tiles in 4-tile chunks: a 3×2 chunk grid with smaller edge chunks. */
function sample(): WorldMap {
  const m = new WorldMap({
    name: 'Sample',
    biome: 'forest',
    seed: 3,
    width: 10,
    height: 7,
    chunkSize: 4,
  });
  m.zones = [
    { key: 'field', name: 'Field', glyph: 'f', tier: 't1', levels: [3, 6], spawns: [] },
    { key: 'bog', name: 'Bog', glyph: 'b', tier: 't2', levels: [15, 18], spawns: [] },
  ];
  for (let cy = 0; cy <= 3; cy++) for (let cx = 7; cx <= 10; cx++) m.liquid.set(cx, cy, true);
  for (let cx = 0; cx <= 10; cx++) m.path.set(cx, 6, true);
  m.alt.set(0, 0, true);
  m.alt.set(10, 7, true);
  m.flags[2 * 10 + 1] = TILE_TALL;
  m.flags[5 * 10 + 9] = TILE_BLOCK;
  m.zoneIndex.fill(1, 0, 35);
  m.zoneIndex.fill(2, 35);
  m.props = [
    { kind: 'tree', tx: 2, ty: 1, variant: 3, dx: -1 },
    { kind: 'flowers', tx: 5, ty: 5 },
    { kind: 'rock', tx: 9, ty: 6, dy: 2 },
  ];
  m.anchors = { spawn: { x: 1, y: 4, kind: 'spawn', facing: 'down' } };
  m.connections = { east: { x: 9, y: 4, kind: 'edge' } };
  m.refreshCollision();
  return m;
}

describe('map codec', () => {
  it('round-trips a map with partial edge chunks', () => {
    const m = sample();
    const data = regionMapSchema.parse(encodeRegion(m));
    expect(data.chunks).toHaveLength(6);
    // Last column/row chunks also hold the closing corner column/row.
    const last = data.chunks.find((c) => c.x === 2 && c.y === 1);
    expect(last?.corners).toHaveLength(4);
    expect(last?.corners[0]).toHaveLength(3);
    expect(last?.tiles).toHaveLength(3);
    const back = decodeRegion(data);
    expect(back.alt.data).toEqual(m.alt.data);
    expect(back.path.data).toEqual(m.path.data);
    expect(back.liquid.data).toEqual(m.liquid.data);
    expect(back.flags).toEqual(m.flags);
    expect(back.zoneIndex).toEqual(m.zoneIndex);
    expect(back.props).toEqual(m.props);
    expect(back.anchors).toEqual(m.anchors);
    expect(encodeRegion(back)).toEqual(data);
  });

  it('writes chunk rows as readable characters', () => {
    const data = encodeRegion(sample());
    const first = data.chunks[0];
    expect(first?.corners[0]).toBe('1000');
    expect(first?.tiles[2]).toBe('0100');
    expect(first?.zones[0]).toBe('ffff');
    expect(first?.props).toEqual([['tree', 2, 1, 3, -1, 0]]);
  });
});

describe('map collision and chunks', () => {
  it('blocks mostly-liquid tiles, solid props, forced tiles and the outside', () => {
    const m = sample();
    expect(m.blocked(8, 1)).toBe(true); // lake (4 liquid corners)
    expect(m.blocked(6, 1)).toBe(true); // side shore: 2 liquid corners, waterline through the body
    expect(m.blocked(8, 3)).toBe(false); // top shore: feet on the bank
    expect(m.blocked(6, 3)).toBe(false); // 1 liquid corner
    expect(m.blocked(2, 1)).toBe(true); // tree
    expect(m.blocked(5, 5)).toBe(false); // flowers are not solid
    expect(m.blocked(9, 5)).toBe(true); // TILE_BLOCK
    expect(m.blocked(-1, 0)).toBe(true);
    expect(m.blocked(10, 0)).toBe(true);
    m.flags[1 * 10 + 8] = TILE_OPEN; // e.g. a bridge
    m.refreshCollision();
    expect(m.blocked(8, 1)).toBe(false);
    expect(m.tall(1, 2)).toBe(true);
  });

  it('finds zones per tile', () => {
    const m = sample();
    expect(m.zoneAt(0, 0)?.key).toBe('field');
    expect(m.zoneAt(9, 6)?.key).toBe('bog');
    expect(m.zoneAt(20, 0)).toBeUndefined();
  });

  it('cuts the map into chunks', () => {
    const m = sample();
    expect([m.chunksWide, m.chunksHigh]).toEqual([3, 2]);
    expect(m.chunkRect(2, 1)).toEqual({ x: 8, y: 4, width: 2, height: 3 });
    expect(m.chunksIn({ x: 3, y: 3, width: 2, height: 2 })).toEqual([
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]);
    expect(m.chunksIn({ x: -5, y: -5, width: 100, height: 100 })).toHaveLength(6);
  });

  it('floods walkable tiles', () => {
    const m = sample();
    const seen = m.reachableFrom(1, 4);
    expect(seen[4 * 10 + 9]).toBe(1);
    expect(seen[1 * 10 + 8]).toBe(0);
  });

  it('converts to the C11 terrain map', () => {
    const t = sample().toTerrainMap();
    expect(t.tall).toEqual([[1, 2]]);
    expect(t.props).toHaveLength(3);
  });
});

describe('map validation', () => {
  type Data = RegionMapInput & {
    chunks: RegionMapData['chunks'];
    anchors: RegionMapData['anchors'];
  };
  const need = <T>(v: T | undefined): T => {
    if (v === undefined) throw new Error('missing test data');
    return v;
  };
  const issues = (patch: (d: Data) => void): string[] => {
    const d = structuredClone(encodeRegion(sample()));
    patch(d);
    const r = regionMapSchema.safeParse(d);
    return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  };

  it('accepts a valid map', () => {
    expect(issues(() => {})).toEqual([]);
  });

  it('reports layout problems with their path', () => {
    expect(issues((d) => (need(d.chunks[0]).tiles[1] = '012'))).toEqual([
      'chunks.0.tiles.1: Expected 4 characters, got 3',
    ]);
    expect(issues((d) => (need(d.chunks[1]).zones[0] = 'ffxf'))).toEqual([
      'chunks.1.zones.0: Unknown zone glyph "x"',
    ]);
    expect(issues((d) => d.chunks.pop())).toEqual(['chunks: Expected 6 chunks, got 5']);
    expect(issues((d) => need(d.chunks[0]).props.push(['rock', 6, 0, 0, 0, 0]))).toEqual([
      'chunks.0.props.1: Prop at (6, 0) is outside its chunk',
    ]);
    expect(issues((d) => (need(d.zones['bog']).levels = [12, 18]))).toEqual([
      'zones.bog.levels: Tier t2 levels must stay within 15–30',
    ]);
    expect(issues((d) => (need(d.zones['bog']).glyph = 'f'))).toContain(
      'zones.bog.glyph: Glyph "f" is also used by "field"',
    );
    expect(issues((d) => (need(d.anchors['spawn']).x = 10))).toEqual([
      'anchors.spawn: (10, 4) is outside the map',
    ]);
  });

  it('checks spawn species after loading', () => {
    const data = encodeRegion(sample());
    need(data.zones['field']).spawns = [
      { species: 'core:sproutl' as NamespacedId, weight: 1 },
      { species: 'core:verdion' as NamespacedId, weight: 1 },
    ];
    // C34: battle weather names conditions.
    need(data.zones['field']).battleWeather = ['core:burnin' as NamespacedId];
    const mod = definePack({
      manifest: { id: 'mod', version: '1.0.0', dependsOn: ['core'] },
      content: { maps: { sample: data } },
    });
    let err: unknown;
    try {
      loadGameContent([corePack, mod]);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PackError);
    const text = (err as PackError).message;
    expect(text).toContain(
      '[mod] content.maps.sample.zones.field.spawns[0].species: Unknown species "core:sproutl"',
    );
    expect(text).toContain(
      '[mod] content.maps.sample.zones.field.spawns[1].species: Legendaries do not spawn in the wild',
    );
    expect(text).toContain(
      '[mod] content.maps.sample.zones.field.battleWeather[0]: Unknown conditions "core:burnin"',
    );
  });
});

describe('core test region', () => {
  const content = loadGameContent([corePack]);
  const m = loadRegion(content, 'core:test-region');

  it('loads from the core pack', () => {
    expect(loadRegion(content, 'core:test-region')).toBe(m);
    expect([m.width, m.height, m.chunksWide, m.chunksHigh]).toEqual([96, 96, 3, 3]);
    expect(m.biome).toBe('forest');
    expect(m.zones.map((z) => z.tier)).toContain('t3');
    for (const z of m.zones) expect(z.spawns.length).toBeGreaterThan(0);
  });

  it('can walk from the spawn to every connection point', () => {
    const spawn = m.anchors['spawn'];
    expect(spawn).toBeDefined();
    const seen = m.reachableFrom(spawn?.x ?? 0, spawn?.y ?? 0);
    const conns = Object.values(m.connections);
    expect(conns.length).toBe(4);
    for (const c of conns) expect(seen[c.y * m.width + c.x]).toBe(1);
  });
});
