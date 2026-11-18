# C44 · Mouse comfort & remembered menus — Log

- **Date:** 2026-11-18
- **Status:** done
- **Depends on:** C43

## Summary
These are the six UX ideas from after C43, all picked by the user and built in one chunk. The shop has − / + for the quantity. Settings and Sound values have ‹ › arrows. The overworld cursor turns into a hand over things a click acts on. The pause menu, bag and Dex remember where they were. Zorlings drag and drop in Storage and Party, and holding the left button walks toward the pointer.

## What was built
- **Shop quantity** (`src/game/ui/shop.ts`): the selected row shows `[−] ×n [+]` before the price, and each button turns grey at its end. The wheel changes the amount too (up = more). Mouse steps stop at 1 and at the max, while A/D still wrap.
- **Menu steppers** (`src/engine/ui/menu.ts`): a `MenuItem.stepper` draws clickable ‹ › around its value and calls `onStep(i, ±1)`. The value sits centered in a fixed slot (`valueWidth`, or the widest value shown), so the arrows line up in a column and don't move as values change. Used by `settings-menu.ts` (every value row) and `volume-menu.ts` (every channel).
- **Hand cursor** (`src/game/scenes/overworld-scene.ts` `updateCursor`): the world sprite is `eventMode: 'static'`, used only for the cursor. When the pointer moves or the player walks, the tile under the pointer is checked for an occupant (NPC, wild Zorling, sign, item), a door, a campfire or a ferry's boat tile, and the cursor is set to `pointer` or `default`.
- **Remembered menus:** `BagMemory` (`bag.ts`, by tab label and item id) and `DexMemory` (`dex-panel.ts`, the tab plus each tab's cursor and scroll) are plain objects the owner keeps. The panel opens there and writes every change back in `build()`. `OverworldMenus` keeps one bag memory, one Dex memory and the pause menu index. The battle keeps a module-level `BATTLE_BAG`, so battles share their own bag spot.
- **Drag and drop** (`zorling-view.ts` `DragSpots`, `dragGhost`): a press on a spot that moves 4 px with the button held becomes a drag, and releasing drops on the spot under the pointer. A press that never moves stays a click. Storage drops through its existing `held → at → confirm()` path, so the "team needs one Zorling" rule and its message still apply. The wheel scrolls the box while dragging, and the cursor follows the spot under the pointer. Party drops call `onSwap` directly, so dragging skips the Options menu.
- **Hold to walk** (`overworld-scene.ts` `steerTo`): if a press lands on open ground and is held for `STEER_AFTER` (0.25 s), the player re-paths to the tile under the pointer whenever that tile changes. The camera follows the player, so a still pointer near the edge keeps leading. A press on a blocked tile (someone, a sign, a tree) never steers: it walks up and talks, as a click does. Releasing the button, or any dialog or menu opening (held keys are suppressed), stops it.

## Decisions
- **Decision:** Remembered positions last for the session only, not in the save.
  - **Why:** Remembering them is a comfort, not progress. It keeps the saves unchanged.
- **Decision:** The bag remembers by tab label and item id, not by index.
  - **Why:** Tabs come and go with what the player carries, and counts change. An id that is gone falls back to the first row.
- **Decision:** Steering never starts from a press on something blocked.
  - **Why:** While walking, the camera scrolls under a still pointer. Holding on an NPC would re-target past them, and they would never be reached.
- **Decision:** The stepper value slot has a fixed width.
  - **Why:** In the first browser run, clicking ‹ twice at the same spot missed the second time, because "1×" is narrower than "1.5×" and the arrow moved.
- **Decision:** Drag and drop works alongside click-to-pick-up and doesn't replace it.
  - **Why:** It keeps the keyboard flow and the C22 click flow the same.

## Deviations from plan / design
`DESIGN.md` Controls lists the C44 mouse comforts and the remembered menus.

## Issues & known limitations
- The cursor only switches to a hand when the pointer moves (Pixi applies a cursor on pointer move). An NPC walking under a still pointer doesn't change it.
- Storage drag doesn't auto-scroll at the box's edge. Use the wheel while dragging.
- The ‹ › arrows are small (10 px hit boxes in game pixels, 20 px on a 2× screen). Clicking the row itself still steps forward, as before.
- The Dex memory assumes the tab list stays the same within a session. It does, since packs are fixed at boot.

## Verification
- `npm run check`: passes (943 tests). New tests in `src/game/ui/drag.test.ts` cover `DragSpots`: a drag and its drop, a press without movement staying a click, empty spots and misses, and a drop outside every spot.
- In the browser (dev build, headless Chrome, scratch script; no console errors):
  - Settings: ‹ › stepped battle speed both ways (1 → 2 → 1.5 with wrap), and repeated clicks at a fixed spot kept working.
  - Shop: − / + and the wheel moved the quantity within 1–3 (the potion cap left).
  - Remembered menus: the Dex reopened on the Verdale tab, and All kept its own cursor and scroll at 11. The bag reopened on its second tab. The pause menu reopened on its third row.
  - Drag: a Party drag swapped levels [6, 9] → [9, 6]. A Storage drag of team slot 2 into the box made team 1 / box 1.
  - Hand cursor: `pointer` over an NPC, the default over grass.
  - Hold to walk: a 2.5 s hold below the player walked 9 tiles.
- Screenshots looked at: the settings arrows, the shop's − ×2 +, and the drag ghost in Party.
- Done when: each works in a real browser ✅; `npm run check` ✅.

## Follow-ups
- Auto-scroll the storage box when dragging near its top or bottom edge.
- A hold-to-walk path marker that follows the pointer (today the target marker shows the current goal tile).

## Notes for the next chunk
`DragSpots` is reusable for any panel with spots. Give it a `spotAt(localX, localY)` and call `update(input, toLocal)` first in `handleInput`. `MenuItem.stepper` + `onStep` is the way to make any value row mouse-steppable.
