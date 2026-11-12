import { describe, expect, it } from 'vitest';
import { loadGameContent } from '@game/data';
import { createZorling, type Zorling } from '@game/progression';
import { corePack } from '@packs/core';
import {
  aiChoice,
  aiReplacement,
  bossZorling,
  createBattle,
  needsReplacement,
  OPPONENT,
  PLAYER,
  step,
  type BattleEvent,
  type BattleSetup,
  type BattleState,
} from '../logic';
import {
  applyShown,
  eventText,
  nameOf,
  progressText,
  shownActive,
  shownFrom,
  syncStatuses,
  type Shown,
} from '.';

const content = loadGameContent([corePack]);
let uid = 0;
const z = (species: string, level: number): Zorling =>
  createZorling(content, { uid: `t${uid++}`, species: `core:${species}`, level });

/**
 * Plays a whole battle with the trainer AI on both sides (the player throws a Zorb at a
 * Subdued boss) and checks after every step that the mirror, fed only the events, shows what
 * the state holds. Returns every event with the screen before it.
 */
function playThrough(
  setup: BattleSetup,
  trainer?: string,
): { pairs: [Shown, BattleEvent][]; end: BattleState } {
  const created = createBattle(content, setup);
  let state = created.state;
  let shown = shownFrom(content, state, () => 0, true);
  const pairs: [Shown, BattleEvent][] = [];
  const feed = (events: readonly BattleEvent[]): void => {
    for (const e of events) {
      pairs.push([shown, e]);
      expect(() => eventText(content, shown, e, trainer ? { trainer } : {})).not.toThrow();
      shown = applyShown(content, shown, e);
    }
    shown = syncStatuses(shown, state);
    for (const side of [PLAYER, OPPONENT] as const) {
      state.sides[side].team.forEach((c, i) => {
        expect(shown.sides[side].team[i]?.hp).toBe(c.hp);
      });
      expect(shown.sides[side].active).toBe(state.sides[side].active);
    }
  };
  feed(created.events);
  for (let guard = 0; state.phase !== 'ended' && guard < 300; guard++) {
    if (state.phase === 'replace') {
      const side = needsReplacement(state, OPPONENT) ? OPPONENT : PLAYER;
      const r = step(content, state, {
        kind: 'replace',
        side,
        to: aiReplacement(content, state, side),
      });
      state = r.state;
      feed(r.events);
      continue;
    }
    const foe = state.sides[OPPONENT].team[state.sides[OPPONENT].active];
    const player = foe?.boss?.subdued
      ? { kind: 'item' as const, item: 'core:zorb' }
      : aiChoice(content, state, PLAYER, 'trainer');
    const r = step(content, state, {
      kind: 'turn',
      player,
      opponent: aiChoice(content, state, OPPONENT, state.kind === 'wild' ? 'wild' : 'trainer'),
    });
    state = r.state;
    feed(r.events);
  }
  expect(state.phase).toBe('ended');
  return { pairs, end: state };
}

describe('battle presentation mirror', () => {
  it('follows wild, trainer and boss battles event by event', () => {
    for (let seed = 1; seed <= 6; seed++) {
      playThrough({
        kind: 'wild',
        seed,
        player: [z('voltbat', 14), z('puddlit', 14)],
        opponent: [z('sproutle', 13)],
        weather: ['core:wet'],
        bag: { 'core:potion': 2 },
      });
      playThrough(
        {
          kind: 'trainer',
          seed,
          player: [z('puddlit', 22), z('voltbat', 22), z('sproutle', 22)],
          opponent: [z('blazekit', 21), z('ironshell', 21), z('thornwing', 21)],
        },
        'Rival Mira',
      );
    }
    const boss = playThrough({
      kind: 'wild',
      seed: 3,
      player: [z('voltbat', 24), z('ironshell', 24), z('blazekit', 24)],
      opponent: [bossZorling(content, 'core:thornwing-titan', { uid: 'boss' })],
      boss: { id: 'core:thornwing-titan' },
      bag: { 'core:super-potion': 3, 'core:zorb': 2 },
    });
    const kinds = new Set(boss.pairs.map(([, e]) => e.kind));
    expect(kinds).toContain('armorBroken');
    expect(boss.end.outcome).toBe('caught');
  });

  it('starts with nobody out and no statuses, and sends out on events', () => {
    const { state, events } = createBattle(content, {
      kind: 'wild',
      seed: 1,
      player: [z('voltbat', 10)],
      opponent: [z('sproutle', 10)],
      weather: ['core:wet'],
    });
    let shown = shownFrom(content, state, () => 0, true);
    expect(shown.sides[PLAYER].onField).toBe(false);
    expect(shownActive(shown, OPPONENT).statuses).toEqual([]);
    for (const e of events) shown = applyShown(content, shown, e);
    expect(shown.sides[PLAYER].onField).toBe(true);
    expect(shownActive(shown, OPPONENT).statuses.map((s) => s.id)).toEqual(['core:wet']);
  });
});

