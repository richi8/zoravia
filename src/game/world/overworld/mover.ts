/**
 * Tweened grid movement (C20): the player stands on whole tiles and walks one tile at a time
 * at the single speed from DESIGN.md (3.75 tiles/s = one tile per 16 frames at 60 fps).
 *
 * - Holding a direction keeps walking without a pause between tiles (leftover progress
 *   carries into the next step).
 * - Standing still, a short tap toward a new direction only turns; holding it walks after
 *   `TURN_DELAY`. Walking into a blocked tile turns and "bumps" in place.
 * - Directions come from an `intent` callback asked at each decision point (standing, or
 *   arriving on a tile), so keyboard and click-to-move paths share one code path.
 *
 * Pure and deterministic: no DOM, no rendering.
 */

export type Dir = 'up' | 'down' | 'left' | 'right';

export const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'];

export const DIR_STEP: Readonly<Record<Dir, readonly [number, number]>> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/** Tiles per second (DESIGN.md → Controls). */
export const WALK_SPEED = 3.75;
/** Seconds a direction must be held from standing (facing elsewhere) before walking. */
export const TURN_DELAY = 0.1;

export interface Tile {
  readonly x: number;
  readonly y: number;
}

/** What to do at a decision point: walk/turn toward `dir`, or stand (`undefined`). */
export interface Intent {
  readonly dir: Dir;
  /** Walk at once even when turning (click-to-move); keyboard turns first. */
  readonly noTurnDelay?: boolean;
}

export type IntentFn = (at: Tile) => Intent | undefined;

export type MoveEvent =
  | { readonly kind: 'step'; readonly from: Tile; readonly to: Tile }
  | { readonly kind: 'arrive'; readonly at: Tile }
  | { readonly kind: 'bump'; readonly dir: Dir };

export function dirBetween(a: Tile, b: Tile): Dir | undefined {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return undefined;
  return dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up';
}

export class GridMover {
  /** Tile the mover stands on, or walks from. */
  tx: number;
  ty: number;
  facing: Dir;
  /** Tiles walked in total (fractional) — drives the walk cycle. */
  walked = 0;
  private target: Tile | undefined;
  private progress = 0;
  private turnTimer = 0;
  private bumpDir: Dir | undefined;

  constructor(
    start: Tile,
    facing: Dir = 'down',
    readonly speed = WALK_SPEED,
  ) {
    this.tx = start.x;
    this.ty = start.y;
    this.facing = facing;
  }

  get moving(): boolean {
    return this.target !== undefined;
  }

  /** Walking into a wall (held toward a blocked tile). */
  get bumping(): boolean {
    return this.bumpDir !== undefined;
  }

  /** The tile the mover will stand on next: its target while walking. */
  get destination(): Tile {
    return this.target ?? { x: this.tx, y: this.ty };
  }

  /** Current position in tiles (fractional while walking). */
  get x(): number {
    return this.target ? this.tx + (this.target.x - this.tx) * this.progress : this.tx;
  }

  get y(): number {
    return this.target ? this.ty + (this.target.y - this.ty) * this.progress : this.ty;
  }

  /** Places the mover on a tile, standing (teleport, map entry). */
  place(at: Tile, facing = this.facing): void {
    this.tx = at.x;
    this.ty = at.y;
    this.facing = facing;
    this.target = undefined;
    this.progress = 0;
    this.turnTimer = 0;
    this.bumpDir = undefined;
  }

  update(dt: number, intent: IntentFn, blocked: (x: number, y: number) => boolean): MoveEvent[] {
    const events: MoveEvent[] = [];
    if (this.target) {
      this.progress += this.speed * dt;
      this.walked += this.speed * dt;
      if (this.progress < 1 - 1e-9) return events;
      const left = Math.max(0, this.progress - 1);
      this.walked -= left;
      this.tx = this.target.x;
      this.ty = this.target.y;
      this.target = undefined;
      this.progress = 0;
      const at = { x: this.tx, y: this.ty };
      events.push({ kind: 'arrive', at });
      // Keep walking without a stop when a direction is still wanted.
      const next = intent(at);
      if (next) {
        this.facing = next.dir;
        if (this.tryStep(next.dir, blocked, events)) {
          this.progress = left;
          this.walked += left;
        } else this.bump(next.dir, events);
      }
      return events;
    }

    const want = intent({ x: this.tx, y: this.ty });
    if (!want) {
      this.turnTimer = 0;
      this.bumpDir = undefined;
      return events;
    }
    if (want.dir !== this.facing && !want.noTurnDelay && this.bumpDir === undefined) {
      // Turn in place first; walk only if the key stays held.
      this.facing = want.dir;
      this.turnTimer = TURN_DELAY;
      return events;
    }
    this.facing = want.dir;
    if (this.turnTimer > 0) {
      this.turnTimer -= dt;
      if (this.turnTimer > 1e-9) return events;
      this.turnTimer = 0;
    }
    if (this.tryStep(want.dir, blocked, events)) {
      // The step starts this frame, so a tile takes exactly 1/speed seconds from the press.
      this.progress = Math.min(this.speed * dt, 1 - 1e-6);
      this.walked += this.progress;
    } else this.bump(want.dir, events);
    return events;
  }

  private tryStep(
    dir: Dir,
    blocked: (x: number, y: number) => boolean,
    events: MoveEvent[],
  ): boolean {
    const [dx, dy] = DIR_STEP[dir];
    const to = { x: this.tx + dx, y: this.ty + dy };
    if (blocked(to.x, to.y)) return false;
    this.bumpDir = undefined;
    this.target = to;
    this.progress = 0;
    events.push({ kind: 'step', from: { x: this.tx, y: this.ty }, to });
    return true;
  }

  private bump(dir: Dir, events: MoveEvent[]): void {
    if (this.bumpDir !== dir) events.push({ kind: 'bump', dir });
    this.bumpDir = dir;
  }
}
