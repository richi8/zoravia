import { describe, expect, it } from 'vitest';
import { loadGameContent } from '@game/data';
import { corePack } from '@packs/core';
import {
  canEvolve,
  createZorling,
  defeatXp,
  displayName,
  evolve,
  gainXp,
  learnMove,
  LEVEL_LIMIT,
  levelCap,
  levelForXp,
  relearnableMoves,
  setNickname,
  shareXp,
  statsAt,
  statsOf,
  xpForLevel,
  zorlingSchema,
  type Zorling,
} from '.';

const content = loadGameContent([corePack]);
const c = (local: string): string => `core:${local}`;
const make = (species: string, level: number, extra: Partial<Zorling> = {}): Zorling => ({
  ...createZorling(content, { uid: 'u1', species: c(species), level }),
  ...extra,
});
const toLevel = (z: Zorling, level: number): number => xpForLevel(level) - z.xp;
const NO_CAP = { badges: 99 };

describe('stats', () => {
  it('follows the formula and grows with level', () => {
    const base = { hp: 100, attack: 50, defense: 80, speed: 120 };
    expect(statsAt(base, 50)).toEqual({ hp: 160, attack: 55, defense: 85, speed: 125 });
    expect(statsAt(base, 1)).toEqual({ hp: 13, attack: 6, defense: 6, speed: 7 });
    expect(statsAt(base, 100).attack).toBeGreaterThan(statsAt(base, 99).attack);
  });

  it('Titan mark adds 5% to every stat', () => {
    const base = { hp: 100, attack: 100, defense: 100, speed: 100 };
    const plain = statsAt(base, 40);
    const marked = statsAt(base, 40, true);
    for (const k of ['hp', 'attack', 'defense', 'speed'] as const) {
      expect(marked[k]).toBe(Math.floor(plain[k] * 1.05));
    }
    const titan = make('ironshell', 30, { titanMark: true });
    expect(statsOf(content, titan).hp).toBeGreaterThan(statsOf(content, make('ironshell', 30)).hp);
  });
});

describe('XP curve and level cap', () => {
  it('cubic curve, level 1 = 0, round-trips', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(7);
    expect(xpForLevel(10)).toBe(999);
    for (let l = 1; l <= LEVEL_LIMIT; l++) {
      expect(levelForXp(xpForLevel(l))).toBe(l);
      if (l > 1) expect(levelForXp(xpForLevel(l) - 1)).toBe(l - 1);
    }
  });

  it('caps rise with badges', () => {
    expect([0, 1, 2, 3, 4].map(levelCap)).toEqual([30, 45, 52, 60, 65]);
    expect(levelCap(1000)).toBe(LEVEL_LIMIT);
  });

  it('defeat XP scales with level, stat total and trainers', () => {
    const emberkit = content.species.require(c('emberkit')); // total 300 → yield 60
    expect(defeatXp(emberkit, 7)).toBe(60);
    expect(defeatXp(emberkit, 7, { trainer: true })).toBe(90);
    expect(defeatXp(content.species.require(c('glacivar')), 40)).toBeGreaterThan(
      defeatXp(emberkit, 40),
    );
  });

  it('XP at or above the soft cap is sharply reduced', () => {
    const z = make('ironshell', 30);
    const r = gainXp(content, z, 10_000, { badges: 0 }); // cap 30
    expect(r.events[0]).toEqual({ kind: 'xp', amount: 1000, reduced: true });
    expect(r.zorling.xp - z.xp).toBe(1000);

    const below = make('ironshell', 20);
    expect(gainXp(content, below, 10_000, { badges: 1 }).zorling.xp - below.xp).toBe(10_000);
  });

  it('only the part past the cap is reduced', () => {
    const z = make('ironshell', 29);
    const toCap = toLevel(z, 30);
    const r = gainXp(content, z, toCap + 1000, { badges: 0 });
    expect(r.zorling.xp).toBe(xpForLevel(30) + 100);
    expect(r.zorling.level).toBe(30);
    expect(gainXp(content, z, toCap, { badges: 0 }).events[0]).toMatchObject({ reduced: false });
  });

  it('still levels past the cap, just slowly', () => {
    let z = make('ironshell', 30);
    let battles = 0;
    while (z.level === 30) {
      z = gainXp(content, z, defeatXp(content.species.require(c('ironshell')), 30), {
        badges: 0,
      }).zorling;
      battles++;
    }
    expect(battles).toBeGreaterThan(50);
  });

  it('stops at the level limit', () => {
    const z = gainXp(content, make('ironshell', 99), 1e9, NO_CAP).zorling;
    expect(z.level).toBe(LEVEL_LIMIT);
    expect(z.xp).toBe(xpForLevel(LEVEL_LIMIT));
  });
});

