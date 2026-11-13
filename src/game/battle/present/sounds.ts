/**
 * Which sounds a battle event makes (C24). Pure: the scene decides when to play them (a move's
 * sound when its VFX launches, a hit's when it lands). The switch is exhaustive, so a new event
 * kind must decide on its sound.
 */

import type { SfxId } from '@game/audio/sfx';
import { moveSfxId } from '@game/audio/sfx';
import type { GameContent } from '@game/data';
import type { ProgressEvent } from '@game/progression';
import { typeIdOf } from '@game/style/ids';
import type { BattleEvent, SideId } from '../logic';
import { shownActive, type Shown } from './shown';

export type BattleCue =
  | { readonly kind: 'sfx'; readonly id: SfxId; readonly gain?: number; readonly pitch?: number }
  /** The cry of the Zorling in `slot` of `side`; `faint` = the low, slow version. */
  | {
      readonly kind: 'cry';
      readonly side: SideId;
      readonly slot: number;
      readonly faint?: boolean;
    };

const sfx = (id: SfxId, gain?: number, pitch?: number): BattleCue => ({
  kind: 'sfx',
  id,
  ...(gain !== undefined ? { gain } : {}),
  ...(pitch !== undefined ? { pitch } : {}),
});

/**
 * The sounds of one event. `shown` is the screen before the event. Events that only mark
 * time (`turnStart`, `turnEnd`, `replaceNeeded`) are silent.
 */
export function eventCues(content: GameContent, shown: Shown, e: BattleEvent): BattleCue[] {
  switch (e.kind) {
    case 'sendOut':
      return [sfx('battle.sendOut'), { kind: 'cry', side: e.side, slot: e.slot }];
    case 'switchOut':
      return [sfx('battle.switchOut')];
    case 'useMove': {
      const move = content.moves.require(e.move);
      return [sfx(moveSfxId(typeIdOf(move.type), move.power === 0))];
    }
    case 'miss':
      return [sfx('battle.miss')];
    case 'fumbled':
      return [sfx('battle.fumble')];
    case 'skipped':
      return [sfx('battle.skipped')];
    case 'reaction':
      return [sfx('battle.reaction')];
    case 'damage': {
      const max = Math.max(1, shownActive(shown, e.side).maxHp);
      const gain = 0.7 + Math.min(1, (e.amount / max) * 2) * 0.5;
      const id: SfxId =
        e.effectiveness > 1
          ? 'battle.hitStrong'
          : e.effectiveness < 1
            ? 'battle.hitWeak'
            : 'battle.hit';
      return [sfx(id, gain)];
    }
    case 'fainted':
      return [{ kind: 'cry', side: e.side, slot: e.slot, faint: true }, sfx('battle.faint')];
    case 'subdued':
      return [{ kind: 'cry', side: e.side, slot: e.slot, faint: true }, sfx('battle.subdued')];
    case 'armorBroken':
      return [sfx('battle.armorBreak')];
    case 'armorRestored':
      return [sfx('battle.armorRestore')];
    case 'conditionApplied':
      return [sfx('battle.condition', e.refreshed ? 0.6 : 1)];
    case 'conditionBlocked':
      return [sfx('battle.conditionBlocked')];
    case 'statusDamage':
      return [sfx('battle.statusTick')];
    case 'heal':
      return [sfx('battle.heal')];
    case 'itemUsed':
      return [sfx('battle.item')];
    case 'capture':
      // The rest (absorb, drop, wobbles, result) follows the capture animation.
      return [sfx('battle.throw')];
    case 'statusEnded':
      return [sfx('battle.statusEnded')];
    case 'runFailed':
      return [sfx('ui.blocked')];
    case 'ran':
      return [sfx('battle.run')];
    case 'end':
      return e.outcome === 'win'
        ? [sfx('battle.victory')]
        : e.outcome === 'lose'
          ? [sfx('battle.defeat')]
          : [];
    case 'turnStart':
    case 'turnEnd':
    case 'replaceNeeded':
      return [];
  }
}

/** The sound of an XP / level-up line after the battle. */
export function progressCue(e: ProgressEvent): SfxId | undefined {
  switch (e.kind) {
    case 'levelUp':
      return 'battle.levelUp';
    case 'learned':
      return 'battle.learned';
    case 'moveOffer':
    case 'canEvolve':
      return 'ui.open';
    case 'evolved':
      return 'world.evolve';
    case 'xp':
      return undefined;
  }
}
