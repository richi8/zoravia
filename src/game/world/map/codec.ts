/**
 * Converts between the shipped map format (`RegionMapData`, see `@game/data/maps`) and the
 * in-memory `WorldMap`. Decoding expects validated data (the pack loader checks it).
 */

import {
  chunkSpan,
  CORNER_ALT,
  CORNER_LIQUID,
  CORNER_PATH,
  MAP_FORMAT,
  NO_ZONE,
  type ChunkData,
  type RegionMapData,
} from '@game/data/maps';
import { WorldMap, type Zone } from './world-map';

export function decodeRegion(data: RegionMapData): WorldMap {
  const m = new WorldMap(data);
  m.zones = Object.entries(data.zones).map(([key, z]): Zone => ({ key, ...z }));
  const byGlyph = new Map(m.zones.map((z, i) => [z.glyph, i + 1]));
  m.anchors = structuredClone(data.anchors);
  m.connections = structuredClone(data.connections);
  const cw = m.chunksWide;
  const ch = m.chunksHigh;
  for (const c of data.chunks) {
    const [x0] = chunkSpan(c.x, m.width, m.chunkSize);
    const [y0] = chunkSpan(c.y, m.height, m.chunkSize);
    c.corners.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const v = row.charCodeAt(i) - 48;
        const x = x0 + i;
        const y = y0 + j;
        m.alt.set(x, y, (v & CORNER_ALT) !== 0);
        m.path.set(x, y, (v & CORNER_PATH) !== 0);
        m.liquid.set(x, y, (v & CORNER_LIQUID) !== 0);
      }
    });
    c.tiles.forEach((row, j) => {
      for (let i = 0; i < row.length; i++)
        m.flags[(y0 + j) * m.width + x0 + i] = row.charCodeAt(i) - 48;
    });
    c.zones.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const g = row[i] ?? NO_ZONE;
        m.zoneIndex[(y0 + j) * m.width + x0 + i] = g === NO_ZONE ? 0 : (byGlyph.get(g) ?? 0);
      }
    });
    for (const [kind, tx, ty, variant, dx, dy] of c.props) {
      m.props.push({
        kind,
        tx,
        ty,
        ...(variant ? { variant } : {}),
        ...(dx ? { dx } : {}),
        ...(dy ? { dy } : {}),
      });
    }
  }
  // Keep props in chunk order regardless of how the file listed chunks.
  m.props.sort((a, b) => chunkOf(m, a.tx, a.ty, cw, ch) - chunkOf(m, b.tx, b.ty, cw, ch));
  m.refreshCollision();
  return m;
}

function chunkOf(m: WorldMap, tx: number, ty: number, cw: number, ch: number): number {
  const cx = Math.min(Math.floor(tx / m.chunkSize), cw - 1);
  const cy = Math.min(Math.floor(ty / m.chunkSize), ch - 1);
  return cy * cw + cx;
}

/** The shipped form of a map (plain JSON-safe data, chunks row by row). */
export function encodeRegion(m: WorldMap): RegionMapData {
  const zones: RegionMapData['zones'] = {};
  for (const { key, ...z } of m.zones) zones[key] = z;
  const glyphs = m.zones.map((z) => z.glyph);
  const chunks: ChunkData[] = [];
  const cw = m.chunksWide;
  const ch = m.chunksHigh;
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      const r = m.chunkRect(cx, cy);
      const cornerW = r.width + (cx === cw - 1 ? 1 : 0);
      const cornerH = r.height + (cy === ch - 1 ? 1 : 0);
      const corners: string[] = [];
      for (let j = 0; j < cornerH; j++) {
        let row = '';
        for (let i = 0; i < cornerW; i++) {
          const x = r.x + i;
          const y = r.y + j;
          const v =
            (m.alt.get(x, y) ? CORNER_ALT : 0) |
            (m.path.get(x, y) ? CORNER_PATH : 0) |
            (m.liquid.get(x, y) ? CORNER_LIQUID : 0);
          row += String.fromCharCode(48 + v);
        }
        corners.push(row);
      }
      const tiles: string[] = [];
      const zoneRows: string[] = [];
      for (let j = 0; j < r.height; j++) {
        let t = '';
        let z = '';
        for (let i = 0; i < r.width; i++) {
          const k = (r.y + j) * m.width + r.x + i;
          t += String.fromCharCode(48 + (m.flags[k] ?? 0));
          const zi = m.zoneIndex[k] ?? 0;
          z += zi ? (glyphs[zi - 1] ?? NO_ZONE) : NO_ZONE;
        }
        tiles.push(t);
        zoneRows.push(z);
      }
      const props = m.props
        .filter((p) => chunkOf(m, p.tx, p.ty, cw, ch) === cy * cw + cx)
        .map(
          (p) =>
            [
              p.kind,
              p.tx,
              p.ty,
              p.variant ?? 0,
              p.dx ?? 0,
              p.dy ?? 0,
            ] as ChunkData['props'][number],
        );
      chunks.push({ x: cx, y: cy, corners, tiles, zones: zoneRows, props });
    }
  }
  return {
    format: MAP_FORMAT,
    name: m.name,
    biome: m.biome,
    seed: m.seed,
    width: m.width,
    height: m.height,
    chunkSize: m.chunkSize,
    zones,
    anchors: structuredClone(m.anchors),
    connections: structuredClone(m.connections),
    chunks,
  };
}
