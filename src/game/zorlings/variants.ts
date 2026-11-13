/**
 * Variants derived from one genome (pure, deterministic):
 *
 * - **Evolution stages**: a species line shares one genome — the *final* form. Earlier stages
 *   are derived from it: rounder and paler, fewer adult parts, sometimes another body plan,
 *   and a smaller figure in the frame (see `stageGenome`).
 * - **Titan**: a bulkier body, drawn bigger (128×128) with a glowing aura (`animate.ts`).
 */

import { mix } from '@engine/core/color';
import type { BodyPlan, BodyShape, ZorlingGenome, ZorlingParts } from './genome';

export type StageCount = 1 | 2 | 3;

/** Titan battle sprite size (DESIGN.md "Presentation"). */
export const TITAN_SIZE = 128;

/**
 * How grown-up a stage is: 0 = baby, 1 = final form. Two-stage lines start a bit older than
 * three-stage ones.
 */
export function stageGrowth(stage: number, of: StageCount): number {
  if (!Number.isInteger(stage) || stage < 1 || stage > of) {
    throw new Error(`stageGrowth: stage ${stage} of ${of} is out of range`);
  }
  if (of === 1) return 1;
  if (of === 2) return stage === 1 ? 0.25 : 1;
  return [0, 0.55, 1][stage - 1] ?? 1;
}

/** Fraction of the battle frame the figure spans at a growth level. */
export function stageFill(growth: number): number {
  return 0.6 + 0.4 * growth;
}

const clamp01 = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 100) / 100;

/** Plans that keep their wings in every stage: the line always flies. */
const FLYERS: readonly BodyPlan[] = ['avian', 'bat', 'insect', 'raptor'];
const CREAM = 0xfff3dc;

/**
 * The genome of an evolution stage, derived from the final form's genome. Stages differ in
 * more than size (C29):
 *
 * - **Baby** (stage 1 of 2 or 3): round, big head and eyes, paler colors, fawn spots instead
 *   of the adult pattern, horn nubs at most, no back plates, and no wings unless the line
 *   always flies. Fancy tails (flame, club, bolt) are plain.
 * - **Teen** (stage 2 of 3): the first adult features — a single horn for antlers, spikes for
 *   plates, sails or crystals, the adult markings — still wingless, a little paler.
 * - **Final**: the genome itself.
 *
 * `young` optionally gives earlier stages another body plan (metamorphosis): `young[0]` for
 * stage 1, `young[1]` for stage 2. Identity (palette, ears, tail, types) carries over.
 */
export function stageGenome(
  genome: ZorlingGenome,
  stage: number,
  of: StageCount,
  young: readonly BodyPlan[] = [],
): ZorlingGenome {
  const growth = stageGrowth(stage, of);
  if (growth >= 1) return genome;
  const k = 1 - growth; // "babyness"
  const baby = k >= 0.7;
  const b = genome.body;
  const body: BodyShape = {
    length: clamp01(b.length * (1 - 0.55 * k)),
    height: clamp01(b.height * (1 - 0.35 * k)),
    head: clamp01(b.head + 0.6 * k),
    limbs: clamp01(b.limbs * (1 - 0.7 * k)),
    // Young ones are round: thin adults fill out, bulky ones slim down a little.
    bulk: clamp01(b.bulk + (0.55 - b.bulk) * 0.7 * k),
  };
  const plan = young[stage - 1] ?? genome.plan;
  const flyer = FLYERS.includes(plan);
  const p = genome.parts;
  const parts: ZorlingParts = baby
    ? {
        ...p,
        horns: p.horns === 'none' ? 'none' : 'nubs',
        back: p.back === 'leaves' ? 'leaves' : 'none',
        wings: flyer ? (p.wings === 'none' ? 'feather' : p.wings) : 'none',
        markings: p.markings === 'none' || p.markings === 'stripes' ? 'spots' : 'none',
        tail:
          p.tail === 'club' || p.tail === 'bolt' ? 'thin' : p.tail === 'flame' ? 'fluffy' : p.tail,
        ears: p.ears === 'tuft' ? 'round' : p.ears,
        eyes: 'big',
        mouth: p.mouth === 'none' ? 'none' : 'smile',
        snout: p.snout === 'long' ? 'short' : p.snout,
      }
    : {
        ...p,
        horns: p.horns === 'antlers' ? 'single' : p.horns === 'curved' ? 'pair' : p.horns,
        back:
          p.back === 'plates' || p.back === 'sail' || p.back === 'crystals'
            ? 'spikes'
            : p.back === 'mane'
              ? 'none'
              : p.back,
        wings: flyer ? p.wings : 'none',
        eyes: p.eyes === 'fierce' || p.eyes === 'slit' ? 'round' : p.eyes,
        mouth: p.mouth === 'fangs' ? 'fang' : p.mouth,
      };
  const pal = genome.palette;
  const palette = {
    ...pal,
    primary: mix(pal.primary, CREAM, baby ? 0.22 : 0.1),
    belly: mix(pal.belly, CREAM, baby ? 0.3 : 0.12),
  };
  // Fierce adults start out cute; dark lines stay dark (they keep their glow).
  const mood = genome.mood === 'fierce' ? 'cute' : genome.mood;
  return { ...genome, plan, mood, body, parts, palette };
}

/** A Titan's body: bulkier and longer-limbed than its species. */
export function titanGenome(genome: ZorlingGenome): ZorlingGenome {
  const b = genome.body;
  return {
    ...genome,
    body: { ...b, bulk: clamp01(b.bulk + 0.3), limbs: clamp01(b.limbs + 0.15) },
  };
}
