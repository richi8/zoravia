/**
 * Assertion helpers. They throw `AssertionError` and narrow types for the compiler.
 * Use them for programmer errors (broken invariants), not for user-facing validation.
 */

export class AssertionError extends Error {
  override readonly name = 'AssertionError';
}

/** Throws if `condition` is falsy. Narrows `condition` to truthy. */
export function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new AssertionError(message);
}

/** Throws if `value` is `null` or `undefined`. Narrows the value in place. */
export function assertDefined<T>(
  value: T,
  message = 'Expected value to be defined',
): asserts value is NonNullable<T> {
  if (value === null || value === undefined) throw new AssertionError(message);
}

/**
 * Returns `value` if it is not `null`/`undefined`, otherwise throws.
 * Handy with `noUncheckedIndexedAccess`: `const first = defined(list[0], 'list is empty')`.
 */
export function defined<T>(value: T, message = 'Expected value to be defined'): NonNullable<T> {
  assertDefined(value, message);
  return value;
}

/** Exhaustiveness check for `switch` statements and unions. */
export function assertNever(value: never, message?: string): never {
  throw new AssertionError(message ?? `Unexpected value: ${String(value)}`);
}

/** Marks code that must never run. */
export function unreachable(message = 'Unreachable code reached'): never {
  throw new AssertionError(message);
}
