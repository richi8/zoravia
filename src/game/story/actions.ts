/**
 * Story actions (C26) and quest progress. Pure: every function returns a new party and the
 * notes to show the player ("You received 2 × Potion.", "Quest complete: …").
 */

import type { GameContent, Quest, StoryActionInput } from '@game/data';
import { addToBag, bagCount, takeFromBag } from '@game/inventory';
import type { Party } from '@game/player';
import { holds } from './conditions';

/** How quest notes start (the scene picks a chime by them). */
export const QUEST_NOTE = {
  started: 'New quest: ',
  updated: 'Quest updated: ',
  done: 'Quest complete: ',
} as const;

export interface Acted {
  readonly party: Party;
  /** What happened, in plain words, in order. */
  readonly notes: readonly string[];
}

/** Runs actions in order, then moves quests on (`advanceQuests`). */
export function act(
  content: GameContent,
  party: Party,
  actions: readonly StoryActionInput[],
): Acted {
  const ran = runActions(content, party, actions);
  const moved = advanceQuests(content, ran.party);
  return { party: moved.party, notes: [...ran.notes, ...moved.notes] };
}

/** Runs actions in order, without moving quests on. */
export function runActions(
  content: GameContent,
  party: Party,
  actions: readonly StoryActionInput[],
): Acted {
  const notes: string[] = [];
  let p = party;
  for (const a of actions) p = runAction(content, p, a, notes);
  return { party: p, notes };
}

function runAction(content: GameContent, p: Party, a: StoryActionInput, notes: string[]): Party {
  if ('set' in a) return withFlag(p, a.set, a.value ?? 1);
  if ('add' in a) return withFlag(p, a.add, (p.flags[a.add] ?? 0) + (a.by ?? 1));
  if ('clear' in a) return withFlag(p, a.clear, 0);
  if ('give' in a) {
    const item = content.items.require(a.give);
    const count = a.count ?? 1;
    const { bag, added } = addToBag(content, p.bag, a.give, count);
    if (added > 0) notes.push(`You received ${amount(added, item.name)}.`);
    if (added < count) notes.push(`Your bag can't hold more ${item.name}s.`);
    return { ...p, bag };
  }
  if ('take' in a) {
    const item = content.items.require(a.take);
    const n = Math.min(a.count ?? 1, bagCount(p.bag, a.take));
    if (n === 0) return p;
    notes.push(`You handed over ${amount(n, item.name)}.`);
    return { ...p, bag: takeFromBag(p.bag, a.take, n) };
  }
  if ('money' in a) {
    const money = Math.max(0, p.money + a.money);
    const diff = money - p.money;
    if (diff > 0) notes.push(`You received ${coins(diff)} coins.`);
    if (diff < 0) notes.push(`You paid ${coins(-diff)} coins.`);
    return { ...p, money };
  }
  // start
  if (p.quests[a.start]) return p;
  const quest = content.quests.require(a.start);
  const first = quest.steps[0];
  if (!first) return p;
  notes.push(`${QUEST_NOTE.started}${quest.name}`);
  return { ...p, quests: { ...p.quests, [quest.id]: { state: 'active', step: first.id } } };
}

function withFlag(p: Party, flag: string, value: number): Party {
  if ((p.flags[flag] ?? 0) === value) return p;
  const { [flag]: _old, ...rest } = p.flags;
  return { ...p, flags: value === 0 ? rest : { ...rest, [flag]: value } };
}

/** Same format as the UI's money label (thin groups: 1 240). Kept here so story stays pure. */
function coins(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function amount(n: number, name: string): string {
  return n === 1 ? name : `${n} × ${name}`;
}

/** Most steps one call may finish (a guard against quests that keep starting each other). */
const MAX_STEPS = 100;

/**
 * Moves every active quest on while its current step's condition holds: runs the step's
 * actions, goes to the next step, and on the last one completes the quest and pays the
 * reward. Call it after anything that can change what conditions test.
 */
export function advanceQuests(content: GameContent, party: Party): Acted {
  const notes: string[] = [];
  let p = party;
  for (let n = 0; n < MAX_STEPS; n++) {
    const next = stepOnce(content, p, notes);
    if (!next) break;
    p = next;
  }
  return { party: p, notes };
}

/** Finishes one step of the first quest that can move on, or returns undefined. */
function stepOnce(content: GameContent, p: Party, notes: string[]): Party | undefined {
  for (const [id, progress] of Object.entries(p.quests)) {
    if (progress.state !== 'active' || !content.quests.has(id)) continue;
    const quest = content.quests.require(id);
    const index = quest.steps.findIndex((s) => s.id === progress.step);
    const step = quest.steps[index];
    if (!step || !holds(content, p, step.done)) continue;
    let next = runActions(content, p, step.do ?? []);
    notes.push(...next.notes);
    const after = quest.steps[index + 1];
    if (after) {
      notes.push(`${QUEST_NOTE.updated}${after.text}`);
      return {
        ...next.party,
        quests: { ...next.party.quests, [id]: { state: 'active', step: after.id } },
      };
    }
    notes.push(`${QUEST_NOTE.done}${quest.name}!`);
    next = runActions(content, next.party, rewardActions(quest));
    notes.push(...next.notes);
    return { ...next.party, quests: { ...next.party.quests, [id]: { state: 'done' } } };
  }
  return undefined;
}

/** A quest's reward as actions (money first, then items). */
export function rewardActions(quest: Quest): StoryActionInput[] {
  const out: StoryActionInput[] = [];
  if (quest.reward.money) out.push({ money: quest.reward.money });
  for (const [give, count] of Object.entries(quest.reward.items ?? {})) {
    out.push({ give, count });
  }
  return out;
}
