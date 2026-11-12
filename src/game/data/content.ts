/**
 * Game content: every registry the game reads from packs, loaded together, with lookups the
 * rest of the game shares (effectiveness, reactions, evolution lines).
 */

import {
  PackLoader,
  type HookMap,
  type LoadedContent,
  type PackDefinition,
  type Registry,
} from '@engine/packs';
import { bosses, type Boss } from './bosses';
import { conditions, type Condition } from './conditions';
import { items, type Item } from './items';
import { moves, type Move } from './moves';
import { reactions, type Reaction } from './reactions';
import { species, type Species } from './species';
import { traits, type Trait } from './traits';
import { STRONG_MULTIPLIER, types, WEAK_MULTIPLIER, type ZorlingType } from './types';

export const GAME_REGISTRIES = [
  types,
  conditions,
  reactions,
  moves,
  traits,
  species,
  items,
  bosses,
];

export interface EvolutionLine {
  /** Species in stage order. */
  readonly members: readonly Species[];
  /** 1-based stage of the asked species. */
  readonly stage: number;
}

export class GameContent<H extends HookMap = HookMap> {
  readonly types: Registry<ZorlingType>;
  readonly conditions: Registry<Condition>;
  readonly reactions: Registry<Reaction>;
  readonly moves: Registry<Move>;
  readonly traits: Registry<Trait>;
  readonly species: Registry<Species>;
  readonly items: Registry<Item>;
  readonly bosses: Registry<Boss>;
  private readonly reactionIndex = new Map<string, Reaction>();

  constructor(readonly loaded: LoadedContent<H>) {
    this.types = loaded.registry(types);
    this.conditions = loaded.registry(conditions);
    this.reactions = loaded.registry(reactions);
    this.moves = loaded.registry(moves);
    this.traits = loaded.registry(traits);
    this.species = loaded.registry(species);
    this.items = loaded.registry(items);
    this.bosses = loaded.registry(bosses);
    for (const r of this.reactions) this.reactionIndex.set(`${r.condition}|${r.type}`, r);
  }

  /** Damage multiplier of a move type against a defender's types. */
  effectiveness(moveType: string, defenderTypes: readonly string[]): number {
    const attack = this.types.require(moveType);
    let m = 1;
    for (const id of defenderTypes) {
      const def = this.types.require(id);
      if (attack.strongAgainst.includes(def.id)) m *= STRONG_MULTIPLIER;
      if (def.resists.includes(attack.id)) m *= WEAK_MULTIPLIER;
    }
    return m;
  }

  /** The reaction a move of `moveType` triggers on a target with `condition`, if any. */
  reactionFor(condition: string, moveType: string): Reaction | undefined {
    return this.reactionIndex.get(`${condition}|${moveType}`);
  }

  /** Reactions that exploit a condition. */
  reactionsOn(condition: string): Reaction[] {
    return this.reactions.values().filter((r) => r.condition === condition);
  }

  /** The condition a type's moves apply. */
  conditionOf(type: string): Condition {
    return this.conditions.require(this.types.require(type).applies);
  }

  /** The full evolution line a species belongs to. */
  evolutionLine(id: string): EvolutionLine {
    let first = this.species.require(id);
    for (;;) {
      const parent = this.species.values().find((s) => s.evolution?.into === first.id);
      if (!parent) break;
      first = parent;
    }
    const members: Species[] = [first];
    let cur = first;
    while (cur.evolution) {
      cur = this.species.require(cur.evolution.into);
      members.push(cur);
    }
    return { members, stage: members.findIndex((s) => s.id === id) + 1 };
  }
}

/** Loads packs into all game registries. Throws `PackError` listing every problem. */
export function loadGameContent<H extends HookMap = HookMap>(
  packs: readonly PackDefinition<H>[],
): GameContent<H> {
  return new GameContent(new PackLoader<H>(GAME_REGISTRIES).load(packs));
}
