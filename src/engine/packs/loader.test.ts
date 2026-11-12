import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import {
  basePack,
  creatures,
  items,
  remixPack,
  type FixtureHooks,
} from '../../../tests/fixtures/packs';
import { PackError } from './errors';
import type { NamespacedId } from './ids';
import { PackLoader } from './loader';
import { definePack, type PackDefinition } from './pack';
import { defineRegistry } from './registry';

const loader = (): PackLoader<FixtureHooks> => new PackLoader<FixtureHooks>([creatures, items]);

/** Loads and returns the thrown PackError (fails the test if nothing was thrown). */
function loadError(packs: readonly PackDefinition<FixtureHooks>[]): PackError {
  try {
    loader().load(packs);
  } catch (err) {
    if (err instanceof PackError) return err;
    throw err;
  }
  throw new Error('expected load to fail');
}

describe('PackLoader — two fixture packs, one overriding the other', () => {
  const content = loader().load([remixPack, basePack]); // deliberately out of order

  it('orders packs by dependency', () => {
    expect(content.packs.map((p) => p.id)).toEqual(['base', 'remix']);
  });

  it('adds entries under each pack namespace', () => {
    const reg = content.registry(creatures);
    expect(reg.ids()).toEqual(['base:sparkit', 'base:pebblet', 'remix:blazer']);
    expect(reg.require('remix:blazer')).toEqual({
      id: 'remix:blazer',
      name: 'Blazer',
      hp: 50,
      moves: [],
    });
    expect(reg.inNamespace('base').map((e) => e.id)).toEqual(['base:sparkit', 'base:pebblet']);
  });

  it('override replaces the whole entry and records the origin', () => {
    const reg = content.registry(creatures);
    expect(reg.get('base:sparkit')).toMatchObject({ name: 'Sparkit (Remix)', hp: 45 });
    expect(reg.origin('base:sparkit')).toEqual({ addedBy: 'base', modifiedBy: ['remix'] });
    expect(reg.origin('base:pebblet')).toEqual({ addedBy: 'base', modifiedBy: [] });
  });

  it('patch merges fields into the existing entry', () => {
    expect(content.registry(items).require('base:potion')).toEqual({
      id: 'base:potion',
      name: 'Potion',
      price: 50,
    });
  });

  it('hooks run in pack order', () => {
    expect(content.hooks.run('shop:price', 10)).toBe(21); // base ×2, then remix +1
    expect(content.hooks.packsFor('shop:price')).toEqual(['base', 'remix']);
    expect(content.hooks.run('battle:damage', 10, { attacker: 'remix:blazer' })).toBe(15);
    expect(content.hooks.run('battle:damage', 10, { attacker: 'base:pebblet' })).toBe(10);
  });

  it('entries are frozen and typed from the schema', () => {
    const e = content.registry(creatures).require('base:sparkit');
    expectTypeOf(e.hp).toEqualTypeOf<number>();
    expectTypeOf(e.id).toEqualTypeOf<NamespacedId>();
    expect(Object.isFrozen(e)).toBe(true);
    expect(Object.isFrozen(e.moves)).toBe(true);
  });

  it('base alone loads without the remix changes', () => {
    const only = loader().load([basePack]);
    expect(only.registry(creatures).require('base:sparkit').name).toBe('Sparkit');
    expect(only.registry(items).require('base:potion').price).toBe(100);
  });

  it('require() gives a readable error with a hint', () => {
    expect(() => content.registry(creatures).require('core:blazer')).toThrow(
      'Unknown creatures "core:blazer". Did you mean "remix:blazer"?',
    );
  });

  it('rejects registries the loader does not know', () => {
    const other = defineRegistry('creatures', z.object({}));
    expect(() => content.registry(other)).toThrow('was not passed to this PackLoader');
  });

  it('is deterministic', () => {
    const a = loader().load([basePack, remixPack]);
    const b = loader().load([remixPack, basePack]);
    expect(a.registry(creatures).values()).toEqual(b.registry(creatures).values());
  });
});

