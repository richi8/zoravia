/**
 * Overworld NPCs (C21): people standing or walking around on a region map, who face the
 * player and talk when spoken to. Any pack can place NPCs on any pack's map.
 *
 * - `map` + either `anchor` (a named point of that map) or `x`/`y`: where the NPC stands.
 * - `facing`: starting direction; default the anchor's facing, else `down`.
 * - `look`: outfit, hair and skin presets for the shared character body.
 * - `behavior`: `stand` (never moves), `look` (turns around now and then), `wander` (walks
 *   within `radius` tiles of its spot).
 * - `lines`: what it says, one dialog page each; or `dialogue` (C26): a dialogue from the
 *   `dialogues` registry, with branches, choices and quest actions. Give one of the two.
 * - `role` (C22): after talking, a `center` NPC opens the Zorling center (heal, storage,
 *   move relearner) and a `shop` NPC opens its shop with `stock` (items with a price).
 * - `when` (C27): the NPC is there only while this story condition holds (a rival who shows
 *   up after a badge and leaves once beaten; a legendary gone once caught).
 * - `zorling` (C27): drawn as this species' overworld sprite instead of a person (a Titan in
 *   its lair, a legendary at its shrine). It never walks; `look` is ignored.
 * - `object` (C30): a thing, not a person. `sign` is not drawn at all: it sits on a sign or
 *   standing-stone prop of the map and makes it readable. `item` is drawn as a small item
 *   lying on the ground (a hidden item: its dialogue gives the item and sets a flag, and a
 *   `when` on that flag makes it vanish). Objects never move or turn, and their pages show
 *   without a name tag.
 * - `sight` (C36d): a route trainer not beaten yet spots the player in its line of sight,
 *   walks up and starts its dialogue (see `trainerSight`).
 */

import { defineRegistry, type CheckContext, type EntryOf, type EntryProblem } from '@engine/packs';
import { z } from 'zod';
import { HAIR_IDS, OUTFIT_IDS, SKIN_IDS } from '@game/world/overworld/outfits';
import { name, ref, refTo } from './common';
import { FACINGS, type AnchorData, type Facing, type RegionMapData } from './maps';
import { conditionRefs, storyConditionSchema } from './story';

const seconds = z.number().positive().max(60);

export const npcBehaviorSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('stand') }),
  z.strictObject({
    kind: z.literal('look'),
    /** Seconds between turns, picked at random in this range. */
    every: z.tuple([seconds, seconds]).default([2, 5]),
  }),
  z.strictObject({
    kind: z.literal('wander'),
    /** How far (tiles, each axis) it may walk from its spot. */
    radius: z.number().int().min(1).max(12).default(3),
    every: z.tuple([seconds, seconds]).default([1.5, 4]),
  }),
]);
export type NpcBehavior = z.output<typeof npcBehaviorSchema>;

export const npcRoleSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('center') }),
  z.strictObject({
    kind: z.literal('shop'),
    /** Shop name shown as the panel title. Default "Shop". */
    title: name.optional(),
    stock: z.array(ref).min(1).max(8),
  }),
]);
export type NpcRole = z.output<typeof npcRoleSchema>;

/**
 * What an NPC is on the Atlas (C36b). NPCs whose dialogue fights a trainer are `trainer`
 * and NPCs who start a boss battle are `titan` or `legendary` (by the boss's kind) without
 * one; set it for the rest: the trial master, the rival, the region boss, a gate keeper,
 * Elder Titans and Keepers.
 */
export const NPC_MARKS = [
  'trainer',
  'trial',
  'rival',
  'titan',
  'legendary',
  'boss',
  'gate',
  'elder',
  'keeper',
] as const;
export type NpcMark = (typeof NPC_MARKS)[number];

export const npcLookSchema = z.strictObject({
  outfit: z.enum(OUTFIT_IDS).default('red'),
  hair: z.enum(HAIR_IDS).default('brown'),
  skin: z.enum(SKIN_IDS).default('warm'),
});

