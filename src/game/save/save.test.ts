import { describe, expect, it } from 'vitest';
import type { BattleResult } from '@game/battle/logic';
import { loadGameContent } from '@game/data';
import {
  applyBattleResult,
  bossDone,
  EMPTY_BOSS_LOG,
  newParty,
  recordBoss,
  type Party,
} from '@game/player';
import { createZorling, statsOf } from '@game/progression';
import { corePack } from '@packs/core';
import v1 from '../../../tests/fixtures/saves/v1.json';
import v2 from '../../../tests/fixtures/saves/v2.json';
import {
  formatPlaytime,
  MemoryStore,
  migrate,
  readSave,
  SAVE_VERSION,
  SaveError,
  SaveQueue,
  SaveSlots,
  toSave,
  type GameState,
} from '.';

const content = loadGameContent([corePack]);

/** A save as loose JSON, to break on purpose. */
interface Raw {
  version: number;
  place: { map: string; x: number; y: number; facing: string };
  party: {
    team: { uid: string; hp: number }[];
    storage: { uid: string }[];
    bag: Record<string, number>;
    money: number;
    dex: { seen: string[]; caught: string[] };
  };
}

function raw(s: GameState = state()): Raw {
  return toSave(content, s) as unknown as Raw;
}

function state(over: Partial<GameState> = {}): GameState {
  const z = (species: string, uid: string, level = 9) =>
    createZorling(content, { uid, species: `core:${species}`, level });
  const party: Party = {
    ...newParty({
      team: [z('puddlit', 'p1'), z('emberkit', 'p2'), z('sproutle', 'p3')],
      storage: [z('voltbat', 'p4', 12)],
      bag: { 'core:potion': 2, 'core:zorb': 5 },
      money: 1240,
    }),
    bosses: { 'core:thornwing-titan': { result: 'defeated' } },
    flags: { 'core:pond-ode': 1, 'core:count': 3 },
    quests: { 'core:nothing-biting': { state: 'active', step: 'catch-voltbat' } },
  };
  return {
    party,
    place: { map: 'core:test-region', x: 52, y: 50, facing: 'right' },
    respawn: { map: 'core:test-region', x: 48, y: 47, facing: 'up' },
    playtime: 754.25,
    ...over,
  };
}

