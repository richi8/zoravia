/**
 * What each scene sounds like (C25). Scenes call these on enter/resume so the choice of
 * music, ambience and their levels lives in one place.
 */

import type { GameContent } from '@game/data';
import type { BiomeId } from '@game/world/biomes';
import { battleMusic, biomeAmbience, fieldSong, titleSong } from './music';
import {
  playAmbience,
  playMusic,
  setAmbienceLevel,
  setMusicLevel,
  setMusicTone,
  stopAmbience,
  stopMusic,
} from './sound';

/** Ambience level under battle music. */
export const BATTLE_AMBIENCE_LEVEL = 0.35;

/** The title screen (C33): its own theme, no ambience. */
export function titleAudio(): void {
  setMusicLevel(1, 0.1);
  setMusicTone('normal', 0.1);
  playMusic(titleSong(), { fade: 1.5 });
  stopAmbience(1);
}

/** The overworld of a biome: its field song (resumed where it was left) and ambience. */
export function fieldAudio(biome: BiomeId): void {
  setMusicLevel(1, 0.1);
  setMusicTone('normal', 0.1);
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
  setMusicTone('normal', 0.1);
  playMusic(battleMusic(content, b), { fade: 0.4, restart: true });
  playAmbience(biomeAmbience(b.biome, b.weather), { fade: 1 });
  setAmbienceLevel(BATTLE_AMBIENCE_LEVEL, 0.6);
}

/** The battle is decided: the music makes room for the victory or defeat jingle. */
export function battleOverAudio(): void {
  stopMusic(0.35);
  setMusicTone('normal', 0.35);
}

/** Widest stereo pan of a sound placed on screen (C36e: overworld cries). */
export const SCREEN_PAN = 0.8;

/**
 * Stereo pan of a sound made at screen x `x` on a screen `width` wide: −`SCREEN_PAN` at the
 * left edge, 0 in the middle, `SCREEN_PAN` at the right edge (clamped off screen). Pure.
 */
export function screenPan(x: number, width: number): number {
  if (width <= 0) return 0;
  const t = (x / width) * 2 - 1;
  return Math.max(-1, Math.min(1, t)) * SCREEN_PAN;
}
