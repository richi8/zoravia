/**
 * Verdale's campaign (C30): every story NPC, sign and hidden item is placed where the player
 * can reach it, and the whole main quest, the rival, the trial, the region boss and the side
 * quests can be played start to finish from pack data, with every battle fought through the
 * real battle engine.
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
import { applyBattleResult, healTeam, newParty, type Party } from '@game/player';
import { createZorling, type Zorling } from '@game/progression';
import { advanceQuests, DialogueRun, holds, storyBattle, type StoryBattle } from '@game/story';
import { loadRegion } from '@game/world/map';
import { corePack } from '.';
import { VERDALE_SIGNS } from './verdale-story';

const content = loadGameContent([corePack]);
const map = loadRegion(content, 'core:verdale');
const c = (local: string): string => `core:${local}`;
const MAIN = c('still-wind');

let uid = 0;
const z = (species: string, level: number): Zorling =>
  createZorling(content, { uid: `s${uid++}`, species: c(species), level });

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

interface Talked {
  readonly party: Party;
  readonly pages: string[];
  readonly notes: string[];
  readonly won: boolean[];
}

let seed = 1;

/** Runs a dialogue like the overworld does, battles through the real engine. */
function talk(npc: string, party: Party, choices: number[] = []): Talked {
  const n = content.npcs.require(c(npc));
  const speaker = n.object ? undefined : n.name;
  const run = new DialogueRun(content, n.dialogue ?? '', party, speaker);
  const out: Talked = { party, pages: [], notes: [], won: [] };
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
      const result = play(content, plan, run.party.badges.length);
      const applied = applyBattleResult(run.party, result, plan.apply).party;
      const won = result.outcome === 'win' || result.outcome === 'caught';
      out.won.push(won);
      run.battleOver(won ? applied : healTeam(content, applied), won);
      continue;
    }
    run.next(view.choices.length ? choices.shift() : undefined);
  }
  expect(run.done).toBe(true);
  // The overworld checks quests after every dialogue.
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
  const when = content.npcs.require(c(npc)).when;
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
    const applied = applyBattleResult(party, result, { opponents: [c(species)] }).party;
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

