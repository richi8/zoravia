# C08b · Virtual screen (480×270) — Log

- **Date:** 2026-11-12
- **Status:** done
- **Depends on:** C04, C05, C06

## Summary
The game now renders in game pixels: scenes and transitions draw into a nearest-neighbor render texture shown at a whole-number scale, exact in device pixels (HiDPI and fractional `devicePixelRatio` stay crisp). The game screen fills the whole window: the scale is the largest that keeps at least 480×270 game pixels visible, and other window shapes/sizes just show more game pixels (no bars, no stretching). Mouse and Pixi pointer events report game-pixel coordinates; keyboard is unchanged. The debug overlay stays at native resolution.

## What was built
- `src/engine/render/virtual-screen.ts` — pure `fitVirtual(cssW, cssH, dpr, min)` (largest whole-number scale keeping ≥ `min` game pixels; game-screen size = window ÷ scale, rounded up to cover; scale ≥ 1) and `toVirtual(fit, x, y)`. Tests in `virtual-screen.test.ts`.
- `src/engine/render/engine.ts` — `Engine.create({ virtual: { width, height } })` (minimum size): game-screen root (scenes + transitions) rendered into a `RenderTexture` (resized with the window) each frame, shown by a scaled `Sprite`; `antialias: false`, `roundPixels: true`; `engine.width/height` = game screen; `engine.fit`, `engine.toScreen(x, y)`; `resize` event carries the fit. Without `virtual` the engine behaves as before (the lab's live UI preview still uses CSS pixels).
- `src/engine/input/dom.ts` — `attachDomInput(..., { mapPoint })` converts pointer positions (main passes `engine.toScreen`).
- `src/game/style/tokens.ts` — `SCREEN = { width: 480, height: 270 }`.
- `src/game/style/theme.ts` — `createUiTheme({ pixel: true })` / `ZORAVIA_PIXEL_THEME`: interim UI sizes for the game screen (10 px text, 1 px borders).
- `src/main.ts` — boots with `virtual: SCREEN` and the pixel theme.
- `src/game/scenes/ui-demo-scene.ts` / `placeholder-scene.ts` — layout numbers scale with the theme / screen height so the demos fit 270 px.

## Decisions
- **Decision:** Render to a texture, not a scaled container.
  - **Why:** true pixel art: vector shapes, rotations and sub-pixel positions all land on the 480×270 grid (a scaled container would draw smooth, high-res vectors).
- **Decision:** Pointer events: the engine points Pixi's event system at the game-screen root (`lastObjectRendered` getter on the renderer instance) and maps positions with `toVirtual` (`events.mapPositionToPoint`).
  - **Why:** Pixi hit-tests the last object rendered to the canvas; with a render texture that is only the display sprite. This keeps existing widgets (menu hover/click) working unchanged.
  - **Trade-off:** relies on Pixi v8 internals (`lastObjectRendered`, `mapPositionToPoint`); recheck on Pixi upgrades. Covered by the browser check (mouse click opens the right menu).
- **Decision (user review):** Fill the whole window instead of a fixed 480×270 with letterbox bars. 480×270 is the minimum visible area; the game screen grows with the window at the same whole-number scale.
  - **Why:** the user found the bars ugly and didn't want stretching. Fixed-size pixels with a variable-size screen keep pixels perfect and use the whole window; UI and Zorlings keep their pixel size, the world/battle backgrounds extend, UI anchors to edges.
  - **Alternatives considered:** fixed 480×270 + letterbox (first version, rejected for bars); fractional "sharp" stretching (uneven pixels/soft seams).
  - **Consequence:** scenes must lay out for `engine.width/height` (variable, ≥ 480×270). `DESIGN.md` Presentation updated.
- **Decision:** Scale ≥ 1; a window smaller than 480×270 device pixels shows fewer game pixels.

## Deviations from plan / design
- New chunk added to `IMPLEMENTATION_PLAN.md` (C08b) at the user's request; it was a follow-up in the C07 log.
- `DESIGN.md` Presentation changed: 480×270 is now the minimum visible area and the game fills the window (was: fixed 480×270, letterboxed). Reason: user review, see Decisions.

## Issues & known limitations
- UI text still uses Nunito (a smooth font) rendered at 10 px into the pixel screen: readable but soft. A pixel font and pixel UI kit are C10.
- The interim pixel theme and the demo's scaled layout are stop-gaps until C10.
- `lastObjectRendered` override is a contained hack (see Decisions).
- Very small windows (< 480×270 device px) show fewer game pixels; scenes should tolerate that.
- Window size changes the visible area; the screen can change mid-game on resize (scenes get `resize`).

## Verification
- `npm run check` — typecheck, lint, format, **202 tests**: all pass (6 fit tests).
- Browser (headless Chrome, dev server):
  - 1440×900 @1 → ×3, 480×300; 1000×700 @2 → ×4, 500×350; 1536×864 @1.25 → ×4, 480×270; 2560×1080 @1 → ×4, 640×270. All fill the window, no bars.
  - Live resize 1920×1080 → 1100×900: game screen 480×270 → 550×450, display covers the window.
  - Keyboard: S, E opens the Bag grid at every size. Mouse: clicking the first menu item (converted from game pixels to CSS via `engine.fit`) opens Party at every size.
  - Dialog box fits the screen; fade transition covers the game screen; fade-test scene pushes.
  - Debug overlay: 60.0 fps, max frame 16.8 ms, 0 slow frames. No console errors.
- Done when:
  - Fills any window crisply at whole-number scales, ≥ 480×270 game pixels: ✅
  - Keyboard and mouse still work: ✅
  - Stable 60 fps: ✅

## Follow-ups
- C10: pixel font + pixel UI kit built for 480×270 (replace the interim pixel theme).
- C18/C20: battle and overworld scenes lay out in game pixels (`engine.width/height`).
- Lab: optional "game screen" preview mode for future Pixi sections (C10 battle mock).

## Notes for the next chunk
- Lay out scenes in game pixels for a variable size: `resize(width, height)` gets ≥ 480×270 (e.g. 480×300, 640×270). Anchor UI to edges; extend backgrounds/world to fill.
- Convert DOM coordinates with `engine.toScreen(x, y)`; Pixi pointer events already arrive in game pixels.
- Lab sections create their own `Engine` without `virtual` unless they opt in.
