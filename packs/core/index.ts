/** The `core` pack: base types, conditions, reactions, moves, traits, species and items. */

import { definePack } from '@engine/packs';
import { conditions } from './conditions';
import { items } from './items';
import { moves } from './moves';
import { reactions } from './reactions';
import { species } from './species';
import { traits } from './traits';
import { types } from './types';

export const corePack = definePack({
  manifest: {
    id: 'core',
    version: '0.1.0',
    name: 'Zoravia core',
    description: 'Base rules content every other pack builds on.',
  },
  content: { types, conditions, reactions, moves, traits, species, items },
});

export default corePack;