export const npcSchema = z
  .strictObject({
    name,
    map: ref,
    anchor: z.string().min(1).optional(),
    x: z.number().int().min(0).optional(),
    y: z.number().int().min(0).optional(),
    facing: z.enum(FACINGS).optional(),
    look: npcLookSchema.default({ outfit: 'red', hair: 'brown', skin: 'warm' }),
    behavior: npcBehaviorSchema.default({ kind: 'stand' }),
    lines: z.array(z.string().min(1).max(240)).min(1).optional(),
    dialogue: ref.optional(),
    role: npcRoleSchema.optional(),
    when: storyConditionSchema.optional(),
    zorling: ref.optional(),
    object: z.enum(['sign', 'item']).optional(),
    /** Atlas marker (C36b); see `NPC_MARKS`. */
    mark: z.enum(NPC_MARKS).optional(),
    /**
     * Tiles a route trainer sees straight ahead (C36d); default `TRAINER_SIGHT`, 0 never
     * spots. Only NPCs whose mark is `trainer` spot.
     */
    sight: z.number().int().min(0).max(8).optional(),
    /**
     * A ferryman (C37): after talking, asks whether to sail from this connection of its map
     * (a `ferry` connection), as the boat at the pier does.
     */
    ferry: z.string().min(1).optional(),
  })
  .superRefine((n, ctx) => {
    if (n.zorling && n.behavior.kind === 'wander') {
      ctx.addIssue({
        code: 'custom',
        path: ['behavior'],
        message: 'A Zorling NPC does not wander',
      });
    }
    if (n.object && (n.zorling || n.role || n.behavior.kind !== 'stand')) {
      ctx.addIssue({
        code: 'custom',
        path: ['object'],
        message: 'An object stands still and has no Zorling or role',
      });
    }
    if ((n.lines === undefined) === (n.dialogue === undefined)) {
      ctx.addIssue({ code: 'custom', path: ['lines'], message: 'Give either lines or dialogue' });
    }
    const xy = n.x !== undefined && n.y !== undefined;
    const half = (n.x === undefined) !== (n.y === undefined);
    if (half) ctx.addIssue({ code: 'custom', path: ['x'], message: 'Give both x and y' });
    else if (xy === (n.anchor !== undefined)) {
      ctx.addIssue({ code: 'custom', path: ['anchor'], message: 'Give either anchor or x/y' });
    }
  });

export const npcs = defineRegistry('npcs', npcSchema, {
  refs: (n) => [
    refTo('maps', n.map, 'map'),
    ...(n.dialogue ? [refTo('dialogues', n.dialogue, 'dialogue')] : []),
    ...(n.zorling ? [refTo('species', n.zorling, 'zorling')] : []),
    ...(n.when ? conditionRefs(n.when, 'when') : []),
    ...(n.role?.kind === 'shop'
      ? n.role.stock.map((id, i) => refTo('items', id, 'role', 'stock', i))
      : []),
  ],
  check: (n, ctx) => [...checkPlace(n, ctx), ...checkStock(n, ctx)],
});

export type NpcData = z.output<typeof npcSchema>;
export type Npc = EntryOf<typeof npcs>;
export type NpcInput = z.input<typeof npcSchema>;

function checkPlace(n: NpcData, ctx: CheckContext): EntryProblem[] {
  const m = ctx.get('maps', n.map) as RegionMapData | undefined;
  if (!m) return [];
  if (n.anchor !== undefined) {
    return m.anchors[n.anchor]
      ? []
      : [{ path: ['anchor'], message: `Map "${n.map}" has no anchor "${n.anchor}"` }];
  }
  const x = n.x ?? 0;
  const y = n.y ?? 0;
  return x < m.width && y < m.height
    ? []
    : [{ path: ['x'], message: `(${x}, ${y}) is outside map "${n.map}"` }];
}

function checkStock(n: NpcData, ctx: CheckContext): EntryProblem[] {
  if (n.role?.kind !== 'shop') return [];
  const out: EntryProblem[] = [];
  n.role.stock.forEach((id, i) => {
    const item = ctx.get('items', id) as { price: number } | undefined;
    if (item && item.price <= 0) {
      out.push({ path: ['role', 'stock', i], message: `"${id}" has no price, so it is not sold` });
    }
  });
  if (new Set(n.role.stock).size !== n.role.stock.length) {
    out.push({ path: ['role', 'stock'], message: 'An item is listed twice' });
  }
  return out;
}

/** Where an NPC stands and faces at the start. */
export function npcPlace(
  n: NpcData,
  m: { readonly anchors: Readonly<Record<string, AnchorData>> },
): { x: number; y: number; facing: Facing } {
  const a = n.anchor !== undefined ? m.anchors[n.anchor] : undefined;
  const facing = n.facing ?? a?.facing ?? 'down';
  return { x: a?.x ?? n.x ?? 0, y: a?.y ?? n.y ?? 0, facing };
}
