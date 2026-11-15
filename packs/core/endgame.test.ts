/**
 * The cross-region endgame (C36). Every region's danger zone is fenced off until 3 badges and
 * holds its people where they belong. The meta-quest "Beyond the Map" plays start to finish
 * through the real battle engine, across all three regions. Simulations check that the zones'
 * fights are fair for an endgame team: aces and Keepers can be beaten, the Elder Titans fall
 * to their weak spot but not to brute force, and Mira's finale is the hardest fight but a
 * winnable one.
 */

import { describe, expect, it } from 'vitest';
import {
  aiChoice,
  aiReplacement,
  createBattle,
  finishBattle,
  legalReplacements,
  needsReplacement,
  OPPONENT,
  PLAYER,
  simulateBoss,
  step,
  type BattleResult,
  type BattleState,
  type SimPolicy,
} from '@game/battle/logic';
import { loadGameContent, TILE_BLOCK, type GameContent } from '@game/data';
import { applyBattleResult, healTeam, newParty, type Party } from '@game/player';
import { createZorling, type Zorling } from '@game/progression';
import {
  advanceQuests,
  DialogueRun,
  holds,
  storyBattle,
  trainerBattle,
  type StoryBattle,
} from '@game/story';
import { loadRegion, type WorldMap } from '@game/world/map';
import { SHIPPED_PACKS } from '@packs/index';
import { ASHEN_RIFT } from '@packs/emberwaste/ashen-rift';
import { POLAR_DRIFT } from '@packs/rimeholm/polar-drift';
import { HEARTS, ZONE_BADGES, type ZoneContent } from './endgame';
import { THORNVEIL } from './thornveil';

const content = loadGameContent([...SHIPPED_PACKS]);
const QUEST = 'core:beyond-the-map';

interface Zone {
  readonly ns: string;
  readonly map: string;
  readonly zone: ZoneContent;
  readonly camp: string;
  readonly keeper: string;
  readonly rares: readonly string[];
}

const ZONES: readonly Zone[] = [
  {
    ns: 'core',
    map: 'core:verdale',
    zone: THORNVEIL,
    camp: 'town-thornveil-camp',
    keeper: 'keeper-ysolde',
    rares: ['core:elderhorn', 'core:stormoth'],
  },
  {
    ns: 'emberwaste',
    map: 'emberwaste:emberwaste',
    zone: ASHEN_RIFT,
    camp: 'town-rift-camp',
    keeper: 'keeper-ashka',
    rares: ['emberwaste:brimscorp', 'emberwaste:shardwing'],
  },
  {
    ns: 'rimeholm',
    map: 'rimeholm:rimeholm',
    zone: POLAR_DRIFT,
    camp: 'town-driftwatch-camp',
    keeper: 'keeper-aurelle',
    rares: ['rimeholm:starhorn', 'rimeholm:deepjaw'],
  },
];

const maps = new Map(ZONES.map((z) => [z.map, loadRegion(content, z.map)]));
const mapOf = (id: string): WorldMap => {
  const m = maps.get(id) ?? loadRegion(content, id);
  maps.set(id, m);
  return m;
};

const BADGES = ['core:grove-badge', 'emberwaste:kiln-badge', 'rimeholm:tide-badge'];

let uid = 0;
const z = (species: string, level: number, moves?: string[]): Zorling => {
  const made = createZorling(content, { uid: `e${uid++}`, species, level });
  return moves ? { ...made, moves: moves.map((m) => (m.includes(':') ? m : `core:${m}`)) } : made;
};

function placeOf(npc: string): { map: WorldMap; x: number; y: number } {
  const n = content.npcs.require(npc);
  const map = mapOf(n.map);
  const a = n.anchor !== undefined ? map.anchors[n.anchor] : undefined;
  return { map, x: a?.x ?? n.x ?? -1, y: a?.y ?? n.y ?? -1 };
}

const present = (npc: string, party: Party): boolean => {
  const when = content.npcs.require(npc).when;
  return !when || holds(content, party, when);
};

