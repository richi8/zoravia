/**
 * Context-sensitive input state, sampled once per fixed step.
 *
 * - Raw events (`keyDown`, `keyUp`, pointer…) are buffered; `update(dt)` turns them into
 *   per-step edges, so a tap shorter than one frame is still seen as `pressed`.
 * - A **context stack** decides which actions are live: only the top context's actions
 *   (plus global actions) answer queries. `W` can be `move_up` in `overworld` and `nav_up`
 *   in `menu` — whichever context is on top wins.
 * - Keys held while the context changes are suppressed until released, so the `E` that
 *   opened a dialog does not also "hold to speed up" its text.
 * - `repeated(action)` gives menu-style auto-repeat (first press, then after `delay`, every
 *   `interval`) driven by the fixed step — independent of OS key repeat.
 * - Mouse buttons are bindable as `Mouse0`…`Mouse4`; pointer position is tracked too.
 */

import { assert } from '../core/assert';
import type { Bindings, InputContextDef, KeyCode } from './bindings';

export interface RepeatOptions {
  /** Seconds before auto-repeat starts. Default 0.35. */
  readonly delay?: number;
  /** Seconds between repeats. Default 0.08. */
  readonly interval?: number;
}

export interface InputManagerOptions<A extends string> {
  readonly contexts: readonly InputContextDef<A>[];
  readonly global?: readonly A[];
  readonly repeat?: RepeatOptions;
}

interface KeyState {
  down: boolean;
  pendingPress: boolean;
  pendingRelease: boolean;
  pressed: boolean;
  released: boolean;
  suppressed: boolean;
}

interface ActionState {
  held: boolean;
  pressed: boolean;
  released: boolean;
  repeated: boolean;
  heldTime: number;
  nextRepeat: number;
  pressStep: number;
  consumed: boolean;
}

