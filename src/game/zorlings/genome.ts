/**
 * Zorling genome: the small, serializable recipe a Zorling sprite is generated from.
 *
 * A genome is plain JSON (species data in packs will carry one). `generateGenome(seed)` rolls
 * a random one; the same seed and options always give the same genome, and the same genome
 * always renders the same pixels (see `render.ts`).
 *
 * Every slot is rolled from its own RNG stream (`rng.split(slot)`), so adding a new slot later
 * never changes the parts existing seeds already produce.
 */

import { Rng, type Seed } from '@engine/core';
import { z } from 'zod';
import { TYPE_IDS, type TypeId } from '../style/tokens';
import { generatePalette, zorlingPaletteSchema, type ZorlingPalette } from './palette';

export const BODY_PLANS = [
  'quadruped',
  'feline',
  'canine',
  'dragon',
  'serpent',
  'avian',
  'raptor',
  'bat',
  'insect',
  'fish',
  'blob',
  'biped',
  'golem',
  // Regional plans (C35a): desert…
  'lizard',
  'scorpion',
  'beetle',
  'cactus',
  'tortoise',
  'sandworm',
  'vulture',
  'fennec',
  // …and frozen coast.
  'pinniped',
  'tusker',
  'jelly',
  'crab',
  'angler',
  'mustelid',
  'owl',
  'caribou',
  'urchin',
  // Legendary dragons, one per region.
  'leafwyrm',
  'magmadrake',
  'frostwyrm',
] as const;
export type BodyPlan = (typeof BODY_PLANS)[number];

/** The original plans (C08): what a genome without a kit rolls its plan from. */
export const CLASSIC_PLANS = BODY_PLANS.slice(0, 13) as readonly BodyPlan[];

/** Overall attitude: drives eyes, mouths, palette darkness and proportions. */
export const MOODS = ['cute', 'fierce', 'dark'] as const;
export type Mood = (typeof MOODS)[number];
/** Part slots and the kinds each slot can hold (the part library). */
export const PART_KINDS = {
  ears: ['none', 'pointy', 'round', 'long', 'fin', 'tuft'],
  horns: ['none', 'single', 'pair', 'curved', 'antlers', 'nubs', 'tusks', 'lure'],
  tail: ['none', 'thin', 'fluffy', 'flame', 'fin', 'leaf', 'club', 'bolt', 'stinger'],
  back: [
    'none',
    'spikes',
    'plates',
    'sail',
    'leaves',
    'crystals',
    'mane',
    'ruff',
    'icicles',
    'carapace',
  ],
  wings: ['none', 'feather', 'membrane'],
  markings: ['none', 'spots', 'stripes', 'mask', 'socks', 'tip', 'frost'],
  eyes: ['round', 'big', 'fierce', 'sleepy', 'slit', 'glow'],
  mouth: ['none', 'smile', 'fang', 'fangs', 'open'],
  snout: ['short', 'long', 'beak'],
} as const;

export type PartSlot = keyof typeof PART_KINDS;
export type PartKind<S extends PartSlot> = (typeof PART_KINDS)[S][number];
export type ZorlingParts = { readonly [S in PartSlot]: PartKind<S> };

/** Body proportions, all 0–1 (0 = smallest/shortest, 1 = largest/longest). */
export interface BodyShape {
  readonly length: number;
  readonly height: number;
  readonly head: number;
  readonly limbs: number;
  readonly bulk: number;
}

export interface ZorlingGenome {
  readonly version: 1;
  readonly seed: number;
  readonly plan: BodyPlan;
  readonly mood: Mood;
  /** One or two types; the first drives the palette and most parts. */
  readonly types: readonly [TypeId] | readonly [TypeId, TypeId];
  readonly palette: ZorlingPalette;
  readonly body: BodyShape;
  readonly parts: ZorlingParts;
  /** Belly / underside in the belly color. */
  readonly belly: boolean;
}

const unit = z.number().min(0).max(1);
const typeId = z.enum(TYPE_IDS);
const kind = <S extends PartSlot>(slot: S) =>
  z.enum(PART_KINDS[slot] as unknown as [PartKind<S>, ...PartKind<S>[]]);

