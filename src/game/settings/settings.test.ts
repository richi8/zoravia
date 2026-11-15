import { describe, expect, it } from 'vitest';
import { createBindings } from '@game/input/actions';
import {
  allDefault,
  cycle,
  DEFAULT_SETTINGS,
  gameSettings,
  groupKeys,
  installSettings,
  KEY_GROUPS,
  KEYS_KEY,
  loadSettings,
  onSettingsChange,
  persistBindings,
  rebindGroup,
  SETTINGS_KEY,
  slotLocked,
  textCharsPerSecond,
  updateSettings,
  type KeyGroup,
} from '.';

class MemoryStorage {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

const group = (id: string): KeyGroup => {
  const g = KEY_GROUPS.find((x) => x.id === id);
  if (!g) throw new Error(id);
  return g;
};

describe('game settings', () => {
  it('falls back to the defaults for missing or broken data', () => {
    const s = new MemoryStorage();
    expect(loadSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(s)).toEqual(DEFAULT_SETTINGS);
    s.setItem(SETTINGS_KEY, '{not json');
    expect(loadSettings(s)).toEqual(DEFAULT_SETTINGS);
    s.setItem(SETTINGS_KEY, JSON.stringify({ battleSpeed: 3, textSpeed: 'fast', shake: 'no' }));
    expect(loadSettings(s)).toEqual({ ...DEFAULT_SETTINGS, textSpeed: 'fast' });
  });

  it('stores changes and tells listeners', () => {
    const s = new MemoryStorage();
    installSettings(s);
    const seen: number[] = [];
    const off = onSettingsChange((x) => seen.push(x.battleSpeed));
    updateSettings({ battleSpeed: 2, flashes: false });
    off();
    updateSettings({ battleSpeed: 1.5 });
    expect(seen).toEqual([2]);
    expect(gameSettings()).toMatchObject({ battleSpeed: 1.5, flashes: false });
    expect(loadSettings(s)).toEqual(gameSettings());
    installSettings(undefined);
    expect(gameSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('cycles choices both ways and maps text speeds', () => {
    expect(cycle([1, 1.5, 2], 2)).toBe(1);
    expect(cycle([1, 1.5, 2], 1, -1)).toBe(2);
    expect(cycle(['a', 'b'], 'x')).toBe('b');
    expect(textCharsPerSecond({ ...DEFAULT_SETTINGS, textSpeed: 'slow' })).toBeLessThan(
      textCharsPerSecond(DEFAULT_SETTINGS),
    );
  });
});

describe('key rebinding', () => {
  it('moves both halves of a direction together', () => {
    const b = createBindings();
    expect(rebindGroup(b, group('up'), 0, 'KeyK')).toEqual({ ok: true });
    expect(b.keysFor('move_up')).toEqual(['KeyK', 'ArrowUp']);
    expect(b.keysFor('nav_up')).toEqual(['KeyK', 'ArrowUp']);
    expect(b.conflicts()).toEqual([]);
  });

  it('swaps with the control that used the key', () => {
    const b = createBindings();
    const r = rebindGroup(b, group('up'), 0, 'KeyS');
    expect(r).toEqual({ ok: true, note: 'S moved from Down.' });
    expect(groupKeys(b, group('up'))).toEqual(['KeyS', 'ArrowUp']);
    expect(groupKeys(b, group('down'))).toEqual(['KeyW', 'ArrowDown']);
    expect(b.conflicts()).toEqual([]);
  });

  it('refuses a swap that leaves a control without keys', () => {
    const b = createBindings();
    // Up's second slot is ArrowUp; Bag's only key is I. Filling an empty slot can't swap.
    expect(rebindGroup(b, group('dex'), 1, 'KeyI')).toEqual({
      ok: false,
      reason: 'I is the only key for Bag · battle items.',
    });
    expect(b.keysFor('inventory')).toEqual(['KeyI']);
    // Replacing a filled slot gives the old key back: B and I trade places.
    expect(rebindGroup(b, group('dex'), 0, 'KeyI').ok).toBe(true);
    expect(b.keysFor('dex')).toEqual(['KeyI']);
    expect(b.keysFor('inventory')).toEqual(['KeyB']);
  });

  it('keeps Esc as Back and Menu', () => {
    const b = createBindings();
    expect(rebindGroup(b, group('confirm'), 0, 'Escape').ok).toBe(false);
    expect(slotLocked(b, group('back'), 1)).toBe(true);
    expect(rebindGroup(b, group('back'), 1, 'KeyX').ok).toBe(false);
    expect(slotLocked(b, group('pause'), 0)).toBe(true);
    expect(rebindGroup(b, group('pause'), 1, 'KeyX')).toEqual({ ok: true });
    expect(b.keysFor('pause')).toEqual(['Escape', 'KeyX']);
    expect(rebindGroup(b, group('back'), 0, 'Mouse0').ok).toBe(false);
  });

  it('shows two slots per group without mouse buttons', () => {
    const b = createBindings();
    expect(groupKeys(b, group('back'))).toEqual(['KeyQ', 'Escape']);
    expect(groupKeys(b, group('inspect'))).toEqual(['KeyF', undefined]);
    // Mouse2 stays bound when a key slot of Back changes.
    rebindGroup(b, group('back'), 0, 'KeyX');
    expect(b.keysFor('back')).toEqual(['KeyX', 'Escape', 'Backspace', 'Mouse2']);
  });

  it('persists the profile and restores it', () => {
    const s = new MemoryStorage();
    const b = createBindings();
    const off = persistBindings(b, s);
    rebindGroup(b, group('map'), 0, 'KeyN');
    off();
    expect(JSON.parse(s.getItem(KEYS_KEY) ?? '{}')).toMatchObject({
      overrides: { map: ['KeyN'] },
    });
    const again = createBindings();
    persistBindings(again, s);
    expect(again.keysFor('map')).toEqual(['KeyN']);
    expect(allDefault(again)).toBe(false);
    again.reset();
    expect(allDefault(again)).toBe(true);
    s.setItem(KEYS_KEY, 'garbage');
    const third = createBindings();
    persistBindings(third, s);
    expect(allDefault(third)).toBe(true);
  });
});
