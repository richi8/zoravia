/**
 * Small hand-shaped sample maps (30×17 tiles, about one screen) for the lab: a lake with a
 * stream in the forest, lava pools in the desert, a coast with an ice pond in the north.
 * Real region maps come from the world tool (C19).
 */

import { fbm, hash2 } from '@engine/core/noise';
import { CornerGrid, tileIs } from '@engine/world/autotile';
import type { BiomeId } from '@game/world/biomes';
import type { PropKind } from '@game/world/props';
import type { PropPlacement, TerrainMap } from '@game/world/terrain';

const MW = 30;
const MH = 17;
const SEEDS: Readonly<Record<BiomeId, number>> = { forest: 11, desert: 23, frozen: 37 };

type Pt = readonly [number, number];

/** Distance from a point to a polyline. */
function lineDist(px: number, py: number, pts: readonly Pt[]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i] ?? [0, 0];
    const [bx, by] = pts[i + 1] ?? [0, 0];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.min(Math.max(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0), 1);
    best = Math.min(best, Math.hypot(px - ax - dx * t, py - ay - dy * t));
  }
  return best;
}

const grid = (inside: (x: number, y: number) => boolean): CornerGrid =>
  CornerGrid.from(MW, MH, inside);

function layers(id: BiomeId, s: number): Pick<TerrainMap, 'alt' | 'path' | 'liquid'> {
  if (id === 'forest') {
    return {
      liquid: grid(
        (x, y) =>
          Math.hypot((x - 21) / 1.25, y - 6) + (fbm(x * 0.35, y * 0.35, s) - 0.5) * 4 < 5 ||
          lineDist(x, y, [
            [21, 9],
            [17, 13],
            [18, 18],
          ]) <
            0.9 + fbm(x * 0.5, y * 0.5, s + 3),
      ),
      path: grid(
        (x, y) =>
          lineDist(x, y, [
            [-1, 11],
            [6, 11],
            [10, 9],
            [14, 10],
            [15, 14],
            [15, 19],
          ]) < 1.1 ||
          lineDist(x, y, [
            [10, 9],
            [9, 3],
            [11, -1],
          ]) < 0.9,
      ),
      alt: grid((x, y) => fbm(x * 0.22, y * 0.22, s + 5) > 0.6),
    };
  }
  if (id === 'desert') {
    return {
      liquid: grid(
        (x, y) =>
          Math.hypot(x - 7, (y - 4) * 1.2) + (fbm(x * 0.4, y * 0.4, s) - 0.5) * 3 < 3.6 ||
          lineDist(x, y, [
            [31, 12],
            [25, 13],
            [20, 17],
            [19, 19],
          ]) <
            1.1 + (fbm(x * 0.5, y * 0.5, s + 3) - 0.5) * 1.2,
      ),
      path: grid(
        (x, y) =>
          lineDist(x, y, [
            [-1, 12],
            [8, 11],
            [14, 8],
            [21, 7],
            [31, 5],
          ]) < 1,
      ),
      alt: grid(
        (x, y) => fbm(x * 0.2, y * 0.2, s + 5) > 0.63 || Math.hypot(x - 7, (y - 4) * 1.2) < 5.2,
      ),
    };
  }
  return {
    liquid: grid(
      (x, y) =>
        x + (fbm(x * 0.3, y * 0.3, s) - 0.5) * 6 >
          21 + Math.sin(y * 0.45) * 2.2 - (y < 4 ? (4 - y) * 1.6 : 0) ||
        Math.hypot((x - 5) / 1.3, y - 13.5) + (fbm(x * 0.6, y * 0.6, s + 4) - 0.5) * 1.5 < 2.2,
    ),
    path: grid(
      (x, y) =>
        lineDist(x, y, [
          [-1, 7],
          [7, 8],
          [12, 6],
          [17, 7],
          [20, 9],
        ]) < 1 ||
        lineDist(x, y, [
          [12, 6],
          [11, 12],
          [13, 19],
        ]) < 0.9,
    ),
    alt: grid((x, y) => fbm(x * 0.25, y * 0.25, s + 5) > 0.56 && x > 10),
  };
}

/** Scatters props and tall grass with per-biome rules. */
function decorate(id: BiomeId, s: number, l: Pick<TerrainMap, 'alt' | 'path' | 'liquid'>) {
  const props: PropPlacement[] = [];
  const tall: [number, number][] = [];
  for (let ty = 0; ty < MH; ty++) {
    for (let tx = 0; tx < MW; tx++) {
      const free = tileIs(l.liquid, tx, ty, 0) && tileIs(l.path, tx, ty, 0);
      const wet = tileIs(l.liquid, tx, ty, 1);
      const onAlt = tileIs(l.alt, tx, ty, 1);
      const h1 = hash2(tx, ty, s + 1);
      const h2 = hash2(tx, ty, s + 2);
      const cluster = fbm(tx * 0.2, ty * 0.2, s + 31);
      const grass = fbm(tx * 0.3, ty * 0.3, s + 41);
      const dx = Math.floor(h2 * 5) - 2;
      const dy = Math.floor(hash2(tx, ty, s + 3) * 5) - 2;
      const variant = Math.floor(h2 * 8);
      const put = (kind: PropKind, jitterY = false): void => {
        props.push({ kind, tx, ty, dx, dy: jitterY ? dy : 0, variant });
      };
      if (id === 'forest') {
        if (wet) {
          if (h1 < 0.1) put('pad');
          continue;
        }
        if (!free) continue;
        if (cluster > 0.6 && h1 < 0.8 && ty > 0) put('tree', true);
        else if (grass > 0.6) tall.push([tx, ty]);
        else if (h1 < 0.03) put('rock');
        else if (h1 < 0.07) put('bush');
        else if (h1 < 0.17) props.push({ kind: 'flowers', tx, ty, variant });
      } else if (id === 'desert') {
        if (!free) continue;
        if (onAlt) {
          if (h1 < 0.1) put('crystal');
          else if (h1 < 0.14) props.push({ kind: 'vent', tx, ty });
          else if (h1 < 0.22) put('rock');
          continue;
        }
        if (h1 < 0.06) put('cactus');
        else if (cluster > 0.62 && h1 < 0.35) put('rock');
        else if (grass > 0.64) tall.push([tx, ty]);
        else if (h1 < 0.1) put('shrub');
      } else {
        if (wet) {
          if (h1 < 0.07) put('floe');
          continue;
        }
        if (!free) continue;
        if (onAlt) {
          if (h1 < 0.08) put('crystal');
          continue;
        }
        if (cluster > 0.56 && h1 < 0.8 && ty > 0) put('pine', true);
        else if (grass > 0.64) tall.push([tx, ty]);
        else if (h1 < 0.05) put('snowrock');
      }
    }
  }
  return { props, tall };
}

export function sampleMap(id: BiomeId): TerrainMap {
  const seed = SEEDS[id];
  const l = layers(id, seed);
  return { width: MW, height: MH, seed, ...l, ...decorate(id, seed, l) };
}
