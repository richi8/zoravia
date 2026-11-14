/**
 * Weather looks for the launch biomes, as data for the engine's `WeatherSim`: forest rain,
 * volcanic ash storms (drifting flakes, rising embers, warm moving haze) and coastal snow.
 * Speeds are in game pixels per second on the 480×270 screen.
 */

import type { WeatherSpec } from '@engine/render/weather';

export const WEATHER_IDS = ['clear', 'rain', 'ash', 'snow', 'mist'] as const;
export type WeatherId = (typeof WEATHER_IDS)[number];

export const WEATHER_LABELS: Readonly<Record<WeatherId, string>> = {
  clear: 'Clear',
  rain: 'Rain',
  ash: 'Ash storm',
  snow: 'Snow',
  mist: 'Mist',
};

export const WEATHER: Readonly<Record<WeatherId, WeatherSpec>> = {
  clear: { layers: [] },
  rain: {
    haze: { color: 0x34445e, alpha: 0.2 },
    layers: [
      {
        count: 230,
        shape: 'streak',
        vx: [-75, -105],
        vy: [300, 420],
        length: [4, 7],
        color: 0xd6e8ff,
        alpha: [0.35, 0.7],
        splash: { color: 0xe6f2ff, duration: 0.18 },
      },
    ],
  },
  ash: {
    haze: { color: 0x8e5e48, alpha: 0.16, wave: { amp: 0.09, freq: 0.03, speed: 0.9 }, top: 0.06 },
    layers: [
      {
        count: 150,
        shape: 'dot',
        vx: [34, 74],
        vy: [10, 32],
        sway: { amp: 6, freq: 1.7 },
        wideFrom: 0.35,
        bigFrom: 0.7,
        color: 0x5e5456,
        nearColor: 0x9a908c,
        alpha: [0.85, 0.9],
      },
      {
        count: 24,
        shape: 'dot',
        vx: [16, 22],
        vy: [-10, -18],
        sway: { amp: 14, freq: 2 },
        color: 0xffd27a,
        alpha: [0.75, 1],
        flicker: { colors: [0xffd27a, 0xff7a36], speed: 9 },
      },
    ],
  },
  mist: {
    haze: { color: 0xeef2f8, alpha: 0.14, wave: { amp: 0.08, freq: 0.025, speed: 0.35 } },
    layers: [
      {
        count: 40,
        shape: 'dot',
        vx: [6, 12],
        vy: [-2, 2],
        sway: { amp: 3, freq: 0.7 },
        wideFrom: 0.4,
        color: 0xffffff,
        alpha: [0.15, 0.3],
      },
    ],
  },
  snow: {
    haze: { color: 0xe6eeff, alpha: 0.12 },
    layers: [
      {
        count: 190,
        shape: 'dot',
        vx: [4, 4],
        vy: [14, 44],
        sway: { amp: 10, freq: 1.3 },
        bigFrom: 0.75,
        wideFrom: 0.75,
        color: 0xffffff,
        alpha: [0.55, 1],
      },
    ],
  },
};
