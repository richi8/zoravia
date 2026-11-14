/**
 * Rimeholm's campaign (C35): every story NPC, sign and hidden item is placed where the player
 * can reach it, and the whole main quest, the rival, the trial, the region boss and the side
 * quests can be played start to finish from pack data, with every battle fought through the
 * real battle engine (with the sleet storm where the NPC stands in one).
 */

import { describe, expect, it } from 'vitest';
import {
  aiChoice,
  aiReplacement,
  createBattle,
  finishBattle,
  needsReplacement,
  OPPONENT,
  PLAYER,
  step,
  type BattleResult,
  type BattleState,
} from '@game/battle/logic';
import { loadGameContent, type GameContent } from '@game/data';
import { applyBattleResult, healTeam, newParty, recordTrainerWin, type Party } from '@game/player';
import { createZorling, type Zorling } from '@game/progression';
import { advanceQuests, DialogueRun, holds, storyBattle, type StoryBattle } from '@game/story';
import { loadRegion } from '@game/world/map';
import { SHIPPED_PACKS } from '@packs/index';
import { STARTER_FLAGS } from './starts';
import { RIMEHOLM_SIGNS } from './story';

const content = loadGameContent([...SHIPPED_PACKS]);
const MAP = 'rimeholm:rimeholm';
const map = loadRegion(content, MAP);
const e = (local: string): string => `rimeholm:${local}`;
const full = (s: string): string => (s.includes(':') ? s : e(s));
const MAIN = e('fading-lights');

let uid = 0;
const z = (species: string, level: number): Zorling =>
  createZorling(content, { uid: `s${uid++}`, species: full(species), level });

/** Plays a battle to the end with the trainer AI on both sides; Zorbs at a Subdued boss. */
function play(cx: GameContent, plan: StoryBattle, badges: number): BattleResult {
  let state: BattleState = createBattle(cx, plan.setup).state;
  for (let guard = 0; state.phase !== 'ended' && guard < 400; guard++) {
    if (state.phase === 'replace') {
      const side = needsReplacement(state, OPPONENT) ? OPPONENT : PLAYER;
      state = step(cx, state, { kind: 'replace', side, to: aiReplacement(cx, state, side) }).state;
      continue;
    }
    const foe = state.sides[OPPONENT].team[state.sides[OPPONENT].active];
    const player = foe?.boss?.subdued
      ? { kind: 'item' as const, item: 'core:zorb' }
      : aiChoice(cx, state, PLAYER, 'trainer');
    const opponent = aiChoice(cx, state, OPPONENT, state.kind === 'wild' ? 'wild' : 'trainer');
    state = step(cx, state, { kind: 'turn', player, opponent }).state;
  }
  expect(state.phase).toBe('ended');
  return finishBattle(cx, state, { badges });
}

/** Where an NPC stands on the map. */
function placeOf(npc: string): { x: number; y: number } {
  const n = content.npcs.require(npc);
  const a = n.anchor !== undefined ? map.anchors[n.anchor] : undefined;
  return { x: a?.x ?? n.x ?? -1, y: a?.y ?? n.y ?? -1 };
}

/** The sleet storm of the zone an NPC stands in, as the overworld adds it to its battles. */
function weatherAt(npc: string): readonly string[] | undefined {
  const p = placeOf(npc);
  return map.zoneAt(p.x, p.y)?.battleWeather;
}

interface Talked {
  readonly party: Party;
  readonly pages: string[];
  readonly notes: string[];
  readonly won: boolean[];
}

let seed = 1;

