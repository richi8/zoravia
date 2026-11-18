/**
 * Region 3, the Rimeholm Isles (C35): its Zorlings, trainers, Titans and legendary. Checks the
 * roster (types, starters, stages), the spawn tables against evolution levels, trainers placed
 * in the right zones, and balance simulations: starters against the first wild Zorlings, the
 * Titans and Glacivar beaten by reactions more than by brute force (in the sleet storm where
 * their lair has one), and route trainers against a team at their level.
 */

import { describe, expect, it } from 'vitest';
import {
  aiChoice,
  aiReplacement,
  createBattle,
  legalReplacements,
  needsReplacement,
  OPPONENT,
  PLAYER,
  simulateBoss,
  step,
  type AiStyle,
  type SimPolicy,
} from '@game/battle/logic';
import { loadGameContent, statBand, statTotal, TIER_LEVELS, trainerTeam } from '@game/data';
import { createZorling, type Zorling } from '@game/progression';
import { loadRegion } from '@game/world/map';
import { openSpawns } from '@game/world/overworld/sim';
import { SHIPPED_PACKS } from '@packs/index';
import { ROUTE_TRAINERS } from './trainers';

const content = loadGameContent([...SHIPPED_PACKS]);
const MAP = 'rimeholm:rimeholm';
const map = loadRegion(content, MAP);
const e = (local: string): string => `rimeholm:${local}`;
const full = (s: string): string => (s.includes(':') ? s : e(s));

const STARTERS = ['selkit', 'woolump', 'sparkit'];
const zones = Object.values(map.zones);
/** The wild of a new game: spawns with a story condition (C42, starters after the badge) left out. */
const wild = new Set(zones.flatMap((z) => openSpawns(z).map((s) => s.species)));
/** The spawns that need a story condition (C42). */
const gated = zones.flatMap((z) =>
  z.spawns.filter((s) => s.if).map((s) => ({ zone: z, spawn: s })),
);
const roster = content.species.inNamespace('rimeholm');
const trainerNpcs = content.npcs
  .values()
  .filter(
    (n) =>
      n.map === MAP &&
      n.dialogue &&
      Object.hasOwn(ROUTE_TRAINERS, n.dialogue.slice('rimeholm:'.length)),
  );

let uid = 0;
const make = (species: string, level: number, moves?: string[]): Zorling => ({
  ...createZorling(content, { uid: `r${uid++}`, species: full(species), level }),
  ...(moves ? { moves: moves.map((m) => (m.includes(':') ? m : `core:${m}`)) } : {}),
});

/** Plays a battle to the end with both sides run by the AI. */
function fight(
  kind: 'wild' | 'trainer',
  player: Zorling[],
  opponent: Zorling[],
  seed: number,
  style: AiStyle,
): 'won' | 'lost' | 'other' {
  let { state } = createBattle(content, { kind, seed, player, opponent, bag: {} });
  for (let i = 0; i < 300 && state.phase !== 'ended'; i++) {
    if (state.phase === 'replace') {
      const side = needsReplacement(state, PLAYER) ? PLAYER : OPPONENT;
      const to =
        side === PLAYER
          ? aiReplacement(content, state, PLAYER)
          : (legalReplacements(state, OPPONENT)[0] ?? 0);
      state = step(content, state, { kind: 'replace', side, to }).state;
      continue;
    }
    state = step(content, state, {
      kind: 'turn',
      player: aiChoice(content, state, PLAYER, style),
      opponent: aiChoice(content, state, OPPONENT, kind === 'wild' ? 'wild' : 'trainer'),
    }).state;
  }
  return state.outcome === 'win' ? 'won' : state.outcome === 'lose' ? 'lost' : 'other';
}

const winRate = (runs: number, play: (seed: number) => string): number => {
  let wins = 0;
  for (let seed = 0; seed < runs; seed++) if (play(seed) === 'won') wins++;
  return wins / runs;
};

