import { describe, expect, it } from 'vitest';
import { BADGE_NOTE, QUEST_NOTE } from '@game/story';
import { splitNotes } from './toast';

describe('toasts', () => {
  it('turns quest and badge notes into toasts and keeps the rest as pages', () => {
    const r = splitNotes([
      `${QUEST_NOTE.started}Lost Kite`,
      'You got 2 Potions.',
      `${QUEST_NOTE.done}Lost Kite`,
      `${BADGE_NOTE}Grove Badge!`,
    ]);
    expect(r.pages).toEqual(['You got 2 Potions.']);
    expect(r.toasts.map((t) => t.title)).toEqual(['New quest', 'Quest complete', 'Badge']);
    expect(r.toasts[2]?.text).toBe('Grove Badge');
  });
});
