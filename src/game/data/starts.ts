/**
 * Start regions (C33): where a new game can begin (DESIGN.md "Pillars": start in any region).
 * Each entry names a region map, the spot to start on, the region's starters and what the
 * player carries at first. The new-game screen lists them in pack order.
 *
 * Choosing a starter sets its `flag` in the save, so dialogue and trainers can react to it
 * (Rival Mira picks the starter that beats yours, see `instead` on trainer members).
 *
 * `world` (C36c) places the region's map in the one world: the tile of the world its top-left
 * corner sits on. The map window draws every region there, and regions may not overlap. A
 * region without it is placed east of the others (`world/world-layout.ts`).
 */

import { defineRegistry, type CheckContext, type EntryOf, type EntryProblem } from '@engine/packs';
import { z } from 'zod';
import { duplicates, name, ref, refTo } from './common';
import { MAX_LEVEL } from './species';

export const starterSchema = z.strictObject({
  species: ref,
  /** Story flag set to 1 when this starter is chosen. */
  flag: ref,
  /** A few words shown under the starter (its play style). */
  blurb: z.string().max(80).default(''),
});

export const startSchema = z.strictObject({
  /** Shown on the region list ("Verdale"). */
  name,
  /** One or two sentences about the region for the region list. */
  description: z.string().max(200).default(''),
  /** The region map a new game starts on. */
  map: ref,
  /** Anchor on that map to start at. */
  anchor: z.string().min(1).default('spawn'),
  starters: z.array(starterSchema).min(1).max(4),
  /** Level of the starter (DESIGN.md "Pacing": Lv 6 in Verdale). */
  level: z.number().int().min(1).max(MAX_LEVEL),
  /** Items in the bag at the start. */
  bag: z.record(ref, z.number().int().min(1)).default({}),
  money: z.number().int().min(0).default(0),
  /** World tile of the map's top-left corner (C36c); regions must not overlap. */
  world: z.strictObject({ x: z.number().int(), y: z.number().int() }).optional(),
});

export const starts = defineRegistry('starts', startSchema, {
  refs: (s) => [
    refTo('maps', s.map, 'map'),
    ...s.starters.map((st, i) => refTo('species', st.species, 'starters', i, 'species')),
    ...Object.keys(s.bag).map((id) => refTo('items', id, 'bag', id)),
  ],
  check: (s, ctx) => checkStart(s, ctx),
});
export type StartData = z.output<typeof startSchema>;
export type Start = EntryOf<typeof starts>;
export type StartInput = z.input<typeof startSchema>;

function checkStart(s: StartData, ctx: CheckContext): EntryProblem[] {
  const out: EntryProblem[] = [];
  for (const d of duplicates(s.starters.map((x) => x.species))) {
    out.push({ path: ['starters'], message: `"${d}" twice` });
  }
  for (const d of duplicates(s.starters.map((x) => x.flag))) {
    out.push({ path: ['starters'], message: `Flag "${d}" twice` });
  }
  const map = ctx.get('maps', s.map) as MapSize | undefined;
  if (map?.anchors && !(s.anchor in map.anchors)) {
    out.push({ path: ['anchor'], message: `No anchor "${s.anchor}" on ${s.map}` });
  }
  if (s.world && map) out.push(...checkWorld(s as Start, map, ctx));
  return out;
}

interface MapSize {
  readonly width?: number;
  readonly height?: number;
  readonly anchors?: Record<string, unknown>;
}

/** A region's world rectangle may not overlap another region's (C36c). */
function checkWorld(s: Start, map: MapSize, ctx: CheckContext): EntryProblem[] {
  const out: EntryProblem[] = [];
  const w = s.world;
  if (!w) return out;
  const a = { x: w.x, y: w.y, w: map.width ?? 0, h: map.height ?? 0 };
  for (const other of ctx.values('starts') as Start[]) {
    if (other.id === s.id || !other.world) continue;
    if (other.map === s.map) {
      if (other.world.x !== w.x || other.world.y !== w.y)
        out.push({ path: ['world'], message: `${s.map} placed differently by ${other.id}` });
      continue;
    }
    const m = ctx.get('maps', other.map) as MapSize | undefined;
    const b = { x: other.world.x, y: other.world.y, w: m?.width ?? 0, h: m?.height ?? 0 };
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
      out.push({ path: ['world'], message: `${s.map} overlaps ${other.map} (${other.id})` });
  }
  return out;
}
