/**
 * Save migrations (C23): each step turns version N into N + 1. `migrate` runs every step a
 * save needs, then checks it against the current schema. Steps work on raw JSON and must not
 * look at game content: content checks come after (`codec.ts`).
 *
 * To change the format: bump `SAVE_VERSION`, update the schema, add the step here, and keep
 * a fixture of the old version in `tests/fixtures/saves/` with a test that migrates it.
 */

import { SAVE_FORMAT, SAVE_VERSION, saveSchema, type SaveData } from './schema';

/** A save that cannot be read; `problems` say why, in plain words. */
export class SaveError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Save cannot be loaded: ${problems.join('; ')}`);
    this.name = 'SaveError';
  }
}

type Json = Record<string, unknown>;
type Step = (old: Json) => Json;

/** `STEPS[n]` upgrades version n to n + 1. */
const STEPS: Readonly<Record<number, Step>> = {
  1: (v1) => {
    const team = asList(v1['team']);
    const storage = asList(v1['storage']);
    const owned = [...new Set([...team, ...storage].map((z) => (z as Json)['species']))];
    return {
      format: SAVE_FORMAT,
      version: 2,
      savedAt: v1['savedAt'],
      packs: {},
      playtime: 0,
      place: { map: v1['map'], x: v1['x'], y: v1['y'], facing: v1['facing'] },
      party: {
        team,
        storage,
        bag: v1['bag'] ?? {},
        money: v1['money'] ?? 0,
        // v1 could leave the Dex out: owned Zorlings were the Dex then.
        dex: v1['dex'] ?? { seen: owned, caught: owned },
        bosses: {},
      },
    };
  },
  // C26: story flags and quests start empty.
  2: (v2) => {
    const party = isObject(v2['party']) ? v2['party'] : {};
    return { ...v2, version: 3, party: { ...party, flags: {}, quests: {} } };
  },
  // C27: no badges, no trainers beaten yet.
  3: (v3) => {
    const party = isObject(v3['party']) ? v3['party'] : {};
    return { ...v3, version: 4, party: { ...party, badges: [], trainers: {} } };
  },
  // C36: places written before maps could grow were at origin (0, 0).
  4: (v4) => {
    const at = (p: unknown): unknown => (isObject(p) ? { ...p, origin: [0, 0] } : p);
    return {
      ...v4,
      version: 5,
      place: at(v4['place']),
      ...(v4['respawn'] === undefined ? {} : { respawn: at(v4['respawn']) }),
    };
  },
  // C36b: no exploration yet; loading reveals around what the save's progress proves.
  5: (v5) => ({ ...v5, version: 6 }),
};

/** The version a raw save says it has. */
export function versionOf(raw: unknown): number {
  if (!isObject(raw)) throw new SaveError(['not a save file']);
  const v = raw['version'];
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
    throw new SaveError(['the save has no valid version']);
  }
  return v;
}

/** Upgrades a raw save of any known version to the current one and checks its shape. */
export function migrate(raw: unknown): SaveData {
  let version = versionOf(raw);
  if (version > SAVE_VERSION) {
    throw new SaveError([
      `it was made by a newer version of the game (save v${version}, game v${SAVE_VERSION})`,
    ]);
  }
  let data = raw as Json;
  while (version < SAVE_VERSION) {
    const step = STEPS[version];
    if (!step) throw new SaveError([`no upgrade from save v${version}`]);
    data = step(data);
    version++;
  }
  const parsed = saveSchema.safeParse(data);
  if (!parsed.success) {
    throw new SaveError(
      parsed.error.issues.map((i) => `${i.path.join('.') || 'save'}: ${i.message}`),
    );
  }
  return parsed.data;
}

function isObject(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asList(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
