/**
 * Turns vector art into pixel art: render small, snap every pixel to a fixed palette (or make
 * it transparent), optionally overlay a texture pattern (e.g. scales), then display it scaled
 * up with nearest-neighbor (`image-rendering: pixelated`).
 *
 * `quantizePixels` is pure (works on RGBA bytes) and unit-tested; `pixelateSvg` is the browser
 * wrapper around it.
 */

export interface PixelateOptions {
  /** Allowed colors, `0xRRGGBB`. */
  readonly palette: readonly number[];
  /** Pixels with lower alpha (0–255) become transparent. Default 110. */
  readonly alphaThreshold?: number;
  /**
   * Texture: when a pixel snaps to a key color, pixels on the pattern take the mapped color
   * instead. Used for the scale texture on the logo's dragon.
   */
  readonly texture?: Readonly<Record<number, number>>;
}

const rgb = (c: number): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

/** Staggered rows of dots, like overlapping scales: a dot every 4 px on every other row. */
export function onScalePattern(x: number, y: number): boolean {
  return y % 2 === 0 && (x + (Math.floor(y / 2) % 2) * 2) % 4 === 0;
}

/** In place: snaps RGBA pixels (straight alpha) to the palette, applies the texture. */
export function quantizePixels(
  data: Uint8ClampedArray,
  width: number,
  options: PixelateOptions,
): void {
  const pal = options.palette.map(rgb);
  const keys = options.palette;
  const threshold = options.alphaThreshold ?? 110;
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] ?? 0) < threshold) {
      data[i + 3] = 0;
      continue;
    }
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    let best = 0;
    let bestD = Infinity;
    for (let k = 0; k < pal.length; k++) {
      const q = pal[k];
      if (!q) continue;
      // weighted by perceived brightness of each channel
      const d = (q[0] - r) ** 2 * 0.3 + (q[1] - g) ** 2 * 0.59 + (q[2] - b) ** 2 * 0.11;
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    let color = keys[best] ?? 0;
    const p = i / 4;
    const mapped = options.texture?.[color];
    if (mapped !== undefined && onScalePattern(p % width, Math.floor(p / width))) color = mapped;
    const [cr, cg, cb] = rgb(color);
    data[i] = cr;
    data[i + 1] = cg;
    data[i + 2] = cb;
    data[i + 3] = 255;
  }
}

/** Renders an SVG string `width` pixels wide as palette-snapped pixel art on a canvas. */
export async function pixelateSvg(
  svg: string,
  width: number,
  options: PixelateOptions,
): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const ratio = img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 1;
  const height = Math.max(1, Math.round(width * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas not available');
  ctx.drawImage(img, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height);
  quantizePixels(image.data, width, options);
  ctx.putImageData(image, 0, 0);
  canvas.style.imageRendering = 'pixelated';
  return canvas;
}
