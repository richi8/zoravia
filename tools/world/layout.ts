/**
 * Authored-layout generator (C28): the region's big shapes (towns, routes, rivers, lakes,
 * zone seeds, landmark clearings, exits) come from `region.json`'s `layout`; seeded noise only
 * adds the organic detail: wobbly edges, ponds, second ground, props and tall grass.
 *
 * - Routes become paths. Where a route crosses water it gets a bridge (walkable deck props).
 * - Fords become walkable lily pads.
 * - Towns and clearings are cleared ground without a zone (clearings keep their zone).
 * - Every tile outside a town joins the zone whose nearest seed is closest (noise-warped).
 * - The edge is closed by trees except at exits.
 * - Finally, walkable pockets the spawn cannot reach are opened by clearing the props in
 *   the way (only props, never water); what is still unreachable is marked blocked, so every
 *   walkable tile of the shipped map is reachable from the spawn.
 */

import { fbm, hash2 } from '@engine/core/noise';
import { TILE_BLOCK, TILE_OPEN, TILE_TALL, TIER_LEVELS } from '@game/data/maps';
import { PROP_INFO } from '@game/world/props';
import type { PropPlacement } from '@game/world/terrain';
import { WorldMap, type Zone } from '@game/world/map';
import type { Exit, Layout, RegionConfig } from './config';
import { BORDER, glyphs, lineDist, RULES } from './generate';

type Pt = readonly [number, number];

/** Props and tall grass keep this far (tiles) from a route's middle line. */
const ROUTE_CLEAR = 1.6;
/** An exit keeps the border open this many tiles to each side. */
const EXIT_OPEN = 2;
/** Zone border warp (tiles). */
const ZONE_WARP = 22;

/** Densifies a polyline (a point every ~2 tiles) and pushes inner points sideways by noise. */
function wobbled(points: readonly Pt[], wobble: number, s: number, n: number): Pt[] {
  const out: Pt[] = [];
  let walked = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i] ?? [0, 0];
    const [bx, by] = points[i + 1] ?? [0, 0];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / len;
    const ny = (bx - ax) / len;
    const steps = Math.max(1, Math.round(len / 2));
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const inner = !(i === 0 && k === 0);
      const w = inner ? (fbm((walked + t * len) * 0.05, n * 3.1, s + 21) - 0.5) * 2 * wobble : 0;
      out.push([ax + (bx - ax) * t + nx * w, ay + (by - ay) * t + ny * w]);
    }
    walked += len;
  }
  out.push(points[points.length - 1] ?? [0, 0]);
  return out;
}

/** Index of the segment nearest to a point, and the segment's direction. */
function nearestDir(px: number, py: number, pts: readonly Pt[]): Pt {
  let best = Infinity;
  let dir: Pt = [1, 0];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i] ?? [0, 0];
    const [bx, by] = pts[i + 1] ?? [0, 0];
    const d = lineDist(px, py, [
      [ax, ay],
      [bx, by],
    ]);
    if (d < best) {
      best = d;
      dir = [bx - ax, by - ay];
    }
  }
  return dir;
}

const EDGE_OF = (x: number, y: number, W: number, H: number): Exit | undefined =>
  y <= 0 ? 'north' : y >= H - 1 ? 'south' : x <= 0 ? 'west' : x >= W - 1 ? 'east' : undefined;

