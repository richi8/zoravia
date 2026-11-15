/**
 * The world's campfires (C40): where they are, which one the player faces, whether each
 * burns, the light pools they give off and the flickering fire sprites the scene draws over
 * the map's burnt-down ones. Pure: no DOM.
 */

import { BIOMES, TILE, type BiomeId } from '../biomes';
import { campfireLit, FLAME_FRAMES } from '../campfire';
import type { PropLight } from '../lighting';
import { Painter, type PropSprite } from '../props';
import { fireKey, fireLit, type CampState } from '../rest';
import { placeProp, type TerrainMap } from '../terrain';
import type { World } from '../world-compose';

/** Seconds per flicker frame. */
const FLICKER = 0.14;

export interface Campfire {
  /** World tile. */
  readonly tx: number;
  readonly ty: number;
  /** Save key (`fireKey`). */
  readonly key: string;
  readonly biome: BiomeId;
  /** Sprite top-left and base (world px), as the map places the prop. */
  readonly x: number;
  readonly y: number;
  readonly baseY: number;
}

export class Campfires {
  readonly list: readonly Campfire[];
  private readonly byTile = new Map<number, Campfire>();
  private readonly frames = new Map<BiomeId, PropSprite[]>();

  constructor(
    private readonly world: Pick<World, 'toLocal' | 'biomeAt'> & {
      readonly map: Pick<TerrainMap, 'props' | 'width'>;
    },
  ) {
    const out: Campfire[] = [];
    for (const p of world.map.props) {
      if (p.kind !== 'campfire') continue;
      const here = world.toLocal(p.tx, p.ty);
      if (!here) continue;
      const biome = world.biomeAt(p.tx, p.ty);
      const at = placeProp(p, this.frame(biome, 0));
      const fire: Campfire = {
        tx: p.tx,
        ty: p.ty,
        key: fireKey(here.region.id, here.x, here.y, here.region.map.origin),
        biome,
        x: at.x,
        y: at.y,
        baseY: at.by,
      };
      out.push(fire);
      this.byTile.set(p.ty * world.map.width + p.tx, fire);
    }
    this.list = out;
  }

  /** The campfire on world tile (`tx`, `ty`), if any. */
  at(tx: number, ty: number): Campfire | undefined {
    return this.byTile.get(ty * this.world.map.width + tx);
  }

  /** The burning fire's sprite at `time` seconds (it flickers). */
  sprite(fire: Campfire, time: number): PropSprite {
    return this.frame(fire.biome, Math.floor(time / FLICKER) % FLAME_FRAMES);
  }

  /** Light pools of the fires near the view rect (world px). */
  lights(
    camp: CampState,
    playtime: number,
    view: { x: number; y: number; width: number; height: number },
  ): PropLight[] {
    const out: PropLight[] = [];
    const m = 4 * TILE;
    for (const f of this.list) {
      const cx = f.tx * TILE + TILE / 2;
      if (cx < view.x - m || cx > view.x + view.width + m) continue;
      if (f.baseY < view.y - m || f.baseY > view.y + view.height + m) continue;
      const lit = fireLit(camp, f.key, playtime);
      out.push({ kind: lit ? 'campfire' : 'embers', x: cx, y: f.baseY - (lit ? 6 : 2) });
    }
    return out;
  }

  private frame(biome: BiomeId, f: number): PropSprite {
    let frames = this.frames.get(biome);
    if (!frames) {
      const p = new Painter(BIOMES[biome]);
      frames = Array.from({ length: FLAME_FRAMES }, (_, i) => campfireLit(p, i));
      this.frames.set(biome, frames);
    }
    return frames[f] as PropSprite;
  }
}
