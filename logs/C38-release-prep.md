# C38 · Release prep — Log

- **Date:** 2026-11-15
- **Status:** done. Live at https://richi8.github.io/zoravia/ (first deploy 2026-11-15).
- **Depends on:** C37

## Summary
The game builds as a small, game-only static site (2.9 MB, down from 8.9 MB) with relative paths, and a GitHub Actions workflow deploys it to GitHub Pages after `npm run check` passes. The title-screen `RangeError` on resize, carried since C36d, is fixed. The accessibility pass darkened secondary text, gave the tier chips readable labels, made OS reduced motion turn off shake and flashes by default, and named the canvas. Version 1.0.0.

## What was built
- **Resize crash fix** (`src/game/world/animate.ts`, `overworld/stream.ts`, `scenes/title-scene.ts`):
  - **Cause:** the title background centers its camera with `w / 2`, which is half a pixel for an odd screen width. With a fractional camera, `drawBase` truncated the start and the end of the source row separately, so a row could be one pixel longer than the space left in the buffer. On the last row that wrote past the end: `RangeError: offset is out of bounds`.
  - **Fix:** `TerrainRenderer.draw`, `TerrainStream.draw` and `TerrainStream.drawGrassOver` floor the camera. The title floors its own camera too.
  - The title keeps its `TerrainStream` across resizes, so a resize draws again and does not bake again.
- **Release build** (`vite.config.ts`, `src/main.ts`, `title-scene.ts`):
  - `base: './'`: relative asset paths, so the site works from any folder, such as a Pages project site at `/<repo>/`.
  - **Only the game page is built.** `ZORAVIA_LAB=1 npm run build` also builds the style lab, with source maps. The dev server still serves `/lab/`.
  - **No source maps** in the release.
  - The **Debug launcher** and the `?demo` UI demo are dev-only. Both are dynamic imports behind `import.meta.env.DEV`, so the release bundle has neither (checked: no "debug launcher" string in `dist/`). `?debug` no longer adds the launcher. It still turns on the FPS overlay toggle, which stays in the release because it helps when someone reports performance.
  - `index.html`:
    - a meta description and theme color;
    - a "Loading Zoravia…" status message until the title is up;
    - a `<noscript>` note.
  - If `main()` fails, the status message becomes "Zoravia could not start in this browser…" instead of leaving a blank page.
- **Deployment:** `.github/workflows/pages.yml` runs on a push to `main` or by hand. Steps: `npm ci`, `npm run check`, `npm run build`, upload `dist/`, deploy with `actions/deploy-pages`. The README has the one-time setup.
- **Accessibility:**
  - `paper.inkDim` changed from `0x765640` to `0x6d4f3b`. Menu hints are drawn in `inkDim` on the gold cursor row, which was 4.15:1. It is now at least 4.5:1 on every paper surface: base, well, shade, cursor and light. `paper.key` keeps the old color, because key caps carry light ink.
  - **Map window tier chips** (`TIER_CHIPS` in `src/game/ui/map-window.ts`): white labels on the T1 and T2 chips were 3.0:1 and 2.2:1. T1, T2 and T3 now use dark ink, and the danger chip keeps white. The T3 chip is a little lighter than its map tint (`0xde7848`) so its label reaches 4.5:1. The map tints themselves did not change.
  - **Reduced motion** (`src/game/settings/settings.ts`):
    - `defaultSettings({ reducedMotion })` turns shake and flashes off.
    - `installSettings(storage, hints)` uses it for anything the player has not stored.
    - `main.ts` passes `prefers-reduced-motion: reduce`.
  - The canvas has `role="application"` and `aria-label="Zoravia game. Play with the keyboard."`.
  - Already present and re-checked: every control can be rebound (C33), text speed has 3 steps (C33), and the game is fully playable by keyboard.
- **Version:** `GAME_VERSION` is `v1.0.0` and `package.json` is `1.0.0`. A test keeps them equal.
- **Tests:** `src/game/release/c38.test.ts`, 7 tests (906 in total, 90 files):
  - a fractional camera never throws and draws the same as the whole pixel below it;
  - `inkDim` and `ink` contrast on every paper surface, and tier chip label contrast;
  - reduced-motion defaults, and a stored choice beating the device hint;
  - the version matches `package.json`.

## Decisions
- **Decision:** GitHub Pages through GitHub Actions. The user picked Pages, and leaving out the lab and the debug launcher.
  - **Why:** it is a static site, and Actions runs the same `npm run check` gate as a local commit.
  - **Alternatives considered:** a `gh-pages` branch pushed from a local machine. That skips the checks and needs a deploy step on every machine.
- **Decision:** floor the camera at the terrain entry points, not only in the title.
  - **Why:** any caller with a fractional camera could hit the same overflow. The overworld happened to use whole pixels.
- **Decision:** darken `inkDim` for everything, not only for hints on the cursor row.
  - **Why:** one token change fixes every place secondary text sits on a darker paper surface (shade, cursor). It is about 8 % darker, which is hard to see.
