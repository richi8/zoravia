/**
 * Debug checkpoints (G2 prep): start Verdale at a later point of the campaign with the party
 * the playthrough simulator had there, so a playtester can try late content without
 * playing up to it. The party is the simulated player's own: team, levels, moves, bag,
 * money, badge, trainers and bosses beaten. The main quest is moved on to match. Side quests,
 * hidden items and flags of optional dialogue are left as on a new game.
 *
 * Used by the debug launcher only (loaded on demand). Pure.
 */

import type { GameContent } from '@game/data';
import { healTeam, type Party } from '@game/player';
import type { GameState, Place } from '@game/save/codec';
import { advanceQuests } from '@game/story';
import { legacyExploration } from '@game/world/explore';
import { loadRegion } from '@game/world/map';
import { playthrough } from './playthrough';
import { VERDALE_ROUTE, VERDALE_START, VERDALE_TEAMS } from './verdale';

export interface Checkpoint {
  readonly label: string;
  readonly hint: string;
  /** The story fight the party is ready for (the snapshot is taken just before it). */
  readonly goal: string;
  /** The Zorling center the player starts at (and wakes up at after a loss). */
  readonly center: string;
}

export const VERDALE_CHECKPOINTS: readonly Checkpoint[] = [
  {
    label: 'Grove Trial',
    hint: 'Lv ~12',
    goal: 'core:apprentice-linden',
    center: 'center-fernhollow',
  },
  { label: 'Bogmaw Titan', hint: 'Lv ~19', goal: 'core:bogmaw-titan', center: 'center-fernhollow' },
  {
    label: 'Mossback Titan',
    hint: 'Lv ~25',
    goal: 'core:mossback-titan',
    center: 'center-fernhollow',
  },
  {
    label: 'Mira in Galecrest',
    hint: 'Lv ~30',
    goal: 'core:mira-galecrest',
    center: 'center-galecrest',
  },
  {
    label: 'Vex on Crown Rock',
    hint: 'Lv ~40',
    goal: 'core:stormcatcher-vex',
    center: 'center-galecrest',
  },
  { label: 'Verdion', hint: 'Lv ~40', goal: 'core:verdion', center: 'center-fernhollow' },
];

/** The starters a checkpoint can be played with (each with its simulated team plan). */
export const CHECKPOINT_STARTERS: readonly string[] = VERDALE_TEAMS.map((t) => t.starter);

const MAP = 'core:verdale';
const MAIN_QUEST = 'core:still-wind';

/** A new save's state at this checkpoint, for the team plan of `starter`. */
export function checkpointState(
  content: GameContent,
  checkpoint: Checkpoint,
  starter: string,
  seed = 1,
): GameState {
  const plan = VERDALE_TEAMS.find((t) => t.starter === starter);
  if (!plan) throw new Error(`No team plan for "${starter}"`);
  const map = loadRegion(content, MAP);
  const run = playthrough(content, {
    route: VERDALE_ROUTE,
    zones: map.zones,
    ...VERDALE_START,
    ...plan,
    seed,
    snapshots: [checkpoint.goal],
  });
  const party = run.snapshots[checkpoint.goal];
  if (!party) throw new Error(`The simulated run never reached ${checkpoint.goal}`);
  const center = map.anchors[checkpoint.center];
  if (!center) throw new Error(`No anchor "${checkpoint.center}"`);
  // The healer stands at the anchor; the player stands in front, facing them.
  const place: Place = { map: MAP, x: center.x, y: center.y + 1, facing: 'up' };
  const quest = withMainQuest(content, party);
  // The map as a save from before exploration would show it (C36b).
  const explored = legacyExploration(
    content,
    { places: [place], trainers: quest.trainers, bosses: quest.bosses },
    (id) => loadRegion(content, id),
  );
  return { party: quest, place, respawn: place, playtime: 0, explored };
}

/** The main quest started (as if Elder Rowan was met) and moved on as far as it goes. */
function withMainQuest(content: GameContent, party: Party): Party {
  const started: Party = {
    ...party,
    quests: { ...party.quests, [MAIN_QUEST]: { state: 'active', step: 'grove-trial' } },
  };
  return healTeam(content, advanceQuests(content, started).party);
}
