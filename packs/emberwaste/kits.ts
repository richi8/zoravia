/**
 * Emberwaste's model kit (C35a): desert body plans only, none shared with another region,
 * plus Calderon's magmadrake. Sails, carapaces, long ears and stripes are common; leaves,
 * icicles, fur ruffs and manes never appear.
 */

import type { ModelKitInput } from '@game/data';

export const modelKits = {
  desert: {
    name: 'Emberwaste',
    description: 'Volcanic desert: lizards, scorpions, beetles, cacti, tortoises and more.',
    plans: [
      'lizard',
      'scorpion',
      'beetle',
      'cactus',
      'tortoise',
      'sandworm',
      'vulture',
      'fennec',
      'magmadrake',
    ],
    parts: {
      ears: { long: 2 },
      back: { sail: 2, carapace: 1, spikes: 1, leaves: 0, icicles: 0, ruff: 0, mane: 0 },
      tail: { stinger: 0, fin: 0 },
      markings: { stripes: 1.5, frost: 0, socks: 0 },
    },
  },
} satisfies Record<string, ModelKitInput>;
