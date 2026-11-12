/**
 * Battle text: the line(s) the message box shows for each engine event. Pure, so every
 * event's wording is unit-tested. `shown` is the screen *before* the event.
 */

import type { GameContent } from '@game/data';
import type { ProgressEvent } from '@game/progression';
import { OPPONENT, PLAYER, type BattleEvent, type SideId } from '../logic';
import { shownActive, type Shown, type ShownZorling } from './shown';

export interface TextContext {
  /** Trainer battles: the trainer's name ("Rival Mira"). Default "The trainer". */
  readonly trainer?: string;
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** How a Zorling is named mid-sentence: "Puddlit", "the wild Emberkit", "the foe's Voltbat". */
export function nameOf(shown: Shown, side: SideId, z: ShownZorling): string {
  if (side === PLAYER) return z.name;
  if (z.boss) return `the ${z.name}`;
  return shown.kind === 'wild' ? `the wild ${z.name}` : `the foe's ${z.name}`;
}

/** Lines for one event; empty for events that show no text. */
export function eventText(
  content: GameContent,
  shown: Shown,
  e: BattleEvent,
  ctx: TextContext = {},
): string[] {
  const trainer = ctx.trainer ?? 'The trainer';
  const who = (side: SideId): string => nameOf(shown, side, shownActive(shown, side));
  const Who = (side: SideId): string => cap(who(side));
  const slotName = (side: SideId, slot: number): string => {
    const z = shown.sides[side].team[slot];
    return z ? nameOf(shown, side, z) : '?';
  };
  const moveName = (id: string): string => content.moves.require(id).name;
  const statusName = (id: string): string =>
    content.conditions.get(id)?.name ?? content.reactions.require(id).name;

  switch (e.kind) {
    case 'sendOut': {
      const z = shown.sides[e.side].team[e.slot];
      if (!z) return [];
      if (e.side === PLAYER) return [`Go, ${z.name}!`];
      if (z.boss) {
        const kind = content.bosses.require(z.boss).kind;
        return [kind === 'titan' ? `The ${z.name} rises up!` : `${z.name} appears!`];
      }
      return shown.kind === 'wild'
        ? [`A wild ${z.name} appeared!`]
        : [`${trainer} sent out ${z.name}!`];
    }
    case 'switchOut': {
      const z = shown.sides[e.side].team[e.slot];
      if (!z) return [];
      return e.side === PLAYER ? [`Come back, ${z.name}!`] : [`${trainer} called back ${z.name}.`];
    }
    case 'useMove':
      return [`${Who(e.side)} used ${moveName(e.move)}!`];
    case 'miss':
      return [`${Who(e.side)} missed!`];
    case 'fumbled':
      return [`${Who(e.side)} is Charged and fumbled ${moveName(e.move)}!`];
    case 'skipped':
      return [`${Who(e.side)} is ${statusName(e.status)} and can't move!`];
    case 'reaction': {
      const r = content.reactions.require(e.reaction);
      const cond = content.conditions.require(e.condition).name;
      return [`${cond} reacted: ${r.name}! ${r.description.replace(/^[^:]*:\s*/, '')}`.trim()];
    }
    case 'damage':
      if (e.effectiveness > 1) return ["It's super effective!"];
      if (e.effectiveness < 1) return ["It's not very effective…"];
      return [];
    case 'fainted':
      return [`${cap(slotName(e.side, e.slot))} fainted!`];
    case 'subdued':
      return [`${cap(slotName(e.side, e.slot))} is Subdued! Throw a capture item to catch it.`];
    case 'armorBroken':
      return [`${Who(e.side)}'s Armor broke! It takes more damage for 2 turns.`];
    case 'armorRestored':
      return [`${Who(e.side)}'s Armor is back up.`];
    case 'conditionApplied': {
      const name = content.conditions.require(e.condition).name;
      if (e.source === null) return [`The weather left ${who(e.side)} ${name}!`];
      return e.refreshed
        ? [`${Who(e.side)} is still ${name} (${e.turns} turns again).`]
        : [`${Who(e.side)} is ${name}!`];
    }
    case 'conditionBlocked': {
      const trait = content.traits.require(e.trait).name;
      const name = content.conditions.require(e.condition).name;
      return [`${Who(e.side)}'s ${trait} keeps it from being ${name}!`];
    }
    case 'statusDamage':
      return [`${Who(e.side)} is hurt by ${statusName(e.status)}.`];
    case 'heal':
      return [`${cap(slotName(e.side, e.slot))} recovered ${e.amount} HP.`];
    case 'itemUsed': {
      const item = content.items.require(e.item);
      if (item.effect.kind === 'capture') return [`You threw a ${item.name}!`];
      return e.slot === null
        ? [`You used a ${item.name}.`]
        : [`You used a ${item.name} on ${slotName(e.side, e.slot)}.`];
    }
    case 'capture': {
      const name = shownActive(shown, OPPONENT).name;
      if (e.success) return [`Gotcha! ${name} was caught!`];
      return [
        ['Oh no! It broke free at once!', 'Argh! It broke free!', 'So close! It broke free!'][
          Math.min(2, e.wobbles)
        ] ?? 'It broke free!',
      ];
    }
    case 'statusEnded':
      return e.origin === 'condition'
        ? [`${Who(e.side)} is no longer ${statusName(e.status)}.`]
        : [`${statusName(e.status)} wore off ${who(e.side)}.`];
    case 'runFailed':
      return ["Couldn't get away!"];
    case 'ran':
      return ['Got away safely!'];
    case 'end':
      if (e.outcome === 'win') {
        return shown.kind === 'trainer' ? [`You beat ${trainer}!`] : [];
      }
      if (e.outcome === 'lose') return ['You have no Zorlings left that can fight…'];
      return [];
    case 'turnStart':
    case 'turnEnd':
    case 'replaceNeeded':
      return [];
  }
}

/** Lines for what a team member got after a win (XP, level ups, moves, evolution offers). */
export function progressText(content: GameContent, name: string, e: ProgressEvent): string[] {
  switch (e.kind) {
    case 'xp':
      return [`${name} gained ${e.amount} XP${e.reduced ? ' (reduced above the level cap)' : ''}.`];
    case 'levelUp':
      return [`${name} grew to Lv ${e.level}!`];
    case 'learned': {
      const move = content.moves.require(e.move).name;
      return e.replaced
        ? [`${name} forgot ${content.moves.require(e.replaced).name} and learned ${move}!`]
        : [`${name} learned ${move}!`];
    }
    case 'moveOffer':
      return [
        `${name} wants to learn ${content.moves.require(e.move).name}, but already knows 3 moves.`,
      ];
    case 'canEvolve':
      return [`${name} is ready to evolve into ${content.species.require(e.into).name}!`];
    case 'evolved':
      return [`${name} evolved into ${content.species.require(e.into).name}!`];
  }
}
