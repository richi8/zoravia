/**
 * Overworld camera (C20): eases toward a target point and stays inside the map. A map
 * narrower or shorter than the screen is centered on that axis. Pure: no DOM.
 */

export interface CameraBounds {
  /** Map size in world pixels. */
  readonly width: number;
  readonly height: number;
}

export class Camera {
  /** Top-left of the view in world pixels (fractional). */
  x = 0;
  y = 0;

  constructor(
    /** Ease rate per second: higher follows tighter. */
    readonly rate = 9,
    /** Distance (px) beyond which the camera jumps instead of easing. */
    readonly snapDistance = 160,
  ) {}

  /** Moves the camera so `(cx, cy)` (world px) is centered in a `vw`×`vh` view. */
  follow(cx: number, cy: number, vw: number, vh: number, bounds: CameraBounds, dt: number): void {
    const [tx, ty] = this.clamp(cx - vw / 2, cy - vh / 2, vw, vh, bounds);
    if (Math.hypot(tx - this.x, ty - this.y) > this.snapDistance) {
      this.x = tx;
      this.y = ty;
      return;
    }
    const k = 1 - Math.exp(-this.rate * dt);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;
    // Settle exactly instead of creeping sub-pixel forever.
    if (Math.abs(tx - this.x) < 0.05) this.x = tx;
    if (Math.abs(ty - this.y) < 0.05) this.y = ty;
  }

  /** Centers on a point at once (map entry, teleport). */
  snap(cx: number, cy: number, vw: number, vh: number, bounds: CameraBounds): void {
    [this.x, this.y] = this.clamp(cx - vw / 2, cy - vh / 2, vw, vh, bounds);
  }

  private clamp(x: number, y: number, vw: number, vh: number, b: CameraBounds): [number, number] {
    const cx = b.width <= vw ? (b.width - vw) / 2 : Math.min(Math.max(x, 0), b.width - vw);
    const cy = b.height <= vh ? (b.height - vh) / 2 : Math.min(Math.max(y, 0), b.height - vh);
    return [cx, cy];
  }
}