export function generateLayout(cfg: RegionConfig, L: Layout): WorldMap {
  const { width: W, height: H, seed: s } = cfg;
  const rules = RULES[cfg.biome];
  const m = new WorldMap({ ...cfg });

  // Zones: config order, levels default to the tier range; spawns come from the overlay.
  const keys = Object.keys(cfg.zones);
  const glyph = glyphs(keys);
  m.zones = keys.map((key, i): Zone => {
    const z = cfg.zones[key] ?? { name: key, tier: 't1' as const };
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
  for (const k of Object.keys(L.zones)) {
    if (!cfg.zones[k]) throw new Error(`layout.zones.${k}: not in "zones"`);
  }
  const seeds = keys.flatMap((k, i) =>
    (L.zones[k]?.seeds ?? []).map(([x, y]) => ({ x, y, slot: i + 1, key: k })),
  );
  if (!seeds.length) throw new Error('layout.zones: no seeds');

  const towns = Object.entries(L.towns);
  const routes = L.routes.map((r, n) => ({ ...r, line: wobbled(r.points, r.wobble, s, n + 1) }));
  const rivers = L.rivers.map((r, n) => ({ ...r, line: wobbled(r.points, 2.5, s + 50, n + 1) }));
  const fords = L.fords.map((f) => wobbled(f.points, 0, s, 0));
  const exits = Object.entries(L.exits);

  const routeDist = (x: number, y: number): number =>
    Math.min(Infinity, ...routes.map((r) => lineDist(x, y, r.line) - r.width / 2));
  const townAt = (x: number, y: number): boolean =>
    towns.some(([, t]) => Math.hypot(x - t.at[0], y - t.at[1]) < t.radius);
  const clearingAt = (x: number, y: number): boolean =>
    L.clearings.some((c) => Math.hypot(x - c.at[0], y - c.at[1]) < c.radius);
  const inEllipse = (x: number, y: number, at: Pt, r: Pt, wob: number, n: number): boolean => {
    const d = Math.hypot((x - at[0]) / r[0], (y - at[1]) / r[1]);
    return d < 1 + (fbm(x * 0.12, y * 0.12, s + 60 + n) - 0.5) * 2 * wob;
  };

  /** Zone slot (1-based) at a point: nearest seed after a noise warp. */
  const zoneSlotAt = (x: number, y: number): number => {
    const wx = x + (fbm(x * 0.035, y * 0.035, s + 8) - 0.5) * ZONE_WARP;
    const wy = y + (fbm(x * 0.035, y * 0.035, s + 18) - 0.5) * ZONE_WARP;
    let best = Infinity;
    let slot = 0;
    for (const sd of seeds) {
      const d = Math.hypot(wx - sd.x, wy - sd.y);
      if (d < best) {
        best = d;
        slot = sd.slot;
      }
    }
    return slot;
  };
  const wetAt = (x: number, y: number): number =>
    L.zones[keys[zoneSlotAt(x, y) - 1] ?? '']?.wet ?? 0;

  // Corner layers.
  for (let cy = 0; cy <= H; cy++) {
    for (let cx = 0; cx <= W; cx++) {
      const rd = routeDist(cx, cy);
      const plaza = towns.some(
        ([, t]) => Math.hypot(cx - t.at[0] - 0.5, cy - t.at[1] - 0.5) < t.plaza,
      );
      m.path.set(cx, cy, rd < (fbm(cx * 0.3, cy * 0.3, s + 7) - 0.5) * 0.4 || plaza);

      const town = townAt(cx, cy);
      const river = rivers.some(
        (r) => lineDist(cx, cy, r.line) < r.width / 2 + (fbm(cx * 0.2, cy * 0.2, s + 9) - 0.5),
      );
      const lake =
        L.lakes.some((l, n) => inEllipse(cx, cy, l.at, l.radius, l.wobble, n)) &&
        !L.islands.some((l, n) => inEllipse(cx, cy, l.at, l.radius, 0.15, n + 30));
      const pondNoise =
        fbm(cx * 0.045, cy * 0.045, s + 2) + (fbm(cx * 0.2, cy * 0.2, s + 3) - 0.5) * 0.08;
      // Wet zones add many small pools (higher-frequency noise) on top of the region's ponds.
      const wet = wetAt(cx, cy);
      const pool = wet > 0 && fbm(cx * 0.14, cy * 0.14, s + 44) < 0.34 * wet;
      const pond = (pondNoise < L.ponds || pool) && rd > ROUTE_CLEAR + 2 && !clearingAt(cx, cy);
      m.liquid.set(cx, cy, !town && (river || lake || pond));
      m.alt.set(cx, cy, fbm(cx * 0.07, cy * 0.07, s + 5) > rules.alt);
    }
  }

  // Zones per tile (towns have none).
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      const x = tx + 0.5;
      const y = ty + 0.5;
      if (townAt(x, y)) continue;
      const slot = zoneSlotAt(x, y);
      m.zoneIndex[ty * W + tx] = slot;
    }
  }

  // Props and tall grass.
  const props: PropPlacement[] = [];
  const exitNear = (tx: number, ty: number): boolean =>
    exits.some(([, e]) => {
      const edge = EDGE_OF(e.at[0], e.at[1], W, H);
      if (edge === 'north' || edge === 'south') return Math.abs(tx - e.at[0]) <= EXIT_OPEN;
      return Math.abs(ty - e.at[1]) <= EXIT_OPEN;
    });
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      const i = ty * W + tx;
      const x = tx + 0.5;
      const y = ty + 0.5;
      const liquid = m.liquidCorners(tx, ty);
      const edge = Math.min(tx, ty, W - 1 - tx, H - 1 - ty);
      const h1 = hash2(tx, ty, s + 11);
      const h2 = hash2(tx, ty, s + 12);
      const variant = Math.floor(h2 * 8);
      const dx = Math.floor(h2 * 5) - 2;
      const dy = Math.floor(hash2(tx, ty, s + 13) * 5) - 2;
      if (edge < BORDER) {
        if (liquid < 4 && !(exitNear(tx, ty) && routeDist(x, y) < 3)) {
          props.push({ kind: rules.tree, tx, ty, variant, ...(dx ? { dx } : {}) });
        }
        continue;
      }
      if (townAt(x, y) || clearingAt(x, y) || routeDist(x, y) < ROUTE_CLEAR) continue;
      if (liquid > 0 && liquid < 4) continue;
      const zk = m.zones[(m.zoneIndex[i] ?? 1) - 1]?.key ?? '';
      const zl = L.zones[zk];
      const ring = { t1: 0, t2: 1, t3: 2, danger: 3 }[
        m.zones[(m.zoneIndex[i] ?? 1) - 1]?.tier ?? 't1'
      ];
      const kind = rules.decorate({
        wet: liquid === 4,
        onAlt:
          m.alt.get(tx, ty) +
            m.alt.get(tx + 1, ty) +
            m.alt.get(tx, ty + 1) +
            m.alt.get(tx + 1, ty + 1) ===
          4,
        h: h1,
        cluster: fbm(tx * 0.16, ty * 0.16, s + 31) + (zl?.trees ?? 0) * 0.2,
        grass:
          fbm(tx * 0.22, ty * 0.22, s + 41) + (zl?.grass ?? 0) * 0.2 > rules.grass - ring * 0.04
            ? 1
            : 0,
        ring,
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

  // Tree rings around walled clearings, open toward their gap.
  for (const c of L.clearings) {
    if (!c.ring) continue;
    const [cx, cy] = c.at;
    const r = c.radius;
    for (let ty = Math.floor(cy - r - 2); ty <= cy + r + 2; ty++) {
      for (let tx = Math.floor(cx - r - 2); tx <= cx + r + 2; tx++) {
        if (!m.inside(tx, ty)) continue;
        const d = Math.hypot(tx + 0.5 - cx, ty + 0.5 - cy);
        if (d < r || d > r + 1.8) continue;
        const ox = tx + 0.5 - cx;
        const oy = ty + 0.5 - cy;
        const open =
          (c.gap === 'north' && oy < 0 && Math.abs(ox) < 1) ||
          (c.gap === 'south' && oy > 0 && Math.abs(ox) < 1) ||
          (c.gap === 'west' && ox < 0 && Math.abs(oy) < 1) ||
          (c.gap === 'east' && ox > 0 && Math.abs(oy) < 1);
        if (open || m.liquidCorners(tx, ty) > 0) continue;
        const at = props.findIndex((p) => p.tx === tx && p.ty === ty);
        if (at >= 0) props.splice(at, 1);
        m.flags[ty * W + tx] = (m.flags[ty * W + tx] ?? 0) & ~TILE_TALL;
        props.push({ kind: rules.tree, tx, ty, variant: Math.floor(hash2(tx, ty, s + 77) * 8) });
      }
    }
  }

  // Bridges where routes cross water; fords as walkable lily pads.
  const taken = new Set(props.map((p) => p.ty * W + p.tx));
  const bridge = new Map<number, 'bridge-v' | 'bridge-h'>();
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      if (m.liquidCorners(tx, ty) === 0) continue;
      const x = tx + 0.5;
      const y = ty + 0.5;
      const r = routes.find((rt) => lineDist(x, y, rt.line) < rt.width / 2 + 0.5);
      if (!r) continue;
      const [ddx, ddy] = nearestDir(x, y, r.line);
      bridge.set(ty * W + tx, Math.abs(ddy) >= Math.abs(ddx) ? 'bridge-v' : 'bridge-h');
    }
  }
  for (const [i, kind] of bridge) {
    const tx = i % W;
    const ty = (i - tx) / W;
    const [ax, ay, bx, by] =
      kind === 'bridge-v' ? [tx - 1, ty, tx + 1, ty] : [tx, ty - 1, tx, ty + 1];
    const variant =
      (bridge.get(ay * W + ax) === kind ? 0 : 1) | (bridge.get(by * W + bx) === kind ? 0 : 2);
    if (taken.has(i)) continue;
    props.push({ kind, tx, ty, ...(variant ? { variant } : {}) });
    taken.add(i);
  }
  for (const f of fords) {
    for (let ty = 0; ty < H; ty++) {
      for (let tx = 0; tx < W; tx++) {
        const i = ty * W + tx;
        if (m.liquidCorners(tx, ty) === 0 || lineDist(tx + 0.5, ty + 0.5, f) > 0.75) continue;
        m.flags[i] = (m.flags[i] ?? 0) | TILE_OPEN;
        if (!taken.has(i)) props.push({ kind: 'pad', tx, ty, variant: (tx * 5 + ty * 3) & 7 });
        taken.add(i);
      }
    }
  }
  m.props = props;

  // Anchors and connections.
  const [first] = towns;
  if (!first) throw new Error('layout.towns: none');
  const [, hub] = first;
  m.anchors = {
    spawn: {
      x: Math.round(hub.at[0]),
      y: Math.round(hub.at[1]) + 1,
      kind: 'spawn',
      facing: 'down',
    },
  };
  for (const [k, t] of towns) {
    m.anchors[`town-${k}`] = { x: Math.round(t.at[0]), y: Math.round(t.at[1]), kind: 'town' };
  }
  for (const c of L.clearings) {
    m.anchors[c.id] = { x: Math.round(c.at[0]), y: Math.round(c.at[1]), kind: c.kind };
  }
  m.connections = Object.fromEntries(
    exits.map(([k, e]) => [k, { x: Math.round(e.at[0]), y: Math.round(e.at[1]), kind: e.kind }]),
  );
  m.refreshCollision();
  connectPockets(m);
  return m;
}

