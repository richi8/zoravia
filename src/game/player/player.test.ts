import { describe, expect, it } from 'vitest';
import { definePack } from '@engine/packs';
import {
  createBattle,
  finishBattle,
  PLAYER,
  step,
  type BattleResult,
  type Choice,
} from '@game/battle/logic';
import { loadGameContent, type NpcInput } from '@game/data';
import { createZorling, statsOf, type Zorling } from '@game/progression';
import { corePack } from '@packs/core';
import {
  applyBattleResult,
  buyItem,
  canMove,
  dexEntries,
  EMPTY_DEX,
  fieldUseProblem,
  freeUid,
  healAll,
  markCaught,
  markSeen,
  maxBuyable,
  moveZorling,
  newParty,
  RELEARN_FEE,
  relearn,
  relearnOptions,
  relearnProblem,
  useItemInField,
  wildPrize,
  type Party,
} from '.';

const content = loadGameContent([corePack]);
let n = 0;
const z = (species: string, level = 10, extra: Partial<Zorling> = {}): Zorling => ({
  ...createZorling(content, { uid: `u${n++}`, species: `core:${species}`, level }),
  ...extra,
});
const maxHp = (x: Zorling): number => statsOf(content, x).hp;
const uids = (list: readonly Zorling[]): string[] => list.map((x) => x.uid);

const result = (party: Party, over: Partial<BattleResult>): BattleResult => ({
  outcome: 'win',
  team: party.team,
  xp: 0,
  progress: [],
  bag: party.bag,
  caught: null,
  ...over,
});

describe('dex', () => {
  it('logs seen and caught once, in first-logged order; caught implies seen', () => {
    const a = markSeen(EMPTY_DEX, ['core:voltbat', 'core:sproutle', 'core:voltbat']);
    expect(a.seen).toEqual(['core:voltbat', 'core:sproutle']);
    expect(markSeen(a, ['core:sproutle'])).toBe(a);
    const b = markCaught(a, ['core:emberkit']);
    expect(b.seen).toEqual(['core:voltbat', 'core:sproutle', 'core:emberkit']);
    expect(b.caught).toEqual(['core:emberkit']);
    expect(markCaught(b, ['core:emberkit'])).toBe(b);
  });

  it('lists every species in registry order with what was logged', () => {
    const dex = markCaught(markSeen(EMPTY_DEX, ['core:voltbat']), ['core:emberkit']);
    const rows = dexEntries(content, dex);
    expect(rows).toHaveLength(content.species.values().length);
    expect(rows[0]).toEqual({ number: 1, species: 'core:sprigling', seen: false, caught: false });
    expect(rows.find((r) => r.species === 'core:emberkit')).toMatchObject({ caught: true });
    const volt = rows.find((r) => r.species === 'core:voltbat');
    expect(volt).toMatchObject({ seen: true, caught: false });
    expect(rows.filter((r) => r.seen)).toHaveLength(2);
  });

  it('a new party has its own Zorlings caught', () => {
    const p = newParty({ team: [z('puddlit')], storage: [z('voltbat')] });
    expect(p.dex.caught).toEqual(['core:puddlit', 'core:voltbat']);
    expect(p.money).toBe(0);
    expect(p.bag).toEqual({});
  });
});

describe('battle results', () => {
  it('pays the prize only on a win, and logs the foe as seen', () => {
    const p = newParty({ team: [z('puddlit')], money: 50 });
    const won = applyBattleResult(p, result(p, {}), {
      opponents: ['core:voltbat'],
      prize: wildPrize(6),
    });
    expect(won.party.money).toBe(50 + wildPrize(6));
    expect(won.party.dex.seen).toContain('core:voltbat');
    for (const outcome of ['ran', 'lose', 'caught'] as const) {
      const r = applyBattleResult(p, result(p, { outcome }), { prize: 99 });
      expect(r.party.money).toBe(50);
    }
    expect(wildPrize(3)).toBeLessThan(content.items.require('core:potion').price / 4);
  });

  it('a catch is logged and gets a free uid', () => {
    const team = [z('puddlit', 10, { uid: 'wild-1' })];
    const p = newParty({ team });
    const caught = z('voltbat', 5, { uid: 'wild-1' });
    const r = applyBattleResult(p, result(p, { outcome: 'caught', caught }));
    expect(r.caughtTo).toBe('team');
    expect(uids(r.party.team)).toEqual(['wild-1', 'wild-1-2']);
    expect(r.party.dex.caught).toContain('core:voltbat');
    expect(freeUid('a', new Set(['a', 'a-2']))).toBe('a-3');
  });
});

