/**
 * The world layout (C36c): where every region's map sits in one world, in tiles. Each start
 * region places its map with `world` on its start entry (validated so regions don't overlap).
 * A map without a place, such as a pack's start without `world` or a debug map, is put east
 * of everything else, so it still shows and never overlaps.
 *
 * The map window draws the regions at these offsets; exploration and saves stay per map. The
 * later seamless-world chunk reuses the same offsets.
 */

import type { GameContent } from '@game/data';
import { linkedArrival } from './map/links';

export interface WorldRegion {
  readonly map: string;
  readonly name: string;
  /** World tile of the map's top-left corner. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Tiles between a region without a place and the world east of it. */
const GAP = 16;

/**
 * Every start region's map in pack order, plus `extra` maps (the one the player is on), each
 * at its world place.
 */
export function worldLayout(content: GameContent, extra: readonly string[] = []): WorldRegion[] {
  const out: WorldRegion[] = [];
  const unplaced: string[] = [];
  const ids: string[] = [];
  for (const s of content.starts.values()) {
    if (ids.includes(s.map)) continue;
    ids.push(s.map);
    const m = content.maps.get(s.map);
    if (!m) continue;
    if (s.world)
      out.push({ map: s.map, name: m.name, ...s.world, width: m.width, height: m.height });
    else unplaced.push(s.map);
  }
  for (const id of extra) if (!ids.includes(id)) unplaced.push(id);
  for (const id of unplaced) {
    const m = content.maps.get(id);
    if (!m || out.some((r) => r.map === id)) continue;
    const east = out.length ? Math.max(...out.map((r) => r.x + r.width)) + GAP : 0;
    const top = out.length ? Math.min(...out.map((r) => r.y)) : 0;
    out.push({ map: id, name: m.name, x: east, y: top, width: m.width, height: m.height });
  }
  return out;
}

/** The world's bounds (tiles). */
export function worldBounds(regions: readonly WorldRegion[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (!regions.length) return { x: 0, y: 0, width: 0, height: 0 };
  const x = Math.min(...regions.map((r) => r.x));
  const y = Math.min(...regions.map((r) => r.y));
  const right = Math.max(...regions.map((r) => r.x + r.width));
  const bottom = Math.max(...regions.map((r) => r.y + r.height));
  return { x, y, width: right - x, height: bottom - y };
}

/** A link between two placed regions (a pass or a ferry), both ends in world tiles. */
export interface WorldLink {
  readonly kind: string;
  readonly a: { readonly map: string; readonly x: number; readonly y: number };
  readonly b: { readonly map: string; readonly x: number; readonly y: number };
  /** A ferry's sailing route from `a` to `b` (C37 `route` data), in world tiles. */
  readonly route?: readonly { readonly x: number; readonly y: number }[];
  /** The open sea between the two regions, for a link across a gap (a ferry). */
  readonly sea?: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

/** Every link between two regions of the layout, once each. */
export function worldLinks(content: GameContent, regions: readonly WorldRegion[]): WorldLink[] {
  const out: WorldLink[] = [];
  const done = new Set<string>();
  for (const r of regions) {
    const conns = content.maps.get(r.map)?.connections ?? {};
    for (const [key, c] of Object.entries(conns)) {
      const there = linkedArrival(content, r.map, key);
      const o = there && regions.find((x) => x.map === there.map);
      if (!there || !o) continue;
      const ids = [`${r.map}#${key}`, `${there.map}#${there.connection}`].sort().join('|');
      if (done.has(ids)) continue;
      done.add(ids);
      const sea = gapBetween(r, o);
      const back = content.maps.get(o.map)?.connections[there.connection]?.route;
      const route = c.route
        ? c.route.map(([x, y]) => ({ x: r.x + x, y: r.y + y }))
        : back?.map(([x, y]) => ({ x: o.x + x, y: o.y + y })).reverse();
      out.push({
        kind: c.kind,
        a: { map: r.map, x: r.x + c.x, y: r.y + c.y },
        b: { map: o.map, x: o.x + there.x, y: o.y + there.y },
        ...(route ? { route } : {}),
        ...(sea ? { sea } : {}),
      });
    }
  }
  return out;
}

/** The space between two regions that face each other across a gap, if any. */
export function gapBetween(
  a: WorldRegion,
  b: WorldRegion,
): { x: number; y: number; width: number; height: number } | undefined {
  const [top, bottom] = a.y <= b.y ? [a, b] : [b, a];
  const [left, right] = a.x <= b.x ? [a, b] : [b, a];
  const x0 = Math.max(a.x, b.x);
  const x1 = Math.min(a.x + a.width, b.x + b.width);
  const y0 = Math.max(a.y, b.y);
  const y1 = Math.min(a.y + a.height, b.y + b.height);
  const gapY = bottom.y - (top.y + top.height);
  if (gapY > 0 && x1 > x0) return { x: x0, y: top.y + top.height, width: x1 - x0, height: gapY };
  const gapX = right.x - (left.x + left.width);
  if (gapX > 0 && y1 > y0) return { x: left.x + left.width, y: y0, width: gapX, height: y1 - y0 };
  return undefined;
}
