/**
 * Region generator (offline, run once per region): seeded noise → a base map in the
 * region's biome. Same config → same map, byte for byte.
 *
 * Layout:
 * - A hub town near the middle: a cleared plaza with the spawn and center anchors.
 * - Tiers as rings around the hub (warped by noise); zones of one tier split their ring
 *   into sectors. Town tiles belong to no zone.
 * - Paths from the hub to an exit on each configured edge; lakes, lava or sea never cut a
 *   path, and nothing solid stands on one, so every exit is reachable from the spawn.
 * - Lakes / lava pools / a sea coast (frozen) from low noise, second ground from high noise.
 * - Props and tall grass by per-biome rules, denser in outer tiers; a ring of solid props
 *   (trees, rocks) closes the map edges except where paths leave.
 */

import { fbm, hash2 } from '@engine/core/noise';
import { TILE_TALL, TIER_LEVELS, TIERS, type Tier } from '@game/data/maps';
import type { BiomeId } from '@game/world/biomes';
import type { PropKind } from '@game/world/props';
import type { PropPlacement } from '@game/world/terrain';
import { WorldMap, type Zone } from '@game/world/map';
import type { Exit, RegionConfig } from './config';
import { generateLayout } from './layout';

type Pt = readonly [number, number];

/** Hub plaza radius (tiles) and the town area that has no zone. */
const PLAZA = 3.2;
const TOWN = 6.5;
/** Half width of a path (corners) and the cleared band around it. */
const PATH_HALF = 0.95;
const PATH_CLEAR = 2.6;
/** Solid border thickness (tiles). */
export const BORDER = 2;

export interface BiomeRules {
  /** Lake noise below this is liquid. */
  readonly lakes: number;
  /** Frozen coast: sea on the east side. */
  readonly coast?: boolean;
  /** Alt ground noise above this. */
  readonly alt: number;
  /** Solid prop that clusters (forests) and lines the border. */
  readonly tree: PropKind;
  /** Walkable prop on a ford's water tiles (C35; default lily pads). */
  readonly ford?: PropKind;
  /** Tall-grass noise above this (minus a bit per tier). */
  readonly grass: number;
  decorate(c: DecorCtx): PropKind | 'tall' | undefined;
}

export interface DecorCtx {
  readonly wet: boolean;
  readonly onAlt: boolean;
  readonly h: number;
  readonly cluster: number;
  readonly grass: number;
  readonly ring: number;
}

export const RULES: Readonly<Record<BiomeId, BiomeRules>> = {
  forest: {
    lakes: 0.33,
    alt: 0.6,
    tree: 'tree',
    grass: 0.6,
    decorate: (c) => {
      if (c.wet) return c.h < 0.08 ? 'pad' : undefined;
      if (c.cluster > 0.62 - c.ring * 0.04 && c.h < 0.8) return 'tree';
      if (c.grass) return 'tall';
      if (c.h < 0.025) return 'rock';
      if (c.h < 0.06) return 'bush';
      if (c.h < 0.15) return 'flowers';
      return undefined;
    },
  },
  desert: {
    lakes: 0.28,
    alt: 0.62,
    tree: 'rock',
    grass: 0.64,
    decorate: (c) => {
      if (c.wet) return undefined;
      if (c.onAlt) {
        if (c.h < 0.08) return 'crystal';
        if (c.h < 0.11) return 'vent';
        if (c.h < 0.18) return 'rock';
        return undefined;
      }
      if (c.h < 0.05) return 'cactus';
      if (c.cluster > 0.64 && c.h < 0.35) return 'rock';
      if (c.grass) return 'tall';
      if (c.h < 0.09) return 'shrub';
      return undefined;
    },
  },
  frozen: {
    lakes: 0.3,
    coast: true,
    alt: 0.58,
    tree: 'pine',
    ford: 'floe',
    grass: 0.64,
    decorate: (c) => {
      if (c.wet) return c.h < 0.06 ? 'floe' : undefined;
      if (c.onAlt) return c.h < 0.07 ? 'crystal' : undefined;
      if (c.cluster > 0.58 - c.ring * 0.04 && c.h < 0.8) return 'pine';
      if (c.grass) return 'tall';
      if (c.h < 0.05) return 'snowrock';
      return undefined;
    },
  },
};

/** Distance from a point to a polyline. */
export function lineDist(px: number, py: number, pts: readonly Pt[]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i] ?? [0, 0];
    const [bx, by] = pts[i + 1] ?? [0, 0];
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy || 1;
    const t = Math.min(Math.max(((px - ax) * dx + (py - ay) * dy) / len, 0), 1);
    best = Math.min(best, Math.hypot(px - ax - dx * t, py - ay - dy * t));
  }
  return best;
}

