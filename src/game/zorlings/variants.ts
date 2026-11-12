/**
 * Variants derived from one genome (pure, deterministic):
 *
 * - **Evolution stages**: a species line shares one genome — the *final* form. Earlier stages
 *   are derived from it: bigger heads, shorter limbs, softer features, fewer adult parts,
 *   and a smaller figure in the frame. Identity (plan, palette, tail, ears, markings) stays.
 * - **Titan**: a bulkier body, drawn bigger (128×128) with a glowing aura (`animate.ts`).
 */

import type { BodyShape, ZorlingGenome, ZorlingParts } from './genome';

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

/** The genome of an evolution stage, derived from the final form's genome. */
export function stageGenome(genome: ZorlingGenome, stage: number, of: StageCount): ZorlingGenome {
  const growth = stageGrowth(stage, of);
  if (growth >= 1) return genome;
  const k = 1 - growth; // "babyness"
  const b = genome.body;
  const body: BodyShape = {
    length: clamp01(b.length * (1 - 0.5 * k)),
    height: clamp01(b.height * (1 - 0.3 * k)),
    head: clamp01(b.head + 0.55 * k),
    limbs: clamp01(b.limbs * (1 - 0.65 * k)),
    // Babies are round: thin adults fill out, bulky ones slim down a little.
    bulk: clamp01(b.bulk + (0.5 - b.bulk) * 0.6 * k),
  };
  const baby = k >= 0.7;
  const p = genome.parts;
  const parts: ZorlingParts = {
    ...p,
    horns: baby
      ? p.horns === 'none'
        ? 'none'
        : 'nubs'
      : p.horns === 'antlers' || p.horns === 'curved'
        ? 'pair'
        : p.horns,
    back: baby ? (p.back === 'leaves' ? 'leaves' : 'none') : p.back,
    eyes: baby && (p.eyes === 'fierce' || p.eyes === 'slit') ? 'big' : p.eyes,
    mouth:
      p.mouth === 'fangs'
        ? baby
          ? 'smile'
          : 'fang'
        : baby && p.mouth === 'fang'
          ? 'smile'
          : p.mouth,
  };
  // Fierce adults start out cute; dark lines stay dark (they keep their palette and glow).
  const mood = baby && genome.mood === 'fierce' ? 'cute' : genome.mood;
  return { ...genome, mood, body, parts };
}

/** A Titan's body: bulkier and longer-limbed than its species. */
export function titanGenome(genome: ZorlingGenome): ZorlingGenome {
  const b = genome.body;
  return {
    ...genome,
    body: { ...b, bulk: clamp01(b.bulk + 0.3), limbs: clamp01(b.limbs + 0.15) },
  };
}
