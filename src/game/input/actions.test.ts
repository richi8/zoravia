import { describe, expect, it } from 'vitest';
import { createBindings, createInput, MOVE_DIRECTIONS, NAV_DIRECTIONS } from './actions';

/** Presses a key and runs one step. */
function tap(input: ReturnType<typeof createInput>, code: string): void {
  input.keyDown(code);
  input.update(1 / 60);
  input.keyUp(code);
}

describe('Zoravia input — context-sensitive WASD', () => {
  it('W maps to movement in the overworld context', () => {
    const input = createInput();
    input.setContexts(['overworld']);
    input.keyDown('KeyW');
    input.update(1 / 60);
    expect(input.held('move_up')).toBe(true);
    expect(input.held('nav_up')).toBe(false);
    expect(input.direction(MOVE_DIRECTIONS)).toBe('up');
  });

  it('W maps to navigation in the menu context', () => {
    const input = createInput();
    input.setContexts(['overworld', 'menu']);
    input.keyDown('KeyW');
    input.update(1 / 60);
    expect(input.pressed('nav_up')).toBe(true);
    expect(input.held('move_up')).toBe(false);
    expect(input.direction(NAV_DIRECTIONS)).toBe('up');
  });

  it('all of WASD and arrows work in both contexts', () => {
    const pairs = [
      ['KeyW', 'up'],
      ['KeyA', 'left'],
      ['KeyS', 'down'],
      ['KeyD', 'right'],
      ['ArrowUp', 'up'],
      ['ArrowLeft', 'left'],
      ['ArrowDown', 'down'],
      ['ArrowRight', 'right'],
    ] as const;
    for (const [code, dir] of pairs) {
      const input = createInput();
      input.setContexts(['overworld']);
      input.keyDown(code);
      input.update(1 / 60);
      expect(input.held(MOVE_DIRECTIONS[dir])).toBe(true);
      input.keyUp(code);
      input.pushContext('menu');
      input.keyDown(code);
      input.update(1 / 60);
      expect(input.pressed(NAV_DIRECTIONS[dir])).toBe(true);
    }
  });

  it('switching context mid-hold: movement stops, menu ignores the held key until re-pressed', () => {
    const input = createInput();
    input.setContexts(['overworld']);
    input.keyDown('KeyW');
    input.update(1 / 60);
    const close = input.pushContext('menu');
    input.update(1 / 60);
    expect(input.held('nav_up')).toBe(false);
    expect(input.held('move_up')).toBe(false);
    input.keyUp('KeyW');
    input.update(1 / 60);
    input.keyDown('KeyW');
    input.update(1 / 60);
    expect(input.pressed('nav_up')).toBe(true);
    input.keyUp('KeyW');
    close();
    expect(input.context).toBe('overworld');
  });

  it('confirm/back keys from DESIGN.md', () => {
    const input = createInput();
    input.setContexts(['menu']);
    for (const code of ['KeyE', 'Enter', 'Space']) {
      tap(input, code);
      expect(input.pressed('confirm')).toBe(true);
      input.update(1 / 60);
    }
    for (const code of ['KeyQ', 'Escape', 'Backspace']) {
      tap(input, code);
      expect(input.pressed('back')).toBe(true);
      input.update(1 / 60);
    }
  });

  it('Esc is pause in the overworld and back in menus', () => {
    const input = createInput();
    input.setContexts(['overworld']);
    tap(input, 'Escape');
    expect(input.pressed('pause')).toBe(true);
    expect(input.pressed('back')).toBe(false);
    input.pushContext('menu');
    tap(input, 'Escape');
    expect(input.pressed('back')).toBe(true);
    expect(input.pressed('pause')).toBe(false);
  });

  it('right click opens the menu in the overworld and is back in menus (C43)', () => {
    const input = createInput();
    input.setContexts(['overworld']);
    input.pointerDown(2, 10, 10);
    input.update(1 / 60);
    expect(input.pressed('pause')).toBe(true);
    input.pointerUp(2, 10, 10);
    input.update(1 / 60);
    input.pushContext('menu');
    input.pointerDown(2, 10, 10);
    input.update(1 / 60);
    expect(input.pressed('back')).toBe(true);
    expect(input.pressed('pause')).toBe(false);
  });

  it('1 2 3 switch in battle; overworld menu keys work', () => {
    const input = createInput();
    input.setContexts(['battle']);
    tap(input, 'Digit2');
    expect(input.pressed('hotbar2')).toBe(true);
    input.update(1 / 60);
    tap(input, 'KeyI');
    expect(input.pressed('inventory')).toBe(true);
    input.update(1 / 60);
    tap(input, 'KeyL');
    expect(input.pressed('log')).toBe(true);
    input.setContexts(['overworld']);
    for (const [code, action] of [
      ['KeyI', 'inventory'],
      ['KeyM', 'map'],
      ['KeyP', 'party'],
      ['KeyB', 'dex'],
      ['KeyJ', 'quests'],
    ] as const) {
      tap(input, code);
      expect(input.pressed(action)).toBe(true);
    }
  });

  it('F3 debug toggle is global', () => {
    const input = createInput();
    input.setContexts(['dialog']);
    tap(input, 'F3');
    expect(input.pressed('debug_overlay')).toBe(true);
  });

  it('default bindings have no conflicts', () => {
    expect(createBindings().conflicts()).toEqual([]);
  });
});