describe('Verdale story placement', () => {
  const spawn = map.anchors['spawn'] ?? { x: 0, y: 0 };
  const reach = map.reachableFrom(spawn.x, spawn.y);
  const reachable = (x: number, y: number): boolean => reach[y * map.width + x] === 1;
  const npcs = content.npcs.values().filter((n) => n.map === 'core:verdale');
  const place = (n: (typeof npcs)[number]): { x: number; y: number } => {
    const a = n.anchor !== undefined ? map.anchors[n.anchor] : undefined;
    return { x: a?.x ?? n.x ?? -1, y: a?.y ?? n.y ?? -1 };
  };

  it('people and hidden items stand on reachable tiles', () => {
    for (const n of npcs.filter((m) => m.object !== 'sign')) {
      const p = place(n);
      expect(map.blocked(p.x, p.y), n.id).toBe(false);
      expect(reachable(p.x, p.y), n.id).toBe(true);
    }
  });

  it('signs and stones sit on a map prop that can be read from a reachable tile', () => {
    const signs = npcs.filter((n) => n.object === 'sign');
    expect(signs.map((n) => n.id.slice(5)).sort()).toEqual([...VERDALE_SIGNS].sort());
    for (const n of signs) {
      const p = place(n);
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

  it('no two Verdale NPCs share a tile', () => {
    const seen = new Map<string, string>();
    for (const n of npcs) {
      const p = place(n);
      const key = `${p.x},${p.y}`;
      expect(seen.get(key), `${n.id} on ${key}`).toBeUndefined();
      seen.set(key, n.id);
    }
  });
});

describe('Verdale campaign', () => {
  it('the main quest, trial, rival and region boss play start to finish', () => {
    // A new game: the launcher's starting team (Lv 9).
    let party = newParty({
      team: [z('puddlit', 9), z('emberkit', 9), z('sproutle', 9)],
      bag: { 'core:potion': 3, 'core:zorb': 10 },
      money: 1000,
    });

    // Tam points to the elder; Rowan starts the main quest.
    let r = talk('tam', party, [1]);
    expect(said(r)).toContain('Elder Rowan was looking for you');
    r = talk('elder-rowan', r.party);
    party = r.party;
    expect(r.notes).toContain('New quest: The Still Wind');
    expect(party.quests[MAIN]).toEqual({ state: 'active', step: 'grove-trial' });

    // Rival Mira on the north road, then she leaves.
    expect(present('mira-willowmere', party)).toBe(true);
    party = beat('mira-willowmere', party).party;
    expect(present('mira-willowmere', party)).toBe(false);
    expect(present('mira-fernhollow', party)).toBe(false);

    // The Grove Trial: Elm first sends the player to Linden.
    party = train(party, 16, ['puddlit', 'blazekit', 'sproutle']);
    r = talk('warden-elm', party);
    expect(said(r)).toContain('Beat my apprentice Linden');
    expect(r.won).toEqual([]);
    party = beat('apprentice-linden', party).party;
    r = beat('warden-elm', party);
    party = r.party;
    expect(r.notes).toContain('You received the Grove Badge!');
    expect(r.notes).toContain(
      'Quest updated: Face the Titans: the Mossback in Deepwood and the Bogmaw in the Reed Marsh.',
    );
    expect(said(r)).toContain('ask the old ones');
    expect(party.badges).toEqual([c('grove-badge')]);

    // Mira again, at the trial.
    expect(present('mira-fernhollow', party)).toBe(true);
    party = beat('mira-fernhollow', party).party;
    expect(present('mira-galecrest', party)).toBe(false);

    // Both Titans, caught. Each shows a vision of Crown Rock.
    party = train(party, 26, ['torrentoad', 'blazekit', 'thornwing']);
    r = beat('mossback-titan-lair', party, [0]);
    expect(said(r)).toContain('north of Galecrest');
    party = r.party;
    party = train(party, 26, ['torrentoad', 'voltbat', 'thornwing']);
    r = beat('bogmaw-titan-lair', party, [0]);
    party = r.party;
    expect(said(r)).toContain('crown of rock');
    expect(r.notes).toContain(
      'Quest updated: Climb Galeback Ridge, north of Galecrest, to the sails on Crown Rock.',
    );
    expect(present('mossback-titan-lair', party)).toBe(false);
    expect(present('verdion-lair', party)).toBe(false);

    // Mira's last fight in Galecrest, then the region boss.
    expect(present('mira-galecrest', party)).toBe(true);
    party = train(party, 40, ['tidefang', 'galehawk', 'bogmaw']);
    party = beat('mira-galecrest', party).party;
    r = beat('stormcatcher-vex', party);
    party = r.party;
    expect(said(r)).toContain('there it goes');
    expect(r.notes).toContain(
      'Quest updated: The Seedwind blows again. Go to the Heartwood Shrine, north of Fernhollow.',
    );

    // Verdion appears at the shrine only now.
    expect(present('verdion-lair', party)).toBe(true);
    party = train(party, 40, ['tidefang', 'rimewisp', 'bogmaw']);
    r = beat('verdion-lair', party, [0]);
    party = r.party;
    expect(present('verdion-lair', party)).toBe(false);
    expect(party.quests[MAIN]).toEqual({ state: 'active', step: 'rowan' });

    // Back to Rowan.
    const money = party.money;
    r = talk('elder-rowan', party);
    party = r.party;
    expect(r.notes).toContain('Quest complete: The Still Wind!');
    expect(party.quests[MAIN]).toEqual({ state: 'done' });
    expect(party.money).toBe(money + 3000);
    expect(said(talk('elder-rowan', party))).toContain('you can hear the leaves');
  });

  it('the region boss is beatable two levels above her lead, and not trivial at her level', () => {
    const rate = (level: number): number => {
      let wins = 0;
      for (let s = 1; s <= 20; s++) {
        const party = {
          ...newParty({ team: [z('tidefang', level), z('galehawk', level), z('bogmaw', level)] }),
          badges: [c('grove-badge')],
        };
        const plan = storyBattle(content, party, { trainer: c('stormcatcher-vex') }, s);
        if (plan && play(content, plan, 1).outcome === 'win') wins++;
      }
      return wins / 20;
    };
    expect(rate(40)).toBeGreaterThanOrEqual(0.4);
    expect(rate(37)).toBeLessThan(0.5);
  });

  it('Rowan and the Warden remind the player of the current step', () => {
    let party = newParty({ team: [z('puddlit', 9)], bag: {}, money: 0 });
    party = talk('elder-rowan', party).party;
    expect(said(talk('elder-rowan', party))).toContain('Fernhollow is up the north road');
    // Badge already held (e.g. Elm beaten before Rowan was met): the step passes at once.
    const other = talk('elder-rowan', {
      ...newParty({ team: [z('puddlit', 9)], bag: {}, money: 0 }),
      badges: [c('grove-badge')],
    });
    expect(other.party.quests[MAIN]).toEqual({ state: 'active', step: 'titans' });
    expect(said(talk('warden-elm', other.party))).toContain('Seed the Mossback');
  });

  it('the side quests can be finished', () => {
    let party = newParty({
      team: [z('torrentoad', 40), z('infernyx', 40), z('thornwing', 40)],
      bag: { 'core:zorb': 20 },
      money: 0,
    });

    // Sandwich Snatcher.
    party = talk('tam', party, [0]).party;
    expect(party.quests[c('sandwich-snatcher')]).toMatchObject({ state: 'active' });
    party = catchWild(party, 'pipwing', 5);
    let r = talk('tam', party);
    party = r.party;
    expect(r.notes).toContain('Quest complete: Sandwich Snatcher!');

    // The Lost Orchard: Hazel sets the flag even if met first.
    r = talk('orchard-hazel', party);
    party = r.party;
    expect(r.notes).toContain('You received 3 × Zorb.');
    party = talk('gardener-mo', party, [0]).party;
    expect(party.quests[c('lost-orchard')]).toEqual({ state: 'active', step: 'tell' });
    r = talk('gardener-mo', party);
    party = r.party;
    expect(r.notes).toContain('Quest complete: The Lost Orchard!');

    // Ringing Shells.
    party = talk('tinker-pim', party, [0]).party;
    party = catchWild(party, 'ironshell', 20);
    r = talk('tinker-pim', party);
    party = r.party;
    expect(r.notes).toContain('Quest complete: Ringing Shells!');

    // Lights on the Water.
    party = talk('ferryman-gus', party, [0]).party;
    party = talk('stone-ruins', party).party;
    expect(party.quests[c('lights-on-the-water')]).toEqual({ state: 'active', step: 'catch' });
    party = catchWild(party, 'rimewisp', 32);
    r = talk('ferryman-gus', party);
    party = r.party;
    expect(r.notes).toContain('Quest complete: Lights on the Water!');
    expect(Object.values(party.quests).every((q) => q.state === 'done')).toBe(true);
  });

  it('hidden items are taken once, and wait while the bag is full', () => {
    let party = newParty({ team: [z('puddlit', 9)], bag: { 'core:max-potion': 5 }, money: 0 });
    expect(present('item-hidden-glade', party)).toBe(true);
    let r = talk('item-hidden-glade', party);
    expect(said(r)).toContain('no room');
    expect(present('item-hidden-glade', r.party)).toBe(true);

    party = { ...party, bag: {} };
    r = talk('item-hidden-glade', party);
    party = r.party;
    expect(r.notes).toContain('You received Max Potion.');
    expect(party.bag['core:max-potion']).toBe(1);
    expect(present('item-hidden-glade', party)).toBe(false);

    r = talk('item-lookout', party);
    expect(r.party.bag['core:zorb']).toBe(5);
    expect(present('item-lookout', r.party)).toBe(false);
  });

  it('signs read without a name tag', () => {
    const party = newParty({ team: [z('puddlit', 9)], bag: {}, money: 0 });
    const n = content.npcs.require(c('sign-willowmere-north'));
    expect(n.object).toBe('sign');
    expect(n.lines).toEqual(['North: Brookside Trail and Fernhollow.']);
    expect(said(talk('stone-shrine', party))).toContain('very still');
  });
});
