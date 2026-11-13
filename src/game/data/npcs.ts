/**
 * Overworld NPCs (C21): people standing or walking around on a region map, who face the
 * player and talk when spoken to. Any pack can place NPCs on any pack's map.
 *
 * - `map` + either `anchor` (a named point of that map) or `x`/`y`: where the NPC stands.
 * - `facing`: starting direction; default the anchor's facing, else `down`.
 * - `look`: outfit, hair and skin presets for the shared character body.
 * - `behavior`: `stand` (never moves), `look` (turns around now and then), `wander` (walks
 *   within `radius` tiles of its spot).
 * - `lines`: what it says, one dialog page each. The dialogue engine (C26) builds on this.
 * - `role` (C22): after talking, a `center` NPC opens the Zorling center (heal, storage,
 *   move relearner) and a `shop` NPC opens its shop with `stock` (items with a price).
 */

import { defineRegistry, type CheckContext, type EntryOf, type EntryProblem } from '@engine/packs';
import { z } from 'zod';
import { HAIR_IDS, OUTFIT_IDS, SKIN_IDS } from '@game/world/overworld/outfits';
import { name, ref, refTo } from './common';
import { FACINGS, type AnchorData, type Facing, type RegionMapData } from './maps';

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
    lines: z.array(z.string().min(1).max(240)).min(1),
    role: npcRoleSchema.optional(),
  })
  .superRefine((n, ctx) => {
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
