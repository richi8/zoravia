/**
 * `npm run balance [-- --region verdale|emberwaste|rimeholm] [--seeds N] [--out file.md]`: the C31
 * balance report for a region (default Verdale). Prints Markdown, or writes it to `--out`.
 */

import { writeFileSync } from 'node:fs';
import { loadGameContent } from '@game/data';
import { loadRegion } from '@game/world/map';
import { SHIPPED_PACKS } from '@packs/index';
import { REGIONS } from './regions';
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
  const key = opt('region') ?? 'verdale';
  const region = REGIONS[key];
  if (!region) {
    console.error(`--region must be one of: ${Object.keys(REGIONS).join(', ')}`);
    return 1;
  }
  const content = loadGameContent([...SHIPPED_PACKS]);
  const zones = loadRegion(content, region.map).zones;
  const report = balanceReport(content, zones, { seeds, region });
  const out = opt('out');
  if (out) writeFileSync(out, report);
  else process.stdout.write(report);
  return 0;
}
