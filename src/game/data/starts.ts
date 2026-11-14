/**
 * Start regions (C33): where a new game can begin (DESIGN.md "Pillars": start in any region).
 * Each entry names a region map, the spot to start on, the region's starters and what the
 * player carries at first. The new-game screen lists them in pack order.
 *
 * Choosing a starter sets its `flag` in the save, so dialogue and trainers can react to it
 * (Rival Mira picks the starter that beats yours, see `instead` on trainer members).
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
  const map = ctx.get('maps', s.map) as { anchors?: Record<string, unknown> } | undefined;
  if (map?.anchors && !(s.anchor in map.anchors)) {
    out.push({ path: ['anchor'], message: `No anchor "${s.anchor}" on ${s.map}` });
  }
  return out;
}
