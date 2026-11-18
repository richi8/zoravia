import { describe, expect, it } from 'vitest';
import { loadGameContent } from '@game/data';
import { dexPages, newParty, type Party } from '@game/player';
import { createZorling } from '@game/progression';
import { SHIPPED_PACKS } from '@packs/index';
import {
  atlasMaps,
  atlasProgress,
  atlasRegion,
  npcMark,
  speciesHabitats,
  zoneEdges,
} from './atlas';
import { ExploredMap, visit } from './explore';
import { loadRegion } from './map';

const content = loadGameContent([...SHIPPED_PACKS]);
const MAP = 'core:verdale';
const verdale = loadRegion(content, MAP);

function party(over: Partial<Party> = {}): Party {
  const z = createZorling(content, { uid: 'a', species: 'core:sproutle', level: 10 });
  return { ...newParty({ team: [z] }), ...over };
}

/** Everything revealed and every place discovered. */
function allSeen(): ExploredMap {
  const e = new ExploredMap(verdale.width, verdale.height);
  e.cells.fill(1);
  for (let y = 0; y < verdale.height; y += 4)
    for (let x = 0; x < verdale.width; x += 4) visit(verdale, e, x, y);
  return e;
}

describe('Atlas', () => {
  it('has every start region', () => {
    expect(atlasMaps(content)).toEqual([
      'core:verdale',
      'emberwaste:emberwaste',
      'rimeholm:rimeholm',
    ]);
  });

  it('gives away nothing of a dark map', () => {
    const fresh = party({ dex: { seen: [], caught: [] } });
    const r = atlasRegion(
      content,
      fresh,
      MAP,
      verdale,
      new ExploredMap(verdale.width, verdale.height),
    );
    expect(r.markers).toEqual([]);
    expect(r.places).toEqual([]);
    expect(r.zones.every((z) => !z.known)).toBe(true);
    expect(r.fights.every((f) => !f.known && !f.weakSpot)).toBe(true);
    expect(r.zones.flatMap((z) => z.spawns).every((s) => s.name === undefined)).toBe(true);
  });

  it('marks every region’s big fights, derived or tagged in its pack', () => {
    for (const id of atlasMaps(content)) {
      const m = loadRegion(content, id);
      const kinds = content.npcs
        .values()
        .filter((n) => n.map === id)
        .map((n) => npcMark(content, n))
        .filter((k) => k !== undefined);
      const count = (k: string): number => kinds.filter((x) => x === k).length;
      expect(count('trial'), id).toBe(2);
      expect(count('rival'), id).toBeGreaterThanOrEqual(3);
      expect(count('titan'), id).toBe(2);
      expect(count('legendary'), id).toBe(1);
      expect(count('boss'), id).toBe(1);
      expect(count('elder'), id).toBe(2);
      expect(count('keeper'), id).toBe(1);
      expect(count('gate'), id).toBe(1);
      expect(count('trainer'), id).toBeGreaterThanOrEqual(14);
      expect(m.width).toBeGreaterThan(0);
    }
  });

  it('shows known zones with the wild Zorlings seen and caught', () => {
    const p = party({ dex: { seen: ['core:pipwing'], caught: ['core:sproutle'] } });
    const r = atlasRegion(content, p, MAP, verdale, allSeen());
    const meadow = r.zones.find((z) => z.key === 'meadow');
    expect(meadow).toMatchObject({ known: true, name: 'Sunny Meadow', tier: 't1' });
    const pip = meadow?.spawns.find((s) => s.species === 'core:pipwing');
    expect(pip).toMatchObject({ name: 'Pipwing', seen: true, caught: false });
    expect(meadow?.spawns.find((s) => s.species === 'core:sproutle')?.caught).toBe(true);
    expect(r.markers.some((m) => m.kind === 'town' && m.name === 'Willowmere')).toBe(true);
  });

  it('logs a Titan’s weak spot only once it is beaten or caught', () => {
    const e = allSeen();
    const titan = (p: Party) =>
      atlasRegion(content, p, MAP, verdale, e).fights.find(
        (f) => f.npc === 'core:mossback-titan-lair',
      );
    const before = titan(party());
    expect(before).toMatchObject({ kind: 'titan', known: true });
    expect(before?.weakSpot).toBeUndefined();
    const after = titan(party({ bosses: { 'core:mossback-titan': { result: 'caught' } } }));
    expect(after?.result).toBe('caught');
    expect(after?.weakSpot?.length).toBeGreaterThan(0);
  });

  it('shows NPCs only while they are there, or once beaten', () => {
    const e = allSeen();
    const finale = (p: Party) =>
      atlasRegion(content, p, MAP, verdale, e).markers.some(
        (m) => m.kind === 'rival' && m.x === 102 && m.y === 64,
      );
    expect(finale(party())).toBe(false);
    expect(finale(party({ trainers: { 'core:mira-finale': { wins: 1 } } }))).toBe(true);
  });

  it('counts badges, hearts and the Dex', () => {
    const p = party({
      badges: ['core:grove-badge'],
      trainers: { 'core:keeper-ysolde': { wins: 1 } },
    });
    const progress = atlasProgress(content, p);
    expect(progress.badges).toEqual([1, content.badges.size]);
    expect(progress.hearts).toEqual([1, 3]);
    expect(progress.dex[1]).toBe(content.species.size);
  });
});

