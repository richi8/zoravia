/**
 * Pure 2D rig for distance-field sprite models: shapes are tagged with a bone, bones form a
 * hierarchy with pivots, and a pose (rotation / offset / scale per bone) is applied to the
 * shapes *before* rasterizing. Every animation frame is therefore drawn fresh on the pixel
 * grid — true pixel art, no rotated or resampled bitmaps.
 *
 * Model coordinates are y-down, so a positive rotation turns clockwise on screen.
 */

import type { Bounds, Primitive, Shape, SpriteModel } from './sdf-sprite';

/** 2D affine matrix: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Affine = readonly [a: number, b: number, c: number, d: number, e: number, f: number];

export const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

export interface Bone {
  /** Parent bone id; omitted for a root bone. */
  readonly parent?: string;
  /** Rotation / scale pivot in model coordinates (rest pose). */
  readonly pivot: readonly [number, number];
}

export type Rig = Readonly<Record<string, Bone>>;

export interface BonePose {
  /** Radians, clockwise on screen. */
  readonly rot?: number;
  /** Offset in model units (applied after rotation and scale). */
  readonly x?: number;
  readonly y?: number;
  /** Scale about the pivot. */
  readonly sx?: number;
  readonly sy?: number;
}

export type Pose = Readonly<Partial<Record<string, BonePose>>>;

export function multiply(m: Affine, n: Affine): Affine {
  const [a, b, c, d, e, f] = m;
  const [A, B, C, D, E, F] = n;
  return [
    a * A + c * B,
    b * A + d * B,
    a * C + c * D,
    b * C + d * D,
    a * E + c * F + e,
    b * E + d * F + f,
  ];
}

export function invert(m: Affine): Affine {
  const [a, b, c, d, e, f] = m;
  const det = a * d - b * c || 1e-12;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

export function apply(m: Affine, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Local matrix of one bone: scale and rotate about the pivot, then offset. */
export function boneLocal(pivot: readonly [number, number], p: BonePose = {}): Affine {
  const [px, py] = pivot;
  const cos = Math.cos(p.rot ?? 0);
  const sin = Math.sin(p.rot ?? 0);
  const sx = p.sx ?? 1;
  const sy = p.sy ?? 1;
  // T(pivot + offset) · R · S · T(-pivot)
  const a = cos * sx;
  const b = sin * sx;
  const c = -sin * sy;
  const d = cos * sy;
  return [a, b, c, d, px + (p.x ?? 0) - (a * px + c * py), py + (p.y ?? 0) - (b * px + d * py)];
}

/** World matrices of every bone for a pose (parents first, cycles rejected). */
export function boneMatrices(rig: Rig, pose: Pose): Map<string, Affine> {
  const out = new Map<string, Affine>();
  const visiting = new Set<string>();
  const resolve = (id: string): Affine => {
    const done = out.get(id);
    if (done) return done;
    const bone = rig[id];
    if (!bone) throw new Error(`rig: unknown bone "${id}"`);
    if (visiting.has(id)) throw new Error(`rig: bone cycle at "${id}"`);
    visiting.add(id);
    const local = boneLocal(bone.pivot, pose[id]);
    const world = bone.parent ? multiply(resolve(bone.parent), local) : local;
    visiting.delete(id);
    out.set(id, world);
    return world;
  };
  for (const id of Object.keys(rig)) resolve(id);
  return out;
}

/** Axis-aligned bounds of a transformed box. */
export function transformBounds(m: Affine, b: Bounds): Bounds {
  const pts = [
    apply(m, b.minX, b.minY),
    apply(m, b.maxX, b.minY),
    apply(m, b.minX, b.maxY),
    apply(m, b.maxX, b.maxY),
  ];
  return {
    minX: Math.min(...pts.map((p) => p[0])),
    minY: Math.min(...pts.map((p) => p[1])),
    maxX: Math.max(...pts.map((p) => p[0])),
    maxY: Math.max(...pts.map((p) => p[1])),
  };
}

/**
 * A primitive moved by `m`. Distances are scaled by √|det| — exact for rotations and uniform
 * scale, a close approximation for the mild squash/stretch used in animation.
 */
export function transformPrimitive(prim: Primitive, m: Affine): Primitive {
  if (isIdentity(m)) return prim;
  const inv = invert(m);
  const k = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
  const [a, b, c, d, e, f] = inv;
  return {
    d: (x, y) => prim.d(a * x + c * y + e, b * x + d * y + f) * k,
    bounds: transformBounds(m, prim.bounds),
  };
}

/** A shape with its bone's transform applied; per-pixel ramps still see local coordinates. */
export function transformShape(shape: Shape, m: Affine): Shape {
  if (isIdentity(m)) return shape;
  const inv = invert(m);
  const ramp = shape.ramp;
  return {
    ...shape,
    prim: transformPrimitive(shape.prim, m),
    ramp:
      typeof ramp === 'number'
        ? ramp
        : (p) => {
            const [x, y] = apply(inv, p.x, p.y);
            return ramp({ ...p, x, y });
          },
  };
}

/** Applies a pose to a model: each shape moves with its bone (default `root`). */
export function poseModel<M extends SpriteModel>(model: M, rig: Rig, pose: Pose, root = 'root'): M {
  const mats = boneMatrices(rig, pose);
  return {
    ...model,
    shapes: model.shapes.map((s) => transformShape(s, mats.get(s.bone ?? root) ?? IDENTITY)),
  };
}

function isIdentity(m: Affine): boolean {
  return m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0;
}