export const zorlingGenomeSchema = z.object({
  version: z.literal(1),
  seed: z.number().int().nonnegative(),
  plan: z.enum(BODY_PLANS),
  mood: z.enum(MOODS),
  types: z.union([z.tuple([typeId]), z.tuple([typeId, typeId])]),
  palette: zorlingPaletteSchema,
  body: z.object({ length: unit, height: unit, head: unit, limbs: unit, bulk: unit }),
  parts: z.object({
    ears: kind('ears'),
    horns: kind('horns'),
    tail: kind('tail'),
    back: kind('back'),
    wings: kind('wings'),
    markings: kind('markings'),
    eyes: kind('eyes'),
    mouth: kind('mouth'),
    snout: kind('snout'),
  }),
  belly: z.boolean(),
}) satisfies z.ZodType<ZorlingGenome>;

export interface GenerateOptions {
  /** Force a body plan (default: random). */
  readonly plan?: BodyPlan;
  /** Force the mood (default: random, weighted per plan). */
  readonly mood?: Mood;
  /** Force the primary type (default: random). */
  readonly type?: TypeId;
  /** Chance of a second type, 0–1. Default 0.3. */
  readonly dualChance?: number;
  /** Force both types (overrides `type` and `dualChance`), e.g. from species data. */
  readonly types?: ZorlingGenome['types'];
  /** Plans to roll from when `plan` is not forced (a model kit's plans). Default: classic. */
  readonly plans?: readonly BodyPlan[];
  /**
   * Part weights added to the plan's own (a model kit's parts); 0 removes a kind. Slots where
   * the plan allows only one kind (beaks, stingers) ignore it. Type and mood biases apply on top.
   */
  readonly parts?: KitParts;
}

/** Part weights per slot, as a model kit gives them. */
export type KitParts = { readonly [S in PartSlot]?: Weights<S> };

type Weights<S extends PartSlot> = Partial<Record<PartKind<S>, number>>;

/** Legendary dragons draw their own horns, wings and tails; only the face varies. */
const LEGEND: { readonly [S in PartSlot]: Weights<S> } = {
  ears: { none: 1 },
  horns: { none: 1 },
  tail: { none: 1 },
  back: { none: 1 },
  wings: { none: 1 },
  markings: { none: 3, stripes: 1 },
  eyes: { slit: 3, fierce: 2, glow: 2 },
  mouth: { fangs: 3, fang: 1 },
  snout: { long: 1 },
};