/** Plays a battle to the end with the trainer AI on both sides. */
function play(cx: GameContent, plan: StoryBattle, badges: number): BattleResult {
  let state: BattleState = createBattle(cx, plan.setup).state;
  for (let guard = 0; state.phase !== 'ended' && guard < 400; guard++) {
    if (state.phase === 'replace') {
      const side = needsReplacement(state, OPPONENT) ? OPPONENT : PLAYER;
      state = step(cx, state, { kind: 'replace', side, to: aiReplacement(cx, state, side) }).state;
      continue;
    }
    const player = aiChoice(cx, state, PLAYER, 'trainer');
    const opponent = aiChoice(cx, state, OPPONENT, 'trainer');
    state = step(cx, state, { kind: 'turn', player, opponent }).state;
  }
  expect(state.phase).toBe('ended');
  return finishBattle(cx, state, { badges });
}

interface Talked {
  readonly party: Party;
  readonly pages: string[];
  readonly notes: string[];
  readonly won: boolean[];
}

let seed = 1;

/** Runs a dialogue like the overworld does, with the battle weather where the NPC stands. */
function talk(npc: string, party: Party, choices: number[] = []): Talked {
  const n = content.npcs.require(npc);
  const run = new DialogueRun(content, n.dialogue ?? '', party, n.name);
  const out: Talked = { party, pages: [], notes: [], won: [] };
  const p = placeOf(npc);
  const weather = p.map.zoneAt(p.x, p.y)?.battleWeather;
  for (let i = 0; i < 60 && run.view; i++) {
    const view = run.view;
    out.pages.push(...view.pages);
    out.notes.push(...view.notes);
    if (view.battle) {
      const plan = storyBattle(content, run.party, view.battle, seed++);
      if (!plan) {
        run.battleOver(run.party, false);
        continue;
      }
      const stormy = weather ? { ...plan, setup: { ...plan.setup, weather } } : plan;
      const result = play(content, stormy, run.party.badges.length);
      const applied = applyBattleResult(run.party, result, plan.apply).party;
      const won = result.outcome === 'win';
      out.won.push(won);
      run.battleOver(won ? applied : healTeam(content, applied), won);
      continue;
    }
    run.next(view.choices.length ? choices.shift() : undefined);
  }
  expect(run.done).toBe(true);
  const moved = advanceQuests(content, run.party);
  out.notes.push(...moved.notes);
  return { ...out, party: healTeam(content, moved.party) };
}

function beat(npc: string, party: Party, choices: number[] = []): Talked {
  for (let tries = 0; tries < 8; tries++) {
    const r = talk(npc, party, [...choices]);
    if (r.won.length && r.won.every(Boolean)) return r;
    party = r.party;
  }
  throw new Error(`Could not beat ${npc}`);
}

const withBadges = (party: Party, n: number): Party => ({ ...party, badges: BADGES.slice(0, n) });