describe('Rimeholm roster', () => {
  it('has about 20 species in 1-, 2- and 3-stage lines, in the stat bands', () => {
    expect(roster.length).toBeGreaterThanOrEqual(20);
    const lengths = new Set(roster.map((s) => content.evolutionLine(s.id).members.length));
    expect([...lengths].sort()).toEqual([1, 2, 3]);
    for (const s of roster) {
      const line = content.evolutionLine(s.id);
      const band = statBand(line.stage, line.members.length, s.legendary, s.rare);
      expect(Math.abs(statTotal(s.baseStats) - band) / band, s.name).toBeLessThan(0.05);
    }
    expect(roster.filter((s) => s.legendary).map((s) => s.name)).toEqual(['Glacivar']);
  });

  it('has three 3-stage starters (Water, Earth, Electric) that join the wild only after the badge', () => {
    const types = STARTERS.map((id) => {
      const line = content.evolutionLine(e(id));
      expect(line.stage, id).toBe(1);
      expect(line.members, id).toHaveLength(3);
      for (const m of line.members) expect(wild.has(m.id), m.id).toBe(false);
      // After the badge (C42): the first stage only, in one T1 zone.
      const later = gated.filter((g) => line.members.some((m) => m.id === g.spawn.species));
      expect(
        later.map((g) => g.spawn.species),
        id,
      ).toEqual([e(id)]);
      expect(later[0]?.zone.tier, id).toBe('t1');
      expect(later[0]?.spawn.if, id).toEqual({ badge: 'rimeholm:tide-badge' });
      return content.species.require(e(id)).types[0];
    });
    expect(types).toEqual(['core:water', 'core:earth', 'core:electric']);
  });

  it('every species lives somewhere: a starter line, a zone or a boss lair', () => {
    const bossSpecies = new Set(content.bosses.values().map((b) => b.species));
    for (const s of roster) {
      const first = content.evolutionLine(s.id).members[0]?.id ?? '';
      const starter = STARTERS.map(e).includes(first);
      expect(starter || wild.has(s.id) || bossSpecies.has(s.id), s.name).toBe(true);
    }
  });

  it('the wild has all 8 types, weighted toward Ice, Water and Electric', () => {
    const count = new Map<string, number>();
    for (const z of zones) {
      for (const sp of z.spawns) {
        for (const t of content.species.require(sp.species).types) {
          count.set(t, (count.get(t) ?? 0) + sp.weight);
        }
      }
    }
    expect(count.size).toBe(8);
    const ranked = [...count].sort((a, b) => b[1] - a[1]).map(([t]) => t);
    for (const t of ['ice', 'water', 'electric']) {
      expect(ranked.indexOf(`core:${t}`), t).toBeLessThan(3);
    }
  });

  it('wild Zorlings spawn at levels that fit their evolution stage', () => {
    for (const z of zones) {
      for (const sp of z.spawns) {
        const [lo, hi] = sp.levels ?? z.levels;
        const s = content.species.require(sp.species);
        const line = content.evolutionLine(s.id);
        const before = line.members[line.stage - 2];
        if (s.evolution) expect(hi, `${z.key} ${s.name} evolves`).toBeLessThan(s.evolution.level);
        if (before?.evolution) {
          expect(lo, `${z.key} ${s.name} too young`).toBeGreaterThanOrEqual(before.evolution.level);
        }
      }
    }
  });
});

describe('Rimeholm trainers', () => {
  it('stand at the roadside of a zone, with teams in its level band', () => {
    expect(trainerNpcs.length).toBeGreaterThanOrEqual(10);
    const reach = map.reachableFrom(map.anchors['spawn']?.x ?? 0, map.anchors['spawn']?.y ?? 0);
    const tiers = new Set<string>();
    for (const n of trainerNpcs) {
      const x = n.x ?? -1;
      const y = n.y ?? -1;
      expect(map.blocked(x, y), n.name).toBe(false);
      expect(reach[y * map.width + x], n.name).toBe(1);
      const zone = map.zoneAt(x, y);
      expect(zone, n.name).toBeDefined();
      if (!zone) continue;
      tiers.add(zone.tier);
      const trainer = content.trainers.require(n.dialogue ?? '');
      expect(trainer.prize, n.name).toBeGreaterThan(0);
      for (const m of trainerTeam(trainer, 0).team) {
        const [lo, hi] = TIER_LEVELS[zone.tier];
        expect(m.level, `${n.name} ${m.species}`).toBeGreaterThanOrEqual(lo);
        expect(m.level, `${n.name} ${m.species}`).toBeLessThanOrEqual(hi);
      }
    }
    expect([...tiers].sort()).toEqual(['t1', 't2', 't3']);
  });

  it('a team at the trainer’s top level usually wins', () => {
    for (const n of trainerNpcs) {
      const trainer = content.trainers.require(n.dialogue ?? '');
      const team = trainerTeam(trainer, 0).team;
      const top = Math.max(...team.map((m) => m.level));
      const theirs = (): Zorling[] =>
        team.map((m) => createZorling(content, { uid: `t${uid++}`, ...m }));
      // A balanced Rimeholm team: a starter line plus two common wild Zorlings.
      const mine = (): Zorling[] =>
        top < 16
          ? [make('selkit', top), make('spinzap', top), make('flurret', top)]
          : top < 32
            ? [make('selkurr', top), make('urchivolt', top), make('rimestoat', top)]
            : [make('selkaris', top), make('urchivolt', top), make('rimestoat', top)];
      const rate = winRate(20, (seed) => fight('trainer', mine(), theirs(), seed, 'trainer'));
      expect(rate, n.name).toBeGreaterThanOrEqual(0.5);
    }
  });
});

