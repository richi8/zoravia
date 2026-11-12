import { describe, expect, it } from 'vitest';
import { loadGameContent, POTION_BAG_CAP } from '@game/data';
import { corePack } from '@packs/core';
import { addToBag, bagCount, bagRoom, EMPTY_BAG, takeFromBag } from '.';

const content = loadGameContent([corePack]);

describe('bag', () => {
  it('adds items and counts them', () => {
    const { bag, added } = addToBag(content, EMPTY_BAG, 'core:potion', 2);
    expect(added).toBe(2);
    expect(bagCount(bag, 'core:potion')).toBe(2);
    expect(bagCount(bag, 'core:zorb')).toBe(0);
    expect(EMPTY_BAG).toEqual({});
  });

  it('caps potions at 5 per type', () => {
    expect(POTION_BAG_CAP).toBe(5);
    let { bag } = addToBag(content, EMPTY_BAG, 'core:potion', 4);
    const more = addToBag(content, bag, 'core:potion', 3);
    expect(more.added).toBe(1);
    expect(bagCount(more.bag, 'core:potion')).toBe(5);
    expect(bagRoom(content, more.bag, 'core:potion')).toBe(0);
    const full = addToBag(content, more.bag, 'core:potion');
    expect(full).toEqual({ bag: more.bag, added: 0 });
    // Each potion tier has its own cap.
    bag = addToBag(content, more.bag, 'core:super-potion', 9).bag;
    expect(bagCount(bag, 'core:super-potion')).toBe(5);
  });

  it('has no cap for capture items', () => {
    const { bag, added } = addToBag(content, EMPTY_BAG, 'core:zorb', 40);
    expect(added).toBe(40);
    expect(bagRoom(content, bag, 'core:zorb')).toBe(Infinity);
  });

  it('takes items and drops empty entries', () => {
    const { bag } = addToBag(content, EMPTY_BAG, 'core:potion', 2);
    expect(takeFromBag(bag, 'core:potion')).toEqual({ 'core:potion': 1 });
    expect(takeFromBag(bag, 'core:potion', 2)).toEqual({});
    expect(() => takeFromBag(bag, 'core:potion', 3)).toThrow(/cannot take 3/);
    expect(bag).toEqual({ 'core:potion': 2 }); // never mutated
  });

  it('rejects bad counts and unknown items', () => {
    expect(() => addToBag(content, EMPTY_BAG, 'core:potion', 0)).toThrow(/positive integer/);
    expect(() => takeFromBag(EMPTY_BAG, 'core:potion', 1.5)).toThrow(/positive integer/);
    expect(() => addToBag(content, EMPTY_BAG, 'core:nope')).toThrow();
  });
});
