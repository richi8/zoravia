/**
 * Click-to-move pathfinding (C20): A* over the tile grid with 4-way steps. Ties prefer
 * going straight, so paths have few turns. Pure: no DOM.
 */

import { DIR_STEP, DIRS, type Tile } from './mover';

export interface PathOptions {
  /** Most tiles to expand before giving up (keeps a far click cheap). Default 4000. */
  readonly maxNodes?: number;
}

/** Path from `from` to `to` without `from`; `[]` when already there, `undefined` if none. */
export function findPath(
  from: Tile,
  to: Tile,
  blocked: (x: number, y: number) => boolean,
  options: PathOptions = {},
): Tile[] | undefined {
  if (from.x === to.x && from.y === to.y) return [];
  if (blocked(to.x, to.y)) return undefined;
  const maxNodes = options.maxNodes ?? 4000;
  const key = (x: number, y: number): string => `${x},${y}`;
  interface Node {
    readonly x: number;
    readonly y: number;
    readonly g: number;
    readonly f: number;
    readonly dir: number;
    readonly parent: Node | undefined;
  }
  const h = (x: number, y: number): number => Math.abs(x - to.x) + Math.abs(y - to.y);
  const open = new MinHeap<Node>((a, b) => a.f - b.f || b.g - a.g);
  const best = new Map<string, number>();
  open.push({ x: from.x, y: from.y, g: 0, f: h(from.x, from.y), dir: -1, parent: undefined });
  best.set(key(from.x, from.y), 0);
  let expanded = 0;
  while (open.size) {
    const n = open.pop();
    if (!n) break;
    if (n.x === to.x && n.y === to.y) {
      const out: Tile[] = [];
      for (let c: Node | undefined = n; c?.parent; c = c.parent) out.push({ x: c.x, y: c.y });
      return out.reverse();
    }
    if (n.g > (best.get(key(n.x, n.y)) ?? Infinity)) continue;
    if (++expanded > maxNodes) return undefined;
    for (let d = 0; d < DIRS.length; d++) {
      const [dx, dy] = DIR_STEP[DIRS[d] ?? 'up'];
      const x = n.x + dx;
      const y = n.y + dy;
      if (blocked(x, y)) continue;
      // A turn costs a hair more, so straight runs win ties.
      const g = n.g + 1 + (n.dir >= 0 && n.dir !== d ? 0.001 : 0);
      const k = key(x, y);
      if (g >= (best.get(k) ?? Infinity)) continue;
      best.set(k, g);
      open.push({ x, y, g, f: g + h(x, y), dir: d, parent: n });
    }
  }
  return undefined;
}

/**
 * Where a click on `target` should walk: the tile itself when walkable, else its walkable
 * neighbour with the shortest path (so clicking a sign or tree walks next to it).
 */
export function pathToward(
  from: Tile,
  target: Tile,
  blocked: (x: number, y: number) => boolean,
  options?: PathOptions,
): Tile[] | undefined {
  if (!blocked(target.x, target.y)) return findPath(from, target, blocked, options);
  let best: Tile[] | undefined;
  for (const d of DIRS) {
    const [dx, dy] = DIR_STEP[d];
    const n = { x: target.x + dx, y: target.y + dy };
    if (blocked(n.x, n.y)) continue;
    const p = findPath(from, n, blocked, options);
    if (p && (!best || p.length < best.length)) best = p;
  }
  return best;
}

class MinHeap<T> {
  private readonly items: T[] = [];
  constructor(private readonly less: (a: T, b: T) => number) {}

  get size(): number {
    return this.items.length;
  }

  push(v: T): void {
    const a = this.items;
    a.push(v);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.less(a[i] as T, a[p] as T) >= 0) break;
      [a[i], a[p]] = [a[p] as T, a[i] as T];
      i = p;
    }
  }

  pop(): T | undefined {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length && last !== undefined) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.less(a[l] as T, a[m] as T) < 0) m = l;
        if (r < a.length && this.less(a[r] as T, a[m] as T) < 0) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m] as T, a[i] as T];
        i = m;
      }
    }
    return top;
  }
}
