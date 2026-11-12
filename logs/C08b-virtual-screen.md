# C08b · Virtual screen (480×270) — Log

- **Date:** 2026-11-12
- **Status:** done
- **Depends on:** C04, C05, C06

## Summary
The game now renders at its pixel-art resolution: scenes and transitions draw into a 480×270 game screen (a nearest-neighbor render texture), shown at the largest whole-number scale that fits the window, centered with black letterbox bars. Scaling is exact in device pixels, so HiDPI and fractional `devicePixelRatio` stay crisp. Mouse and Pixi pointer events report game-pixel coordinates; keyboard is unchanged. The debug overlay stays at native resolution.

## What was built
- `src/engine/render/virtual-screen.ts` — pure `fitVirtual(cssW, cssH, dpr, screen)` (whole-number scale in device pixels, centered offsets on device-pixel boundaries, scale ≥ 1) and `toVirtual(fit, x, y)`. Tests in `virtual-screen.test.ts`.
- `src/engine/render/engine.ts` — `Engine.create({ virtual: { width, height }, letterbox })`: game-screen root (scenes + transitions) rendered into a `RenderTexture` each frame, shown by a scaled `Sprite`; `antialias: false`, `roundPixels: true`; `engine.width/height` = game screen; `engine.fit`, `engine.toScreen(x, y)`; `resize` event carries the fit. Without `virtual` the engine behaves as before (the lab's live UI preview still uses CSS pixels).
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
- **Decision:** Whole-number scale computed in device pixels, minimum 1 (a window smaller than 480×270 device pixels crops the edges rather than blurring).
- **Decision:** Letterbox defaults to black so the game screen edge is visible.

## Deviations from plan / design
- New chunk added to `IMPLEMENTATION_PLAN.md` (C08b) at the user's request; it was a follow-up in the C07 log. `DESIGN.md` already specified 480×270 — no change.

## Issues & known limitations
- UI text still uses Nunito (a smooth font) rendered at 10 px into the pixel screen: readable but soft. A pixel font and pixel UI kit are C10.
- The interim pixel theme and the demo's scaled layout are stop-gaps until C10.
- `lastObjectRendered` override is a contained hack (see Decisions).
- Very small windows (< 480×270 device px) crop instead of scaling down.

## Verification
- `npm run check` — typecheck, lint, format, **201 tests**: all pass (5 new fit tests).
- Browser (headless Chrome, dev server):
  - 1280×800 @1 → scale 2 (960×540 at 160,130); 1000×700 @2 → scale 4; 1536×864 @1.25 → scale 4 (1920×1080 device px, fills the window).
  - Keyboard: S, E opens the Bag grid at every size. Mouse: clicking the first menu item (converted from game pixels to CSS via `engine.fit`) opens Party at every size.
  - Dialog box fits the screen; fade transition covers the game screen only (letterbox stays black); fade-test scene pushes.
  - Debug overlay: 60.0 fps, max frame 16.8 ms, 0 slow frames. No console errors.
- Done when:
  - Crisp 480×270 screen at ×2/×4 with letterbox: ✅
  - Keyboard and mouse still work: ✅
  - Stable 60 fps: ✅

## Follow-ups
- C10: pixel font + pixel UI kit built for 480×270 (replace the interim pixel theme).
- C18/C20: battle and overworld scenes lay out in game pixels (`engine.width/height`).
- Lab: optional "game screen" preview mode for future Pixi sections (C10 battle mock).

## Notes for the next chunk
- Lay out scenes in game pixels: `resize(width, height)` gets 480×270 in the game.
- Convert DOM coordinates with `engine.toScreen(x, y)`; Pixi pointer events already arrive in game pixels.
- Lab sections create their own `Engine` without `virtual` unless they opt in.
