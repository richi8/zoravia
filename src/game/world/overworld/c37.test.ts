import { describe, expect, it } from 'vitest';
import { PixelBuffer } from '@engine/render/pixel-buffer';
import { loadGameContent } from '@game/data';
import { corePack } from '@packs/core';
import { BIOMES, TILE } from '../biomes';
import { loadRegion } from '../map';
import { along, boatFrame, drawWake, heading, RIDE, rideSeconds, voyage } from './boat';
import { DIRS, type Tile } from './mover';
import { ACTIVE_RANGE, OverworldSim } from './sim';
import { BIOME_WARP, biomeOwner, TerrainStream, warpedTile } from './stream';

const content = loadGameContent([corePack]);
const MAP = 'core:test-region';
const map = loadRegion(content, MAP);
const DT = 1 / 60;

describe('biome blending in the terrain stream (C37)', () => {
  // West of x = 44 is forest, east of it desert (the middle of the block at 40–47).
  const SEAM = 44;
  const field = (tx: number): (typeof BIOMES)['forest'] =>
    tx < SEAM ? BIOMES.forest : BIOMES.desert;

  it('bakes one biome away from the border and merges two along it', () => {
    const stream = new TerrainStream(map, (tx) => field(tx));
    stream.visible({ x: 8 * TILE, y: 40 * TILE, width: 1, height: 1 });
    expect(stream.mixed).toBe(0);
    const [block] = stream.visible({ x: 40 * TILE, y: 40 * TILE, width: 1, height: 1 });
    expect(stream.mixed).toBe(1);
    expect(block).toBeDefined();
    // The merged ground takes some pixels from a forest bake and some from a desert one.
    const at = { x: 40 * TILE, y: 40 * TILE, width: 1, height: 1 };
    const [f] = new TerrainStream(map, BIOMES.forest).visible(at);
    const [d] = new TerrainStream(map, BIOMES.desert).visible(at);
    let fromF = 0;
    let fromD = 0;
    const base = block?.bake.base ?? new Uint32Array();
    base.forEach((px, i) => {
      if (px && px === f?.bake.base[i] && px !== d?.bake.base[i]) fromF++;
      if (px && px === d?.bake.base[i] && px !== f?.bake.base[i]) fromD++;
    });
    expect(fromF).toBeGreaterThan(100);
    expect(fromD).toBeGreaterThan(100);
  });

  it('lets the border wander off the tile grid, but never farther than the warp', () => {
    let off = 0;
    for (let i = 0; i < 2000; i++) {
      const wx = (i * 97) % 4000;
      const wy = (i * 61) % 4000;
      const [tx, ty] = warpedTile(wx, wy, 5);
      const reach = Math.ceil((BIOME_WARP * 1.05) / TILE) + 1;
      expect(Math.abs(tx - Math.floor(wx / TILE))).toBeLessThanOrEqual(reach);
      expect(Math.abs(ty - Math.floor(wy / TILE))).toBeLessThanOrEqual(reach);
      if (tx !== Math.floor(wx / TILE)) off++;
    }
    expect(off).toBeGreaterThan(200);
    expect(warpedTile(123, 456, 9)).toEqual(warpedTile(123, 456, 9));
  });

  it('never turns water to lava on a wet tile', () => {
    const rect = { x: SEAM - 4, y: 40, width: 8, height: 8 };
    const biomes = [BIOMES.forest, BIOMES.desert];
    const dry = biomeOwner(rect, biomes, (tx) => field(tx), 3);
    const wet = biomeOwner(
      rect,
      biomes,
      (tx) => field(tx),
      3,
      () => true,
    );
    const W = rect.width * TILE;
    let moved = 0;
    for (let i = 0; i < wet.length; i++) {
      const tx = rect.x + Math.floor((i % W) / TILE);
      // On wet tiles every pixel keeps its own tile's biome.
      expect(wet[i]).toBe(tx < SEAM ? 0 : 1);
      if (dry[i] !== wet[i]) moved++;
    }
    expect(moved).toBeGreaterThan(0);
  });
});

