# C33 · Title, settings, start flow — Log

- **Date:** 2026-11-14
- **Status:** done
- **Depends on:** G2

## Summary
The game now opens on a title screen instead of the debug launcher: the dragon crest over a dimmed, drifting Willowmere, with its own theme. From there: Continue, New game (save slot → start region → starter), Load game (slot cards), and Settings. The settings live on the device and also open from the pause menu: battle speed, text speed, the `1 2 3` prompt, screen shake, flashes, sound, mute when hidden, and key rebinding. The user chose the extras: the starter choice with Rival Mira's counter-pick, richer slot cards and the comfort settings. In a logo preview round they kept the current crest (A). Name entry and nicknames were left out.

## What was built
- **Title screen** (`src/game/scenes/title-scene.ts`):
  - The C07 crest is pixelated at 280 px over the first start region's map. The map is dimmed toward navy with darker edges and drifts across 160 px every 90 s.
  - The title theme (`TITLE_MUSIC` in `src/game/audio/music/styles.ts`, `titleSong`, `titleAudio`) is G Lydian flute, strings and harp, 80 bpm.
  - Menu items:
    - **Continue**: the slot saved last, with the lead's name.
    - **New game**.
    - **Load game**: disabled while every slot is empty.
    - **Settings**.
    - **Debug launcher**: only in dev builds and with `?debug`.
  - A veil dims the logo while a screen is open. A `busy` flag blocks a second pick during a scene change, which fixes the launcher's C25 double-push bug for the title.
  - Hiding the tab still autosaves the open world. Quitting from the pause menu comes back here.
- **New game** (`newGameState` in `src/game/save/new-game.ts`):
  - Order: slot (it asks before overwriting) → `RegionPanel` → `StarterPanel` (`src/game/ui/start-panels.ts`) → "Start with Drizzlet?" → the world, with the iris.
  - The state has the starter at the start's level, the start's bag and money, the starter's flag, and the player on the start's anchor.
- **Start data** (`starts` registry, `src/game/data/starts.ts`; `packs/core/starts.ts`):
  - Each entry has a name, a description, the map and anchor, the starters (species, flag, blurb), the level, the bag and the money.
  - Checks: unknown refs, a starter or flag listed twice, and a missing anchor.
  - Verdale: Sprigling, Drizzlet and Emberkit at Lv 6, with 2 Potions, 5 Zorbs and 500 coins.
- **Rival counter-pick**:
  - Trainer members take an optional `instead: [{ if, species, level? }]`; the first matching condition wins (`src/game/data/trainers.ts`, `src/game/story/battles.ts`). A boss member can't use it.
  - All three Mira trainers (including the Lv 17 one for a badge from another region) use the line that beats the player's starter. Fire is the default, so a save with no starter flag (old saves, checkpoints) still meets the Fire line.
- **Slot cards** (`src/game/ui/slot-panel.ts`):
  - Each card shows up to three team portraits, the lead and its level, region, badges, Zorlings caught, play time and when it was saved (or "from backup").
  - Empty and unreadable slots say so.
  - `SlotSummary` gained `species` and `badges`.
- **Settings** (`src/game/settings/`):
  - `GameSettings` covers battle speed, text speed, `confirmSwitch`, `shake`, `flashes` and `muteHidden`.
  - It is kept in `localStorage` (`zoravia:settings`), with each broken value falling back on its own. The C05 binding profile is kept in `zoravia:keys` (`persistBindings`).
  - Scenes read the live values (`gameSettings()`), so a change in the pause menu applies at once.
- **Settings menu** (`src/game/ui/settings-menu.ts`):
  - A/D or E change a value. Sound reuses the C24 `VolumeMenu`. A help line explains each row.
  - The same menu is in the title and the pause menu. The pause menu's Sound item became Settings, and "Quit to launcher" became "Quit to title".
- **Controls** (`src/game/ui/keys-panel.ts`, rules in `src/game/settings/keys.ts`):
  - 17 key groups with two slots each. Up/Down/Left/Right change both the walking and the menu actions.
  - E, then a key: a key used elsewhere is swapped, and the note says which control it moved from.
  - Refused: `Esc` (always Back and Menu; its slots are locked), mouse buttons, and a swap that would leave another control without keys.
  - There is also "Reset to defaults".
  - Engine addition: `InputManager.anyPressed()`.
  - The pause menu's key hints now follow the bindings.
