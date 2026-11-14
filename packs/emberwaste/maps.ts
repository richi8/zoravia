/**
 * Emberwaste's region map, built by the world tool (`npm run world -- build`) from its frozen
 * generated base plus the hand-edit overlay. Never edit `map.json` by hand. See
 * `tools/README.md`. Its `ember-pass` connection leads to Verdale's (C34: links work from
 * either end, so the core map is unchanged).
 */

import emberwaste from './maps/emberwaste/map.json';

export const maps = {
  /** Region 2 (C34): Emberwaste, volcanic desert, 200×200 tiles. */
  emberwaste,
};
