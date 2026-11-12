import type { z } from 'zod';

/** One problem found while loading packs. `path` points into the pack definition. */
export interface PackIssue {
  readonly pack: string;
  readonly path: string;
  readonly message: string;
}

/**
 * Thrown when one or more packs fail to load. The message lists every issue on its own
 * line, so modders see all problems at once:
 *
 * ```
 * Failed to load content packs (2 issues):
 *   - [mod-a] content.species.blazer.stats.hp: Invalid input: expected number, received string
 *   - [mod-a] dependsOn: Pack "lava" is not loaded
 * ```
 */
export class PackError extends Error {
  override readonly name = 'PackError';
  readonly issues: readonly PackIssue[];

  constructor(issues: readonly PackIssue[]) {
    super(formatIssues(issues));
    this.issues = issues;
  }
}

export function formatIssues(issues: readonly PackIssue[]): string {
  const n = issues.length;
  const lines = issues.map((i) => `  - [${i.pack}] ${i.path ? `${i.path}: ` : ''}${i.message}`);
  return `Failed to load content packs (${n} issue${n === 1 ? '' : 's'}):\n${lines.join('\n')}`;
}

/** Joins path segments as `a.b[2].c`. */
export function formatPath(segments: readonly PropertyKey[]): string {
  let out = '';
  for (const seg of segments) {
    if (typeof seg === 'number') out += `[${seg}]`;
    else out += out ? `.${String(seg)}` : String(seg);
  }
  return out;
}

/** Converts Zod issues to pack issues under a base path. */
export function zodIssues(
  pack: string,
  base: readonly PropertyKey[],
  error: z.ZodError,
): PackIssue[] {
  return error.issues.map((issue) => ({
    pack,
    path: formatPath([...base, ...issue.path]),
    message: issue.message,
  }));
}