- **Decision:** keep the main bundle as one chunk (2.5 MB, 575 KB gzipped).
  - **Why:** about 2 MB of it is the three region maps as JSON, and the game needs all of them at start (C37's seamless world). The whole first load is about 720 KB over the wire.
  - **Alternatives considered:** splitting Pixi into a vendor chunk. That would only help caching between releases, at the cost of one more request.
- **Decision:** version 1.0.0.
  - **Why:** the `GAME_VERSION` comment said it would be bumped at release (C38). This is the first deployable release with all three regions and the endgame.

## Deviations from plan / design
- The plan's C38 entry lists deliverables but no "Done when". The checks below were taken from the deliverables.
- The first deploy was done after the commit. The user added `origin` (https://github.com/richi8/zoravia.git) and pushed, since this machine had no GitHub credentials. The workflow then deployed the site.
- **`DESIGN.md` updated:**
  - Settings: reduced-motion defaults.
  - A new "Release" section: Pages, what ships, version, accessibility.
  - "Open": the trademark check is now flagged as before a public launch.
- **`README.md` updated:**
  - the build and dev command notes;
  - a "Release & deployment" section with the Pages setup;
  - the trademark reminder.
- `tools/README.md`: the debug launcher note.

## Issues & known limitations
- Free GitHub accounts can use Pages only with a **public** repository. A private one needs a paid plan. `package.json` is `UNLICENSED`, so making the repo public shows the source without granting a license.
- Startup still has two long tasks in headless Chrome (288 ms and 245 ms): content loading and the title background bake. A "Loading" message now covers that time.
- The map window's tier chips were checked by the contrast test only. A new game knows no zones, so the browser screenshot shows only "???" rows.
- `paper.inkDisabled` (2.2:1) stays below AA on purpose. It marks disabled items, which WCAG does not cover.
- Frame times were measured in headless Chrome at 960×540, which caps at the display rate. Slower machines were not tested.

## Verification
- `npm run check`: typecheck, lint, format and tests all pass (90 files, 906 tests).
- The fractional-camera test failed with the reported `RangeError` at `animate.ts:66` before the fix, and passes after it.
- `npm run build`:
  - leaves no tracked file changed;
  - `dist/` is 2.9 MB (was 8.9 MB), with only `index.html` and `assets/`;
  - no debug launcher code in it.
- **Headless Chrome on `vite preview` of the release:**
  - First load: DOMContentLoaded 87 ms, about 717 KB transferred over 11 requests.
  - The title holds 60 fps: 300 frames, average 16.64 ms, max 16.8 ms. There is no Debug item, and the version reads V1.0.0.
  - The boot message is gone once the title shows, and the canvas has its aria label.
  - **Resize stress:** 40 viewport changes from 481×271 up, with odd widths and heights, at DPR 1, 1.25, 1.5 and 2. No exceptions and no console errors.
  - **New game:** New game, slot, region, starter, then into Willowmere. Walking for 10 s (599 frames): average 16.67 ms, max 16.8 ms, no frame over 20 ms, no long tasks.
  - The pause menu and the map window were checked on screen. The "P", "I", "B" and "M" hints read clearly on the cursor row.
  - **Reduced motion:** with `prefers-reduced-motion: reduce` emulated and nothing stored, Settings shows Screen shake Off and Flashes Off.
  - **Subfolder:** `dist/` copied to `/zoravia/` on a plain static server loads with no failed requests, the way Pages serves a project site.
- Deliverables:
  - Performance pass: ✅ (resize crash fixed, no re-bake on resize, 3× smaller release, 60 fps on title and overworld).
  - Accessibility pass (contrast, remapping, text speed): ✅ (contrast fixes and tests; remapping and text speed exist since C33; reduced motion; canvas label).
  - Production build: ✅.
  - Deployment: ✅. The first workflow run ([run 43720129318](https://github.com/richi8/zoravia/actions/runs/43720129318)) passed check, build and deploy, on Linux. The live page and its bundle return 200, and headless Chrome shows the title with V1.0.0 and no failed requests.
  - Final trademark check reminder: ✅ (DESIGN "Open", README).

## Follow-ups
- **Before a public launch:** the formal trademark check for "Zoravia" (EUIPO; USPTO Class 9 & 41), and maybe registering `zoravia.game`, which was free on 2026-11-12, as a custom domain for Pages.
- Decide on a license before making the repository public.
- Startup: content loading could skip Zod validation for shipped packs in release builds, or the title bake could move to after the first frame, to cut the two long tasks.
- A settings option for larger UI text.
- From C37: re-arm trainer spotting per region, a dither band where sea colors meet, rebuild outer walls that face filler, and draw the filler in the map window.

## Notes for the next chunk
- **Deploying:** every push to `main` on `origin` (github.com/richi8/zoravia) redeploys https://richi8.github.io/zoravia/ through `.github/workflows/pages.yml`, after `npm run check` passes on GitHub.
- `npm run build` builds only the game now. Use `ZORAVIA_LAB=1 npm run build` for the lab, and `npm run dev` serves both.
- Dev-only code: anything behind `import.meta.env.DEV` (the launcher, the demo, the `__zoravia` hook) is dropped from the release. Keep debug tools behind that flag.
- Bump `version` in `package.json` and `GAME_VERSION` together.
