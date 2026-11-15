import { describe, expect, it } from 'vitest';
import { crashDetails, crashSaveLine } from './crash';

describe('crash screen text (C39)', () => {
  it('shows the version, the error and the top of the stack', () => {
    const error = new TypeError('x is not a function');
    error.stack = [
      'TypeError: x is not a function',
      '    at a (main.js:1:1)',
      '    at b (main.js:2:2)',
      '    at c (main.js:3:3)',
      '    at d (main.js:4:4)',
      '    at e (main.js:5:5)',
    ].join('\n');
    expect(crashDetails(error, 'v1.0.0').split('\n')).toEqual([
      'Zoravia v1.0.0',
      'TypeError: x is not a function',
      'at a (main.js:1:1)',
      'at b (main.js:2:2)',
      'at c (main.js:3:3)',
      'at d (main.js:4:4)',
    ]);
  });

  it('copes with a thrown value that is not an Error', () => {
    expect(crashDetails('just a string', 'v1.0.0')).toBe('Zoravia v1.0.0\njust a string');
  });

  it('never claims a save that did not happen', () => {
    expect(crashSaveLine(true)).toMatch(/saved just now/);
    expect(crashSaveLine(false)).not.toMatch(/saved just now/);
  });
});
