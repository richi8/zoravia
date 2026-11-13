import { describe, expect, it } from 'vitest';
import { loadGameContent } from '@game/data';
import { createZorling, gainXp, xpForLevel, type Zorling } from '@game/progression';
import { corePack } from '@packs/core';
import { answerMoveOffer, evolveMember, newParty, offersFrom, offerValid, type Offer } from '.';

const content = loadGameContent([corePack]);
const make = (species: string, level: number, uid: string): Zorling =>
  createZorling(content, { uid, species: `core:${species}`, level });
const toLevel = (z: Zorling, level: number) =>
  gainXp(content, z, xpForLevel(level) - z.xp, { badges: 0 });

describe('level-up offers', () => {
  it('collects move offers, then one evolution offer per member, in team order', () => {
    const ember = make('emberkit', 13, 'e'); // ember, gust, kindle: full
    const pud = make('puddlit', 21, 'p'); // splash-shot, drench, mud-toss: full
    const a = toLevel(ember, 16); // Lv 14 flame-pounce offer, Lv 16 can evolve
    const b = toLevel(pud, 22); // can evolve
    const offers = offersFrom([a.zorling, b.zorling], [a.events, b.events]);
    expect(offers).toEqual<Offer[]>([
      { kind: 'move', uid: 'e', move: 'core:flame-pounce' },
      { kind: 'evolve', uid: 'e', into: 'core:blazekit' },
      { kind: 'evolve', uid: 'p', into: 'core:torrentoad' },
    ]);
    // Only one evolution offer even after several level ups past the evolution level.
    const c = toLevel(ember, 18);
    expect(offersFrom([c.zorling], [c.events]).filter((o) => o.kind === 'evolve')).toHaveLength(1);
  });

  it('replaces a move or skips it', () => {
    const ember = make('emberkit', 13, 'e');
    const party = newParty({ team: [ember] });
    const learned = answerMoveOffer(content, party, 'e', 'core:flame-pounce', 1);
    expect(learned.team[0]?.moves).toEqual(['core:ember', 'core:flame-pounce', 'core:kindle']);
    const skipped = answerMoveOffer(content, party, 'e', 'core:flame-pounce', null);
    expect(skipped.team[0]?.moves).toEqual(ember.moves);
    // A free slot takes it without asking.
    const two = newParty({ team: [{ ...ember, moves: ['core:ember'] }] });
    const free = answerMoveOffer(content, two, 'e', 'core:flame-pounce', null);
    expect(free.team[0]?.moves).toEqual(['core:ember', 'core:flame-pounce']);
  });

  it('evolves, logs the new species and offers the moves the new form learns now', () => {
    const pud = toLevel(make('puddlit', 21, 'p'), 22).zorling;
    const party = newParty({ team: [pud] });
    const r = evolveMember(content, party, 'p');
    expect(r.party.team[0]?.species).toBe('core:torrentoad');
    expect(r.party.team[0]?.level).toBe(22);
    expect(r.party.dex.caught).toContain('core:torrentoad');
    expect(r.events[0]).toEqual({
      kind: 'evolved',
      from: 'core:puddlit',
      into: 'core:torrentoad',
    });
    // Torrentoad learns Tide Crash at 22; Puddlit's 3 slots are full, so it is an offer.
    expect(r.offers).toEqual([{ kind: 'move', uid: 'p', move: 'core:tide-crash' }]);
    expect(() => evolveMember(content, r.party, 'p')).toThrow(/cannot evolve/);
    expect(() => evolveMember(content, party, 'nobody')).toThrow(/No team member/);
  });

  it('drops offers that no longer apply', () => {
    const ember = toLevel(make('emberkit', 13, 'e'), 16).zorling;
    const party = newParty({ team: [ember] });
    const move: Offer = { kind: 'move', uid: 'e', move: 'core:flame-pounce' };
    const evo: Offer = { kind: 'evolve', uid: 'e', into: 'core:blazekit' };
    expect(offerValid(content, party, move)).toBe(true);
    expect(offerValid(content, party, evo)).toBe(true);
    const learned = answerMoveOffer(content, party, 'e', 'core:flame-pounce', 0);
    expect(offerValid(content, learned, move)).toBe(false);
    const evolved = evolveMember(content, party, 'e').party;
    expect(offerValid(content, evolved, evo)).toBe(false);
    expect(offerValid(content, newParty({ team: [make('puddlit', 5, 'x')] }), move)).toBe(false);
  });
});
