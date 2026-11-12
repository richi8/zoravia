/**
 * Rolling frame statistics for the debug overlay (pure; feed it frame times).
 */

export interface FpsStats {
  /** Average frames per second over the window. */
  readonly fps: number;
  /** Average frame time in ms. */
  readonly avgMs: number;
  /** Worst frame time in ms within the window. */
  readonly maxMs: number;
  /** Frames in the window slower than 1.5× the target frame time. */
  readonly slowFrames: number;
}

export class FpsCounter {
  private readonly samples: number[] = [];

  constructor(
    private readonly windowSize = 120,
    private readonly targetMs = 1000 / 60,
  ) {}

  /** Records one frame's duration in ms. Zero/negative values (first frame) are ignored. */
  record(frameMs: number): void {
    if (!(frameMs > 0)) return;
    this.samples.push(frameMs);
    if (this.samples.length > this.windowSize) this.samples.shift();
  }

  get stats(): FpsStats {
    const n = this.samples.length;
    if (n === 0) return { fps: 0, avgMs: 0, maxMs: 0, slowFrames: 0 };
    let sum = 0;
    let max = 0;
    let slow = 0;
    for (const s of this.samples) {
      sum += s;
      if (s > max) max = s;
      if (s > this.targetMs * 1.5) slow++;
    }
    const avgMs = sum / n;
    return { fps: 1000 / avgMs, avgMs, maxMs: max, slowFrames: slow };
  }

  reset(): void {
    this.samples.length = 0;
  }
}
