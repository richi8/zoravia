/**
 * Genome → pixel sprite. Pure: same genome + size → identical bytes.
 *
 * Sizes from DESIGN.md "Presentation": battle sprites 96×96, overworld 32×32. The Zorling is
 * fitted into the square (1-pixel margin for the outline), centered horizontally, feet on the
 * bottom edge. It faces right; use `flipX` for left-facing (enemy) sprites.
 */

import {
  tightBounds,
  rasterize,
  type Bounds,
  type PixelSprite,
  type Stamp,
} from '@engine/render/sdf-sprite';
import { ink } from '../style/tokens';
import { buildZorling, type EyeSpec, type MouthSpec, type ZorlingModel } from './build';
import type { ZorlingGenome } from './genome';

export const SPRITE_SIZE = { battle: 96, overworld: 32 } as const;

export interface RenderOptions {
  /** Square sprite size in pixels. Default 96 (battle). */
  readonly size?: number;
}

const WHITE = 0xffffff;
const PUPIL = ink[950];
const TONGUE = 0xff7a8a;

const luminanceOf = (c: number): number =>
  (0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255)) / 255;

export function renderZorling(genome: ZorlingGenome, options: RenderOptions = {}): PixelSprite {
  const size = options.size ?? SPRITE_SIZE.battle;
  const model = buildZorling(genome);
  const small = size <= 48;
  return rasterize(model, {
    width: size,
    height: size,
    view: fitView(tightBounds(model), size),
    partLines: !small,
    stamps: (ppu) => stamps(model, genome, ppu),
  });
}

/** Square model-space view: figure fills the sprite minus a 1 px outline margin, feet down. */
export function fitView(b: Bounds, size: number): Bounds {
  const inner = size - 2;
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const upp = Math.max(w, h) / inner;
  const cx = (b.minX + b.maxX) / 2;
  const maxY = b.maxY + upp;
  return {
    minX: cx - (size / 2) * upp,
    maxX: cx + (size / 2) * upp,
    minY: maxY - size * upp,
    maxY,
  };
}

function stamps(model: ZorlingModel, genome: ZorlingGenome, ppu: number): Stamp[] {
  const out: Stamp[] = model.eyes.map((e) => eyeStamp(e, genome, ppu));
  if (model.mouth) {
    const m = mouthStamp(model.mouth, genome, ppu);
    if (m) out.push(m);
  }
  return out;
}

type Px = [number, number, number];

