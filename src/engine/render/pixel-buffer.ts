/**
 * CPU pixel buffer for procedural pixel art (tiles, liquids, weather). Pixels are packed
 * RGBA in a `Uint32Array` that shares memory with a `Uint8ClampedArray`, so a whole frame
 * goes to an `ImageData` / texture without copying. Pure: no DOM.
 *
 * Packing assumes a little-endian platform (every browser target), where the bytes of
 * `0xAABBGGRR` read R, G, B, A in memory order.
 */

/** `0xRRGGBB` → opaque packed pixel. */
export function packColor(rgb: number): number {
  return (0xff000000 | ((rgb & 0xff) << 16) | (rgb & 0xff00) | ((rgb >> 16) & 0xff)) >>> 0;
}

/** Packed pixel → `0xRRGGBB` (alpha dropped). */
export function unpackColor(px: number): number {
  return ((px & 0xff) << 16) | (px & 0xff00) | ((px >>> 16) & 0xff);
}

/** Packed pixel `dst` blended toward `0xRRGGBB` by `a` (0..1); result is opaque. */
export function blendPacked(dst: number, rgb: number, a: number): number {
  const r = dst & 0xff;
  const g = (dst >>> 8) & 0xff;
  const b = (dst >>> 16) & 0xff;
  const nr = (r + (((rgb >> 16) & 0xff) - r) * a) | 0;
  const ng = (g + (((rgb >> 8) & 0xff) - g) * a) | 0;
  const nb = (b + ((rgb & 0xff) - b) * a) | 0;
  return (0xff000000 | (nb << 16) | (ng << 8) | nr) >>> 0;
}

export class PixelBuffer {
  readonly data: Uint32Array;
  /** Same memory as `data`, as RGBA bytes. */
  readonly bytes: Uint8ClampedArray<ArrayBuffer>;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.bytes = new Uint8ClampedArray(width * height * 4);
    this.data = new Uint32Array(this.bytes.buffer);
  }

  fill(rgb: number): void {
    this.data.fill(packColor(rgb));
  }

  /** Blends one pixel toward `rgb`; ignores coordinates off the buffer. */
  dot(x: number, y: number, rgb: number, alpha: number): void {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= this.width || yi >= this.height) return;
    const i = yi * this.width + xi;
    this.data[i] = blendPacked(this.data[i] ?? 0, rgb, alpha);
  }
}
