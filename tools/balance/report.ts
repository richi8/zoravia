/**
 * Balance report (C31): runs the playthrough simulator over many seeds and team plans, plus
 * boss and early-game battle sims, and writes the results as Markdown tables.
 */

import {
  aiChoice,
  aiReplacement,
  createBattle,
  needsReplacement,
  OPPONENT,
  PLAYER,
  simulateBoss,
  step,
  type BattleSetup,
  type SimPolicy,
} from '@game/battle/logic';
import type { GameContent } from '@game/data';
import { newParty } from '@game/player';
import { createZorling } from '@game/progression';
import { trainerBattle } from '@game/story';
import type { Zone } from '@game/world/map';
import { openSpawns } from '@game/world/overworld/sim';
import { playthrough, type PlaythroughResult, type PlaythroughSetup } from './playthrough';
import { REGIONS, type BalanceRegion } from './regions';

export interface ReportOptions {
  readonly seeds: number;
  /** The region (`REGIONS` key). Default: Verdale. */
  readonly region?: BalanceRegion;
}

const VERDALE = REGIONS['verdale'] as BalanceRegion;

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] ?? 0) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
};
const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const pct = (x: number): string => `${Math.round(x * 100)}%`;
const f1 = (x: number): string => x.toFixed(1);
const f0 = (x: number): string => x.toFixed(0);
const local = (id: string): string => id.replace(/^[a-z0-9_-]+:/, '');

function table(head: readonly string[], rows: readonly (readonly string[])[]): string {
  const line = (cells: readonly string[]): string => `| ${cells.join(' | ')} |`;
  return [line(head), line(head.map(() => '---')), ...rows.map(line)].join('\n');
}

export interface Runs {
  readonly region: BalanceRegion;
  readonly byTeam: readonly { readonly starter: string; readonly runs: PlaythroughResult[] }[];
}

export function runPlaythroughs(
  content: GameContent,
  zones: readonly Zone[],
  seeds: number,
  region: BalanceRegion = VERDALE,
): Runs {
  return {
    region,
    byTeam: region.teams.map((team) => ({
      starter: team.starter,
      runs: Array.from({ length: seeds }, (_, i) =>
        playthrough(content, {
          route: region.route,
          zones,
          ...region.start,
          ...team,
          seed: i + 1,
        } satisfies PlaythroughSetup),
      ),
    })),
  };
}

/** Summary per team plan. */
export function summaryTable(runs: Runs): string {
  return table(
    ['Team plan', 'Finished', 'Wild battles', 'Wild losses', 'Story losses', 'Hours (est.)'],
    runs.byTeam.map(({ starter, runs: rs }) => [
      local(starter),
      pct(mean(rs.map((r) => (r.finished ? 1 : 0)))),
      f0(median(rs.map((r) => r.wildBattles))),
      f1(mean(rs.map((r) => r.wildLosses))),
      f1(mean(rs.map((r) => r.goals.reduce((s, g) => s + g.attempts - 1, 0)))),
      f1(median(rs.map((r) => r.minutes)) / 60),
    ]),
  );
}

/** Each story fight across all runs. */
export function goalTable(runs: Runs): string {
  const all = runs.byTeam.flatMap((t) => t.runs);
  const ids = [...new Set(all.flatMap((r) => r.goals.map((g) => g.id)))];
  const rows = ids.map((id) => {
    const gs = all.flatMap((r) => r.goals.filter((g) => g.id === id));
    const first = gs[0];
    const lvl = gs.map((g) => mean(g.teamLevels));
    return [
      local(id),
      first?.stage ?? '',
      String(first?.foeLevel ?? ''),
      f1(median(lvl)),
      f0(median(gs.map((g) => g.wildBattles))),
      pct(mean(gs.map((g) => (g.attempts === 1 ? 1 : 0)))),
      f1(mean(gs.map((g) => g.attempts))),
      f1(mean(gs.map((g) => g.potionsUsed))),
      gs.some((g) => g.adapted) ? pct(mean(gs.map((g) => (g.adapted ? 1 : 0)))) : '',
      f0(median(gs.map((g) => g.money))),
      f0(median(gs.map((g) => g.minutes))),
    ];
  });
  return table(
    [
      'Fight',
      'Stage',
      'Foe Lv',
      'Team Lv',
      'Wild before',
      'Won 1st try',
      'Tries',
      'Potions used',
      'Hint followed',
      'Money after',
      'Minutes',
    ],
    rows,
  );
}

