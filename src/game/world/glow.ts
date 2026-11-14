/** Glow codes of emissive prop pixels (C32): 0 = none. Lit at night and in some moods. */
export const GLOW = { window: 1, rune: 2, flame: 3 } as const;
export type PropGlow = (typeof GLOW)[keyof typeof GLOW];
