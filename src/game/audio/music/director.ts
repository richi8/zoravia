/**
 * Which music plays where (C25), as pure functions:
 * - the field of a biome plays its field song;
 * - a battle plays the biome's battle song; a boss plays its hand-written theme, or boss
 *   music composed from the biome's battle arrangement when it has none.
 */

import type { Song } from '@engine/audio';
import type { GameContent } from '@game/data';
import type { BiomeId } from '@game/world/biomes';
import { composeSong } from './compose';
import { BIOME_MUSIC, bossArrangement, TITLE_MUSIC } from './styles';
import { themeSong } from './themes';

const composed = new Map<string, Song>();

function composedSong(id: string, make: () => Song): Song {
  let s = composed.get(id);
  if (!s) {
    s = make();
    composed.set(id, s);
  }
  return s;
}

export function fieldSong(biome: BiomeId): Song {
  const id = `field:${biome}`;
  return composedSong(id, () => composeSong(id, BIOME_MUSIC[biome].field));
}

/** The title screen's theme (C33). */
export function titleSong(): Song {
  return composedSong('title', () => composeSong('title', TITLE_MUSIC));
}

export function battleSong(biome: BiomeId): Song {
  const id = `battle:${biome}`;
  return composedSong(id, () => composeSong(id, BIOME_MUSIC[biome].battle));
}

/** Boss music composed for a biome (bosses without a theme). */
export function bossSong(biome: BiomeId): Song {
  const id = `boss:${biome}`;
  return composedSong(id, () => composeSong(id, bossArrangement(BIOME_MUSIC[biome].battle)));
}

export interface BattleMusicContext {
  readonly biome: BiomeId;
  /** Boss entry id when a boss is fought. */
  readonly boss?: string;
}

export function battleMusic(content: GameContent, ctx: BattleMusicContext): Song {
  if (ctx.boss) {
    const theme = content.bosses.get(ctx.boss)?.theme;
    return theme ? themeSong(content, theme) : bossSong(ctx.biome);
  }
  return battleSong(ctx.biome);
}
