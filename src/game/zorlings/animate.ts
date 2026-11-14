/**
 * Zorling animation clips: idle (breathe + blink + tail/wing motion), attack lunge, hurt and
 * faint. Each frame is a rig pose (`rig.ts`) rasterized fresh at pixel size, plus whole-
 * sprite offsets / alpha for the presentation layer to apply (in sprite pixels).
 *
 * Pure and deterministic: same genome + options → identical frames. Frames share the framing
 * of the rest pose; `anchor` is the ground point between the feet.
 */

import type { BonePose, Pose } from '@engine/render/rig';
import { aura, silhouette, type PixelSprite } from '@engine/render/sdf-sprite';
import type { BodyPlan, ZorlingGenome } from './genome';
import { glowColor } from './palette';
import type { BoneId } from './parts';
import { SPRITE_SIZE, ZorlingRenderer, type EyeState } from './render';
import { TITAN_SIZE } from './variants';

export const CLIP_NAMES = ['idle', 'attack', 'hurt', 'faint'] as const;
export type ClipName = (typeof CLIP_NAMES)[number];

export interface ZorlingFrame {
  readonly sprite: PixelSprite;
  /** Whole-sprite offset in sprite pixels (+x = toward where the Zorling faces). */
  readonly dx: number;
  readonly dy: number;
  /** Opacity for the presentation layer (faint fade). */
  readonly alpha: number;
  /** Frame duration in milliseconds (at battle speed 1). */
  readonly ms: number;
  /** A hit-flash frame (drawn as a white silhouette; the actor may tint it, C32). */
  readonly flash?: boolean;
}

export interface ZorlingClip {
  readonly name: ClipName;
  readonly loop: boolean;
  readonly frames: readonly ZorlingFrame[];
}

export interface AnimateOptions {
  /** Frame size without padding. Default 96 (`TITAN_SIZE` for Titans). */
  readonly size?: number;
  /** Fraction of the frame the figure spans (evolution stages). Default 1. */
  readonly fill?: number;
  /** Transparent margin for motion. Default ~17% of the size. */
  readonly pad?: number;
  /** Boss aura: a pulsing glow in the type color. */
  readonly titan?: boolean;
  /** Legendary shine: a soft glow edge and sparkles twinkling around the figure. */
  readonly legendary?: boolean;
  /** Which clips to render. Default all. */
  readonly clips?: readonly ClipName[];
}

export interface ZorlingAnimation {
  /** Square sprite size including padding. */
  readonly width: number;
  /** Frame size without padding. */
  readonly size: number;
  /** Ground point between the feet, in sprite pixels. */
  readonly anchor: { readonly x: number; readonly y: number };
  readonly clips: Readonly<Partial<Record<ClipName, ZorlingClip>>>;
}

/** One frame before rasterizing: what a clip is made of (exposed for tests and tools). */
export interface FrameSpec {
  readonly pose: Pose;
  readonly eyes: EyeState;
  readonly dx: number;
  readonly dy: number;
  readonly alpha: number;
  readonly ms: number;
  /** Hit flash: the whole figure in white. */
  readonly flash?: boolean;
}

/** How a plan moves: hovering plans bob instead of breathing; some flap their wings. */
interface Motion {
  readonly hover: boolean;
  /** Idle wing swing (radians) and whether the two wings mirror (front-facing bat). */
  readonly flap: number;
  readonly mirror: boolean;
  /** Wing beats per idle loop. */
  readonly beats: number;
}

const deg = (d: number): number => (d * Math.PI) / 180;

function motionOf(plan: BodyPlan, hasWings: boolean): Motion {
  switch (plan) {
    case 'bat':
      return { hover: true, flap: deg(16), mirror: true, beats: 2 };
    case 'insect':
      return { hover: hasWings, flap: deg(10), mirror: false, beats: 3 };
    case 'fish':
    case 'jelly':
    case 'angler':
    case 'leafwyrm':
      return { hover: true, flap: 0, mirror: false, beats: 1 };
    case 'avian':
    case 'raptor':
    case 'vulture':
    case 'owl':
    case 'magmadrake':
    case 'frostwyrm':
    case 'dragon':
      return { hover: false, flap: deg(6), mirror: false, beats: 1 };
    default:
      return { hover: false, flap: deg(4), mirror: false, beats: 1 };
  }
}

const IDLE_FRAMES = 12;
const IDLE_MS = 120;
const BLINK_FRAME = 8;

