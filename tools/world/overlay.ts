/**
 * Hand-edit overlay (`overlay.json`): everything authored by hand on top of a region's
 * generated base. Merged at build time (`npm run world -- build`) into the shipped map.
 *
 * - `name`: replaces the region name.
 * - `zones`: per zone key, fields that replace the generated ones (name, levels, spawns,
 *   tier, glyph). A new key adds a zone (all fields needed); `null` removes one (its tiles
 *   lose their zone).
 * - `anchors` / `connections`: by id, a full entry adds or replaces, `null` removes.
 * - `edits`: applied in order, positions in tiles (rects are `{ x, y, w, h }`):
 *   - `terrain`: sets (`set: true`) or clears a layer (`alt`, `path`, `liquid`) on every
 *     corner of the tiles in `rect`.
 *   - `stamp`: per-corner layer edit from `at` (top-left corner): `#` set, `-` clear,
 *     `.` keep. Corner (x, y) is the top-left corner of tile (x, y).
 *   - `tall`: tall grass on / off in `rect`.
 *   - `clearProps`: removes props in `rect`.
 *   - `prop`: places a prop on a tile (replacing any prop there).
 *   - `collision`: `block` / `open` forces walkability in `rect`; `auto` follows terrain.
 *   - `zone`: assigns `rect` to a zone key (`null` = no zone).
 *   Every edit may carry a `note` (JSON has no comments).
 */

import { z } from 'zod';
import {
  anchorSchema,
  connectionSchema,
  TILE_BLOCK,
  TILE_OPEN,
  TILE_TALL,
  zoneSchema,
} from '@game/data/maps';
import { name } from '@game/data/common';
import { PROP_KINDS } from '@game/world/props';
import type { WorldMap, Zone } from '@game/world/map';

const key = z.string().regex(/^[a-z0-9_-]+$/);
const int = z.number().int();
const rect = z.strictObject({ x: int, y: int, w: int.positive(), h: int.positive() });
const at = z.tuple([int, int]);
const note = z.string().optional();
const layer = z.enum(['alt', 'path', 'liquid']);

