/**
 * Overworld actors besides the player (C21): NPCs and roaming wild Zorlings. Each one walks
 * the tile grid with a `GridMover` and decides where to go from its own seeded `Rng`, so a
 * session plays out the same for the same seed. Pure: no DOM, no rendering.
 */

import type { Rng } from '@engine/core/rng';
import type { Npc, NpcBehavior } from '@game/data/npcs';
import { DIR_STEP, DIRS, GridMover, type Dir, type Intent, type Tile } from './mover';

export type Blocked = (x: number, y: number) => boolean;

const manhattan = (a: Tile, b: Tile): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Direction that brings `from` closer to `to`, larger axis first; the other axis second. */
export function dirsToward(from: Tile, to: Tile): Dir[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const h: Dir | undefined = dx > 0 ? 'right' : dx < 0 ? 'left' : undefined;
  const v: Dir | undefined = dy > 0 ? 'down' : dy < 0 ? 'up' : undefined;
  const first = Math.abs(dx) >= Math.abs(dy) ? [h, v] : [v, h];
  return first.filter((d): d is Dir => d !== undefined);
}

const OPPOSITE: Readonly<Record<Dir, Dir>> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

const stepFrom = (t: Tile, d: Dir): Tile => ({
  x: t.x + DIR_STEP[d][0],
  y: t.y + DIR_STEP[d][1],
});

// ------------------------------------------------------------------ NPCs

/** NPC walking speed (tiles/s): a stroll, slower than the player. */
export const NPC_SPEED = 2.2;

export class NpcActor {
  readonly mover: GridMover;
  readonly home: Tile;
  /** The facing it starts with (it turns back to it after walking home, C36d). */
  readonly homeFacing: Dir;
  /** Talking: stands still, facing the player. */
  talking = false;
  /** A scripted walk (C36d): it steps toward this tile, ignoring its behavior, until there. */
  goal: Tile | undefined;
  private faceAfter: Dir | undefined;
  private timer: number;

  constructor(
    readonly npc: Npc,
    at: Tile,
    facing: Dir,
    private readonly rng: Rng,
  ) {
    this.home = at;
    this.homeFacing = facing;
    this.mover = new GridMover(at, facing, NPC_SPEED);
    this.timer = this.nextWait();
  }

  get behavior(): NpcBehavior {
    return this.npc.behavior;
  }

  /** Turns to face a tile next to it (the player talking to it). */
  faceToward(t: Tile): void {
    const d = dirsToward(this.mover.destination, t)[0];
    if (d) this.mover.facing = d;
  }

  /** Walks straight to a tile (a trainer walking up to the player, or back to its spot). */
  walkTo(goal: Tile, speed = NPC_SPEED, faceAfter?: Dir): void {
    this.goal = goal;
    this.faceAfter = faceAfter;
    this.mover.speed = speed;
  }

  /** Walks back to its spot and turns the way it started. */
  goHome(): void {
    this.walkTo(this.home, NPC_SPEED, this.homeFacing);
  }

  /** On a scripted walk that has not arrived. */
  get walking(): boolean {
    return this.goal !== undefined;
  }

  update(dt: number, blocked: Blocked): void {
    if (this.goal) {
      this.walk(dt, blocked);
      return;
    }
    let want: Dir | undefined;
    if (!this.talking && !this.mover.moving) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = this.nextWait();
        want = this.decide(blocked);
      }
    }
    const intent = (): Intent | undefined => (want ? { dir: want, noTurnDelay: true } : undefined);
    this.mover.update(dt, intent, blocked);
    want = undefined;
  }

  private walk(dt: number, blocked: Blocked): void {
    const goal = this.goal as Tile;
    const intent = (at: Tile): Intent | undefined => {
      if (at.x === goal.x && at.y === goal.y) return undefined;
      const d = dirsToward(at, goal).find((d) => {
        const to = stepFrom(at, d);
        return !blocked(to.x, to.y);
      });
      return d ? { dir: d, noTurnDelay: true } : undefined;
    };
    this.mover.update(dt, intent, blocked);
    const at = this.mover.destination;
    if (!this.mover.moving && at.x === goal.x && at.y === goal.y) {
      this.goal = undefined;
      this.mover.speed = NPC_SPEED;
      if (this.faceAfter) this.mover.facing = this.faceAfter;
      this.faceAfter = undefined;
    }
  }

  private decide(blocked: Blocked): Dir | undefined {
    const b = this.behavior;
    if (b.kind === 'stand') return undefined;
    const others = DIRS.filter((d) => d !== this.mover.facing);
    const dir = this.rng.pick(others);
    if (b.kind === 'look') {
      this.mover.facing = dir;
      return undefined;
    }
    const to = stepFrom({ x: this.mover.tx, y: this.mover.ty }, dir);
    const inRange =
      Math.abs(to.x - this.home.x) <= b.radius && Math.abs(to.y - this.home.y) <= b.radius;
    // A third of the time it just looks around.
    if (!inRange || blocked(to.x, to.y) || this.rng.chance(0.33)) {
      this.mover.facing = dir;
      return undefined;
    }
    return dir;
  }

  private nextWait(): number {
    const b = this.behavior;
    if (b.kind === 'stand') return Infinity;
    return this.rng.float(b.every[0], b.every[1]);
  }
}

// ------------------------------------------------------------------ roaming wild Zorlings

/** How a roaming Zorling reacts to the player (picked at spawn). */
export type Temperament = 'calm' | 'curious' | 'shy';

