/**
 * Bosses (DESIGN.md "Bosses"): a Titan or a regional legendary fought in a boss battle. The
 * boss aura gives it more HP, an extra (signature) move and Armor that only the right
 * reactions break. Defeated, it becomes Subdued and any capture item catches it.
 */

import { defineRegistry, type CheckContext, type EntryOf, type EntryProblem } from '@engine/packs';
import { z } from 'zod';
import { description, duplicates, multiplier, name, ref, refTo } from './common';
import { MAX_LEVEL } from './species';

export const BOSS_KINDS = ['titan', 'legendary'] as const;
export type BossKind = (typeof BOSS_KINDS)[number];

/** Boss aura HP multiplier when a boss does not set its own (DESIGN.md: ~×3). */
export const DEFAULT_BOSS_HP_MULTIPLIER = 3;

export const bossSchema = z.strictObject({
  name,
  description,
  /** A Titan keeps a Titan mark when caught; a legendary does not. */
  kind: z.enum(BOSS_KINDS),
  species: ref,
  /** Level of the first fight. Rematches pass a higher one. */
  level: z.number().int().min(1).max(MAX_LEVEL),
  /** Max HP multiplier of the boss aura. */
  hpMultiplier: multiplier.default(DEFAULT_BOSS_HP_MULTIPLIER),
  /** The extra move it knows in boss form; caught, it keeps this move. */
  signatureMove: ref,
  /** Armor: reduced damage until one of these reactions breaks it. Omitted = no Armor. */
  armor: z.strictObject({ breaks: z.array(ref).min(1) }).optional(),
  /** Hand-written theme (`music`); omitted = boss music composed from the biome's battle music. */
  theme: ref.optional(),
  /**
   * Rematches (C27) once it is beaten or caught: a boss battle again, `levels` higher, that it
   * cannot be caught in. The first rematch win pays `prize`; later wins pay only XP.
   */
  rematch: z
    .strictObject({
      levels: z.number().int().min(0).max(30),
      prize: z.number().int().min(0).default(0),
    })
    .optional(),
});

export type Boss = EntryOf<typeof bosses>;
export type BossInput = z.input<typeof bossSchema>;

type BossLike = z.output<typeof bossSchema> & { readonly id: string };

export const bosses = defineRegistry('bosses', bossSchema, {
  refs: (b) => [
    refTo('species', b.species, 'species'),
    refTo('moves', b.signatureMove, 'signatureMove'),
    ...(b.armor?.breaks.map((r, i) => refTo('reactions', r, 'armor', 'breaks', i)) ?? []),
    ...(b.theme ? [refTo('music', b.theme, 'theme')] : []),
  ],
  check: (b, ctx) => checkBoss(b, ctx),
});

function checkBoss(b: BossLike, ctx: CheckContext): EntryProblem[] {
  const out: EntryProblem[] = [];
  for (const r of duplicates(b.armor?.breaks ?? [])) {
    out.push({ path: ['armor', 'breaks'], message: `"${r}" twice` });
  }
  const species = ctx.get('species', b.species) as
    { legendary: boolean; learnset: readonly { move: string }[] } | undefined;
  if (!species) return out;
  if (b.kind === 'legendary' && !species.legendary) {
    out.push({ path: ['species'], message: 'A legendary boss must be a legendary species' });
  }
  if (b.kind === 'titan' && species.legendary) {
    out.push({ path: ['species'], message: 'A Titan cannot be a legendary species' });
  }
  if (species.learnset.some((l) => l.move === b.signatureMove)) {
    out.push({
      path: ['signatureMove'],
      message: 'The signature move must not be in the species learnset',
    });
  }
  return out;
}