/** Runs a dialogue like the overworld does, battles through the real engine. */
function talk(npc: string, party: Party, choices: number[] = []): Talked {
  const n = content.npcs.require(e(npc));
  const speaker = n.object ? undefined : n.name;
  const run = new DialogueRun(content, n.dialogue ?? '', party, speaker);
  const out: Talked = { party, pages: [], notes: [], won: [] };
  const weather = weatherAt(e(npc));
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
      const won = result.outcome === 'win' || result.outcome === 'caught';
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

/** Talks until the dialogue's battle is won, like a player retrying after a loss. */
function beat(npc: string, party: Party, choices: number[] = []): Talked {
  for (let tries = 0; tries < 6; tries++) {
    const r = talk(npc, party, [...choices]);
    if (r.won.length && r.won.every(Boolean)) return r;
    party = r.party;
  }
  throw new Error(`Could not beat ${npc}`);
}

const present = (npc: string, party: Party): boolean => {
  const when = content.npcs.require(e(npc)).when;
  return !when || holds(content, party, when);
};

/** Catches a wild Zorling of this species (at 1 HP, a Zorb, the real engine). */
function catchWild(party: Party, species: string, level: number): Party {
  for (let s = 1; s < 60; s++) {
    const wild = { ...z(species, level), hp: 1 };
    const s0 = createBattle(content, {
      kind: 'wild',
      seed: s,
      player: party.team,
      opponent: [wild],
      bag: party.bag,
    }).state;
    const out = step(content, s0, {
      kind: 'turn',
      player: { kind: 'item', item: 'core:zorb' },
      opponent: { kind: 'move', slot: 0 },
    });
    if (out.state.outcome !== 'caught') continue;
    const result = finishBattle(content, out.state, { badges: party.badges.length });
    const applied = applyBattleResult(party, result, { opponents: [full(species)] }).party;
    return advanceQuests(content, applied).party;
  }
  throw new Error(`Could not catch ${species}`);
}

/** The player trains: a new team of these species at this level (the bag, Dex, flags stay). */
const train = (party: Party, level: number, species: string[]): Party => ({
  ...party,
  team: species.map((s) => z(s, level)),
});

const said = (r: Talked): string => [...r.pages, ...r.notes].join('\n');

describe('Rimeholm story placement', () => {
  const spawn = map.anchors['spawn'] ?? { x: 0, y: 0 };
  const reach = map.reachableFrom(spawn.x, spawn.y);
  const reachable = (x: number, y: number): boolean => reach[y * map.width + x] === 1;
  const npcs = content.npcs.values().filter((n) => n.map === MAP);

  it('people and hidden items stand on reachable tiles', () => {
    expect(npcs.length).toBeGreaterThan(45);
    for (const n of npcs.filter((m) => m.object !== 'sign')) {
      const p = placeOf(n.id);
      expect(map.blocked(p.x, p.y), n.id).toBe(false);
      expect(reachable(p.x, p.y), n.id).toBe(true);
    }
  });

  it('signs and stones sit on a map prop that can be read from a reachable tile', () => {
    const signs = npcs.filter((n) => n.object === 'sign');
    expect(signs.map((n) => n.id.slice('rimeholm:'.length)).sort()).toEqual(
      [...RIMEHOLM_SIGNS].sort(),
    );
    for (const n of signs) {
      const p = placeOf(n.id);
      expect(map.blocked(p.x, p.y), n.id).toBe(true);
      const sides = [
        [p.x + 1, p.y],
        [p.x - 1, p.y],
        [p.x, p.y + 1],
        [p.x, p.y - 1],
      ] as const;
      expect(
        sides.some(([x, y]) => !map.blocked(x, y) && reachable(x, y)),
        n.id,
      ).toBe(true);
    }
  });

  it('no two Rimeholm NPCs share a tile', () => {
    const seen = new Map<string, string>();
    for (const n of npcs) {
      const p = placeOf(n.id);
      const key = `${p.x},${p.y}`;
      expect(seen.get(key), `${n.id} on ${key}`).toBeUndefined();
      seen.set(key, n.id);
    }
  });

  it('the Floemaw Titan and Glacivar fight in a sleet storm, the others in clear air', () => {
    expect(weatherAt(e('floemaw-titan-lair'))).toEqual(['core:wet']);
    expect(weatherAt(e('glacivar-lair'))).toEqual(['core:wet']);
    expect(weatherAt(e('squallwing-titan-lair'))).toBeUndefined();
    expect(weatherAt(e('lampwright-odessa'))).toBeUndefined();
  });
});

/** Odessa's hint: Earth (Muddy) then Nature (Rooted). The other team is the region's best without it. */
const HINT_TEAM = ['tundramoth', 'tanglekelp', 'frostcairn'];
const NO_HINT_TEAM = ['auroryx', 'selkaris', 'urchivolt'];

describe('Rimeholm campaign', () => {
  it('the main quest, trial, rival and region boss play start to finish', () => {
    let party = newParty({
      team: [z('selkit', 9), z('flurret', 9), z('spinzap', 9)],
      bag: { 'core:potion': 3, 'core:zorb': 10 },
      money: 1000,
    });
    party = { ...party, flags: { [STARTER_FLAGS.selkit]: 1 } };

    // Halvard starts the main quest.
    let r = talk('elder-halvard', party);
    party = r.party;
    expect(r.notes).toContain('New quest: The Fading Lights');
    expect(party.quests[MAIN]).toEqual({ state: 'active', step: 'tide-trial' });

    // Rival Mira on the west road, then she leaves.
    expect(present('mira-brinewick', party)).toBe(true);
    party = beat('mira-brinewick', party).party;
    expect(present('mira-brinewick', party)).toBe(false);
    expect(present('mira-glimmerholm', party)).toBe(false);

    // The Tide Trial: Sigrun first sends the player to Pell.
    party = train(party, 16, ['selkurr', 'flurret', 'spinzap']);
    r = talk('tidemaster-sigrun', party);
    expect(said(r)).toContain('Beat my deckhand Pell');
    expect(r.won).toEqual([]);
    party = beat('deckhand-pell', party).party;
    r = beat('tidemaster-sigrun', party);
    party = r.party;
    expect(r.notes).toContain('You received the Tide Badge!');
    expect(r.notes).toContain(
      'Quest updated: Face the Titans: the Floemaw (Sleet Fells) and the Squallwing (Thunder Bluffs).',
    );
    expect(said(r)).toContain('ask the Titans');
    expect(party.badges).toEqual([e('tide-badge')]);

    // Mira again, in Glimmerholm.
    expect(present('mira-glimmerholm', party)).toBe(true);
    party = beat('mira-glimmerholm', party).party;
    expect(present('mira-rimeport', party)).toBe(false);

    // Both Titans, caught. Each shows a vision of the lights pouring into a lighthouse.
    party = train(party, 24, ['rimestoat', 'selkurr', 'fluxine']);
    r = beat('floemaw-titan-lair', party, [0]);
    expect(said(r)).toContain('pour down out of the sky into its lamp');
    party = r.party;
    party = train(party, 26, ['urchivolt', 'brineclaw', 'shagtusk']);
    r = beat('squallwing-titan-lair', party, [0]);
    party = r.party;
    expect(said(r)).toContain('wound into a lamp');
    expect(r.notes).toContain(
      'Quest updated: Find the lighthouse: the Stormspire, on the Shipwreck Shoals east of Rimeport.',
    );
    expect(present('squallwing-titan-lair', party)).toBe(false);
    expect(present('glacivar-lair', party)).toBe(false);

    // Mira's last fight in Rimeport, then the region boss.
    expect(present('mira-rimeport', party)).toBe(true);
    party = train(party, 40, ['tundramoth', 'tanglekelp', 'selkaris']);
    party = beat('mira-rimeport', party).party;
    r = beat('lampwright-odessa', party);
    party = r.party;
    expect(said(r)).toContain('The Crownlight is back');
    expect(r.notes).toContain(
      'Quest updated: The lights are back in the sky. Climb to the Crown Shrine on the White Crown.',
    );

    // Glacivar appears at the Crown Shrine only now.
    expect(present('glacivar-lair', party)).toBe(true);
    party = train(party, 40, ['core:galehawk', 'tundramoth', 'frostcairn']);
    r = beat('glacivar-lair', party, [0]);
    party = r.party;
    expect(present('glacivar-lair', party)).toBe(false);
    expect(party.quests[MAIN]).toEqual({ state: 'active', step: 'halvard' });

    // Back to Halvard.
    const money = party.money;
    r = talk('elder-halvard', party);
    party = r.party;
    expect(r.notes).toContain('Quest complete: The Fading Lights!');
    expect(party.quests[MAIN]).toEqual({ state: 'done' });
    expect(party.money).toBe(money + 3000);
    expect(said(talk('elder-halvard', party))).toContain('thick enough to skate on');
  });

  it('Rival Mira counters every starter she can name, from any region', () => {
    const lead = (flag: string | undefined): string => {
      const party = {
        ...newParty({ team: [z('selkit', 9)] }),
        flags: flag ? { [flag]: 1 } : {},
      };
      const plan = storyBattle(content, party, { trainer: e('mira-brinewick') }, 1);
      return plan?.setup.opponent[0]?.species ?? '';
    };
    expect(lead(STARTER_FLAGS.selkit)).toBe(e('sparkit'));
    expect(lead(STARTER_FLAGS.woolump)).toBe(e('selkit'));
    expect(lead(STARTER_FLAGS.sparkit)).toBe(e('woolump'));
    expect(lead('core:starter-sprigling')).toBe('core:emberkit');
    expect(lead('core:starter-drizzlet')).toBe('core:sprigling');
    expect(lead('core:starter-emberkit')).toBe('core:drizzlet');
    // Emberwaste's starters, by flag only (Rimeholm does not depend on Emberwaste).
    expect(lead('emberwaste:starter-sizzlet')).toBe(e('selkit'));
    expect(lead('emberwaste:starter-pebbit')).toBe(e('selkit'));
    expect(lead('emberwaste:starter-pricklet')).toBe('core:emberkit');
    expect(lead(undefined)).toBe('core:emberkit');
  });

  it('the region boss rewards her hint (Earth, then Nature) and is hard without it', () => {
    const rate = (team: string[], level: number): number => {
      let wins = 0;
      for (let s = 1; s <= 20; s++) {
        const party = {
          ...newParty({ team: team.map((sp) => z(sp, level)) }),
          badges: [e('tide-badge')],
        };
        const plan = storyBattle(content, party, { trainer: e('lampwright-odessa') }, s);
        if (!plan) continue;
        if (play(content, plan, 1).outcome === 'win') wins++;
      }
      return wins / 20;
    };
    const hint = HINT_TEAM;
    const without = NO_HINT_TEAM;
    // Her Lodestar Lumenaw is Lv 37 with the badge.
    expect(rate(hint, 37)).toBeGreaterThanOrEqual(0.6);
    expect(rate(without, 37)).toBeLessThanOrEqual(0.3);
    expect(rate(without, 39)).toBeGreaterThanOrEqual(0.25);
  });

  it('Halvard and the Tidemaster remind the player of the current step', () => {
    let party = newParty({ team: [z('woolump', 9)], bag: {}, money: 0 });
    party = talk('elder-halvard', party).party;
    expect(said(talk('elder-halvard', party))).toContain('Glimmerholm is east');
    const other = talk('elder-halvard', {
      ...newParty({ team: [z('woolump', 9)], bag: {}, money: 0 }),
      badges: [e('tide-badge')],
    });
    expect(other.party.quests[MAIN]).toEqual({ state: 'active', step: 'titans' });
    expect(said(talk('tidemaster-sigrun', other.party))).toContain('freeze it with Ice');
  });

  it('the side quests can be finished', () => {
    let party = newParty({
      team: [z('selkaris', 40), z('tundramoth', 40), z('auroryx', 40)],
      bag: { 'core:zorb': 20 },
      money: 0,
    });

    party = talk('little-kari', party, [0]).party;
    expect(party.quests[e('lost-mitten')]).toMatchObject({ state: 'active' });
    party = catchWild(party, 'flurret', 5);
    let r = talk('little-kari', party);
    party = r.party;
    expect(r.notes).toContain('Quest complete: The Lost Mitten!');

    party = talk('netmaker-gro', party, [0]).party;
    party = catchWild(party, 'glimfry', 10);
    r = talk('netmaker-gro', party);
    party = r.party;
    expect(r.notes).toContain('Quest complete: The Netmaker’s Lamp!');

    // The Floe Garden: Agnete sets the flag even if met first.
    r = talk('hermit-agnete', party);
    party = r.party;
    expect(r.notes).toContain('You received 3 × Zorb.');
    party = talk('old-sailor-bram', party, [0]).party;
    expect(party.quests[e('floe-garden')]).toEqual({ state: 'active', step: 'tell' });
    r = talk('old-sailor-bram', party);
    party = r.party;
    expect(r.notes).toContain('Quest complete: The Floe Garden!');

    party = talk('ice-singer-liv', party, [0]).party;
    party = talk('stone-skerry', party).party;
    expect(party.quests[e('singing-ice')]).toEqual({ state: 'active', step: 'catch' });
    party = catchWild(party, 'jellivolt', 30);
    r = talk('ice-singer-liv', party);
    party = r.party;
    expect(r.notes).toContain('Quest complete: Singing Ice!');
    expect(Object.values(party.quests).every((q) => q.state === 'done')).toBe(true);
  });

  it('hidden items are taken once, and wait while the bag is full', () => {
    let party = newParty({ team: [z('woolump', 9)], bag: { 'core:max-potion': 5 }, money: 0 });
    let r = talk('item-frozen-wreck', party);
    expect(said(r)).toContain('no room');
    expect(present('item-frozen-wreck', r.party)).toBe(true);

    party = { ...party, bag: {} };
    r = talk('item-frozen-wreck', party);
    party = r.party;
    expect(r.notes).toContain('You received Max Potion.');
    expect(present('item-frozen-wreck', party)).toBe(false);

    r = talk('item-seal-rock', party);
    expect(r.party.bag['core:zorb']).toBe(5);
    expect(present('item-seal-rock', r.party)).toBe(false);
  });

  it('signs read without a name tag, and the Crown stone lights up once the lights are free', () => {
    const party = newParty({ team: [z('woolump', 9)], bag: {}, money: 0 });
    expect(content.npcs.require(e('sign-brinewick-north')).lines).toEqual([
      'North: the pier. The ferry to Verdale leaves from its far end.',
    ]);
    expect(said(talk('stone-crown', party))).toContain('dark and frosted over');
    const after = { ...party, trainers: recordTrainerWin(party.trainers, e('lampwright-odessa')) };
    expect(said(talk('stone-crown', after))).toContain('Green light flickers');
  });
});
