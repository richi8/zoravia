import { definePack, PackError, type PackContent } from '@engine/packs';
import { describe, expect, it } from 'vitest';
import { corePack } from '@packs/core';
import { loadGameContent } from '.';

/** Loads core plus a mod pack and returns the issue messages (empty if it loads). */
function modIssues(mod: { content?: PackContent; patches?: PackContent }): string[] {
  const pack = definePack({
    manifest: { id: 'mod', version: '1.0.0', dependsOn: ['core'] },
    ...mod,
  });
  try {
    loadGameContent([corePack, pack]);
    return [];
  } catch (err) {
    if (err instanceof PackError) return err.issues.map((i) => `${i.path}: ${i.message}`);
    throw err;
  }
}

const mon = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  name: 'Testmon',
  types: ['core:fire'],
  baseStats: { hp: 100, attack: 100, defense: 100, speed: 100 },
  learnset: [{ level: 1, move: 'core:ember' }],
  ...extra,
});

describe('game data validation', () => {
  it('a mod can add a species using core moves', () => {
    expect(modIssues({ content: { species: { testmon: mon() } } })).toEqual([]);
  });

  it('reports unknown references with a hint', () => {
    expect(
      modIssues({
        content: { species: { testmon: mon({ learnset: [{ level: 1, move: 'mod:ember' }] }) } },
      }),
    ).toEqual([
      'content.species.testmon.learnset[0].move: Unknown moves "mod:ember". Did you mean "core:ember"?',
    ]);
  });

  it('rejects evolution loops, long lines and level order problems', () => {
    expect(
      modIssues({
        content: {
          species: {
            a: mon({ evolution: { into: 'mod:b', level: 10 } }),
            b: mon({ evolution: { into: 'mod:a', level: 20 } }),
          },
        },
      }),
    ).toContain(
      // Levels must rise along a line, so a loop always breaks this rule somewhere.
      'content.species.a.evolution.level: Must be above the level it evolved at (20)',
    );

    const long = modIssues({
      content: {
        species: {
          a: mon({ evolution: { into: 'mod:b', level: 10 } }),
          b: mon({ evolution: { into: 'mod:c', level: 20 } }),
          c: mon({ evolution: { into: 'mod:d', level: 30 } }),
          d: mon(),
        },
      },
    });
    expect(long).toEqual(['content.species.a.evolution: Evolution line has more than 3 stages']);
  });

  it('checks young body plans against the line length', () => {
    const line = (young: string[]): string[] =>
      modIssues({
        content: {
          species: {
            a: mon({ evolution: { into: 'mod:b', level: 10 } }),
            b: mon({ look: { seed: 1, plan: 'serpent', young } }),
          },
        },
      });
    expect(line(['fish'])).toEqual([]);
    expect(line(['fish', 'blob'])).toEqual([
      'content.species.b.look.young: Lists 2 young plans, but the line has 1 earlier stage(s)',
    ]);
  });

  it('rejects two species evolving into one, and evolving legendaries', () => {
    const issues = modIssues({
      content: {
        species: {
          a: mon({ evolution: { into: 'mod:c', level: 10 } }),
          b: mon({ evolution: { into: 'mod:c', level: 10 } }),
          c: mon(),
        },
      },
      patches: {
        species: { 'core:glacivar': { evolution: { into: 'core:ironshell', level: 50 } } },
      },
    });
    expect(issues).toContain(
      'content.species.c: More than one species evolves into it ("mod:a", "mod:b")',
    );
    expect(issues).toContain('patches.species.core:glacivar.legendary: Legendaries never evolve');
  });

  it('rejects unordered or duplicate learnsets', () => {
    const issues = modIssues({
      content: {
        species: {
          a: mon({
            learnset: [
              { level: 5, move: 'core:ember' },
              { level: 1, move: 'core:ember' },
            ],
          }),
        },
      },
    });
    expect(issues).toEqual([
      'content.species.a.learnset[1].level: Learnset must be in level order',
      'content.species.a.learnset: "core:ember" is learned twice',
    ]);
  });

  it('rejects a second reaction for the same type and condition', () => {
    const issues = modIssues({
      content: {
        reactions: {
          boil: { name: 'Boil', condition: 'core:burning', type: 'core:water' },
        },
      },
    });
    expect(issues).toContain(
      'content.reactions.boil.type: "core:steam-burst" already reacts to the same type and condition',
    );
  });

  it('rejects a 0-power move that applies nothing', () => {
    expect(
      modIssues({
        content: { moves: { dud: { name: 'Dud', type: 'core:fire', power: 0, accuracy: 100 } } },
      }),
    ).toEqual([
      'content.moves.dud.applyChance: A move with 0 power must apply its condition (applyChance > 0)',
    ]);
  });

  it('a patch can rebalance core content', () => {
    const pack = definePack({
      manifest: { id: 'mod', version: '1.0.0', dependsOn: ['core'] },
      patches: { items: { 'core:potion': { price: 80 } } },
    });
    expect(loadGameContent([corePack, pack]).items.require('core:potion').price).toBe(80);
  });
});