describe('ferry boat (C37)', () => {
  it('draws the rowboat for every heading, oars swinging', () => {
    for (const dir of DIRS) {
      const a = boatFrame(dir, 0);
      const b = boatFrame(dir, 0.25);
      expect(a.data.some((p) => p !== 0)).toBe(true);
      expect(a.data).not.toEqual(b.data);
      // The bow lies in the heading's direction from the middle.
      if (dir === 'down') expect(a.bow.y).toBeGreaterThan(0);
      if (dir === 'up') expect(a.bow.y).toBeLessThan(0);
      if (dir === 'right') expect(a.bow.x).toBeGreaterThan(0);
      if (dir === 'left') expect(a.bow.x).toBeLessThan(0);
      expect(boatFrame(dir, 0)).toBe(a);
    }
  });

  it('follows a route at any distance and heads along its larger axis', () => {
    const route: Tile[] = [
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 6, y: 10 },
    ];
    const v = voyage(route);
    expect(v.length).toBe(16 * TILE);
    expect(along(v, 0)).toEqual({ x: 8, y: 8, dir: 'down' });
    expect(along(v, 5 * TILE)).toEqual({ x: 8, y: 8 + 5 * TILE, dir: 'down' });
    expect(along(v, 12 * TILE)).toEqual({ x: 8 + 2 * TILE, y: 8 + 10 * TILE, dir: 'right' });
    expect(along(v, 99 * TILE)).toEqual({ x: 8 + 6 * TILE, y: 8 + 10 * TILE, dir: 'right' });
    expect(heading({ x: 0, y: 0 }, { x: -1, y: -5 })).toBe('up');
    expect(heading({ x: 0, y: 0 }, { x: -5, y: 1 })).toBe('left');
  });

  it('takes 10–15 s whatever the route', () => {
    const short = voyage([
      { x: 0, y: 0 },
      { x: 0, y: 2 },
    ]);
    const long = voyage([
      { x: 0, y: 0 },
      { x: 0, y: 200 },
    ]);
    const mid = voyage([
      { x: 0, y: 0 },
      { x: 0, y: 24 },
    ]);
    expect(rideSeconds(short)).toBe(RIDE.min);
    expect(rideSeconds(long)).toBe(RIDE.max);
    expect(rideSeconds(mid)).toBe(12);
  });

  it('paints a wake behind a moving boat and ripples around a docked one', () => {
    for (const moving of [true, false]) {
      const buf = new PixelBuffer(200, 200);
      drawWake(buf, 100, 100, 'down', 1, moving);
      expect(buf.data.some((p) => p !== 0)).toBe(true);
    }
    // Moving down, the wake trails above the boat.
    const buf = new PixelBuffer(200, 200);
    drawWake(buf, 100, 150, 'down', 1, true);
    let above = 0;
    let below = 0;
    buf.data.forEach((p, i) => {
      if (!p) return;
      if (Math.floor(i / 200) < 150) above++;
      else below++;
    });
    expect(above).toBeGreaterThan(below * 4);
  });
});

describe('NPCs far from the player wait (C37)', () => {
  it('moves only NPCs within the active range', () => {
    const wanderer = content.npcs.values().find((n) => n.behavior.kind === 'wander');
    expect(wanderer).toBeDefined();
    if (!wanderer) return;
    const near = { npc: wanderer, x: 20, y: 20, facing: 'down' as const };
    const sim = new OverworldSim({
      content,
      mapId: MAP,
      map,
      seed: 3,
      start: { x: 20 + ACTIVE_RANGE + 6, y: 20 },
      npcs: [near],
    });
    const npc = sim.allNpcs[0];
    const view = { x: 20 + ACTIVE_RANGE, y: 12, width: 30, height: 17 };
    for (let i = 0; i < 60 * 30; i++) sim.update(DT, () => undefined, view);
    expect([npc?.mover.tx, npc?.mover.ty]).toEqual([20, 20]);
    // Close by, it wanders again.
    sim.player.place({ x: 24, y: 20 }, 'left');
    const tiles = new Set<string>();
    for (let i = 0; i < 60 * 30; i++) {
      sim.update(DT, () => undefined, { x: 10, y: 12, width: 30, height: 17 });
      tiles.add(`${npc?.mover.tx},${npc?.mover.ty}`);
    }
    expect(tiles.size).toBeGreaterThan(1);
  });
});
