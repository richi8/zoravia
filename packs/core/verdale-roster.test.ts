/**
 * Region 1, Verdale (C29): its Zorlings, trainers, Titans and legendary. Checks the roster
 * (types, starters, stages), the spawn tables against evolution levels, trainers placed in the
 * right zones, and balance simulations: starters against the first wild Zorlings, the Titans
 * and Verdion beaten by reactions but not by brute force, and route trainers against a team
 * at their level.
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
import { corePack } from '.';
import { verdaleTrainers } from './verdale-trainers';

const content = loadGameContent([corePack]);
const map = loadRegion(content, 'core:verdale');
const c = (local: string): string => `core:${local}`;

const STARTERS = ['sprigling', 'drizzlet', 'emberkit'];

const zones = Object.values(map.zones);
const wild = new Set(zones.flatMap((z) => z.spawns.map((s) => s.species)));
const verdale = content.species.values();
const verdaleNpcs = content.npcs.values().filter((n) => n.map === 'core:verdale');
/** Route trainers (C29); the story's trainers are tested in `verdale-story.test.ts`. */
const trainerNpcs = verdaleNpcs.filter(
  (n) => n.dialogue && Object.hasOwn(verdaleTrainers, n.dialogue.slice(5)),
);

let uid = 0;
const make = (species: string, level: number, moves?: string[]): Zorling => ({
  ...createZorling(content, { uid: `v${uid++}`, species: c(species), level }),
  ...(moves ? { moves: moves.map(c) } : {}),
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

describe('Verdale roster', () => {
  it('has about 20 species in 1-, 2- and 3-stage lines, in the stat bands', () => {
    expect(verdale.length).toBeGreaterThanOrEqual(20);
    const lengths = new Set(verdale.map((s) => content.evolutionLine(s.id).members.length));
    expect([...lengths].sort()).toEqual([1, 2, 3]);
    for (const s of verdale) {
      const line = content.evolutionLine(s.id);
      const band = statBand(line.stage, line.members.length, s.legendary);
      expect(Math.abs(statTotal(s.baseStats) - band) / band, s.name).toBeLessThan(0.05);
    }
    expect(verdale.filter((s) => s.legendary).map((s) => s.name)).toEqual(['Verdion']);
  });

  it('has three 3-stage starters (Nature, Water, Fire) that are not found in the wild', () => {
    const types = STARTERS.map((id) => {
      const line = content.evolutionLine(c(id));
      expect(line.stage, id).toBe(1);
      expect(line.members, id).toHaveLength(3);
      for (const m of line.members) expect(wild.has(m.id), m.id).toBe(false);
      return content.species.require(c(id)).types[0];
    });
    expect(types).toEqual(['core:nature', 'core:water', 'core:fire']);
  });

  it('every species lives somewhere: a starter line, a zone or a boss lair', () => {
    const bossSpecies = new Set(content.bosses.values().map((b) => b.species));
    for (const s of verdale) {
      const line = content.evolutionLine(s.id).members.map((m) => m.id.slice(5));
      const starter = STARTERS.includes(line[0] ?? '');
      expect(starter || wild.has(s.id) || bossSpecies.has(s.id), s.name).toBe(true);
    }
  });

  it('the wild has all 8 types, weighted toward Nature, Water and Wind', () => {
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
    for (const t of ['nature', 'water', 'wind']) {
      expect(ranked.indexOf(c(t)), t).toBeLessThan(4);
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

describe('Verdale trainers', () => {
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
      // A balanced Verdale team: a starter line plus two common wild Zorlings.
      const mine = (): Zorling[] =>
        top < 16
          ? [make('drizzlet', top), make('pipwing', top), make('hearthog', top)]
          : top < 32
            ? [make('brooklet', top), make('galehawk', top), make('hearthog', top)]
            : [make('tidefang', top), make('galehawk', top), make('mossback', top)];
      const rate = winRate(20, (seed) => fight('trainer', mine(), theirs(), seed, 'trainer'));
      expect(rate, n.name).toBeGreaterThanOrEqual(0.5);
    }
  });
});

describe('Verdale balance', () => {
  it('a new Lv 6 starter beats the meadow’s spawn table (weights and levels) most of the time', () => {
    // The start assumed by the C31 playthrough simulator until the start flow exists (C33).
    const meadow = map.zone('meadow');
    expect(meadow).toBeDefined();
    const [lo, hi] = meadow?.levels ?? [0, 0];
    expect(hi).toBeLessThanOrEqual(6);
    for (const starter of STARTERS) {
      let rate = 0;
      let weights = 0;
      for (const sp of meadow?.spawns ?? []) {
        for (let level = lo; level <= hi; level++) {
          const foe = sp.species.slice(5);
          const r = winRate(20, (seed) =>
            fight('wild', [make(starter, 6)], [make(foe, level)], seed, 'trainer'),
          );
          rate += r * sp.weight;
          weights += sp.weight;
        }
      }
      expect(rate / weights, starter).toBeGreaterThanOrEqual(0.6);
    }
  });

  const bossRun = (boss: string, team: () => Zorling[], policy: SimPolicy, potions = 0) =>
    winRate(40, (seed) =>
      simulateBoss(content, {
        boss: c(boss),
        team: team(),
        bag: { 'core:zorb': 1, 'core:super-potion': potions },
        policy,
        seed,
      }).outcome === 'caught'
        ? 'won'
        : 'lost',
    );
  const reactions: SimPolicy = { style: 'reactions', potion: 'core:super-potion' };
  const brute0: SimPolicy = { style: 'brute' };
  const potions: SimPolicy = { style: 'brute', potion: 'core:super-potion' };

  it.each([
    [
      'mossback-titan',
      // Overgrown (Spore Cloud) + Fire: Wildfire.
      () => [
        make('fernwick', 24, ['spore-cloud', 'thorn-volley', 'rock-slam']),
        make('blazekit', 24, ['ember', 'flame-pounce', 'kindle']),
        make('galehawk', 24, ['gust', 'wing-cut', 'gale-dash']),
      ],
    ],
    [
      'bogmaw-titan',
      // Wet (Drench) + Electric: Conducted.
      () => [
        make('brooklet', 19, ['splash-shot', 'drench', 'tide-crash']),
        make('voltbat', 19, ['static-bite', 'volt-lash', 'wing-cut']),
        make('galehawk', 19, ['gust', 'wing-cut', 'gale-dash']),
      ],
    ],
    [
      'verdion',
      // Charged (Static Field) + Metal: Overload.
      () => [
        make('voltbat', 38, ['static-field', 'volt-lash', 'frost-fang']),
        make('ironshell', 38, ['iron-bash', 'steel-claw', 'mud-toss']),
        make('rimewisp', 38, ['cold-snap', 'frost-fang', 'hail-dash']),
      ],
    ],
  ] as const)(
    '%s: a team 2 levels above beats it with reactions, rarely by brute force',
    (boss, team) => {
      const react = bossRun(boss, team, reactions);
      const brute = bossRun(boss, team, brute0);
      expect(react, 'reactions').toBeGreaterThanOrEqual(0.5);
      expect(brute, 'brute, no potions').toBeLessThanOrEqual(react - 0.25);
      // Brute force with good potions is doable (DESIGN → Economy: ~4–5 good potions).
      expect(bossRun(boss, team, potions, 5), '5 Super Potions').toBeGreaterThanOrEqual(0.4);
    },
  );
});