/** Wild battles and minutes per stage. */
export function stageTable(runs: Runs): string {
  const all = runs.byTeam.flatMap((t) => t.runs);
  const stages = runs.region.route.map((s) => s.name);
  return table(
    ['Stage', 'Wild battles', 'Wild losses', 'Minutes', 'Prize money', 'Potions bought'],
    stages.map((name) => {
      const per = all.map((r) => r.goals.filter((g) => g.stage === name));
      return [
        name,
        f0(median(per.map((gs) => gs.reduce((s, g) => s + g.wildBattles, 0)))),
        f1(mean(per.map((gs) => gs.reduce((s, g) => s + g.wildLosses, 0)))),
        f0(median(per.map((gs) => gs.reduce((s, g) => s + g.minutes, 0)))),
        f0(median(per.map((gs) => gs.reduce((s, g) => s + g.prize, 0)))),
        f1(mean(per.map((gs) => gs.reduce((s, g) => s + g.potionsBought, 0)))),
      ];
    }),
  );
}

/** Money: where it came from over a whole run. */
export function moneyTable(runs: Runs): string {
  const all = runs.byTeam.flatMap((t) => t.runs);
  return table(
    ['Wild prizes', 'Story prizes', 'Spent (potions, Zorbs)', 'Left at the end'],
    [
      [
        f0(median(all.map((r) => r.wildMoney))),
        f0(median(all.map((r) => r.prizeMoney))),
        f0(median(all.map((r) => r.goals.reduce((s, g) => s + g.moneySpent, 0)))),
        f0(median(all.map((r) => r.party.money))),
      ],
    ],
  );
}

// ------------------------------------------------------------------ bosses

const POLICIES: readonly { readonly name: string; readonly policy: SimPolicy; bag?: string }[] = [
  { name: 'reactions', policy: { style: 'reactions' } },
  { name: 'brute', policy: { style: 'brute' } },
  {
    name: 'brute + 5 Super',
    policy: { style: 'brute', potion: 'core:super-potion' },
    bag: 'core:super-potion',
  },
];

/** Boss win rates by level gap and play style. */
export function bossTable(
  content: GameContent,
  seeds: number,
  region: BalanceRegion = VERDALE,
): string {
  const rows: string[][] = [];
  for (const { boss, team, weather } of region.bosses) {
    const name = local(boss);
    const level = content.bosses.require(boss).level;
    for (const gap of [0, 2, 4]) {
      const cells = POLICIES.map(({ policy, bag }) => {
        let wins = 0;
        for (let s = 1; s <= seeds; s++) {
          const r = simulateBoss(content, {
            boss,
            team: team.map(([sp, moves], i) => ({
              ...createZorling(content, {
                uid: `b${i}`,
                species: sp,
                level: level + gap,
              }),
              moves: [...moves],
            })),
            bag: { 'core:zorb': 1, ...(bag ? { [bag]: 5 } : {}) },
            policy,
            seed: s,
            ...(weather ? { weather } : {}),
          });
          if (r.outcome === 'caught' || r.outcome === 'win') wins++;
        }
        return pct(wins / seeds);
      });
      rows.push([
        `${name} Lv ${level}`,
        team.map(([sp]) => local(sp)).join(', '),
        `+${gap}`,
        ...cells,
      ]);
    }
  }
  return table(['Boss', 'Team', 'Gap', ...POLICIES.map((p) => p.name)], rows);
}

// ------------------------------------------------------------------ trainers

/** The species a line has reached at a level (always evolving when it can). */
function formAt(content: GameContent, species: string, level: number): string {
  for (let sp = species; ;) {
    const evo = content.species.require(sp).evolution;
    if (!evo || level < evo.level) return sp;
    sp = evo.into;
  }
}

/** Plays a battle to the end, trainer AI on both sides, no items. True on a win. */
function aiBattle(content: GameContent, setup: BattleSetup): boolean {
  let state = createBattle(content, setup).state;
  for (let g = 0; state.phase !== 'ended' && g < 400; g++) {
    if (state.phase === 'replace') {
      const side = needsReplacement(state, OPPONENT) ? OPPONENT : PLAYER;
      const to = aiReplacement(content, state, side);
      state = step(content, state, { kind: 'replace', side, to }).state;
      continue;
    }
    const style = state.kind === 'wild' ? 'wild' : 'trainer';
    state = step(content, state, {
      kind: 'turn',
      player: aiChoice(content, state, PLAYER, 'trainer'),
      opponent: aiChoice(content, state, OPPONENT, style),
    }).state;
  }
  return state.outcome === 'win';
}

/**
 * Every story trainer against each team plan at a uniform level (its line evolved, default
 * moves, no potions), one level below, at and two above the trainer's top level.
 */
