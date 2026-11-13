/**
 * Story content (C26): dialogues and quests, written only as pack data.
 *
 * - **Flags** are named numbers kept in the save (`"core:met-elder"`). Nothing declares
 *   them: a flag exists once an action sets it. A set flag is 1 unless given a value, and
 *   counters go up with `add`.
 * - **Conditions** test the save: flags, quest progress, items in the bag, money, the Dex
 *   and the boss log; badges and trainers beaten (C27). `not`, `all` and `any` combine them.
 * - **Actions** change it: set or clear flags, give or take items and money, start quests,
 *   give badges (C27).
 * - **Dialogues** (`dialogues` registry) are graphs of nodes. A node says some pages, runs
 *   its actions, then offers choices, branches on conditions, goes to another node, or ends.
 *   A node can also start a battle (C27): a trainer or a boss. After a win (or a catch) the
 *   dialogue goes on at `win`; any other outcome ends it.
 * - **Quests** (`quests` registry) are steps in order. A step is done when its condition
 *   holds (checked after every change), so dialogue moves a quest on by setting a flag. The
 *   last step done completes the quest and pays its reward.
 */

import {
  defineRegistry,
  type CheckContext,
  type EntryOf,
  type EntryProblem,
  type EntryRef,
} from '@engine/packs';
import { z } from 'zod';
import { description, name, ref, refTo } from './common';

// ------------------------------------------------------------------ conditions

export const QUEST_STATES = ['new', 'active', 'done'] as const;
export type QuestState = (typeof QUEST_STATES)[number];

/** A test of the save. Several keys in one object are not allowed: use `all`. */
export type StoryCondition =
  /** The flag is at least `atLeast` (default 1, i.e. set). */
  | { readonly flag: string; readonly atLeast?: number | undefined }
  /** The quest is not started (`new`), `active` (at `step` when given) or `done`. */
  | { readonly quest: string; readonly is: QuestState; readonly step?: string | undefined }
  /** At least `count` (default 1) of an item in the bag. */
  | { readonly has: string; readonly count?: number | undefined }
  /** At least this much money. */
  | { readonly money: number }
  /** The species is caught (in the Dex). */
  | { readonly caught: string }
  /** The species is seen (in the Dex). */
  | { readonly seen: string }
  /** The boss is beaten or caught. */
  | { readonly boss: string }
  /** The badge is held. */
  | { readonly badge: string }
  /** At least this many badges are held. */
  | { readonly badges: number }
  /** The trainer was beaten at least `times` (default 1) times. */
  | { readonly beat: string; readonly times?: number | undefined }
  | { readonly not: StoryCondition }
  | { readonly all: readonly StoryCondition[] }
  | { readonly any: readonly StoryCondition[] };

const positive = z.number().int().min(1);

export const storyConditionSchema: z.ZodType<StoryCondition> = z.lazy(() =>
  z.union([
    z.strictObject({ flag: ref, atLeast: z.number().int().optional() }),
    z.strictObject({ quest: ref, is: z.enum(QUEST_STATES), step: z.string().min(1).optional() }),
    z.strictObject({ has: ref, count: positive.optional() }),
    z.strictObject({ money: z.number().int().min(0) }),
    z.strictObject({ caught: ref }),
    z.strictObject({ seen: ref }),
    z.strictObject({ boss: ref }),
    z.strictObject({ badge: ref }),
    z.strictObject({ badges: z.number().int().min(0) }),
    z.strictObject({ beat: ref, times: positive.optional() }),
    z.strictObject({ not: storyConditionSchema }),
    z.strictObject({ all: z.array(storyConditionSchema).min(1) }),
    z.strictObject({ any: z.array(storyConditionSchema).min(1) }),
  ]),
);

// ------------------------------------------------------------------ actions

export const storyActionSchema = z.union([
  /** Sets a flag (to 1, or to `value`; 0 clears it). */
  z.strictObject({ set: ref, value: z.number().int().optional() }),
  /** Adds `by` (default 1) to a flag: a counter. */
  z.strictObject({ add: ref, by: z.number().int().optional() }),
  z.strictObject({ clear: ref }),
  /** Puts items in the bag (up to its cap). */
  z.strictObject({ give: ref, count: positive.optional() }),
  /** Takes items from the bag (as many as there are, up to `count`). */
  z.strictObject({ take: ref, count: positive.optional() }),
  /** Gives money; a negative amount takes it (never below 0). */
  z.strictObject({ money: z.number().int() }),
  /** Starts a quest (nothing happens if it was started before). */
  z.strictObject({ start: ref }),
  /** Gives a badge (nothing happens if it is held already). */
  z.strictObject({ badge: ref }),
]);
export type StoryAction = z.output<typeof storyActionSchema>;
/** An action as written in pack data (plain-string ids); every `StoryAction` is one. */
export type StoryActionInput = z.input<typeof storyActionSchema>;

