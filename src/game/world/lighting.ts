/**
 * Overworld lighting (C32), style "A · Soft" from the C32 preview round: a cosmetic
 * day/night cycle on the play clock, area moods (canopy dim, shrine glow, mist), and the
 * lights that props give off (lamps, lit windows, glowing runes). Spawns do not change with
 * the time of day. The engine's `LightMap` does the per-pixel work; this file is the look.
 * Pure: no DOM.
 */

import type { Light, LightingFrame, Rgb } from '@engine/render/lighting';
import { TILE, type Biome } from './biomes';
import { GLOW } from './glow';
import { Painter } from './props';
import { placeProp, PropSprites, type TerrainMap } from './terrain';

/** Seconds of play per full day (day → dusk → night → dawn). */
export const DAY_LENGTH = 20 * 60;

export type DayPhase = 'day' | 'dusk' | 'night' | 'dawn';

interface Key {
  /** Fraction of the day. */
  readonly at: number;
  readonly ambient: Rgb;
  /** How lit lamps and windows are, 0..1. */
  readonly lamps: number;
  readonly phase: DayPhase;
}

const DAY: Rgb = [1, 1, 1];
const DUSK: Rgb = [1, 0.78, 0.66];
const NIGHT: Rgb = [0.5, 0.58, 0.82];
const DAWN: Rgb = [0.9, 0.82, 0.9];

/** A new game starts in the morning (fraction 0). */
const KEYS: readonly Key[] = [
  { at: 0, ambient: DAY, lamps: 0, phase: 'day' },
  { at: 0.46, ambient: DAY, lamps: 0, phase: 'day' },
  { at: 0.52, ambient: DUSK, lamps: 0.65, phase: 'dusk' },
  { at: 0.58, ambient: NIGHT, lamps: 1, phase: 'night' },
  { at: 0.88, ambient: NIGHT, lamps: 1, phase: 'night' },
  { at: 0.94, ambient: DAWN, lamps: 0.15, phase: 'dawn' },
  { at: 1, ambient: DAY, lamps: 0, phase: 'day' },
];

export interface DayLight {
  readonly ambient: Rgb;
  readonly lamps: number;
  readonly phase: DayPhase;
}

const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** The day's light at `playtime` seconds. */
export function dayLight(playtime: number): DayLight {
  const f = (((playtime / DAY_LENGTH) % 1) + 1) % 1;
  for (let k = 1; k < KEYS.length; k++) {
    const b = KEYS[k] as Key;
    if (f > b.at) continue;
    const a = KEYS[k - 1] as Key;
    const t = b.at > a.at ? (f - a.at) / (b.at - a.at) : 1;
    return {
      ambient: mixRgb(a.ambient, b.ambient, t),
      lamps: a.lamps + (b.lamps - a.lamps) * t,
      // The phase being entered names the stretch (day → dusk is "dusk").
      phase: t > 0 ? b.phase : a.phase,
    };
  }
  return { ambient: DAY, lamps: 0, phase: 'day' };
}

/** Playtime (seconds) of the start of `phase` in the day after `playtime` (debug skips). */
export function nextPhaseStart(playtime: number, phase: DayPhase): number {
  const start: Record<DayPhase, number> = { day: 0, dusk: 0.47, night: 0.58, dawn: 0.89 };
  const day = Math.floor(playtime / DAY_LENGTH);
  let t = (day + start[phase]) * DAY_LENGTH;
  if (t <= playtime) t += DAY_LENGTH;
  return t;
}

// ------------------------------------------------------------------ moods

export const MOOD_IDS = ['canopy', 'shrine', 'mist'] as const;
export type MoodId = (typeof MOOD_IDS)[number];

export interface Mood {
  readonly ambient: Rgb;
  readonly vignette: number;
  /** Glowing props lit at least this much (runes at a shrine), 0..1. */
  readonly glow: number;
  /** A big soft light at the mood's anchor (a sunlit clearing), radius in px. */
  readonly sun?: { readonly color: number; readonly radius: number; readonly strength: number };
}

