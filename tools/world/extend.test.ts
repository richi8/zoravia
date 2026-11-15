import { describe, expect, it } from 'vitest';
import { decodeRegion, encodeRegion, type WorldMap } from '@game/world/map';
import { EXITS, regionConfigSchema, type Exit, type RegionConfigInput } from './config';
import { generateExtension, stitch } from './extend';
import { generateRegion } from './generate';

const MID = 24;
/** A 48×48 region with a road from its hub to the middle of every side. */
const BASE: RegionConfigInput = {
  name: 'Extend test',
  biome: 'forest',
  seed: 9,
  width: 48,
  height: 48,
  zones: { near: { name: 'Near', tier: 't1' } },
  layout: {
    towns: { hub: { name: 'Hub', at: [MID, MID], radius: 4 } },
    routes: [
      {
        points: [
          [MID, MID],
          [MID, 0],
        ],
        wobble: 0,
      },
      {
        points: [
          [MID, MID],
          [MID, 47],
        ],
        wobble: 0,
      },
      {
        points: [
          [MID, MID],
          [0, MID],
        ],
        wobble: 0,
      },
      {
        points: [
          [MID, MID],
          [47, MID],
        ],
        wobble: 0,
      },
    ],
    ponds: 0,
    zones: { near: { seeds: [[MID, 10]] } },
    exits: {},
  },
};

/** A strip on `side`, 20 deep, with a camp joined to the region by a road. */
function config(side: Exit): RegionConfigInput {
  const depth = 20;
  const vertical = side === 'north' || side === 'south';
  // In strip coordinates: where it touches the region, and its camp.
  const seam =
    side === 'north'
      ? [MID, depth - 1]
      : side === 'south'
        ? [MID, 0]
        : side === 'west'
          ? [depth - 1, MID]
          : [0, MID];
  const camp = vertical ? [MID, depth / 2] : [depth / 2, MID];
  return {
    ...BASE,
    extensions: {
      wilds: {
        side,
        size: depth,
        seed: 31,
        zones: { wild: { name: 'Wild', tier: 'danger' } },
        layout: {
          towns: { camp: { name: 'Camp', at: camp as [number, number], radius: 3 } },
          routes: [{ points: [camp as [number, number], seam as [number, number]], wobble: 0 }],
          ponds: 0,
          clearings: [{ id: 'heart', kind: 'heart', at: [6, 6], radius: 2 }],
          zones: { wild: { seeds: [[4, 4]] } },
          exits: { join: { at: seam as [number, number], kind: 'edge' } },
        },
      },
    },
  };
}

function grow(side: Exit): { base: WorldMap; grown: WorldMap } {
  const cfg = regionConfigSchema.parse(config(side));
  const base = generateRegion(cfg);
  const strip = generateExtension(cfg, 'wilds', base);
  // Through the file format, as the build does.
  const frozen = decodeRegion(encodeRegion(strip));
  return { base, grown: stitch(base, frozen, cfg.extensions['wilds']?.side ?? side) };
}

describe('region extensions (C36)', () => {
  it.each(EXITS)('%s: the region keeps every tile outside the join', (side) => {
    const { base, grown } = grow(side);
    const vertical = side === 'north' || side === 'south';
    expect([grown.width, grown.height]).toEqual(vertical ? [48, 68] : [68, 48]);
    const [ox, oy] = side === 'north' ? [0, 20] : side === 'west' ? [20, 0] : [0, 0];
    expect(grown.origin).toEqual([ox, oy]);
    let changed = 0;
    for (let y = 0; y < base.height; y++) {
      for (let x = 0; x < base.width; x++) {
        const i = y * base.width + x;
        const j = (y + oy) * grown.width + x + ox;
        expect(grown.zoneIndex[j]).toBe(base.zoneIndex[i]);
        if (
          grown.flags[j] !== base.flags[i] ||
          grown.blocked(x + ox, y + oy) !== base.blocked(x, y)
        )
          changed++;
      }
    }
    // Only the 5×2 border tiles in front of the join open.
    expect(changed).toBeLessThanOrEqual(10);
    // Every prop of the region is still there (moved by the origin), except border trees.
    const at = new Set(grown.props.map((p) => `${p.kind}@${p.tx},${p.ty}`));
    const lost = base.props.filter((p) => !at.has(`${p.kind}@${p.tx + ox},${p.ty + oy}`));
    expect(lost.length).toBeLessThanOrEqual(10);
    expect(lost.every((p) => p.kind === 'tree')).toBe(true);
  });

  it.each(EXITS)('%s: the strip is reachable from the region spawn', (side) => {
    const { base, grown } = grow(side);
    const spawn = grown.anchors['spawn'];
    expect(spawn).toEqual({
      ...base.anchors['spawn'],
      x: (base.anchors['spawn']?.x ?? 0) + grown.origin[0],
      y: (base.anchors['spawn']?.y ?? 0) + grown.origin[1],
    });
    const reach = grown.reachableFrom(spawn?.x ?? 0, spawn?.y ?? 0);
    for (const k of ['town-camp', 'heart']) {
      const a = grown.anchors[k];
      expect(a, k).toBeDefined();
      expect(reach[(a?.y ?? 0) * grown.width + (a?.x ?? 0)], k).toBe(1);
    }
    // The join is not a connection; the strip's zone joins the map's with its own glyph.
    expect(grown.connections['join']).toBeUndefined();
    expect(grown.zones.map((z) => z.key)).toEqual(['near', 'wild']);
    expect(new Set(grown.zones.map((z) => z.glyph)).size).toBe(2);
    expect(grown.zone('wild')?.tier).toBe('danger');
  });

  it('round-trips the origin through the map file', () => {
    const { grown } = grow('north');
    expect(decodeRegion(encodeRegion(grown)).origin).toEqual([0, 20]);
    expect(encodeRegion(grow('south').grown).origin).toBeUndefined();
  });

  it('refuses a strip that does not fit the side', () => {
    const { base } = grow('north');
    const cfg = regionConfigSchema.parse(config('east'));
    const strip = generateExtension(cfg, 'wilds', { width: 48, height: 30 });
    expect(() => stitch(base, strip, 'east')).toThrow(/as long as/);
  });
});
