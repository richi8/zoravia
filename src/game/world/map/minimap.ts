/**
 * Region minimap (C19 viewer, shared with the overworld map screen in C22): one flat color per
 * tile from the biome's ramps (water, props, paths, tall grass, high ground, ground) plus roof
 * colors for buildings and path color for bridges (C28), drawn at
 * a whole number of game pixels per tile.
 */

import { packColor, PixelBuffer } from '@engine/render/pixel-buffer';
import type { Biome } from '../biomes';
import { TOWN_RAMPS } from '../buildings';
import { PROP_INFO, propFootprint } from '../props';
import type { WorldMap } from './world-map';

/** Packed color of one tile; `tint` may change it (overlays). */
export type MinimapTint = (packed: number, tx: number, ty: number) => number;

/** Packed base color of a tile; `prop` is the kind of the prop standing on it. */
export function minimapColor(
  m: WorldMap,
  biome: Biome,
  tx: number,
  ty: number,
  prop: string | undefined,
): number {
  const r = biome.ramps;
  const corners = (g: WorldMap['alt']): number =>
    g.get(tx, ty) + g.get(tx + 1, ty) + g.get(tx, ty + 1) + g.get(tx + 1, ty + 1);
  let c: number;
  if (corners(m.liquid) >= 2) c = r.liquid[1] ?? 0;
  else if (prop)
    c = (PROP_INFO[prop as keyof typeof PROP_INFO].solid ? r.foliage[1] : r.accent[2]) ?? 0;
  else if (corners(m.path) >= 2) c = r.path[2] ?? 0;
  else if (m.tall(tx, ty)) c = r.tall[1] ?? 0;
  else if (corners(m.alt) >= 2) c = r.alt[2] ?? 0;
  else c = r.ground[2] ?? 0;
  return packColor(c);
}

/** The whole region, `scale` game pixels per tile. */
export function buildMinimap(
  m: WorldMap,
  biome: Biome,
  scale: number,
  tint?: MinimapTint,
): PixelBuffer {
  const s = Math.max(1, Math.floor(scale));
  const mini = new PixelBuffer(m.width * s, m.height * s);
  const props = new Map(m.props.map((p) => [p.ty * m.width + p.tx, p.kind]));
  const towns = townColors(m, biome);
  for (let ty = 0; ty < m.height; ty++) {
    for (let tx = 0; tx < m.width; tx++) {
      let c =
        towns.get(ty * m.width + tx) ??
        minimapColor(m, biome, tx, ty, props.get(ty * m.width + tx));
      if (tint) c = tint(c, tx, ty);
      for (let y = 0; y < s; y++) {
        const row = (ty * s + y) * mini.width + tx * s;
        mini.data.fill(c, row, row + s);
      }
    }
  }
  return mini;
}

/** Roof colors of houses by `variant & 3` (same order as the sprites). */
const HOUSE_ROOFS = [
  TOWN_RAMPS.roofTeal,
  TOWN_RAMPS.roofMustard,
  TOWN_RAMPS.roofRed,
  TOWN_RAMPS.roofPlum,
] as const;

/** Buildings fill their footprint with their roof color; bridge decks read as path (C28). */
function townColors(m: WorldMap, biome: Biome): Map<number, number> {
  const out = new Map<number, number>();
  for (const p of m.props) {
    let rgb: number | undefined;
    if (p.kind === 'center') rgb = TOWN_RAMPS.roofRed[2];
    else if (p.kind === 'shop') rgb = TOWN_RAMPS.roofBlue[2];
    else if (p.kind === 'house') rgb = HOUSE_ROOFS[(p.variant ?? 0) & 3]?.[2];
    else if (PROP_INFO[p.kind].walkway) rgb = biome.ramps.path[1];
    if (rgb === undefined) continue;
    const [x0, y0, w, h] = propFootprint(p.kind, p.tx, p.ty, p.variant);
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++)
        if (m.inside(x, y)) out.set(y * m.width + x, packColor(rgb));
  }
  return out;
}