export const MOODS: Readonly<Record<MoodId, Mood>> = {
  canopy: {
    ambient: [0.62, 0.76, 0.62],
    vignette: 0.4,
    glow: 0,
    sun: { color: 0xfff2b0, radius: 120, strength: 0.9 },
  },
  shrine: {
    ambient: [0.78, 0.86, 0.98],
    vignette: 0.35,
    glow: 1,
    sun: { color: 0xbff6ff, radius: 120, strength: 0.9 },
  },
  mist: { ambient: [0.84, 0.88, 0.94], vignette: 0.25, glow: 0 },
};

/** A mood in effect, `weight` 0..1, its sun (if any) at world (`x`, `y`). */
export interface ActiveMood {
  readonly mood: Mood;
  readonly weight: number;
  readonly x?: number;
  readonly y?: number;
}

// ------------------------------------------------------------------ prop lights

/** `campfire` burns, `embers` is a fire burnt down after a rest (C40). */
export type PropLightKind = 'lamp' | 'window' | 'rune' | 'campfire' | 'embers';

export interface PropLight {
  readonly kind: PropLightKind;
  /** World px. */
  readonly x: number;
  readonly y: number;
}

const POOL: Readonly<
  Record<PropLightKind, { color: number; radius: number; strength: number; glow: number }>
> = {
  lamp: { color: 0xffc46a, radius: 40, strength: 1, glow: GLOW.flame },
  window: { color: 0xffb85a, radius: 34, strength: 0.75, glow: GLOW.window },
  rune: { color: 0x70e6d0, radius: 22, strength: 0.8, glow: GLOW.rune },
  campfire: { color: 0xffa050, radius: 52, strength: 1.1, glow: GLOW.flame },
  embers: { color: 0xff6a3a, radius: 14, strength: 0.6, glow: GLOW.flame },
};

/** Windows closer than this (px, along x) share one light pool. */
const WINDOW_GAP = 12;

/** Every light a map's props give off, in world px. */
export function propLights(map: TerrainMap, biome: Biome): PropLight[] {
  const sprites = new PropSprites(new Painter(biome));
  const out: PropLight[] = [];
  for (const p of map.props) {
    if (p.kind === 'lamp') {
      const at = placeProp(p, sprites.get(p));
      out.push({ kind: 'lamp', x: at.bx, y: at.by - 4 });
    } else if (p.kind === 'menhir') {
      const at = placeProp(p, sprites.get(p));
      out.push({ kind: 'rune', x: at.bx, y: at.by - 10 });
    } else if (p.kind === 'center' || p.kind === 'shop' || p.kind === 'house') {
      const sprite = sprites.get(p);
      if (!sprite.glow) continue;
      const at = placeProp(p, sprite);
      for (const c of windowClusters(sprite.glow, sprite.width, sprite.height))
        out.push({ kind: 'window', x: at.x + c.x, y: at.y + c.y + 10 });
    }
  }
  return out;
}

/** Centers of window pixel groups (split where columns of glass are far apart). */
function windowClusters(glow: Uint8Array, w: number, h: number): { x: number; y: number }[] {
  const cols: { x: number; ySum: number; n: number }[] = [];
  for (let x = 0; x < w; x++) {
    let ySum = 0;
    let n = 0;
    for (let y = 0; y < h; y++) {
      if (glow[y * w + x] === GLOW.window) {
        ySum += y;
        n++;
      }
    }
    if (n) cols.push({ x, ySum, n });
  }
  const out: { x: number; y: number }[] = [];
  let group: typeof cols = [];
  const flush = (): void => {
    if (!group.length) return;
    const n = group.reduce((s, c) => s + c.n, 0);
    out.push({
      x: group.reduce((s, c) => s + c.x * c.n, 0) / n,
      y: group.reduce((s, c) => s + c.ySum, 0) / n,
    });
    group = [];
  };
  for (const c of cols) {
    const last = group[group.length - 1];
    if (last && c.x - last.x > WINDOW_GAP) flush();
    group.push(c);
  }
  flush();
  return out;
}

