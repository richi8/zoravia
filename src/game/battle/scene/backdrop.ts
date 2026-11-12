/**
 * Placeholder forest battle backdrop from the C10 mock (sky bands with dithered edges, clouds,
 * hills, tree line, grass, two platforms). Drawn into the pixel layer; extends to any screen
 * size. Biome backdrops come with the world (C19+).
 */

import type { Graphics } from 'pixi.js';

export interface Platforms {
  readonly foe: { readonly x: number; readonly y: number };
  readonly ally: { readonly x: number; readonly y: number };
}

/** Platform centers for a screen size (game pixels). */
export function platforms(width: number, height: number): Platforms {
  const extra = height - 270;
  return {
    foe: { x: Math.round(width * 0.75), y: Math.round(120 + extra * 0.35) },
    ally: { x: Math.round(Math.max(120, width * 0.27)), y: height - 70 },
  };
}

function ellipseRows(
  g: Graphics,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: number,
): void {
  for (let j = -ry; j <= ry; j++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (j * j) / (ry * ry))));
    if (half > 0) g.rect(cx - half, cy + j, half * 2, 1);
  }
  g.fill({ color });
}

export function drawBackdrop(g: Graphics, width: number, height: number): void {
  g.clear();
  const p = platforms(width, height);
  const horizon = Math.round(p.foe.y + 16);
  const bands = [0x8fd0ee, 0xa2daf0, 0xb7e4f1, 0xcdeef2];
  const bandH = horizon / bands.length;
  bands.forEach((c, i) => {
    g.rect(0, Math.round(i * bandH), width, Math.ceil(bandH) + 1).fill({ color: c });
  });
  // Dithered band edges.
  for (let i = 1; i < bands.length; i++) {
    const y = Math.round(i * bandH) - 2;
    const next = bands[i] ?? 0;
    for (let x = y & 1; x < width; x += 2) g.rect(x, y, 1, 1);
    for (let x = (y + 1) & 1; x < width; x += 4) g.rect(x, y + 1, 1, 1);
    g.fill({ color: next });
  }
  // Clouds.
  for (const [fx, cy, s] of [
    [0.15, 30, 1],
    [0.52, 18, 0.8],
    [0.88, 46, 1.1],
  ] as const) {
    const cx = Math.round(width * fx);
    ellipseRows(g, cx, cy, Math.round(22 * s), Math.round(6 * s), 0xffffff);
    ellipseRows(
      g,
      Math.round(cx - 8 * s),
      Math.round(cy - 4 * s),
      Math.round(10 * s),
      Math.round(6 * s),
      0xffffff,
    );
    ellipseRows(
      g,
      Math.round(cx + 9 * s),
      Math.round(cy - 5 * s),
      Math.round(9 * s),
      Math.round(7 * s),
      0xffffff,
    );
    g.rect(Math.round(cx - 20 * s), Math.round(cy + 4 * s), Math.round(40 * s), 1).fill({
      color: 0xe2f3f8,
    });
  }
  // Hills and tree line.
  for (let x = 0; x < width; x++) {
    const hy = horizon - 32 + Math.round(10 * Math.sin(x / 47) + 6 * Math.sin(x / 19 + 1));
    g.rect(x, hy, 1, horizon - hy);
  }
  g.fill({ color: 0x86c79a });
  for (let x = 0; x < width; x++) {
    const ty = horizon - 14 - Math.round(5 * Math.abs(Math.sin(x / 9)) - 3 * Math.sin(x / 31));
    g.rect(x, ty, 1, horizon - ty);
  }
  g.fill({ color: 0x5fae74 });
  // Grass.
  const gh = height - horizon;
  g.rect(0, horizon, width, Math.ceil(gh * 0.3)).fill({ color: 0x8fd16b });
  g.rect(0, horizon + Math.ceil(gh * 0.3), width, Math.ceil(gh * 0.35)).fill({ color: 0x84c862 });
  g.rect(0, horizon + Math.ceil(gh * 0.65), width, gh).fill({ color: 0x79bd58 });
  for (let y = horizon + 2; y < height; y += 3) {
    for (let x = (y * 7) % 23; x < width; x += 23) g.rect(x, y, 1, 1);
  }
  g.fill({ color: 0x6aad4c });
  // Platforms.
  for (const [c, rx, ry] of [
    [p.foe, 64, 13],
    [p.ally, 76, 16],
  ] as const) {
    ellipseRows(g, c.x, c.y + 2, rx, ry, 0x5f9f45);
    ellipseRows(g, c.x, c.y, rx - 2, ry - 2, 0x76b955);
    ellipseRows(g, c.x, c.y - 2, rx - 10, ry - 6, 0x88c863);
  }
}
