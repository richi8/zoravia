/**
 * Trainers who spot the player (C36d): which NPCs look out for the player, and how far.
 * Pure: the overworld sim walks the line of sight (`OverworldSim.spotter`).
 *
 * Only route trainers spot: NPCs whose Atlas mark is `trainer` (their own, or derived from a
 * trainer battle in their dialogue) while none of their trainers is beaten. Trial masters,
 * rivals, bosses, Titans, legendaries, objects and NPCs without a battle never do. Nothing is
 * saved: it reads the trainers already beaten.
 */

import type { GameContent, NpcData } from '@game/data';
import { npcMark } from './atlas';
import { npcBattles } from './explore';

/** Tiles a route trainer sees straight ahead when its NPC sets no `sight`. */
export const TRAINER_SIGHT = 4;

/** How far an NPC spots the player now; 0 when it never does. */
export function trainerSight(
  content: GameContent,
  n: NpcData,
  beaten: Readonly<Record<string, unknown>>,
): number {
  if (n.object || n.zorling || n.role) return 0;
  if (npcMark(content, n) !== 'trainer') return 0;
  const { trainers, bosses } = npcBattles(content, n.dialogue);
  if (!trainers.length || bosses.length) return 0;
  if (trainers.some((t) => t in beaten)) return 0;
  return n.sight ?? TRAINER_SIGHT;
}