describe.each(ZONES)('$ns danger zone', (zone) => {
  const map = mapOf(zone.map);
  const id = (k: string): string => `${zone.ns}:${k}`;
  const ranger = id('gate-ranger');
  const spawn = map.anchors['spawn'] ?? { x: 0, y: 0 };
  const camp = map.anchors[zone.camp] ?? { x: -1, y: -1 };

  it('is fenced off: the ranger stands in the only way in, until 3 badges', () => {
    const p = placeOf(ranger);
    const at = (m: WorldMap, x: number, y: number): boolean =>
      m.reachableFrom(spawn.x, spawn.y)[y * m.width + x] === 1;
    expect(at(map, camp.x, camp.y)).toBe(true);
    const fenced = map.clone();
    fenced.flags[p.y * map.width + p.x] = (fenced.flags[p.y * map.width + p.x] ?? 0) | TILE_BLOCK;
    fenced.refreshCollision();
    expect(at(fenced, camp.x, camp.y)).toBe(false);

    const party = newParty({ team: [z('core:galehawk', 30)], bag: {}, money: 0 });
    expect(present(ranger, withBadges(party, ZONE_BADGES - 1))).toBe(true);
    expect(present(ranger, withBadges(party, ZONE_BADGES))).toBe(false);
    expect(present(id('surveyor'), withBadges(party, ZONE_BADGES - 1))).toBe(false);
    expect(present(id('surveyor'), withBadges(party, ZONE_BADGES))).toBe(true);
  });

  it('puts its aces, Keeper, Elder Titans and hidden items in the danger zones', () => {
    const tierOf = (npc: string) => {
      const p = placeOf(npc);
      return p.map.zoneAt(p.x, p.y);
    };
    const aces = Object.keys(zone.zone.trainers).filter(
      (k) => !k.startsWith('keeper') && !k.startsWith('elder'),
    );
    expect(aces).toHaveLength(3);
    const zonesOfAces = new Set(aces.map((k) => tierOf(id(k))?.key));
    for (const k of [...aces, zone.keeper, ...Object.keys(zone.zone.bosses)]) {
      expect(tierOf(id(k))?.tier, k).toBe('danger');
    }
    // Both zones have an ace; the Keeper guards the inner one.
    expect(zonesOfAces.size).toBe(2);
    expect(tierOf(id(zone.keeper))?.levels[0]).toBeGreaterThanOrEqual(52);
    for (const k of Object.keys(zone.zone.npcs).filter((k) => k.startsWith('item-'))) {
      expect(tierOf(id(k))?.tier, k).toBe('danger');
    }
  });

  it('wakes each Elder Titan once its Titan is beaten, at endgame level', () => {
    const party = newParty({ team: [z('core:galehawk', 50)], bag: {}, money: 0 });
    for (const k of Object.keys(zone.zone.bosses)) {
      const elder = content.bosses.require(id(k));
      const when = content.npcs.require(id(k)).when as { boss: string };
      const titan = content.bosses.require(when.boss);
      expect(present(id(k), party), k).toBe(false);
      const met: Party = { ...party, bosses: { [titan.id]: { result: 'defeated' } } };
      expect(present(id(k), met), k).toBe(true);
      // The same Titan, grown old: its species, signature move and weak spot.
      expect([elder.species, elder.signatureMove, elder.armor]).toEqual([
        titan.species,
        titan.signatureMove,
        titan.armor,
      ]);
      expect(elder.level).toBeGreaterThanOrEqual(52);
      expect(elder.rematch).toBeUndefined();
      const plan = trainerBattle(content, party, id(k), 1);
      expect(plan?.setup.boss).toEqual({ id: id(k), slot: 0 });
    }
  });

  it('has its two rares, found only in its danger zones', () => {
    for (const rare of zone.rares) {
      const s = content.species.require(rare);
      expect(s.rare).toBe(true);
      const where = [...maps.values()].flatMap((m) =>
        m.zones.filter((zz) => zz.spawns.some((sp) => sp.species === rare)),
      );
      expect(where.length, rare).toBe(1);
      expect(where[0]?.tier, rare).toBe('danger');
    }
  });
});

describe('Beyond the Map', () => {
  it('plays start to finish across the three regions', () => {
    let party = newParty({
      team: [z('core:infernyx', 60), z('rimeholm:selkaris', 60), z('core:thornmane', 60)],
      bag: { 'core:super-potion': 3 },
      money: 0,
    });
    party = { ...withBadges(party, 2), flags: { 'core:starter-emberkit': 1 } };

    // No Surveyor before three badges.
    expect(present('core:surveyor', party)).toBe(false);
    party = withBadges(party, 3);
    let r = talk('core:surveyor', party);
    party = r.party;
    expect(r.notes).toContain('New quest: Beyond the Map');
    expect(party.quests[QUEST]).toEqual({ state: 'active', step: 'first-heart' });

    // The same quest, whichever region's Surveyor the player meets.
    expect(content.npcs.require('emberwaste:surveyor').dialogue).toBe('core:surveyor');
    expect(content.npcs.require('rimeholm:surveyor').dialogue).toBe('core:surveyor');

    // Three Keepers, three hearts. Mira only shows up after the third.
    const teams: Record<string, Zorling[]> = {
      'core:keeper-ysolde': [
        z('core:infernyx', 60),
        z('rimeholm:rimestoat', 60),
        z('core:galehawk', 60),
      ],
      'emberwaste:keeper-ashka': [
        z('core:tidefang', 60),
        z('emberwaste:magmaroth', 60),
        z('core:galehawk', 60),
      ],
      'rimeholm:keeper-aurelle': [
        z('core:thornmane', 60),
        z('emberwaste:dunemaul', 60),
        z('rimeholm:auroryx', 60),
      ],
    };
    const steps = ['second-heart', 'third-heart', 'mira'];
    for (const [i, keeper] of Object.keys(teams).entries()) {
      expect(present('core:mira-finale', party)).toBe(false);
      r = beat(keeper, { ...party, team: teams[keeper] ?? [] });
      party = r.party;
      expect(party.flags[HEARTS]).toBe(i + 1);
      expect(party.quests[QUEST]).toEqual({ state: 'active', step: steps[i] });
      // Talking to a Keeper again does not chart the heart twice.
      party = talk(keeper, party).party;
      expect(party.flags[HEARTS]).toBe(i + 1);
    }
    expect(said(talk('core:surveyor', party))).toContain('Thornveil Camp');

    // The finale.
    expect(present('core:mira-finale', party)).toBe(true);
    const before = party.money;
    r = beat('core:mira-finale', {
      ...party,
      team: [z('core:thornmane', 62), z('emberwaste:dunemaul', 62), z('rimeholm:auroryx', 62)],
    });
    party = r.party;
    expect(r.notes).toContain('Quest complete: Beyond the Map!');
    expect(party.quests[QUEST]).toEqual({ state: 'done' });
    // Her prize plus the quest's reward.
    expect(party.money - before).toBe(6000 + 10000);
    // Against an Emberkit she brings Water (C33 counter rule).
    const plan = trainerBattle(content, party, 'core:mira-finale', 1);
    expect(plan?.setup.opponent.map((m) => m.species)).toContain('core:tidefang');
  });
});

