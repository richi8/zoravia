# C06 · UI framework — Log

- **Date:** 2026-11-12
- **Status:** done
- **Depends on:** C05

## Summary
A reusable, keyboard-first UI layer: a focus stack for nested menus/dialogs, list and grid menus with a highlighted wrap-around cursor (disabled items skipped), a dialog box with typewriter text (`E` advances, hold `E` to speed up, `Q` completes the page), panels, and a `UiTheme` hook that C07's design tokens will fill. Every widget also works with the mouse alone (hover, click, right-click = back). The app now opens a demo scene exercising all of it.

## What was built
- `src/engine/ui/grid-cursor.ts` — `GridCursor` (pure): list/grid movement, wrap on both axes, ragged last row, disabled skipping, `set` for hover, `reset` on item changes.
- `src/engine/ui/typewriter.ts` — `Typewriter` (pure): pages, chars/second, hold multiplier, page/finish logic.
- `src/engine/ui/focus-stack.ts` — `FocusStack` + `Widget` interface (renderer-agnostic): only the top gets input, all update, focus/blur, held-key suppression on open/close, `remove` closes everything above, `onEmpty`.
- `src/engine/ui/ui-input.ts` — `UiInput` interface + `uiInputFrom(inputManager, actionMap)`, so engine UI never names game actions.
- `src/engine/ui/theme.ts` — `UiTheme` (colors, font, spacing, radius, border, motion), `DEFAULT_THEME` placeholder, `extendTheme`.
- `src/engine/ui/panel.ts`, `menu.ts` (`Menu`: title, columns, fixed/auto width, `setItems`, `setLabel`, `onSelect/onBack/onHighlight`), `dialog-box.ts` (`DialogBox`: speaker tag, pre-wrapped pages, blinking "more" marker, click = confirm).
- `src/engine/input/input-manager.ts` — `suppressHeld()` is now public (used by the focus stack).
- `src/game/input/actions.ts` — `back` also bound to `Mouse2` (right click).
- `src/game/scenes/ui-demo-scene.ts` — demo: root menu → Party (list) → actions submenu → Summary dialog; Bag (3-column grid with a disabled cell); Talk (3-page dialog with speaker); Settings (toggles that relabel items; text speed applies to dialogs); Fade test (pushes a scene with a fade, any key/click returns); a disabled root item.
- `src/game/scenes/placeholder-scene.ts` — optional input + `onLeave`; `src/main.ts` boots the demo (FPS overlay now only with `?debug` or F3).
- Tests: `ui-logic.test.ts` (18 new: grid cursor, typewriter, focus stack incl. click-outside).

## Decisions
- **Decision:** Dialog controls: a confirm *press* only advances a finished page; while typing, holding confirm speeds up (×5) and `Q` completes the page.
  - **Why:** DESIGN.md says "advances with E; holding E speeds it up". Not letting a press skip a typing page means mashing E can't skip text unread; `Q` covers "show it all now". Holding E through a dialog still flows fast: each new press advances and the hold speeds the next page.
- **Decision:** Pages are word-wrapped up front with Pixi's text metrics, then revealed.
  - **Why:** with live word-wrap, half-typed words jump to the next line.
- **Decision:** Pointer events are queued and applied inside the fixed step (`handleInput`).
  - **Why:** all menu logic runs at one point in the frame — same ordering as keyboard input, no re-entrancy from DOM callbacks.
- **Decision:** Right click = back (bound as `Mouse2` on `back`); only the focused menu reacts to the mouse.
  - **Why:** makes nested menus fully usable by mouse alone without close buttons; parent menus stay visible but inert (dimmed cursor).
- **Decision:** Left click outside the focused menu = back (added after user feedback). The `FocusStack` dismisses widgets from the top down until one contains the click: empty space closes all submenus back to the root; a click on a parent menu closes only the menus above it; the click itself does nothing else that step. Dialogs have no `dismiss`, so stray clicks can't skip text; the root menu refuses to close.
  - **Why:** standard menu behaviour the user asked for; done generically via optional `Widget.contains` / `Widget.dismiss` so future widgets opt in.
- **Decision:** Engine widgets take a `UiInput`, not `InputManager<Action>`.
  - **Why:** the engine must not know game action names.
- **Decision:** Theme is passed into widgets (no global singleton); `DEFAULT_THEME` is deliberately plain.
  - **Why:** C07 owns the visual identity; it only needs to produce a `UiTheme`.

## Deviations from plan / design
- Added right-click as `back` (mouse support) — compatible with DESIGN.md ("mouse optional").

## Issues & known limitations
- Menus have no scrolling yet; long lists (storage, Dex) will need a scrolling/paged menu (C22).
- No open/close animations or sounds (C10 / C24).
- Theme changes after construction aren't propagated to existing menus (only `Panel.setTheme`). Fine while themes are static.
- Pixi widgets (`Menu`, `DialogBox`, `Panel`) have no unit tests (need WebGL); covered by the browser walkthrough below.
- Text uses `system-ui` until C07 picks a font.

## Verification
- `npm run check` — typecheck, lint, format, 142 tests: all pass.
- Browser walkthrough (headless Chrome, real keyboard/mouse events, scripted outside the repo) — **36/36 steps passed**:
  - Keyboard only: navigate root (W/S, arrows), wrap past the disabled item; open Bag grid, move with D/↓/A incl. row wrap that skips the disabled cell; select → dialog → E closes; Q / Esc / Backspace close menus; 4-deep nesting (root → Party → actions → Summary dialog); Settings toggles relabel items; Talk dialog: normal speed, hold E = fast, E → next page, Q completes page, finish; Fade test pushes a scene and Q returns.
  - Mouse only: hover highlights, click opens Bag, click on disabled cell ignored, click item → dialog, click closes dialog, right-click back; Party → Gustling → Summary by clicks; click while typing doesn't skip; click through 3 pages; Fade test and click to return.
  - Click outside (8 more steps, all passed): empty space closes a 3-deep stack back to the root; click on the parent menu closes only the submenu; click on a root item while a submenu is open closes the submenu; click on a menu's own padding keeps it open; click outside a dialog doesn't close it; click outside the root keeps it.
  - No page errors (only the known favicon 404).
- Screenshots checked: nested menus with dimmed parent cursors and speaker dialog; grid menu with disabled cell.
- Done when:
  - Demo scene with nested menus fully usable by keyboard only: ✅
  - …and by mouse: ✅

## Follow-ups
- C07: produce a `UiTheme` from the design tokens (+ font) and pass it to the demo/lab.
- C10: menu/dialog open-close motion, move list with info panel built on `Menu` + `onHighlight`.
- C22: scrolling/paged menus for storage, Dex and bag.
- C24: UI sounds on cursor move/select/back.
- C33: wire the demo's text speed / switch-confirm toggles to real settings.

## Notes for the next chunk
- Pattern: `const stack = new FocusStack(host, uiInputFrom(input, {...}))`; open with `stack.push(new Menu({ theme, items, onSelect, onBack: (m) => stack.remove(m) }))`; call `stack.update(dt)` from the scene's `update`.
- `Menu`/`DialogBox` are positioned by the caller (`widget.view.position`) — re-layout on `resize`.
- Phase 0 is complete; C07 (style lab) is next and depends only on C04.
