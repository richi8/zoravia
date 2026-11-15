import { describe, expect, it } from 'vitest';
import { Rng } from '@engine/core/rng';
import { definePack } from '@engine/packs';
import { loadGameContent } from '@game/data';
import { corePack } from '@packs/core';
import { SHIPPED_PACKS } from '@packs/index';
import { loadRegion } from './map';
import { npcMark } from './atlas';
import { Roamer, type NpcActor } from './overworld/actors';
import type { Tile } from './overworld/mover';
import { OverworldSim } from './overworld/sim';
import { trainerSight, TRAINER_SIGHT } from './sight';

const DT = 1 / 60;
const MAP = 'core:test-region';
const base = loadRegion(loadGameContent([corePack]), MAP);

/** A walkable tile with `n` walkable tiles to its right, away from every core NPC. */
function openRow(n: number): Tile {
  for (let y = 2; y < base.height - 2; y++) {
    for (let x = 2; x < base.width - n - 2; x++) {
      let ok = true;
      for (let i = 0; i <= n && ok; i++)
        ok = !base.blocked(x + i, y) && !base.blocked(x + i, y + 1);
      if (ok && x > 20) return { x, y };
    }
  }
  throw new Error('No open row');
}

const at = openRow(7);
const watcherPack = definePack({
  manifest: { id: 'mod', version: '1.0.0', dependsOn: ['core'] },
  content: {
    npcs: {
      watcher: { name: 'Watcher', map: MAP, x: at.x, y: at.y, facing: 'right', lines: ['Hi'] },
    },
  },
});
const content = loadGameContent([corePack, watcherPack]);
const map = loadRegion(content, MAP);

function setup(): { sim: OverworldSim; watcher: NpcActor } {
  const sim = new OverworldSim({ content, mapId: MAP, map, seed: 3, start: { x: 1, y: 1 } });
  const watcher = sim.npcs.find((n) => n.npc.id === 'mod:watcher') as NpcActor;
  // Only the watcher looks out for the player.
  sim.present((n) => n.id === 'mod:watcher');
  return { sim, watcher };
}

const sees =
  (watcher: NpcActor, range = 4) =>
  (npc: NpcActor): number =>
    npc === watcher ? range : 0;

describe('trainer line of sight (C36d)', () => {
  it('spots the player straight ahead within range, and walks to the tile before them', () => {
    const { sim, watcher } = setup();
    const spot = sim.spotter({ x: at.x + 3, y: at.y }, sees(watcher));
    expect(spot?.npc).toBe(watcher);
    expect(spot?.stop).toEqual({ x: at.x + 2, y: at.y });
    // Right next to it: no walk.
    expect(sim.spotter({ x: at.x + 1, y: at.y }, sees(watcher))?.stop).toEqual(at);
  });

  it('does not see beyond its range, behind it or to the side', () => {
    const { sim, watcher } = setup();
    expect(sim.spotter({ x: at.x + 5, y: at.y }, sees(watcher))).toBeUndefined();
    expect(sim.spotter({ x: at.x + 5, y: at.y }, sees(watcher, 5))).toBeDefined();
    expect(sim.spotter({ x: at.x - 1, y: at.y }, sees(watcher))).toBeUndefined();
    expect(sim.spotter({ x: at.x + 2, y: at.y + 1 }, sees(watcher))).toBeUndefined();
    expect(sim.spotter({ x: at.x + 2, y: at.y }, sees(watcher, 0))).toBeUndefined();
  });

  it('is blocked by a Zorling (or NPC) in the line, and does not look while talking', () => {
    const { sim, watcher } = setup();
    const wild = new Roamer(
      1,
      'core:sproutle',
      3,
      'z',
      { x: at.x + 2, y: at.y },
      'calm',
      new Rng(1),
    );
    sim.roamers.push(wild);
    expect(sim.spotter({ x: at.x + 3, y: at.y }, sees(watcher))).toBeUndefined();
    sim.roamers.length = 0;
    watcher.talking = true;
    expect(sim.spotter({ x: at.x + 3, y: at.y }, sees(watcher))).toBeUndefined();
  });

  it('walks up to the player and back home on a scripted walk', () => {
    const { sim, watcher } = setup();
    sim.player.place({ x: at.x + 4, y: at.y });
    const stop = sim.spotter(sim.player.destination, sees(watcher))?.stop as Tile;
    watcher.walkTo(stop, 3);
    expect(watcher.walking).toBe(true);
    // Not looking while it walks.
    expect(sim.spotter(sim.player.destination, sees(watcher))).toBeUndefined();
    for (let i = 0; i < 120; i++)
      sim.update(DT, () => undefined, { x: 0, y: 0, width: 40, height: 30 });
    expect(watcher.walking).toBe(false);
    expect(watcher.mover.destination).toEqual({ x: at.x + 3, y: at.y });
    watcher.goHome();
    for (let i = 0; i < 180; i++)
      sim.update(DT, () => undefined, { x: 0, y: 0, width: 40, height: 30 });
    expect(watcher.mover.destination).toEqual(at);
    expect(watcher.mover.facing).toBe('right');
  });
});

describe('trainerSight (C36d)', () => {
  const all = loadGameContent([...SHIPPED_PACKS]);
  const npc = (id: string) => all.npcs.require(id);

  it('is the default range for a route trainer not beaten, and 0 once beaten', () => {
    expect(trainerSight(all, npc('core:picnicker-nell'), {})).toBe(TRAINER_SIGHT);
    expect(
      trainerSight(all, npc('core:picnicker-nell'), { 'core:picnicker-nell': { wins: 1 } }),
    ).toBe(0);
  });

  it('is 0 for trial masters, rivals, bosses, Titans, legendaries and plain NPCs', () => {
    for (const n of all.npcs.values()) {
      if (npcMark(all, n) === 'trainer') continue;
      expect(trainerSight(all, n, {}), n.id).toBe(0);
    }
    expect(trainerSight(all, npc('core:rival-mira'), {})).toBe(0);
    expect(trainerSight(all, npc('core:trial-fern'), {})).toBe(0);
  });

  it('uses the NPC sight, and 0 turns it off', () => {
    const n = npc('core:picnicker-nell');
    expect(trainerSight(all, { ...n, sight: 6 }, {})).toBe(6);
    expect(trainerSight(all, { ...n, sight: 0 }, {})).toBe(0);
  });
});
