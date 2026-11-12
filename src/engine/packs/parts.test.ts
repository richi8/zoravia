import { describe, expect, it } from 'vitest';
import { HookRegistry, type HookSpec } from './hooks';
import { isNamespacedId, makeId, parseId, resolveId } from './ids';
import { compareVersions, satisfies } from './version';

describe('ids', () => {
  it('make / parse / validate', () => {
    expect(makeId('core', 'emberfox')).toBe('core:emberfox');
    expect(parseId('core:ember-fox_2')).toEqual({ namespace: 'core', local: 'ember-fox_2' });
    expect(isNamespacedId('core:emberfox')).toBe(true);
    expect(isNamespacedId('Core:emberfox')).toBe(false);
    expect(isNamespacedId('emberfox')).toBe(false);
    expect(isNamespacedId('a:b:c')).toBe(false);
    expect(() => makeId('core', 'Ember Fox')).toThrow('Invalid id "core:Ember Fox"');
  });

  it('resolveId fills in the own namespace', () => {
    expect(resolveId('tackle', 'core')).toBe('core:tackle');
    expect(resolveId('lava:blaze', 'core')).toBe('lava:blaze');
    expect(() => resolveId('bad:', 'core')).toThrow();
  });
});

describe('version', () => {
  it('compares', () => {
    expect(compareVersions('1.2.3', '1.10.0')).toBe(-1);
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });

  it('satisfies ranges', () => {
    expect(satisfies('1.5.0', '*')).toBe(true);
    expect(satisfies('1.5.0', '1.5.0')).toBe(true);
    expect(satisfies('1.5.1', '1.5.0')).toBe(false);
    expect(satisfies('3.0.0', '>=1.5.0')).toBe(true);
    expect(satisfies('1.4.9', '>=1.5.0')).toBe(false);
    expect(satisfies('1.9.0', '^1.2.0')).toBe(true);
    expect(satisfies('2.0.0', '^1.2.0')).toBe(false);
    expect(satisfies('1.1.0', '^1.2.0')).toBe(false);
    expect(satisfies('0.2.5', '^0.2.0')).toBe(true);
    expect(satisfies('0.3.0', '^0.2.0')).toBe(false);
    expect(() => satisfies('1.0.0', '~1.0.0')).toThrow('Invalid version range');
  });
});

describe('HookRegistry', () => {
  type H = { 'n:double': HookSpec<number>; 'n:ctx': HookSpec<string, { suffix: string }> };

  it('runs handlers by priority, then registration order', () => {
    const hooks = new HookRegistry<H>();
    const calls: string[] = [];
    hooks.add('a', 'n:double', (v) => (calls.push('a'), v * 2));
    hooks.add('b', 'n:double', (v) => (calls.push('b'), v + 1), { priority: -1 });
    hooks.add('c', 'n:double', (v) => (calls.push('c'), v - 3));
    expect(hooks.run('n:double', 5)).toBe(9); // b: 6, a: 12, c: 9
    expect(calls).toEqual(['b', 'a', 'c']);
    expect(hooks.packsFor('n:double')).toEqual(['b', 'a', 'c']);
  });

  it('passes context and returns the initial value with no handlers', () => {
    const hooks = new HookRegistry<H>();
    expect(hooks.has('n:ctx')).toBe(false);
    expect(hooks.run('n:ctx', 'x', { suffix: '!' })).toBe('x');
    hooks.add('a', 'n:ctx', (v, c) => v + c.suffix);
    expect(hooks.run('n:ctx', 'x', { suffix: '!' })).toBe('x!');
  });
});