describe('leveling', () => {
  it('gains several levels at once, one event each, and keeps damage taken', () => {
    const z = make('ironshell', 5);
    const hurt = { ...z, hp: z.hp - 5 };
    const r = gainXp(content, hurt, toLevel(z, 8), NO_CAP);
    expect(r.events.filter((e) => e.kind === 'levelUp')).toEqual([
      { kind: 'levelUp', level: 6 },
      { kind: 'levelUp', level: 7 },
      { kind: 'levelUp', level: 8 },
    ]);
    expect(r.zorling.hp).toBe(statsOf(content, r.zorling).hp - 5);
  });

  it('a fainted Zorling stays at 0 HP when leveling', () => {
    const r = gainXp(
      content,
      make('ironshell', 5, { hp: 0 }),
      toLevel(make('ironshell', 5), 7),
      NO_CAP,
    );
    expect(r.zorling.hp).toBe(0);
  });

  it('team-wide shared XP: every member gets the full amount, fainted ones too', () => {
    const team = [make('ironshell', 10), make('puddlit', 10, { hp: 0 }), make('sproutle', 10)];
    const r = shareXp(content, team, 500, NO_CAP);
    expect(r.team.map((z, i) => z.xp - (team[i]?.xp ?? 0))).toEqual([500, 500, 500]);
    expect(r.team[1]?.hp).toBe(0);
  });
});

describe('moves', () => {
  it('starts with the last 3 moves learned by its level', () => {
    expect(make('emberkit', 1).moves).toEqual([c('ember'), c('gust')]);
    expect(make('emberkit', 15).moves).toEqual([c('gust'), c('kindle'), c('flame-pounce')]);
  });

  it('learns into a free slot on level-up', () => {
    const z = make('puddlit', 5); // splash-shot, drench
    const r = gainXp(content, z, toLevel(z, 12), NO_CAP);
    expect(r.events).toContainEqual({ kind: 'learned', move: c('mud-toss') });
    expect(r.zorling.moves).toEqual([c('splash-shot'), c('drench'), c('mud-toss')]);
  });

  it('offers the move when all 3 slots are full: replace or skip', () => {
    const z = make('emberkit', 13); // ember, gust, kindle
    const r = gainXp(content, z, toLevel(z, 14), NO_CAP);
    expect(r.events).toContainEqual({ kind: 'moveOffer', move: c('flame-pounce') });
    expect(r.zorling.moves).toEqual(z.moves);

    const skipped = learnMove(content, r.zorling, c('flame-pounce'), null);
    expect(skipped.zorling.moves).toEqual(z.moves);
    expect(skipped.events).toEqual([]);

    const replaced = learnMove(content, r.zorling, c('flame-pounce'), 1);
    expect(replaced.zorling.moves).toEqual([c('ember'), c('flame-pounce'), c('kindle')]);
    expect(replaced.events).toEqual([
      { kind: 'learned', move: c('flame-pounce'), replaced: c('gust') },
    ]);
  });

  it('rejects known moves and bad slots', () => {
    const z = make('emberkit', 13);
    expect(() => learnMove(content, z, c('ember'), 0)).toThrow(/Already knows/);
    expect(() => learnMove(content, z, c('flame-pounce'), 3)).toThrow(/No move slot/);
    expect(() => learnMove(content, z, c('nope'), 0)).toThrow();
  });

  it('lists moves the relearner can teach', () => {
    const z = make('emberkit', 15); // gust, kindle, flame-pounce
    expect(relearnableMoves(content, z)).toEqual([c('ember')]);
  });
});

