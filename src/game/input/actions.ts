/**
 * Zoravia's input actions, contexts and default key bindings (DESIGN.md → Controls).
 *
 * The same physical keys drive different actions depending on the active context:
 * `W A S D` / arrows are `move_*` in the overworld and `nav_*` in every menu
 * (including the battle menus).
 */

import { Bindings, InputManager, type BindingTable, type InputContextDef } from '@engine/input';

export const ACTIONS = [
  'move_up',
  'move_down',
  'move_left',
  'move_right',
  'nav_up',
  'nav_down',
  'nav_left',
  'nav_right',
  'confirm',
  'back',
  'hotbar1',
  'hotbar2',
  'hotbar3',
  /** Keyboard tooltips: put a cursor on icons and badges to read what they mean. */
  'inspect',
  'inventory',
  /** Battle log (C31 G2 tweak): every line of the current battle. */
  'log',
  'map',
  'party',
  'dex',
  'quests',
  'pause',
  'debug_overlay',
] as const;

export type Action = (typeof ACTIONS)[number];

const UP = ['KeyW', 'ArrowUp'];
const DOWN = ['KeyS', 'ArrowDown'];
const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];

export const DEFAULT_BINDINGS: BindingTable<Action> = {
  move_up: UP,
  move_down: DOWN,
  move_left: LEFT,
  move_right: RIGHT,
  nav_up: UP,
  nav_down: DOWN,
  nav_left: LEFT,
  nav_right: RIGHT,
  confirm: ['KeyE', 'Enter', 'Space', 'NumpadEnter'],
  // Right click = back keeps menus fully usable with the mouse alone.
  back: ['KeyQ', 'Escape', 'Backspace', 'Mouse2'],
  hotbar1: ['Digit1', 'Numpad1'],
  hotbar2: ['Digit2', 'Numpad2'],
  hotbar3: ['Digit3', 'Numpad3'],
  inspect: ['KeyF'],
  inventory: ['KeyI'],
  log: ['KeyL'],
  map: ['KeyM'],
  party: ['KeyP'],
  dex: ['KeyB'],
  quests: ['KeyJ'],
  pause: ['Escape'],
  debug_overlay: ['F3'],
};

const NAV = ['nav_up', 'nav_down', 'nav_left', 'nav_right', 'confirm', 'back'] as const;

export const CONTEXTS = [
  {
    id: 'overworld',
    actions: [
      'move_up',
      'move_down',
      'move_left',
      'move_right',
      'confirm',
      'inventory',
      'map',
      'party',
      'dex',
      'quests',
      'pause',
    ],
  },
  { id: 'menu', actions: [...NAV, 'inspect'] },
  /**
   * Battle: the move bar and menus (navigation), `1 2 3` direct switching, `I` items, `L` the
   * battle log and `F` inspect. `Q` (back) on the move bar runs.
   */
  {
    id: 'battle',
    actions: [...NAV, 'hotbar1', 'hotbar2', 'hotbar3', 'inventory', 'log', 'inspect'],
  },
  /** Dialogue text: `E` advances (hold to speed up), `Q` skips/closes. Battle text is timed. */
  { id: 'dialog', actions: ['confirm', 'back'] },
] as const satisfies readonly InputContextDef<Action>[];

export type InputContextId = (typeof CONTEXTS)[number]['id'];

export const GLOBAL_ACTIONS: readonly Action[] = ['debug_overlay'];

export const MOVE_DIRECTIONS = {
  up: 'move_up',
  down: 'move_down',
  left: 'move_left',
  right: 'move_right',
} as const;

export const NAV_DIRECTIONS = {
  up: 'nav_up',
  down: 'nav_down',
  left: 'nav_left',
  right: 'nav_right',
} as const;

export function createBindings(): Bindings<Action> {
  return new Bindings<Action>({
    defaults: DEFAULT_BINDINGS,
    contexts: CONTEXTS,
    global: GLOBAL_ACTIONS,
  });
}

export function createInput(bindings = createBindings()): InputManager<Action> {
  return new InputManager<Action>(bindings, { contexts: CONTEXTS, global: GLOBAL_ACTIONS });
}