- **Comfort settings applied**:
  - Text speed: overworld dialogue at 24 / 40 / 75 letters per second.
  - Screen shake: off skips the battle shake and the overworld bump nudge.
  - Flashes: off removes the battle transition's white flash, and the evolution flash becomes a faint glow.
  - Mute when hidden: `setMuted` in `src/game/audio/sound.ts` silences the master bus without changing the saved volumes.
- **Debug launcher**: now behind the title, Q goes back to it, and its battle speed, switch and Sound items are gone because it uses the settings. Checkpoints still work.
- **Balance sim** (`tools/balance`):
  - `VERDALE_START` is read from the pack's start data.
  - The team plans carry their starter's flag, so Mira counter-picks in the simulator too.
  - The report's trainer table uses the flags.
- **Tests**:
  - `src/game/settings/settings.test.ts`: storage, listeners, and rebinding swaps and refusals.
  - `packs/core/starts.test.ts`: the start spot, the new game saving and loading, the sim start matching the pack, and Mira beating each starter at 0 and 1 badges.
  - `data.test.ts`: the new registry checks.
  - The slot summary test was updated.

## Decisions
- **Decision:** Logo and title look **A · Dragon crest** (preview round: A crest, B medallion, C storybook name, D gold name with starters).
  - **Why:** the user's pick. The G1 "revisit the logo" item is closed, and the DESIGN "Open" entry was removed.
- **Decision:** Start regions are a new pack registry (`starts`) instead of fields on the map.
  - **Why:** a map is geography. A start also carries starters, items and story flags, and regions 2 and 3 only add an entry (no engine change, as C34/C35 require).
- **Decision:** Mira's counter-pick is pack data: a starter flag plus `instead` on trainer members, not rival code.
  - **Why:** it stays general (any trainer can react to any story condition), and it is all in the data.
  - **Alternatives considered:** three Mira trainers per encounter, with dialogue branching on the flag. That means three times the data and `beat` conditions that have to name all three.
- **Decision:** The Drizzlet team plan in the simulator now catches **Hearthog** in place of Pipwing.
  - **Why:** with the counter, all three of Mira's Galecrest Zorlings beat the old plan (Galehawk > Sproutle, Ironshell > Pipwing, Thornmane > Brooklet). It needed up to 74 wild battles and 15 tries, and the test allows 60 and 10.
  - **Alternatives tried:** Thornmane at Lv 25 (worse: the simulated player then tries her earlier) and Fernwick as the ace (still up to 11 tries).
  - With Hearthog: 31–47 wild battles before her and at most 6 tries. A Drizzlet player whose rival shows a Nature ace has a reason to catch a Fire Zorling, and Hearthog lives on the Brookside Trail.
- **Decision:** `instead` may set its own `level`.
  - **Why:** a tuning knob for counters that come out stronger. Verdale doesn't use it, because lowering the ace's level didn't help (see above).
- **Decision:** `Esc` is fixed as Back and Menu, and cancels picking a key.
  - **Why:** whatever the player rebinds, there is always a way out of every menu by keyboard (the "fully playable by keyboard" rule). It's also how most games treat Esc.
- **Decision:** Settings are global (`gameSettings()`), not passed through scene options.
  - **Why:** the pause menu changes them while the overworld runs, and the next battle must use the new speed. This follows the pattern of the C24 volumes.
- **Decision:** The debug launcher is shown in dev builds and with `?debug` only.
  - **Why:** the G2 log asked to keep checkpoints as a debug option. Release players shouldn't see test battles.

## Deviations from plan / design
- `DESIGN.md`:
  - New section **Starting a game**: title, new game, start data, starter flags, `instead`, slot cards, settings and the Controls rules.
  - Pacing now states the real start.
  - Verdale's rival line covers the counter-pick.
  - Controls mention Settings → Controls with `Esc` fixed.
  - The logo entry is gone from **Open**.
- Engine change: `InputManager.anyPressed()`, a small generic addition for key capture.
- The plan said "start-region selection". With only Verdale there is one entry, but the screen and data are real. Regions 2 and 3 appear by adding `starts` entries.
- Name entry and nicknames were offered as an extra and not chosen (see Follow-ups).