describe('zorling center', () => {
  it('heals the team and storage', () => {
    const p = newParty({
      team: [z('puddlit', 10, { hp: 1 }), z('emberkit', 10, { hp: 0 })],
      storage: [z('voltbat', 10, { hp: 3 })],
    });
    const h = healAll(content, p);
    expect([...h.team, ...h.storage].map((x) => x.hp)).toEqual(
      [...p.team, ...p.storage].map(maxHp),
    );
  });

  it('swaps, deposits and withdraws; the team never ends up empty', () => {
    const [a, b, c, d] = [z('puddlit'), z('emberkit'), z('sproutle'), z('voltbat')];
    const p = newParty({ team: [a, b], storage: [c, d] });
    const team = (index: number) => ({ area: 'team', index }) as const;
    const box = (index: number) => ({ area: 'storage', index }) as const;

    // Swap a team member with a stored one.
    const s1 = moveZorling(p, team(0), box(1));
    expect(uids(s1.team)).toEqual(uids([d, b]));
    expect(uids(s1.storage)).toEqual(uids([c, a]));
    // Withdraw onto the free hotbar slot; storage closes the gap.
    const s2 = moveZorling(p, box(0), team(2));
    expect(uids(s2.team)).toEqual(uids([a, b, c]));
    expect(uids(s2.storage)).toEqual(uids([d]));
    // Deposit onto the empty spot at the end of the box.
    const s3 = moveZorling(p, team(1), box(2));
    expect(uids(s3.team)).toEqual(uids([a]));
    expect(uids(s3.storage)).toEqual(uids([c, d, b]));
    // Reorder the hotbar.
    expect(uids(moveZorling(p, team(0), team(1)).team)).toEqual(uids([b, a]));

    // The last team member can be swapped but not deposited.
    expect(canMove(s3, team(0), box(3))).toBe(false);
    expect(canMove(s3, team(0), box(0))).toBe(true);
    expect(() => moveZorling(s3, team(0), box(3))).toThrow(/Cannot move/);
    // Nothing to pick up, out of range, onto itself.
    expect(canMove(p, team(2), box(0))).toBe(false);
    expect(canMove(p, box(5), team(0))).toBe(false);
    expect(canMove(p, team(0), team(0))).toBe(false);
    expect(p.team).toHaveLength(2);
  });

  it('relearns a forgotten move for a fee, into a free slot or over one', () => {
    const ember = z('emberkit', 14); // knows gust, kindle, flame-pounce; forgot ember
    expect(ember.moves).toEqual(['core:gust', 'core:kindle', 'core:flame-pounce']);
    const p = newParty({ team: [ember], money: RELEARN_FEE + 5 });
    expect(relearnOptions(content, p, 0)).toEqual(['core:ember']);
    expect(relearnProblem(content, p, 0, 'core:ember', null)).toBe('slot');
    const r = relearn(content, p, 0, 'core:ember', 1);
    expect(r.team[0]?.moves).toEqual(['core:gust', 'core:ember', 'core:flame-pounce']);
    expect(r.money).toBe(5);
    expect(relearnOptions(content, r, 0)).toEqual(['core:kindle']);
    expect(relearnProblem(content, r, 0, 'core:kindle', 0)).toBe('money');
    expect(relearnProblem(content, p, 0, 'core:tide-crash', 0)).toBe('move');

    const two = newParty({ team: [{ ...ember, moves: ['core:gust'] }], money: RELEARN_FEE });
    const t = relearn(content, two, 0, 'core:ember', null);
    expect(t.team[0]?.moves).toEqual(['core:gust', 'core:ember']);
    expect(t.money).toBe(0);
  });
});

describe('shop and field items', () => {
  it('buys within money and the bag cap', () => {
    const p = newParty({ team: [z('puddlit')], money: 450, bag: { 'core:potion': 3 } });
    expect(maxBuyable(content, p, 'core:potion')).toBe(2); // cap 5
    expect(maxBuyable(content, p, 'core:super-potion')).toBe(1); // 300 each
    expect(maxBuyable(content, p, 'core:zorb')).toBe(7); // no cap, 60 each
    const b = buyItem(content, p, 'core:potion', 2);
    expect(b.bag['core:potion']).toBe(5);
    expect(b.money).toBe(250);
    expect(maxBuyable(content, b, 'core:potion')).toBe(0);
    expect(() => buyItem(content, b, 'core:potion', 1)).toThrow(/at most 0/);
    expect(() => buyItem(content, p, 'core:max-potion', 1)).toThrow(/at most 0/);
  });

  it('uses potions on hurt team members only, without a turn', () => {
    const hurt = z('puddlit', 10, { hp: 5 });
    const p = newParty({
      team: [hurt, z('emberkit'), z('sproutle', 10, { hp: 0 })],
      bag: { 'core:potion': 1, 'core:zorb': 2 },
    });
    expect(fieldUseProblem(content, p, 'core:zorb', 0)).toBe('battle-only');
    expect(fieldUseProblem(content, p, 'core:potion', 1)).toBe('full');
    expect(fieldUseProblem(content, p, 'core:potion', 2)).toBe('fainted');
    expect(fieldUseProblem(content, p, 'core:potion', 5)).toBe('target');
    expect(fieldUseProblem(content, p, 'core:super-potion', 0)).toBe('none');
    const u = useItemInField(content, p, 'core:potion', 0);
    expect(u.healed).toBe(Math.min(30, maxHp(hurt) - 5));
    expect(u.party.team[0]?.hp).toBe(5 + u.healed);
    expect(u.party.bag).toEqual({ 'core:zorb': 2 });
  });
});

