/**
 * Genome → pixel sprite. Pure: same genome + size → identical bytes.
 *
 * Sizes from DESIGN.md "Presentation": battle sprites 96×96, overworld 32×32. The Zorling is
 * fitted into the square (1-pixel margin for the outline), centered horizontally, feet on the
 * bottom edge. It faces right; use `flipX` for left-facing (enemy) sprites.
 *
 * `ZorlingRenderer` keeps the framing of the rest pose fixed, so posed animation frames
 * (`animate.ts`) line up pixel-exactly; an optional transparent `pad` gives them room to move.
 */

import { apply, boneMatrices, IDENTITY, poseModel, type Pose } from '@engine/render/rig';
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
  /**
   * Fraction of the frame the figure spans (0–1], e.g. smaller early evolution stages.
   * Still centered with the feet on the bottom edge. Default 1.
   */
  readonly fill?: number;
  /** Transparent margin on every side, in pixels (room for animation). Default 0. */
  readonly pad?: number;
}

/** How the eyes are drawn in a frame. */
export type EyeState = 'open' | 'closed' | 'squeeze';

export interface FrameOptions {
  readonly pose?: Pose;
  readonly eyes?: EyeState;
}

const WHITE = 0xffffff;
const PUPIL = ink[950];
const TONGUE = 0xff7a8a;

const luminanceOf = (c: number): number =>
  (0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255)) / 255;

export function renderZorling(genome: ZorlingGenome, options: RenderOptions = {}): PixelSprite {
  return new ZorlingRenderer(genome, options).frame();
}

/** Renders frames of one Zorling with the framing of its rest pose. Pure. */
export class ZorlingRenderer {
  readonly model: ZorlingModel;
  /** Frame size without padding. */
  readonly size: number;
  readonly pad: number;
  /** Full sprite size (`size + 2 · pad`). */
  readonly width: number;
  /** Model-space rectangle of the full (padded) sprite. */
  readonly view: Bounds;
  /** Model units per pixel. */
  readonly upp: number;

  constructor(
    readonly genome: ZorlingGenome,
    options: RenderOptions = {},
  ) {
    this.size = options.size ?? SPRITE_SIZE.battle;
    this.pad = Math.max(0, Math.round(options.pad ?? 0));
    this.width = this.size + 2 * this.pad;
    this.model = buildZorling(genome);
    const v = fitView(tightBounds(this.model), this.size, options.fill ?? 1);
    this.upp = (v.maxX - v.minX) / this.size;
    const m = this.pad * this.upp;
    this.view = { minX: v.minX - m, minY: v.minY - m, maxX: v.maxX + m, maxY: v.maxY + m };
  }

  /** The point between the feet (ground, horizontal center) in sprite pixels. */
  get anchor(): { x: number; y: number } {
    return { x: this.width / 2, y: this.pad + this.size };
  }

  frame(options: FrameOptions = {}): PixelSprite {
    const { model, genome } = this;
    const pose = options.pose ?? {};
    const posed = poseModel(model, model.rig, pose, 'body');
    const mats = boneMatrices(model.rig, pose);
    const at = <T extends { x: number; y: number; bone?: string }>(p: T): T => {
      const [x, y] = apply(mats.get(p.bone ?? 'body') ?? IDENTITY, p.x, p.y);
      return { ...p, x, y };
    };
    const eyes = options.eyes ?? 'open';
    return rasterize(posed, {
      width: this.width,
      height: this.width,
      view: this.view,
      partLines: this.size > 48,
      stamps: (ppu) => {
        const out: Stamp[] = model.eyes.map((e) => eyeStamp(at(e), genome, ppu, eyes));
        if (model.mouth && eyes !== 'squeeze') {
          const mo = mouthStamp(at(model.mouth), genome, ppu);
          if (mo) out.push(mo);
        }
        return out;
      },
    });
  }
}

/**
 * Square model-space view: the figure spans `fill` of the sprite (minus a 1 px outline
 * margin), centered horizontally, feet down.
 */
export function fitView(b: Bounds, size: number, fill = 1): Bounds {
  const inner = (size - 2) * Math.min(1, Math.max(0.1, fill));
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

type Px = [number, number, number];

/** Eye drawn in pixel space so it reads at every size. */
function eyeStamp(e: EyeSpec, g: ZorlingGenome, ppu: number, state: EyeState = 'open'): Stamp {
  const kind = g.parts.eyes;
  const big = kind === 'big';
  const R = e.r * ppu * (big ? 1.2 : 1);
  if (state !== 'open') return shutEye(e, R, state);
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

/** Closed eye (blink, faint): a lid line, ends turned down. Squeeze (hurt): a chevron. */
function shutEye(e: EyeSpec, R: number, state: Exclude<EyeState, 'open'>): Stamp {
  const px: Px[] = [];
  if (R < 1.6) {
    px.push([0, 0, PUPIL], [1, 0, PUPIL]);
    return { x: e.x, y: e.y, pixels: px };
  }
  const half = Math.max(1, Math.round(R * (e.far ? 0.72 : 0.88)));
  if (state === 'closed') {
    for (let x = -half; x <= half; x++) {
      const end = Math.abs(x) === half && R >= 3;
      px.push([x, end ? 1 : 0, PUPIL]);
    }
    return { x: e.x, y: e.y, pixels: px };
  }
  // Chevron: the near eye points toward the snout (">"), the far eye back ("<").
  const s = e.far ? -1 : 1;
  const arm = Math.max(1, Math.min(half, Math.round(R * 0.6)));
  for (let i = 0; i <= arm; i++) {
    const x = Math.round(s * (arm / 2 - i));
    px.push([x, -i, PUPIL], [x, i, PUPIL]);
  }
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
