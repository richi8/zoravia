/**
 * Fixed-timestep loop (pure, no browser APIs — the RAF driver lives in `raf.ts`).
 *
 * Feed it real elapsed time with `advance(ms)`; it runs `update(stepSeconds)` zero or more
 * times at a fixed rate and then `render(alpha)` once, where `alpha` (0..1) is how far we are
 * into the next step — use it to interpolate visuals. Long frames are clamped so a stalled
 * tab cannot trigger a "spiral of death".
 */

import { assert } from '../core/assert';

export interface FixedStepOptions {
  /** Updates per second. Default 60. */
  readonly stepHz?: number;
  /** Max real time consumed per `advance`, in ms. Default 250. */
  readonly maxFrameMs?: number;
  readonly update: (stepSeconds: number) => void;
  readonly render?: (alpha: number) => void;
}

export interface FrameResult {
  /** Number of update steps run this frame. */
  readonly steps: number;
  readonly alpha: number;
}

export class FixedStepLoop {
  readonly stepMs: number;
  readonly stepSeconds: number;
  private readonly maxFrameMs: number;
  private readonly onUpdate: (stepSeconds: number) => void;
  private readonly onRender: ((alpha: number) => void) | undefined;
  private accumulator = 0;
  private totalSteps = 0;

  constructor(options: FixedStepOptions) {
    const hz = options.stepHz ?? 60;
    assert(hz > 0 && Number.isFinite(hz), `stepHz must be positive, got ${hz}`);
    this.stepMs = 1000 / hz;
    this.stepSeconds = 1 / hz;
    this.maxFrameMs = options.maxFrameMs ?? 250;
    this.onUpdate = options.update;
    this.onRender = options.render;
  }

  /** Total update steps run since creation. */
  get steps(): number {
    return this.totalSteps;
  }

  advance(elapsedMs: number): FrameResult {
    this.accumulator += Math.min(Math.max(elapsedMs, 0), this.maxFrameMs);
    let steps = 0;
    // Small epsilon so 16.666…ms frames at 60Hz don't drift into skipped steps.
    while (this.accumulator + 1e-6 >= this.stepMs) {
      this.onUpdate(this.stepSeconds);
      this.accumulator -= this.stepMs;
      steps++;
    }
    if (this.accumulator < 0) this.accumulator = 0;
    this.totalSteps += steps;
    const alpha = this.accumulator / this.stepMs;
    this.onRender?.(alpha);
    return { steps, alpha };
  }

  /** Drops pending time (e.g. after the tab was hidden). */
  reset(): void {
    this.accumulator = 0;
  }
}
