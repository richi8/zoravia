import { describe, expect, it } from 'vitest';
import { loadGameContent } from '@game/data';
import { corePack } from '@packs/core';
import type { ShownZorling } from '../present';
import { bagTabsFor, cardView, conditionTip, moveTip, moveViewFor, typeTip } from './view-data';

const content = loadGameContent([corePack]);

const foe = (over: Partial<ShownZorling> = {}): ShownZorling => ({
  name: 'Sproutle',
  species: 'core:sproutle',
  level: 10,
  hp: 30,
  maxHp: 30,
  types: ['core:nature'],
  moves: ['core:vine-snap'],
  statuses: [],
  boss: null,
  armor: 'none',
  subdued: false,
  titanMark: false,
  xp: 0,
  ...over,
});

describe('move info', () => {
  it('maps a move to the kit view', () => {
    const v = moveViewFor(content, 'core:static-bite', foe());
    expect(v).toMatchObject({
      name: 'Static Bite',
      type: 'electric',
      power: 45,
      applies: 'charged',
    });
    expect(v.exploits).toEqual(['wet']);
  });

  it('puts a reaction first, then Armor, then effectiveness', () => {
    const wet = foe({ statuses: [{ id: 'core:wet', origin: 'condition', turns: 2 }] });
    expect(moveTip(content, 'core:static-bite', wet)).toEqual({
      text: 'Foe is Wet: Conducted ×1.75',
      good: true,
    });
    expect(moveTip(content, 'core:ember', foe())).toEqual({
      text: 'Super effective (×1.5)',
      good: true,
    });
    expect(moveTip(content, 'core:splash-shot', foe())?.good).toBe(false);
    const titan = foe({
      types: ['core:nature', 'core:wind'],
      boss: 'core:thornwing-titan',
      armor: 'armored',
      statuses: [{ id: 'core:charged', origin: 'condition', turns: 2 }],
    });
    expect(moveTip(content, 'core:iron-bash', titan)?.text).toBe(
      'Foe is Charged: Overload ×1.5, breaks Armor!',
    );
    expect(moveTip(content, 'core:ember', titan)).toEqual({
      text: 'Armor: plain hits deal far less',
      good: false,
    });
  });

  it('warns when the foe exploits the condition a move applies', () => {
    // Drench makes the foe Wet; a Nature foe's moves do not exploit Wet, an Electric one does.
    expect(moveTip(content, 'core:drench', foe())).toEqual({
      text: 'Sets up Wet for a combo',
      good: true,
    });
    const bat = foe({ types: ['core:electric', 'core:wind'] });
    expect(moveTip(content, 'core:drench', bat)?.good).toBe(false);
  });
});

describe('bag and cards', () => {
  it('lists potions and capture items with counts and caps', () => {
    const tabs = bagTabsFor(content, {
      'core:zorb': 3,
      'core:super-potion': 2,
      'core:potion': 1,
      'core:max-potion': 0,
    });
    expect(tabs.map((t) => t.label)).toEqual(['Potions', 'Capture']);
    expect(tabs[0]?.items.map((i) => [i.name, i.count, i.cap, i.targeted])).toEqual([
      ['Potion', 1, 5, true],
      ['Super Potion', 2, 5, true],
    ]);
    expect(tabs[1]?.items[0]).toMatchObject({
      name: 'Zorb',
      count: 3,
      sprite: 'orb',
      targeted: false,
    });
  });

  it('shows conditions as chips and the rest as pills', () => {
    const v = cardView(
      content,
      foe({
        statuses: [
          { id: 'core:wet', origin: 'condition', turns: 2 },
          { id: 'core:rooted', origin: 'reaction', turns: 3 },
        ],
      }),
    );
    expect(v.conditions).toEqual([{ id: 'wet', turns: 2 }]);
    expect(v.pills?.map((p) => p.label)).toEqual(['Rooted']);
    const armored = cardView(content, foe({ boss: 'core:thornwing-titan', armor: 'armored' }));
    expect(armored.pills?.[0]?.label).toBe('Armor');
    expect(armored.pills?.[0]?.tip?.body).toMatch(/Overload/);
    expect(
      cardView(content, foe({ boss: 'core:thornwing-titan', armor: 'broken' })).pills?.[0]?.label,
    ).toBe('Broken');
    expect(
      cardView(content, foe({ boss: 'core:thornwing-titan', subdued: true })).pills?.[0]?.label,
    ).toBe('Subdued');
  });

  it('builds tooltips from content', () => {
    expect(typeTip(content, 'fire').body).toMatch(/Strong against Nature, Ice, Metal/);
    expect(conditionTip(content, 'wet', 2).body).toMatch(
      /2 turns left\. Exploited by Electric → Conducted, Ice → Frozen/,
    );
  });
});