describe('full loop (C22 "done when")', () => {
  it('catch → storage → swap at a center → buy potions → use one in battle', () => {
    let party = newParty({
      team: [z('ironshell', 12), z('emberkit', 12), z('puddlit', 12)],
      bag: { 'core:zorb': 3 },
      money: 400,
    });

    // 1. Catch a weak wild Sproutle with a full team: it goes to storage.
    let caught: BattleResult | undefined;
    for (let seed = 1; seed < 40 && !caught; seed++) {
      const wild = z('sproutle', 6, { hp: 1 });
      const s0 = createBattle(content, {
        kind: 'wild',
        seed,
        player: party.team,
        opponent: [wild],
        bag: party.bag,
      }).state;
      const zorb: Choice = { kind: 'item', item: 'core:zorb' };
      const r = step(content, s0, {
        kind: 'turn',
        player: zorb,
        opponent: { kind: 'move', slot: 0 },
      });
      if (r.state.outcome === 'caught') caught = finishBattle(content, r.state, { badges: 0 });
    }
    expect(caught?.caught?.species).toBe('core:sproutle');
    const applied = applyBattleResult(party, caught as BattleResult, {
      opponents: ['core:sproutle'],
    });
    expect(applied.caughtTo).toBe('storage');
    party = applied.party;
    expect(party.dex.caught).toContain('core:sproutle');

    // 2. Swap it onto the hotbar at a center.
    party = moveZorling(party, { area: 'storage', index: 0 }, { area: 'team', index: 1 });
    expect(party.team[1]?.species).toBe('core:sproutle');
    expect(party.storage.map((x) => x.species)).toEqual(['core:emberkit']);

    // 3. Buy potions.
    party = buyItem(content, party, 'core:potion', 3);
    expect(party.bag['core:potion']).toBe(3);
    expect(party.money).toBe(100);

    // 4. Use one in the next battle on the hurt Sproutle (it is benched in slot 1).
    const s0 = createBattle(content, {
      kind: 'wild',
      seed: 3,
      player: party.team,
      opponent: [z('voltbat', 5)],
      bag: party.bag,
    }).state;
    const potion: Choice = { kind: 'item', item: 'core:potion', target: 1 };
    const r = step(content, s0, {
      kind: 'turn',
      player: potion,
      opponent: { kind: 'move', slot: 0 },
    });
    expect(r.events).toContainEqual(
      expect.objectContaining({ kind: 'heal', side: PLAYER, slot: 1 }),
    );
    expect(r.state.bag['core:potion']).toBe(2);
  });
});

describe('npc roles', () => {
  const pack = (npcs: Record<string, NpcInput>) =>
    definePack({ manifest: { id: 'm', version: '1.0.0', dependsOn: ['core'] }, content: { npcs } });
  const base: NpcInput = { name: 'X', map: 'core:test-region', x: 50, y: 50, lines: ['Hi'] };

  it('core has a center and a shop on the test region, and Verdale has one per town', () => {
    const roles = (map: string): string[] =>
      content.npcs
        .values()
        .filter((n) => n.map === map)
        .flatMap((n) => (n.role ? [n.role.kind] : []))
        .sort();
    expect(roles('core:test-region')).toEqual(['center', 'shop']);
    expect(roles('core:verdale')).toEqual(['center', 'center', 'center', 'shop', 'shop']);
  });

  it('rejects unknown, unsold or repeated stock', () => {
    const bad = (stock: string[]) => () =>
      loadGameContent([corePack, pack({ s: { ...base, role: { kind: 'shop', stock } } })]);
    expect(bad(['core:nope'])).toThrow(/nope/);
    expect(bad(['core:potion', 'core:potion'])).toThrow(/twice/);
    const free = definePack({
      manifest: { id: 'f', version: '1.0.0', dependsOn: ['core'] },
      content: {
        items: {
          gift: {
            name: 'Gift',
            description: 'Not for sale.',
            category: 'potion',
            price: 0,
            effect: { kind: 'heal', amount: 5 },
          },
        },
        npcs: { s: { ...base, role: { kind: 'shop', stock: ['f:gift'] } } },
      },
    });
    expect(() => loadGameContent([corePack, free])).toThrow(/not sold/);
    expect(bad(['core:potion'])).not.toThrow();
  });
});
