import { describe, expect, it } from 'vitest';
import { loadGameContent } from '@game/data';
import { newParty } from '@game/player';
import { createZorling } from '@game/progression';
import { trainerBattle } from '@game/story';
import { newGameState, readSave, toSave } from '@game/save';
import { loadRegion } from '@game/world/map';
import { VERDALE_START } from '../../tools/balance/verdale';
import { corePack } from '.';

const content = loadGameContent([corePack]);
const start = content.starts.require('core:verdale');
const MIRA = ['core:mira-willowmere', 'core:mira-fernhollow', 'core:mira-galecrest'];

describe('Verdale start', () => {
  it('starts on a walkable tile with the three starters at Lv 6', () => {
    const map = loadRegion(content, start.map);
    const spot = map.anchors[start.anchor];
    expect(spot).toBeDefined();
    if (spot) expect(map.blocked(spot.x, spot.y)).toBe(false);
    expect(start.starters.map((s) => s.species)).toEqual([
      'core:sprigling',
      'core:drizzlet',
      'core:emberkit',
    ]);
    expect(start.level).toBe(6);
  });

  it('makes a new game that saves and loads', () => {
    const state = newGameState(content, 'core:verdale', 'core:drizzlet');
    expect(state.party.team.map((z) => [z.species, z.level])).toEqual([['core:drizzlet', 6]]);
    expect(state.party.flags).toEqual({ 'core:starter-drizzlet': 1 });
    expect(state.party.bag).toEqual({ 'core:potion': 2, 'core:zorb': 5 });
    expect(state.party.money).toBe(500);
    expect(state.party.dex.caught).toEqual(['core:drizzlet']);
    expect(state.place).toMatchObject({ map: 'core:verdale', x: 100, y: 199 });
    expect(readSave(content, toSave(content, state))).toEqual(state);
    expect(() => newGameState(content, 'core:verdale', 'core:pipwing')).toThrow(/not a starter/);
  });

  it('is the start the balance simulator plays from', () => {
    expect(VERDALE_START).toEqual({
      starterLevel: start.level,
      bag: start.bag,
      money: start.money,
    });
  });

  it.each(start.starters.map((s) => [s.species, s] as const))(
    'Rival Mira picks the starter line that beats %s',
    (_, starter) => {
      const mine = content.species.require(starter.species).types[0] ?? '';
      const party = {
        ...newParty({
          team: [createZorling(content, { uid: 'p', species: starter.species, level: 6 })],
        }),
        flags: { [starter.flag]: 1 },
      };
      for (const id of MIRA) {
        for (const badges of [[], ['core:grove-badge']]) {
          const foes = trainerBattle(content, { ...party, badges }, id, 1).setup.opponent;
          const starterLine = foes.find((z) =>
            ['core:sprigling', 'core:drizzlet', 'core:emberkit'].includes(
              content.evolutionLine(z.species).members[0]?.id ?? '',
            ),
          );
          expect(starterLine, `${id} has a starter line`).toBeDefined();
          const theirs = content.species.require(starterLine?.species ?? '').types;
          expect(content.effectiveness(theirs[0] ?? '', [mine]), id).toBeGreaterThan(1);
        }
      }
    },
  );
});
