/**
 * How a Titan or legendary looks in the overworld, standing in its lair or at its shrine
 * (C36e, size picked from a preview round on 2026-11-15): its battle look (the bulkier Titan
 * genome, or the legendary's) at `LAIR_SIZE`, three times a person's width. A Titan has a
 * dithered glow in its type color; a legendary has its battle shine, whose sparkles twinkle
 * over `LAIR_FRAMES` frames. Pure: same content and species → identical frames.
 */

import type { GameContent } from '@game/data';
import { aura, type PixelSprite } from '@engine/render/sdf-sprite';
import { shine } from './animate';
import { glowColor } from './palette';
import { renderZorling } from './render';
import { battleLook } from './species-look';

/** Sprite size of a Titan or legendary in the overworld (a wild Zorling is 32). */
export const LAIR_SIZE = 48;
/** Transparent margin around the figure, room for the glow and sparkles. */
export const LAIR_PAD = 4;
/** Frames in the legendary's twinkle loop. */
export const LAIR_FRAMES = 12;

export interface LairLook {
  /** Facing right; feet at `LAIR_PAD` above the bottom edge. One frame for a Titan. */
  readonly frames: readonly PixelSprite[];
  readonly legendary: boolean;
}

export function lairLook(content: GameContent, speciesId: string): LairLook {
  const legendary = content.species.require(speciesId).legendary;
  const look = battleLook(content, speciesId, { boss: legendary ? 'legendary' : 'titan' });
  const sprite = renderZorling(look.genome, { size: LAIR_SIZE, fill: look.fill, pad: LAIR_PAD });
  const glow = glowColor(look.genome.types[0]);
  if (!legendary) return { frames: [aura(sprite, [{ color: glow, dither: true }], 0)], legendary };
  const frames = Array.from({ length: LAIR_FRAMES }, (_, i) =>
    shine(sprite, glow, i, look.genome.seed),
  );
  return { frames, legendary };
}
