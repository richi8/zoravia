# C39 · Browser smoke test & crash screen — Log

- **Date:** 2026-11-15
- **Status:** done (the workflow step has not run on GitHub yet: see Verification)
- **Depends on:** C38

## Summary
`npm run smoke` plays the release build in headless Chrome by keyboard: boot, new game, walk and save, reload, continue, a trainer battle to its end, and the crash screen. It takes about 38 s, and the Pages workflow runs it between the build and the deploy. A frame that throws now stops the loop, saves through the overworld and shows a crash screen instead of a frozen picture. Saves ask the browser to persist.

## What was built
- **Smoke test** (`tools/smoke/cli.ts`, `npm run smoke`, `npm run smoke:run` without the build):
  - Serves `dist/` with Vite's preview server and drives the Chrome installed on the machine through `playwright-core` (no browser download). `SMOKE_CHROME=<path>` picks a binary; `--keep` leaves a screenshot of the last frame. A failure always leaves one, and names the step.
  - The release has no debug hook, so the test reads the save in IndexedDB to know what happened.
  - Steps:
    1. The boot message goes and the named canvas is there.
    2. `E` five times starts a new game: slot 1 holds one Lv 6 Zorling in Verdale.
    3. Walk, open and close the pause menu: the saved place moved.
    4. Reload, then move the saved place to the tile in front of Picnicker Nell (taken from the pack data, relative to the spawn anchor), reload and Continue. She spots the player. `E` reads her lines, picks the first move each turn and closes the results. The step ends when the save shows a win (trainer log) or a loss (the player woke at the center).
    5. WebGL draw calls are made to throw: the crash screen shows the error and the version, the save line settles, and Reload has the focus.
  - Any page error, console error or failed request fails the run (console errors are expected only in step 5).
  - Settings are preset to battle speed 2× and fast text when nothing is stored.
- **Crash guard:**
  - `src/engine/loop/raf.ts`: a frame that throws stops the driver. With an `onError` handler it gets the error; without one the error is rethrown as before.
  - `src/engine/render/engine.ts`: `engine.onCrash`.
  - `src/game/release/crash.ts`: the crash screen, plain DOM over the canvas (`role="alertdialog"`, Reload focused, so Enter reloads).
  - `src/main.ts`: on a crash, mute, save through the first scene on the stack that has `saveNow` (the overworld, also when a battle is on top), and show the screen.
- **Persistent storage** (`src/game/save/idb.ts`): `navigator.storage.persist()` once, after the first write that worked.
- **Workflow** (`.github/workflows/pages.yml`): `npm run smoke:run` after `npm run build`.
- **Tests:** `src/engine/loop/raf.test.ts` (4) and `src/game/release/crash.test.ts` (3). 913 tests in 92 files.

## Decisions
- **Decision:** `playwright-core` with the system Chrome, run as a tool (`tools/run.mjs`), not Playwright's test runner.
  - **Why:** no browser download locally or on the runner (GitHub's Ubuntu image has Chrome), and the tool can import pack data through the path aliases.
  - **Alternatives considered:** `@playwright/test` with its own Chromium (a download of over 100 MB on every CI run); a hand-written DevTools client (no dependency, but hand-rolled waits).
- **Decision:** test the release build, and read state from IndexedDB.
  - **Why:** it tests what ships, including relative paths and stripped dev code. A test hook in the release would be code that exists only for the test.
- **Decision:** the battle comes from an edited save, not from walking.
  - **Why:** wild Zorlings roam at random. A trainer's line of sight with the player one tile in front is certain.
- **Decision:** the battle may be won or lost.
  - **Why:** the test presses only `E`, and a lone starter with no potions loses to Nell about as often as it wins. Both ends go through the results panel, the autosave and the return to the overworld.
- **Decision:** the smoke test is not part of `npm run check`.
  - **Why:** it needs a build and Chrome and takes 38 s; `check` stays the fast gate before a commit. The deploy is gated by both.
- **Decision:** ask for persistent storage after the first save, not at load.
  - **Why:** Firefox shows the player a permission prompt. After starting a game it has a reason; at load it would be the first thing a visitor sees.

## Deviations from plan / design
- `DESIGN.md` updated: the Release section (smoke test, crash screen, persistent storage), and the V1 feature list (fast travel and nickname entry dropped, with the user's friction stance).
- `README.md`: the `smoke` command and the workflow steps.

## Issues & known limitations
- **Not yet run on GitHub.** The Chrome flags for software WebGL (`--enable-unsafe-swiftshader`, `--ignore-gpu-blocklist`) were tested on macOS only. If the runner's Chrome can't make a WebGL context, the step fails at boot and blocks the deploy.
- The crash screen says "Your game was saved just now" when `saveNow` reports no error. `saveNow` also reports no error when it skips the write (mid-ferry, or a debug map with no save slot), so in those two cases the line is wrong.
- Only errors thrown inside a frame reach the crash screen. A rejected promise outside the loop (for example in a scene change) is still only in the console.
- The test covers one path: Verdale, the first starter, one trainer. Menus, shops, capture, evolution and the other regions are not played.
- The test depends on the title menu order (`E` five times) and on Nell facing right; it says so when either changes.
- Port 4179 must be free (Vite picks the next one if not, and the test follows).

## Verification
- `npm run check`: typecheck, lint, format and 913 tests pass.
- `npm run smoke`: passed 6 times in a row locally (37–38 s). The three runs that printed the result all lost to Nell; the win branch was not seen in a run.
- **Breaking it on purpose** (edits to `dist/` only, then restored):
  - `indexedDB.open` renamed in the bundle: fails at "new game" with "a new game was not saved".
  - The script tag removed from `index.html`: fails at "boot to the title screen".
- The crash screen was looked at in the screenshot: title, "Your game was saved just now.", version, error and four stack lines, and the Reload button.
- Done when:
  - `npm run smoke` passes locally: ✅. In the workflow: ❌ not run yet (needs a push).
  - Breaking the boot or the save makes it fail: ✅.
  - `npm run check` passes: ✅.

## Follow-ups
- After the first push: check the workflow's smoke step. If WebGL fails on the runner, try `--use-angle=swiftshader`.
- `saveNow` could say whether it wrote, so the crash screen's save line is always right.
- Catch `unhandledrejection` and show the crash screen for errors outside the loop, if any show up in play.
- A second smoke path (catch a wild Zorling, use the shop) if a release ever breaks one.

## Notes for the next chunk
- Run `npm run smoke` after changes to the title flow, saving, the overworld scene or the battle scene.
- Design stance for all polish chunks (user, 2026-11-15): keep old-game friction. No tutorial, objective tracker, fast travel or nicknames.
- C40 (campfires) starts with a preview round of the prop.
