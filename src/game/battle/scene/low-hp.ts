/** Low HP (C36e): under this share of max HP the battle plays its warning sting. */
export const LOW_HP_SHARE = 0.25;

/** A Zorling still standing with less than a quarter of its HP. Pure. */
export function isLowHp(hp: number, maxHp: number): boolean {
  return hp > 0 && maxHp > 0 && hp < maxHp * LOW_HP_SHARE;
}
