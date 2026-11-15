import { afterEach, describe, expect, it } from 'vitest';
import { createBindings } from './actions';
import { installKeyHints, keyHint, keysHint, leftRightHint, navHint, upDownHint } from './key-hint';

afterEach(() => installKeyHints(undefined));

describe('key hints (C36e)', () => {
  it('read the default bindings before any are installed', () => {
    expect(keyHint('confirm')).toBe('E');
    expect(keyHint('back')).toBe('Q');
    expect(keyHint('pause')).toBe('Esc');
    expect(upDownHint()).toBe('W/S');
    expect(leftRightHint()).toBe('A/D');
    expect(navHint()).toBe('WASD');
    expect(keysHint('hotbar1', 'hotbar2', 'hotbar3')).toBe('1/2/3');
  });

  it('follow a rebound key', () => {
    const b = createBindings();
    installKeyHints(b);
    expect(b.rebind('confirm', 0, 'KeyK', 'steal').ok).toBe(true);
    expect(keyHint('confirm')).toBe('K');
    b.rebind('nav_up', 0, 'KeyI', 'steal');
    expect(upDownHint()).toBe('I/S');
    expect(navHint()).toBe('IASD');
  });

  it('skip mouse buttons and show arrows when only arrows are left', () => {
    const b = createBindings();
    installKeyHints(b);
    b.rebind('back', 0, null);
    expect(keyHint('back')).toBe('Esc');
    b.rebind('nav_up', 0, null);
    expect(keyHint('nav_up')).toBe('↑');
    expect(navHint()).toBe('↑/S/A/D');
  });
});