describe('Rimeholm balance', () => {
  it('a new Lv 6 starter beats the Shingle Shore’s spawn table (weights and levels) most of the time', () => {
    const flats = map.zone('shingle');
    expect(flats).toBeDefined();
    const [lo, hi] = flats?.levels ?? [0, 0];
    expect(hi).toBeLessThanOrEqual(6);
    for (const starter of STARTERS) {
      let rate = 0;
      let weights = 0;
      for (const sp of flats ? openSpawns(flats) : []) {
        for (let level = lo; level <= hi; level++) {
          const r = winRate(20, (seed) =>
            fight('wild', [make(starter, 6)], [make(sp.species, level)], seed, 'trainer'),
          );
          rate += r * sp.weight;
          weights += sp.weight;
        }
      }
      expect(rate / weights, starter).toBeGreaterThanOrEqual(0.6);
    }
  });

  const bossRun = (
    boss: string,
    team: () => Zorling[],
    policy: SimPolicy,
    potions = 0,
    weather?: readonly string[],
  ) =>
    winRate(40, (seed) =>
      simulateBoss(content, {
        boss: e(boss),
        team: team(),
        bag: { 'core:zorb': 1, 'core:super-potion': potions },
        policy,
        seed,
        ...(weather ? { weather } : {}),
      }).outcome === 'caught'
        ? 'won'
        : 'lost',
    );
  const reactions: SimPolicy = { style: 'reactions', potion: 'core:super-potion' };
  const brute0: SimPolicy = { style: 'brute' };
  const potions: SimPolicy = { style: 'brute', potion: 'core:super-potion' };

  it.each([
    [
      'floemaw-titan',
      // The sleet storm soaks it; Ice (Frost Fang) sets off Frozen, and Drench soaks it again
      // once a reaction has used the Wet up.
      () => [
        make('selkurr', 18, ['drench', 'tide-crash', 'frost-fang']),
        make('fluxine', 18, ['static-bite', 'volt-lash', 'frost-fang']),
        make('shagtusk', 18, ['mud-toss', 'rock-slam', 'frost-fang']),
      ],
      ['core:wet'],
    ],
    [
      'squallwing-titan',
      // Charged (Static Bite) + Metal: Overload.
      () => [
        make('urchivolt', 24, ['static-bite', 'iron-bash', 'steel-claw']),
        make('brineclaw', 24, ['splash-shot', 'iron-bash', 'steel-claw']),
        make('shagtusk', 24, ['mud-toss', 'rock-slam', 'hail-dash']),
      ],
      undefined,
    ],
    [
      'glacivar',
      // Airborne (Updraft) + Earth: Slam. The White Crown's sleet soaks both sides.
      () => [
        make('core:galehawk', 37, ['updraft', 'gale-dash', 'steel-claw']),
        make('tundramoth', 37, ['rock-slam', 'quake', 'steel-claw']),
        make('frostcairn', 37, ['mud-toss', 'quake', 'hail-dash']),
      ],
      ['core:wet'],
    ],
  ] as const)(
    '%s: a team 2 levels above beats it with reactions, rarely by brute force',
    (boss, team, weather) => {
      const react = bossRun(boss, team, reactions, 0, weather);
      const brute = bossRun(boss, team, brute0, 0, weather);
      expect(react, 'reactions').toBeGreaterThanOrEqual(0.5);
      expect(brute, 'brute, no potions').toBeLessThanOrEqual(react - 0.25);
      expect(bossRun(boss, team, potions, 5, weather), '5 Super Potions').toBeGreaterThanOrEqual(
        0.4,
      );
    },
  );
});

describe('Rimeholm looks (C35a)', () => {
  it('every look comes from the frozen kit, which shares no plan with the other regions', () => {
    const frozen = content.modelKits.require('rimeholm:frozen');
    const others = [
      content.modelKits.require('core:verdale'),
      content.modelKits.require('emberwaste:desert'),
    ];
    for (const k of others) expect(frozen.plans.filter((p) => k.plans.includes(p))).toEqual([]);
    for (const s of roster) {
      if (s.look) expect(s.look.kit, s.name).toBe('rimeholm:frozen');
    }
    expect(content.species.require(e('glacivar')).look?.plan).toBe('frostwyrm');
  });
});