/**
 * Frame specs of a clip. Offsets are in pixels for a 96-pixel frame; `scale` converts
 * (size / 96). Model-space offsets are given in pixels too and converted with `upp`.
 */
export function clipSpecs(
  name: ClipName,
  plan: BodyPlan,
  hasWings: boolean,
  upp: number,
  scale: number,
): FrameSpec[] {
  const m = motionOf(plan, hasWings);
  const px = (v: number): number => v * upp * scale; // sprite px → model units
  const off = (v: number): number => Math.round(v * scale);
  const wings = (a: number): Pose => ({
    wingFar: { rot: m.mirror ? -a : a },
    wingNear: { rot: a },
  });
  const pose = (parts: Partial<Record<BoneId, BonePose>>): Pose => parts;

  switch (name) {
    case 'idle':
      return Array.from({ length: IDLE_FRAMES }, (_, i) => {
        const t = i / IDLE_FRAMES;
        const s = Math.sin(2 * Math.PI * t);
        const lag = Math.sin(2 * Math.PI * t - 0.9);
        const body: BonePose = m.hover
          ? { y: px(-1.5 * s) }
          : { sx: 1 - 0.012 * s, sy: 1 + 0.028 * s };
        const tailSwing = (m.hover && plan === 'fish' ? 14 : 8) * Math.sin(4 * Math.PI * t);
        return {
          pose: {
            body,
            head: { y: px(-0.8 * lag), rot: deg(1.5 * lag) },
            tail: { rot: deg(tailSwing) },
            ...wings(-m.flap * Math.sin(2 * Math.PI * m.beats * t)),
          },
          eyes: i === BLINK_FRAME ? 'closed' : 'open',
          dx: 0,
          dy: 0,
          alpha: 1,
          ms: IDLE_MS,
        } satisfies FrameSpec;
      });

    case 'attack': {
      // Wind up (lean back, squash), strike forward, hold, settle.
      const keys: [lean: number, sx: number, sy: number, dx: number, ms: number][] = [
        [-4, 1.03, 0.96, -2, 90],
        [-7, 1.05, 0.93, -4, 100],
        [6, 1.06, 0.97, 8, 60],
        [8, 1.04, 0.98, 14, 130],
        [5, 1.02, 1, 9, 80],
        [2, 1, 1, 4, 80],
        [0, 1, 1, 0, 80],
      ];
      return keys.map(([lean, sx, sy, dx, ms]) => ({
        pose: pose({
          body: { rot: deg(lean), sx, sy },
          head: { rot: deg(lean * 0.6), x: px(lean > 0 ? 1.5 : -0.5) },
          tail: { rot: deg(-lean * 1.6) },
          ...wings(deg(-Math.abs(lean) * 2)),
        }),
        eyes: 'open',
        dx: off(dx),
        dy: 0,
        alpha: 1,
        ms,
      }));
    }

    case 'hurt': {
      const keys: [lean: number, dx: number, flash: boolean, eyes: EyeState, ms: number][] = [
        [-7, -4, true, 'squeeze', 60],
        [-7, -5, false, 'squeeze', 70],
        [-6, -3, true, 'squeeze', 60],
        [-4, -2, false, 'squeeze', 90],
        [-2, 1, false, 'open', 90],
        [0, 0, false, 'open', 80],
      ];
      return keys.map(([lean, dx, flash, eyes, ms]) => ({
        pose: pose({
          body: { rot: deg(lean), sx: 1 + lean * 0.004, sy: 1 - lean * 0.004 },
          head: { rot: deg(lean * 0.8) },
          tail: { rot: deg(lean * -1.5) },
          ...wings(deg(lean * 2)),
        }),
        eyes,
        dx: off(dx),
        dy: 0,
        alpha: 1,
        ms,
        flash,
      }));
    }

    case 'faint': {
      const keys: [lean: number, sy: number, head: number, dy: number, a: number, ms: number][] = [
        [-5, 1, -4, 0, 1, 110],
        [0, 0.97, 8, 0, 1, 120],
        [3, 0.92, 16, 1, 1, 120],
        [5, 0.87, 20, 2, 1, 140],
        [5, 0.85, 22, 4, 0.75, 120],
        [5, 0.85, 22, 6, 0.5, 120],
        [5, 0.85, 22, 8, 0.25, 120],
        [5, 0.85, 22, 9, 0, 200],
      ];
      return keys.map(([lean, sy, head, dy, alpha, ms], i) => ({
        pose: pose({
          body: { rot: deg(lean), sy, sx: 1 + (1 - sy) * 0.4, ...(m.hover ? { y: px(dy) } : {}) },
          head: { rot: deg(head) },
          tail: { rot: deg(-head) },
          ...wings(deg(head * 1.2)),
        }),
        eyes: i === 0 ? 'squeeze' : 'closed',
        dx: 0,
        dy: m.hover ? 0 : off(dy),
        alpha,
        ms,
      }));
    }
  }
}

