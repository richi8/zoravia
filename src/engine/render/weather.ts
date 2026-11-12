/**
 * Screen-space weather: layers of seeded particles (dots or streaks) plus an optional haze,
 * drawn straight into a `PixelBuffer` in game pixels. The engine only knows the generic
 * behaviour; the game describes rain, ash, snow, … as `WeatherSpec` data. Pure: no DOM.
 */

import { Rng, type Seed } from '../core/rng';
import { blendPacked, type PixelBuffer } from './pixel-buffer';

export type Range = readonly [number, number];

export interface ParticleSpec {
  readonly count: number;
  /** Velocity in px/s, from far (depth 0) to near (depth 1) particles. */
  readonly vx: Range;
  readonly vy: Range;
  /** Extra sideways wobble: `amp` px/s, `freq` rad/s. */
  readonly sway?: { readonly amp: number; readonly freq: number };
  /** `dot`: 1 px (wider when near, see `wideFrom`/`bigFrom`); `streak`: a line along the motion. */
  readonly shape: 'dot' | 'streak';
  /** Streak length in px, far → near. */
  readonly length?: Range;
  /** Depth from which a dot is 2 px wide. */
  readonly wideFrom?: number;
  /** Depth from which a dot is 2×2. */
  readonly bigFrom?: number;
  /** `0xRRGGBB` for far particles; `nearColor` (if set) for depth ≥ 0.5. */
  readonly color: number;
  readonly nearColor?: number;
  /** Opacity, far → near. */
  readonly alpha: Range;
  /** Glowing particles that alternate between two colors (e.g. embers). */
  readonly flicker?: { readonly colors: readonly [number, number]; readonly speed: number };
  /** Particles end at a random height and leave a short splash there (rain). */
  readonly splash?: { readonly color: number; readonly duration: number };
}

export interface HazeSpec {
  readonly color: number;
  /** Base opacity of the tint over the whole screen. */
  readonly alpha: number;
  /** Moving diagonal bands of extra opacity. */
  readonly wave?: { readonly amp: number; readonly freq: number; readonly speed: number };
  /** Extra opacity at the top edge, fading to 0 at the bottom. */
  readonly top?: number;
}

export interface WeatherSpec {
  readonly layers: readonly ParticleSpec[];
  readonly haze?: HazeSpec;
}

interface Particle {
  x: number;
  y: number;
  /** Depth 0 (far) … 1 (near). */
  z: number;
  phase: number;
  /** Landing height for `splash` particles. */
  land: number;
}

interface Splash {
  x: number;
  y: number;
  age: number;
  color: number;
  duration: number;
}

const lerp = (r: Range, t: number): number => r[0] + (r[1] - r[0]) * t;
const MARGIN = 4;

export class WeatherSim {
  private readonly rng: Rng;
  private readonly layers: { spec: ParticleSpec; particles: Particle[] }[];
  private splashes: Splash[] = [];
  private time = 0;

  constructor(
    readonly spec: WeatherSpec,
    seed: Seed,
    private width: number,
    private height: number,
  ) {
    this.rng = new Rng(seed);
    this.layers = spec.layers.map((s) => ({
      spec: s,
      particles: Array.from({ length: s.count }, () => ({
        x: this.rng.float(0, width),
        y: this.rng.float(0, height),
        z: this.rng.next(),
        phase: this.rng.float(0, Math.PI * 2),
        land: this.rng.float(height * 0.12, height),
      })),
    }));
  }

  /** Number of live particles (all layers). */
  get count(): number {
    return this.layers.reduce((n, l) => n + l.particles.length, 0);
  }

  /** Read-only view of the particles, for tests and debugging. */
  particles(): readonly Readonly<Particle>[] {
    return this.layers.flatMap((l) => l.particles);
  }

  resize(width: number, height: number): void {
    for (const { particles } of this.layers) {
      for (const p of particles) {
        p.x = (p.x / this.width) * width;
        p.y = (p.y / this.height) * height;
        p.land = (p.land / this.height) * height;
      }
    }
    this.width = width;
    this.height = height;
  }