describe('battle text', () => {
  const wild = createBattle(content, {
    kind: 'wild',
    seed: 1,
    player: [z('voltbat', 10), z('puddlit', 10)],
    opponent: [z('sproutle', 10)],
  }).state;
  const shown = shownFrom(content, wild);
  const text = (e: BattleEvent, s: Shown = shown): string[] => eventText(content, s, e);

  it('names Zorlings by side', () => {
    expect(nameOf(shown, PLAYER, shownActive(shown, PLAYER))).toBe('Voltbat');
    expect(nameOf(shown, OPPONENT, shownActive(shown, OPPONENT))).toBe('the wild Sproutle');
    expect(text({ kind: 'useMove', side: OPPONENT, move: 'core:vine-snap' })).toEqual([
      'The wild Sproutle used Vine Snap!',
    ]);
    expect(text({ kind: 'sendOut', side: OPPONENT, slot: 0 })).toEqual([
      'A wild Sproutle appeared!',
    ]);
    expect(text({ kind: 'sendOut', side: PLAYER, slot: 1 })).toEqual(['Go, Puddlit!']);
    expect(text({ kind: 'switchOut', side: PLAYER, slot: 0 })).toEqual(['Come back, Voltbat!']);
  });

  it('describes reactions, conditions, effectiveness and statuses', () => {
    expect(
      text({ kind: 'reaction', side: OPPONENT, reaction: 'core:conducted', condition: 'core:wet' }),
    ).toEqual(['Wet reacted: Conducted! ×1.75 damage.']);
    expect(
      text({
        kind: 'conditionApplied',
        side: PLAYER,
        condition: 'core:burning',
        turns: 3,
        source: null,
        refreshed: false,
      }),
    ).toEqual(['The weather left Voltbat Burning!']);
    expect(
      text({
        kind: 'conditionApplied',
        side: OPPONENT,
        condition: 'core:wet',
        turns: 3,
        source: PLAYER,
        refreshed: true,
      }),
    ).toEqual(['The wild Sproutle is still Wet (3 turns again).']);
    expect(text({ kind: 'damage', side: OPPONENT, amount: 5, hp: 1, effectiveness: 1.5 })).toEqual([
      "It's super effective!",
    ]);
    expect(text({ kind: 'damage', side: OPPONENT, amount: 5, hp: 1, effectiveness: 1 })).toEqual(
      [],
    );
    expect(text({ kind: 'skipped', side: PLAYER, status: 'core:frozen' })).toEqual([
      "Voltbat is Frozen and can't move!",
    ]);
    expect(
      text({ kind: 'statusEnded', side: PLAYER, status: 'core:rooted', origin: 'reaction' }),
    ).toEqual(['Rooted wore off Voltbat.']);
    expect(
      text({
        kind: 'conditionBlocked',
        side: PLAYER,
        condition: 'core:wet',
        trait: 'core:waterproof',
      }),
    ).toEqual(["Voltbat's Waterproof keeps it from being Wet!"]);
  });

  it('describes items and capture', () => {
    expect(text({ kind: 'itemUsed', side: PLAYER, item: 'core:zorb', slot: null })).toEqual([
      'You threw a Zorb!',
    ]);
    expect(text({ kind: 'itemUsed', side: PLAYER, item: 'core:potion', slot: 1 })).toEqual([
      'You used a Potion on Puddlit.',
    ]);
    expect(text({ kind: 'capture', item: 'core:zorb', success: true, wobbles: 3 })).toEqual([
      'Gotcha! Sproutle was caught!',
    ]);
    expect(text({ kind: 'capture', item: 'core:zorb', success: false, wobbles: 2 })[0]).toMatch(
      /So close/,
    );
  });

  it('names trainers and bosses', () => {
    const t = createBattle(content, {
      kind: 'trainer',
      seed: 1,
      player: [z('voltbat', 10)],
      opponent: [z('blazekit', 20)],
    }).state;
    const ts = shownFrom(content, t);
    expect(
      eventText(
        content,
        ts,
        { kind: 'sendOut', side: OPPONENT, slot: 0 },
        { trainer: 'Rival Mira' },
      ),
    ).toEqual(['Rival Mira sent out Blazekit!']);
    expect(eventText(content, ts, { kind: 'miss', side: OPPONENT, move: 'core:ember' })).toEqual([
      "The foe's Blazekit missed!",
    ]);
    const b = createBattle(content, {
      kind: 'wild',
      seed: 1,
      player: [z('voltbat', 24)],
      opponent: [bossZorling(content, 'core:thornwing-titan', { uid: 'b' })],
      boss: { id: 'core:thornwing-titan' },
    }).state;
    const bs = shownFrom(content, b);
    expect(shownActive(bs, OPPONENT).armor).toBe('armored');
    expect(eventText(content, bs, { kind: 'sendOut', side: OPPONENT, slot: 0 })).toEqual([
      'The Thornwing Titan rises up!',
    ]);
    expect(eventText(content, bs, { kind: 'subdued', side: OPPONENT, slot: 0 })[0]).toMatch(
      /^The Thornwing Titan is Subdued!/,
    );
  });

  it('describes progress after a win', () => {
    expect(progressText(content, 'Puddlit', { kind: 'levelUp', level: 12 })).toEqual([
      'Puddlit grew to Lv 12!',
    ]);
    expect(progressText(content, 'Puddlit', { kind: 'learned', move: 'core:mud-toss' })).toEqual([
      'Puddlit learned Mud Toss!',
    ]);
    expect(
      progressText(content, 'Puddlit', { kind: 'canEvolve', into: 'core:torrentoad' }),
    ).toEqual(['Puddlit is ready to evolve into Torrentoad!']);
  });
});