export const overlayEditSchema = z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('terrain'), note, layer, set: z.boolean(), rect }),
  z.strictObject({
    op: z.literal('stamp'),
    note,
    layer,
    at,
    rows: z
      .array(z.string().regex(/^[#.-]+$/, 'Stamp rows use # (set), - (clear), . (keep)'))
      .min(1),
  }),
  z.strictObject({ op: z.literal('tall'), note, set: z.boolean(), rect }),
  z.strictObject({ op: z.literal('clearProps'), note, rect }),
  z.strictObject({
    op: z.literal('prop'),
    note,
    kind: z.enum(PROP_KINDS),
    at,
    variant: int.min(0).max(7).optional(),
    dx: int.min(-8).max(8).optional(),
    dy: int.min(-8).max(8).optional(),
  }),
  z.strictObject({
    op: z.literal('collision'),
    note,
    rect,
    mode: z.enum(['auto', 'block', 'open']),
  }),
  z.strictObject({ op: z.literal('zone'), note, rect, zone: key.nullable() }),
]);

export const overlaySchema = z.strictObject({
  name: name.optional(),
  zones: z.record(key, zoneSchema.partial().nullable()).default({}),
  anchors: z.record(key, anchorSchema.nullable()).default({}),
  connections: z.record(key, connectionSchema.nullable()).default({}),
  edits: z.array(overlayEditSchema).default([]),
});

export type Overlay = z.output<typeof overlaySchema>;
export type OverlayInput = z.input<typeof overlaySchema>;
export type OverlayEdit = z.output<typeof overlayEditSchema>;

export class OverlayError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(
      `Overlay has ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    );
    this.name = 'OverlayError';
  }
}

/** Applies an overlay to a copy of `base`. Throws `OverlayError` listing every problem. */
export function applyOverlay(base: WorldMap, input: OverlayInput): WorldMap {
  const overlay = overlaySchema.parse(input);
  const problems: string[] = [];
  const m = base.clone();
  if (overlay.name !== undefined) m.name = overlay.name;
  mergeZones(m, overlay.zones, problems);
  m.anchors = merged(m.anchors, overlay.anchors);
  m.connections = merged(m.connections, overlay.connections);
  overlay.edits.forEach((e, i) => {
    const where = `edits[${i}] (${e.op}${e.note ? `: ${e.note}` : ''})`;
    for (const p of applyEdit(m, e)) problems.push(`${where}: ${p}`);
  });
  for (const [id, a] of Object.entries(m.anchors)) {
    if (!m.inside(a.x, a.y)) problems.push(`anchors.${id}: (${a.x}, ${a.y}) is outside the map`);
  }
  for (const [id, c] of Object.entries(m.connections)) {
    if (!m.inside(c.x, c.y))
      problems.push(`connections.${id}: (${c.x}, ${c.y}) is outside the map`);
  }
  if (problems.length) throw new OverlayError(problems);
  m.refreshCollision();
  return m;
}

/** Entries of `from` replace or add; `null` removes. */
function merged<T>(into: Record<string, T>, from: Record<string, T | null>): Record<string, T> {
  const out = new Map(Object.entries(into));
  for (const [id, v] of Object.entries(from)) {
    if (v === null) out.delete(id);
    else out.set(id, v);
  }
  return Object.fromEntries(out);
}

function mergeZones(m: WorldMap, zones: Overlay['zones'], problems: string[]): void {
  for (const [key, patch] of Object.entries(zones)) {
    const i = m.zones.findIndex((z) => z.key === key);
    if (patch === null) {
      if (i < 0) problems.push(`zones.${key}: no such zone to remove`);
      else removeZone(m, i);
      continue;
    }
    if (i >= 0) {
      const old = m.zones[i] as Zone;
      m.zones[i] = { ...old, ...(dropUndefined(patch) as Partial<Zone>), key };
      continue;
    }
    const full = zoneSchema.safeParse(patch);
    if (!full.success) {
      problems.push(`zones.${key}: a new zone needs name, glyph, tier and levels`);
      continue;
    }
    if (m.zones.length >= 255) problems.push(`zones.${key}: too many zones`);
    else m.zones.push({ ...full.data, key });
  }
}

function dropUndefined(o: object): object {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}

function removeZone(m: WorldMap, index: number): void {
  const slot = index + 1;
  for (let i = 0; i < m.zoneIndex.length; i++) {
    const v = m.zoneIndex[i] ?? 0;
    if (v === slot) m.zoneIndex[i] = 0;
    else if (v > slot) m.zoneIndex[i] = v - 1;
  }
  m.zones.splice(index, 1);
}

type Rect = z.output<typeof rect>;

function rectProblem(m: WorldMap, r: Rect): string | undefined {
  return r.x < 0 || r.y < 0 || r.x + r.w > m.width || r.y + r.h > m.height
    ? `rect (${r.x}, ${r.y}, ${r.w}×${r.h}) leaves the ${m.width}×${m.height} map`
    : undefined;
}

function eachTile(r: Rect, fn: (x: number, y: number) => void): void {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) fn(x, y);
}

function applyEdit(m: WorldMap, e: OverlayEdit): string[] {
  if (e.op === 'stamp') {
    const [x0, y0] = e.at;
    const wide = Math.max(...e.rows.map((r) => r.length));
    if (x0 < 0 || y0 < 0 || x0 + wide > m.width + 1 || y0 + e.rows.length > m.height + 1) {
      return [`stamp at (${x0}, ${y0}) leaves the ${m.width + 1}×${m.height + 1} corner grid`];
    }
    const g = m[e.layer];
    e.rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        if (row[i] === '#') g.set(x0 + i, y0 + j, true);
        else if (row[i] === '-') g.set(x0 + i, y0 + j, false);
      }
    });
    return [];
  }
  if (e.op === 'prop') {
    const [tx, ty] = e.at;
    if (!m.inside(tx, ty)) return [`tile (${tx}, ${ty}) is outside the map`];
    m.props = m.props.filter((p) => p.tx !== tx || p.ty !== ty);
    m.props.push({
      kind: e.kind,
      tx,
      ty,
      ...(e.variant !== undefined ? { variant: e.variant } : {}),
      ...(e.dx !== undefined ? { dx: e.dx } : {}),
      ...(e.dy !== undefined ? { dy: e.dy } : {}),
    });
    return [];
  }
  const bad = rectProblem(m, e.rect);
  if (bad) return [bad];
  const r = e.rect;
  switch (e.op) {
    case 'terrain': {
      const g = m[e.layer];
      for (let y = r.y; y <= r.y + r.h; y++)
        for (let x = r.x; x <= r.x + r.w; x++) g.set(x, y, e.set);
      return [];
    }
    case 'tall':
      eachTile(r, (x, y) => {
        const i = y * m.width + x;
        m.flags[i] = e.set ? (m.flags[i] ?? 0) | TILE_TALL : (m.flags[i] ?? 0) & ~TILE_TALL;
      });
      return [];
    case 'clearProps':
      m.props = m.props.filter(
        (p) => p.tx < r.x || p.ty < r.y || p.tx >= r.x + r.w || p.ty >= r.y + r.h,
      );
      return [];
    case 'collision': {
      const bits = e.mode === 'block' ? TILE_BLOCK : e.mode === 'open' ? TILE_OPEN : 0;
      eachTile(r, (x, y) => {
        const i = y * m.width + x;
        m.flags[i] = ((m.flags[i] ?? 0) & ~(TILE_BLOCK | TILE_OPEN)) | bits;
      });
      return [];
    }
    case 'zone': {
      const slot = m.zoneSlot(e.zone);
      if (e.zone !== null && slot === 0) return [`unknown zone "${e.zone}"`];
      eachTile(r, (x, y) => {
        m.zoneIndex[y * m.width + x] = slot;
      });
      return [];
    }
  }
}