/**
 * Opens walkable pockets the spawn cannot reach by removing the props in the way (shortest
 * route through prop-blocked tiles, never through water), then blocks whatever is still
 * unreachable (islands without a ford).
 */
function connectPockets(m: WorldMap): void {
  const W = m.width;
  const spawn = m.anchors['spawn'];
  if (!spawn) return;
  const N4 = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  for (let pass = 0; pass < 20; pass++) {
    const reach = m.reachableFrom(spawn.x, spawn.y);
    const propAt = new Map<number, number>();
    m.props.forEach((p, n) => {
      if (PROP_INFO[p.kind].solid && !PROP_INFO[p.kind].footprint) propAt.set(p.ty * W + p.tx, n);
    });
    const done = new Uint8Array(reach.length);
    const drop = new Set<number>();
    let pockets = 0;
    for (let start = 0; start < reach.length; start++) {
      const sx = start % W;
      const sy = (start - sx) / W;
      if (reach[start] || done[start] || m.blocked(sx, sy)) continue;
      pockets++;
      const pocket = m.reachableFrom(sx, sy);
      for (let i = 0; i < pocket.length; i++) if (pocket[i]) done[i] = 1;
      // BFS from the pocket through walkable or prop-only tiles to a reachable tile.
      const prev = new Int32Array(reach.length).fill(-2);
      prev[start] = -1;
      const queue = [start];
      let hit = -1;
      for (let q = 0; q < queue.length && hit < 0; q++) {
        const i = queue[q] ?? 0;
        const x = i % W;
        const y = (i - x) / W;
        for (const [ddx, ddy] of N4) {
          const nx = x + ddx;
          const ny = y + ddy;
          if (nx < BORDER || ny < BORDER || nx >= W - BORDER || ny >= m.height - BORDER) continue;
          const j = ny * W + nx;
          if (prev[j] !== -2) continue;
          if (m.blocked(nx, ny) && !(propAt.has(j) && !m.liquidBlocks(nx, ny))) continue;
          prev[j] = i;
          if (reach[j]) {
            hit = j;
            break;
          }
          queue.push(j);
        }
      }
      if (hit < 0) {
        for (let i = 0; i < pocket.length; i++)
          if (pocket[i]) m.flags[i] = (m.flags[i] ?? 0) | TILE_BLOCK;
        continue;
      }
      for (let i = hit; i >= 0; i = prev[i] ?? -1) {
        const n = propAt.get(i);
        if (n !== undefined) drop.add(n);
      }
    }
    if (!pockets) return;
    m.props = m.props.filter((_, n) => !drop.has(n));
    m.refreshCollision();
  }
  throw new Error('connectPockets: pockets left after 20 passes (layout needs fixing)');
}
