/**
 * Species: base stats, 1–2 types, optional trait, level-up learnset, and level-based
 * evolution (DESIGN.md "Creatures"). Lines have 1–3 stages; legendaries never evolve.
 */

import { defineRegistry, type CheckContext, type EntryOf, type EntryProblem } from '@engine/packs';
import { BODY_PLANS, MOODS } from '@game/zorlings/genome';
import { z } from 'zod';
import { description, duplicates, name, ref, refTo, STAT_IDS, type StatId } from './common';

export const MAX_LEVEL = 100;
export const MAX_STAGES = 3;

const level = z.number().int().min(1).max(MAX_LEVEL);
const baseStat = z.number().int().min(1).max(255);

export const baseStatsSchema = z.strictObject({
  hp: baseStat,
  attack: baseStat,
  defense: baseStat,
  speed: baseStat,
});
export type BaseStats = Readonly<Record<StatId, number>>;

export const speciesSchema = z.strictObject({
  name,
  description,
  types: z.array(ref).min(1).max(2),
  baseStats: baseStatsSchema,
  /** 0 or 1 passive. Trait-less species get slightly higher stats. */
  trait: ref.optional(),
  /** Moves learned on reaching a level, in level order. Level-1 moves are known from the start. */
  learnset: z.array(z.strictObject({ level, move: ref })).min(1),
  evolution: z.strictObject({ into: ref, level: level.min(2) }).optional(),
  /** Regional legendary: ~575 stat total, never evolves. */
  legendary: z.boolean().default(false),
  /** XP base for defeating it. Defaults to stat total / 5 (see `@game/progression`). */
  xpYield: z.number().int().min(1).max(1000).optional(),
  /** Multiplies the capture chance: below 1 is harder to catch, above 1 easier. */
  catchRate: z.number().positive().max(3).default(1),
  /**
   * How the line looks: the genome seed of its final form, optionally with a forced body plan
   * and mood. Only the final stage of a line has one; earlier stages are derived from it.
   * Without it the look is rolled from the final form's id.
   */
  look: z
    .strictObject({
      seed: z.number().int().min(0).max(0xffffffff),
      plan: z.enum(BODY_PLANS).optional(),
      mood: z.enum(MOODS).optional(),
    })
    .optional(),
});

export type Species = EntryOf<typeof species>;
export type SpeciesInput = z.input<typeof speciesSchema>;

type SpeciesLike = z.output<typeof speciesSchema> & { readonly id: string };

export const species = defineRegistry('species', speciesSchema, {
  refs: (s) => [
    ...s.types.map((id, i) => refTo('types', id, 'types', i)),
    ...(s.trait ? [refTo('traits', s.trait, 'trait')] : []),
    ...s.learnset.map((l, i) => refTo('moves', l.move, 'learnset', i, 'move')),
    ...(s.evolution ? [refTo('species', s.evolution.into, 'evolution', 'into')] : []),
  ],
  check: (s, ctx) => checkSpecies(s, ctx),
});

function checkSpecies(s: SpeciesLike, ctx: CheckContext): EntryProblem[] {
  const out: EntryProblem[] = [];
  for (const t of duplicates(s.types)) out.push({ path: ['types'], message: `"${t}" twice` });
  s.learnset.forEach((l, i) => {
    const prev = s.learnset[i - 1];
    if (prev && l.level < prev.level) {
      out.push({ path: ['learnset', i, 'level'], message: 'Learnset must be in level order' });
    }
  });
  for (const m of duplicates(s.learnset.map((l) => l.move))) {
    out.push({ path: ['learnset'], message: `"${m}" is learned twice` });
  }

  const get = (id: string): SpeciesLike | undefined =>
    ctx.get('species', id) as SpeciesLike | undefined;
  const parents = (ctx.values('species') as SpeciesLike[]).filter(
    (o) => o.evolution?.into === s.id,
  );
  if (parents.length > 1) {
    const ids = parents.map((p) => `"${p.id}"`).join(', ');
    out.push({ path: [], message: `More than one species evolves into it (${ids})` });
  }
  if (s.legendary && (s.evolution || parents.length)) {
    out.push({ path: ['legendary'], message: 'Legendaries never evolve' });
  }

  if (s.look && s.evolution) {
    out.push({ path: ['look'], message: 'Only the final form of a line has a look' });
  }

  if (s.evolution) {
    const next = get(s.evolution.into);
    const parent = parents[0];
    if (parent?.evolution && s.evolution.level <= parent.evolution.level) {
      out.push({
        path: ['evolution', 'level'],
        message: `Must be above the level it evolved at (${parent.evolution.level})`,
      });
    }
    // Only the first stage reports line problems, so each line is reported once.
    if (next && !parent) {
      const seen = new Set([s.id]);
      let cur: SpeciesLike | undefined = next;
      while (cur) {
        if (seen.has(cur.id)) {
          out.push({ path: ['evolution'], message: 'Evolution line loops back on itself' });
          break;
        }
        seen.add(cur.id);
        cur = cur.evolution ? get(cur.evolution.into) : undefined;
      }
      if (seen.size > MAX_STAGES) {
        out.push({
          path: ['evolution'],
          message: `Evolution line has more than ${MAX_STAGES} stages`,
        });
      }
    }
  }
  return out;
}

/** Stat total: the sum of all base stats. */
export function statTotal(stats: BaseStats): number {
  return STAT_IDS.reduce((sum, k) => sum + stats[k], 0);
}

/**
 * Target stat total for a stage of a line (DESIGN.md "Stat-total bands"). `stage` is 1-based,
 * `stages` is the line length. Bands are guides ("~"), checked with a tolerance by tests.
 */
export function statBand(stage: number, stages: number, legendary = false): number {
  if (legendary) return 575;
  const bands: Record<number, readonly number[]> = { 1: [470], 2: [330, 490], 3: [300, 410, 520] };
  const band = bands[stages]?.[stage - 1];
  if (band === undefined) throw new Error(`No stat band for stage ${stage} of ${stages}`);
  return band;
}