describe('save format', () => {
  it('round-trips the full game state through plain JSON', () => {
    const s = state();
    const data = toSave(content, s, new Date('2026-11-13T10:00:00Z'));
    expect(data.version).toBe(SAVE_VERSION);
    expect(data.packs).toEqual({ core: '0.1.0' });
    expect(data.savedAt).toBe('2026-11-13T10:00:00.000Z');
    const back = readSave(content, JSON.parse(JSON.stringify(data)));
    expect(back).toEqual({ ...s, playtime: 754.3 });
  });

  it('migrates the v1 fixture to the current version', () => {
    const data = migrate(v1);
    expect(data.version).toBe(SAVE_VERSION);
    expect(data.party.flags).toEqual({});
    expect(data.party.quests).toEqual({});
    expect(data.place).toEqual({ map: 'core:test-region', x: 61, y: 55, facing: 'left' });
    expect(data.respawn).toBeUndefined();
    expect(data.playtime).toBe(0);
    expect(data.party.bosses).toEqual({});
    expect(data.party.money).toBe(580);
    // v1 had no Dex: owned Zorlings become seen and caught.
    expect(data.party.dex).toEqual({
      seen: ['core:puddlit', 'core:emberkit', 'core:sproutle'],
      caught: ['core:puddlit', 'core:emberkit', 'core:sproutle'],
    });
    const s = readSave(content, v1);
    expect(s.party.team.map((z) => z.uid)).toEqual(['p1', 'p2']);
    expect(s.party.team[0]?.titanMark).toBe(false);
    expect(s.party.team[1]?.nickname).toBe('Sparky');
    expect(s.party.storage[0]?.species).toBe('core:sproutle');
    expect(s.party.bag).toEqual({ 'core:potion': 3, 'core:zorb': 4 });
  });

  it('migrates the v2 fixture: story flags and quests start empty', () => {
    expect(v2.version).toBe(2);
    const data = migrate(v2);
    expect(data.version).toBe(3);
    expect(data.party.flags).toEqual({});
    expect(data.party.quests).toEqual({});
    // Everything v2 had is kept.
    expect(data.playtime).toBe(734.5);
    expect(data.respawn).toEqual({ map: 'core:test-region', x: 48, y: 47, facing: 'up' });
    expect(data.party.bosses).toEqual({ 'core:thornwing-titan': { result: 'defeated' } });
    expect(data.party.dex.seen).toContain('core:voltbat');
    const s = readSave(content, v2);
    expect(s.party.team[1]?.nickname).toBe('Sparky');
    expect(s.party.money).toBe(580);
  });

  it('refuses saves with unknown quests and restarts quests at a removed step', () => {
    const missing = raw() as Raw & { party: { quests: Record<string, unknown> } };
    missing.party.quests = { 'gone:quest': { state: 'done' } };
    expect(() => readSave(content, missing)).toThrow(/gone:quest/);
    const moved = raw() as Raw & { party: { quests: Record<string, unknown> } };
    moved.party.quests = { 'core:nothing-biting': { state: 'active', step: 'old-step' } };
    expect(readSave(content, moved).party.quests).toEqual({
      'core:nothing-biting': { state: 'active', step: 'ask-ode' },
    });
  });

  it('refuses newer, unversioned and malformed saves with readable problems', () => {
    expect(() => migrate({ ...raw(), version: 99 })).toThrow(/newer version/);
    expect(() => migrate({ map: 'core:test-region' })).toThrow(/no valid version/);
    expect(() => migrate('hello')).toThrow(SaveError);
    const bad = raw();
    bad.party.money = -5;
    try {
      migrate(bad);
      expect.unreachable();
    } catch (e) {
      expect((e as SaveError).problems.some((p) => p.startsWith('party.money'))).toBe(true);
    }
  });

  it('lists content the loaded packs do not have', () => {
    const r = raw();
    r.party.bag['extra:trinket'] = 1;
    r.party.dex.seen.push('extra:ghostling');
    r.place = { ...r.place, map: 'extra:isle' };
    expect(() => readSave(content, r)).toThrow(
      /content not loaded \(saved with packs: core\): extra:ghostling, extra:isle, extra:trinket/,
    );
  });

  it('repairs values a pack update pushed out of range', () => {
    const r = raw();
    const lead = r.party.team[0];
    if (!lead) throw new Error('no lead');
    lead.hp = 999;
    r.party.bag['core:potion'] = 9; // cap 5
    const s = readSave(content, r);
    const z = s.party.team[0];
    if (!z) throw new Error('no lead');
    expect(z.hp).toBe(statsOf(content, z).hp);
    expect(s.party.bag['core:potion']).toBe(5);
  });

  it('refuses a save with a uid used twice', () => {
    const r = raw();
    const first = r.party.storage[0];
    if (!first) throw new Error('no storage');
    first.uid = 'p1';
    expect(() => readSave(content, r)).toThrow(/uid used twice: p1/);
  });
});

