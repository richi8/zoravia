/**
 * A new game (C33): the state a save slot starts with for a start region and a starter. The
 * starter comes at the start's level with the start's bag and money, its flag is set (Rival
 * Mira reads it), and the player stands on the start's anchor.
 */

import type { GameContent } from '@game/data';
import { newParty } from '@game/player';
import { createZorling } from '@game/progression';
import type { GameState } from './codec';

export function newGameState(content: GameContent, startId: string, species: string): GameState {
  const start = content.starts.require(startId);
  const starter = start.starters.find((s) => s.species === species);
  if (!starter) throw new Error(`${species} is not a starter of ${startId}`);
  const map = content.maps.require(start.map);
  const spot = map.anchors[start.anchor];
  if (!spot) throw new Error(`No anchor "${start.anchor}" on ${start.map}`);
  const zorling = createZorling(content, { uid: 'starter', species, level: start.level });
  const party = newParty({ team: [zorling], bag: { ...start.bag }, money: start.money });
  return {
    party: { ...party, flags: { [starter.flag]: 1 } },
    place: { map: map.id, x: spot.x, y: spot.y, facing: spot.facing ?? 'down' },
    playtime: 0,
  };
}
