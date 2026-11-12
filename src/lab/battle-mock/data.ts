/**
 * Mock content for the C10 battle mock: type chart and condition table from DESIGN.md,
 * three team Zorlings, one foe, moves and items. Lab-only stand-in until the core pack has
 * real data (C12); the battle engine replaces the scripted turns (C14–C18).
 */

import type { TooltipContent } from '@engine/ui';
import { conditionColors, typeColors, type ConditionId, type TypeId } from '@game/style/tokens';
import type { BagTab } from '@game/ui/bag';
import type { MoveView } from '@game/ui/panels';
import type { ShopItem } from '@game/ui/shop';
import {
  generateGenome,
  type BodyPlan,
  type Mood,
  type ZorlingGenome,
} from '@game/zorlings/genome';

/** DESIGN.md "Types": who each type is strong against. */
export const STRONG: Readonly<Record<TypeId, readonly TypeId[]>> = {
  fire: ['nature', 'ice', 'metal'],
  water: ['fire', 'earth'],
  nature: ['water', 'earth'],
  electric: ['water', 'wind'],
  ice: ['nature', 'wind'],
  earth: ['fire', 'electric', 'metal'],
  wind: ['nature'],
  metal: ['ice', 'wind'],
};
const METAL_RESISTS: readonly TypeId[] = ['nature', 'ice', 'wind', 'metal'];

export function effectiveness(move: TypeId, target: readonly TypeId[]): number {
  let m = 1;
  for (const t of target) {
    if (STRONG[move].includes(t)) m *= 1.5;
    if (STRONG[t].includes(move) || (t === 'metal' && METAL_RESISTS.includes(move))) m *= 0.67;
  }
  return m;
}

/** DESIGN.md "Conditions & reactions". */
interface ConditionInfo {
  readonly applier: TypeId;
  readonly effect: string;
  /** Types whose moves exploit it, with the reaction. */
  readonly exploitedBy: readonly {
    readonly type: TypeId;
    readonly reaction: string;
    readonly mult?: number;
  }[];
}

export const CONDITIONS: Readonly<Record<ConditionId, ConditionInfo>> = {
  burning: {
    applier: 'fire',
    effect: 'Takes damage every turn.',
    exploitedBy: [{ type: 'water', reaction: 'Steam Burst', mult: 1.75 }],
  },
  wet: {
    applier: 'water',
    effect: 'A little slower.',
    exploitedBy: [
      { type: 'electric', reaction: 'Conducted', mult: 1.75 },
      { type: 'ice', reaction: 'Frozen (skips a turn)' },
    ],
  },
  overgrown: {
    applier: 'nature',
    effect: 'Loses a little HP each turn.',
    exploitedBy: [{ type: 'fire', reaction: 'Wildfire', mult: 2 }],
  },
  charged: {
    applier: 'electric',
    effect: '10% chance to fumble a move.',
    exploitedBy: [{ type: 'metal', reaction: 'Overload (+ stun)', mult: 1.5 }],
  },
  chilled: {
    applier: 'ice',
    effect: 'Slower.',
    exploitedBy: [{ type: 'earth', reaction: 'Shatter, ignores DEF', mult: 2 }],
  },
  muddy: {
    applier: 'earth',
    effect: 'Less accurate.',
    exploitedBy: [{ type: 'nature', reaction: 'Rooted: can’t switch, drain grows' }],
  },
  airborne: {
    applier: 'wind',
    effect: 'Easier to hit.',
    exploitedBy: [{ type: 'earth', reaction: 'Slam', mult: 1.75 }],
  },
  exposed: {
    applier: 'metal',
    effect: 'Lower defense.',
    exploitedBy: [{ type: 'wind', reaction: 'Shred, ignores DEF', mult: 1.75 }],
  },
};

/** The condition a type's moves apply. */
export const APPLIES: Readonly<Record<TypeId, ConditionId>> = {
  fire: 'burning',
  water: 'wet',
  nature: 'overgrown',
  electric: 'charged',
  ice: 'chilled',
  earth: 'muddy',
  wind: 'airborne',
  metal: 'exposed',
};