const said = (r: Talked): string => [...r.pages, ...r.notes].join('\n');

// ------------------------------------------------------------------ simulations

function fight(player: Zorling[], opponent: Zorling[], s: number, weather?: readonly string[]) {
  let { state } = createBattle(content, {
    kind: 'trainer',
    seed: s,
    player,
    opponent,
    bag: {},
    ...(weather ? { weather } : {}),
  });
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
      player: aiChoice(content, state, PLAYER, 'trainer'),
      opponent: aiChoice(content, state, OPPONENT, 'trainer'),
    }).state;
  }
  return state.outcome === 'win';
}

const rate = (runs: number, won: (s: number) => boolean): number => {
  let n = 0;
  for (let s = 0; s < runs; s++) if (won(s)) n++;
  return n / runs;
};

/** A team of the region's own final forms. */
const REGION_TEAMS: Record<string, string[]> = {
  core: ['core:infernyx', 'core:tidefang', 'core:galehawk'],
  emberwaste: ['emberwaste:magmaroth', 'emberwaste:mirageel', 'emberwaste:dunemaul'],
  rimeholm: ['rimeholm:selkaris', 'rimeholm:auroryx', 'rimeholm:rimestoat'],
};

describe('danger zone fights (simulated)', () => {
  const party = newParty({ team: [z('core:galehawk', 50)], bag: {}, money: 0 });

  it.each(ZONES)(
    '$ns: a team of the region’s final forms, 2 levels up, beats its aces and Keeper',
    (zone) => {
      const team = REGION_TEAMS[zone.ns] ?? [];
      const trainers = Object.keys(zone.zone.trainers).filter((k) => !k.startsWith('elder'));
      for (const k of trainers) {
        const plan = trainerBattle(content, party, `${zone.ns}:${k}`, 1);
        const opp = plan?.setup.opponent ?? [];
        const top = Math.max(...opp.map((m) => m.level));
        const p = placeOf(`${zone.ns}:${k}`);
        const weather = p.map.zoneAt(p.x, p.y)?.battleWeather;
        const r = rate(20, (s) =>
          fight(
            team.map((sp) => z(sp, top + 2)),
            opp.map((m) => ({ ...m })),
            s,
            weather,
          ),
        );
        expect(r, k).toBeGreaterThanOrEqual(0.5);
      }
    },
  );

  const reactions: SimPolicy = { style: 'reactions', potion: 'core:super-potion' };
  const brute: SimPolicy = { style: 'brute' };
  type Member = readonly [string, string[]];
  /**
   * Each Elder Titan, 2 levels up: the scout's hint wins; brute force without it rarely does.
   * The Bogmaw's hint includes Nature (×2.25 on Earth/Water), so its "no hint" team has none.
   */
  const ELDERS: readonly [string, Member[], Member[], (readonly string[])?][] = [
    [
      'core:elder-mossback',
      [
        ['core:thornmane', ['spore-cloud', 'thorn-volley', 'timber-crush']],
        ['core:infernyx', ['kindle', 'flame-pounce', 'blaze-rush']],
        ['core:galehawk', ['gust', 'wing-cut', 'gale-dash']],
      ],
      [],
    ],
    [
      'core:elder-bogmaw',
      [
        ['core:tidefang', ['drench', 'tide-crash', 'riptide']],
        ['core:voltbat', ['static-field', 'static-bite', 'volt-lash']],
        ['core:thornmane', ['spore-cloud', 'thorn-volley', 'timber-crush']],
      ],
      [
        ['core:tidefang', ['drench', 'tide-crash', 'riptide']],
        ['core:voltbat', ['static-field', 'static-bite', 'volt-lash']],
        ['core:galehawk', ['gust', 'wing-cut', 'gale-dash']],
      ],
    ],
    [
      'emberwaste:elder-dunewyrm',
      [
        ['emberwaste:mirageel', ['drench', 'tide-crash', 'riptide']],
        ['emberwaste:magmaroth', ['kindle', 'flame-pounce', 'blaze-rush']],
        ['emberwaste:dustwhirl', ['gust', 'gale-dash', 'rock-slam']],
      ],
      [],
      ['core:burning'],
    ],
    [
      'emberwaste:elder-forgeback',
      [
        ['emberwaste:ironjaw', ['corrode', 'iron-bash', 'steel-claw']],
        ['emberwaste:brambleroll', ['gust', 'gale-dash', 'thorn-volley']],
        ['emberwaste:dunemaul', ['mud-toss', 'rock-slam', 'quake']],
      ],
      [],
    ],
    [
      'rimeholm:elder-floemaw',
      [
        ['rimeholm:rimestoat', ['cold-snap', 'frost-fang', 'hail-dash']],
        ['rimeholm:auroryx', ['static-field', 'volt-lash', 'rimeholm:thunderclap']],
        ['rimeholm:selkaris', ['drench', 'tide-crash', 'riptide']],
      ],
      [],
      ['core:wet'],
    ],
    [
      'rimeholm:elder-squallwing',
      [
        ['rimeholm:auroryx', ['static-field', 'volt-lash', 'rimeholm:thunderclap']],
        ['rimeholm:urchivolt', ['corrode', 'iron-bash', 'steel-claw']],
        ['rimeholm:brineclaw', ['corrode', 'steel-claw', 'tide-crash']],
      ],
      [],
    ],
  ];

  it.each(ELDERS)(
    '%s falls to its weak spot, not to brute force',
    (boss, hint, noHint, weather) => {
      const level = content.bosses.require(boss).level + 2;
      const run = (members: Member[], policy: SimPolicy, potions: number) =>
        rate(
          30,
          (s) =>
            simulateBoss(content, {
              boss,
              team: members.map(([sp, mv]) => z(sp, level, mv)),
              bag: { 'core:zorb': 1, 'core:super-potion': potions },
              policy,
              seed: s,
              ...(weather ? { weather } : {}),
            }).outcome === 'caught',
        );
      expect(run(hint, reactions, 5)).toBeGreaterThanOrEqual(0.7);
      expect(run(noHint.length ? noHint : hint, brute, 0)).toBeLessThanOrEqual(0.35);
    },
  );

  it('Mira’s finale is above the level cap, and a cap-level team can still win it', () => {
    const team = (ids: string[]) => ids.map((sp) => z(sp, 60));
    const cases: [string, string[]][] = [
      ['core:starter-sprigling', ['core:thornmane', 'rimeholm:auroryx', 'emberwaste:dunemaul']],
      ['core:starter-drizzlet', ['core:tidefang', 'emberwaste:magmaroth', 'rimeholm:auroryx']],
      ['emberwaste:starter-pebbit', ['emberwaste:dunemaul', 'core:thornmane', 'rimeholm:auroryx']],
      ['rimeholm:starter-sparkit', ['rimeholm:auroryx', 'emberwaste:magmaroth', 'core:tidefang']],
    ];
    for (const [flag, ids] of cases) {
      const p = { ...party, flags: { [flag]: 1 } };
      const opp = trainerBattle(content, p, 'core:mira-finale', 1)?.setup.opponent ?? [];
      expect(Math.min(...opp.map((m) => m.level))).toBeGreaterThan(60);
      const r = rate(20, (s) =>
        fight(
          team(ids),
          opp.map((m) => ({ ...m })),
          s,
        ),
      );
      expect(r, flag).toBeGreaterThanOrEqual(0.3);
    }
  });
});
