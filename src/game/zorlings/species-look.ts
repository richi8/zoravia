/**
 * What a species looks like: its line's final-form genome (from the species `look`), the
 * stage variant for earlier forms, and the battle sprite options for boss form and the
 * Titan mark. Pure and cached per content.
 */

import type { GameContent } from '@game/data';
import { styleTypes } from '@game/style/ids';
import { generateGenome, type ZorlingGenome } from './genome';
import { SPRITE_SIZE } from './render';
import { stageFill, stageGenome, stageGrowth, TITAN_SIZE, titanGenome } from './variants';

export interface SpeciesLook {
  readonly genome: ZorlingGenome;
  /** Fraction of the battle frame the figure spans (smaller for early stages). */
  readonly fill: number;
}

/** How to draw a Zorling in battle. */
export interface BattleLook extends SpeciesLook {
  /** Battle sprite size: 96, or 128 for Titans, Titan-marked Zorlings and legendaries. */
  readonly size: number;
  /** Draw the Titan glow/aura. */
  readonly titan: boolean;
}

const cache = new WeakMap<GameContent, Map<string, SpeciesLook>>();

/** The genome of a species, derived from its line's final form. */
export function speciesLook(content: GameContent, speciesId: string): SpeciesLook {
  let byId = cache.get(content);
  if (!byId) cache.set(content, (byId = new Map()));
  const have = byId.get(speciesId);
  if (have) return have;

  const line = content.evolutionLine(speciesId);
  const final = line.members[line.members.length - 1];
  if (!final) throw new Error(`Species "${speciesId}" has no line`);
  const types = styleTypes(final.types);
  const look = final.look;
  const genome = generateGenome(look?.seed ?? final.id, {
    ...(look?.plan ? { plan: look.plan } : {}),
    ...(look?.mood ? { mood: look.mood } : {}),
    ...(types[0] ? { types: types[1] ? [types[0], types[1]] : [types[0]] } : {}),
  });
  const of = line.members.length as 1 | 2 | 3;
  const growth = stageGrowth(line.stage, of);
  const result: SpeciesLook = {
    genome: stageGenome(genome, line.stage, of),
    fill: stageFill(growth),
  };
  byId.set(speciesId, result);
  return result;
}

/**
 * The battle look of a Zorling. In boss form a Titan is bulkier, bigger and glows; a
 * legendary is drawn big. A caught Titan keeps the Titan mark (bigger, glowing).
 */
export function battleLook(
  content: GameContent,
  speciesId: string,
  opts: { readonly boss?: 'titan' | 'legendary'; readonly titanMark?: boolean } = {},
): BattleLook {
  const base = speciesLook(content, speciesId);
  if (opts.boss === 'titan' || opts.titanMark) {
    return { genome: titanGenome(base.genome), fill: base.fill, size: TITAN_SIZE, titan: true };
  }
  if (opts.boss === 'legendary' || content.species.require(speciesId).legendary) {
    return { ...base, size: TITAN_SIZE, titan: false };
  }
  return { ...base, size: SPRITE_SIZE.battle, titan: false };
}