/** Glyph for each zone: first free letter of its key, then digits. */
export function glyphs(keys: readonly string[]): string[] {
  const used = new Set<string>();
  return keys.map((k) => {
    const pick = [...k.replace(/[^a-z0-9]/g, ''), ...'abcdefghijklmnopqrstuvwxyz0123456789'].find(
      (c) => !used.has(c),
    );
    if (!pick) throw new Error('Too many zones (at most 36)');
    used.add(pick);
    return pick;
  });
}

/** Where a path leaves the map on an edge (a tile on the border). */
function exitPoint(exit: Exit, hub: Pt, w: number, h: number, s: number): Pt {
  const j = (n: number, span: number): number => Math.round((hash2(n, 3, s) - 0.5) * span);
  const [hx, hy] = hub;
  const clampX = (x: number): number => Math.min(Math.max(x, BORDER + 3), w - BORDER - 4);
  const clampY = (y: number): number => Math.min(Math.max(y, BORDER + 3), h - BORDER - 4);
  switch (exit) {
    case 'north':
      return [clampX(hx + j(1, w * 0.3)), 0];
    case 'south':
      return [clampX(hx + j(2, w * 0.3)), h - 1];
    case 'west':
      return [0, clampY(hy + j(3, h * 0.3))];
    case 'east':
      return [w - 1, clampY(hy + j(4, h * 0.3))];
  }
}

/** A wobbly polyline from the hub to an exit tile (corner units), leaving through the edge. */
function pathLine(from: Pt, exit: Exit, to: Pt, size: Pt, s: number, n: number): Pt[] {
  const [ax, ay] = from;
  const bx = to[0] + 0.5;
  const by = to[1] + 0.5;
  const len = Math.hypot(bx - ax, by - ay);
  const nx = -(by - ay) / (len || 1);
  const ny = (bx - ax) / (len || 1);
  const steps = Math.max(2, Math.round(len / 8));
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const wob =
      i === 0 || i === steps ? 0 : (fbm(t * 3, n * 1.7, s + 21) - 0.5) * Math.min(len * 0.35, 14);
    pts.push([ax + (bx - ax) * t + nx * wob, ay + (by - ay) * t + ny * wob]);
  }
  const [w, h] = size;
  const out: Record<Exit, Pt> = {
    north: [bx, -2],
    south: [bx, h + 2],
    west: [-2, by],
    east: [w + 2, by],
  };
  pts.push(out[exit]);
  return pts;
}

