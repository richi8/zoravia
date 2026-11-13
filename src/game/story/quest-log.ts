/** Quest log entries (C26, `J`): what the player has started, as plain data. Pure. */

import type { GameContent } from '@game/data';
import type { Party } from '@game/player';

export interface QuestLogEntry {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly from: string | undefined;
  readonly done: boolean;
  /** Steps reached so far, in order; the last one is the current step unless `done`. */
  readonly steps: readonly { readonly text: string; readonly done: boolean }[];
  /** The reward, in words ("300 coins, Super Potion"); empty when there is none. */
  readonly reward: string;
}

/** Active quests first (newest first), then finished ones (newest first). */
export function questLog(content: GameContent, party: Party): QuestLogEntry[] {
  const entries: QuestLogEntry[] = [];
  for (const [id, progress] of Object.entries(party.quests)) {
    if (!content.quests.has(id)) continue;
    const q = content.quests.require(id);
    const done = progress.state === 'done';
    const at = done ? q.steps.length : q.steps.findIndex((s) => s.id === progress.step);
    const reached = done ? q.steps : q.steps.slice(0, Math.max(0, at) + 1);
    entries.push({
      id,
      name: q.name,
      summary: q.summary,
      from: q.from,
      done,
      steps: reached.map((s, i) => ({ text: s.text, done: done || i < at })),
      reward: rewardText(content, q.reward),
    });
  }
  const active = entries.filter((e) => !e.done).reverse();
  const finished = entries.filter((e) => e.done).reverse();
  return [...active, ...finished];
}

function rewardText(
  content: GameContent,
  reward: {
    readonly money?: number | undefined;
    readonly items?: Readonly<Record<string, number>> | undefined;
  },
): string {
  const parts: string[] = [];
  if (reward.money) parts.push(`${reward.money} coins`);
  for (const [id, n] of Object.entries(reward.items ?? {})) {
    const name = content.items.require(id).name;
    parts.push(n === 1 ? name : `${n} × ${name}`);
  }
  return parts.join(', ');
}