/** Conditions a type's moves exploit. */
export function exploits(type: TypeId): ConditionId[] {
  return (Object.keys(CONDITIONS) as ConditionId[]).filter((c) =>
    CONDITIONS[c].exploitedBy.some((e) => e.type === type),
  );
}

const list = (ids: readonly TypeId[]): string => ids.map((t) => typeColors[t].label).join(', ');

export function typeTooltip(type: TypeId): TooltipContent {
  const weakTo = (Object.keys(STRONG) as TypeId[]).filter((t) => STRONG[t].includes(type));
  const lines = [
    `Strong vs ${list(STRONG[type])}.`,
    weakTo.length ? `Weak to ${list(weakTo)}.` : '',
    `Moves apply ${conditionColors[APPLIES[type]].label}.`,
  ];
  if (type === 'metal') lines.push('Resists Nature, Ice, Wind, Metal.');
  return { title: typeColors[type].label, body: lines.filter(Boolean).join(' ') };
}

export function conditionTooltip(id: ConditionId, turns?: number): TooltipContent {
  const c = CONDITIONS[id];
  const ex = c.exploitedBy
    .map((e) => `${typeColors[e.type].label} → ${e.reaction}${e.mult ? ` ×${e.mult}` : ''}`)
    .join('; ');
  const left = turns === undefined ? '' : ` · ${turns} turn${turns === 1 ? '' : 's'} left`;
  return {
    title: `${conditionColors[id].label}${left}`,
    body: `${c.effect} Exploit: ${ex}.`,
  };
}

export interface MockMove {
  readonly name: string;
  readonly type: TypeId;
  readonly power: number;
  readonly accuracy: number;
}

export interface MockZorling {
  readonly name: string;
  readonly genome: ZorlingGenome;
  readonly level: number;
  readonly maxHp: number;
  readonly moves: readonly MockMove[];
  readonly xp: number;
}

const genome = (seed: number, plan: BodyPlan, type: TypeId, mood: Mood): ZorlingGenome =>
  generateGenome(seed, { plan, type, mood, dualChance: 0 });

export const TEAM: readonly MockZorling[] = [
  {
    name: 'Emberkit',
    genome: genome(7, 'feline', 'fire', 'cute'),
    level: 14,
    maxHp: 54,
    xp: 0.4,
    moves: [
      { name: 'Ember Pounce', type: 'fire', power: 55, accuracy: 95 },
      { name: 'Spark Lash', type: 'electric', power: 50, accuracy: 95 },
      { name: 'Gust Dash', type: 'wind', power: 45, accuracy: 100 },
    ],
  },
  {
    name: 'Thornwing',
    genome: genome(12, 'dragon', 'nature', 'cute'),
    level: 13,
    maxHp: 49,
    xp: 0.7,
    moves: [
      { name: 'Vine Snap', type: 'nature', power: 50, accuracy: 100 },
      { name: 'Mud Toss', type: 'earth', power: 40, accuracy: 90 },
      { name: 'Leaf Gale', type: 'wind', power: 55, accuracy: 95 },
    ],
  },
  {
    name: 'Voltbat',
    genome: genome(5, 'bat', 'electric', 'cute'),
    level: 12,
    maxHp: 40,
    xp: 0.15,
    moves: [
      { name: 'Static Bite', type: 'electric', power: 50, accuracy: 95 },
      { name: 'Wing Cut', type: 'wind', power: 45, accuracy: 100 },
      { name: 'Frost Fang', type: 'ice', power: 50, accuracy: 90 },
    ],
  },
];

export const FOE: MockZorling = {
  name: 'Ripplet',
  genome: genome(31, 'quadruped', 'water', 'cute'),
  level: 12,
  maxHp: 50,
  xp: 0,
  moves: [{ name: 'Splash Jet', type: 'water', power: 45, accuracy: 100 }],
};

