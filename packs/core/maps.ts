/**
 * Region maps, built by the world tool (`npm run world -- build`) from each region's frozen
 * generated base plus its hand-edit overlay. Never edit `map.json` by hand: edit
 * `overlay.json` and rebuild. See `tools/README.md`.
 */

import testRegion from './maps/test-region/map.json';

export const maps = {
  /** C19 test region: forest, 96×96 tiles, 3×3 chunks. Real Region 1 comes in C28. */
  'test-region': testRegion,
};
