/**
 * Rimeholm's model kit (C35a): frozen-coast body plans only, none shared with another region,
 * plus Glacivar's frostwyrm. Fur ruffs, icicles and frost are common; leaves, sails, shells,
 * flame tails and socks never appear.
 */

import type { ModelKitInput } from '@game/data';

export const modelKits = {
  frozen: {
    name: 'Rimeholm',
    description: 'Frozen coast: seals, mammoths, jellies, crabs, anglers, stoats, owls and more.',
    plans: [
      'pinniped',
      'tusker',
      'jelly',
      'crab',
      'angler',
      'mustelid',
      'owl',
      'caribou',
      'urchin',
      'frostwyrm',
    ],
    parts: {
      back: { ruff: 3, icicles: 3, leaves: 0, carapace: 0, sail: 0 },
      tail: { flame: 0, leaf: 0, fluffy: 1 },
      markings: { frost: 3, socks: 0 },
    },
  },
} satisfies Record<string, ModelKitInput>;
