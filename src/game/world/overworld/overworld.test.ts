import { describe, expect, it } from 'vitest';
import { loadGameContent } from '@game/data';
import { corePack } from '@packs/core';
import { BIOMES, TILE } from '../biomes';
import { loadRegion } from '../map';
import { bakeTerrain } from '../terrain';
import { Camera } from './camera';
import {
  buildCharacterFrame,
  buildCharacterSheet,
  CHARACTER_H,
  CHARACTER_W,
  PLAYER_OUTFIT,
  walkFrame,
} from './character-sprite';
import { GridMover, TURN_DELAY, WALK_SPEED, type Dir, type MoveEvent } from './mover';
import { findPath, pathToward } from './path';
import { BLOCK, TerrainStream } from './stream';

const DT = 1 / 60;
const open = (_x: number, _y: number): boolean => false;
const hold = (dir: Dir) => () => ({ dir });
const none = () => undefined;

function run(
  m: GridMover,
  frames: number,
  intent: Parameters<GridMover['update']>[1],
  blocked = open,
): MoveEvent[] {
  const out: MoveEvent[] = [];
  for (let i = 0; i < frames; i++) out.push(...m.update(DT, intent, blocked));
  return out;
}

describe('GridMover', () => {
  it('walks one tile per 16 frames at 3.75 tiles/s', () => {
    expect(WALK_SPEED).toBe(3.75);
    const m = new GridMover({ x: 5, y: 5 }, 'right');
    run(m, 1, hold('right'));
    expect(m.moving).toBe(true);
    run(m, 15, hold('right'));
    expect(m.tx).toBe(6);
    // Held: no pause between tiles; after 16 more frames we are on the next tile.
    run(m, 16, hold('right'));
    expect(m.tx).toBe(7);
    expect(m.moving).toBe(true);
  });

  it('moves smoothly between tiles', () => {
    const m = new GridMover({ x: 0, y: 0 }, 'down');
    run(m, 8, hold('down'));
    expect(m.y).toBeCloseTo(8 / 16, 6);
  });

  it('stops on the tile when released', () => {
    const m = new GridMover({ x: 0, y: 0 }, 'down');
    run(m, 4, hold('down'));
    run(m, 20, none);
    expect(m.moving).toBe(false);
    expect([m.tx, m.ty]).toEqual([0, 1]);
  });

  it('a tap toward a new direction only turns', () => {
    const m = new GridMover({ x: 3, y: 3 }, 'down');
    run(m, 2, hold('left'));
    run(m, 10, none);
    expect(m.facing).toBe('left');
    expect([m.tx, m.ty]).toEqual([3, 3]);
  });

  it('holding a new direction walks after the turn delay', () => {
    const m = new GridMover({ x: 3, y: 3 }, 'down');
    run(m, Math.ceil(TURN_DELAY / DT) + 2, hold('left'));
    expect(m.moving).toBe(true);
    expect(m.destination).toEqual({ x: 2, y: 3 });
  });

  it('click-to-move turns and walks at once', () => {
    const m = new GridMover({ x: 3, y: 3 }, 'down');
    run(m, 1, () => ({ dir: 'up', noTurnDelay: true }));
    expect(m.moving).toBe(true);
  });

  it('bumps into blocked tiles without moving', () => {
    const m = new GridMover({ x: 1, y: 1 }, 'up');
    const ev = run(m, 30, hold('up'), (x, y) => x === 1 && y === 0);
    expect([m.tx, m.ty]).toEqual([1, 1]);
    expect(m.bumping).toBe(true);
    expect(ev.filter((e) => e.kind === 'bump')).toHaveLength(1);
  });

  it('reports steps and arrivals', () => {
    const m = new GridMover({ x: 0, y: 0 }, 'right');
    const ev = run(m, 32, hold('right'));
    expect(
      ev.filter((e) => e.kind === 'arrive').map((e) => (e.kind === 'arrive' ? e.at.x : -1)),
    ).toEqual([1, 2]);
  });
});

