/**
 * Mouse wheel → whole list steps. A wheel notch is about 100 px; a trackpad sends many small
 * deltas, which add up here until they make a step. Turning the other way drops what was left.
 */

export class WheelSteps {
  private left = 0;

  /** `step`: wheel pixels per list step. */
  constructor(private readonly step = 30) {}

  /** Whole steps for this frame's wheel delta (positive = down). */
  take(dy: number): number {
    if (!dy) return 0;
    if (Math.sign(dy) !== Math.sign(this.left)) this.left = 0;
    this.left += dy;
    const n = Math.trunc(this.left / this.step) || 0; // no -0
    this.left -= n * this.step;
    return n;
  }

  reset(): void {
    this.left = 0;
  }
}
