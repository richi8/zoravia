/**
 * `npm run balance [-- --seeds N] [--out file.md]`: the C31 balance report for Verdale.
 * Prints Markdown, or writes it to `--out`.
 */

import { writeFileSync } from 'node:fs';
import { loadGameContent } from '@game/data';
import { loadRegion } from '@game/world/map';
import { corePack } from '@packs/core';
import { balanceReport } from './report';

export function main(args: readonly string[]): number {
  const opt = (name: string): string | undefined => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const seeds = Number(opt('seeds') ?? 10);
  if (!Number.isInteger(seeds) || seeds < 1) {
    console.error('--seeds must be a positive whole number');
    return 1;
  }
  const content = loadGameContent([corePack]);
  const zones = loadRegion(content, 'core:verdale').zones;
  const report = balanceReport(content, zones, { seeds });
  const out = opt('out');
  if (out) writeFileSync(out, report);
  else process.stdout.write(report);
  return 0;
}