/** Starting values, tuned in C31. */
export const ROAM = {
  /** Tiles/s: wandering, chasing the player, running away (the player walks 3.75). */
  wanderSpeed: 2,
  chaseSpeed: 3,
  fleeSpeed: 3.2,
  /** Manhattan distance at which curious ones notice and shy ones flee. */
  noticeRange: 4,
  fleeRange: 3,
  /** A chase stops beyond this distance. */
  giveUpRange: 8,
  /** Seconds the "!" shows; the chase starts after `alertPause`. */
  alert: 0.8,
  alertPause: 0.35,
  /** Seconds before a Zorling that lost track of the player may notice it again. */
  renotice: 3,
  /** How far (tiles, each axis) a Zorling wanders from where it spawned. */
  homeRadius: 5,
  temperaments: { calm: 0.35, curious: 0.4, shy: 0.25 } as Readonly<Record<Temperament, number>>,
} as const;

export type RoamState = 'idle' | 'walk' | 'chase' | 'flee';

export class Roamer {
  readonly mover: GridMover;
  readonly home: Tile;
  state: RoamState = 'idle';
  /** Seconds left showing the "!" bubble. */
  alert = 0;
  /** Seconds left in which touching it does not start a battle (after running away). */
  cooldown = 0;
  /** Facing of the side-view sprite: the last horizontal direction. */
  side: 'left' | 'right';
  private timer: number;
  private steps = 0;
  private dir: Dir = 'down';
  private renotice = 0;

  constructor(
    readonly id: number,
    readonly species: string,
    readonly level: number,
    readonly zone: string,
    at: Tile,
    readonly temperament: Temperament,
    private readonly rng: Rng,
  ) {
    this.home = at;
    this.mover = new GridMover(at, rng.pick(DIRS), ROAM.wanderSpeed);
    this.side = rng.chance(0.5) ? 'left' : 'right';
    this.timer = rng.float(0.5, 2.5);
  }

  /** Did not get a battle (the player ran): stays calm and keeps away for a while. */
  spook(seconds: number): void {
    this.cooldown = seconds;
    this.alert = 0;
    this.state = 'flee';
  }

  /**
   * One frame. `blocked` is the map plus every other actor; `player` is the tile the player
   * stands on (or walks to). Returns true when it walked into the player while chasing.
   */
  update(dt: number, player: Tile, blocked: Blocked): boolean {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.renotice = Math.max(0, this.renotice - dt);
    this.alert = Math.max(0, this.alert - dt);
    const here = this.mover.destination;
    const dist = manhattan(here, player);

    // React to the player.
    if (this.cooldown <= 0 && this.state !== 'chase') {
      if (this.temperament === 'curious' && dist <= ROAM.noticeRange && this.renotice <= 0) {
        this.state = 'chase';
        this.alert = ROAM.alert;
      }
    }
    if (this.temperament === 'shy' && dist <= ROAM.fleeRange && this.state !== 'flee') {
      this.state = 'flee';
    }
    if (this.state === 'chase' && (dist > ROAM.giveUpRange || this.cooldown > 0)) {
      this.state = 'idle';
      this.renotice = ROAM.renotice;
      this.timer = this.rng.float(0.5, 1.5);
    }
    if (this.state === 'flee' && dist > ROAM.noticeRange + 2) {
      this.state = 'idle';
      this.timer = this.rng.float(0.5, 1.5);
    }

    if (this.state === 'idle' && !this.mover.moving) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'walk';
        this.dir = this.rng.pick(DIRS);
        this.steps = this.rng.int(1, 3);
      }
    }

    this.mover.speed =
      this.state === 'chase'
        ? ROAM.chaseSpeed
        : this.state === 'flee'
          ? ROAM.fleeSpeed
          : ROAM.wanderSpeed;

    let touched = false;
    const intent = (at: Tile): Intent | undefined => {
      switch (this.state) {
        case 'chase': {
          if (this.alert > ROAM.alert - ROAM.alertPause) return undefined;
          for (const d of dirsToward(at, player)) {
            const to = stepFrom(at, d);
            if (to.x === player.x && to.y === player.y) {
              this.mover.facing = d;
              touched = this.cooldown <= 0;
              return undefined;
            }
            if (!blocked(to.x, to.y)) return { dir: d, noTurnDelay: true };
          }
          return undefined;
        }
        case 'flee': {
          const away = dirsToward(player, at);
          const options = away.length ? [...away, ...DIRS.filter((d) => !away.includes(d))] : DIRS;
          for (const d of options) {
            if (away.length && d === OPPOSITE[away[0] as Dir]) continue;
            const to = stepFrom(at, d);
            if (!blocked(to.x, to.y)) return { dir: d, noTurnDelay: true };
          }
          return undefined;
        }
        case 'walk': {
          if (this.steps <= 0) {
            this.state = 'idle';
            this.timer = this.rng.float(1, 3.5);
            return undefined;
          }
          const to = stepFrom(at, this.dir);
          if (blocked(to.x, to.y)) {
            this.state = 'idle';
            this.timer = this.rng.float(0.5, 2);
            return undefined;
          }
          this.steps--;
          return { dir: this.dir, noTurnDelay: true };
        }
        default:
          return undefined;
      }
    };
    this.mover.update(dt, intent, blocked);
    const f = this.mover.facing;
    if (f === 'left' || f === 'right') this.side = f;
    return touched;
  }
}
