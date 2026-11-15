/**
 * Connects an `InputManager` to the browser: keyboard on `window`, pointer on the canvas.
 * Bound keys get `preventDefault` (no page scroll on Space/arrows, no browser search on F3).
 * Typing in form fields is ignored. Window blur releases all keys.
 */

import type { InputManager } from './input-manager';

export interface DomInputOptions {
  readonly keyTarget?: Window;
  /** Element for pointer events; coordinates are relative to it, in CSS pixels. */
  readonly pointerTarget?: HTMLElement;
  /** Maps element-relative CSS coordinates (e.g. into game pixels via `engine.toScreen`). */
  readonly mapPoint?: (x: number, y: number) => { x: number; y: number };
}

export function attachDomInput<A extends string>(
  input: InputManager<A>,
  options: DomInputOptions = {},
): () => void {
  const win = options.keyTarget ?? window;
  const el = options.pointerTarget;
  const disposers: (() => void)[] = [];
  const on = <K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    fn: (e: WindowEventMap[K]) => void,
  ): void => {
    target.addEventListener(type, fn);
    disposers.push(() => target.removeEventListener(type, fn));
  };

  const isTyping = (e: Event): boolean => {
    const t = e.target as HTMLElement | null;
    return !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
  };

  on(win, 'keydown', (e) => {
    if (isTyping(e) || e.metaKey || e.ctrlKey) return;
    if (input.isBoundNow(e.code)) e.preventDefault();
    if (!e.repeat) input.keyDown(e.code);
  });
  on(win, 'keyup', (e) => input.keyUp(e.code));
  on(win, 'blur', () => input.releaseAll());

  if (el) {
    const local = (e: PointerEvent): [number, number] => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (!options.mapPoint) return [x, y];
      const p = options.mapPoint(x, y);
      return [p.x, p.y];
    };
    const listen = <K extends keyof HTMLElementEventMap>(
      type: K,
      fn: (e: HTMLElementEventMap[K]) => void,
    ): void => {
      el.addEventListener(type, fn);
      disposers.push(() => el.removeEventListener(type, fn));
    };
    listen('pointermove', (e) => input.pointerMove(...local(e)));
    listen('pointerdown', (e) => input.pointerDown(e.button, ...local(e)));
    listen('pointerleave', () => input.pointerLeave());
    listen('contextmenu', (e) => e.preventDefault());
    // Lines and pages count as 16 and 400 pixels, so every device scrolls about alike.
    const wheel = (e: WheelEvent): void => {
      e.preventDefault();
      input.wheel(e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1));
    };
    el.addEventListener('wheel', wheel, { passive: false });
    disposers.push(() => el.removeEventListener('wheel', wheel));
    // Release on window so a drag ending outside the canvas still releases.
    on(win, 'pointerup', (e) => input.pointerUp(e.button, ...local(e)));
  }

  return () => {
    for (const d of disposers) d();
  };
}
