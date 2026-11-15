import { describe, expect, it } from 'vitest';
import { loadGameContent } from '@game/data';
import { newParty, type Party } from '@game/player';
import { createZorling } from '@game/progression';
import { SHIPPED_PACKS } from '@packs/index';
import { atlasMaps, atlasProgress, atlasRegion, npcMark } from './atlas';
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