/** Move info for the panel, including the live tip against the foe. */
export function moveView(
  move: MockMove,
  foeTypes: readonly TypeId[],
  foeConditions: readonly ConditionId[],
): MoveView {
  const applies = APPLIES[move.type];
  const ex = exploits(move.type);
  const hit = ex.find((c) => foeConditions.includes(c));
  const eff = effectiveness(move.type, foeTypes);
  let tip: MoveView['tip'];
  if (hit) {
    const r = CONDITIONS[hit].exploitedBy.find((e) => e.type === move.type);
    tip = {
      good: true,
      text: `Foe is ${conditionColors[hit].label}: ${r?.reaction ?? ''}${r?.mult ? ` ×${r.mult}` : ''}`,
    };
  } else if (eff > 1) {
    tip = { good: true, text: `Strong vs ${list(foeTypes)} ×1.5` };
  } else if (eff < 1) {
    tip = { good: false, text: `Weak vs ${list(foeTypes)} ×0.67` };
  } else {
    const counter = foeTypes.find((t) => CONDITIONS[applies].exploitedBy.some((e) => e.type === t));
    if (counter) {
      tip = {
        good: false,
        text: `${typeColors[counter].label} foes exploit ${conditionColors[applies].label}`,
      };
    }
  }
  return {
    name: move.name,
    type: move.type,
    power: move.power,
    accuracy: move.accuracy,
    applies,
    exploits: ex,
    ...(tip ? { tip } : {}),
  };
}

export const BAG: readonly BagTab[] = [
  {
    label: 'Potions',
    items: [
      {
        id: 'potion',
        name: 'Potion',
        count: 3,
        cap: 5,
        sprite: 'potion',
        tint: 0xff5c8a,
        description: 'Restores 20 HP to one Zorling. Using it costs your turn.',
      },
      {
        id: 'super-potion',
        name: 'Super Potion',
        count: 5,
        cap: 5,
        sprite: 'potion',
        tint: 0x5ab0ff,
        description: 'Restores 60 HP to one Zorling. Using it costs your turn.',
      },
      {
        id: 'hyper-potion',
        name: 'Hyper Potion',
        count: 1,
        cap: 5,
        sprite: 'potion',
        tint: 0xb39dff,
        description: 'Restores 120 HP to one Zorling. Using it costs your turn.',
      },
      {
        id: 'max-potion',
        name: 'Max Potion',
        count: 0,
        cap: 5,
        sprite: 'potion',
        tint: 0xffc94a,
        description: 'Fully restores one Zorling. Using it costs your turn.',
      },
    ],
  },
  {
    label: 'Capture',
    items: [
      {
        id: 'orb',
        name: 'Capture Orb',
        count: 8,
        sprite: 'orb',
        tint: 0xff5c6c,
        description: 'Throw it at a wild Zorling. Works better when its HP is low.',
        targeted: false,
      },
      {
        id: 'great-orb',
        name: 'Great Orb',
        count: 2,
        sprite: 'orb',
        tint: 0x3d8bff,
        description: 'A sturdier orb with a better catch rate.',
        targeted: false,
      },
    ],
  },
];

export const HEAL: Readonly<Record<string, number>> = {
  potion: 20,
  'super-potion': 60,
  'hyper-potion': 120,
  'max-potion': 999,
};

export const SHOP: readonly ShopItem[] = [
  { id: 'potion', name: 'Potion', price: 200, owned: 3, cap: 5, sprite: 'potion', tint: 0xff5c8a },
  {
    id: 'super-potion',
    name: 'Super Potion',
    price: 600,
    owned: 5,
    cap: 5,
    sprite: 'potion',
    tint: 0x5ab0ff,
  },
  {
    id: 'hyper-potion',
    name: 'Hyper Potion',
    price: 1200,
    owned: 1,
    cap: 5,
    sprite: 'potion',
    tint: 0xb39dff,
  },
  { id: 'orb', name: 'Capture Orb', price: 150, owned: 8, sprite: 'orb', tint: 0xff5c6c },
  { id: 'great-orb', name: 'Great Orb', price: 500, owned: 0, sprite: 'orb', tint: 0x3d8bff },
];
