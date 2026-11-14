/**
 * Links between regions (C34): a connection point leads to a connection on another map.
 *
 * A link is written on either end: `to: "pack:region#connection"` on one map is enough, and
 * the other end leads back. So an expansion pack attaches its region to a core exit without
 * touching the core map, and an exit whose other end is not loaded leads nowhere.
 */

import type { GameContent } from '@game/data';
import type { Facing } from '@game/data/maps';

export interface Arrival {
  readonly map: string;
  readonly connection: string;
  readonly x: number;
  readonly y: number;
  /** Facing into the map, away from the edge the connection sits on. */
  readonly facing: Facing;
}

const parse = (to: string): { map: string; connection: string } | undefined => {
  const m = /^([a-z0-9_-]+:[a-z0-9_-]+)#([a-z0-9_-]+)$/.exec(to);
  return m?.[1] && m[2] ? { map: m[1], connection: m[2] } : undefined;
};

/** Where stepping onto connection `key` of map `mapId` leads, or undefined (not linked). */
export function linkedArrival(
  content: GameContent,
  mapId: string,
  key: string,
): Arrival | undefined {
  const here = content.maps.get(mapId)?.connections[key];
  if (!here) return undefined;
  let target = here.to ? parse(here.to) : undefined;
  if (!target) {
    const back = `${mapId}#${key}`;
    for (const m of content.maps.values()) {
      const found = Object.entries(m.connections).find(([, c]) => c.to === back);
      if (found) {
        target = { map: m.id, connection: found[0] };
        break;
      }
    }
  }
  if (!target) return undefined;
  const map = content.maps.get(target.map);
  const there = map?.connections[target.connection];
  if (!map || !there) return undefined;
  return {
    ...target,
    x: there.x,
    y: there.y,
    facing: inward(there.x, there.y, map.width, map.height),
  };
}

/** The connection key at tile (x, y) of a map, if any. */
export function connectionAt(
  content: GameContent,
  mapId: string,
  x: number,
  y: number,
): string | undefined {
  const conns = content.maps.get(mapId)?.connections ?? {};
  return Object.entries(conns).find(([, c]) => c.x === x && c.y === y)?.[0];
}

function inward(x: number, y: number, w: number, h: number): Facing {
  const d = [
    [x, 'right'],
    [w - 1 - x, 'left'],
    [y, 'down'],
    [h - 1 - y, 'up'],
  ] as const;
  let best: (typeof d)[number] = d[0];
  for (const e of d) if (e[0] < best[0]) best = e;
  return best[1];
}