export function trainerTable(
  content: GameContent,
  seeds: number,
  region: BalanceRegion = VERDALE,
): string {
  const goals = region.route
    .flatMap((s) => s.goals)
    .filter(
      (g): g is { trainer: string; badge?: string; weather?: readonly string[] } => 'trainer' in g,
    );
  const gaps = [-1, 0, 2];
  const rows: string[][] = [];
  let badges: string[] = [];
  for (const goal of goals) {
    const probe = { ...newParty({ team: [] }), badges };
    const top = Math.max(
      ...trainerBattle(content, probe, goal.trainer, 1).setup.opponent.map((z) => z.level),
    );
    const cells = region.teams.map((plan) =>
      gaps
        .map((gap) => {
          const level = top + gap;
          let wins = 0;
          for (let s = 1; s <= seeds; s++) {
            const team = [plan.starter, ...plan.catches].map((sp, i) =>
              createZorling(content, { uid: `t${i}`, species: formAt(content, sp, level), level }),
            );
            const party = { ...newParty({ team }), badges, flags: { ...plan.flags } };
            const setup = trainerBattle(content, party, goal.trainer, s).setup;
            const weather = goal.weather;
            if (aiBattle(content, weather ? { ...setup, weather } : setup)) wins++;
          }
          return pct(wins / seeds);
        })
        .join(' / '),
    );
    rows.push([local(goal.trainer), String(top), ...cells]);
    if (goal.badge) badges = [...badges, goal.badge];
  }
  return table(
    ['Trainer', 'Top Lv', ...region.teams.map((p) => `${local(p.starter)} (−1 / ±0 / +2)`)],
    rows,
  );
}

// ------------------------------------------------------------------ first battles

/** Each starter alone against each Zorling of the first zone. */
export function starterTable(
  content: GameContent,
  zones: readonly Zone[],
  seeds: number,
  region: BalanceRegion = VERDALE,
): string {
  const meadow = zones.find((z) => z.key === region.firstZone);
  // A new game's table: spawns with a story condition (C42) are not out yet.
  const foes = [...new Set(meadow ? openSpawns(meadow).map((s) => s.species) : [])];
  const rows: string[][] = [];
  for (const { starter } of region.teams) {
    for (const foe of foes) {
      const [lo, hi] = meadow?.levels ?? [3, 6];
      const cells = [lo, Math.round((lo + hi) / 2), hi].map((foeLevel) => {
        let wins = 0;
        for (let s = 1; s <= seeds; s++) {
          const level = region.start.starterLevel;
          const won = aiBattle(content, {
            kind: 'wild',
            seed: s,
            player: [createZorling(content, { uid: 'p', species: starter, level })],
            opponent: [createZorling(content, { uid: 'w', species: foe, level: foeLevel })],
          });
          if (won) wins++;
        }
        return pct(wins / seeds);
      });
      rows.push([`${local(starter)} Lv ${region.start.starterLevel}`, local(foe), ...cells]);
    }
  }
  const [lo, hi] = meadow?.levels ?? [3, 6];
  const mid = Math.round((lo + hi) / 2);
  return table(['Starter', 'Wild', `vs Lv ${lo}`, `vs Lv ${mid}`, `vs Lv ${hi}`], rows);
}

export function balanceReport(
  content: GameContent,
  zones: readonly Zone[],
  opts: ReportOptions,
): string {
  const region = opts.region ?? VERDALE;
  const runs = runPlaythroughs(content, zones, opts.seeds, region);
  return [
    `# ${region.name} balance report`,
    '',
    `Playthrough simulator, ${opts.seeds} seeds per team plan. Start: one starter at Lv ${region.start.starterLevel}, ` +
      `${region.start.money} coins. The player grinds until the team's mean level is at most 1 below the ` +
      `fight's top level, buys the best potions on sale before each story fight, and retries after 3 more ` +
      `wild battles when it loses. After 3 losses to a boss (or a trainer's boss) it follows the hint: it catches a ` +
      `wild Zorling of a type the Armor-breaking reaction needs and puts it on the team ("Hint followed"). ` +
      `Minutes are estimates (6 s per turn, 20 s per battle).`,
    '',
    '## Summary',
    '',
    summaryTable(runs),
    '',
    '## Story fights',
    '',
    goalTable(runs),
    '',
    '## Stages',
    '',
    stageTable(runs),
    '',
    '## Money',
    '',
    moneyTable(runs),
    '',
    '## Story trainers by team level (no potions)',
    '',
    trainerTable(content, opts.seeds * 2, region),
    '',
    '## Bosses (wild battle, Zorb ready)',
    '',
    bossTable(content, opts.seeds * 2, region),
    '',
    `## Starter alone vs ${region.firstZone} Zorlings`,
    '',
    starterTable(content, zones, opts.seeds * 2, region),
    '',
  ].join('\n');
}