describe('pathfinding', () => {
  // A wall at x = 3 with a gap at y = 4.
  const wall = (x: number, y: number): boolean =>
    x < 0 || y < 0 || x > 9 || y > 9 || (x === 3 && y !== 4);

  it('finds a shortest 4-way path around walls', () => {
    const p = findPath({ x: 0, y: 0 }, { x: 6, y: 0 }, wall);
    expect(p).toBeDefined();
    expect(p?.at(-1)).toEqual({ x: 6, y: 0 });
    expect(p?.length).toBe(6 + 8);
    expect(p?.some((t) => t.x === 3 && t.y === 4)).toBe(true);
    // Every step is one tile.
    let prev = { x: 0, y: 0 };
    for (const t of p ?? []) {
      expect(Math.abs(t.x - prev.x) + Math.abs(t.y - prev.y)).toBe(1);
      prev = t;
    }
  });

  it('returns undefined when unreachable or blocked, [] when already there', () => {
    const sealed = (x: number, y: number): boolean => wall(x, y) || (x === 3 && y === 4);
    expect(findPath({ x: 0, y: 0 }, { x: 6, y: 0 }, sealed)).toBeUndefined();
    expect(findPath({ x: 0, y: 0 }, { x: 3, y: 0 }, wall)).toBeUndefined();
    expect(findPath({ x: 2, y: 2 }, { x: 2, y: 2 }, wall)).toEqual([]);
  });

  it('prefers straight runs (few turns)', () => {
    const p = findPath({ x: 0, y: 0 }, { x: 4, y: 4 }, () => false) ?? [];
    let turns = 0;
    for (let i = 2; i < p.length; i++) {
      const a = p[i - 2];
      const b = p[i - 1];
      const c = p[i];
      if (a && b && c && (b.x - a.x !== c.x - b.x || b.y - a.y !== c.y - b.y)) turns++;
    }
    expect(turns).toBe(1);
  });

  it('a click on a blocked tile walks next to it', () => {
    const p = pathToward({ x: 0, y: 0 }, { x: 3, y: 0 }, wall);
    expect(p?.at(-1)).toEqual({ x: 2, y: 0 });
  });
});

describe('Camera', () => {
  const bounds = { width: 1000, height: 600 };

  it('eases toward the target and settles', () => {
    const c = new Camera();
    c.snap(240, 135, 480, 270, bounds);
    expect([c.x, c.y]).toEqual([0, 0]);
    c.follow(300, 200, 480, 270, bounds, DT);
    expect(c.x).toBeGreaterThan(0);
    expect(c.x).toBeLessThan(60);
    for (let i = 0; i < 300; i++) c.follow(300, 200, 480, 270, bounds, DT);
    expect([c.x, c.y]).toEqual([60, 65]);
  });

  it('stays inside the map and centers a small map', () => {
    const c = new Camera();
    c.snap(990, 590, 480, 270, bounds);
    expect([c.x, c.y]).toEqual([520, 330]);
    c.snap(10, 10, 480, 270, { width: 320, height: 200 });
    expect([c.x, c.y]).toEqual([-80, -35]);
  });

  it('jumps instead of easing across long distances', () => {
    const c = new Camera();
    c.snap(240, 135, 480, 270, bounds);
    c.follow(760, 400, 480, 270, bounds, DT);
    expect([c.x, c.y]).toEqual([520, 265]);
  });
});

