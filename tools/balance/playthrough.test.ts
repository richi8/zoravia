/**
 * The C31 playthrough simulator on Verdale: each team plan plays the whole campaign from a
 * new game (one Lv 6 starter) with real XP, money, shops and battles, and finishes it within
 * the pacing the balance pass settled on. `npm run balance` prints the full report.
 */

import { describe, expect, it } from 'vitest';
import { loadGameContent } from '@game/data';
import { levelCap } from '@game/progression';
import { loadRegion } from '@game/world/map';
import { corePack } from '@packs/core';
import { playthrough, type PlaythroughResult } from './playthrough';
import { VERDALE_ROUTE, VERDALE_START, VERDALE_TEAMS } from './verdale';

const content = loadGameContent([corePack]);
const zones = loadRegion(content, 'core:verdale').zones;

const run = (team: (typeof VERDALE_TEAMS)[number], seed: number): PlaythroughResult =>
  playthrough(content, { route: VERDALE_ROUTE, zones, ...VERDALE_START, ...team, seed });

describe('Verdale playthrough', () => {
  it.each(VERDALE_TEAMS.map((t) => [t.starter, t] as const))(
    '%s: the campaign is finished at a steady pace',
    (_, team) => {
      for (const seed of [1, 2, 3]) {
        const r = run(team, seed);
        expect(r.finished, `seed ${seed}`).toBe(true);
        expect(r.goals.map((g) => g.id)).toContain('core:verdion');
        // About 2–4 hours: no long grind anywhere, no fight that takes many tries.
        expect(r.wildBattles).toBeGreaterThan(80);
        expect(r.wildBattles).toBeLessThan(200);
        expect(r.minutes / 60).toBeLessThan(5);
        for (const g of r.goals) {
          expect(g.wildBattles, g.id).toBeLessThanOrEqual(60);
          expect(g.attempts, g.id).toBeLessThanOrEqual(10);
        }
        // The region is done below the soft level cap of one badge.
        const cap = levelCap(1);
        for (const z of r.party.team) expect(z.level).toBeLessThan(cap);
      }
    },
  );

  it('the first fights come without grinding, and the badge before the Titans', () => {
    const team = VERDALE_TEAMS[2];
    if (!team) throw new Error('No team plan');
    const r = run(team, 1);
    const at = (id: string) => r.goals.find((g) => g.id === `core:${id}`);
    expect(at('picnicker-nell')?.wildBattles).toBeLessThanOrEqual(10);
    const order = r.goals.map((g) => g.id);
    expect(order.indexOf('core:warden-elm')).toBeLessThan(order.indexOf('core:bogmaw-titan'));
    expect(r.party.badges).toEqual(['core:grove-badge']);
  });

  it('no starter is quietly worse up to the late fights (C41)', () => {
    // Vex and Verdion are left out: a Sprigling team wins those by following their hints.
    const late = new Set(['core:stormcatcher-vex', 'core:verdion']);
    const seeds = [1, 2, 3, 4, 5, 6];
    const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
    const plans = VERDALE_TEAMS.map((team) => {
      const runs = seeds.map((seed) => run(team, seed));
      const early = runs.map((r) => r.goals.filter((g) => !late.has(g.id)));
      return {
        battles: mean(early.map((gs) => gs.reduce((s, g) => s + g.wildBattles, 0))),
        losses: mean(early.map((gs) => gs.reduce((s, g) => s + g.wildLosses, 0))),
      };
    });
    const spread = (f: (p: (typeof plans)[number]) => number): number =>
      Math.max(...plans.map(f)) - Math.min(...plans.map(f));
    // Tighter than the plan's "about 15 battles and 5 losses" over 20 seeds: over these 6
    // seeds the spread was 4 battles and 2.7 losses after C41, 8 and 4.8 before it.
    expect(spread((p) => p.battles)).toBeLessThanOrEqual(10);
    expect(spread((p) => p.losses)).toBeLessThanOrEqual(3.5);
  });

  it('is deterministic for a seed', () => {
    const team = VERDALE_TEAMS[0];
    if (!team) throw new Error('No team plan');
    expect(run(team, 7)).toEqual(run(team, 7));
  });
});
