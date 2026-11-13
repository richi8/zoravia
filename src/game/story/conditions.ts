/** Story conditions (C26): tests of the party's state. Pure. */

import type { GameContent, QuestState, StoryCondition } from '@game/data';
import { bagCount } from '@game/inventory';
import { bossDone, type Party } from '@game/player';

/** A flag's value (0 when not set). */
export function flagValue(party: Party, flag: string): number {
  return party.flags[flag] ?? 0;
}

/** `new` (not started), `active` or `done`. */
export function questState(party: Party, quest: string): QuestState {
  return party.quests[quest]?.state ?? 'new';
}

/** The step an active quest is at. */
export function questStep(party: Party, quest: string): string | undefined {
  const q = party.quests[quest];
  return q?.state === 'active' ? q.step : undefined;
}

export function holds(content: GameContent, party: Party, c: StoryCondition): boolean {
  if ('flag' in c) return flagValue(party, c.flag) >= (c.atLeast ?? 1);
  if ('quest' in c) {
    const state = questState(party, c.quest);
    if (state !== c.is) return false;
    return c.step === undefined || questStep(party, c.quest) === c.step;
  }
  if ('has' in c) return bagCount(party.bag, c.has) >= (c.count ?? 1);
  if ('money' in c) return party.money >= c.money;
  if ('caught' in c) return party.dex.caught.includes(c.caught);
  if ('seen' in c) return party.dex.seen.includes(c.seen);
  if ('boss' in c) return bossDone(party.bosses, c.boss);
  if ('not' in c) return !holds(content, party, c.not);
  if ('all' in c) return c.all.every((x) => holds(content, party, x));
  return c.any.some((x) => holds(content, party, x));
}