describe('TerrainStream', () => {
  const content = loadGameContent([corePack]);
  const map = loadRegion(content, 'core:test-region');
  const biome = BIOMES[map.biome];

  it('bakes blocks that match a whole-area bake pixel for pixel', () => {
    const stream = new TerrainStream(map, biome);
    const s = map.anchors['spawn'] ?? { x: 48, y: 48 };
    const bx = Math.floor(s.x / BLOCK) * BLOCK;
    const by = Math.floor(s.y / BLOCK) * BLOCK;
    const [r] = stream.visible({ x: bx * TILE, y: by * TILE, width: 1, height: 1 });
    expect(r).toBeDefined();
    const whole = bakeTerrain(map.toTerrainMap(), biome, {
      x: bx - 4,
      y: by - 4,
      width: 16,
      height: 16,
    });
    const b = r?.bake;
    if (!b) return;
    let diff = 0;
    for (let y = 0; y < b.height; y++) {
      for (let x = 0; x < b.width; x++) {
        const i = (y + 4 * TILE) * whole.width + x + 4 * TILE;
        if (
          b.base[y * b.width + x] !== whole.base[i] ||
          b.overlay[y * b.width + x] !== whole.overlay[i]
        )
          diff++;
      }
    }
    expect(diff).toBe(0);
  });

  it('streams a bounded number of blocks around the view', () => {
    let t = 0;
    const stream = new TerrainStream(map, biome, () => (t += 1));
    const view = { x: 40 * TILE, y: 40 * TILE, width: 480, height: 270 };
    stream.visible(view);
    for (let i = 0; i < 60; i++) stream.prefetch(view, 1000);
    // View (≈ 5×4 blocks) + one block of margin, at most.
    expect(stream.size).toBeLessThanOrEqual(7 * 6);
    const far = { x: 0, y: 0, width: 480, height: 270 };
    stream.visible(far);
    stream.prefetch(far, 0);
    for (let i = 0; i < 60; i++) stream.prefetch(far, 1000);
    expect(stream.size).toBeLessThanOrEqual(8 * 7);
  });

  it('reports props in front of an entity', () => {
    const stream = new TerrainStream(map, biome);
    const tree = map.props.find((p) => p.kind === 'tree' && p.tx > 4 && p.ty > 4);
    expect(tree).toBeDefined();
    if (!tree) return;
    const view = {
      x: (tree.tx - 2) * TILE,
      y: (tree.ty - 3) * TILE,
      width: 5 * TILE,
      height: 5 * TILE,
    };
    stream.visible(view);
    // Find a canopy pixel in the tile above the trunk.
    let hit: [number, number] | undefined;
    for (let y = (tree.ty - 1) * TILE; y < tree.ty * TILE && !hit; y++)
      for (let x = tree.tx * TILE; x < (tree.tx + 1) * TILE && !hit; x++)
        if (stream.occludes(x, y, (tree.ty - 1) * TILE + 14)) hit = [x, y];
    expect(hit).toBeDefined();
    // An entity standing below the tree is in front of it.
    if (hit) expect(stream.occludes(hit[0], hit[1], (tree.ty + 1) * TILE + 14)).toBe(false);
  });
});

describe('character sprite', () => {
  it('builds 4 facings × 4 frames at 16×24', () => {
    const sheet = buildCharacterSheet(PLAYER_OUTFIT);
    for (const d of ['down', 'up', 'left', 'right'] as const) {
      expect(sheet[d]).toHaveLength(4);
      for (const f of sheet[d]) expect([f.width, f.height]).toEqual([CHARACTER_W, CHARACTER_H]);
    }
  });

  it('keeps the face identical across a facing’s frames (only the body bobs)', () => {
    for (const d of ['down', 'right'] as const) {
      const a = buildCharacterFrame(PLAYER_OUTFIT, d, 0);
      const b = buildCharacterFrame(PLAYER_OUTFIT, d, 2);
      const step = buildCharacterFrame(PLAYER_OUTFIT, d, 1);
      // Stand frames share the head rows exactly; a step frame is the same head one row lower.
      const rows = (f: typeof a, y0: number) =>
        Array.from(f.data.subarray(y0 * 16, (y0 + 10) * 16));
      expect(rows(b, 0)).toEqual(rows(a, 0));
      expect(rows(step, 1)).toEqual(rows(a, 0));
    }
  });

  it('left is the mirror of right', () => {
    const r = buildCharacterFrame(PLAYER_OUTFIT, 'right', 1);
    const l = buildCharacterFrame(PLAYER_OUTFIT, 'left', 1);
    for (let y = 0; y < CHARACTER_H; y++)
      for (let x = 0; x < CHARACTER_W; x++)
        expect(l.data[y * 16 + x]).toBe(r.data[y * 16 + (15 - x)]);
  });

  it('cycles stand, step, stand, other step over two tiles', () => {
    expect(walkFrame(3, false)).toBe(0);
    expect([0, 0.5, 1, 1.5].map((w) => walkFrame(w, true))).toEqual([1, 2, 3, 0]);
  });
});
