/**
 * Fixture packs for pack-system tests. Test-only content — not game data.
 * `base` adds creatures and items; `remix` depends on it, adds its own entries,
 * overrides one creature, patches one item, and registers a hook.
 */

import { z } from 'zod';
import { definePack, defineRegistry, namespacedIdSchema, type HookSpec } from '@engine/packs';

export const creatures = defineRegistry(
  'creatures',
  z.strictObject({
    name: z.string().min(1),
    hp: z.number().int().positive(),
    moves: z.array(namespacedIdSchema).default([]),
  }),
);

export const items = defineRegistry(
  'items',
  z.strictObject({
    name: z.string().min(1),
    price: z.number().int().nonnegative(),
  }),
);

export type FixtureHooks = {
  'battle:damage': HookSpec<number, { attacker: string }>;
  'shop:price': HookSpec<number>;
};

export const basePack = definePack<FixtureHooks>({
  manifest: { id: 'base', version: '1.2.0', name: 'Base fixture' },
  content: {
    creatures: {
      sparkit: { name: 'Sparkit', hp: 40, moves: ['base:zap'] },
      pebblet: { name: 'Pebblet', hp: 55 },
    },
    items: {
      potion: { name: 'Potion', price: 100 },
      net: { name: 'Net', price: 200 },
    },
  },
  setup: ({ hooks }) => {
    hooks.add('shop:price', (price) => price * 2);
  },
});

export const remixPack = definePack<FixtureHooks>({
  manifest: { id: 'remix', version: '0.1.0', dependsOn: ['base@^1.0.0'] },
  content: {
    creatures: { blazer: { name: 'Blazer', hp: 50 } },
  },
  overrides: {
    creatures: { 'base:sparkit': { name: 'Sparkit (Remix)', hp: 45, moves: ['base:zap'] } },
  },
  patches: {
    items: { 'base:potion': { price: 50 } },
  },
  setup: ({ hooks }) => {
    hooks.add('battle:damage', (dmg, ctx) => (ctx.attacker === 'remix:blazer' ? dmg + 5 : dmg));
    hooks.add('shop:price', (price) => price + 1);
  },
});
