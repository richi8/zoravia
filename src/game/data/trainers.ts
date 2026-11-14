/**
 * Trials, badges and trainers (C27).
 *
 * - **Badges** (`badges` registry): won at a region's trial. The number held sets the soft
 *   level cap and how much story bosses scale. Given by the dialogue action `{ badge }`.
 * - **Trainers** (`trainers` registry): opponents with a fixed team, fought from a dialogue
 *   node (`battle: { trainer }`). A trainer can have several teams by badges held (the rival
 *   grows with the player): the team with the highest `badges` at or below the player's
 *   count is used.
 *   - `perBadge`: story boss scaling. Each badge held above the team's own `badges` adds this
 *     many levels to every member (DESIGN.md: ~+4 per badge for campaign story bosses).
 *   - A team member with `boss` fights in boss form (aura, Armor; it faints, it is never
 *     caught). At most one per team.
 *   - `prize`: paid for the first win. `rematch`: later fights add `levels` and pay `prize`
 *     once more (the first rematch win); after that a win pays only XP. Without `rematch`,
 *     the fight still works but pays nothing again.
 */

import { defineRegistry, type CheckContext, type EntryOf, type EntryProblem } from '@engine/packs';
import { z } from 'zod';
import { description, duplicates, name, ref, refTo } from './common';
import { MAX_LEVEL } from './species';
import { conditionRefs, storyConditionSchema } from './story';

export const badgeSchema = z.strictObject({
  name,
  description,
  /** Type whose color the badge icon uses. */
  type: ref,
});

export const badges = defineRegistry('badges', badgeSchema, {
  refs: (b) => [refTo('types', b.type, 'type')],
});
export type Badge = EntryOf<typeof badges>;
export type BadgeInput = z.input<typeof badgeSchema>;

const level = z.number().int().min(1).max(MAX_LEVEL);

export const trainerMemberSchema = z.strictObject({
  species: ref,
  level,
  /** Moves it knows (up to 3); default: the last ones its learnset gives by `level`. */
  moves: z.array(ref).min(1).max(3).optional(),
  /** Fights in boss form (a `bosses` id whose species is this one). */
  boss: ref.optional(),
  /**
   * Another species when a story condition holds; the first match wins (C33: the rival takes
   * the starter that beats the player's). `moves` are then the new species' learnset moves.
   * Up to 8 (C34: a rival who travels counters every region's starters, two per region).
   */
  instead: z
    .array(
      z.strictObject({
        if: storyConditionSchema,
        species: ref,
        /** Its own level, when the other species needs one to be as hard (not harder). */
        level: level.optional(),
      }),
    )
    .min(1)
    .max(8)
    .optional(),
});
export type TrainerMember = z.output<typeof trainerMemberSchema>;

export const trainerTeamSchema = z.strictObject({
  /** Used from this many badges held. */
  badges: z.number().int().min(0).default(0),
  team: z.array(trainerMemberSchema).min(1).max(3),
});
export type TrainerTeam = z.output<typeof trainerTeamSchema>;

export const trainerSchema = z
  .strictObject({
    /** Shown in battle text ("Rival Mira sent out …"). */
    name,
    /** Teams by badges held, lowest first; the first is used from 0 badges. */
    teams: z.array(trainerTeamSchema).min(1).max(8),
    /** Money for the first win. */
    prize: z.number().int().min(0).default(0),
    /** Story boss scaling: levels added per badge held above the team's `badges`. */
    perBadge: z.number().int().min(0).max(10).default(0),
    rematch: z
      .strictObject({
        /** Levels added in rematches. */
        levels: z.number().int().min(0).max(30),
        /** Money for the first rematch win. */
        prize: z.number().int().min(0).default(0),
      })
      .optional(),
  })
  .superRefine((t, ctx) => {
    const thresholds = t.teams.map((x) => x.badges);
    if (thresholds[0] !== 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['teams', 0, 'badges'],
        message: 'The first team must start at 0 badges',
      });
    }
    thresholds.forEach((b, i) => {
      if (i > 0 && b <= (thresholds[i - 1] ?? 0)) {
        ctx.addIssue({
          code: 'custom',
          path: ['teams', i, 'badges'],
          message: 'Teams must go up in badges',
        });
      }
    });
    t.teams.forEach((team, i) => {
      if (team.team.filter((m) => m.boss).length > 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['teams', i, 'team'],
          message: 'At most one boss per team',
        });
      }
    });
  });

export const trainers = defineRegistry('trainers', trainerSchema, {
  refs: (t) =>
    t.teams.flatMap((team, i) =>
      team.team.flatMap((m, j) => [
        refTo('species', m.species, 'teams', i, 'team', j, 'species'),
        ...(m.moves ?? []).map((id, k) => refTo('moves', id, 'teams', i, 'team', j, 'moves', k)),
        ...(m.boss ? [refTo('bosses', m.boss, 'teams', i, 'team', j, 'boss')] : []),
        ...(m.instead ?? []).flatMap((alt, k) => [
          refTo('species', alt.species, 'teams', i, 'team', j, 'instead', k, 'species'),
          ...conditionRefs(alt.if, 'teams', i, 'team', j, 'instead', k, 'if'),
        ]),
      ]),
    ),
  check: (t, ctx) => checkTrainer(t, ctx),
});
export type TrainerData = z.output<typeof trainerSchema>;
export type Trainer = EntryOf<typeof trainers>;
export type TrainerInput = z.input<typeof trainerSchema>;

function checkTrainer(t: TrainerData, ctx: CheckContext): EntryProblem[] {
  const out: EntryProblem[] = [];
  t.teams.forEach((team, i) =>
    team.team.forEach((m, j) => {
      const path = ['teams', i, 'team', j];
      for (const d of duplicates(m.moves ?? [])) {
        out.push({ path: [...path, 'moves'], message: `"${d}" twice` });
      }
      if (m.boss && m.instead) {
        out.push({ path: [...path, 'instead'], message: 'A boss member cannot change species' });
      }
      if (!m.boss) return;
      const boss = ctx.get('bosses', m.boss) as { species: string } | undefined;
      if (boss && boss.species !== m.species) {
        out.push({ path: [...path, 'boss'], message: `Boss "${m.boss}" is not a ${m.species}` });
      }
    }),
  );
  return out;
}

/** The team a trainer uses with `badges` held (the highest threshold at or below it). */
export function trainerTeam(t: TrainerData, badges: number): TrainerTeam {
  let pick = t.teams[0] as TrainerTeam;
  for (const team of t.teams) if (team.badges <= badges) pick = team;
  return pick;
}
