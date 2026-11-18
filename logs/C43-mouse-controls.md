# C43 · Mouse & controls pass — Log

- **Date:** 2026-11-18
- **Status:** done
- **Depends on:** C42

## Summary
A controls audit after user feedback: healing at a center took `E` then `Q`, and some lists (the Dex) could not be scrolled with the mouse. Healing now closes the center menu. Right click opens the pause menu in the overworld, and the wheel scrolls every list that scrolls. With these changes the whole game can be played with the mouse alone, and `DESIGN.md` now makes that a rule.

## What was built
- `src/engine/ui/wheel.ts`: `WheelSteps` turns wheel pixels into whole list steps. Small trackpad deltas add up, and turning the other way drops what was left.
- Dex (`src/game/ui/dex-panel.ts`): the wheel scrolls the list (`scrollBy`), and the cursor is clamped to the rows that show, so the entry on the right is always the highlighted one.
- Storage (`src/game/ui/storage-panel.ts`): the wheel scrolls the box by rows. A selection in the box moves to a row that shows (same column), so `E` never acts on a hidden slot.
- Battle log (`src/game/ui/battle-bar.ts`): the wheel scrolls it, and a click inside closes it. A click outside already closed it.
- Evolution (`src/game/ui/evolution-panel.ts`): a click skips to the flash, like `E`.
- Center (`src/game/scenes/overworld-menus.ts`): "Heal your Zorlings" closes the center menu before the reply.
- Bindings (`src/game/input/actions.ts`): `pause` is `Escape` + `Mouse2`. The overworld help line reads "Esc / right click menu · click to walk".

## Audit: what already worked with the mouse
Menus (hover/click), the bag, the shop, party, settings and sound (a click changes a value like `E`), the controls screen, the map window (drag, wheel, clicks), the title, save slots and the start panels. Also battle move cards, the key column (items, run, log), switch slots, the results panel and the dialog (click = advance). Right click / a click outside = back. The only real dead ends were the overworld menu (no mouse way in) and the lists below their first screen.

## Decisions
- **Decision:** Right click opens the menu, not an on-screen menu button.
  - **Why:** It mirrors right click = Back in menus (right click toggles the menu), costs no screen space, and the help line names it.
  - **Alternatives considered:** A HUD button. It is more discoverable, but it adds clutter and goes against the old-school, minimal HUD.
- **Decision:** Healing closes the center menu, but the move relearner still returns to it.
  - **Why:** Healing is the usual one-shot visit. After relearning, the player often wants another relearn or Storage.
- **Decision:** The wheel scrolls the view, and the cursor follows only as far as needed to stay visible.
  - **Why:** It matches the map window lists (C36c), and the detail pane never describes an off-screen row.

## Deviations from plan / design
`DESIGN.md` Controls changed: the mouse was "optional, never required", and mouse-alone play is now a rule (user request). The overworld keys line names right click and the one-`E` center heal.

## Issues & known limitations
- A profile saved before C43 that rebound Menu keeps its stored keys, which have no `Mouse2`. Resetting the controls brings right click back. Default profiles get it automatically.
- Lists with no scrolling (the bag, shop, menus) don't need the wheel today. A future pack with more than about 7 items in one bag tab would overflow the bag, which has no scrolling.
- After a wheel scroll, the row under a pointer that didn't move is highlighted only once the pointer moves (Pixi fires `pointerover` on movement).

## Verification
- `npm run check`: passes (940 tests). New tests: `WheelSteps` (notches, trackpad deltas, turning direction), and right click = pause in the overworld and back in a menu. The settings test now expects Menu to keep right click after a rebind.
- In the browser (dev build, headless Chrome via `playwright-core`, scratch script): a right click opened the pause menu and a second one closed it. Three wheel notches scrolled the Dex from 1–10 to 11–20 (cursor 11), and one notch up scrolled back 3 rows. "Heal your Zorlings" left only the reply on the stack, and one `E` emptied it. The storage wheel didn't throw. No console errors. Screenshots of the menu, the Dex and the HUD help line looked at.
- Done when: each item works in a real browser ✅; `npm run check` ✅.

## Follow-ups
- Bag scrolling, if a pack ever adds more items per tab (none today: 6 potions, 2 capture).
- Maybe: mouse hints in panel key rows (e.g. "wheel"). They were left out to keep the hint rows short.

## Notes for the next chunk
`WheelSteps` is exported from `@engine/ui`. Any new scrolling list should take `input.wheel?.()` through it.
