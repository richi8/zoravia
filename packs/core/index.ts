/**
 * The `core` pack: base types, conditions, reactions, moves, traits, species, items, music,
 * bosses, badges, trainers, region maps, NPCs, dialogues, quests and start regions.
 */

import { definePack } from '@engine/packs';
import { bosses } from './bosses';
import { conditions } from './conditions';
import { items } from './items';
import { modelKits } from './kits';
import { maps } from './maps';
import { moves } from './moves';
import { music } from './music';
import { npcs } from './npcs';
import { reactions } from './reactions';
import { species } from './species';
import { starts } from './starts';
import { endgameDialogues, endgameNpcs, endgameQuests, endgameTrainers } from './endgame';
import { dialogues as questDialogues, quests } from './story';
import { THORNVEIL, thornveilSpecies } from './thornveil';
import { dialogues as trialDialogues, trainers } from './trainers';
import { traits } from './traits';
import { types } from './types';
import {
  verdaleBadges,
  verdaleQuests,
  verdaleStoryDialogues,
  verdaleStoryTrainers,
} from './verdale-story';
import { verdaleDialogues, verdaleTrainers } from './verdale-trainers';

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
    modelKits,
    species: { ...species, ...thornveilSpecies },
    items,
    music,
    bosses: { ...bosses, ...THORNVEIL.bosses },
    badges: verdaleBadges,
    trainers: {
      ...trainers,
      ...verdaleTrainers,
      ...verdaleStoryTrainers,
      ...endgameTrainers,
      ...THORNVEIL.trainers,
    },
    maps,
    npcs: { ...npcs, ...endgameNpcs, ...THORNVEIL.npcs },
    dialogues: {
      ...questDialogues,
      ...trialDialogues,
      ...verdaleDialogues,
      ...verdaleStoryDialogues,
      ...endgameDialogues,
      ...THORNVEIL.dialogues,
    },
    quests: { ...quests, ...verdaleQuests, ...endgameQuests },
    starts,
  },
});

export default corePack;
