import { describe, expect, it } from 'vitest';
import { loadGameContent } from '@game/data';
import { SHIPPED_PACKS } from '@packs/index';
import {
  CELL_TILES,
  ExploredMap,
  exploredData,
  exploredMap,
  legacyExploration,
  mapPlaces,
  placeName,
  REVEAL_RADIUS,
  visit,
} from './explore';
import { loadRegion, WorldMap } from './map';

const content = loadGameContent([...SHIPPED_PACKS]);
const verdale = loadRegion(content, 'core:verdale');

describe('exploration', () => {
  it('starts dark and reveals cells within the radius of the player', () => {
    const e = new ExploredMap(40, 40);
    expect(e.explored).toBe(0);
    expect(e.reveal(20, 20)).toBe(true);
    expect(e.seen(20, 20)).toBe(true);
    expect(e.seen(20 + REVEAL_RADIUS - 2, 20)).toBe(true);
    expect(e.seen(20 + REVEAL_RADIUS + CELL_TILES, 20)).toBe(false);
    // Standing still reveals nothing new.
    expect(e.reveal(20, 20)).toBe(false);
    expect(e.seen(-1, 0)).toBe(false);
  });

  it('names places from their anchor keys', () => {
    expect(placeName('town-thornveil-camp')).toBe('Thornveil Camp');
    expect(placeName('hollow-oak')).toBe('Hollow Oak');
  });

  it('lists every zone and named place of a region', () => {
    const places = mapPlaces(verdale);
    expect(places.filter((p) => p.kind === 'zone')).toHaveLength(verdale.zones.length);
    const willowmere = places.find((p) => p.key === 'anchor:town-willowmere');
    expect(willowmere).toMatchObject({ kind: 'town', name: 'Willowmere' });
    const glade = places.find((p) => p.key === 'anchor:hidden-glade');
    expect(glade?.kind).toBe('secret');
    // A landmark inside a zone carries the zone's levels.
    expect(places.find((p) => p.key === 'anchor:stone-circle')?.levels).toBeDefined();
    // Spawn points and NPC spots are not places.
    expect(places.some((p) => p.key === 'anchor:spawn')).toBe(false);
  });

  it('discovers the zone entered and places in range, once', () => {
    const e = new ExploredMap(verdale.width, verdale.height);
    const town = verdale.anchors['town-willowmere'];
    if (!town) throw new Error('no Willowmere');
    const first = visit(verdale, e, town.x, town.y).map((p) => p.name);
    expect(first).toContain('Willowmere');
    expect(visit(verdale, e, town.x, town.y)).toEqual([]);
    // Walk into the first tile of Sunny Meadow.
    const meadow = verdale.zone('meadow');
    let at: { x: number; y: number } | undefined;
    for (let y = 0; y < verdale.height && !at; y++)
      for (let x = 0; x < verdale.width && !at; x++)
        if (verdale.zoneAt(x, y) === meadow) at = { x, y };
    if (!at) throw new Error('no meadow tile');
    const found = visit(verdale, e, at.x, at.y);
    expect(found.map((p) => p.key)).toContain('zone:meadow');
    expect(found.find((p) => p.key === 'zone:meadow')?.levels).toEqual(meadow?.levels);
  });

  it('saves and loads cells and places', () => {
    const e = new ExploredMap(verdale.width, verdale.height);
    visit(verdale, e, 100, 199);
    visit(verdale, e, 30, 110);
    const data = JSON.parse(JSON.stringify(exploredData(verdale, e))) as ReturnType<
      typeof exploredData
    >;
    expect(data.origin).toEqual([0, 80]);
    const back = exploredMap(verdale, data);
    expect([...back.cells]).toEqual([...e.cells]);
    expect([...back.places].sort()).toEqual([...e.places].sort());
    // Places a map no longer has are dropped; broken cells read as dark.
    const odd = exploredMap(verdale, { ...data, cells: '!!', places: ['anchor:gone'] });
    expect(odd.explored).toBe(0);
    expect(odd.places.size).toBe(0);
  });

  it('moves cells along when the map grew on its north side', () => {
    const before = new WorldMap({ name: 'R', biome: 'forest', seed: 1, width: 40, height: 40 });
    const e = new ExploredMap(40, 40);
    e.reveal(10, 10, 1);
    const data = exploredData(before, e);
    const grown = new WorldMap({ name: 'R', biome: 'forest', seed: 1, width: 40, height: 60 });
    grown.origin = [0, 20];
    const moved = exploredMap(grown, data);
    expect(moved.seen(10, 10)).toBe(false);
    expect(moved.seen(10, 30)).toBe(true);
  });

  it('gives saves from before exploration a reveal around what they prove', () => {
    const out = legacyExploration(
      content,
      {
        places: [{ map: 'core:verdale', x: 104, y: 144 }],
        trainers: { 'core:picnicker-nell': { wins: 1 } },
        bosses: {},
      },
      (id) => loadRegion(content, id),
    );
    expect(Object.keys(out)).toEqual(['core:verdale']);
    const e = exploredMap(verdale, out['core:verdale']);
    expect(e.seen(104, 144)).toBe(true);
    // Picnicker Nell's spot, and the hub (Willowmere) of the region.
    expect(e.seen(96, 228)).toBe(true);
    expect(e.seen(100, 199)).toBe(true);
    expect(e.places.has('anchor:town-willowmere')).toBe(true);
    expect(e.places.has('anchor:town-fernhollow')).toBe(true);
    // The danger zone stays dark.
    expect(e.seen(100, 9)).toBe(false);
    expect(e.places.has('zone:elderroot')).toBe(false);
  });
});
