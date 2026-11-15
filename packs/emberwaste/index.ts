/**
 * The `emberwaste` pack (C34): Region 2, a volcanic desert. Its map, species, moves, traits,
 * bosses, trainers, NPCs, campaign and start. It builds on `core` (types, conditions, the
 * moves and items every region shares) and attaches to Verdale's Ember Pass.
 */

import { definePack } from '@engine/packs';
import { ASHEN_RIFT, ashenRiftSpecies } from './ashen-rift';
import { bosses } from './bosses';
import { modelKits } from './kits';
import { maps } from './maps';
import { moves } from './moves';
import { serviceNpcs } from './npcs';
import { species } from './species';
import { badges, quests, storyDialogues, storyNpcsAll, storyTrainers } from './story';
import { trainerDialogues, trainerNpcs, trainers } from './trainers';
import { starts } from './starts';
import { traits } from './traits';

export const emberwastePack = definePack({
  manifest: {
    id: 'emberwaste',
    version: '0.1.0',
    name: 'Emberwaste',
    description: 'Region 2: the volcanic desert of Emberwaste.',
    dependsOn: ['core@^0.1.0'],
  },
  content: {
    modelKits,
    species: { ...species, ...ashenRiftSpecies },
    moves,
    traits,
    bosses: { ...bosses, ...ASHEN_RIFT.bosses },
    maps,
    badges,
    trainers: { ...trainers, ...storyTrainers, ...ASHEN_RIFT.trainers },
    npcs: { ...serviceNpcs, ...trainerNpcs, ...storyNpcsAll, ...ASHEN_RIFT.npcs },
    dialogues: { ...trainerDialogues, ...storyDialogues, ...ASHEN_RIFT.dialogues },
    quests,
    starts,
  },
});

export default emberwastePack;