/** Base part weights per body plan (a missing kind has weight 0 for that plan). */
const PLAN_WEIGHTS: { readonly [P in BodyPlan]: { readonly [S in PartSlot]: Weights<S> } } = {
  quadruped: {
    ears: { pointy: 4, round: 3, long: 2, fin: 1, tuft: 1, none: 0.5 },
    horns: { none: 5, single: 1, pair: 1.5, curved: 1, antlers: 1, nubs: 1 },
    tail: { thin: 2, fluffy: 3, flame: 1, fin: 0.5, leaf: 1, club: 1, bolt: 1, none: 0.3 },
    back: { none: 4, spikes: 1, plates: 1, sail: 0.5, leaves: 1, crystals: 1, mane: 1.5 },
    wings: { none: 12, feather: 1, membrane: 1 },
    markings: { none: 3, spots: 1.5, stripes: 1.5, mask: 1, socks: 1.5, tip: 1.5 },
    eyes: { round: 3, big: 2, fierce: 2, sleepy: 1, slit: 0.5, glow: 0.3 },
    mouth: { none: 3, smile: 2, fang: 2, fangs: 0.5, open: 1 },
    snout: { short: 3, long: 2 },
  },
  serpent: {
    ears: { none: 3, fin: 3, tuft: 1, pointy: 1 },
    horns: { none: 4, single: 1, pair: 1.5, curved: 1, nubs: 1 },
    tail: { thin: 3, flame: 1, fin: 2, leaf: 1, club: 1, bolt: 1 },
    back: { none: 3, spikes: 2, plates: 1, sail: 2, leaves: 1, crystals: 1 },
    wings: { none: 10, feather: 1, membrane: 1 },
    markings: { none: 2, spots: 2, stripes: 2, tip: 1 },
    eyes: { round: 2, big: 1, fierce: 3, sleepy: 1, slit: 2, glow: 0.5 },
    mouth: { none: 2, smile: 2, fang: 3, fangs: 1, open: 1 },
    snout: { short: 3, long: 2 },
  },
  avian: {
    ears: { none: 2, tuft: 4, pointy: 1 },
    horns: { none: 8, nubs: 1, single: 0.5 },
    tail: { fluffy: 2, fin: 1, leaf: 1, flame: 1, thin: 1, bolt: 0.5 },
    back: { none: 6, spikes: 0.5, leaves: 0.5, crystals: 0.5, mane: 1 },
    wings: { feather: 1 },
    markings: { none: 3, spots: 1, stripes: 1, mask: 2, tip: 1 },
    eyes: { round: 3, big: 2, fierce: 2, sleepy: 1, glow: 0.3 },
    mouth: { none: 1 },
    snout: { beak: 1 },
  },
  blob: {
    ears: { none: 3, pointy: 1, round: 1.5, long: 1, fin: 1, tuft: 1 },
    horns: { none: 4, single: 1, nubs: 1, pair: 0.5 },
    tail: { none: 3, thin: 1, flame: 1, fin: 1, leaf: 1, bolt: 0.5 },
    back: { none: 2, spikes: 1, sail: 1, leaves: 1.5, crystals: 1 },
    wings: { none: 10, feather: 1, membrane: 1 },
    markings: { none: 4, spots: 2, stripes: 1 },
    eyes: { round: 2, big: 3, fierce: 1, sleepy: 1.5, glow: 0.5 },
    mouth: { smile: 3, open: 2, fang: 1, fangs: 0.3, none: 1 },
    snout: { short: 1 },
  },
  biped: {
    ears: { pointy: 3, round: 3, long: 2, fin: 1, tuft: 1, none: 1 },
    horns: { none: 5, single: 1, pair: 1.5, curved: 1, antlers: 0.5, nubs: 1 },
    tail: { thin: 2, fluffy: 2, flame: 1, fin: 0.5, leaf: 1, club: 1, bolt: 1, none: 1 },
    back: { none: 4, spikes: 1, plates: 1, leaves: 1, crystals: 0.5, mane: 1 },
    wings: { none: 8, feather: 1, membrane: 1 },
    markings: { none: 3, spots: 1, stripes: 1, mask: 1, socks: 1.5, tip: 1 },
    eyes: { round: 3, big: 3, fierce: 1.5, sleepy: 1, slit: 0.5, glow: 0.5 },
    mouth: { none: 1, smile: 3, fang: 2, fangs: 0.5, open: 1.5 },
    snout: { short: 4, long: 1 },
  },
  feline: {
    ears: { pointy: 5, tuft: 2, round: 0.5 },
    horns: { none: 10, nubs: 0.5, single: 0.5 },
    tail: { thin: 5, fluffy: 1, flame: 1, bolt: 1, leaf: 0.5 },
    back: { none: 6, spikes: 0.5, mane: 1, crystals: 0.5 },
    wings: { none: 14, feather: 0.5, membrane: 0.5 },
    markings: { none: 2, spots: 2, stripes: 2, socks: 1, tip: 1, mask: 0.5 },
    eyes: { slit: 4, fierce: 2, round: 1, big: 0.5, glow: 0.5 },
    mouth: { none: 3, fang: 1, fangs: 1.5 },
    snout: { short: 1 },
  },
  canine: {
    ears: { pointy: 5, long: 1, round: 1 },
    horns: { none: 10, pair: 0.5, curved: 0.5 },
    tail: { fluffy: 5, thin: 1, flame: 1, bolt: 0.5 },
    back: { none: 4, mane: 3, spikes: 1 },
    wings: { none: 14, feather: 0.5 },
    markings: { none: 2, socks: 2, mask: 1.5, tip: 1.5, spots: 0.5 },
    eyes: { fierce: 3, round: 2, slit: 1, glow: 0.5 },
    mouth: { none: 2, fangs: 2, fang: 1, open: 1 },
    snout: { long: 4, short: 1 },
  },
  dragon: {
    ears: { none: 3, fin: 2, pointy: 1 },
    horns: { curved: 3, pair: 3, single: 1, antlers: 0.5 },
    tail: { thin: 3, flame: 2, club: 1, bolt: 0.5, leaf: 0.5 },
    back: { spikes: 5, plates: 2, sail: 1, crystals: 1 },
    wings: { membrane: 5, feather: 0.5 },
    markings: { none: 3, stripes: 1, spots: 1, tip: 1 },
    eyes: { slit: 4, fierce: 3, glow: 1 },
    mouth: { fangs: 4, fang: 1, none: 1 },
    snout: { long: 3, short: 1 },
  },
  bat: {
    ears: { long: 3, pointy: 4 },
    horns: { none: 6, nubs: 1, single: 0.5 },
    tail: { none: 6, thin: 1 },
    back: { none: 6, mane: 2 },
    wings: { membrane: 1 },
    markings: { none: 3, mask: 1, tip: 1 },
    eyes: { round: 2, big: 2, glow: 2, fierce: 1 },
    mouth: { fangs: 4, fang: 2, open: 1 },
    snout: { short: 3, long: 0.5 },
  },
  raptor: {
    ears: { none: 3, tuft: 3 },
    horns: { none: 1 },
    tail: { fluffy: 3, fin: 1, flame: 0.5, thin: 1 },
    back: { none: 6, mane: 1 },
    wings: { feather: 1 },
    markings: { none: 2, mask: 2, tip: 1, stripes: 1 },
    eyes: { fierce: 4, slit: 1, round: 1, glow: 0.5 },
    mouth: { none: 1 },
    snout: { beak: 1 },
  },
  insect: {
    ears: { none: 1 },
    horns: { none: 3, single: 2, pair: 1, antlers: 1 },
    tail: { none: 6, thin: 0.5 },
    back: { none: 4, spikes: 1, crystals: 0.5 },
    wings: { none: 3, feather: 1, membrane: 1 },
    markings: { none: 2, spots: 2, stripes: 2 },
    eyes: { round: 1, glow: 2, big: 1, fierce: 1 },
    mouth: { none: 1 },
    snout: { short: 1 },
  },
  fish: {
    ears: { none: 3, fin: 3 },
    horns: { none: 5, single: 1 },
    tail: { fin: 1 },
    back: { sail: 3, spikes: 2, none: 1, crystals: 0.5 },
    wings: { none: 1 },
    markings: { none: 2, stripes: 2, spots: 2, tip: 1 },
    eyes: { round: 3, big: 2, fierce: 1, glow: 1 },
    mouth: { none: 2, smile: 1, fangs: 2, open: 1 },
    snout: { short: 1 },
  },
  golem: {
    ears: { none: 1 },
    horns: { none: 3, pair: 1, single: 1, nubs: 1 },
    tail: { none: 6, club: 1 },
    back: { crystals: 4, spikes: 2, plates: 2, none: 2 },
    wings: { none: 1 },
    markings: { none: 3, stripes: 1 },
    eyes: { glow: 4, fierce: 2, round: 0.5 },
    mouth: { none: 3, fangs: 1 },
    snout: { short: 1 },
  },
  lizard: {
    ears: { none: 4, fin: 1.5 },
    horns: { none: 4, nubs: 1, single: 0.5, pair: 1, curved: 0.5 },
    tail: { thin: 4, flame: 1, club: 1, leaf: 0.5, bolt: 0.5 },
    back: { none: 2, spikes: 3, sail: 2, plates: 1, crystals: 0.5, carapace: 0.5 },
    wings: { none: 1 },
    markings: { none: 2, spots: 2, stripes: 2, tip: 0.5 },
    eyes: { round: 2, big: 1, fierce: 2, slit: 2, glow: 0.5 },
    mouth: { none: 2, smile: 1, fang: 1.5, fangs: 1 },
    snout: { short: 2, long: 2 },
  },
  scorpion: {
    ears: { none: 1 },
    horns: { none: 3, nubs: 1, single: 0.5 },
    tail: { stinger: 1 },
    back: { none: 3, spikes: 1, crystals: 0.5, plates: 1 },
    wings: { none: 1 },
    markings: { none: 3, stripes: 1.5, spots: 0.5 },
    eyes: { round: 1, glow: 2, fierce: 2, big: 0.5 },
    mouth: { none: 1 },
    snout: { short: 1 },
  },
  beetle: {
    ears: { none: 1 },
    horns: { none: 2, single: 3, pair: 2, curved: 0.5, nubs: 0.5 },
    tail: { none: 1 },
    back: { carapace: 1 },
    wings: { none: 4, membrane: 1, feather: 0.5 },
    markings: { none: 2, spots: 2, stripes: 1.5 },
    eyes: { round: 1.5, glow: 1.5, big: 1, fierce: 1 },
    mouth: { none: 1 },
    snout: { short: 1 },
  },
  cactus: {
    ears: { none: 2, tuft: 3, round: 1 },
    horns: { none: 4, nubs: 1 },
    tail: { none: 1 },
    back: { none: 2, spikes: 2 },
    wings: { none: 1 },
    markings: { none: 2, stripes: 3, spots: 1 },
    eyes: { round: 2, big: 2, sleepy: 1.5, fierce: 1, glow: 0.3 },
    mouth: { smile: 3, none: 1, open: 1.5, fang: 0.5 },
    snout: { short: 1 },
  },
  pinniped: {
    ears: { none: 4, round: 1 },
    horns: { none: 4, tusks: 1.5, nubs: 0.5 },
    tail: { fin: 1 },
    back: { none: 4, ruff: 1, spikes: 0.5, icicles: 0.5 },
    wings: { none: 1 },
    markings: { none: 2, spots: 3, mask: 1, frost: 1 },
    eyes: { round: 2, big: 3, sleepy: 1, fierce: 1, glow: 0.3 },
    mouth: { none: 1, smile: 2, fang: 1, open: 1, fangs: 0.5 },
    snout: { short: 2, long: 1 },
  },
  tusker: {
    ears: { round: 3, long: 1, none: 1 },
    horns: { tusks: 6, nubs: 0.5 },
    tail: { thin: 2, fluffy: 2, club: 0.5 },
    back: { ruff: 3, mane: 2, none: 1, icicles: 1, plates: 0.5 },
    wings: { none: 1 },
    markings: { none: 3, frost: 1.5, socks: 1, stripes: 0.5 },
    eyes: { round: 2, sleepy: 1.5, fierce: 2, big: 1, glow: 0.3 },
    mouth: { none: 3, smile: 1 },
    snout: { long: 4, short: 1 },
  },
  jelly: {
    ears: { none: 1 },
    horns: { none: 3, nubs: 0.5, lure: 0.5 },
    tail: { none: 1 },
    back: { none: 3, spikes: 0.5, icicles: 0.5 },
    wings: { none: 1 },
    markings: { none: 2, spots: 3, stripes: 1 },
    eyes: { round: 2, big: 2, sleepy: 1.5, glow: 1.5 },
    mouth: { smile: 2, none: 1, open: 1 },
    snout: { short: 1 },
  },
  crab: {
    ears: { none: 1 },
    horns: { none: 4, nubs: 1, single: 0.5 },
    tail: { none: 1 },
    back: { none: 3, spikes: 2, icicles: 1, crystals: 0.5, carapace: 0.5 },
    wings: { none: 1 },
    markings: { none: 3, spots: 2, frost: 1 },
    eyes: { round: 2, big: 1, fierce: 2, glow: 1 },
    mouth: { none: 2, smile: 1 },
    snout: { short: 1 },
  },
  tortoise: {
    ears: { none: 1 },
    horns: { none: 4, nubs: 1, pair: 1, curved: 1, single: 0.5 },
    tail: { none: 2, thin: 1, club: 0.5 },
    back: { none: 4, spikes: 2, crystals: 1, plates: 1 },
    wings: { none: 1 },
    markings: { none: 3, spots: 1, tip: 1 },
    eyes: { round: 2, sleepy: 2, big: 1, fierce: 1.5, glow: 0.5 },
    mouth: { none: 2, smile: 2, open: 0.5 },
    snout: { short: 1 },
  },
  sandworm: {
    ears: { none: 1 },
    horns: { none: 4, nubs: 1, pair: 0.5 },
    tail: { none: 3, flame: 1 },
    back: { none: 2, spikes: 2, plates: 2, crystals: 1, sail: 0.5 },
    wings: { none: 1 },
    markings: { none: 3, spots: 1 },
    eyes: { round: 1, glow: 2, fierce: 1, slit: 1 },
    mouth: { none: 1 },
    snout: { short: 1 },
  },
  vulture: {
    ears: { none: 1 },
    horns: { none: 6, nubs: 0.5 },
    tail: { fluffy: 1 },
    back: { none: 4, spikes: 0.5 },
    wings: { feather: 1 },
    markings: { none: 3, tip: 1 },
    eyes: { fierce: 3, round: 1, slit: 1, glow: 0.5 },
    mouth: { none: 1 },
    snout: { beak: 1 },
  },
  fennec: {
    ears: { long: 1 },
    horns: { none: 8, nubs: 0.5 },
    tail: { fluffy: 1 },
    back: { none: 4, spikes: 0.5, sail: 0.3 },
    wings: { none: 1 },
    markings: { none: 2, tip: 2, socks: 1, mask: 1 },
    eyes: { big: 3, round: 2, slit: 1, fierce: 1 },
    mouth: { none: 2, smile: 2, fang: 1 },
    snout: { short: 1 },
  },
  angler: {
    ears: { none: 1 },
    horns: { lure: 1 },
    tail: { fin: 1 },
    back: { none: 3, spikes: 1, icicles: 1 },
    wings: { none: 1 },
    markings: { none: 2, spots: 2, stripes: 1 },
    eyes: { round: 1, glow: 3, big: 1 },
    mouth: { none: 1 },
    snout: { short: 1 },
  },
  mustelid: {
    ears: { round: 4, none: 0.5 },
    horns: { none: 8, nubs: 0.5 },
    tail: { thin: 2, fluffy: 3, bolt: 0.5, fin: 0.5 },
    back: { none: 4, ruff: 1.5, spikes: 0.5, icicles: 0.5 },
    wings: { none: 1 },
    markings: { none: 2, mask: 1.5, tip: 2, frost: 1, socks: 1, stripes: 0.5 },
    eyes: { round: 2, big: 2, fierce: 2, slit: 0.5 },
    mouth: { none: 2, smile: 1, fang: 1, fangs: 0.5 },
    snout: { short: 1 },
  },
  owl: {
    ears: { tuft: 3, none: 1 },
    horns: { none: 6, nubs: 0.5 },
    tail: { fluffy: 1 },
    back: { none: 4, ruff: 0.5, icicles: 0.5 },
    wings: { feather: 1 },
    markings: { none: 2, stripes: 2, spots: 1, frost: 1 },
    eyes: { big: 3, round: 2, fierce: 1.5, glow: 0.5 },
    mouth: { none: 1 },
    snout: { beak: 1 },
  },
  caribou: {
    ears: { pointy: 3, none: 0.5 },
    horns: { antlers: 6, pair: 0.5 },
    tail: { fluffy: 2, none: 1 },
    back: { none: 3, ruff: 1, mane: 1, icicles: 0.5 },
    wings: { none: 1 },
    markings: { none: 2, socks: 1.5, frost: 1.5, spots: 1 },
    eyes: { round: 2, big: 1.5, fierce: 1.5, glow: 0.5 },
    mouth: { none: 3, smile: 1 },
    snout: { long: 1 },
  },
  urchin: {
    ears: { none: 1 },
    horns: { none: 4, nubs: 1 },
    tail: { none: 1 },
    back: { spikes: 2, icicles: 1 },
    wings: { none: 1 },
    markings: { none: 2, spots: 2, stripes: 1 },
    eyes: { round: 2, big: 2, fierce: 1, glow: 1, sleepy: 1 },
    mouth: { smile: 2, none: 1, open: 1, fang: 0.5 },
    snout: { short: 1 },
  },
  leafwyrm: LEGEND,
  magmadrake: LEGEND,
  frostwyrm: LEGEND,
};

