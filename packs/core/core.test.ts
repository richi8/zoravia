import { describe, expect, it } from 'vitest';
import { loadGameContent, statBand, statTotal, POTION_BAG_CAP } from '@game/data';
import { CONDITION_IDS, TYPE_IDS } from '@game/style/tokens';
import { corePack } from '.';

const content = loadGameContent([corePack]);
const c = (local: string): string => `core:${local}`;

/** DESIGN.md "Types", written out independently of the pack data. */
const DESIGN_STRONG: Record<string, string[]> = {
  fire: ['nature', 'ice', 'metal'],
  water: ['fire', 'earth'],
  nature: ['water', 'earth'],
  electric: ['water', 'wind'],
  ice: ['nature', 'wind'],
  earth: ['fire', 'electric', 'metal'],
  wind: ['nature'],
  metal: ['ice', 'wind'],
};
const METAL_RESISTS = ['nature', 'ice', 'wind', 'metal'];

/** DESIGN.md "Conditions & reactions": type → [applies, [exploited condition, reaction, ×]]. */
const DESIGN_REACTIONS: [string, string, [string, string, number][]][] = [
  ['fire', 'burning', [['overgrown', 'Wildfire', 2]]],
  ['water', 'wet', [['burning', 'Steam Burst', 1.75]]],
  ['nature', 'overgrown', [['muddy', 'Rooted', 1]]],
  ['electric', 'charged', [['wet', 'Conducted', 1.75]]],
  ['ice', 'chilled', [['wet', 'Frozen', 1]]],
  [
    'earth',
    'muddy',
    [
      ['chilled', 'Shatter', 2],
      ['airborne', 'Slam', 1.75],
    ],
  ],
  ['wind', 'airborne', [['exposed', 'Shred', 1.75]]],
  ['metal', 'exposed', [['charged', 'Overload', 1.5]]],
];

describe('core pack', () => {
  it('loads and validates', () => {
    expect(content.loaded.packs.map((p) => p.id)).toEqual(['core']);
    expect(content.types.size).toBe(8);
    expect(content.conditions.size).toBe(8);
    expect(content.reactions.size).toBe(9);
    expect(content.moves.size).toBeGreaterThanOrEqual(20);
    expect(content.species.size).toBeGreaterThanOrEqual(10);
  });

  it('types and conditions match the style tokens', () => {
    expect(content.types.ids()).toEqual(TYPE_IDS.map(c));
    expect(content.conditions.ids()).toEqual(CONDITION_IDS.map(c));
  });
});

describe('type chart (DESIGN.md "Types")', () => {
  it('every attacker × defender pair has the designed multiplier', () => {
    for (const atk of TYPE_IDS) {
      for (const def of TYPE_IDS) {
        const strong = DESIGN_STRONG[atk]?.includes(def) ?? false;
        const resisted =
          (DESIGN_STRONG[def]?.includes(atk) ?? false) ||
          (def === 'metal' && METAL_RESISTS.includes(atk));
        const expected = (strong ? 1.5 : 1) * (resisted ? 0.67 : 1);
        expect(content.effectiveness(c(atk), [c(def)]), `${atk} → ${def}`).toBeCloseTo(expected);
      }
    }
  });

  it('spot checks', () => {
    expect(content.effectiveness(c('fire'), [c('nature')])).toBe(1.5);
    expect(content.effectiveness(c('nature'), [c('fire')])).toBe(0.67);
    expect(content.effectiveness(c('metal'), [c('metal')])).toBe(0.67);
    expect(content.effectiveness(c('nature'), [c('metal')])).toBe(0.67);
    expect(content.effectiveness(c('fire'), [c('water')])).toBe(0.67);
    expect(content.effectiveness(c('wind'), [c('earth')])).toBe(1);
  });

  it('dual types multiply', () => {
    expect(content.effectiveness(c('fire'), [c('nature'), c('ice')])).toBeCloseTo(2.25);
    expect(content.effectiveness(c('electric'), [c('water'), c('earth')])).toBeCloseTo(1.5 * 0.67);
    // Voltbat (Electric/Wind) vs Earth moves: Earth beats Electric, Wind resists nothing of Earth.
    expect(content.effectiveness(c('earth'), content.species.require(c('voltbat')).types)).toBe(
      1.5,
    );
  });
});

