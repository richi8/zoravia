/**
 * Text view of a map for authors: find tile coordinates for overlay edits without opening
 * the game. Rulers every 10 tiles; one character per tile.
 */

import { PROP_INFO } from '@game/world/props';
import type { WorldMap } from '@game/world/map';
import type { TileRect } from '@game/world/terrain';

export const ASCII_LEGEND =
  '~ liquid · = path · , alt ground · " tall grass · T solid prop · * other prop · # blocked · @ anchor · X connection';

export function asciiMap(m: WorldMap, opts: { zones?: boolean; rect?: TileRect } = {}): string {
  const r = opts.rect ?? { x: 0, y: 0, width: m.width, height: m.height };
  const props = new Map(m.props.map((p) => [p.ty * m.width + p.tx, p]));
  const marks = new Map<number, string>();
  for (const a of Object.values(m.anchors)) marks.set(a.y * m.width + a.x, '@');
  for (const c of Object.values(m.connections)) marks.set(c.y * m.width + c.x, 'X');
  const lines: string[] = [];
  const pad = String(r.y + r.height).length;
  let ruler = ' '.repeat(pad + 1);
  for (let x = r.x; x < r.x + r.width; x++) ruler += x % 10 === 0 ? String((x / 10) % 10) : ' ';
  lines.push(ruler);
  for (let y = r.y; y < r.y + r.height; y++) {
    let row = `${String(y).padStart(pad)} `;
    for (let x = r.x; x < r.x + r.width; x++) {
      if (!m.inside(x, y)) {
        row += ' ';
        continue;
      }
      const i = y * m.width + x;
      const mark = marks.get(i);
      if (mark) row += mark;
      else if (opts.zones) row += m.zoneAt(x, y)?.glyph ?? (m.blocked(x, y) ? '#' : '.');
      else row += tileChar(m, x, y, props.get(i)?.kind);
    }
    lines.push(row);
  }
  return lines.join('\n');
}

function tileChar(
  m: WorldMap,
  x: number,
  y: number,
  prop: keyof typeof PROP_INFO | undefined,
): string {
  if (m.liquidCorners(x, y) >= 3) return m.blocked(x, y) ? '~' : 'o';
  if (prop) return PROP_INFO[prop].solid ? 'T' : '*';
  if (m.blocked(x, y)) return '#';
  const path =
    m.path.get(x, y) + m.path.get(x + 1, y) + m.path.get(x, y + 1) + m.path.get(x + 1, y + 1);
  if (path >= 2) return '=';
  if (m.tall(x, y)) return '"';
  const alt = m.alt.get(x, y) + m.alt.get(x + 1, y) + m.alt.get(x, y + 1) + m.alt.get(x + 1, y + 1);
  return alt >= 2 ? ',' : '.';
}
