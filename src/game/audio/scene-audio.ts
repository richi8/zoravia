/**
 * What each scene sounds like (C25). Scenes call these on enter/resume so the choice of
 * music, ambience and their levels lives in one place.
 */

import type { GameContent } from '@game/data';
import type { BiomeId } from '@game/world/biomes';
import { battleMusic, biomeAmbience, fieldSong } from './music';
import { playAmbience, playMusic, setAmbienceLevel, setMusicLevel, stopMusic } from './sound';

/** Ambience level under battle music. */
export const BATTLE_AMBIENCE_LEVEL = 0.35;

/** The overworld of a biome: its field song (resumed where it was left) and ambience. */
export function fieldAudio(biome: BiomeId): void {
  setMusicLevel(1, 0.1);
  playMusic(fieldSong(biome), { fade: 1.5 });
  playAmbience(biomeAmbience(biome));
  setAmbienceLevel(1, 1.5);
}

export interface BattleAudio {
  readonly biome: BiomeId;
  readonly boss?: string;
  /** Weather condition ids on the field (`core:wet` adds rain). */
  readonly weather?: readonly string[];
}

/** A battle: its music from the top, the place's ambience turned down. */
export function battleAudio(content: GameContent, b: BattleAudio): void {
  setMusicLevel(1, 0.1);
  playMusic(battleMusic(content, b), { fade: 0.4, restart: true });
  playAmbience(biomeAmbience(b.biome, b.weather), { fade: 1 });
  setAmbienceLevel(BATTLE_AMBIENCE_LEVEL, 0.6);
}

/** The battle is decided: the music makes room for the victory or defeat jingle. */
export function battleOverAudio(): void {
  stopMusic(0.35);
}
