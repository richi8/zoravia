import { describe, expect, it } from 'vitest';
import { BIOME_IDS } from '@game/world/biomes';
import { dangerTone, drawBackdrop, type Painter } from './backdrop';

/** Paints rects into a color grid, like the pixel layer would. */
function paint(width: number, height: number, kind: Parameters<typeof drawBackdrop>[3]) {
  const grid = new Int32Array(width * height).fill(-1);
  let pending: [number, number, number, number][] = [];
  let outside = 0;
  const g: Painter = {
    clear: () => undefined,
    rect: (x, y, w, h) => void pending.push([x, y, w, h]),
    fill: ({ color }) => {
      for (const [x, y, w, h] of pending) {
        if (x + w <= 0 || y + h <= 0 || x >= width || y >= height) outside++;
        for (let j = Math.max(0, y); j < Math.min(height, y + h); j++)
          for (let i = Math.max(0, x); i < Math.min(width, x + w); i++) grid[j * width + i] = color;
      }
      pending = [];
    },
  };
  drawBackdrop(g, width, height, kind);
  return { grid, outside, left: pending.length };
}

describe('battle backdrops (C36e)', () => {
  for (const biome of BIOME_IDS) {
    for (const [w, h] of [
      [480, 270],
      [640, 360],
    ] as const) {
      it(`${biome} covers the whole ${w}×${h} screen`, () => {
        const { grid, left } = paint(w, h, { biome });
        expect(left).toBe(0);
        expect(grid.every((c) => c >= 0)).toBe(true);
      });
    }
  }

  it('each biome looks different', () => {
    const tops = BIOME_IDS.map((biome) => paint(480, 270, { biome }).grid[5 * 480 + 5]);
    expect(new Set(tops).size).toBe(BIOME_IDS.length);
  });

  it('a danger zone draws the same shapes in the darker tone', () => {
    for (const biome of BIOME_IDS) {
      const plain = paint(480, 270, { biome }).grid;
      const dark = paint(480, 270, { biome, danger: true }).grid;
      for (let i = 0; i < plain.length; i += 97) {
        expect(dark[i]).toBe(dangerTone(plain[i] ?? 0));
      }
    }
  });

  it('the danger tone is darker', () => {
    const lum = (c: number) => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);
    for (const c of [0xffffff, 0x8fd16b, 0xf0ac70, 0xe4eef7]) {
      expect(lum(dangerTone(c))).toBeLessThan(lum(c));
    }
  });
});