describe('PackLoader — invalid packs fail with readable messages', () => {
  it('reports schema errors with pack and path', () => {
    const bad = definePack({
      manifest: { id: 'bad', version: '1.0.0' },
      content: { creatures: { glitch: { name: 'Glitch', hp: 'lots' } } },
    });
    const err = loadError([bad]);
    expect(err.message).toBe(
      'Failed to load content packs (1 issue):\n' +
        '  - [bad] content.creatures.glitch.hp: Invalid input: expected number, received string',
    );
    expect(err.issues).toHaveLength(1);
  });

  it('collects every issue at once', () => {
    const bad = definePack({
      manifest: { id: 'bad', version: '1.0.0' },
      content: {
        creatures: {
          a: { name: '', hp: 1 },
          b: { name: 'B', hp: 1, extra: true },
          c: { name: 'C', hp: 1, moves: ['zap'] },
        },
      },
    });
    const paths = loadError([bad]).issues.map((i) => i.path);
    expect(paths).toEqual([
      'content.creatures.a.name',
      'content.creatures.b',
      'content.creatures.c.moves[0]',
    ]);
  });

  it('invalid manifest', () => {
    const msg = loadError([{ manifest: { id: 'Bad Pack', version: 'one' } }]).message;
    expect(msg).toContain('[Bad Pack] manifest.id: Pack id must be lowercase');
    expect(msg).toContain('[Bad Pack] manifest.version: Version must look like "1.0.0"');
  });

  it('unknown content kind', () => {
    const msg = loadError([
      { manifest: { id: 'x', version: '1.0.0' }, content: { spells: { a: {} } } },
    ]).message;
    expect(msg).toContain(
      '[x] content.spells: Unknown content kind "spells" (known: "creatures", "items")',
    );
  });

  it('missing dependency and version mismatch', () => {
    expect(loadError([remixPack]).message).toContain(
      '[remix] manifest.dependsOn: Pack "base" is not loaded',
    );
    const old = definePack({ ...basePack, manifest: { ...basePack.manifest, version: '2.0.0' } });
    expect(loadError([old, remixPack]).message).toContain(
      'Needs "base@^1.0.0" but version 2.0.0 is loaded',
    );
  });

  it('dependency cycle', () => {
    const a = definePack({ manifest: { id: 'a', version: '1.0.0', dependsOn: ['b'] } });
    const b = definePack({ manifest: { id: 'b', version: '1.0.0', dependsOn: ['a'] } });
    expect(loadError([a, b]).message).toContain('Dependency cycle: a → b → a');
  });

  it('duplicate pack id', () => {
    expect(loadError([basePack, basePack]).message).toContain(
      '[base] manifest.id: Duplicate pack id',
    );
  });

  it('cannot add into another namespace or re-add an existing id', () => {
    const sneaky = definePack({
      manifest: { id: 'sneaky', version: '1.0.0', dependsOn: ['base'] },
      content: { creatures: { 'base:pebblet': { name: 'P', hp: 1 } } },
    });
    expect(loadError([basePack, sneaky]).message).toContain(
      `content.creatures.base:pebblet: Content ids are added to the pack's own namespace`,
    );
  });

  it('override needs a dependency and an existing target', () => {
    const noDep = definePack({
      manifest: { id: 'nodep', version: '1.0.0' },
      overrides: { creatures: { 'base:pebblet': { name: 'P', hp: 1 } } },
    });
    expect(loadError([basePack, noDep]).message).toContain(
      'Pack "nodep" must depend on "base" to change "base:pebblet"',
    );
    const missing = definePack({
      manifest: { id: 'missing', version: '1.0.0', dependsOn: ['base'] },
      overrides: { creatures: { 'base:ghost': { name: 'G', hp: 1 } } },
    });
    expect(loadError([basePack, missing]).message).toContain(
      'Cannot override unknown creatures "base:ghost"',
    );
  });

  it('transitive dependency allows overriding', () => {
    const mid = definePack({ manifest: { id: 'mid', version: '1.0.0', dependsOn: ['base'] } });
    const top = definePack({
      manifest: { id: 'top', version: '1.0.0', dependsOn: ['mid'] },
      patches: { creatures: { 'base:pebblet': { hp: 99 } } },
    });
    const content = loader().load([top, mid, basePack]);
    expect(content.registry(creatures).require('base:pebblet').hp).toBe(99);
  });

  it('patched result is re-validated', () => {
    const bad = definePack({
      manifest: { id: 'bad', version: '1.0.0', dependsOn: ['base'] },
      patches: { items: { 'base:net': { price: -5 } } },
    });
    expect(loadError([basePack, bad]).message).toContain('[bad] patches.items.base:net.price:');
  });

  it('a throwing setup is reported, not crashed', () => {
    const bad = definePack({
      manifest: { id: 'bad', version: '1.0.0' },
      setup: () => {
        throw new Error('oops');
      },
    });
    expect(loadError([bad]).message).toContain('[bad] setup: threw: oops');
  });
});