describe('save slots', () => {
  it('starts empty, writes, lists and removes', async () => {
    const slots = new SaveSlots(new MemoryStore(), content);
    expect((await slots.list()).map((s) => s.state)).toEqual(['empty', 'empty', 'empty']);
    await slots.write(2, state(), new Date('2026-11-13T10:00:00Z'));
    const info = await slots.info(2);
    expect(info).toEqual({
      slot: 2,
      state: 'ok',
      fromBackup: false,
      summary: {
        lead: 'Puddlit',
        level: 9,
        team: 3,
        caught: 4,
        place: content.maps.require('core:test-region').name,
        playtime: 754.3,
        savedAt: '2026-11-13T10:00:00.000Z',
      },
    });
    expect((await slots.load(2))?.state.place.x).toBe(52);
    await slots.remove(2);
    expect(await slots.load(2)).toBeUndefined();
    expect(() => SaveSlots.key(4)).toThrow(/1–3/);
  });

  it('keeps the previous write as a backup and falls back to it', async () => {
    const store = new MemoryStore();
    const slots = new SaveSlots(store, content);
    await slots.write(1, state({ playtime: 10 }));
    await slots.write(1, state({ playtime: 20 }));
    expect((await slots.load(1))?.state.playtime).toBe(20);
    store.data.set(SaveSlots.key(1), { version: 2, garbage: true });
    const loaded = await slots.load(1);
    expect(loaded?.fromBackup).toBe(true);
    expect(loaded?.state.playtime).toBe(10);
    expect((await slots.info(1)).state).toBe('ok');
    store.data.set(SaveSlots.backupKey(1), 'junk');
    const info = await slots.info(1);
    expect(info.state).toBe('broken');
  });

  it('loads a v1 save stored in a slot', async () => {
    const store = new MemoryStore();
    await store.setMany([[SaveSlots.key(3), v1]]);
    const loaded = await new SaveSlots(store, content).load(3);
    expect(loaded?.state.place.facing).toBe('left');
    expect(loaded?.savedAt).toBe('2026-11-13T09:30:00.000Z');
  });

  it('queues writes one at a time and skips states replaced while waiting', async () => {
    const written: number[] = [];
    let release: (() => void) | undefined;
    const queue = new SaveQueue(async (s) => {
      await new Promise<void>((r) => (release = r));
      written.push(s.playtime);
    });
    const a = queue.save(state({ playtime: 1 }));
    const b = queue.save(state({ playtime: 2 }));
    const c = queue.save(state({ playtime: 3 }));
    await Promise.resolve();
    release?.();
    await a;
    await new Promise((r) => setTimeout(r, 0));
    release?.();
    await Promise.all([b, c]);
    await queue.idle();
    expect(written).toEqual([1, 3]);
  });

  it('formats play time as hours and minutes', () => {
    expect(formatPlaytime(0)).toBe('0:00');
    expect(formatPlaytime(754)).toBe('0:12');
    expect(formatPlaytime(3 * 3600 + 5 * 60 + 59)).toBe('3:05');
  });
});

describe('one boss per save', () => {
  it('logs wins and catches, not losses or running', () => {
    let log = recordBoss(EMPTY_BOSS_LOG, 'core:glacivar', 'lose');
    expect(log).toBe(EMPTY_BOSS_LOG);
    log = recordBoss(log, 'core:glacivar', 'ran');
    expect(bossDone(log, 'core:glacivar')).toBe(false);
    log = recordBoss(log, 'core:glacivar', 'win');
    expect(log['core:glacivar']).toEqual({ result: 'defeated' });
    log = recordBoss(log, 'core:glacivar', 'caught');
    expect(log['core:glacivar']).toEqual({ result: 'caught' });
    expect(recordBoss(log, 'core:glacivar', 'win')).toBe(log);
  });

  it('is written by applyBattleResult and survives a save', () => {
    const team = [createZorling(content, { uid: 'p1', species: 'core:infernyx', level: 40 })];
    let party = newParty({ team, bag: {} });
    const result: BattleResult = {
      outcome: 'win',
      team,
      xp: 0,
      progress: [[]],
      bag: {},
      caught: null,
    };
    party = applyBattleResult(party, result, { boss: 'core:glacivar' }).party;
    expect(bossDone(party.bosses, 'core:glacivar')).toBe(true);
    const back = readSave(content, toSave(content, { ...state(), party }));
    expect(bossDone(back.party.bosses, 'core:glacivar')).toBe(true);
  });
});
