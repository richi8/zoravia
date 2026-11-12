/**
 * Virtual screen math (pure): the game draws in "game pixels", each shown as an exact
 * `scale × scale` block of device pixels (whole-number scale, so pixel art stays crisp, also
 * on HiDPI screens with fractional `devicePixelRatio`).
 *
 * The game screen has no fixed size: it fills the whole window. The scale is the largest
 * whole number that still leaves at least `min` game pixels (e.g. 480×270); the game screen
 * is then however many game pixels the window holds at that scale. Wider or taller windows
 * simply show more; nothing is stretched and there are no bars.
 */

export interface VirtualSize {
  readonly width: number;
  readonly height: number;
}

export interface VirtualFit {
  /** Device pixels per game pixel (whole number ≥ 1). */
  readonly scale: number;
  /** CSS pixels per game pixel (`scale / devicePixelRatio`). */
  readonly cssScale: number;
  /** Game-screen size in game pixels (≥ `min` unless the window is tiny). */
  readonly width: number;
  readonly height: number;
}

/**
 * Fits the game screen to a `cssWidth × cssHeight` window. The game screen covers the window
 * completely (rounding up, so at most one game pixel is cut off at the right/bottom edge).
 */
export function fitVirtual(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
  min: VirtualSize,
): VirtualFit {
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
  const devW = Math.max(1, Math.round(cssWidth * dpr));
  const devH = Math.max(1, Math.round(cssHeight * dpr));
  const scale = Math.max(1, Math.floor(Math.min(devW / min.width, devH / min.height)));
  return {
    scale,
    cssScale: scale / dpr,
    width: Math.ceil(devW / scale),
    height: Math.ceil(devH / scale),
  };
}

/** Canvas CSS coordinates → game-screen coordinates. */
export function toVirtual(fit: VirtualFit, cssX: number, cssY: number): { x: number; y: number } {
  return { x: cssX / fit.cssScale, y: cssY / fit.cssScale };
}
