/** Region maps: the in-memory `WorldMap`, its file codec and loading from game content. */

import type { GameContent } from '@game/data';
import { decodeRegion } from './codec';
import type { WorldMap } from './world-map';

export * from './codec';
export * from './links';
export * from './minimap';
export * from './world-map';

const cache = new WeakMap<GameContent, Map<string, WorldMap>>();

/** Decodes a region from loaded content (once per content and id). */
export function loadRegion(content: GameContent, id: string): WorldMap {
  let maps = cache.get(content);
  if (!maps) {
    maps = new Map();
    cache.set(content, maps);
  }
  let m = maps.get(id);
  if (!m) {
    m = decodeRegion(content.maps.require(id));
    maps.set(id, m);
  }
  return m;
}
