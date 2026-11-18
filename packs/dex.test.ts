/**
 * A Dex you can finish (C42): over every shipped pack, each species can be obtained in one
 * save, through a wild spawn, a boss capture, or evolving one of those. The starter the player
 * picks does not count, so the two left behind must be out there too. A new pack is checked by
 * being shipped.
 */

import { describe, expect, it } from 'vitest';
import { eachCondition, loadGameContent, type StoryCondition } from '@game/data';
import { newParty, type Party } from '@game/player';
import { createZorling } from '@game/progression';
import { DialogueRun } from '@game/story';
import { atlasMaps } from '@game/world/atlas';
import { npcBattles } from '@game/world/explore';
import { SHIPPED_PACKS } from '@packs/index';

const content = loadGameContent([...SHIPPED_PACKS]);
/** The maps of the world (the test region is a debug map). */
const worldMaps = new Set(atlasMaps(content));

/** Badges some dialogue gives. */
const givenBadges = new Set<string>(
  content.dialogues
    .values()
    .flatMap((d) => Object.values(d.nodes).flatMap((n) => n.do ?? []))
    .flatMap((a) => ('badge' in a ? [a.badge] : [])),
);

/** A spawn condition a save can reach: only badges the story gives (C42 uses nothing else). */
const reachable = (c: StoryCondition): boolean =>
  eachCondition(c).every((x) => {
    if ('badge' in x) return givenBadges.has(x.badge);
    return 'all' in x;
  });

function sources(): Map<string, string> {
  const how = new Map<string, string>();
  for (const id of worldMaps) {
    const m = content.maps.require(id);
    for (const [key, z] of Object.entries(m.zones)) {
      for (const s of z.spawns) {
        if (s.if && !reachable(s.if)) continue;
        if (!how.has(s.species)) how.set(s.species, `wild in ${id} ${key}`);
      }
    }
  }
  for (const n of content.npcs.values()) {
    if (!worldMaps.has(n.map)) continue;
    for (const b of npcBattles(content, n.dialogue).bosses) {
      const species = content.bosses.require(b).species;
      if (!how.has(species)) how.set(species, `boss ${b}`);
    }
  }
  // Evolving what can be caught.
  let grew = true;
  while (grew) {
    grew = false;
    for (const s of content.species.values()) {
      const into = s.evolution?.into;
      if (into && how.has(s.id) && !how.has(into)) {
        how.set(into, `evolves from ${s.id}`);
        grew = true;
      }
    }
  }
  return how;
}

describe('a Dex you can finish (C42)', () => {
  it('every species of every shipped pack can be obtained in one save', () => {
    const how = sources();
    const missing = content.species
      .values()
      .map((s) => s.id)
      .filter((id) => !how.has(id));
    expect(missing).toEqual([]);
  });

  it('every starter of every start region spawns somewhere (the ones not picked)', () => {
    const how = sources();
    for (const start of content.starts.values()) {
      for (const s of start.starters) expect(how.get(s.species), s.species).toMatch(/^wild /);
    }
  });

  it('a hub-town kid in each region mentions the starters after its badge, not before', () => {
    const kids = {
      'core:tam': ['core:grove-badge', /Sunny Meadow/],
      'emberwaste:juna': ['emberwaste:kiln-badge', /Sunbaked Flats/],
      'rimeholm:little-kari': ['rimeholm:tide-badge', /Shingle Shore/],
    } as const;
    const base = newParty({
      team: [createZorling(content, { uid: 'a', species: 'core:sproutle', level: 10 })],
    });
    const firstPage = (npc: string, party: Party): string => {
      const run = new DialogueRun(content, content.npcs.require(npc).dialogue ?? '', party);
      return run.view?.pages[0] ?? '';
    };
    for (const [npc, [badge, place]] of Object.entries(kids)) {
      expect(firstPage(npc, base), npc).not.toMatch(place);
      expect(firstPage(npc, { ...base, badges: [badge] }), npc).toMatch(place);
    }
  });
});