/** How likely each mood is per body plan. */
const MOOD_WEIGHTS: { readonly [P in BodyPlan]: Readonly<Record<Mood, number>> } = {
  quadruped: { cute: 3, fierce: 2, dark: 1 },
  feline: { cute: 1, fierce: 3, dark: 1.5 },
  canine: { cute: 1.5, fierce: 3, dark: 1.5 },
  dragon: { cute: 0.7, fierce: 3, dark: 2 },
  serpent: { cute: 1, fierce: 2, dark: 1.5 },
  avian: { cute: 3, fierce: 1, dark: 0.7 },
  raptor: { cute: 0.3, fierce: 4, dark: 1 },
  bat: { cute: 1.5, fierce: 1, dark: 3 },
  insect: { cute: 0.7, fierce: 2, dark: 2 },
  fish: { cute: 2, fierce: 2, dark: 1 },
  blob: { cute: 5, fierce: 0.7, dark: 1 },
  biped: { cute: 4, fierce: 1.5, dark: 1 },
  golem: { cute: 0.5, fierce: 2, dark: 3 },
  lizard: { cute: 1.5, fierce: 3, dark: 1 },
  scorpion: { cute: 0.5, fierce: 3, dark: 2 },
  beetle: { cute: 1, fierce: 2.5, dark: 1.5 },
  cactus: { cute: 4, fierce: 1, dark: 0.5 },
  pinniped: { cute: 4, fierce: 1.5, dark: 0.7 },
  tusker: { cute: 1.5, fierce: 3, dark: 1 },
  jelly: { cute: 3, fierce: 0.7, dark: 2 },
  crab: { cute: 1.5, fierce: 3, dark: 1 },
  tortoise: { cute: 3, fierce: 2, dark: 0.7 },
  sandworm: { cute: 0.5, fierce: 3, dark: 2 },
  vulture: { cute: 0.5, fierce: 3, dark: 2 },
  fennec: { cute: 4, fierce: 1, dark: 0.7 },
  angler: { cute: 0.5, fierce: 1.5, dark: 3 },
  mustelid: { cute: 3, fierce: 2.5, dark: 1 },
  owl: { cute: 3, fierce: 2, dark: 1 },
  caribou: { cute: 2, fierce: 2.5, dark: 0.7 },
  urchin: { cute: 2.5, fierce: 2, dark: 1 },
  leafwyrm: { cute: 0.5, fierce: 3, dark: 1 },
  magmadrake: { cute: 0.3, fierce: 3, dark: 2 },
  frostwyrm: { cute: 0.3, fierce: 3, dark: 1.5 },
};