describe('PackLoader — cross-entry refs and checks', () => {
  const moves = defineRegistry('moves', z.strictObject({ name: z.string() }));
  const beasts = defineRegistry(
    'beasts',
    z.strictObject({
      moves: z.array(z.string()).default([]),
      evolvesTo: z.string().optional(),
    }),
    {
      refs: (e) => [
        ...e.moves.map((id, i) => ({ path: ['moves', i], kind: 'moves', id })),
        ...(e.evolvesTo ? [{ path: ['evolvesTo'], kind: 'beasts', id: e.evolvesTo }] : []),
      ],
      check: (e, ctx) =>
        e.evolvesTo === e.id || ctx.values('beasts').length > 3
          ? [{ path: ['evolvesTo'], message: 'Bad evolution' }]
          : [],
    },
  );
  const load = (packs: PackDefinition[]): PackError | undefined => {
    try {
      new PackLoader([moves, beasts]).load(packs);
    } catch (err) {
      if (err instanceof PackError) return err;
      throw err;
    }
    return undefined;
  };

  it('accepts valid references, including ones fixed by a later patch', () => {
    const a = definePack({
      manifest: { id: 'a', version: '1.0.0' },
      content: { moves: { zap: { name: 'Zap' } }, beasts: { pup: { moves: ['a:zip'] } } },
    });
    const b = definePack({
      manifest: { id: 'b', version: '1.0.0', dependsOn: ['a'] },
      patches: { beasts: { 'a:pup': { moves: ['a:zap'] } } },
    });
    expect(load([a, b])).toBeUndefined();
  });

  it('reports unknown references with the pack and path that set them', () => {
    const a = definePack({
      manifest: { id: 'a', version: '1.0.0' },
      content: {
        moves: { zap: { name: 'Zap' } },
        beasts: { pup: { moves: ['a:zap', 'x:zap'] }, dog: { evolvesTo: 'a:dog' } },
      },
    });
    const b = definePack({
      manifest: { id: 'b', version: '1.0.0', dependsOn: ['a'] },
      patches: { beasts: { 'a:dog': { evolvesTo: 'a:wolf' } } },
    });
    expect(load([a, b])?.issues).toEqual([
      {
        pack: 'a',
        path: 'content.beasts.pup.moves[1]',
        message: 'Unknown moves "x:zap". Did you mean "a:zap"?',
      },
      { pack: 'b', path: 'patches.beasts.a:dog.evolvesTo', message: 'Unknown beasts "a:wolf".' },
    ]);
  });

  it('runs custom checks with access to all entries', () => {
    const a = definePack({
      manifest: { id: 'a', version: '1.0.0' },
      content: { beasts: { pup: { evolvesTo: 'a:pup' } } },
    });
    expect(load([a])?.message).toContain('[a] content.beasts.pup.evolvesTo: Bad evolution');
  });
});
