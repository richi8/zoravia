/**
 * Minimal semver for pack versions and dependency ranges.
 * Versions: `MAJOR.MINOR.PATCH`. Ranges: `*`, exact `1.2.3`, `>=1.2.3`, caret `^1.2.3`.
 */

export const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export const RANGE_PATTERN = /^(\*|(\^|>=)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*))$/;

type Triple = [number, number, number];

export function parseVersion(version: string): Triple {
  const m = VERSION_PATTERN.exec(version);
  if (!m) throw new Error(`Invalid version "${version}" (expected MAJOR.MINOR.PATCH)`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function compareVersions(a: string, b: string): number {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    const d = (va[i] ?? 0) - (vb[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  return 0;
}

export function satisfies(version: string, range: string): boolean {
  if (!RANGE_PATTERN.test(range)) throw new Error(`Invalid version range "${range}"`);
  if (range === '*') return true;
  if (range.startsWith('>=')) return compareVersions(version, range.slice(2)) >= 0;
  if (range.startsWith('^')) {
    const base = range.slice(1);
    if (compareVersions(version, base) < 0) return false;
    const [vMaj, vMin] = parseVersion(version);
    const [bMaj, bMin] = parseVersion(base);
    // ^0.x.y only allows the same minor (semver convention for 0.x).
    return bMaj === 0 ? vMaj === 0 && vMin === bMin : vMaj === bMaj;
  }
  return compareVersions(version, range) === 0;
}
