/**
 * Region extensions (C36): a region grows by strips glued onto its sides after it shipped.
 *
 * - `generateExtension` makes a strip as a map of its own, from its layout in strip
 *   coordinates. `world extend` freezes it in `generated-<id>.json`, like the base.
 * - `stitch` glues a strip onto a map. Every existing tile, prop, anchor and connection is
 *   kept; only the region's border trees in front of each join are cleared, and the strip's
 *   path is carried through them. A strip on the north or west side moves the existing map
 *   (and its `origin`) by the strip's depth.
 * - The strip's exits on the glued side are joins, not connections. Its spawn anchor is
 *   dropped; its town and clearing anchors are kept.
 */

import { BORDER } from './generate';
import { WorldMap } from '@game/world/map';
import { PROP_INFO } from '@game/world/props';
import { TILE_BLOCK } from '@game/data/maps';
import type { Exit, Extension, RegionConfig } from './config';
import { generateRegion } from './generate';

/** Tiles each side of a join where the region's border is opened (the strip uses the same). */
const JOIN_OPEN = 2;

const GLYPHS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Size of a strip for this side of a `width`×`height` map. */
export function stripSize(side: Exit, depth: number, width: number, height: number) {
  return side === 'north' || side === 'south' ? { width, height: depth } : { width: depth, height };
}

/** Generates extension `id` of a region as a map of its own (strip coordinates). */
export function generateExtension(
  cfg: RegionConfig,
  id: string,
  current: { width: number; height: number },
): WorldMap {
  const ext = cfg.extensions[id];
  if (!ext) throw new Error(`No extension "${id}" in region.json`);
  const size = stripSize(ext.side, ext.size, current.width, current.height);
  return generateRegion({
    name: cfg.name,
    biome: cfg.biome,
    seed: ext.seed,
    width: size.width,
    height: size.height,
    chunkSize: cfg.chunkSize,
    zones: ext.zones,
    exits: ['north'],
    layout: ext.layout,
    extensions: {},
  });
}

/** The side of the strip that touches the map it is glued to. */
const FACING: Readonly<Record<Exit, Exit>> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
};

const onEdge = (x: number, y: number, w: number, h: number, edge: Exit): boolean =>
  edge === 'north' ? y <= 0 : edge === 'south' ? y >= h - 1 : edge === 'west' ? x <= 0 : x >= w - 1;

