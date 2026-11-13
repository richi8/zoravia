# C23 · Save system — Log

- **Date:** 2026-11-13
- **Status:** done
- **Depends on:** C22 (and C22b)

## Summary
The game now saves to IndexedDB. There are 3 save slots, and each write keeps the previous copy as a backup. The save format has a version number and a migration chain, and a v1 fixture is upgraded in tests. The overworld autosaves after battles, when menus close with something changed, every 30 s while something changed, on quit, and when the tab is hidden. The pause menu has "Save". The launcher's "Play: test region" opens the slots (continue, new game, delete). Bosses are now logged once per save (beaten or caught). In the browser, a reload restores the player's place, facing, the last center used, the party and play time exactly.

## What was built
- **Boss log** (pure), `src/game/player/bosses.ts`:
  - `BossLog` maps a boss id to `{ result: 'defeated' | 'caught' }`.
  - `recordBoss(log, id, outcome)` records wins and catches, ignores losses and running, and upgrades `defeated` to `caught`. `bossDone(log, id)` checks it.
  - `Party` gains `bosses`. `applyBattleResult(..., { boss })` writes the log.
- **Save module**, `src/game/save/`:
  - `schema.ts`: the v2 format (Zod). `format`, `version`, `savedAt`, `packs` (id → version), `playtime`, `place` and an optional `respawn` (map, x, y, facing), and `party` (team and storage use the C13 `zorlingSchema`, plus bag, money, Dex and boss log).
  - `migrate.ts`: `STEPS[n]` upgrades vN to vN+1, and `migrate(raw)` runs them, then checks the schema. `SaveError` carries readable `problems`. Saves from a newer game version or without a version are refused.
  - `codec.ts`: `GameState` = `{ party, place, respawn?, playtime }`. `toSave` makes a plain JSON copy. `readSave` / `fromSave` check the save against the loaded content:
    - Missing species, moves, items, bosses or maps: the save is refused with the list of missing ids and the packs it was made with.
    - A uid used twice: refused.
    - HP above max and bag counts above a cap: lowered.
  - `slots.ts`:
    - `KeyValueStore` (get, atomic `setMany`, delete) and `MemoryStore`.
    - `SaveSlots`: `load`, `write`, `remove`, `info`, `list`. Keys are `slot-N` and `slot-N.prev`. The old copy and the new write go in one transaction, and loading falls back to the backup.
    - `SaveQueue`: one write at a time, and only the newest waiting state is written.
    - `formatPlaytime`.
  - `idb.ts`: `IndexedDbStore` (database `zoravia`, object store `saves`).
- **Overworld** (`overworld-scene.ts`):
  - New options: `start`, `respawn` and `playtime`. A saved place is used only if it is on this map and walkable, else the spawn point.
  - New `save(state)` option. `snapshot()` returns the `GameState`, and `saveNow('auto' | 'manual')` saves.
  - Autosave runs after battles, on `stack.onEmpty`, every `AUTOSAVE_EVERY` (30 s) and on quit, and only when the party object or the place/respawn changed. The HUD shows "Game saved" for 1.5 s.
  - A failed autosave is reported once per visit, with a hint to use Save.
- **Pause menu** (`overworld-menus.ts`): "Save" (when the host can save) → "Game saved." or "Could not save: …".
- **Launcher** (`debug-launcher-scene.ts`): "Play: test region" → Save slots.
  - Each slot shows the lead Zorling, its level and play time. The note under the menu shows the place, the caught count, the save date, "from backup", or the problems. It now wraps.
  - Filled slot → Continue / Delete / Back. Empty slot → new game (written at once). Unreadable slot → Delete / Back.
  - Delete asks to confirm.
  - `visibilitychange` (hidden) and `pagehide` autosave the open overworld.
  - The in-memory launcher party is gone.
- **`main.ts`**: opens `IndexedDbStore`, falls back to `MemoryStore` with a warning (the launcher then says saves last only this session), and exposes `saves` on the dev handle.
- **Fixture**: `tests/fixtures/saves/v1.json` is a v1 save: flat fields, no Dex, one Zorling without `titanMark`, a nickname.
- **Tests**: `src/game/save/save.test.ts` (13).
  - Format: round-trip, the v1 → v2 migration, newer / unversioned / malformed saves, missing content, repairs, duplicate uids.
  - Slots: empty → write → summary → remove, the backup fallback and a broken slot, a v1 save stored in a slot, the write queue, the play time format.
  - Boss log: the rules, and through `applyBattleResult` into a save and back.
  - **558 tests total.**

## Decisions
- **Decision:** v1 is the flat format of the first draft (party plus map, x, y, facing at the top level, Dex optional). v2 nests `place` and adds respawn, the boss log, play time and pack versions.
  - **Why:** the plan asks for a v1 → v2 migration test. No saves existed before this chunk, so v1 is the format the C21/C22 follow-ups asked for ("save Party, position and facing"). v2 adds what this chunk added. The step is real code, and the fixture keeps it tested.
- **Decision:** Each slot is one playthrough, with no separate autosave slot. Autosave writes to the active slot, and the previous write is kept as a backup.
  - **Why:** "autosave + save slots" without the confusion of two copies of the same game. The backup covers a bad or interrupted write.
  - **Alternatives considered:** a shared autosave slot plus manual slots. Rejected: it is easy to overwrite another playthrough.
- **Decision:** Autosave only when the party object or the place changed, and at fixed moments (after a battle, when a menu closes, every 30 s, on quit, when the tab is hidden).
  - **Why:** the state is immutable, so comparing references is cheap, and walking alone doesn't write every frame. 30 s caps what a crash can lose.
