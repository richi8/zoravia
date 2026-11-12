/** Browser helper: puts a `PixelSprite` on a canvas, displayed `scale`× with crisp pixels. */

import type { PixelSprite } from './sdf-sprite';

export function spriteToCanvas(sprite: PixelSprite, scale = 1): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas not available');
  const image = ctx.createImageData(sprite.width, sprite.height);
  image.data.set(sprite.data);
  ctx.putImageData(image, 0, 0);
  canvas.style.width = `${sprite.width * scale}px`;
  canvas.style.height = `${sprite.height * scale}px`;
  canvas.style.imageRendering = 'pixelated';
  return canvas;
}
