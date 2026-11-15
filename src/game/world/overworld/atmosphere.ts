/**
 * The overworld's atmosphere (C32): time-of-day light, area moods that ease in and out as
 * the player walks (zone moods and moods around anchors such as a shrine), the zone's
 * cosmetic weather, and the per-frame lighting pass. The scene calls `update` every frame,
 * `begin` before drawing the terrain (it returns the sink for glowing prop pixels), and
 * `finish` once everything in the world is drawn. Pure: no DOM.
 */

import { LightMap } from '@engine/render/lighting';
import type { PixelBuffer } from '@engine/render/pixel-buffer';
import { WeatherSim } from '@engine/render/weather';
import type { GlowSink } from '../animate';
import { TILE, type Biome } from '../biomes';
import {
  dayLight,
  litPixel,
  MOODS,
  propLights,
  sceneLight,
  type ActiveMood,
  type MoodId,
  type PropLight,
  type SceneLight,
} from '../lighting';
import type { WorldMap } from '../map';
import { WEATHER, type WeatherId } from '../weather';

/** Tiles over which an anchor's mood fades out beyond its radius. */
const MOOD_FADE = 5;
/** Default anchor mood radius (tiles). */
const MOOD_RADIUS = 6;
/** Mood weight change per second (eases moods in and out). */
const MOOD_EASE = 1.2;

interface MoodSource {
  readonly mood: MoodId;
  /** Anchor sources: center (world px) and radius (tiles). Zone sources have none. */
  readonly anchor?: { readonly x: number; readonly y: number; readonly radius: number };
  readonly zone?: string;
  weight: number;
}

export class Atmosphere {
  readonly lights = new LightMap();
  private readonly props: PropLight[];
  private readonly sources: MoodSource[] = [];
  private weatherId: WeatherId = 'clear';
  private weather: WeatherSim | undefined;
  private light: SceneLight | undefined;
  private width = 1;
  private height = 1;

  constructor(
    readonly map: WorldMap,
    biome: Biome,
    private readonly seed: number,
  ) {
    this.props = propLights(map.toTerrainMap(), biome);
    for (const zone of map.zones) {
      if (zone.mood) this.sources.push({ mood: zone.mood, zone: zone.key, weight: 0 });
    }
    for (const a of Object.values(map.anchors)) {
      if (!a.mood) continue;
      this.sources.push({
        mood: a.mood,
        anchor: {
          x: a.x * TILE + TILE / 2,
          y: a.y * TILE + TILE / 2,
          radius: a.radius ?? MOOD_RADIUS,
        },
        weight: 0,
      });
    }
  }

  /** Lights the props give off (for tests). */
  get propLightCount(): number {
    return this.props.length;
  }

  get weatherNow(): WeatherId {
    return this.weatherId;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.weather?.resize(width, height);
  }

  /**
   * Eases moods toward where the player is (`tx`, `ty` in tiles, fractional while walking)
   * and moves the weather. `snap` jumps straight there (entering the map).
   */
  update(dt: number, tx: number, ty: number, snap = false): void {
    const zone = this.map.zoneAt(Math.round(tx), Math.round(ty));
    const px = tx * TILE + TILE / 2;
    const py = ty * TILE + TILE / 2;
    for (const s of this.sources) {
      let target = 0;
      if (s.zone) target = zone?.key === s.zone ? 1 : 0;
      else if (s.anchor) {
        const d = Math.hypot(px - s.anchor.x, py - s.anchor.y) / TILE;
        target = Math.min(1, Math.max(0, 1 - (d - s.anchor.radius) / MOOD_FADE));
      }
      if (snap) s.weight = target;
      else {
        const step = MOOD_EASE * dt;
        s.weight += Math.max(-step, Math.min(step, target - s.weight));
      }
    }
    const want = zone?.weather ?? 'clear';
    if (want !== this.weatherId) {
      this.weatherId = want;
      this.weather =
        want === 'clear'
          ? undefined
          : new WeatherSim(WEATHER[want], this.seed + 31, this.width, this.height);
    }
    this.weather?.update(dt);
  }

  /** The moods in effect now (for tests and the frame). */
  activeMoods(): ActiveMood[] {
    const out: ActiveMood[] = [];
    for (const s of this.sources) {
      if (s.weight <= 0) continue;
      out.push(
        s.anchor
          ? { mood: MOODS[s.mood], weight: s.weight, x: s.anchor.x, y: s.anchor.y }
          : { mood: MOODS[s.mood], weight: s.weight },
      );
    }
    return out;
  }

  /**
   * Starts a frame at day-clock time `clock` (seconds) with the camera at (`camX`, `camY`);
   * `extra` are lights that change while playing (campfires, C40). Returns the sink for
   * glowing prop pixels, or nothing when no prop glows now.
   */
  begin(
    clock: number,
    camX: number,
    camY: number,
    extra: readonly PropLight[] = [],
  ): GlowSink | undefined {
    const { width, height } = this;
    const light = sceneLight(
      dayLight(clock),
      this.activeMoods(),
      extra.length ? [...this.props, ...extra] : this.props,
      camX,
      camY,
      width,
      height,
    );
    this.light = light;
    this.lights.begin(width, height);
    for (const l of light.lights) this.lights.add(l);
    if (!light.glow.some((g) => g > 0)) return undefined;
    const map = this.lights;
    const ambient = light.frame.ambient;
    return {
      glow(i, px, code) {
        const level = light.glow[code] ?? 0;
        if (level > 0) map.emit(i, px, litPixel(px, code, level, ambient));
      },
    };
  }

  /** Draws the weather and lights the frame. */
  finish(buf: PixelBuffer): void {
    this.weather?.draw(buf);
    if (this.light) this.lights.apply(buf.data, this.light.frame);
  }
}
