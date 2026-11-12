/**
 * Text roles of the in-game UI (sizes in game pixels). Text is drawn smooth at native
 * resolution by the engine's UI layer; positions should still be whole game pixels.
 */

import { Text, type TextStyleOptions } from 'pixi.js';
import { fonts, paper } from '../style/tokens';

export const TEXT_ROLES = {
  /** Running text, menu items, dialog. */
  body: { fontFamily: fonts.ui, fontSize: 10, fontWeight: '600', lineHeight: 12 },
  /** Small caps labels: HP, LV, POW, tabs, key hints. */
  label: { fontFamily: fonts.ui, fontSize: 7, fontWeight: '800', letterSpacing: 0.4 },
  /** Zorling names, panel titles. */
  name: { fontFamily: fonts.display, fontSize: 11, fontWeight: '600' },
  /** Numbers (HP, levels, prices). */
  number: { fontFamily: fonts.ui, fontSize: 10, fontWeight: '800' },
  /** Big battle callouts ("Wildfire!", damage numbers). */
  callout: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '700',
    stroke: { color: paper.edge, width: 3, join: 'round' },
  },
} as const satisfies Record<string, TextStyleOptions>;

export type TextRole = keyof typeof TEXT_ROLES;

/** New UI text in a role; `label` text is upper-cased. */
export function uiText(
  role: TextRole,
  text: string,
  fill: number = paper.ink,
  extra: TextStyleOptions = {},
): Text {
  return new Text({
    text: role === 'label' ? text.toUpperCase() : text,
    style: { ...TEXT_ROLES[role], fill, ...extra },
  });
}