/** Mood multiplies part weights (only kinds the plan allows). */
const MOOD_BIAS: { readonly [M in Mood]: { readonly [S in PartSlot]?: Weights<S> } } = {
  cute: {
    eyes: { big: 2.5, round: 1.5, sleepy: 1.2, slit: 0.2, glow: 0.1, fierce: 0.4 },
    mouth: { smile: 2, open: 1.5, fangs: 0.2 },
  },
  fierce: {
    eyes: { fierce: 2.5, slit: 2.5, big: 0.2, sleepy: 0.2, round: 0.5 },
    mouth: { fangs: 2.5, fang: 1.5, smile: 0.2 },
    horns: { none: 0.6 },
    back: { spikes: 1.8 },
  },
  dark: {
    eyes: { glow: 8, slit: 1.5, big: 0.2, round: 0.3, sleepy: 0.3 },
    mouth: { fangs: 3, smile: 0.1, open: 0.5 },
    horns: { curved: 1.8, pair: 1.5 },
    back: { spikes: 1.5, crystals: 1.3 },
  },
};

/** Type flavor: multiplies plan weights (only where the plan allows the kind). */
const TYPE_BIAS: { readonly [T in TypeId]: { readonly [S in PartSlot]?: Weights<S> } } = {
  fire: { tail: { flame: 6 }, back: { spikes: 2, mane: 2 }, ears: { pointy: 2 } },
  water: { tail: { fin: 5 }, back: { sail: 3 }, ears: { fin: 4 }, markings: { spots: 2 } },
  nature: { tail: { leaf: 6 }, back: { leaves: 6 }, horns: { antlers: 3 } },
  electric: {
    tail: { bolt: 6 },
    horns: { lure: 3 },
    ears: { pointy: 2, long: 2 },
    markings: { stripes: 3 },
  },
  ice: {
    back: { crystals: 6, spikes: 2, icicles: 4, ruff: 2 },
    horns: { single: 2 },
    tail: { fluffy: 2 },
    markings: { frost: 3 },
  },
  earth: {
    back: { plates: 4, carapace: 2 },
    horns: { pair: 2, curved: 2, nubs: 2 },
    tail: { club: 4 },
  },
  wind: { wings: { feather: 4 }, ears: { tuft: 3, long: 2 }, tail: { fluffy: 2, thin: 2 } },
  metal: {
    back: { plates: 4, spikes: 2, carapace: 3 },
    horns: { single: 2, pair: 2 },
    tail: { club: 3 },
  },
};