export function generateRegion(cfg: RegionConfig): WorldMap {
  if (cfg.layout) return generateLayout(cfg, cfg.layout);
  const { width: W, height: H, seed: s } = cfg;
  const rules = RULES[cfg.biome];
  const m = new WorldMap({ ...cfg });

  // Zones (geometry only; levels default to the tier's range, spawns come from the overlay).
  const keys = Object.keys(cfg.zones);
  const glyph = glyphs(keys);
  m.zones = keys.map((key, i): Zone => {
    const z = cfg.zones[key] ?? { name: key, tier: 't1' as Tier };
    const [lo, hi] = TIER_LEVELS[z.tier];
    return {
      key,
      name: z.name,
      glyph: glyph[i] ?? 'a',
      tier: z.tier,
      levels: [lo, hi],
      spawns: [],
    };
  });
  const tiers = TIERS.filter((t) => m.zones.some((z) => z.tier === t));

  const hub: Pt = [
    Math.round(W / 2 + (hash2(1, 1, s) - 0.5) * W * 0.12),
    Math.round(H / 2 + (hash2(2, 1, s) - 0.5) * H * 0.12),
  ];
  const [hx, hy] = hub;
  const centre: Pt = [hx + 0.5, hy + 0.5];
  const ring = (x: number, y: number): number =>
    Math.hypot((x - hx) / (W / 2), (y - hy) / (H / 2)) +
    (fbm(x * 0.05, y * 0.05, s + 1) - 0.5) * 0.3;
  const tierIndex = (x: number, y: number): number =>
    Math.min(tiers.length - 1, Math.max(0, Math.floor(ring(x, y) * tiers.length)));

  // Paths.
  const exits = cfg.exits.map((e) => ({ exit: e, at: exitPoint(e, hub, W, H, s) }));
  const lines = exits.map((e, n) => pathLine(centre, e.exit, e.at, [W, H], s, n + 1));
  const pathDist = (x: number, y: number): number =>
    Math.min(...lines.map((l) => lineDist(x, y, l)));
  const plaza = (x: number, y: number): number => Math.hypot(x - centre[0], y - centre[1]);

  // Corner layers.
  for (let cy = 0; cy <= H; cy++) {
    for (let cx = 0; cx <= W; cx++) {
      const pd = pathDist(cx, cy);
      const pz = plaza(cx, cy);
      const isPath = pd < PATH_HALF + (fbm(cx * 0.3, cy * 0.3, s + 7) - 0.5) * 0.3 || pz < PLAZA;
      m.path.set(cx, cy, isPath);
      const clear = pd < PATH_CLEAR || pz < TOWN;
      const lake =
        fbm(cx * 0.045, cy * 0.045, s + 2) + (fbm(cx * 0.2, cy * 0.2, s + 3) - 0.5) * 0.08;
      const coast =
        rules.coast === true && cx + (fbm(cx * 0.06, cy * 0.06, s + 4) - 0.5) * 18 > W * 0.84;
      m.liquid.set(cx, cy, !clear && (lake < rules.lakes || coast));
      m.alt.set(cx, cy, fbm(cx * 0.07, cy * 0.07, s + 5) > rules.alt);
    }
  }

  // Tiles: zones, props, tall grass.
  const props: PropPlacement[] = [];
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      const i = ty * W + tx;
      const x = tx + 0.5;
      const y = ty + 0.5;
      const town = plaza(x, y) < TOWN;
      const ti = tierIndex(x, y);
      if (!town) {
        const tier = tiers[ti];
        const inTier = m.zones.filter((z) => z.tier === tier);
        const angle =
          (Math.atan2(y - hy, x - hx) / (Math.PI * 2) +
            1 +
            hash2(ti, 9, s) +
            (fbm(x * 0.04, y * 0.04, s + 8) - 0.5) * 0.15) %
          1;
        const z = inTier[Math.min(inTier.length - 1, Math.floor(angle * inTier.length))];
        m.zoneIndex[i] = z ? m.zoneSlot(z.key) : 0;
      }
      const liquid = m.liquidCorners(tx, ty);
      const onPath =
        m.path.get(tx, ty) +
          m.path.get(tx + 1, ty) +
          m.path.get(tx, ty + 1) +
          m.path.get(tx + 1, ty + 1) >
        0;
      const nearPath = pathDist(x, y) < PATH_CLEAR - 0.6;
      if (onPath || town || nearPath) continue;
      const h1 = hash2(tx, ty, s + 11);
      const h2 = hash2(tx, ty, s + 12);
      const variant = Math.floor(h2 * 8);
      const dx = Math.floor(h2 * 5) - 2;
      const dy = Math.floor(hash2(tx, ty, s + 13) * 5) - 2;
      const edge = Math.min(tx, ty, W - 1 - tx, H - 1 - ty);
      if (edge < BORDER) {
        if (liquid < 4) props.push({ kind: rules.tree, tx, ty, variant, ...(dx ? { dx } : {}) });
        continue;
      }
      if (liquid > 0 && liquid < 4) continue;
      const kind = rules.decorate({
        wet: liquid === 4,
        onAlt:
          m.alt.get(tx, ty) +
            m.alt.get(tx + 1, ty) +
            m.alt.get(tx, ty + 1) +
            m.alt.get(tx + 1, ty + 1) ===
          4,
        h: h1,
        cluster: fbm(tx * 0.16, ty * 0.16, s + 31),
        grass: fbm(tx * 0.22, ty * 0.22, s + 41) > rules.grass - ti * 0.04 ? 1 : 0,
        ring: ti,
      });
      if (kind === 'tall') m.flags[i] = TILE_TALL;
      else if (kind) {
        const jitter = kind === 'tree' || kind === 'pine';
        props.push({
          kind,
          tx,
          ty,
          ...(variant ? { variant } : {}),
          ...(kind !== 'vent' && dx ? { dx } : {}),
          ...(jitter && dy ? { dy } : {}),
        });
      }
    }
  }
  m.props = props;

  // Anchors and connection points.
  m.anchors = {
    spawn: { x: hx, y: hy + 1, kind: 'spawn', facing: 'down' },
    center: { x: hx - 2, y: hy - 2, kind: 'center', facing: 'down' },
  };
  m.connections = Object.fromEntries(
    exits.map((e) => [e.exit, { x: e.at[0], y: e.at[1], kind: 'edge' as const }]),
  );
  m.refreshCollision();
  return m;
}
