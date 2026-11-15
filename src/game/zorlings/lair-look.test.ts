import { describe, expect, it } from 'vitest';
import { loadGameContent } from '@game/data';
import { corePack } from '@packs/core';
import { LAIR_FRAMES, LAIR_PAD, LAIR_SIZE, lairLook } from './lair-look';

const content = loadGameContent([corePack]);

const opaque = (s: { data: Uint8ClampedArray }) => {
  let n = 0;
  for (let i = 3; i < s.data.length; i += 4) if (s.data[i]) n++;
  return n;
};

describe('lair looks (C36e)', () => {
  it('draws a Titan at the lair size with one glowing frame', () => {
    const t = lairLook(content, 'core:mossback');
    expect(t.legendary).toBe(false);
    expect(t.frames).toHaveLength(1);
    expect(t.frames[0]?.width).toBe(LAIR_SIZE + 2 * LAIR_PAD);
    const frame = t.frames[0];
    expect(frame && opaque(frame)).toBeGreaterThan(300);
  });

  it('gives a legendary a twinkling loop', () => {
    const l = lairLook(content, 'core:verdion');
    expect(l.legendary).toBe(true);
    expect(l.frames).toHaveLength(LAIR_FRAMES);
    const counts = new Set(l.frames.map(opaque));
    expect(counts.size).toBeGreaterThan(1);
  });

  it('is pure', () => {
    const a = lairLook(content, 'core:verdion').frames[3];
    const b = lairLook(content, 'core:verdion').frames[3];
    expect([...(a?.data ?? [])]).toEqual([...(b?.data ?? [1])]);
  });
});
