/**
 * Key rebinding rules for the Controls screen (C33). The screen shows **key groups**: what a
 * player thinks of as one control. "Up" is both `move_up` (overworld) and `nav_up` (menus),
 * so both change together and `W` keeps meaning "up" everywhere.
 *
 * Each group shows two key slots. Binding a key another control uses **swaps** them (that
 * control gets the key this slot had), so no key does two things at once. Some things are
 * refused so the game always stays playable by keyboard:
 * - `Esc` is fixed: always Back and Menu. Its slots are locked, and it can't be picked.
 * - A swap that would leave another control with no key at all is refused.
 * - Mouse buttons are not offered (click to move and right-click back stay as they are).
 */

import type { Bindings, KeyCode } from '@engine/input';
import { keyLabel } from '@engine/input';
import type { Action } from '@game/input/actions';

export interface KeyGroup {
  readonly id: string;
  readonly label: string;
  /** Actions changed together; the first one's keys are shown. */
  readonly actions: readonly Action[];
}

export const KEY_GROUPS: readonly KeyGroup[] = [
  { id: 'up', label: 'Up', actions: ['move_up', 'nav_up'] },
  { id: 'down', label: 'Down', actions: ['move_down', 'nav_down'] },
  { id: 'left', label: 'Left', actions: ['move_left', 'nav_left'] },
  { id: 'right', label: 'Right', actions: ['move_right', 'nav_right'] },
  { id: 'confirm', label: 'Confirm · talk', actions: ['confirm'] },
  { id: 'back', label: 'Back', actions: ['back'] },
  { id: 'inspect', label: 'Inspect', actions: ['inspect'] },
  { id: 'pause', label: 'Menu', actions: ['pause'] },
  { id: 'party', label: 'Party', actions: ['party'] },
  { id: 'bag', label: 'Bag · battle items', actions: ['inventory'] },
  { id: 'dex', label: 'Dex', actions: ['dex'] },
  { id: 'map', label: 'Map', actions: ['map'] },
  { id: 'quests', label: 'Quests', actions: ['quests'] },
  { id: 'log', label: 'Battle log', actions: ['log'] },
  { id: 'hotbar1', label: 'Switch to 1', actions: ['hotbar1'] },
  { id: 'hotbar2', label: 'Switch to 2', actions: ['hotbar2'] },
  { id: 'hotbar3', label: 'Switch to 3', actions: ['hotbar3'] },
];

/** Key slots shown per group. */
export const KEY_SLOTS = 2;
/** The key that is always Back and Menu, and cancels picking a key. */
export const FIXED_KEY: KeyCode = 'Escape';

const labelOf = (action: Action): string =>
  KEY_GROUPS.find((g) => g.actions.includes(action))?.label ?? action;

/** The keys shown in a group's slots (undefined = empty slot). */
export function groupKeys(b: Bindings<Action>, group: KeyGroup): (KeyCode | undefined)[] {
  const keys = b.keysFor(group.actions[0] as Action).filter((k) => !k.startsWith('Mouse'));
  return Array.from({ length: KEY_SLOTS }, (_, i) => keys[i]);
}

/** Whether a slot can be changed (`Esc` slots can't). */
export function slotLocked(b: Bindings<Action>, group: KeyGroup, slot: number): boolean {
  return groupKeys(b, group)[slot] === FIXED_KEY;
}

export type RebindOutcome =
  { readonly ok: true; readonly note?: string } | { readonly ok: false; readonly reason: string };

/** Where slot `slot` of the group sits in an action's full key list (mouse keys skipped). */
function slotIndex(keys: readonly KeyCode[], slot: number): number {
  let seen = -1;
  for (let i = 0; i < keys.length; i++) {
    if (keys[i]?.startsWith('Mouse')) continue;
    seen++;
    if (seen === slot) return i;
  }
  return keys.length;
}

/**
 * Binds `key` to slot `slot` of the group (every action in it), swapping with any control that
 * used the key. Refuses `Esc`, mouse buttons, locked slots and swaps that would leave another
 * control without a key; nothing changes then.
 */
export function rebindGroup(
  b: Bindings<Action>,
  group: KeyGroup,
  slot: number,
  key: KeyCode,
): RebindOutcome {
  if (key === FIXED_KEY) return { ok: false, reason: 'Esc is always Back and Menu.' };
  if (key.startsWith('Mouse')) return { ok: false, reason: 'Pick a key on the keyboard.' };
  if (slotLocked(b, group, slot)) return { ok: false, reason: 'Esc stays here.' };
  if (groupKeys(b, group)[slot] === key) return { ok: true };

  const plan = group.actions.map((action) => {
    const keys = b.keysFor(action);
    const index = slotIndex(keys, slot);
    return { action, index, previous: keys[index] };
  });
  const affected = new Set<Action>();
  for (const { action, previous } of plan) {
    for (const other of b.actions) {
      if (group.actions.includes(other) || !b.sharedContext(action, other)) continue;
      if (!b.keysFor(other).includes(key)) continue;
      const left = b.keysFor(other).filter((k) => k !== key);
      if (left.length === 0 && (previous === undefined || previous === FIXED_KEY)) {
        return {
          ok: false,
          reason: `${keyLabel(key)} is the only key for ${labelOf(other)}.`,
        };
      }
      affected.add(other);
    }
  }
  for (const { action, index } of plan) b.rebind(action, index, key, 'swap');
  const names = [...new Set([...affected].map((a) => labelOf(a)))];
  return names.length
    ? { ok: true, note: `${keyLabel(key)} moved from ${names.join(', ')}.` }
    : { ok: true };
}

/** Whether every group's keys are the defaults. */
export function allDefault(b: Bindings<Action>): boolean {
  return Object.keys(b.toProfile().overrides).length === 0;
}

/** Short label of a group's slot ("—" when empty). */
export function slotLabel(key: KeyCode | undefined): string {
  return key === undefined ? '—' : keyLabel(key);
}
