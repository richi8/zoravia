/**
 * Key hints that follow the player's bindings (C36e). `main.ts` installs the live bindings;
 * until then (tests, the lab) hints read the default bindings. Every on-screen key hint
 * (overworld help line, battle bar, panels, map window, title) asks here instead of
 * spelling a key, so rebinding a key changes every hint that shows it.
 */

import { keyLabel, type Bindings, type KeyCode } from '@engine/input';
import { DEFAULT_BINDINGS, type Action } from './actions';

let bindings: Bindings<Action> | undefined;

export function installKeyHints(b: Bindings<Action> | undefined): void {
  bindings = b;
}

function keysOf(action: Action): readonly KeyCode[] {
  return bindings ? bindings.keysFor(action) : DEFAULT_BINDINGS[action];
}

/** The label of the first keyboard key bound to `action` ("E", "Esc", "↑"), or "—". */
export function keyHint(action: Action): string {
  const key = keysOf(action).find((k) => !k.startsWith('Mouse'));
  return key === undefined ? '—' : keyLabel(key);
}

/**
 * Several actions' keys in one hint: "W/S", "A/D", or "WASD" when every key is one letter
 * and there are four of them.
 */
export function keysHint(...actions: readonly Action[]): string {
  const labels = actions.map(keyHint);
  if (labels.length === 4 && labels.every((l) => /^[A-Z0-9]$/.test(l))) {
    // Up, left, down, right reads as the familiar "WASD".
    const [up, down, left, right] = labels;
    return `${up}${left}${down}${right}`;
  }
  return labels.join('/');
}

/** Up/down navigation ("W/S"). */
export const upDownHint = (): string => keysHint('nav_up', 'nav_down');
/** Left/right navigation ("A/D"). */
export const leftRightHint = (): string => keysHint('nav_left', 'nav_right');
/** All four navigation directions ("WASD"). */
export const navHint = (): string => keysHint('nav_up', 'nav_down', 'nav_left', 'nav_right');