- **Decision:** The boss log lives in `Party`, next to the Dex.
  - **Why:** it flows through the same `onParty` / `applyBattleResult` path and is saved with no extra wiring. "Done" means beaten or caught, as DESIGN says "one per save (catch or win)". Rematches (C27) read `bosses[id].result`.
- **Decision:** A save that needs a missing pack is refused. Numbers that drifted are repaired.
  - **Why:** silently dropping Zorlings from a removed pack loses progress, so it is better to tell the player which content is missing. A rebalanced max HP or bag cap is harmless to clamp.
- **Decision:** No badges or quest flags in the save yet.
  - **Why:** they don't exist yet (C26/C27). Adding them will be a v2 → v3 step, which is what the migration chain is for.
- **Decision:** No preview round for the slot menu.
  - **Why:** it is the debug launcher with the existing `Menu` widget. The real title and slot screen is C33.

## Deviations from plan / design
- DESIGN.md updated: save rules under Tech (3 slots with a backup, when autosave runs, what a save keeps, versions and the content check), and Bosses now says a boss is done once beaten or caught. These are new rules, not changes.
- The "Overworld: test region" launcher item is now "Play: test region" (save slots).

## Issues & known limitations
- Wild Zorlings, NPC positions and the spawn seed are not saved. After a reload the meadow repopulates differently. This is on purpose (DESIGN now says so).
- Pending level-up offers are not saved (as C22b planned). A Zorling that waited can still evolve from the party screen.
- IndexedDB writes on `pagehide` are best-effort: the browser may close before the transaction commits. `visibilitychange` usually comes first, and the 30 s autosave caps the loss.
- Two tabs on the same slot overwrite each other (last write wins). No locking.
- The slot list has no screenshot or team portraits, and play time shows as h:mm. The real slot screen is C33.
- Nothing calls `bossDone` in the overworld yet: bosses only appear in the launcher's standalone battles, which don't touch saves. C27 places bosses in the world.
- The test region's `spawn` anchor is used for a new game. The real start flow (starter choice) is C33.

## Verification
- `npm run check`: typecheck, lint, format, **558 tests (50 files)**: all pass.
- Browser (headless Chrome with a persistent profile, dev server, 960×540 at DPR 2 → 480×270, keyboard only; the dev handle was used to inject data where noted):
  - Empty slots → E on slot 1 → new game at the spawn (50, 49). Walked to (55, 52) and turned up. Esc → Save → "Game saved.". Quit through the menu autosaved.
  - **New browser page, same profile:** the slot list showed "Slot 1 · Puddlit Lv 9" and the note "Test region · 3 caught · 13 Nov, 08:49". Continue restored place (55, 52), facing up, respawn (48, 47), team HP, money 1 240 and play time 9.5 s. **Reload restores the exact state ✅**
  - A won battle (injected through the real `finishBattle` → `resume` path): the HUD showed "Game saved" and money 1 260. The slot on disk then had the new HP, XP and money.
  - The v1 fixture written into IndexedDB slot 2: listed as "Puddlit Lv 11". Continue started at (61, 55) facing left with "Sparky" on the team, 580 coins, and the Dex derived from owned Zorlings. Hiding the tab rewrote it as v2 (money change kept).
    - The first fixture tile, (61, 54), was in the pond. The scene correctly fell back to the spawn, and I moved the fixture to a walkable tile.
  - Slot 1's main copy corrupted: loaded from the backup ("from backup" in the note).
  - Slot 3 with `version: 7`: "can't read", with the note "it was made by a newer version of the game (save v7, game v2)". Delete → "Delete slot 3?" → Yes → empty.
  - Fixed after screenshots: the slot menu stuck out 2 px from the launcher panel, and long notes ran past it (now they wrap).
  - No console errors or warnings in any run.
- Done when "reload restores exact state": ✅ (browser, same profile, new page). "Migration test from v1 → v2 fixture": ✅ (`save.test.ts`, plus loading the fixture from IndexedDB in the browser).

## Follow-ups
- **C26:** quest flags and progress in the save (a v2 → v3 step with a fixture of v2).
- **C27:** badges in the save (and pass them to `BattleScene`'s `badges` for the level cap). Check `bossDone` before placing a Titan or legendary, and pass `boss` to `applyBattleResult`. Rematches read the boss log.
- **C33:** a real title and slot screen (portraits, region, badges, play time), new game with a starter choice, settings saved separately from slots (not per playthrough).
- **C28+:** when there is more than one map, the save already keeps the map id per place. The overworld needs map changes (connections) and a respawn on another map.
- **C31/C37:** export and import a save as a file (backup outside the browser). Maybe warn when IndexedDB storage is not persistent (`navigator.storage.persist()`).

## Notes for the next chunk
- Changing the save format: bump `SAVE_VERSION`, update `schema.ts`, add `STEPS[old]` in `migrate.ts`, copy a save of the old version into `tests/fixtures/saves/vN.json`, and test the upgrade.
- New state that must persist goes in `Party` (if it changes with battles and menus) or in `GameState`. In the second case, extend `OverworldScene.snapshot()` and the launcher's `play()`.
- `new SaveSlots(store, content)`. `MemoryStore` works in tests. In the browser, `__zoravia.saves` is the dev handle (`saves.store` holds the raw entries).
- The overworld saves through `options.save(state)`. The launcher wraps it in a `SaveQueue` per slot.
