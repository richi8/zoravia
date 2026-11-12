/**
 * Virtual screen math (pure): fit a fixed low-resolution game screen (e.g. 480×270) into a
 * window with whole-number scaling, centered, letterboxed. Scaling is computed in device
 * pixels so every game pixel becomes an exact `scale × scale` block, also on HiDPI screens
 * with fractional `devicePixelRatio`.
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
  /** Top-left of the game screen in the canvas, CSS pixels (on a device-pixel boundary). */
  readonly x: number;
  readonly y: number;
  /** Displayed size, CSS pixels. */
  readonly width: number;
  readonly height: number;
}

/**
 * Largest whole-number scale that fits `screen` into a `cssWidth × cssHeight` area.
 * When the area is smaller than one game screen, the scale stays 1 and the edges are cut off.
 */
export function fitVirtual(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
  screen: VirtualSize,
): VirtualFit {
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
  const devW = Math.floor(cssWidth * dpr);
  const devH = Math.floor(cssHeight * dpr);
  const scale = Math.max(1, Math.floor(Math.min(devW / screen.width, devH / screen.height)));
  const offX = Math.floor((devW - screen.width * scale) / 2);
  const offY = Math.floor((devH - screen.height * scale) / 2);
  return {
    scale,
    cssScale: scale / dpr,
    x: offX / dpr,
    y: offY / dpr,
    width: (screen.width * scale) / dpr,
    height: (screen.height * scale) / dpr,
  };
}

/** Canvas CSS coordinates → game-screen coordinates (may fall outside the screen). */
export function toVirtual(fit: VirtualFit, cssX: number, cssY: number): { x: number; y: number } {
  return { x: (cssX - fit.x) / fit.cssScale, y: (cssY - fit.y) / fit.cssScale };
}