/** Eye drawn in pixel space so it reads at every size. */
function eyeStamp(e: EyeSpec, g: ZorlingGenome, ppu: number): Stamp {
  const kind = g.parts.eyes;
  const big = kind === 'big';
  const R = e.r * ppu * (big ? 1.2 : 1);
  const px: Px[] = [];
  const iris = luminanceOf(g.palette.eye) > 0.25 ? g.palette.eye : 0xffc22e;
  if (R < 1.6) {
    // Tiny: a 1×2 bean (or a single dot when very small); glowing eyes stay lit.
    if (kind === 'glow') {
      return {
        x: e.x,
        y: e.y,
        pixels: [
          [0, 0, g.palette.eye],
          [1, 0, g.palette.eye],
        ],
      };
    }
    px.push([0, 0, PUPIL]);
    if (R >= 0.8) px.push([0, 1, PUPIL]);
    if (kind === 'sleepy')
      return {
        x: e.x,
        y: e.y,
        pixels: [
          [0, 0, PUPIL],
          [1, 0, PUPIL],
        ],
      };
    return { x: e.x, y: e.y, pixels: px };
  }
  const rx = Math.max(1, R * (e.far ? 0.72 : 0.88));
  const ry = Math.max(1.2, R);
  const pr = Math.max(0.9, R * (big ? 0.62 : 0.55));
  const pcx = rx * 0.3;
  const pcy = ry * 0.1;
  const lid = (x: number, y: number): boolean => {
    if (kind === 'fierce' || kind === 'glow') return y < -ry * 0.25 + x * 0.45;
    if (kind === 'slit') return y < -ry * 0.45 + x * 0.3;
    if (kind === 'sleepy') return y < -ry * 0.05;
    return false;
  };
  const xr = Math.ceil(rx) + 1;
  const yr = Math.ceil(ry) + 1;
  for (let y = -yr; y <= yr; y++) {
    for (let x = -xr; x <= xr; x++) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      const inside = (cx / rx) ** 2 + (cy / ry) ** 2 <= 1;
      const ring = !inside && (cx / (rx + 1)) ** 2 + (cy / (ry + 1)) ** 2 <= 1;
      if (lid(cx, cy)) {
        // The lid line sits just above the visible part.
        if ((inside || ring) && !lid(cx, cy + 1)) px.push([x, y, PUPIL]);
        continue;
      }
      if (ring) {
        px.push([x, y, PUPIL]);
        continue;
      }
      if (!inside) continue;
      if (kind === 'glow') {
        const core = Math.hypot(cx - pcx * 0.5, cy) < Math.max(0.8, R * 0.3);
        px.push([x, y, core ? WHITE : g.palette.eye]);
        continue;
      }
      if (kind === 'slit') {
        const slit =
          Math.abs(cx - pcx * 0.6) < Math.max(0.55, rx * 0.18) && Math.abs(cy) < ry * 0.85;
        px.push([x, y, slit ? PUPIL : iris]);
        continue;
      }
      const dp = Math.hypot(cx - pcx, cy - pcy);
      if (dp <= pr) px.push([x, y, big && dp > pr * 0.55 && R >= 3 ? g.palette.eye : PUPIL]);
      else px.push([x, y, WHITE]);
    }
  }
  if (kind === 'glow') return { x: e.x, y: e.y, pixels: px };
  // Glint: top-left of the pupil.
  const gx = Math.round(pcx - pr * 0.45 - 0.5);
  const gy = Math.round(pcy - pr * 0.5 - 0.5);
  if (!lid(gx + 0.5, gy + 0.5)) px.push([gx, gy, WHITE]);
  if (R >= 4 && !lid(gx + 1.5, gy + 0.5)) px.push([gx + 1, gy, WHITE]);
  return { x: e.x, y: e.y, pixels: px };
}

function mouthStamp(m: MouthSpec, g: ZorlingGenome, ppu: number): Stamp | null {
  const scale = ppu * 10; // ~pixels across a typical head
  if (scale < 6) return null;
  const big = scale >= 14;
  switch (g.parts.mouth) {
    case 'smile':
      return {
        x: m.x,
        y: m.y,
        pixels: big
          ? [
              [-2, 0, PUPIL],
              [-1, 1, PUPIL],
              [0, 1, PUPIL],
              [1, 0, PUPIL],
            ]
          : [
              [-1, 0, PUPIL],
              [0, 1, PUPIL],
              [1, 0, PUPIL],
            ],
      };
    case 'fang':
      return {
        x: m.x,
        y: m.y,
        pixels: [
          [-2, 0, PUPIL],
          [-1, 0, PUPIL],
          [0, 0, PUPIL],
          [1, 0, PUPIL],
          [0, 1, WHITE],
          ...(big ? ([[0, 2, WHITE]] as Px[]) : []),
        ],
      };
    case 'fangs':
      return {
        x: m.x,
        y: m.y,
        pixels: [
          [-2, 0, PUPIL],
          [-1, 0, PUPIL],
          [0, 0, PUPIL],
          [1, 0, PUPIL],
          [2, 0, PUPIL],
          [-1, 1, WHITE],
          [1, 1, WHITE],
          ...(big
            ? ([
                [-1, 2, WHITE],
                [1, 2, WHITE],
                [-2, 1, PUPIL],
                [2, 1, PUPIL],
              ] as Px[])
            : []),
        ],
      };
    case 'open':
      return {
        x: m.x,
        y: m.y,
        pixels: big
          ? [
              [-1, 0, PUPIL],
              [0, 0, PUPIL],
              [1, 0, PUPIL],
              [-1, 1, PUPIL],
              [0, 1, TONGUE],
              [1, 1, PUPIL],
              [0, 2, PUPIL],
            ]
          : [
              [0, 0, PUPIL],
              [0, 1, TONGUE],
            ],
      };
    default:
      return null;
  }
}
