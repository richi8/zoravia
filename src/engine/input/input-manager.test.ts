import { describe, expect, it } from 'vitest';
import { Bindings } from './bindings';
import { InputManager } from './input-manager';
import { keyLabel } from './key-labels';

type A = 'up' | 'down' | 'left' | 'right' | 'ok' | 'click';
const DT = 1 / 60;

function make() {
  const bindings = new Bindings<A>({
    defaults: {
      up: ['KeyW'],
      down: ['KeyS'],
      left: ['KeyA'],
      right: ['KeyD'],
      ok: ['KeyE', 'Enter'],
      click: ['Mouse0'],
    },
    contexts: [{ id: 'main', actions: ['up', 'down', 'left', 'right', 'ok', 'click'] }],
  });
  const input = new InputManager<A>(bindings, {
    contexts: [
      { id: 'main', actions: ['up', 'down', 'left', 'right', 'ok', 'click'] },
      { id: 'empty', actions: [] },
    ],
    repeat: { delay: 0.3, interval: 0.1 },
  });
  input.setContexts(['main']);
  return input;
}

describe('InputManager edges', () => {
  it('pressed is true for exactly one step; held continues', () => {
    const input = make();
    input.keyDown('KeyE');
    input.update(DT);
    expect([input.pressed('ok'), input.held('ok')]).toEqual([true, true]);
    input.update(DT);
    expect([input.pressed('ok'), input.held('ok')]).toEqual([false, true]);
    input.keyUp('KeyE');
    input.update(DT);
    expect([input.released('ok'), input.held('ok')]).toEqual([true, false]);
  });

  it('a tap shorter than one step still counts as pressed', () => {
    const input = make();
    input.keyDown('KeyE');
    input.keyUp('KeyE');
    input.update(DT);
    expect(input.pressed('ok')).toBe(true);
    expect(input.held('ok')).toBe(false);
  });

  it('OS key repeat (keydown while down) is ignored', () => {
    const input = make();
    input.keyDown('KeyE');
    input.update(DT);
    input.keyDown('KeyE');
    input.update(DT);
    expect(input.pressed('ok')).toBe(false);
  });

  it('two keys for one action: held until both released', () => {
    const input = make();
    input.keyDown('KeyE');
    input.keyDown('Enter');
    input.update(DT);
    input.keyUp('KeyE');
    input.update(DT);
    expect(input.held('ok')).toBe(true);
    input.keyUp('Enter');
    input.update(DT);
    expect(input.held('ok')).toBe(false);
  });

  it('consume hides the press from later readers in the same step', () => {
    const input = make();
    input.keyDown('KeyE');
    input.update(DT);
    input.consume('ok');
    expect(input.pressed('ok')).toBe(false);
    expect(input.held('ok')).toBe(true);
  });

  it('heldTime accumulates', () => {
    const input = make();
    input.keyDown('KeyE');
    for (let i = 0; i < 31; i++) input.update(DT);
    expect(input.heldTime('ok')).toBeCloseTo(0.5);
  });
});

describe('InputManager repeat', () => {
  it('fires on press, after the delay, then every interval', () => {
    const input = make();
    input.keyDown('KeyS');
    const fired: number[] = [];
    for (let step = 0; step < 60; step++) {
      input.update(DT);
      if (input.repeated('down')) fired.push(step);
    }
    // step 0 press; heldTime reaches 0.3 at step 18, then +0.1 (6 steps) each.
    expect(fired).toEqual([0, 18, 24, 30, 36, 42, 48, 54]);
  });
});

describe('InputManager contexts', () => {
  it('actions outside the active context read false', () => {
    const input = make();
    input.keyDown('KeyE');
    input.pushContext('empty');
    input.update(DT);
    expect(input.pressed('ok')).toBe(false);
  });

  it('keys held across a context change are suppressed until released', () => {
    const input = make();
    input.keyDown('KeyE');
    input.update(DT);
    const close = input.pushContext('empty');
    close();
    input.update(DT);
    expect(input.held('ok')).toBe(false);
    input.keyUp('KeyE');
    input.keyDown('KeyE');
    input.update(DT);
    expect(input.pressed('ok')).toBe(true);
  });

  it('unknown contexts are rejected', () => {
    expect(() => make().pushContext('nope')).toThrow('Unknown input context "nope"');
  });

  it('direction: most recently pressed held key wins', () => {
    const input = make();
    const dirs = { up: 'up', down: 'down', left: 'left', right: 'right' } as const;
    input.keyDown('KeyW');
    input.update(DT);
    input.keyDown('KeyD');
    input.update(DT);
    expect(input.direction(dirs)).toBe('right');
    input.keyUp('KeyD');
    input.update(DT);
    expect(input.direction(dirs)).toBe('up');
    input.keyUp('KeyW');
    input.update(DT);
    expect(input.direction(dirs)).toBeUndefined();
  });

  it('releaseAll (window blur) clears held keys', () => {
    const input = make();
    input.keyDown('KeyW');
    input.update(DT);
    input.releaseAll();
    input.update(DT);
    expect(input.held('up')).toBe(false);
  });
});

describe('InputManager pointer (optional mouse)', () => {
  it('tracks position and binds mouse buttons as keys', () => {
    const input = make();
    input.pointerMove(10, 20);
    input.update(DT);
    expect(input.pointer).toEqual({ x: 10, y: 20, inside: true, moved: true });
    input.update(DT);
    expect(input.pointer.moved).toBe(false);
    input.pointerDown(0, 15, 25);
    input.update(DT);
    expect(input.pressed('click')).toBe(true);
    expect(input.pointer).toMatchObject({ x: 15, y: 25 });
    input.pointerLeave();
    expect(input.pointer.inside).toBe(false);
  });
});

describe('keyLabel', () => {
  it('formats codes', () => {
    expect(keyLabel('KeyW')).toBe('W');
    expect(keyLabel('Digit1')).toBe('1');
    expect(keyLabel('ArrowUp')).toBe('↑');
    expect(keyLabel('Escape')).toBe('Esc');
    expect(keyLabel('Mouse0')).toBe('Left click');
    expect(keyLabel('F3')).toBe('F3');
  });
});
