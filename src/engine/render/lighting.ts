/**
 * 2D lighting for a `PixelBuffer` (C32): an ambient color multiplies the whole frame
 * (time of day, area moods), and round lights lift it back up with a soft, warm-tinted
 * pool. Emissive pixels (lit windows, glowing runes) are swapped for a lit color and skip
 * the ambient. One pass over the screen plus one pass over each light's box, so it stays
 * cheap at 480×270. Pure: no DOM.
 */

/** Per-channel multipliers, 0..1 (1 = unlit). */
export type Rgb = readonly [number, number, number];

export interface Light {
  /** Screen px. */
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** `0xRRGGBB` tint of the pool. */
  readonly color: number;
  /** Peak strength, 0..1. */
  readonly strength: number;
}

export interface LightingFrame {
  readonly ambient: Rgb;
  /** Pool tint strength (how warm lights color what they touch), 0..1. Default 0.5. */
  readonly tint?: number;
  /** Extra brightness added inside lights, 0..1. Default 0.35. */
  readonly boost?: number;
  /** Darkens toward the screen edges, 0..1. */
  readonly vignette?: number;
}

/** Lights are squashed vertically by this factor (the ground is seen at an angle). */
const SQUASH = 1.25;

const isUnlit = (a: Rgb): boolean => a[0] >= 1 && a[1] >= 1 && a[2] >= 1;

/** Smooth 0..1 falloff at normalized distance `d` (0 = center, ≥ 1 = none). */
export function falloff(d: number): number {
  if (d >= 1) return 0;
  const a = 1 - d;
  return a * a * (3 - 2 * a);
}

export class LightMap {
  private amount = new Float32Array(0);
  private red = new Float32Array(0);
  private green = new Float32Array(0);
  private blue = new Float32Array(0);
  private weight = new Float32Array(0);
  /** Emissive pixels: the packed color the frame had (`emitFrom`) and the lit one (`emitTo`). */
  private emitFrom = new Uint32Array(0);
  private emitTo = new Uint32Array(0);
  private lights: Light[] = [];
  private emitted = false;
  private width = 0;
  private height = 0;

  /** Starts a frame of `width`×`height`: forgets the lights and emissive pixels. */
  begin(width: number, height: number): void {
    if (width !== this.width || height !== this.height) {
      const n = width * height;
      this.amount = new Float32Array(n);
      this.red = new Float32Array(n);
      this.green = new Float32Array(n);
      this.blue = new Float32Array(n);
      this.weight = new Float32Array(n);
      this.emitFrom = new Uint32Array(n);
      this.emitTo = new Uint32Array(n);
      this.width = width;
      this.height = height;
    } else if (this.emitted) {
      this.emitFrom.fill(0);
    }
    this.emitted = false;
    this.lights = [];
  }

  add(light: Light): void {
    if (light.strength > 0 && light.radius > 0) this.lights.push(light);
  }

  /**
   * Marks pixel `i` as emissive: if it still holds `from` when lighting is applied (nothing
   * was drawn over it), it becomes `to` and ignores the ambient.
   */
  emit(i: number, from: number, to: number): void {
    this.emitFrom[i] = from;
    this.emitTo[i] = to;
    this.emitted = true;
  }

  get lightCount(): number {
    return this.lights.length;
  }

  /** Lights the frame in `data` (packed RGBA, `width`×`height` from `begin`). */
  apply(data: Uint32Array, frame: LightingFrame): void {
    const { width: W, height: H } = this;
    const vignette = frame.vignette ?? 0;
    if (isUnlit(frame.ambient) && vignette <= 0 && !this.emitted) return;
    const tint = frame.tint ?? 0.5;
    const boost = frame.boost ?? 0.35;
    const amount = this.amount;
    const lit = this.lights.length > 0;
    if (lit) {
      amount.fill(0);
      this.red.fill(0);
      this.green.fill(0);
      this.blue.fill(0);
      this.weight.fill(0);
      for (const l of this.lights) this.splat(l);
    }
    const [ar, ag, ab] = frame.ambient;
    const cx = W / 2;
    const cy = H / 2;
    for (let y = 0; y < H; y++) {
      const ny = (y - cy) / H;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const p = data[i] ?? 0;
        if (this.emitted && p === this.emitFrom[i] && p !== 0) {
          data[i] = this.emitTo[i] ?? p;
          continue;
        }
        let v = 1;
        if (vignette > 0) {
          const nx = (x - cx) / W;
          v = 1 - vignette * Math.min(1, (nx * nx + ny * ny) * 2.2);
        }
        let mr = ar * v;
        let mg = ag * v;
        let mb = ab * v;
        const L = lit ? Math.min(1, amount[i] ?? 0) : 0;
        if (L > 0) {
          // Pool color, normalized to its own brightness.
          const s = 1 / Math.max(1e-3, this.weight[i] ?? 0);
          const lr = (this.red[i] ?? 0) * s;
          const lg = (this.green[i] ?? 0) * s;
          const lb = (this.blue[i] ?? 0) * s;
          mr = (mr + (1 - mr) * L) * (1 + (lr - 1) * L * tint) + lr * L * boost;
          mg = (mg + (1 - mg) * L) * (1 + (lg - 1) * L * tint) + lg * L * boost;
          mb = (mb + (1 - mb) * L) * (1 + (lb - 1) * L * tint) + lb * L * boost;
        }
        const r = Math.min(255, (p & 0xff) * mr);
        const g = Math.min(255, ((p >>> 8) & 0xff) * mg);
        const b = Math.min(255, ((p >>> 16) & 0xff) * mb);
        data[i] = (0xff000000 | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0)) >>> 0;
      }
    }
  }

  private splat(l: Light): void {
    const { width: W, height: H } = this;
    const ry = l.radius / SQUASH;
    const x0 = Math.max(0, Math.floor(l.x - l.radius));
    const x1 = Math.min(W - 1, Math.ceil(l.x + l.radius));
    const y0 = Math.max(0, Math.floor(l.y - ry));
    const y1 = Math.min(H - 1, Math.ceil(l.y + ry));
    const cr = ((l.color >> 16) & 0xff) / 255;
    const cg = ((l.color >> 8) & 0xff) / 255;
    const cb = (l.color & 0xff) / 255;
    for (let y = y0; y <= y1; y++) {
      const dy = (y - l.y) * SQUASH;
      for (let x = x0; x <= x1; x++) {
        const dx = x - l.x;
        const a = falloff(Math.sqrt(dx * dx + dy * dy) / l.radius) * l.strength;
        if (a <= 0) continue;
        const i = y * W + x;
        // Brightest light wins the amount; colors mix by weight.
        if (a > (this.amount[i] ?? 0)) this.amount[i] = a;
        this.red[i] = (this.red[i] ?? 0) + cr * a;
        this.green[i] = (this.green[i] ?? 0) + cg * a;
        this.blue[i] = (this.blue[i] ?? 0) + cb * a;
        this.weight[i] = (this.weight[i] ?? 0) + a;
      }
    }
  }
}
