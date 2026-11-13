/**
 * The `core` pack: base types, conditions, reactions, moves, traits, species, items, music,
 * bosses, region maps, NPCs, dialogues and quests.
 */

import { definePack } from '@engine/packs';
import { bosses } from './bosses';
import { conditions } from './conditions';
import { items } from './items';
import { maps } from './maps';
import { moves } from './moves';
import { music } from './music';
import { npcs } from './npcs';
import { reactions } from './reactions';
import { species } from './species';
import { dialogues, quests } from './story';
import { traits } from './traits';
import { types } from './types';

export const corePack = definePack({
  manifest: {
    id: 'core',
    version: '0.1.0',
    name: 'Zoravia core',
    description: 'Base rules content every other pack builds on.',
  },
  content: {
    types,
    conditions,
    reactions,
    moves,
    traits,
    species,
    items,
    music,
    bosses,
    maps,
    npcs,
    dialogues,
    quests,
  },
});

export default corePack;
