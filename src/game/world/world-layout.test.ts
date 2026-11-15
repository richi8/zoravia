import { describe, expect, it } from 'vitest';
import { loadGameContent } from '@game/data';
import { corePack } from '@packs/core';
import { starts } from '@packs/core/starts';
import { SHIPPED_PACKS } from '@packs/index';
import { gapBetween, worldBounds, worldLayout, worldLinks } from './world-layout';

const content = loadGameContent([...SHIPPED_PACKS]);

describe('world layout (C36c)', () => {
  it('places every region at its world offset', () => {
    const layout = worldLayout(content);
    expect(layout.map((r) => [r.map, r.x, r.y, r.width, r.height])).toEqual([
      ['core:verdale', 0, 0, 200, 280],
      ['emberwaste:emberwaste', 200, 80, 280, 200],
      ['rimeholm:rimeholm', -12, 304, 200, 280],
    ]);
    expect(worldBounds(layout)).toEqual({ x: -12, y: 0, width: 492, height: 584 });
  });

  it('no two regions overlap', () => {
    const layout = worldLayout(content);
    for (const a of layout)
      for (const b of layout) {
        if (a === b) continue;
        const apart =
          a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y;
        expect(apart, `${a.map} / ${b.map}`).toBe(true);
      }
  });

  it('Ember Pass lines up tile for tile; the ferry crosses the sea', () => {
    const links = worldLinks(content, worldLayout(content));
    expect(links).toHaveLength(2);
    const pass = links.find((l) => l.kind === 'pass');
    const ferry = links.find((l) => l.kind === 'ferry');
    // The two ends of the pass are neighbouring world tiles.
    expect(pass && Math.abs(pass.a.x - pass.b.x) + Math.abs(pass.a.y - pass.b.y)).toBe(1);
    expect(pass?.sea).toBeUndefined();
    // The ferry runs straight south across 24 tiles of sea.
    expect(ferry && ferry.a.x === ferry.b.x).toBe(true);
    expect(ferry?.sea).toEqual({ x: 0, y: 280, width: 188, height: 24 });
  });

  it('puts a map without a place east of the others', () => {
    const layout = worldLayout(content, ['core:test-region']);
    expect(layout.at(-1)).toMatchObject({ map: 'core:test-region', x: 496, y: 0 });
    // A map the starts already place is not added twice.
    expect(worldLayout(content, ['core:verdale'])).toHaveLength(3);
  });

  it('finds the gap between regions side by side', () => {
    const a = { map: 'a', name: 'A', x: 0, y: 0, width: 10, height: 10 };
    expect(gapBetween(a, { ...a, map: 'b', x: 14, y: 5 })).toEqual({
      x: 10,
      y: 5,
      width: 4,
      height: 5,
    });
    expect(gapBetween(a, { ...a, map: 'b', x: 10 })).toBeUndefined();
  });

  it('rejects regions that overlap', () => {
    const bad = {
      manifest: { id: 'mod', version: '1.0.0', dependsOn: ['core'] },
      content: {
        starts: {
          clash: {
            ...starts.verdale,
            map: 'core:test-region',
            world: { x: 150, y: 150 },
          },
        },
      },
    };
    expect(() => loadGameContent([corePack, bad])).toThrow(/overlaps core:verdale/);
  });
});
