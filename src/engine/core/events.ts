/**
 * Typed event bus. Declare an event map once and every `on`/`emit` is checked:
 *
 * ```ts
 * type Events = { 'scene:changed': { id: string }; 'game:paused': undefined };
 * const bus = new EventBus<Events>();
 * bus.on('scene:changed', (e) => e.id); // e: { id: string }
 * bus.emit('game:paused');              // no payload for `undefined` events
 * ```
 *
 * Handlers run synchronously in subscription order. Subscribing or unsubscribing
 * during an emit does not affect the emit in progress.
 */

/** Map of event name → payload type. Use `undefined` for events without a payload. */
export type EventMap = { [K in string]: unknown };

export type EventHandler<P> = (payload: P) => void;
export type Unsubscribe = () => void;

/** Arguments for `emit`: payload is omitted for `undefined` events. */
export type EmitArgs<P> = [P] extends [undefined] ? [] : [payload: P];

export class EventBus<E extends EventMap> {
  private readonly handlers = new Map<keyof E, Set<EventHandler<never>>>();

  /** Subscribe; returns a function that unsubscribes. */
  on<K extends keyof E>(type: K, handler: EventHandler<E[K]>): Unsubscribe {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as EventHandler<never>);
    return () => this.off(type, handler);
  }

  /** Subscribe for a single emit. */
  once<K extends keyof E>(type: K, handler: EventHandler<E[K]>): Unsubscribe {
    const unsubscribe = this.on(type, (payload) => {
      unsubscribe();
      handler(payload);
    });
    return unsubscribe;
  }

  off<K extends keyof E>(type: K, handler: EventHandler<E[K]>): void {
    const set = this.handlers.get(type);
    if (!set) return;
    set.delete(handler as EventHandler<never>);
    if (set.size === 0) this.handlers.delete(type);
  }

  emit<K extends keyof E>(type: K, ...args: EmitArgs<E[K]>): void {
    const set = this.handlers.get(type);
    if (!set) return;
    const payload = args[0] as E[K];
    for (const handler of [...set]) (handler as EventHandler<E[K]>)(payload);
  }

  /** Number of handlers for `type`, or for all events when omitted. */
  listenerCount(type?: keyof E): number {
    if (type !== undefined) return this.handlers.get(type)?.size ?? 0;
    let n = 0;
    for (const set of this.handlers.values()) n += set.size;
    return n;
  }

  /** Remove handlers for `type`, or all handlers when omitted. */
  clear(type?: keyof E): void {
    if (type === undefined) this.handlers.clear();
    else this.handlers.delete(type);
  }
}