describe('conditions & reactions (DESIGN.md table)', () => {
  it('each type applies its designed condition', () => {
    for (const [type, applies] of DESIGN_REACTIONS) {
      expect(content.conditionOf(c(type)).id).toBe(c(applies));
    }
  });

  it('every condition lasts 3 turns and has a side effect', () => {
    for (const cond of content.conditions) {
      expect(cond.turns).toBe(3);
      expect(cond.effects.length).toBeGreaterThan(0);
    }
  });

  it('every designed reaction exists with its multiplier, and no others', () => {
    let count = 0;
    for (const [type, , exploits] of DESIGN_REACTIONS) {
      for (const [condition, name, mult] of exploits) {
        const r = content.reactionFor(c(condition), c(type));
        expect(r?.name, `${type} on ${condition}`).toBe(name);
        expect(r?.damageMultiplier).toBe(mult);
        count++;
      }
    }
    expect(content.reactions.size).toBe(count);
    expect(content.reactionFor(c('burning'), c('fire'))).toBeUndefined();
  });

  it('reaction specials: ignore DEF, skip turn, accuracy down, rooted', () => {
    const r = (id: string) => content.reactions.require(c(id));
    expect(r('shatter').ignoreDefense).toBe(true);
    expect(r('shred').ignoreDefense).toBe(true);
    expect(r('slam').ignoreDefense).toBe(false);
    expect(r('frozen').lingering?.effects).toEqual([{ kind: 'skipTurn' }]);
    expect(r('overload').lingering?.effects).toEqual([{ kind: 'skipTurn' }]);
    expect(r('steam-burst').lingering?.effects[0]).toMatchObject({ stat: 'accuracy' });
    const rooted = r('rooted').lingering?.effects.map((e) => e.kind);
    expect(rooted).toEqual(['trapped', 'hpLoss']);
  });

  it('Wet is exploited by both Electric and Ice; Muddy by Nature', () => {
    expect(content.reactionsOn(c('wet')).map((r) => r.name)).toEqual(['Conducted', 'Frozen']);
    expect(content.reactionsOn(c('muddy')).map((r) => r.name)).toEqual(['Rooted']);
  });
});

describe('species', () => {
  it('stat totals sit within 5% of the DESIGN.md bands', () => {
    for (const s of content.species) {
      const line = content.evolutionLine(s.id);
      const band = statBand(line.stage, line.members.length, s.legendary);
      const total = statTotal(s.baseStats);
      expect(Math.abs(total - band) / band, `${s.name} ${total} vs ~${band}`).toBeLessThan(0.05);
    }
  });

  it('has 1-, 2- and 3-stage lines and a legendary', () => {
    const lengths = new Set(
      content.species.values().map((s) => content.evolutionLine(s.id).members.length),
    );
    expect([...lengths].sort()).toEqual([1, 2, 3]);
    expect(content.evolutionLine(c('blazekit'))).toMatchObject({ stage: 2 });
    expect(content.evolutionLine(c('blazekit')).members.map((s) => s.name)).toEqual([
      'Emberkit',
      'Blazekit',
      'Infernyx',
    ]);
    expect(content.species.values().filter((s) => s.legendary)).toHaveLength(1);
  });

  it('every species knows a move at level 1', () => {
    for (const s of content.species) expect(s.learnset[0]?.level, s.name).toBe(1);
  });
});

describe('items', () => {
  it('potions are tiered, capped at 5, and there is a capture item', () => {
    const potions = content.items.values().filter((i) => i.category === 'potion');
    expect(potions.length).toBeGreaterThanOrEqual(2);
    for (const p of potions) expect(p.bagCap).toBe(POTION_BAG_CAP);
    const prices = potions.map((p) => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(content.items.require(c('zorb')).effect.kind).toBe('capture');
  });
});