/** Renders the clips of one Zorling. */
export function animateZorling(
  genome: ZorlingGenome,
  options: AnimateOptions = {},
): ZorlingAnimation {
  const titan = options.titan ?? false;
  const size = options.size ?? (titan ? TITAN_SIZE : SPRITE_SIZE.battle);
  const pad = options.pad ?? Math.max(titan ? 3 : 0, Math.round(size * 0.17));
  const renderer = new ZorlingRenderer(genome, { size, pad, fill: options.fill ?? 1 });
  const hasWings = Boolean(renderer.model.rig['wingNear'] ?? renderer.model.rig['wingFar']);
  const glow = glowColor(genome.types[0]);
  const clips: Partial<Record<ClipName, ZorlingClip>> = {};
  for (const name of options.clips ?? CLIP_NAMES) {
    const specs = clipSpecs(name, genome.plan, hasWings, renderer.upp, size / 96);
    const frames = specs.map((f, i): ZorlingFrame => {
      let sprite = renderer.frame({ pose: f.pose, eyes: f.eyes });
      if (f.flash) sprite = silhouette(sprite, 0xffffff);
      if (options.legendary && !f.flash) sprite = shine(sprite, glow, i, genome.seed);
      if (titan) {
        // Pulse: the dithered outer ring breathes in and out with the idle loop.
        const wide = name !== 'idle' || i % 6 < 3;
        sprite = aura(
          sprite,
          wide ? [{ color: glow }, { color: glow, dither: true }] : [{ color: glow }],
          i % 2,
        );
      }
      return {
        sprite,
        dx: f.dx,
        dy: f.dy,
        alpha: f.alpha,
        ms: f.ms,
        ...(f.flash ? { flash: true } : {}),
      };
    });
    clips[name] = { name, loop: name === 'idle', frames };
  }
  return { width: renderer.width, size, anchor: renderer.anchor, clips };
}

/** Sparkle spots per legendary sprite. */
const SPARKLES = 7;

/**
 * Legendary shine: a dithered glow edge, then four-point sparkles near the silhouette that
 * twinkle in turn over the idle loop (each lit for a few frames). Deterministic per seed.
 */
export function shine(
  sprite: PixelSprite,
  color: number,
  frame: number,
  seed: number,
): PixelSprite {
  const out = aura(sprite, [{ color, dither: true }], frame % 2);
  const { width: W, height: H, data } = out;
  // Candidate spots: empty pixels 2–4 px from the figure, spread around it.
  const solid = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < W && y < H && (sprite.data[(y * W + x) * 4 + 3] ?? 0) > 0;
  const spots: [number, number][] = [];
  let h = (seed ^ 0x9e3779b9) >>> 0;
  const rand = (): number => {
    h = (Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
    return h / 2 ** 32;
  };
  for (let tries = 0; tries < 400 && spots.length < SPARKLES; tries++) {
    const x = Math.floor(rand() * W);
    const y = Math.floor(rand() * H * 0.85);
    if (solid(x, y)) continue;
    let near = false;
    for (let d = 2; d <= 4 && !near; d++) {
      near = solid(x + d, y) || solid(x - d, y) || solid(x, y + d) || solid(x, y - d);
    }
    if (near && spots.every(([sx, sy]) => Math.abs(sx - x) + Math.abs(sy - y) > W / 6))
      spots.push([x, y]);
  }
  const put = (x: number, y: number, c: number): void => {
    if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) return;
    const i = (y * W + x) * 4;
    data[i] = (c >> 16) & 255;
    data[i + 1] = (c >> 8) & 255;
    data[i + 2] = c & 255;
    data[i + 3] = 255;
  };
  spots.forEach(([x, y], k) => {
    const phase = (frame + k * 5) % 12;
    if (phase > 3) return;
    const arm = phase === 1 || phase === 2 ? 2 : 1;
    put(x, y, 0xffffff);
    for (let a = 1; a <= arm; a++) {
      const c = a === arm ? color : 0xffffff;
      put(x + a, y, c);
      put(x - a, y, c);
      put(x, y + a, c);
      put(x, y - a, c);
    }
  });
  return out;
}
