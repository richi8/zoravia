/**
 * World tool CLI. Run with `npm run world -- <command>`:
 *
 * - `gen <pack/region> [--force]`: generates the base from `region.json` into
 *   `generated.json`. Refuses to replace an existing base without `--force`: hand edits in
 *   the overlay are placed against it.
 * - `extend <pack/region> <id> [--force]`: generates extension `id` of `region.json` into
 *   `generated-<id>.json` (C36). Refuses to replace an existing strip without `--force`.
 * - `build [pack/region …]`: merges base + overlay into `map.json` (all regions by default).
 * - `check`: fails if any `map.json` is out of date (also covered by `npm run check`).
 * - `show <pack/region> [--zones] [--generated] [x y w h]`: prints a text view.
 */

import { existsSync, readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { decodeRegion, encodeRegion } from '@game/world/map';
import { ASCII_LEGEND, asciiMap } from './ascii';
import {
  buildRegion,
  file,
  readConfig,
  readBase,
  regionDir,
  regionDirs,
  ROOT,
  stringifyMap,
  writeMap,
} from './files';
import { generateExtension } from './extend';
import { generateRegion } from './generate';

const rel = (p: string): string => relative(ROOT, p);

export function main(argv: readonly string[]): number {
  const [cmd, ...rest] = argv;
  const flags = new Set(rest.filter((a) => a.startsWith('--')));
  const args = rest.filter((a) => !a.startsWith('--'));
  switch (cmd) {
    case 'gen': {
      const ref = args[0];
      if (!ref) return usage('gen needs a region, e.g. core/test-region');
      const r = regionDir(ref);
      const out = file(r, 'generated');
      if (existsSync(out) && !flags.has('--force')) {
        console.error(
          `${rel(out)} exists. The overlay is placed against it, so regenerating can break hand edits.\nUse --force to replace it.`,
        );
        return 1;
      }
      const map = generateRegion(readConfig(r));
      writeMap(out, encodeRegion(map));
      console.info(`Generated ${rel(out)} (${map.width}×${map.height}, ${map.props.length} props)`);
      return 0;
    }
    case 'extend': {
      const [ref, id] = args;
      if (!ref || !id) return usage('extend needs a region and an extension id');
      const r = regionDir(ref);
      const out = file(r, `generated-${id}`);
      if (existsSync(out) && !flags.has('--force')) {
        console.error(
          `${rel(out)} exists. The overlay is placed against it, so regenerating can break hand edits.\nUse --force to replace it.`,
        );
        return 1;
      }
      const strip = generateExtension(readConfig(r), id, readBase(r, id));
      writeMap(out, encodeRegion(strip));
      console.info(
        `Generated ${rel(out)} (${strip.width}×${strip.height}, ${strip.props.length} props)`,
      );
      return 0;
    }
    case 'build': {
      const list = args.length ? args.map(regionDir) : regionDirs();
      for (const r of list) {
        const out = file(r, 'map');
        writeMap(out, buildRegion(r));
        console.info(`Built ${rel(out)}`);
      }
      return 0;
    }
    case 'check': {
      const stale = regionDirs().filter((r) => {
        const out = file(r, 'map');
        return !existsSync(out) || readFileSync(out, 'utf8') !== stringifyMap(buildRegion(r));
      });
      for (const r of stale)
        console.error(`${r.ref}: map.json is out of date. Run: npm run world -- build`);
      if (!stale.length) console.info(`${regionDirs().length} region map(s) up to date`);
      return stale.length ? 1 : 0;
    }
    case 'show': {
      const ref = args[0];
      if (!ref) return usage('show needs a region');
      const r = regionDir(ref);
      const data = flags.has('--generated') ? encodeRegion(readBase(r)) : buildRegion(r);
      const nums = args.slice(1).map(Number);
      const [x = 0, y = 0, w = data.width, h = data.height] = nums;
      console.info(
        asciiMap(decodeRegion(data), {
          zones: flags.has('--zones'),
          rect: { x, y, width: w, height: h },
        }),
      );
      console.info(ASCII_LEGEND);
      return 0;
    }
    default:
      return usage(cmd ? `Unknown command "${cmd}"` : 'No command');
  }
}

function usage(problem: string): number {
  console.error(
    `${problem}\nUsage: npm run world -- gen <pack/region> [--force] | extend <pack/region> <id> [--force] | build [pack/region …] | check | show <pack/region> [--zones] [--generated] [x y w h]`,
  );
  return 1;
}
