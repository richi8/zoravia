/**
 * The `rimeholm` pack (C35): Region 3, the frozen archipelago of the Rimeholm Isles. Its map,
 * species, moves, traits, bosses, music, trainers, NPCs, campaign and start. It builds on `core`
 * (types, conditions, the moves and items every region shares) and attaches to Verdale's ferry.
 */

import { definePack } from '@engine/packs';
import { POLAR_DRIFT, polarDriftSpecies } from './polar-drift';
import { bosses } from './bosses';
import { modelKits } from './kits';
import { maps } from './maps';
import { moves } from './moves';
import { music } from './music';
import { serviceNpcs } from './npcs';
import { species } from './species';
import { starts } from './starts';
import { badges, quests, storyDialogues, storyNpcsAll, storyTrainers } from './story';
import { trainerDialogues, trainerNpcs, trainers } from './trainers';
import { traits } from './traits';

export const rimeholmPack = definePack({
  manifest: {
    id: 'rimeholm',
    version: '0.1.0',
    name: 'Rimeholm Isles',
    description: 'Region 3: the frozen archipelago of the Rimeholm Isles.',
    dependsOn: ['core@^0.1.0'],
  },
  content: {
    modelKits,
    species: { ...species, ...polarDriftSpecies },
    moves,
    traits,
    bosses: { ...bosses, ...POLAR_DRIFT.bosses },
    music,
    maps,
    badges,
    trainers: { ...trainers, ...storyTrainers, ...POLAR_DRIFT.trainers },
    npcs: { ...serviceNpcs, ...trainerNpcs, ...storyNpcsAll, ...POLAR_DRIFT.npcs },
    dialogues: { ...trainerDialogues, ...storyDialogues, ...POLAR_DRIFT.dialogues },
    quests,
    starts,
  },
});

export default rimeholmPack;
