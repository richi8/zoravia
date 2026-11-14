/**
 * Emberwaste's campaign (C34): every story NPC, sign and hidden item is placed where the player
 * can reach it, and the whole main quest, the rival, the trial, the region boss and the side
 * quests can be played start to finish from pack data, with every battle fought through the
 * real battle engine (with the ash storm where the NPC stands in one).
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
import { EMBERWASTE_SIGNS } from './story';

const content = loadGameContent([...SHIPPED_PACKS]);
const MAP = 'emberwaste:emberwaste';
const map = loadRegion(content, MAP);
const e = (local: string): string => `emberwaste:${local}`;
const full = (s: string): string => (s.includes(':') ? s : e(s));
const MAIN = e('cold-forge');

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

/** The ash storm of the zone an NPC stands in, as the overworld adds it to its battles. */
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

describe('Emberwaste story placement', () => {
  const spawn = map.anchors['spawn'] ?? { x: 0, y: 0 };
  const reach = map.reachableFrom(spawn.x, spawn.y);
  const reachable = (x: number, y: number): boolean => reach[y * map.width + x] === 1;
  const npcs = content.npcs.values().filter((n) => n.map === MAP);

  it('people and hidden items stand on reachable tiles', () => {
    expect(npcs.length).toBeGreaterThan(40);
    for (const n of npcs.filter((m) => m.object !== 'sign')) {
      const p = placeOf(n.id);
      expect(map.blocked(p.x, p.y), n.id).toBe(false);
      expect(reachable(p.x, p.y), n.id).toBe(true);
    }
  });

  it('signs and stones sit on a map prop that can be read from a reachable tile', () => {
    const signs = npcs.filter((n) => n.object === 'sign');
    expect(signs.map((n) => n.id.slice('emberwaste:'.length)).sort()).toEqual(
      [...EMBERWASTE_SIGNS].sort(),
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

  it('no two Emberwaste NPCs share a tile', () => {
    const seen = new Map<string, string>();
    for (const n of npcs) {
      const p = placeOf(n.id);
      const key = `${p.x},${p.y}`;
      expect(seen.get(key), `${n.id} on ${key}`).toBeUndefined();
      seen.set(key, n.id);
    }
  });

  it('the Dunewyrm Titan and the region boss fight in an ash storm', () => {
    expect(weatherAt(e('dunewyrm-titan-lair'))).toEqual(['core:burning']);
    expect(weatherAt(e('glassmaker-gorran'))).toEqual(['core:burning']);
    expect(weatherAt(e('forgeback-titan-lair'))).toBeUndefined();
  });
});

describe('Emberwaste campaign', () => {
  it('the main quest, trial, rival and region boss play start to finish', () => {
    let party = newParty({
      team: [z('pricklet', 9), z('cindermite', 9), z('sandskink', 9)],
      bag: { 'core:potion': 3, 'core:zorb': 10 },
      money: 1000,
    });
    party = { ...party, flags: { [STARTER_FLAGS.pricklet]: 1 } };

    // Sabra starts the main quest.
    let r = talk('elder-sabra', party);
    party = r.party;
    expect(r.notes).toContain('New quest: The Cold Forge');
    expect(party.quests[MAIN]).toEqual({ state: 'active', step: 'forge-trial' });

    // Rival Mira on the north road, then she leaves.
    expect(present('mira-cinderwell', party)).toBe(true);
    party = beat('mira-cinderwell', party).party;
    expect(present('mira-cinderwell', party)).toBe(false);
    expect(present('mira-kilnreach', party)).toBe(false);

    // The Forge Trial: Hale first sends the player to Flint.
    party = train(party, 16, ['cactorn', 'pyrebeetle', 'oasip']);
    r = talk('forgemaster-hale', party);
    expect(said(r)).toContain('Beat my apprentice Flint');
    expect(r.won).toEqual([]);
    party = beat('apprentice-flint', party).party;
    r = beat('forgemaster-hale', party);
    party = r.party;
    expect(r.notes).toContain('You received the Kiln Badge!');
    expect(r.notes).toContain(
      'Quest updated: Face the Titans: the Dunewyrm (Cinder Dunes) and the Forgeback (Rust Canyon).',
    );
    expect(said(r)).toContain('ask the Titans');
    expect(party.badges).toEqual([e('kiln-badge')]);

    // Mira again, in Kilnreach.
    expect(present('mira-kilnreach', party)).toBe(true);
    party = beat('mira-kilnreach', party).party;
    expect(present('mira-slagwatch', party)).toBe(false);

    // Both Titans, caught. Each shows a vision of the capped vents.
    party = train(party, 24, ['mirageel', 'oasip', 'cactorn']);
    r = beat('dunewyrm-titan-lair', party, [0]);
    expect(said(r)).toContain('Iron lids sit on every vent');
    party = r.party;
    party = train(party, 26, ['rivetling', 'brambleroll', 'cindrake']);
    r = beat('forgeback-titan-lair', party, [0]);
    party = r.party;
    expect(said(r)).toContain('hammering lids onto the vents');
    expect(r.notes).toContain(
      'Quest updated: Climb to the Cap Works on the Caldera Rim, north of Slagwatch.',
    );
    expect(present('forgeback-titan-lair', party)).toBe(false);
    expect(present('calderon-lair', party)).toBe(false);

    // Mira's last fight in Slagwatch, then the region boss.
    expect(present('mira-slagwatch', party)).toBe(true);
    party = train(party, 40, ['saguardian', 'shimmerfox', 'dunewyrm']);
    party = beat('mira-slagwatch', party).party;
    r = beat('glassmaker-gorran', party);
    party = r.party;
    expect(said(r)).toContain('the vents are breathing');
    expect(r.notes).toContain(
      'Quest updated: The vents breathe again. Go to the Ember Heart, north of Kilnreach.',
    );

    // Calderon appears at the Ember Heart only now.
    expect(present('calderon-lair', party)).toBe(true);
    party = train(party, 40, ['mirageel', 'shimmerfox', 'saguardian']);
    r = beat('calderon-lair', party, [0]);
    party = r.party;
    expect(present('calderon-lair', party)).toBe(false);
    expect(party.quests[MAIN]).toEqual({ state: 'active', step: 'sabra' });

    // Back to Sabra.
    const money = party.money;
    r = talk('elder-sabra', party);
    party = r.party;
    expect(r.notes).toContain('Quest complete: The Cold Forge!');
    expect(party.quests[MAIN]).toEqual({ state: 'done' });
    expect(party.money).toBe(money + 3000);
    expect(said(talk('elder-sabra', party))).toContain('The storms are calming down');
  });

  it('Rival Mira counters every starter, from either region', () => {
    const lead = (flag: string | undefined): string => {
      const party = {
        ...newParty({ team: [z('sizzlet', 9)] }),
        flags: flag ? { [flag]: 1 } : {},
      };
      const plan = storyBattle(content, party, { trainer: e('mira-cinderwell') }, 1);
      return plan?.setup.opponent[0]?.species ?? '';
    };
    expect(lead(STARTER_FLAGS.sizzlet)).toBe(e('pebbit'));
    expect(lead(STARTER_FLAGS.pebbit)).toBe(e('pricklet'));
    expect(lead(STARTER_FLAGS.pricklet)).toBe(e('sizzlet'));
    expect(lead('core:starter-sprigling')).toBe('core:emberkit');
    expect(lead('core:starter-drizzlet')).toBe('core:sprigling');
    expect(lead('core:starter-emberkit')).toBe('core:drizzlet');
    expect(lead(undefined)).toBe('core:emberkit');
  });

  it('the region boss rewards his hint (Chill, then Earth) and is hard without it', () => {
    const rate = (team: string[], level: number): number => {
      let wins = 0;
      for (let s = 1; s <= 20; s++) {
        const party = {
          ...newParty({ team: team.map((sp) => z(sp, level)) }),
          badges: [e('kiln-badge')],
        };
        const plan = storyBattle(content, party, { trainer: e('glassmaker-gorran') }, s);
        if (!plan) continue;
        // The Cap Works stand in the caldera's ash storm.
        const stormy = { ...plan, setup: { ...plan.setup, weather: ['core:burning'] } };
        if (play(content, stormy, 1).outcome === 'win') wins++;
      }
      return wins / 20;
    };
    const hint = ['dunemaul', 'shimmerfox', 'mirageel'];
    const without = ['magmaroth', 'mirageel', 'ironjaw'];
    // His Kiln Ironjaw is Lv 38 with the badge.
    expect(rate(hint, 38)).toBeGreaterThanOrEqual(0.6);
    expect(rate(without, 38)).toBeLessThanOrEqual(0.3);
    expect(rate(without, 40)).toBeGreaterThanOrEqual(0.25);
  });

  it('Sabra and the Forgemaster remind the player of the current step', () => {
    let party = newParty({ team: [z('pebbit', 9)], bag: {}, money: 0 });
    party = talk('elder-sabra', party).party;
    expect(said(talk('elder-sabra', party))).toContain('Kilnreach is up the Redrock Trail');
    const other = talk('elder-sabra', {
      ...newParty({ team: [z('pebbit', 9)], bag: {}, money: 0 }),
      badges: [e('kiln-badge')],
    });
    expect(other.party.quests[MAIN]).toEqual({ state: 'active', step: 'titans' });
    expect(said(talk('forgemaster-hale', other.party))).toContain('quench it with Water');
  });

  it('the side quests can be finished', () => {
    let party = newParty({
      team: [z('saguardian', 40), z('magmaroth', 40), z('dunemaul', 40)],
      bag: { 'core:zorb': 20 },
      money: 0,
    });

    party = talk('juna', party, [0]).party;
    expect(party.quests[e('brass-bell')]).toMatchObject({ state: 'active' });
    party = catchWild(party, 'sandskink', 5);
    let r = talk('juna', party);
    party = r.party;
    expect(r.notes).toContain('Quest complete: The Brass Bell!');

    // The Mirage Spring: Nira sets the flag even if met first.
    r = talk('spring-nira', party);
    party = r.party;
    expect(r.notes).toContain('You received 3 × Zorb.');
    party = talk('water-carrier-odo', party, [0]).party;
    expect(party.quests[e('mirage-spring')]).toEqual({ state: 'active', step: 'tell' });
    r = talk('water-carrier-odo', party);
    party = r.party;
    expect(r.notes).toContain('Quest complete: The Mirage Spring!');

    party = talk('smith-brenna', party, [0]).party;
    party = catchWild(party, 'rivetling', 8);
    r = talk('smith-brenna', party);
    party = r.party;
    expect(r.notes).toContain('Quest complete: The Smith’s Apprentice!');

    party = talk('stargazer-vell', party, [0]).party;
    party = talk('stone-sunstone', party).party;
    expect(party.quests[e('cold-fire')]).toEqual({ state: 'active', step: 'catch' });
    party = catchWild(party, 'shimmerfox', 32);
    r = talk('stargazer-vell', party);
    party = r.party;
    expect(r.notes).toContain('Quest complete: Cold Fire!');
    expect(Object.values(party.quests).every((q) => q.state === 'done')).toBe(true);
  });

  it('hidden items are taken once, and wait while the bag is full', () => {
    let party = newParty({ team: [z('pebbit', 9)], bag: { 'core:max-potion': 5 }, money: 0 });
    let r = talk('item-glass-garden', party);
    expect(said(r)).toContain('no room');
    expect(present('item-glass-garden', r.party)).toBe(true);

    party = { ...party, bag: {} };
    r = talk('item-glass-garden', party);
    party = r.party;
    expect(r.notes).toContain('You received Max Potion.');
    expect(present('item-glass-garden', party)).toBe(false);

    r = talk('item-lookout', party);
    expect(r.party.bag['core:zorb']).toBe(5);
    expect(present('item-lookout', r.party)).toBe(false);
  });

  it('signs read without a name tag, and the Ember stone warms once the vents open', () => {
    const party = newParty({ team: [z('pebbit', 9)], bag: {}, money: 0 });
    expect(content.npcs.require(e('sign-cinderwell-north')).lines).toEqual([
      'North: the Redrock Trail and Kilnreach.',
    ]);
    expect(said(talk('stone-ember-heart', party))).toContain('cold to the touch');
    const after = { ...party, trainers: recordTrainerWin(party.trainers, e('glassmaker-gorran')) };
    expect(said(talk('stone-ember-heart', after))).toContain('it hums softly');
  });
});
