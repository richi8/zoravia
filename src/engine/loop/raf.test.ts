import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRafDriver } from './raf';

/** A hand-cranked `requestAnimationFrame`: `frame(now)` runs what was requested. */
function fakeBrowser() {
  let next: ((now: number) => void) | undefined;
  const listeners = new Set<() => void>();
  vi.stubGlobal('requestAnimationFrame', (fn: (now: number) => void) => {
    next = fn;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    next = undefined;
  });
  vi.stubGlobal('document', {
    hidden: false,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  });
  return {
    frame(now: number): boolean {
      const fn = next;
      next = undefined;
      fn?.(now);
      return fn !== undefined;
    },
    listeners,
  };
}

describe('createRafDriver', () => {
  let browser: ReturnType<typeof fakeBrowser>;
  beforeEach(() => {
    browser = fakeBrowser();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('passes the time since the last frame', () => {
    const seen: number[] = [];
    const driver = createRafDriver((elapsed) => seen.push(elapsed));
    driver.start();
    browser.frame(100);
    browser.frame(116);
    browser.frame(150);
    expect(seen).toEqual([0, 16, 34]);
  });

  it('a frame that throws stops the driver and hands the error over once (C39)', () => {
    const errors: unknown[] = [];
    let frames = 0;
    const driver = createRafDriver(
      () => {
        frames++;
        if (frames === 2) throw new Error('boom');
      },
      (e) => errors.push(e),
    );
    driver.start();
    browser.frame(0);
    browser.frame(16);
    expect(driver.running).toBe(false);
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toBe('boom');
    // Nothing was requested after the crash, and the visibility listener is gone.
    expect(browser.frame(32)).toBe(false);
    expect(frames).toBe(2);
    expect(browser.listeners.size).toBe(0);
  });

  it('without an error handler the error is rethrown, and the driver still stops', () => {
    const driver = createRafDriver(() => {
      throw new Error('boom');
    });
    driver.start();
    expect(() => browser.frame(0)).toThrow('boom');
    expect(driver.running).toBe(false);
  });

  it('can be started again after a crash', () => {
    let fail = true;
    let frames = 0;
    const driver = createRafDriver(
      () => {
        if (fail) throw new Error('boom');
        frames++;
      },
      () => undefined,
    );
    driver.start();
    browser.frame(0);
    fail = false;
    driver.start();
    browser.frame(16);
    expect(frames).toBe(1);
    expect(driver.running).toBe(true);
  });
});
