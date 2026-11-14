/**
 * The regions the balance report knows (C34): each one's map, campaign route, team plans,
 * start, first zone and the reaction teams of its roster test's boss sims.
 */

import { EMBERWASTE_ROUTE, EMBERWASTE_START, EMBERWASTE_TEAMS } from './emberwaste';
import type { PlaythroughSetup, RouteStage } from './playthrough';
import { VERDALE_ROUTE, VERDALE_START, VERDALE_TEAMS } from './verdale';

export interface BossCase {
  /** Full boss id. */
  readonly boss: string;
  /** `[species, moves]` (full ids): a team built for the boss's Armor-breaking reaction. */
  readonly team: readonly (readonly [string, readonly string[]])[];
  /** Battle weather of the lair (an ash storm). */
  readonly weather?: readonly string[];
}

export interface BalanceRegion {
  readonly name: string;
  readonly map: string;
  readonly route: readonly RouteStage[];
  readonly teams: readonly Pick<PlaythroughSetup, 'starter' | 'catches' | 'flags'>[];
  readonly start: {
    readonly starterLevel: number;
    readonly bag: Readonly<Record<string, number>>;
    readonly money: number;
  };
  /** The zone around the start town where a new starter fights first. */
  readonly firstZone: string;
  readonly bosses: readonly BossCase[];
}

const core = (ids: readonly string[]): string[] => ids.map((m) => `core:${m}`);
const ew = (s: string): string => `emberwaste:${s}`;

export const REGIONS: Readonly<Record<string, BalanceRegion>> = {
  verdale: {
    name: 'Verdale',
    map: 'core:verdale',
    route: VERDALE_ROUTE,
    teams: VERDALE_TEAMS,
    start: VERDALE_START,
    firstZone: 'meadow',
    // The reaction teams of the C29 roster test (`verdale-roster.test.ts`).
    bosses: [
      {
        boss: 'core:bogmaw-titan',
        team: [
          ['core:brooklet', core(['splash-shot', 'drench', 'tide-crash'])],
          ['core:voltbat', core(['static-bite', 'volt-lash', 'wing-cut'])],
          ['core:galehawk', core(['gust', 'wing-cut', 'gale-dash'])],
        ],
      },
      {
        boss: 'core:mossback-titan',
        team: [
          ['core:fernwick', core(['spore-cloud', 'thorn-volley', 'rock-slam'])],
          ['core:blazekit', core(['ember', 'flame-pounce', 'kindle'])],
          ['core:galehawk', core(['gust', 'wing-cut', 'gale-dash'])],
        ],
      },
      {
        boss: 'core:verdion',
        team: [
          ['core:voltbat', core(['static-field', 'volt-lash', 'frost-fang'])],
          ['core:ironshell', core(['iron-bash', 'steel-claw', 'mud-toss'])],
          ['core:rimewisp', core(['cold-snap', 'frost-fang', 'hail-dash'])],
        ],
      },
    ],
  },
  emberwaste: {
    name: 'Emberwaste',
    map: 'emberwaste:emberwaste',
    route: EMBERWASTE_ROUTE,
    teams: EMBERWASTE_TEAMS,
    start: EMBERWASTE_START,
    firstZone: 'flats',
    // The reaction teams of the C34 roster test (`packs/emberwaste/roster.test.ts`).
    bosses: [
      {
        boss: ew('dunewyrm-titan'),
        team: [
          [ew('oasip'), core(['splash-shot', 'drench', 'static-bite'])],
          [ew('pyrebeetle'), core(['kindle', 'ember', 'wing-cut'])],
          [ew('cactorn'), core(['vine-snap', 'thorn-volley', 'splash-shot'])],
        ],
        weather: ['core:burning'],
      },
      {
        boss: ew('forgeback-titan'),
        team: [
          [ew('ironjaw'), core(['corrode', 'iron-bash', 'steel-claw'])],
          [ew('brambleroll'), core(['gust', 'gale-dash', 'thorn-volley'])],
          [ew('cragbuck'), core(['mud-toss', 'rock-slam', 'flame-pounce'])],
        ],
      },
      {
        boss: ew('calderon'),
        team: [
          [ew('mirageel'), core(['drench', 'tide-crash', 'volt-lash'])],
          [ew('shimmerfox'), core(['frost-fang', 'hail-dash', 'blizzard'])],
          [ew('dunemaul'), core(['rock-slam', 'quake', 'steel-claw'])],
        ],
        weather: ['core:burning'],
      },
    ],
  },
};
