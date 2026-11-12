import { describe, expect, expectTypeOf, it } from 'vitest';
import { assert, AssertionError, assertDefined, assertNever, defined, unreachable } from './assert';

describe('assert helpers', () => {
  it('assert passes on truthy and throws AssertionError with message on falsy', () => {
    expect(() => assert(1)).not.toThrow();
    expect(() => assert(0, 'boom')).toThrow(new AssertionError('boom'));
    expect(() => assert(false)).toThrow(AssertionError);
  });

  it('assertDefined narrows and throws on null/undefined only', () => {
    const value = [1, 2][0];
    assertDefined(value);
    expectTypeOf(value).toEqualTypeOf<number>();
    expect(() => assertDefined(0)).not.toThrow();
    expect(() => assertDefined('')).not.toThrow();
    expect(() => assertDefined(null)).toThrow(AssertionError);
    expect(() => assertDefined(undefined, 'missing')).toThrow('missing');
  });

  it('defined returns the narrowed value', () => {
    const list = ['a'];
    const first = defined(list[0]);
    expectTypeOf(first).toEqualTypeOf<string>();
    expect(first).toBe('a');
    expect(() => defined(list[1], 'empty')).toThrow('empty');
  });

  it('assertNever enforces exhaustiveness', () => {
    type Kind = 'a' | 'b';
    const label = (k: Kind): string => {
      switch (k) {
        case 'a':
          return 'A';
        case 'b':
          return 'B';
        default:
          return assertNever(k);
      }
    };
    expect(label('a')).toBe('A');
    expect(() => assertNever('x' as never)).toThrow('Unexpected value: x');
  });

  it('unreachable throws', () => {
    expect(() => unreachable()).toThrow(AssertionError);
  });

  it('AssertionError has its name set', () => {
    expect(new AssertionError('x').name).toBe('AssertionError');
  });
});