## Issues & known limitations
- Hard-coded key hints elsewhere (the overworld help line "WASD move · E talk", the battle bar's `I` / `Q` / `L` column, the panels' `[E] [Q]` hints, the title's "W/S choose") don't follow rebinding. Only the pause menu's hints do.
- Mira in Galecrest is at the test's edge for the Emberkit plan: one seed in five needed 10 tries (the limit) against her Tidefang. Watch it in play.
- Old saves and checkpoint saves have no starter flag, so Mira fields the Fire line, as before C33.
- The title background is drawn once per resize (about 156 k pixels at 480×270, done in a blink), and its water doesn't animate.
- The new-game screens stack on top of each other (slot list, region list, starters) rather than replacing each other, so `Q` steps back through them. It looks busy at 480×270.
- The UI demo's text speed and confirm toggles (C06) are still placeholders. The demo isn't part of the game.
- There is no player name. Rowan still doesn't learn it (C26/C30 follow-up).

## Verification
- `npm run check`: typecheck, lint, format and tests all pass (68 files, 698 tests).
- The simulator (`tools/balance` tests) passes with the counter-picking Mira for all three plans. Seeds 1–5 before Mira in Galecrest:

  | Plan | Wild battles before Mira | Tries |
  |---|---|---|
  | Sprigling | 20–33 | 1 |
  | Drizzlet | 31–47 | 1–6 |
  | Emberkit | 31–50 | 1–10 (one seed needed 10) |

  Total wild battles per run are 115–153.
- Headless Chrome on `vite` (CDP script in the session scratchpad, 960×540 and 1440×900):
  - The title on a fresh profile (no Continue, Load disabled).
  - Settings, with its help line.
  - New game: slot, region, starters (hop and highlight), confirm, then Willowmere with Drizzlet, 500 coins and the iris.
  - Pause menu: Settings → Controls:
    - Rebinding Up to Z was stored in `zoravia:keys`.
    - Taking `I` for Confirm swapped with Bag, and the note said so.
    - An empty Dex slot refused `I` ("I is the only key for Bag").
  - Quit to title: Continue showed "Emberkit · Slot 1".
  - Load game: the slot card had the portrait, region, badges, caught, play time and date. The Continue / Delete / Back options worked, and the loaded overworld had Emberkit with `core:starter-emberkit`.
  - No console errors.
- Plan deliverables:
  - Title screen with logo ✅
  - Start-region selection ✅ (data-driven, one region so far)
  - Settings ✅: key rebinding, battle speed, volumes, switch confirm toggle
  - Pause menu ✅: Settings, Quit to title
- Extras the user chose:
  - Starter choice and Mira's counter ✅
  - Slot cards ✅
  - Comfort settings ✅: text speed, shake, flashes, mute when hidden, title music

## Follow-ups
- **C37 (accessibility):**
  - Make every key hint follow the bindings (overworld help line, battle bar, panel hints, title hint). A `keyHint(action)` helper that reads `input.bindings` would do it.
  - Reduced motion (`UiMotion`, toasts, the title drift).
  - Text size.
- **Later / a small chunk:**
  - Player name entry and `{player}` in dialogue, so Rowan can learn the name.
  - Nicknames from the party screen.
  - A keyboard text widget for both.
- **C34/C35:**
  - Add a `starts` entry per region: starters with their flags, a level fitting the region's first zone, bag and money.
  - Give each region's rival `instead` counters if it has one.
  - Add the start to the region's balance plans.
- **Later:**
  - Animate the title map's water, or show the chosen start region behind the title.
  - Replace the stacked new-game screens with one panel that steps through.

## Notes for the next chunk
- New game state: `newGameState(content, startId, species)`. Start data: `content.starts`.
- Settings: `gameSettings()` / `updateSettings()` / `onSettingsChange()`, plus `textCharsPerSecond()`. Key rules: `rebindGroup()`, `KEY_GROUPS`.
- Trainer members can use `instead: [{ if: <condition>, species, level? }]`.
- Shared widgets:
  - `SettingsMenu` takes `open` / `close` callbacks for its sub-screens.
  - `SlotPanel`, `RegionPanel` and `StarterPanel` are plain widgets.
- `BATTLE_SPEEDS` moved from the battle scene to `@game/settings`.