function pickPart<S extends PartSlot>(
  rng: Rng,
  slot: S,
  plan: BodyPlan,
  types: readonly TypeId[],
  mood: Mood,
  kit?: KitParts,
): PartKind<S> {
  const base = PLAN_WEIGHTS[plan][slot] as Weights<S>;
  const kinds = PART_KINDS[slot] as readonly PartKind<S>[];
  // Slots where the plan allows a single kind are fixed by its anatomy (beaks, stingers).
  const fixed = kinds.filter((k) => (base[k] ?? 0) > 0).length < 2;
  const over = fixed ? undefined : (kit?.[slot] as Weights<S> | undefined);
  const withKit = (k: PartKind<S>): number => {
    const add = over?.[k];
    return add === 0 ? 0 : (base[k] ?? 0) + (add ?? 0);
  };
  // A kit that removes every kind the plan allows leaves the plan's own weights.
  const weightOf = kinds.some((k) => withKit(k) > 0) ? withKit : (k: PartKind<S>) => base[k] ?? 0;
  return rng.weighted(kinds, (k) => {
    const w = weightOf(k);
    if (w === 0) return 0;
    let bias = 1;
    for (const [i, t] of types.entries()) {
      const b = (TYPE_BIAS[t][slot] as Weights<S> | undefined)?.[k];
      if (b) bias *= i === 0 ? b : Math.sqrt(b);
    }
    bias *= (MOOD_BIAS[mood][slot] as Weights<S> | undefined)?.[k] ?? 1;
    return w * bias;
  });
}