/** Glues `strip` onto the `side` of `base`. Neither input is changed. */
export function stitch(base: WorldMap, strip: WorldMap, side: Extension['side']): WorldMap {
  const vertical = side === 'north' || side === 'south';
  if (vertical ? strip.width !== base.width : strip.height !== base.height) {
    throw new Error(`A ${side} strip must be as long as the map's ${side} side`);
  }
  const W = vertical ? base.width : base.width + strip.width;
  const H = vertical ? base.height + strip.height : base.height;
  const [bx, by] =
    side === 'north' ? [0, strip.height] : side === 'west' ? [strip.width, 0] : [0, 0];
  const [sx, sy] = side === 'south' ? [0, base.height] : side === 'east' ? [base.width, 0] : [0, 0];

  const m = new WorldMap({ ...base, width: W, height: H });
  m.origin = [base.origin[0] + bx, base.origin[1] + by];

  // Zones: the base keeps its slots; the strip's follow, with free glyphs.
  for (const z of strip.zones) {
    if (base.zone(z.key)) throw new Error(`Zone "${z.key}" is in the map and the strip`);
  }
  const used = new Set(base.zones.map((z) => z.glyph));
  m.zones = [
    ...base.zones.map((z) => ({ ...z, spawns: z.spawns.map((s) => ({ ...s })) })),
    ...strip.zones.map((z) => {
      const glyph = used.has(z.glyph) ? [...GLYPHS].find((g) => !used.has(g)) : z.glyph;
      if (!glyph) throw new Error('Too many zones (at most 36)');
      used.add(glyph);
      return { ...z, glyph, spawns: z.spawns.map((s) => ({ ...s })) };
    }),
  ];
  const slots = base.zones.length;

  // Corners: the strip first, then the base, so the shared seam line stays the base's.
  const copy = (from: WorldMap, ox: number, oy: number, zoneShift: number): void => {
    for (const layer of ['alt', 'path', 'liquid'] as const) {
      const g = from[layer];
      for (let y = 0; y < g.rows; y++) {
        for (let x = 0; x < g.cols; x++) m[layer].set(x + ox, y + oy, g.get(x, y) === 1);
      }
    }
    for (let y = 0; y < from.height; y++) {
      for (let x = 0; x < from.width; x++) {
        const i = y * from.width + x;
        const j = (y + oy) * W + x + ox;
        m.flags[j] = from.flags[i] ?? 0;
        const z = from.zoneIndex[i] ?? 0;
        m.zoneIndex[j] = z ? z + zoneShift : 0;
      }
    }
  };
  copy(strip, sx, sy, slots);
  copy(base, bx, by, 0);

  // Joins: the strip's exits on the glued side.
  const edge = FACING[side];
  const joins = Object.entries(strip.connections).filter(([, c]) =>
    onEdge(c.x, c.y, strip.width, strip.height, edge),
  );

  // The base's border tiles in front of each join (base coordinates).
  const opened = new Set<number>();
  for (const [, c] of joins) {
    for (let d = 0; d < BORDER; d++) {
      for (let o = -JOIN_OPEN; o <= JOIN_OPEN; o++) {
        const [tx, ty] =
          side === 'north'
            ? [c.x + o, d]
            : side === 'south'
              ? [c.x + o, base.height - 1 - d]
              : side === 'west'
                ? [d, c.y + o]
                : [base.width - 1 - d, c.y + o];
        if (base.inside(tx, ty)) opened.add(ty * base.width + tx);
      }
    }
  }

  // Props: the strip's, then the base's (except border trees in front of a join).
  const props = [
    ...strip.props.map((p) => ({ ...p, tx: p.tx + sx, ty: p.ty + sy })),
    ...base.props
      .filter((p) => {
        if (!opened.has(p.ty * base.width + p.tx)) return true;
        return !PROP_INFO[p.kind].solid || Boolean(PROP_INFO[p.kind].footprint);
      })
      .map((p) => ({ ...p, tx: p.tx + bx, ty: p.ty + by })),
  ];
  m.props = props;

  // Opened tiles: unblocked, with the strip's path carried through from the seam.
  for (const i of opened) {
    const tx = i % base.width;
    const ty = (i - tx) / base.width;
    const j = (ty + by) * W + tx + bx;
    m.flags[j] = (m.flags[j] ?? 0) & ~TILE_BLOCK;
    // Each corner takes the path of the strip's seam corner in line with it.
    for (const [cx, cy] of [
      [tx + bx, ty + by],
      [tx + bx + 1, ty + by],
      [tx + bx, ty + by + 1],
      [tx + bx + 1, ty + by + 1],
    ] as const) {
      const seam = vertical
        ? strip.path.get(cx - sx, side === 'north' ? strip.height : 0)
        : strip.path.get(side === 'west' ? strip.width : 0, cy - sy);
      if (seam === 1) m.path.set(cx, cy, true);
    }
  }

  // Anchors and connections.
  m.anchors = {};
  for (const [k, a] of Object.entries(base.anchors))
    m.anchors[k] = { ...a, x: a.x + bx, y: a.y + by };
  for (const [k, a] of Object.entries(strip.anchors)) {
    if (k === 'spawn') continue;
    if (m.anchors[k]) throw new Error(`Anchor "${k}" is in the map and the strip`);
    m.anchors[k] = { ...a, x: a.x + sx, y: a.y + sy };
  }
  m.connections = {};
  for (const [k, c] of Object.entries(base.connections))
    m.connections[k] = { ...c, x: c.x + bx, y: c.y + by };
  const joined = new Set(joins.map(([k]) => k));
  for (const [k, c] of Object.entries(strip.connections)) {
    if (joined.has(k)) continue;
    if (m.connections[k]) throw new Error(`Connection "${k}" is in the map and the strip`);
    m.connections[k] = { ...c, x: c.x + sx, y: c.y + sy };
  }
  m.refreshCollision();
  return m;
}
