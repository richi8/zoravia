/**
 * The input a UI widget needs, independent of the game's action names.
 * Build one from an `InputManager` with `uiInputFrom`.
 */

import type { Direction, InputManager } from '../input/input-manager';

export interface UiInput {
  /** Navigation this step, with auto-repeat while held. */
  direction(): Direction | undefined;
  confirmPressed(): boolean;
  confirmHeld(): boolean;
  backPressed(): boolean;
  /** Position of a primary (left) click started this step, if any. */
  pointerPressed(): { readonly x: number; readonly y: number } | undefined;
  /** Ignore currently held keys until released (focus moved to a new widget). */
  suppressHeld(): void;
}

export interface UiActionMap<A extends string> {
  readonly up: A;
  readonly down: A;
  readonly left: A;
  readonly right: A;
  readonly confirm: A;
  readonly back: A;
}

export function uiInputFrom<A extends string>(
  input: InputManager<A>,
  map: UiActionMap<A>,
): UiInput {
  const dirs = ['up', 'down', 'left', 'right'] as const;
  return {
    direction: () => dirs.find((d) => input.repeated(map[d])),
    confirmPressed: () => input.pressed(map.confirm),
    confirmHeld: () => input.held(map.confirm),
    backPressed: () => input.pressed(map.back),
    pointerPressed: () =>
      input.rawPressed('Mouse0') ? { x: input.pointer.x, y: input.pointer.y } : undefined,
    suppressHeld: () => input.suppressHeld(),
  };
}