/** Turns any seed into the canonical non-negative integer stored in genomes. */
export function seedNumber(seed: Seed): number {
  return new Rng(seed).nextU32();
}

export function generateGenome(seed: Seed, options: GenerateOptions = {}): ZorlingGenome {
  const s =
    typeof seed === 'number' && Number.isInteger(seed) && seed >= 0 ? seed : seedNumber(seed);
  const root = new Rng(s);
  const r = (label: string): Rng => root.split(label);

  const plan = options.plan ?? r('plan').pick(options.plans ?? CLASSIC_PLANS);
  const typeRng = r('types');
  const primary = options.type ?? typeRng.pick(TYPE_IDS);
  const dual = typeRng.chance(options.dualChance ?? 0.3);
  const types: ZorlingGenome['types'] =
    options.types ??
    (dual ? [primary, typeRng.pick(TYPE_IDS.filter((t) => t !== primary))] : [primary]);

  const moodRng = r('mood');
  const mood = options.mood ?? moodRng.weighted(MOODS, (m) => MOOD_WEIGHTS[plan][m]);

  const b = r('body');
  const body: BodyShape = {
    length: round2(b.next()),
    height: round2(b.next()),
    head: round2(b.next()),
    limbs: round2(b.next()),
    bulk: round2(b.next()),
  };

  const kit = options.parts;
  const parts: ZorlingParts = {
    ears: pickPart(r('ears'), 'ears', plan, types, mood, kit),
    horns: pickPart(r('horns'), 'horns', plan, types, mood, kit),
    tail: pickPart(r('tail'), 'tail', plan, types, mood, kit),
    back: pickPart(r('back'), 'back', plan, types, mood, kit),
    wings: pickPart(r('wings'), 'wings', plan, types, mood, kit),
    markings: pickPart(r('markings'), 'markings', plan, types, mood, kit),
    eyes: pickPart(r('eyes'), 'eyes', plan, types, mood, kit),
    mouth: pickPart(r('mouth'), 'mouth', plan, types, mood, kit),
    snout: pickPart(r('snout'), 'snout', plan, types, mood, kit),
  };

  return {
    version: 1,
    seed: s,
    plan,
    mood,
    types,
    palette: generatePalette(r('palette'), types, mood, plan),
    body,
    parts,
    belly: r('belly').chance(plan === 'serpent' || plan === 'avian' ? 0.85 : 0.65),
  };
}

const round2 = (v: number): number => Math.round(v * 100) / 100;
