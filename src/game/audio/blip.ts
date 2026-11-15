/**
 * Dialogue text blips (C36e): a soft blip every few characters while a person's text types
 * out, pitched per speaker so voices tell apart. Narration and signs (no speaker) are
 * silent. The blip itself is `world.blip` on the SFX bus (`playBlip`).
 */

/** One blip per this many letters or digits typed. */
export const BLIP_EVERY = 3;

/** Lowest and highest speaker pitch (multipliers of the base blip). */
export const BLIP_PITCH = [0.75, 1.35] as const;

/** A speaker's blip pitch, fixed per name. Pure. */
export function speakerPitch(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  const t = ((h >>> 0) % 1000) / 999;
  return BLIP_PITCH[0] + (BLIP_PITCH[1] - BLIP_PITCH[0]) * t;
}

/**
 * Counts typed letters and says when to blip: `typed(text)` returns true when one of the
 * letters in `text` lands on a blip (the first letter of a page always does).
 */
export class BlipCounter {
  private count = 0;

  typed(text: string): boolean {
    let blip = false;
    for (const ch of text) {
      if (!/[\p{L}\p{N}]/u.test(ch)) continue;
      if (this.count % BLIP_EVERY === 0) blip = true;
      this.count++;
    }
    return blip;
  }
}
