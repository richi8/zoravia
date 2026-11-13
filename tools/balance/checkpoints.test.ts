/**
 * Debug checkpoints: every checkpoint, with every starter, is a valid save that starts on a
 * walkable tile in front of a center, ready for its fight, with that fight still waiting.
 */

import { describe, expect, it } from 'vitest';
import { loadGameContent } from '@game/data';
import { readSave, toSave } from '@game/save/codec';
import { holds, questStep } from '@game/story';
import { loadRegion } from '@game/world/map';
import { corePack } from '@packs/core';
import { CHECKPOINT_STARTERS, checkpointState, VERDALE_CHECKPOINTS } from './checkpoints';

const content = loadGameContent([corePack]);
const map = loadRegion(content, 'core:verdale');

/** The NPC that starts each checkpoint's fight. */
const FIGHT_NPC: Record<string, string> = {
  'core:apprentice-linden': 'core:apprentice-linden',
  'core:bogmaw-titan': 'core:bogmaw-titan-lair',
  'core:mossback-titan': 'core:mossback-titan-lair',
  'core:mira-galecrest': 'core:mira-galecrest',
  'core:stormcatcher-vex': 'core:stormcatcher-vex',
  'core:verdion': 'core:verdion-lair',
};

describe('Verdale checkpoints', () => {
  for (const point of VERDALE_CHECKPOINTS) {
    it(`${point.label}: a valid save, ready for its fight`, () => {
      for (const starter of CHECKPOINT_STARTERS) {
        const state = checkpointState(content, point, starter);
        // Survives the save format (schema, references, migration).
        const back = readSave(content, JSON.parse(JSON.stringify(toSave(content, state))));
        expect(back.party).toEqual(state.party);
        const { party, place } = state;
        expect(map.blocked(place.x, place.y)).toBe(false);
        expect(party.team).toHaveLength(3);
        expect(party.team.every((z) => z.hp > 0)).toBe(true);
        expect(party.trainers[point.goal]).toBeUndefined();
        expect(party.bosses[point.goal]).toBeUndefined();
        const npc = content.npcs.require(FIGHT_NPC[point.goal] ?? '');
        expect(!npc.when || holds(content, party, npc.when), npc.id).toBe(true);
        expect(questStep(party, 'core:still-wind')).toBeDefined();
      }
    });
  }

  it('moves the main quest on to match the party', () => {
    const at = (label: string): string | undefined => {
      const point = VERDALE_CHECKPOINTS.find((p) => p.label === label);
      if (!point) throw new Error(label);
      const state = checkpointState(content, point, CHECKPOINT_STARTERS[0] ?? '');
      return questStep(state.party, 'core:still-wind');
    };
    expect(at('Grove Trial')).toBe('grove-trial');
    expect(at('Bogmaw Titan')).toBe('titans');
    expect(at('Vex on Crown Rock')).toBe('crown-rock');
    expect(at('Verdion')).toBe('heartwood');
  });
});
