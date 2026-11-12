/**
 * Scene stack with push / pop / replace and optional transitions.
 *
 * Renderer-agnostic: a `SceneHost` attaches/detaches scene views (the Pixi host adds
 * containers to the stage), so this logic is unit-testable without WebGL.
 *
 * - All scenes on the stack stay attached and visible (an overlay menu over the world).
 * - Only the top scene updates, unless a covered scene sets `updateWhenCovered`.
 * - Lifecycle: `enter` when added, `pause` when covered, `resume` when uncovered,
 *   `exit` when removed. `resize` is called on enter and on every resize.
 * - Operations are queued: a change requested during a transition runs after it.
 * - Transitions are driven by `update(dt)`, so they are deterministic and frame-rate
 *   independent. Cover goes 0 → 1, the stack changes at full cover, then 1 → 0.
 */

import { assert } from '../core/assert';
import { EventBus } from '../core/events';

export interface Scene<V = unknown> {
  readonly id: string;
  readonly view: V;
  /** Keep updating while another scene is on top. Default false. */
  readonly updateWhenCovered?: boolean;
  enter?(): void;
  exit?(): void;
  pause?(): void;
  resume?(): void;
  /** Fixed-step update, `dt` in seconds. */
  update?(dt: number): void;
  /** Called once per rendered frame; `alpha` is the fixed-step interpolation factor. */
  render?(alpha: number): void;
  resize?(width: number, height: number): void;
}

export interface SceneHost<V> {
  attach(view: V): void;
  detach(view: V): void;
}

/** Visual transition. The manager drives `setCover(0..1)`; 1 = scene fully hidden. */
export interface Transition {
  /** Seconds for each half (cover in, cover out). */
  readonly duration: number;
  begin?(): void;
  setCover(amount: number): void;
  end?(): void;
}

export interface SceneChangeOptions {
  readonly transition?: Transition;
}

export type SceneEvents = {
  /** Fired after the stack changes. */
  'scene:changed': { readonly top: string | undefined; readonly stack: readonly string[] };
  'transition:start': undefined;
  'transition:end': undefined;
};

type Op<V> =
  | { readonly kind: 'push'; readonly scene: Scene<V> }
  | { readonly kind: 'pop' }
  | { readonly kind: 'replace'; readonly scene: Scene<V> };

interface Pending<V> {
  readonly op: Op<V>;
  readonly transition: Transition | undefined;
  readonly resolve: () => void;
  readonly reject: (err: unknown) => void;
}

interface Active<V> {
  readonly pending: Pending<V>;
  phase: 'cover' | 'reveal';
  elapsed: number;
}

export class SceneManager<V = unknown> {
  readonly events = new EventBus<SceneEvents>();
  private readonly scenes: Scene<V>[] = [];
  private readonly queue: Pending<V>[] = [];
  private active: Active<V> | undefined;
  private size = { width: 0, height: 0 };

  constructor(private readonly host: SceneHost<V>) {}

  get top(): Scene<V> | undefined {
    return this.scenes[this.scenes.length - 1];
  }

  get stack(): readonly Scene<V>[] {
    return this.scenes;
  }

  get isTransitioning(): boolean {
    return this.active !== undefined;
  }

  push(scene: Scene<V>, options: SceneChangeOptions = {}): Promise<void> {
    return this.enqueue({ kind: 'push', scene }, options);
  }

  pop(options: SceneChangeOptions = {}): Promise<void> {
    return this.enqueue({ kind: 'pop' }, options);
  }

  replace(scene: Scene<V>, options: SceneChangeOptions = {}): Promise<void> {
    return this.enqueue({ kind: 'replace', scene }, options);
  }

  update(dt: number): void {
    this.advanceTransition(dt);
    const top = this.top;
    for (const scene of this.scenes) {
      if (scene === top || scene.updateWhenCovered) scene.update?.(dt);
    }
  }

  render(alpha: number): void {
    for (const scene of this.scenes) scene.render?.(alpha);
  }

  resize(width: number, height: number): void {
    this.size = { width, height };
    for (const scene of this.scenes) scene.resize?.(width, height);
  }

  private enqueue(op: Op<V>, options: SceneChangeOptions): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.queue.push({ op, transition: options.transition, resolve, reject });
      this.processQueue();
    });
  }

  private processQueue(): void {
    while (!this.active) {
      const next = this.queue.shift();
      if (!next) return;
      if (!next.transition) {
        this.applySafely(next);
        continue;
      }
      this.active = { pending: next, phase: 'cover', elapsed: 0 };
      next.transition.begin?.();
      next.transition.setCover(0);
      this.events.emit('transition:start');
      // Zero-duration transitions complete without waiting for a frame.
      if (next.transition.duration <= 0) this.advanceTransition(0);
    }
  }

  private advanceTransition(dt: number): void {
    const active = this.active;
    if (!active) return;
    const { transition } = active.pending;
    assert(transition, 'active transition missing');
    const duration = transition.duration;
    active.elapsed += dt;

    if (active.phase === 'cover') {
      const t = duration <= 0 ? 1 : Math.min(active.elapsed / duration, 1);
      transition.setCover(t);
      if (t < 1) return;
      try {
        this.apply(active.pending.op);
      } catch (err) {
        this.finishTransition(transition, () => active.pending.reject(err));
        return;
      }
      active.phase = 'reveal';
      active.elapsed = duration <= 0 ? 0 : Math.max(0, active.elapsed - duration);
    }

    const t = duration <= 0 ? 1 : Math.min(active.elapsed / duration, 1);
    transition.setCover(1 - t);
    if (t < 1) return;
    this.finishTransition(transition, active.pending.resolve);
  }

  private finishTransition(transition: Transition, settle: () => void): void {
    transition.setCover(0);
    transition.end?.();
    this.active = undefined;
    this.events.emit('transition:end');
    settle();
    this.processQueue();
  }

  private applySafely(pending: Pending<V>): void {
    try {
      this.apply(pending.op);
      pending.resolve();
    } catch (err) {
      pending.reject(err);
    }
  }

  private apply(op: Op<V>): void {
    switch (op.kind) {
      case 'push': {
        this.top?.pause?.();
        this.add(op.scene);
        break;
      }
      case 'pop': {
        const removed = this.scenes.pop();
        assert(removed, 'SceneManager.pop: stack is empty');
        this.remove(removed);
        this.top?.resume?.();
        break;
      }
      case 'replace': {
        const removed = this.scenes.pop();
        if (removed) this.remove(removed);
        this.add(op.scene);
        break;
      }
    }
    this.events.emit('scene:changed', {
      top: this.top?.id,
      stack: this.scenes.map((s) => s.id),
    });
  }

  private add(scene: Scene<V>): void {
    assert(!this.scenes.includes(scene), `Scene "${scene.id}" is already on the stack`);
    this.scenes.push(scene);
    this.host.attach(scene.view);
    scene.enter?.();
    scene.resize?.(this.size.width, this.size.height);
  }

  private remove(scene: Scene<V>): void {
    scene.exit?.();
    this.host.detach(scene.view);
  }
}