// ------------------------------------------------------------------ frame

export interface SceneLight {
  readonly frame: LightingFrame;
  /** Lit level per `PropGlow` code (index = code). */
  readonly glow: readonly number[];
  /** Screen-space lights (prop pools and mood suns). */
  readonly lights: readonly Light[];
}

/** Lit colors of glowing pixels, dark → light, by `PropGlow` code. */
const LIT: Readonly<Record<number, readonly [number, number]>> = {
  [GLOW.window]: [0xd88a3a, 0xfff0b0],
  [GLOW.rune]: [0x2aa8a0, 0xb8fff0],
  [GLOW.flame]: [0xffb040, 0xfff6c8],
};

/**
 * Builds a frame's lighting: the day's light, multiplied by the moods in effect, and the
 * prop and sun lights inside the view (`camX`, `camY` world px, `width`×`height`).
 */
export function sceneLight(
  day: DayLight,
  moods: readonly ActiveMood[],
  props: readonly PropLight[],
  camX: number,
  camY: number,
  width: number,
  height: number,
): SceneLight {
  let ambient = day.ambient;
  let vignette = 0;
  let runes = 0;
  const lights: Light[] = [];
  for (const m of moods) {
    if (m.weight <= 0) continue;
    const w = m.weight;
    ambient = [
      ambient[0] * (1 + (m.mood.ambient[0] - 1) * w),
      ambient[1] * (1 + (m.mood.ambient[1] - 1) * w),
      ambient[2] * (1 + (m.mood.ambient[2] - 1) * w),
    ];
    vignette = Math.max(vignette, m.mood.vignette * w);
    runes = Math.max(runes, m.mood.glow * w);
    const sun = m.mood.sun;
    if (sun && m.x !== undefined && m.y !== undefined)
      lights.push({
        x: m.x - camX,
        y: m.y - camY,
        radius: sun.radius,
        color: sun.color,
        strength: sun.strength * w,
      });
  }
  const lamps = day.lamps;
  const level = (code: number): number => (code === GLOW.rune ? Math.max(lamps, runes) : lamps);
  for (const p of props) {
    const pool = POOL[p.kind];
    const k = level(pool.glow);
    if (k <= 0) continue;
    const x = p.x - camX;
    const y = p.y - camY;
    const r = pool.radius;
    if (x < -r || y < -r || x > width + r || y > height + r) continue;
    lights.push({ x, y, radius: r, color: pool.color, strength: pool.strength * k });
    if (p.kind === 'lamp') lights.push({ x, y: y - 19, radius: 9, color: 0xfff0c0, strength: k });
  }
  const glow: number[] = [];
  for (const code of Object.values(GLOW)) glow[code] = level(code);
  return { frame: { ambient, vignette }, glow, lights };
}

/** The packed lit color of a glowing pixel `px` (packed RGBA) with code `code` at `level`. */
export function litPixel(px: number, code: number, level: number, ambient: Rgb): number {
  const r = px & 0xff;
  const g = (px >>> 8) & 0xff;
  const b = (px >>> 16) & 0xff;
  const lum = (r * 0.3 + g * 0.55 + b * 0.15) / 255;
  const [dark, light] = LIT[code] ?? [0xffffff, 0xffffff];
  const t = Math.min(1, lum * 1.3);
  const ch = (s: number): number =>
    ((dark >> s) & 0xff) + (((light >> s) & 0xff) - ((dark >> s) & 0xff)) * t;
  // Unlit part: the pixel under the ambient, as the rest of the frame.
  const mix = (base: number, s: number, a: number): number =>
    Math.min(255, base * a + (ch(s) - base * a) * level) | 0;
  const nr = mix(r, 16, ambient[0]);
  const ng = mix(g, 8, ambient[1]);
  const nb = mix(b, 0, ambient[2]);
  return (0xff000000 | (nb << 16) | (ng << 8) | nr) >>> 0;
}

/** World px of a tile's center. */
export const tileCenter = (t: number): number => t * TILE + TILE / 2;
