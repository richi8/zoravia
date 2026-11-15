import { describe, expect, it } from 'vitest';
import { BADGE_NOTE, QUEST_NOTE } from '@game/story';
import { discoveryToast, splitNotes } from './toast';

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

  it('names a discovered place with its levels; secrets are gold, towns have no levels', () => {
    const base = { key: 'zone:x', x: 0, y: 0, radius: 0, levels: [16, 22] as const };
    expect(discoveryToast({ ...base, kind: 'zone', name: 'Fernwood' })).toEqual({
      title: 'Discovered',
      text: 'Fernwood · Lv 16–22',
    });
    expect(discoveryToast({ ...base, kind: 'secret', name: 'Hidden Glade' })).toMatchObject({
      title: 'Secret place',
      big: true,
    });
    expect(discoveryToast({ ...base, kind: 'town', name: 'Fernhollow' }).text).toBe('Fernhollow');
  });
});
