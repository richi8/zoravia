/**
 * The C31 playthrough simulator on Emberwaste (C34): each team plan plays the whole campaign
 * from a new game (one Lv 6 starter) with real XP, money, shops and battles, ash storms
 * included, and finishes it at Verdale's pace. `npm run balance -- --region emberwaste` prints
 * the full report.
 */

import { ASHEN_RIFT } from '@packs/emberwaste/ashen-rift';
import { describe, expect, it } from 'vitest';
import { loadGameContent } from '@game/data';
import { levelCap } from '@game/progression';
import { loadRegion } from '@game/world/map';
import { SHIPPED_PACKS } from '@packs/index';
import { EMBERWASTE_ROUTE, EMBERWASTE_START, EMBERWASTE_TEAMS } from './emberwaste';
import { playthrough, type PlaythroughResult } from './playthrough';

const content = loadGameContent([...SHIPPED_PACKS]);
const MAP = 'emberwaste:emberwaste';
const map = loadRegion(content, MAP);

const run = (team: (typeof EMBERWASTE_TEAMS)[number], seed: number): PlaythroughResult =>
  playthrough(content, {
    route: EMBERWASTE_ROUTE,
    zones: map.zones,
    ...EMBERWASTE_START,
    ...team,
    seed,
  });

describe('Emberwaste playthrough', () => {
  it.each(EMBERWASTE_TEAMS.map((t) => [t.starter, t] as const))(
    '%s: the campaign is finished at a steady pace',
    (_, team) => {
      for (const seed of [1, 2, 3]) {
        const r = run(team, seed);
        expect(r.finished, `seed ${seed}`).toBe(true);
        expect(r.goals.map((g) => g.id)).toContain('emberwaste:calderon');
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

  it('fights in an ash storm exactly where the NPC stands in one', () => {
    const npcOf = (goal: (typeof EMBERWASTE_ROUTE)[number]['goals'][number]): string =>
      'trainer' in goal ? goal.trainer : `${goal.boss}-lair`;
    for (const stage of EMBERWASTE_ROUTE) {
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
    // The campaign route covers every zone but the endgame's danger zones (C36).
    const keys = new Set(map.zones.filter((z) => z.tier !== 'danger').map((z) => z.key));
    const zones = EMBERWASTE_ROUTE.flatMap((s) => s.zones);
    for (const k of zones) expect(keys.has(k), k).toBe(true);
    expect(new Set(zones).size).toBe(keys.size);
    const onRoute = new Set(
      EMBERWASTE_ROUTE.flatMap((s) => s.goals).map((g) => ('trainer' in g ? g.trainer : g.boss)),
    );
    // The danger zone's trainers (C36) are endgame, not on the campaign route.
    const endgame = new Set(Object.keys(ASHEN_RIFT.trainers).map((k) => `emberwaste:${k}`));
    for (const t of content.trainers.inNamespace('emberwaste')) {
      if (endgame.has(t.id)) continue;
      expect(onRoute.has(t.id), t.id).toBe(true);
    }
  });

  it('the badge comes before the Titans', () => {
    const team = EMBERWASTE_TEAMS[0];
    if (!team) throw new Error('No team plan');
    const r = run(team, 1);
    const order = r.goals.map((g) => g.id);
    expect(order.indexOf('emberwaste:forgemaster-hale')).toBeLessThan(
      order.indexOf('emberwaste:dunewyrm-titan'),
    );
    expect(r.party.badges).toEqual(['emberwaste:kiln-badge']);
  });
});
