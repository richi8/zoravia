/**
 * The C31 playthrough simulator on Rimeholm (C35): each team plan plays the whole campaign
 * from a new game (one Lv 6 starter) with real XP, money, shops and battles, sleet storms
 * included, and finishes it at Verdale's pace. `npm run balance -- --region rimeholm` prints
 * the full report.
 */

import { describe, expect, it } from 'vitest';
import { loadGameContent } from '@game/data';
import { levelCap } from '@game/progression';
import { loadRegion } from '@game/world/map';
import { SHIPPED_PACKS } from '@packs/index';
import { RIMEHOLM_ROUTE, RIMEHOLM_START, RIMEHOLM_TEAMS } from './rimeholm';
import { playthrough, type PlaythroughResult } from './playthrough';

const content = loadGameContent([...SHIPPED_PACKS]);
const MAP = 'rimeholm:rimeholm';
const map = loadRegion(content, MAP);

const run = (team: (typeof RIMEHOLM_TEAMS)[number], seed: number): PlaythroughResult =>
  playthrough(content, {
    route: RIMEHOLM_ROUTE,
    zones: map.zones,
    ...RIMEHOLM_START,
    ...team,
    seed,
  });

describe('Rimeholm playthrough', () => {
  it.each(RIMEHOLM_TEAMS.map((t) => [t.starter, t] as const))(
    '%s: the campaign is finished at a steady pace',
    (_, team) => {
      for (const seed of [1, 2, 3]) {
        const r = run(team, seed);
        expect(r.finished, `seed ${seed}`).toBe(true);
        expect(r.goals.map((g) => g.id)).toContain('rimeholm:glacivar');
        expect(r.wildBattles).toBeGreaterThan(80);
        expect(r.wildBattles).toBeLessThan(200);
        expect(r.minutes / 60).toBeLessThan(5);
        for (const g of r.goals) {
          expect(g.wildBattles, g.id).toBeLessThanOrEqual(60);
          expect(g.attempts, g.id).toBeLessThanOrEqual(10);
        }
        const cap = levelCap(1);
        for (const z of r.party.team) expect(z.level).toBeLessThan(cap);
      }
    },
  );

  it('fights in a sleet storm exactly where the NPC stands in one', () => {
    const npcOf = (goal: (typeof RIMEHOLM_ROUTE)[number]['goals'][number]): string =>
      'trainer' in goal ? goal.trainer : `${goal.boss}-lair`;
    for (const stage of RIMEHOLM_ROUTE) {
      for (const goal of stage.goals) {
        const n = content.npcs.require(npcOf(goal));
        const a = n.anchor !== undefined ? map.anchors[n.anchor] : undefined;
        const x = a?.x ?? n.x ?? -1;
        const y = a?.y ?? n.y ?? -1;
        expect(goal.weather ?? [], npcOf(goal)).toEqual(map.zoneAt(x, y)?.battleWeather ?? []);
      }
    }
  });

  it('every route zone exists and every story trainer of the region is on the route', () => {
    const keys = new Set(map.zones.map((z) => z.key));
    const zones = RIMEHOLM_ROUTE.flatMap((s) => s.zones);
    for (const k of zones) expect(keys.has(k), k).toBe(true);
    expect(new Set(zones).size).toBe(keys.size);
    const onRoute = new Set(
      RIMEHOLM_ROUTE.flatMap((s) => s.goals).map((g) => ('trainer' in g ? g.trainer : g.boss)),
    );
    for (const t of content.trainers.inNamespace('rimeholm')) {
      expect(onRoute.has(t.id), t.id).toBe(true);
    }
  });

  it('the badge comes before the Titans', () => {
    const team = RIMEHOLM_TEAMS[0];
    if (!team) throw new Error('No team plan');
    const r = run(team, 1);
    const order = r.goals.map((g) => g.id);
    expect(order.indexOf('rimeholm:tidemaster-sigrun')).toBeLessThan(
      order.indexOf('rimeholm:floemaw-titan'),
    );
    expect(r.party.badges).toEqual(['rimeholm:tide-badge']);
  });
});
