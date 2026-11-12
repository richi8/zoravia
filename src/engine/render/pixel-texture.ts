/** Browser helper: a `PixelSprite` as a nearest-filtered Pixi texture (crisp pixels). */

import { Texture } from 'pixi.js';
import type { PixelSprite } from './sdf-sprite';
import { spriteToCanvas } from './sprite-canvas';

export function pixelTexture(sprite: PixelSprite): Texture {
  const texture = Texture.from(spriteToCanvas(sprite));
  texture.source.scaleMode = 'nearest';
  return texture;
}