  update(dt: number): void {
    this.time += dt;
    const { width: w, height: h, rng } = this;
    for (const { spec, particles } of this.layers) {
      for (const p of particles) {
        const sway = spec.sway ? Math.sin(this.time * spec.sway.freq + p.phase) * spec.sway.amp : 0;
        p.x += (lerp(spec.vx, p.z) + sway) * dt;
        p.y += lerp(spec.vy, p.z) * dt;
        if (spec.splash && p.y >= p.land) {
          this.splashes.push({ x: p.x, y: p.land, age: 0, ...spec.splash });
          p.y = -rng.float(MARGIN, 40);
          p.x = rng.float(-w * 0.1, w * 1.2);
          p.land = rng.float(h * 0.12, h);
          continue;
        }
        if (p.y > h + MARGIN) p.y = -MARGIN;
        else if (p.y < -MARGIN) p.y = h + MARGIN;
        if (p.x > w + MARGIN) {
          p.x = -MARGIN;
          if (spec.vx[0] > 0) p.y = rng.float(0, h);
        } else if (p.x < -MARGIN - w * 0.1) p.x = w + MARGIN;
      }
    }
    for (const s of this.splashes) s.age += dt;
    this.splashes = this.splashes.filter((s) => s.age < s.duration);
  }

  /** Haze first, then particles and splashes on top. */
  draw(buf: PixelBuffer): void {
    const { haze } = this.spec;
    if (haze) drawHaze(buf, haze, this.time);
    const t = this.time;
    for (const { spec, particles } of this.layers) {
      for (const p of particles) {
        const a = lerp(spec.alpha, p.z);
        let color = spec.nearColor !== undefined && p.z >= 0.5 ? spec.nearColor : spec.color;
        let alpha = a;
        if (spec.flicker) {
          const f = 0.5 + 0.5 * Math.sin(t * spec.flicker.speed + p.phase * 5);
          color = f > 0.5 ? spec.flicker.colors[0] : spec.flicker.colors[1];
          alpha = a * (0.6 + 0.4 * f);
        }
        if (spec.shape === 'streak') {
          const len = Math.round(lerp(spec.length ?? [4, 6], p.z));
          const vx = lerp(spec.vx, p.z);
          const vy = lerp(spec.vy, p.z) || 1;
          for (let j = 0; j < len; j++) buf.dot(p.x - (vx / vy) * j, p.y - j, color, alpha);
        } else {
          buf.dot(p.x, p.y, color, alpha);
          if (spec.wideFrom !== undefined && p.z >= spec.wideFrom)
            buf.dot(p.x + 1, p.y, color, alpha);
          if (spec.bigFrom !== undefined && p.z >= spec.bigFrom) {
            buf.dot(p.x, p.y + 1, color, alpha);
            buf.dot(p.x + 1, p.y + 1, color, alpha);
          }
        }
      }
    }
    for (const s of this.splashes) {
      const a = 0.7 * (1 - s.age / s.duration);
      if (s.age < s.duration * 0.4) buf.dot(s.x, s.y, s.color, a);
      else {
        buf.dot(s.x - 1, s.y, s.color, a);
        buf.dot(s.x + 1, s.y, s.color, a);
        buf.dot(s.x, s.y - 1, s.color, a * 0.6);
      }
    }
  }
}

function drawHaze(buf: PixelBuffer, haze: HazeSpec, t: number): void {
  const { width: w, height: h, data } = buf;
  // Opacity per diagonal (x + 0.6·y), so the bands cost one sin per diagonal, not per pixel.
  const diag = new Float32Array(w + h);
  for (let d = 0; d < diag.length; d++) {
    diag[d] =
      haze.alpha +
      (haze.wave ? haze.wave.amp * Math.sin(d * haze.wave.freq + t * haze.wave.speed) : 0);
  }
  for (let y = 0; y < h; y++) {
    const top = haze.top ? (1 - y / h) * haze.top : 0;
    const dy = Math.floor(y * 0.6);
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const a = (diag[x + dy] ?? 0) + top;
      if (a > 0) data[row + x] = blendPacked(data[row + x] ?? 0, haze.color, a);
    }
  }
}
