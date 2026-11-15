/**
 * Region folders on disk: `packs/<pack>/maps/<region>/` holds
 * - `region.json`: generator input (hand-written, read once by `gen`),
 * - `generated.json`: the frozen generated base (tool output, never edited by hand),
 * - `generated-<id>.json`: each frozen extension strip (C36, `world extend`),
 * - `overlay.json`: hand edits (optional),
 * - `map.json`: base + overlay, the file the pack ships (tool output of `build`).
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { regionMapSchema, type RegionMapData } from '@game/data/maps';
import { decodeRegion, encodeRegion, type WorldMap } from '@game/world/map';
import { regionConfigSchema, type RegionConfig } from './config';
import { stitch } from './extend';
import { applyOverlay, type OverlayInput } from './overlay';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

export interface RegionDir {
  /** `core/test-region`. */
  readonly ref: string;
  readonly dir: string;
}

export const file = (
  r: RegionDir,
  name: 'region' | 'generated' | 'overlay' | 'map' | `generated-${string}`,
): string => join(r.dir, `${name}.json`);

/** Every region folder (one with a `region.json`) in every pack. */
export function regionDirs(): RegionDir[] {
  const out: RegionDir[] = [];
  const packs = join(ROOT, 'packs');
  for (const pack of readdirSync(packs).sort()) {
    const maps = join(packs, pack, 'maps');
    if (!existsSync(maps)) continue;
    for (const id of readdirSync(maps).sort()) {
      const dir = join(maps, id);
      if (existsSync(join(dir, 'region.json'))) out.push({ ref: `${pack}/${id}`, dir });
    }
  }
  return out;
}

export function regionDir(ref: string): RegionDir {
  const found = regionDirs().find((r) => r.ref === ref);
  if (!found) {
    const all = regionDirs().map((r) => r.ref);
    throw new Error(
      `No region "${ref}" (expected packs/<pack>/maps/<region>/region.json). Known: ${all.join(', ') || 'none'}`,
    );
  }
  return found;
}

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8')) as unknown;

export function readConfig(r: RegionDir): RegionConfig {
  return regionConfigSchema.parse(readJson(file(r, 'region')));
}

export function readGenerated(r: RegionDir): RegionMapData {
  const path = file(r, 'generated');
  if (!existsSync(path))
    throw new Error(`${r.ref}: no generated.json yet. Run: npm run world -- gen ${r.ref}`);
  return regionMapSchema.parse(readJson(path));
}

export function readOverlay(r: RegionDir): OverlayInput {
  const path = file(r, 'overlay');
  return existsSync(path) ? (readJson(path) as OverlayInput) : {};
}

/** A frozen extension strip, or undefined before `world extend` made it. */
export function readExtension(r: RegionDir, id: string): RegionMapData | undefined {
  const path = file(r, `generated-${id}`);
  return existsSync(path) ? regionMapSchema.parse(readJson(path)) : undefined;
}

/**
 * The generated base with every frozen extension glued on, in `region.json` order. With
 * `upTo`, stops before that extension (what `world extend` generates it against).
 */
export function readBase(r: RegionDir, upTo?: string): WorldMap {
  const cfg = readConfig(r);
  let map = decodeRegion(readGenerated(r));
  for (const [id, ext] of Object.entries(cfg.extensions)) {
    if (id === upTo) break;
    const strip = readExtension(r, id);
    if (!strip)
      throw new Error(
        `${r.ref}: no generated-${id}.json yet. Run: npm run world -- extend ${r.ref} ${id}`,
      );
    map = stitch(map, decodeRegion(strip), ext.side);
  }
  return map;
}

/** Base + extensions + overlay → the shipped map data. */
export function buildRegion(r: RegionDir): RegionMapData {
  return regionMapSchema.parse(encodeRegion(applyOverlay(readBase(r), readOverlay(r))));
}

/**
 * JSON with short arrays on one line (levels, prop rows) and long ones (chunk rows) one item
 * per line, so map diffs show changed rows.
 */
export function stringifyMap(data: unknown): string {
  const text = JSON.stringify(data, null, 2).replace(
    /\[\s+([^[\]{}]*?)\s+\]/g,
    (all, inner: string) => {
      const one = `[${inner.replace(/\s*\n\s*/g, ' ')}]`;
      return one.length <= 80 ? one : all;
    },
  );
  return `${text}\n`;
}

export function writeMap(path: string, data: unknown): void {
  writeFileSync(path, stringifyMap(data));
}
