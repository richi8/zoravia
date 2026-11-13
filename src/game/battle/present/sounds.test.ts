import { describe, expect, it } from 'vitest';
import { SFX } from '@game/audio/sfx';
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
} from '../logic';
import { applyShown, eventCues, progressCue, shownFrom, syncStatuses, type Shown } from '.';

const content = loadGameContent([corePack]);
let uid = 0;
const z = (species: string, level: number): Zorling =>
  createZorling(content, { uid: `s${uid++}`, species: `core:${species}`, level });

function events(setup: BattleSetup): [Shown, BattleEvent][] {
  const created = createBattle(content, setup);
  let state = created.state;
  let shown = shownFrom(content, state, () => 0, true);
  const out: [Shown, BattleEvent][] = [];
  const feed = (es: readonly BattleEvent[]): void => {
    for (const e of es) {
      out.push([shown, e]);
      shown = applyShown(content, shown, e);
    }
    shown = syncStatuses(shown, state);
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
      opponent: aiChoice(content, state, OPPONENT, 'trainer'),
    });
    state = r.state;
    feed(r.events);
  }
  return out;
}

const SILENT = new Set<BattleEvent['kind']>(['turnStart', 'turnEnd', 'replaceNeeded']);

describe('battle sounds', () => {
  it('every battle action has a sound, and every cue is real', () => {
    const kinds = new Set<BattleEvent['kind']>();
    const team = (): Zorling[] => [z('puddlit', 14), z('emberkit', 14), z('sproutle', 14)];
    const setups: BattleSetup[] = [];
    for (let seed = 1; seed <= 12; seed++) {
      setups.push({
        kind: 'trainer',
        seed,
        player: team(),
        opponent: [z('voltbat', 13), z('ironshell', 13), z('thornwing', 13)],
        bag: { 'core:potion': 2 },
      });
      setups.push({
        kind: 'wild',
        seed,
        player: team(),
        opponent: [z('voltbat', 10)],
        weather: seed % 2 ? ['core:wet'] : [],
      });
    }
    for (const boss of ['core:thornwing-titan', 'core:glacivar']) {
      setups.push({
        kind: 'wild',
        seed: 3,
        player: [z('puddlit', 30), z('emberkit', 30), z('sproutle', 30)],
        opponent: [bossZorling(content, boss, { uid: `b${uid++}` })],
        bag: { 'core:zorb': 5 },
      });
    }
    for (const setup of setups) {
      for (const [shown, e] of events(setup)) {
        kinds.add(e.kind);
        const cues = eventCues(content, shown, e);
        if (SILENT.has(e.kind)) expect(cues).toEqual([]);
        else if (!(e.kind === 'end' && e.outcome !== 'win' && e.outcome !== 'lose'))
          expect(cues.length, e.kind).toBeGreaterThan(0);
        for (const c of cues) {
          if (c.kind === 'sfx') expect(SFX[c.id], c.id).toBeDefined();
          else expect(setup.player.length + setup.opponent.length).toBeGreaterThan(c.slot);
        }
      }
    }
    // The sample battles reach the common events.
    for (const k of ['sendOut', 'useMove', 'damage', 'fainted', 'end'] as const)
      expect(kinds.has(k), k).toBe(true);
  });

  it('cries on send-out and faint; hits follow effectiveness', () => {
    const [shown, e] =
      events({
        kind: 'wild',
        seed: 1,
        player: [z('puddlit', 10)],
        opponent: [z('emberkit', 5)],
      }).find(([, ev]) => ev.kind === 'sendOut') ?? [];
    expect(shown && e).toBeTruthy();
    if (!shown || !e) return;
    expect(eventCues(content, shown, e).some((c) => c.kind === 'cry')).toBe(true);
    const hit = (effectiveness: number): string | undefined => {
      const c = eventCues(content, shown, {
        kind: 'damage',
        side: OPPONENT,
        amount: 5,
        hp: 10,
        effectiveness,
      })[0];
      return c?.kind === 'sfx' ? c.id : undefined;
    };
    expect(hit(2)).toBe('battle.hitStrong');
    expect(hit(1)).toBe('battle.hit');
    expect(hit(0.5)).toBe('battle.hitWeak');
    const faint = eventCues(content, shown, { kind: 'fainted', side: OPPONENT, slot: 0 });
    expect(faint).toContainEqual({ kind: 'cry', side: OPPONENT, slot: 0, faint: true });
  });

  it('level-ups and moves learned after battle have sounds', () => {
    expect(progressCue({ kind: 'levelUp', level: 5 })).toBe('battle.levelUp');
    expect(progressCue({ kind: 'learned', move: 'core:gust' })).toBe('battle.learned');
    expect(progressCue({ kind: 'xp', amount: 1, reduced: false })).toBeUndefined();
  });
});