const actions = z.array(storyActionSchema).max(16);

// ------------------------------------------------------------------ dialogues

const nodeId = z.string().min(1).max(40);

/** A battle a dialogue node starts: a trainer, or a boss (wild-style; a rematch once done). */
export const dialogueBattleSchema = z.union([
  z.strictObject({ trainer: ref }),
  z.strictObject({ boss: ref }),
]);
export type DialogueBattle = z.output<typeof dialogueBattleSchema>;
const page = z.string().min(1).max(240);

export const dialogueChoiceSchema = z.strictObject({
  text: z.string().min(1).max(40),
  /** Shown only while this holds. */
  if: storyConditionSchema.optional(),
  do: actions.optional(),
  /** Node to go to; the dialogue ends when left out. */
  goto: nodeId.optional(),
});
export type DialogueChoice = z.output<typeof dialogueChoiceSchema>;

export const dialogueNodeSchema = z
  .strictObject({
    /** Pages to show, one dialog page each. */
    say: z.array(page).max(12).optional(),
    /** Who speaks; default the NPC talked to. */
    speaker: name.optional(),
    /** Run when the node is reached (before its pages show, so notes can follow them). */
    do: actions.optional(),
    /** Shown with the last page; the player picks one. `Q` picks the last one. */
    choices: z.array(dialogueChoiceSchema).min(1).max(4).optional(),
    /** The first case whose condition holds decides the next node… */
    branch: z.array(z.strictObject({ if: storyConditionSchema, goto: nodeId })).optional(),
    /** …else this node (or the end, when left out). */
    goto: nodeId.optional(),
    /** After the pages, a battle (C27). Won (or caught): on to `win`; else the dialogue ends. */
    battle: dialogueBattleSchema.optional(),
    win: nodeId.optional(),
  })
  .superRefine((n, ctx) => {
    if (n.choices && (n.branch || n.goto)) {
      ctx.addIssue({ code: 'custom', path: ['choices'], message: 'Choices end a node' });
    }
    if (n.battle && (n.choices || n.branch || n.goto)) {
      ctx.addIssue({ code: 'custom', path: ['battle'], message: 'A battle ends a node (use win)' });
    }
    if (n.win && !n.battle) {
      ctx.addIssue({ code: 'custom', path: ['win'], message: 'win needs a battle' });
    }
  });
export type DialogueNode = z.output<typeof dialogueNodeSchema>;

export const dialogueSchema = z
  .strictObject({
    start: nodeId,
    nodes: z.record(nodeId, dialogueNodeSchema),
  })
  .superRefine((d, ctx) => {
    const has = (id: string): boolean => Object.hasOwn(d.nodes, id);
    if (!has(d.start)) ctx.addIssue({ code: 'custom', path: ['start'], message: 'No such node' });
    for (const [id, n] of Object.entries(d.nodes)) {
      const targets: [string, PropertyKey[]][] = [];
      if (n.goto) targets.push([n.goto, ['goto']]);
      if (n.win) targets.push([n.win, ['win']]);
      n.branch?.forEach((b, i) => targets.push([b.goto, ['branch', i, 'goto']]));
      n.choices?.forEach((c, i) => c.goto && targets.push([c.goto, ['choices', i, 'goto']]));
      for (const [t, path] of targets) {
        if (!has(t)) {
          ctx.addIssue({ code: 'custom', path: ['nodes', id, ...path], message: `No node "${t}"` });
        }
      }
    }
  });

export const dialogues = defineRegistry('dialogues', dialogueSchema, {
  refs: (d) =>
    Object.entries(d.nodes).flatMap(([id, n]) => [
      ...(n.do ?? []).flatMap((a, i) => actionRefs(a, 'nodes', id, 'do', i)),
      ...(n.battle ? [battleRef(n.battle, 'nodes', id, 'battle')] : []),
      ...(n.branch ?? []).flatMap((b, i) => conditionRefs(b.if, 'nodes', id, 'branch', i, 'if')),
      ...(n.choices ?? []).flatMap((c, i) => [
        ...(c.if ? conditionRefs(c.if, 'nodes', id, 'choices', i, 'if') : []),
        ...(c.do ?? []).flatMap((a, j) => actionRefs(a, 'nodes', id, 'choices', i, 'do', j)),
      ]),
    ]),
  check: (d, ctx) =>
    Object.entries(d.nodes).flatMap(([id, n]) => [
      ...(n.branch ?? []).flatMap((b, i) => stepProblems(b.if, ctx, 'nodes', id, 'branch', i)),
      ...(n.choices ?? []).flatMap((c, i) =>
        c.if ? stepProblems(c.if, ctx, 'nodes', id, 'choices', i) : [],
      ),
    ]),
});
export type DialogueData = z.output<typeof dialogueSchema>;
export type Dialogue = EntryOf<typeof dialogues>;
export type DialogueInput = z.input<typeof dialogueSchema>;

