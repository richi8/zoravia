import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { EventBus } from './events';

type TestEvents = {
  'scene:changed': { from: string; to: string };
  'score:add': number;
  'game:paused': undefined;
};

describe('EventBus', () => {
  it('delivers payloads to subscribers in order', () => {
    const bus = new EventBus<TestEvents>();
    const calls: string[] = [];
    bus.on('scene:changed', (e) => calls.push(`a:${e.to}`));
    bus.on('scene:changed', (e) => calls.push(`b:${e.to}`));
    bus.emit('scene:changed', { from: 'title', to: 'world' });
    expect(calls).toEqual(['a:world', 'b:world']);
  });

  it('supports payload-less (undefined) events', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    bus.on('game:paused', handler);
    bus.emit('game:paused');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe via returned function and off()', () => {
    const bus = new EventBus<TestEvents>();
    const a = vi.fn();
    const b = vi.fn();
    const unsubscribe = bus.on('score:add', a);
    bus.on('score:add', b);
    unsubscribe();
    bus.off('score:add', b);
    bus.emit('score:add', 1);
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
    expect(bus.listenerCount()).toBe(0);
  });

  it('once() fires a single time', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    bus.once('score:add', handler);
    bus.emit('score:add', 1);
    bus.emit('score:add', 2);
    expect(handler).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('subscribing/unsubscribing during emit does not affect that emit', () => {
    const bus = new EventBus<TestEvents>();
    const late = vi.fn();
    const second = vi.fn();
    bus.on('score:add', () => {
      bus.on('score:add', late);
      bus.off('score:add', second);
    });
    bus.on('score:add', second);
    bus.emit('score:add', 1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(late).not.toHaveBeenCalled();
    bus.emit('score:add', 2);
    expect(late).toHaveBeenCalledWith(2);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('listenerCount and clear', () => {
    const bus = new EventBus<TestEvents>();
    bus.on('score:add', () => {});
    bus.on('game:paused', () => {});
    expect(bus.listenerCount('score:add')).toBe(1);
    expect(bus.listenerCount()).toBe(2);
    bus.clear('score:add');
    expect(bus.listenerCount()).toBe(1);
    bus.clear();
    expect(bus.listenerCount()).toBe(0);
  });

  it('is typed end-to-end', () => {
    const bus = new EventBus<TestEvents>();

    bus.on('scene:changed', (e) => {
      expectTypeOf(e).toEqualTypeOf<{ from: string; to: string }>();
    });
    bus.on('score:add', (n) => {
      expectTypeOf(n).toEqualTypeOf<number>();
    });

    // Compile-time checks: each line below must be a type error.
    const typeErrors = (): void => {
      // @ts-expect-error unknown event name
      bus.on('nope', () => {});
      // @ts-expect-error wrong payload type
      bus.emit('score:add', 'ten');
      // @ts-expect-error missing payload
      bus.emit('score:add');
      // @ts-expect-error payload-less event takes no payload
      bus.emit('game:paused', 1);
      // @ts-expect-error payload missing a field
      bus.emit('scene:changed', { from: 'a' });
      // @ts-expect-error handler expects the wrong payload type
      bus.on('score:add', (s: string) => s);
    };
    expect(typeErrors).toBeTypeOf('function');
  });
});