describe('Dex pages and habitat (C42)', () => {
  it('has All, then one page per region with its own counts', () => {
    const dex = { seen: ['core:pipwing', 'emberwaste:sizzlet'], caught: ['core:pipwing'] };
    const pages = dexPages(content, dex);
    expect(pages.map((p) => p.name)).toEqual(['All', 'Verdale', 'Emberwaste', 'Rimeholm Isles']);
    expect(pages[0]?.entries).toHaveLength(content.species.size);
    expect(pages.slice(1).reduce((n, p) => n + p.entries.length, 0)).toBe(content.species.size);
    expect(pages[0]).toMatchObject({ seen: 2, caught: 1 });
    expect(pages[1]).toMatchObject({ seen: 1, caught: 1 });
    expect(pages[2]).toMatchObject({ seen: 1, caught: 0 });
    expect(pages[3]).toMatchObject({ seen: 0, caught: 0 });
    expect(pages[2]?.entries.every((e) => e.species.startsWith('emberwaste:'))).toBe(true);
  });

  it('lists the entered zones where a seen species lives, and nothing else', () => {
    const dark = (): ExploredMap => new ExploredMap(1, 1);
    const explored = (id: string): ExploredMap => (id === MAP ? allSeen() : dark());
    const p = party({ dex: { seen: ['core:pipwing', 'core:sprigling'], caught: [] } });
    const h = speciesHabitats(content, p, explored);
    expect(h.get('core:pipwing')).toEqual([
      'Sunny Meadow',
      'Willow Shore',
      'Brookside Trail',
      'Fernwood',
    ]);
    // Unseen species and dark maps show nothing.
    expect(h.has('core:voltbat')).toBe(false);
    expect(speciesHabitats(content, p, dark).size).toBe(0);
    // A starter's zone shows only once its spawn is open (after the badge).
    expect(h.has('core:sprigling')).toBe(false);
    const badge = party({ ...p, badges: ['core:grove-badge'] });
    expect(speciesHabitats(content, badge, explored).get('core:sprigling')).toEqual([
      'Sunny Meadow',
    ]);
  });

  it('lists a starter in its zone on the map window only after the badge', () => {
    const meadow = (p: Party) =>
      atlasRegion(content, p, MAP, verdale, allSeen())
        .zones.find((z) => z.key === 'meadow')
        ?.spawns.map((s) => s.species);
    expect(meadow(party())).not.toContain('core:sprigling');
    expect(meadow(party({ badges: ['core:grove-badge'] }))).toContain('core:sprigling');
  });
});

describe('zone edges (C36d)', () => {
  it('outlines a small grid: every border tile of a zone, as row runs', () => {
    // 4×3: zone 1 fills the left 3 columns, zone 2 the last one.
    const zoneIndex = Uint8Array.from([1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2]);
    const edges = zoneEdges({ width: 4, height: 3, zoneIndex, zones: [{}, {}] as never });
    expect(edges[0]).toEqual([
      [0, 0, 3],
      [0, 1, 1],
      [2, 1, 1],
      [0, 2, 3],
    ]);
    expect(edges[1]).toEqual([
      [3, 0, 1],
      [3, 1, 1],
      [3, 2, 1],
    ]);
  });

  it('gives every Verdale zone an outline made of its own tiles', () => {
    const edges = zoneEdges(verdale);
    verdale.zones.forEach((z, i) => {
      const runs = edges[i] ?? [];
      expect(runs.length, z.key).toBeGreaterThan(0);
      for (const [x, y, n] of runs)
        for (let k = 0; k < n; k++) expect(verdale.zoneAt(x + k, y)?.key).toBe(z.key);
    });
    const region = atlasRegion(content, party(), MAP, verdale, allSeen());
    expect(region.zones[0]?.edge).toEqual(edges[0]);
  });
});
