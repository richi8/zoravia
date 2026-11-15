/**
 * Campfires (C40): resting heals the standing team and costs time, a fire burns down for a
 * day, the props render, and every shipped region has its camp and route fires where the
 * player can walk up to them.
 */

import { describe, expect, it } from 'vitest';
import { loadGameContent } from '@game/data';
import { newParty } from '@game/player';
import { createZorling, statsOf } from '@game/progression';
import { SHIPPED_PACKS } from '@packs/index';
import { BIOMES, BIOME_IDS } from './biomes';
import { campfireLit, FLAME_FRAMES } from './campfire';
import { GLOW } from './glow';
import { DAY_LENGTH } from './lighting';
import { loadRegion } from './map';
import { atlasRegion } from './atlas';
import { ExploredMap } from './explore';
import { buildProp, Painter, PROP_INFO, propFootprint } from './props';
import { dayClock, fireKey, fireLit, NO_CAMP, REST, REST_SECONDS, restAt, restParty } from './rest';

const content = loadGameContent([...SHIPPED_PACKS]);
const REGIONS = ['core:verdale', 'emberwaste:emberwaste', 'rimeholm:rimeholm'];

describe('resting', () => {
  const z = (uid: string, hp: (max: number) => number) => {
    const base = createZorling(content, { uid, species: 'core:galehawk', level: 30 });
    return { ...base, hp: hp(statsOf(content, base).hp) };
  };

  it('heals standing team Zorlings to full and leaves fainted ones fainted', () => {
    const party = newParty({
      team: [z('a', (m) => Math.floor(m / 3)), z('b', () => 0), z('c', (m) => m)],
      bag: {},
      money: 0,
    });
    const stored = { ...z('s', () => 1) };
    const rested = restParty(content, { ...party, storage: [stored] });
    const first = party.team[0];
    if (!first) throw new Error('no team');
    const max = statsOf(content, first).hp;
    expect(rested.team.map((t) => t.hp)).toEqual([max, 0, max]);
    // Storage stays at the center; a fire does not reach it.
    expect(rested.storage[0]?.hp).toBe(1);
  });

  it('moves the day clock on and burns the fire down for a day', () => {
    const key = fireKey('core:verdale', 102, 67, [0, 0]);
    const t0 = 500;
    expect(fireLit(NO_CAMP, key, t0)).toBe(true);
    const camp = restAt(NO_CAMP, key, t0);
    expect(camp.clock).toBe(REST_SECONDS);
    expect(REST.hours).toBeGreaterThanOrEqual(3);
    expect(dayClock(camp, t0)).toBe(t0 + (DAY_LENGTH * REST.hours) / 24);
    expect(fireLit(camp, key, t0)).toBe(false);
    expect(() => restAt(camp, key, t0 + 10)).toThrow();
    // Another fire still burns.
    expect(fireLit(camp, fireKey('core:verdale', 19, 262, [0, 0]), t0)).toBe(true);
    // One full day of the clock later it burns again.
    expect(fireLit(camp, key, t0 + REST.cooldown - 1)).toBe(false);
    expect(fireLit(camp, key, t0 + REST.cooldown)).toBe(true);
  });

  it('forgets fires that burn again', () => {
    const a = fireKey('m', 1, 1, [0, 0]);
    const b = fireKey('m', 2, 2, [0, 0]);
    const once = restAt(NO_CAMP, a, 0);
    const later = restAt(once, b, REST.cooldown + 5);
    expect(Object.keys(later.fires)).toEqual([b]);
    expect(later.clock).toBe(2 * REST_SECONDS);
  });

  it('keys a fire by its tile from the map origin, so a grown map keeps it', () => {
    expect(fireKey('m', 30, 50, [0, 20])).toBe(fireKey('m', 30, 30, [0, 0]));
  });
});

describe('campfire props', () => {
  it('bakes burnt down, with flickering lit frames that glow', () => {
    for (const id of BIOME_IDS) {
      const p = new Painter(BIOMES[id]);
      const baked = buildProp(p, 'campfire', 0);
      const frames = Array.from({ length: FLAME_FRAMES }, (_, f) => campfireLit(p, f));
      const flame = (s: typeof baked): number =>
        [...(s.glow ?? [])].filter((g) => g === GLOW.flame).length;
      for (const f of frames) {
        expect([f.width, f.height]).toEqual([baked.width, baked.height]);
        expect(flame(f)).toBeGreaterThan(flame(baked) * 5);
      }
      expect(flame(baked)).toBeGreaterThan(0);
      expect(new Set(frames.map((f) => f.data.join())).size).toBe(FLAME_FRAMES);
    }
    expect(PROP_INFO.campfire.solid).toBe(true);
    expect(propFootprint('tent', 10, 10)).toEqual([9, 9, 3, 2]);
  });
});

describe('placed campfires', () => {
  for (const id of REGIONS) {
    const m = loadRegion(content, id);
    const fires = m.props.filter((p) => p.kind === 'campfire');
    const spawn = m.anchors['spawn'];
    const reach = spawn ? m.reachableFrom(spawn.x, spawn.y) : new Uint8Array();

    it(`${id}: a fire and a tent in its danger-zone camp, and route fires`, () => {
      const camp = Object.entries(m.anchors).find(([k]) => /^town-.*-camp$/.test(k))?.[1];
      if (!camp) throw new Error('no danger-zone camp');
      const near = (p: { tx: number; ty: number }): boolean =>
        Math.abs(p.tx - camp.x) <= 6 && Math.abs(p.ty - camp.y) <= 5;
      expect(fires.filter(near)).toHaveLength(1);
      expect(m.props.filter((p) => p.kind === 'tent' && near(p))).toHaveLength(1);
      const routes = fires.filter((p) => !near(p));
      expect(routes.length).toBeGreaterThanOrEqual(1);
      expect(routes.length).toBeLessThanOrEqual(2);
      for (const p of routes) expect(['t2', 't3']).toContain(m.zoneAt(p.tx, p.ty)?.tier);
    });

    it(`${id}: every fire can be walked up to and faced`, () => {
      expect(spawn).toBeDefined();
      for (const p of fires) {
        expect(m.blocked(p.tx, p.ty)).toBe(true);
        const sides = [
          [p.tx, p.ty + 1],
          [p.tx, p.ty - 1],
          [p.tx + 1, p.ty],
          [p.tx - 1, p.ty],
        ] as const;
        expect(sides.some(([x, y]) => reach[y * m.width + x] === 1)).toBe(true);
      }
    });

    it(`${id}: fires show on the map window once explored`, () => {
      const party = newParty({ team: [], bag: {}, money: 0 });
      const dark = atlasRegion(content, party, id, m, new ExploredMap(m.width, m.height));
      expect(dark.markers.filter((k) => k.kind === 'campfire')).toHaveLength(0);
      const lit = new ExploredMap(m.width, m.height);
      for (const p of fires) lit.reveal(p.tx, p.ty);
      const shown = atlasRegion(content, party, id, m, lit).markers;
      expect(shown.filter((k) => k.kind === 'campfire')).toHaveLength(fires.length);
    });
  }
});
