/**
 * Rimeholm's region map, built by the world tool (`npm run world -- build`) from its frozen
 * generated base plus the hand-edit overlay. Never edit `map.json` by hand. See
 * `tools/README.md`. Its `ferry` connection leads to Verdale's ferry dock (C34: links work from
 * either end, so the core map is unchanged).
 */

import rimeholm from './maps/rimeholm/map.json';

export const maps = {
  /** Region 3 (C35): the Rimeholm Isles, a frozen archipelago, 200×200 tiles. */
  rimeholm,
};