describe('evolution', () => {
  it('announces evolution on reaching the level, then evolves keeping identity', () => {
    const z = setNickname(make('emberkit', 15), 'Sparky');
    expect(canEvolve(content, z)).toBe(false);
    const leveled = gainXp(content, z, toLevel(z, 16), NO_CAP);
    expect(leveled.events).toContainEqual({ kind: 'canEvolve', into: c('blazekit') });

    const hurt = { ...leveled.zorling, hp: leveled.zorling.hp - 10 };
    const r = evolve(content, hurt);
    expect(r.events[0]).toEqual({ kind: 'evolved', from: c('emberkit'), into: c('blazekit') });
    expect(r.zorling).toMatchObject({
      species: c('blazekit'),
      level: 16,
      xp: hurt.xp,
      nickname: 'Sparky',
      moves: hurt.moves,
    });
    expect(r.zorling.hp).toBe(statsOf(content, r.zorling).hp - 10);
    expect(statsOf(content, r.zorling).attack).toBeGreaterThan(statsOf(content, hurt).attack);
  });

  it('can wait: evolution is offered again on later level-ups', () => {
    const z = make('emberkit', 16);
    const r = gainXp(content, z, toLevel(z, 17), NO_CAP);
    expect(r.events).toContainEqual({ kind: 'canEvolve', into: c('blazekit') });
    expect(r.zorling.species).toBe(c('emberkit'));
  });

  it('teaches the new species moves for the current level', () => {
    const z = make('puddlit', 22); // splash-shot, drench, mud-toss
    const r = evolve(content, z);
    expect(r.events).toContainEqual({ kind: 'moveOffer', move: c('tide-crash') });
  });

  it('a 3-stage line evolves twice; final stages and legendaries never do', () => {
    let z = evolve(content, make('emberkit', 34)).zorling;
    expect(canEvolve(content, z)).toBe(true);
    z = evolve(content, z).zorling;
    expect(z.species).toBe(c('infernyx'));
    expect(canEvolve(content, z)).toBe(false);
    expect(() => evolve(content, z)).toThrow(/cannot evolve/);
    expect(() => evolve(content, make('glacivar', 60))).toThrow(/cannot evolve/);
    expect(() => evolve(content, make('emberkit', 10))).toThrow(/cannot evolve/);
  });
});

describe('nicknames and saving', () => {
  it('sets, cleans, clears and validates nicknames', () => {
    const z = make('voltbat', 10);
    expect(displayName(content, z)).toBe('Voltbat');
    const named = setNickname(z, '  Zap   Zap ');
    expect(named.nickname).toBe('Zap Zap');
    expect(displayName(content, named)).toBe('Zap Zap');
    const cleared = setNickname(named, '   ');
    expect('nickname' in cleared).toBe(false);
    expect(() => setNickname(z, 'A'.repeat(13))).toThrow(/longer/);
    expect(() => setNickname(z, 'a\nb')).toThrow(/control/);
    expect(setNickname(z, 'Ünïcödé🙂').nickname).toBe('Ünïcödé🙂');
  });

  it('instances round-trip through the schema; bad data is rejected', () => {
    const z = setNickname(make('thornwing', 25, { titanMark: true }), 'Thorny');
    expect(zorlingSchema.parse(JSON.parse(JSON.stringify(z)))).toEqual(z);
    expect(zorlingSchema.safeParse({ ...z, level: 26 }).success).toBe(false);
    expect(zorlingSchema.safeParse({ ...z, moves: [] }).success).toBe(false);
    expect(zorlingSchema.safeParse({ ...z, moves: Array(4).fill(c('gust')) }).success).toBe(false);
  });

  it('progression is deterministic', () => {
    const run = (): Zorling => {
      let z = make('sproutle', 3);
      for (let i = 0; i < 40; i++) z = gainXp(content, z, 37 * i, { badges: 0 }).zorling;
      return z;
    };
    expect(run()).toEqual(run());
  });
});