export interface PointerState {
  readonly x: number;
  readonly y: number;
  /** Pointer is over the game surface. */
  readonly inside: boolean;
  /** Pointer moved since the previous step. */
  readonly moved: boolean;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export class InputManager<A extends string> {
  private readonly keys = new Map<KeyCode, KeyState>();
  private readonly actions = new Map<A, ActionState>();
  private readonly contextDefs: ReadonlyMap<string, ReadonlySet<A>>;
  private readonly global: ReadonlySet<A>;
  private readonly stack: string[] = [];
  private readonly repeatDelay: number;
  private readonly repeatInterval: number;
  private step = 0;
  private pointerState = { x: 0, y: 0, inside: false, moved: false };
  private pointerMovedPending = false;

  constructor(
    readonly bindings: Bindings<A>,
    options: InputManagerOptions<A>,
  ) {
    this.contextDefs = new Map(options.contexts.map((c) => [c.id, new Set(c.actions)]));
    this.global = new Set(options.global ?? []);
    this.repeatDelay = options.repeat?.delay ?? 0.35;
    this.repeatInterval = options.repeat?.interval ?? 0.08;
    for (const action of bindings.actions) this.actions.set(action, emptyAction());
  }

  // ---------------------------------------------------------------- raw events

  keyDown(code: KeyCode): void {
    const key = this.key(code);
    if (key.down) return; // OS auto-repeat
    key.down = true;
    key.pendingPress = true;
  }

  keyUp(code: KeyCode): void {
    const key = this.keys.get(code);
    if (!key?.down) return;
    key.down = false;
    key.pendingRelease = true;
    key.suppressed = false;
  }

  /** Releases everything (window blur, tab hidden). */
  releaseAll(): void {
    for (const [code, key] of this.keys) if (key.down) this.keyUp(code);
  }

  pointerMove(x: number, y: number, inside = true): void {
    this.pointerState = { ...this.pointerState, x, y, inside };
    this.pointerMovedPending = true;
  }

  pointerLeave(): void {
    this.pointerState = { ...this.pointerState, inside: false };
  }

  pointerDown(button: number, x: number, y: number): void {
    this.pointerMove(x, y);
    this.keyDown(`Mouse${button}`);
  }

  pointerUp(button: number, x: number, y: number): void {
    this.pointerMove(x, y);
    this.keyUp(`Mouse${button}`);
  }

  /** Whether `code` is bound to an action in the active context (DOM adapter uses this to preventDefault). */
  isBoundNow(code: KeyCode): boolean {
    return this.bindings.actionsForKey(code).some((a) => this.isActive(a));
  }

  // ---------------------------------------------------------------- step

  /** Call once per fixed step, before game logic reads input. */
  update(dt: number): void {
    this.step++;
    for (const key of this.keys.values()) {
      key.pressed = key.pendingPress;
      key.released = key.pendingRelease;
      key.pendingPress = false;
      key.pendingRelease = false;
    }
    this.pointerState = { ...this.pointerState, moved: this.pointerMovedPending };
    this.pointerMovedPending = false;

    for (const [action, s] of this.actions) {
      const keys = this.bindings.keysFor(action);
      let held = false;
      let pressed = false;
      let released = false;
      for (const code of keys) {
        const k = this.keys.get(code);
        if (!k || k.suppressed) continue;
        held ||= k.down;
        pressed ||= k.pressed;
        released ||= k.released;
      }
      const wasHeld = s.held;
      s.held = held;
      s.pressed = pressed;
      s.released = released || (wasHeld && !held && !released);
      s.consumed = false;
      if (pressed) {
        s.heldTime = 0;
        s.nextRepeat = this.repeatDelay;
        s.pressStep = this.step;
        s.repeated = true;
      } else if (held) {
        s.heldTime += dt;
        s.repeated = s.heldTime + 1e-9 >= s.nextRepeat;
        if (s.repeated) s.nextRepeat += this.repeatInterval;
      } else {
        s.heldTime = 0;
        s.repeated = false;
      }
    }
  }

  // ---------------------------------------------------------------- contexts

  /** Pushes a context; returns a function that removes exactly this entry. */
  pushContext(id: string): () => void {
    assert(this.contextDefs.has(id), `Unknown input context "${id}"`);
    this.stack.push(id);
    this.suppressHeld();
    const index = this.stack.length - 1;
    return () => {
      if (this.stack[index] === id) this.stack.splice(index, 1);
      else {
        const i = this.stack.lastIndexOf(id);
        if (i >= 0) this.stack.splice(i, 1);
      }
      this.suppressHeld();
    };
  }

  popContext(): string | undefined {
    const id = this.stack.pop();
    this.suppressHeld();
    return id;
  }

  /** Replaces the whole stack (e.g. on scene change). */
  setContexts(ids: readonly string[]): void {
    for (const id of ids) assert(this.contextDefs.has(id), `Unknown input context "${id}"`);
    this.stack.length = 0;
    this.stack.push(...ids);
    this.suppressHeld();
  }

  get context(): string | undefined {
    return this.stack[this.stack.length - 1];
  }

  get contextStack(): readonly string[] {
    return this.stack;
  }

  isActive(action: A): boolean {
    if (this.global.has(action)) return true;
    const top = this.context;
    return top !== undefined && (this.contextDefs.get(top)?.has(action) ?? false);
  }

  // ---------------------------------------------------------------- queries

  held(action: A): boolean {
    return this.live(action)?.held ?? false;
  }

  pressed(action: A): boolean {
    const s = this.live(action);
    return s !== undefined && s.pressed && !s.consumed;
  }

  released(action: A): boolean {
    return this.live(action)?.released ?? false;
  }

  /** Press plus auto-repeat while held — use for menu cursor movement. */
  repeated(action: A): boolean {
    const s = this.live(action);
    return s !== undefined && s.repeated && !s.consumed;
  }

  /** Seconds the action has been held (0 if not held). */
  heldTime(action: A): number {
    const s = this.live(action);
    return s?.held ? s.heldTime : 0;
  }

  /** Marks this step's press/repeat as handled, so later readers see `false`. */
  consume(action: A): void {
    const s = this.actions.get(action);
    if (s) s.consumed = true;
  }

  /** Held direction among four actions; the most recently pressed one wins. */
  direction(dirs: Readonly<Record<Direction, A>>): Direction | undefined {
    let best: Direction | undefined;
    let bestStep = -1;
    for (const dir of ['up', 'down', 'left', 'right'] as const) {
      const s = this.live(dirs[dir]);
      if (s?.held && s.pressStep > bestStep) {
        best = dir;
        bestStep = s.pressStep;
      }
    }
    return best;
  }

  /** Raw key/button press this step, ignoring contexts and bindings (e.g. `"Mouse0"`). */
  rawPressed(code: KeyCode): boolean {
    const k = this.keys.get(code);
    return !!k && k.pressed && !k.suppressed;
  }

  get pointer(): PointerState {
    return this.pointerState;
  }

  // ---------------------------------------------------------------- internals

  private live(action: A): ActionState | undefined {
    return this.isActive(action) ? this.actions.get(action) : undefined;
  }

  private key(code: KeyCode): KeyState {
    let key = this.keys.get(code);
    if (!key) {
      key = {
        down: false,
        pendingPress: false,
        pendingRelease: false,
        pressed: false,
        released: false,
        suppressed: false,
      };
      this.keys.set(code, key);
    }
    return key;
  }

  /**
   * Ignores keys that are currently down until they are released. Called automatically on
   * context changes; UI calls it when focus moves to a newly opened widget.
   */
  suppressHeld(): void {
    for (const key of this.keys.values()) {
      // Presses not yet sampled happened after the change; let them through.
      if (key.down && !key.pendingPress) key.suppressed = true;
    }
    for (const s of this.actions.values()) {
      s.held = false;
      s.pressed = false;
      s.repeated = false;
      s.heldTime = 0;
    }
  }
}

function emptyAction(): ActionState {
  return {
    held: false,
    pressed: false,
    released: false,
    repeated: false,
    heldTime: 0,
    nextRepeat: 0,
    pressStep: -1,
    consumed: false,
  };
}
