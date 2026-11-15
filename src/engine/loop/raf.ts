/**
 * Drives a callback with `requestAnimationFrame`, passing elapsed ms since the last frame.
 * Pauses automatically while the page is hidden and skips the gap on return.
 *
 * An error thrown by the callback stops the driver (C39): a broken frame would throw again on
 * every later frame. With `onError` the error is handed over; without it, it is rethrown.
 */

export interface FrameDriver {
  start(): void;
  stop(): void;
  readonly running: boolean;
}

export function createRafDriver(
  onFrame: (elapsedMs: number, now: number) => void,
  onError?: (error: unknown) => void,
): FrameDriver {
  let handle = 0;
  let last = 0;
  let running = false;

  const tick = (now: number): void => {
    if (!running) return;
    const elapsed = last === 0 ? 0 : now - last;
    last = now;
    try {
      onFrame(elapsed, now);
    } catch (error) {
      halt();
      if (!onError) throw error;
      onError(error);
      return;
    }
    handle = requestAnimationFrame(tick);
  };

  const onVisibility = (): void => {
    // Coming back from a hidden tab: restart timing instead of replaying the gap.
    if (!document.hidden) last = 0;
  };

  const halt = (): void => {
    running = false;
    cancelAnimationFrame(handle);
    document.removeEventListener('visibilitychange', onVisibility);
  };

  return {
    get running() {
      return running;
    },
    start() {
      if (running) return;
      running = true;
      last = 0;
      document.addEventListener('visibilitychange', onVisibility);
      handle = requestAnimationFrame(tick);
    },
    stop: halt,
  };
}