// ------------------------------------------------------------------ quests

export const questStepSchema = z.strictObject({
  id: nodeId,
  /** What the quest log says to do. */
  text: z.string().min(1).max(80),
  /** The step is done once this holds. */
  done: storyConditionSchema,
  /** Run when the step is done. */
  do: actions.optional(),
});
export type QuestStep = z.output<typeof questStepSchema>;

export const questSchema = z
  .strictObject({
    name: z.string().min(1).max(32),
    /** One or two sentences for the quest log. */
    summary: description,
    /** Who gave it (the log says "From …"). */
    from: name.optional(),
    steps: z.array(questStepSchema).min(1).max(12),
    reward: z
      .strictObject({
        money: z.number().int().min(0).optional(),
        items: z.record(ref, positive).optional(),
      })
      .default({}),
  })
  .superRefine((q, ctx) => {
    const ids = q.steps.map((s) => s.id);
    ids.forEach((id, i) => {
      if (ids.indexOf(id) !== i) {
        ctx.addIssue({ code: 'custom', path: ['steps', i, 'id'], message: 'Step id used twice' });
      }
    });
  });

export const quests = defineRegistry('quests', questSchema, {
  refs: (q) => [
    ...q.steps.flatMap((s, i) => [
      ...conditionRefs(s.done, 'steps', i, 'done'),
      ...(s.do ?? []).flatMap((a, j) => actionRefs(a, 'steps', i, 'do', j)),
    ]),
    ...Object.keys(q.reward.items ?? {}).map((id) => refTo('items', id, 'reward', 'items', id)),
  ],
  check: (q, ctx) => q.steps.flatMap((s, i) => stepProblems(s.done, ctx, 'steps', i, 'done')),
});
export type QuestData = z.output<typeof questSchema>;
export type Quest = EntryOf<typeof quests>;
export type QuestInput = z.input<typeof questSchema>;

// ------------------------------------------------------------------ helpers

/** Every condition inside `c`, itself included. */
export function eachCondition(c: StoryCondition): StoryCondition[] {
  if ('not' in c) return [c, ...eachCondition(c.not)];
  if ('all' in c) return [c, ...c.all.flatMap(eachCondition)];
  if ('any' in c) return [c, ...c.any.flatMap(eachCondition)];
  return [c];
}

export function conditionRefs(c: StoryCondition, ...path: PropertyKey[]): EntryRef[] {
  return eachCondition(c).flatMap((x): EntryRef[] => {
    if ('quest' in x) return [refTo('quests', x.quest, ...path)];
    if ('has' in x) return [refTo('items', x.has, ...path)];
    if ('caught' in x) return [refTo('species', x.caught, ...path)];
    if ('seen' in x) return [refTo('species', x.seen, ...path)];
    if ('boss' in x) return [refTo('bosses', x.boss, ...path)];
    if ('badge' in x) return [refTo('badges', x.badge, ...path)];
    if ('beat' in x) return [refTo('trainers', x.beat, ...path)];
    return [];
  });
}

function actionRefs(a: StoryAction, ...path: PropertyKey[]): EntryRef[] {
  if ('give' in a) return [refTo('items', a.give, ...path)];
  if ('take' in a) return [refTo('items', a.take, ...path)];
  if ('start' in a) return [refTo('quests', a.start, ...path)];
  if ('badge' in a) return [refTo('badges', a.badge, ...path)];
  return [];
}

function battleRef(b: DialogueBattle, ...path: PropertyKey[]): EntryRef {
  return 'trainer' in b ? refTo('trainers', b.trainer, ...path) : refTo('bosses', b.boss, ...path);
}

/** `{ quest, step }` conditions must name a step the quest has. */
function stepProblems(
  c: StoryCondition,
  ctx: CheckContext,
  ...path: PropertyKey[]
): EntryProblem[] {
  return eachCondition(c).flatMap((x): EntryProblem[] => {
    if (!('quest' in x) || x.step === undefined) return [];
    const q = ctx.get('quests', x.quest) as QuestData | undefined;
    if (!q || q.steps.some((s) => s.id === x.step)) return [];
    return [{ path, message: `Quest "${x.quest}" has no step "${x.step}"` }];
  });
}
