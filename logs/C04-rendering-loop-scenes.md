# C04 · Rendering, game loop, scenes — Log

- **Date:** 2026-11-12
- **Status:** done
- **Depends on:** C01

## Summary
PixiJS v8 renders into `#app`, driven by our own `requestAnimationFrame` loop with a fixed 60 Hz update step and interpolated rendering. A renderer-agnostic scene stack supports push/pop/replace with queued, update-driven transitions (fade included). Resize and `devicePixelRatio` changes are handled, and an F3-toggled FPS overlay shows frame stats. Two placeholder scenes switch with a fade at a steady 60 fps.

## What was built
- `src/engine/loop/fixed-step.ts` — `FixedStepLoop` (pure): fixed update rate, `alpha` for interpolation, long-frame clamp (250 ms), `reset()`.
- `src/engine/loop/raf.ts` — `createRafDriver`: RAF driver that resets timing when the tab becomes visible again.
- `src/engine/scenes/scene-manager.ts` — `Scene` interface (`enter/exit/pause/resume/update/render/resize`, `updateWhenCovered`), `SceneHost`, `Transition` (`setCover(0..1)`), `SceneManager` with promise-returning `push/pop/replace`, an operation queue, and `scene:changed` / `transition:*` events.
- `src/engine/render/fade.ts` — `createFade` Pixi transition.
- `src/engine/render/engine.ts` — `Engine.create({ parent, background, stepHz, debug })`: Pixi `Application` (WebGL, `autoStart: false`), layers (`scenes`, `transitions`, `debug`), `ResizeObserver` + DPR `matchMedia` watcher, `engine.fade()`, `start/stop/destroy`, `resize` event.
- `src/engine/debug/fps-counter.ts` (pure rolling stats) + `fps-overlay.ts` (Pixi panel: FPS, avg/max frame ms, slow frames, steps, scene stack).
- `src/game/scenes/placeholder-scene.ts` + `src/main.ts` — two placeholder scenes; Space/Enter/E or click toggles with a fade. Overlay on by default in dev or with `?debug`.
- Tests: `fixed-step.test.ts`, `scene-manager.test.ts` (15 new).

## Decisions
- **Decision:** Engine owns the frame loop; Pixi's ticker is stopped and `app.render()` is called from our loop.
  - **Why:** one clock for update + render; fixed-step updates keep gameplay deterministic and frame-rate independent (tested at 30–240 fps).
- **Decision:** `SceneManager` is renderer-agnostic (`SceneHost` attach/detach), transitions are a `setCover(amount)` interface driven by `update(dt)`.
  - **Why:** unit-testable in Node without WebGL; any transition (fade, wipe, battle swirl in C18) is just a different `setCover`.
- **Decision:** All stacked scenes stay visible; only the top updates (unless `updateWhenCovered`).
  - **Why:** fits overlays (menus over the world, pause) — the common case in this game.
- **Decision:** Scene changes requested during a transition are queued, not dropped.
  - **Why:** predictable; callers that want to ignore input during a fade can check `isTransitioning` (the placeholder does).
- **Decision:** Coordinates in CSS pixels, renderer resolution = `devicePixelRatio` with `autoDensity`.
  - **Why:** crisp text/vector art on HiDPI. No fixed virtual resolution yet — revisit in C07/C20 if pixel-perfect scaling is wanted.
- **Decision:** Engine modules use relative imports internally; game code uses `@engine/...`.

## Deviations from plan / design
None.

## Issues & known limitations
- F3 (overlay) and the placeholder's Space/Enter/E/click use raw DOM listeners — temporary until C05's input system.
- The Pixi `Application` code (`engine.ts`, `fade.ts`, overlay) has no unit tests (needs WebGL); verified in a real browser instead.
- Production bundle main chunk ≈ 303 kB (90 kB gzip), mostly Pixi. Fine for now; check in C37.
- The FPS overlay text refreshes 4×/s, so the scene label can lag a transition by a few frames.
- Missing favicon → harmless 404 in the console.

## Verification
- `npm run check` — typecheck, lint, format, 95 tests: all pass. `npm run build` succeeds.
- Browser (headless Chrome 2× DPR, WebGL renderer, via puppeteer-core outside the repo):
  - Scene A renders; Space → fade → Scene B (screenshots before, mid-fade, after).
  - FPS 60.0, avg 16.67 ms, max 16.8 ms, **0 slow frames** — before, after, and over a 2 s window after 11 fades.
  - Viewport resized 960×600@2× → 640×400@1×: screen size and renderer resolution followed; still 60 fps.
  - No page errors.
- Done when:
  - Two placeholder scenes switch with a fade: ✅
  - Stable at 60 fps: ✅ (measured, see above; headless Chrome on the dev machine)

## Follow-ups
- C05: replace raw key listeners (F3, placeholder toggle) with input actions; block input during transitions where needed.
- C07: decide `/lab` routing — suggestion: second Vite HTML entry `lab/index.html` that reuses `Engine`.
- C18: battle transition as a `Transition` implementation.
- C37: bundle size / code splitting review; add a favicon.

## Notes for the next chunk
- Create: `const engine = await Engine.create({ parent })`, then `engine.scenes.replace(scene, { transition: engine.fade() })`, `engine.start()`.
- Scenes implement `Scene<Container>` from `@engine/scenes/scene-manager`; put display objects in `scene.view`, lay out in `resize(w, h)`, update in `update(dt)` (seconds, fixed 1/60), interpolate in `render(alpha)`.
- In dev, `window.__zoravia` exposes `{ engine, toggle }` for browser automation.