describe('Zoravia input — rebinding', () => {
  it('rebinding a key works and takes effect immediately', () => {
    const bindings = createBindings();
    const input = createInput(bindings);
    input.setContexts(['overworld']);
    // Move "up" from W to Z (e.g. AZERTY player).
    expect(bindings.rebind('move_up', 0, 'KeyZ').ok).toBe(true);
    expect(bindings.keysFor('move_up')).toEqual(['KeyZ', 'ArrowUp']);
    tap(input, 'KeyZ');
    expect(input.pressed('move_up')).toBe(true);
    input.update(1 / 60);
    tap(input, 'KeyW');
    expect(input.pressed('move_up')).toBe(false);
  });

  it('rejects a conflicting key by default, steals or swaps on request', () => {
    const bindings = createBindings();
    const conflict = bindings.rebind('inventory', 0, 'KeyM');
    expect(conflict.ok).toBe(false);
    expect(conflict.conflicts).toEqual([
      { key: 'KeyM', actions: ['inventory', 'map'], context: 'overworld' },
    ]);
    expect(bindings.keysFor('inventory')).toEqual(['KeyI']);

    bindings.rebind('inventory', 0, 'KeyM', 'swap');
    expect(bindings.keysFor('inventory')).toEqual(['KeyM']);
    expect(bindings.keysFor('map')).toEqual(['KeyI']);

    bindings.rebind('party', 0, 'KeyM', 'steal');
    expect(bindings.keysFor('party')).toEqual(['KeyM']);
    expect(bindings.keysFor('inventory')).toEqual([]);
    expect(bindings.conflicts()).toEqual([]);
  });

  it('same key in non-overlapping contexts is not a conflict', () => {
    const bindings = createBindings();
    // Q is "back" in menus; binding it to the overworld map is fine.
    expect(bindings.rebind('map', 1, 'KeyQ').ok).toBe(true);
    expect(bindings.conflicts()).toEqual([]);
  });

  it('profile round-trip stores only overrides', () => {
    const a = createBindings();
    a.rebind('move_up', 0, 'KeyZ');
    a.rebind('confirm', 3, null);
    const profile = JSON.parse(JSON.stringify(a.toProfile()));
    expect(profile).toEqual({
      version: 1,
      overrides: { move_up: ['KeyZ', 'ArrowUp'], confirm: ['KeyE', 'Enter', 'Space'] },
    });
    const b = createBindings();
    expect(b.loadProfile(profile)).toEqual({ ok: true, skipped: [] });
    expect(b.keysFor('move_up')).toEqual(['KeyZ', 'ArrowUp']);
    expect(b.keysFor('back')).toEqual(['KeyQ', 'Escape', 'Backspace', 'Mouse2']);
  });

  it('loadProfile rejects bad data and skips unknown actions', () => {
    const b = createBindings();
    expect(b.loadProfile({ version: 99, overrides: {} }).ok).toBe(false);
    expect(b.loadProfile({ version: 1, overrides: { fly: ['KeyF'] } })).toEqual({
      ok: true,
      skipped: ['fly'],
    });
  });

  it('reset restores defaults', () => {
    const b = createBindings();
    b.rebind('dex', 0, 'KeyX');
    b.reset('dex');
    expect(b.keysFor('dex')).toEqual(['KeyB']);
    b.rebind('dex', 0, 'KeyX');
    b.reset();
    expect(b.toProfile().overrides).toEqual({});
  });
});
