/**
 * Hooks let packs inject behaviour at named extension points the engine/game exposes.
 *
 * Each hook is a *transform*: handlers receive the current value plus a read-only context
 * and return the (possibly changed) value; the next handler gets that result. Handlers run
 * by `priority` (lower first, default 0), then in pack load order — fully deterministic.
 *
 * ```ts
 * type Hooks = { 'battle:damage': HookSpec<number, { moveId: string }> };
 * hooks.add('mod-a', 'battle:damage', (dmg, ctx) => (ctx.moveId === 'core:tackle' ? dmg + 1 : dmg));
 * const dmg = hooks.run('battle:damage', 10, { moveId: 'core:tackle' });
 * ```
 */

export interface HookSpec<V, C = undefined> {
  readonly value: V;
  readonly context: C;
}

export type HookMap = { [name: string]: HookSpec<unknown, unknown> };

export type HookHandler<S extends HookSpec<unknown, unknown>> = (
  value: S['value'],
  context: S['context'],
) => S['value'];

export interface HookOptions {
  /** Lower runs first. Default 0. */
  readonly priority?: number;
}

/** What the run arguments look like: context is omitted when it is `undefined`. */
export type HookRunArgs<S extends HookSpec<unknown, unknown>> = [S['context']] extends [undefined]
  ? [value: S['value']]
  : [value: S['value'], context: S['context']];

interface Registered {
  readonly pack: string;
  readonly priority: number;
  readonly order: number;
  readonly handler: (value: unknown, context: unknown) => unknown;
}

export class HookRegistry<H extends HookMap = HookMap> {
  private readonly handlers = new Map<keyof H, Registered[]>();
  private counter = 0;

  add<K extends keyof H>(
    pack: string,
    name: K,
    handler: HookHandler<H[K]>,
    options: HookOptions = {},
  ): void {
    const list = this.handlers.get(name) ?? [];
    list.push({
      pack,
      priority: options.priority ?? 0,
      order: this.counter++,
      handler: handler as Registered['handler'],
    });
    list.sort((a, b) => a.priority - b.priority || a.order - b.order);
    this.handlers.set(name, list);
  }

  run<K extends keyof H>(name: K, ...args: HookRunArgs<H[K]>): H[K]['value'] {
    const [initial, context] = args as [unknown, unknown];
    let value = initial;
    for (const h of this.handlers.get(name) ?? []) value = h.handler(value, context);
    return value as H[K]['value'];
  }

  has(name: keyof H): boolean {
    return (this.handlers.get(name)?.length ?? 0) > 0;
  }

  /** Packs with a handler for `name`, in run order. */
  packsFor(name: keyof H): string[] {
    return (this.handlers.get(name) ?? []).map((h) => h.pack);
  }
}
