# C10 · UI kit & battle mock — Log

- **Date:** 2026-11-12
- **Status:** done
- **Depends on:** C06, C07, C09 (and C08b's virtual screen)

## Summary
The in-game UI kit is built and shown in the lab on the real 480×270 game screen. It has HP/XP bars, type badges, 8 condition icons with turns-left pips, hotbar slots 1–3, the action menu, a move list with an info panel, bag and shop panels, battle text, a speaker dialog, a confirm menu, callouts, damage numbers and toasts. A playable battle mock combines all of it with scripted turns. The look is the user's pick from a preview round: "storybook" paper panels drawn as pixel art, with **smooth text** rendered at native resolution on a new engine UI layer. The user also asked for **tooltips**. They work on mouse hover and from the keyboard (`F` inspect mode).

## What was built
- **Engine: native-resolution UI layer** (`src/engine/render/engine.ts`). In virtual mode, the world (`layers.scenes`) still renders into the pixel texture. A scene's new optional `ui` view (`layers.ui`) and the transitions are drawn straight to the canvas, scaled to the game screen. Every `Text` there gets `resolution = fit.scale`, so text is smooth while shapes at whole game pixels still look like pixel art. Pointer events and bounds stay in game pixels.
  - `Scene.ui` and `SceneHost.attachUi/detachUi` (`src/engine/scenes/scene-manager.ts`). Hosts without a UI layer attach `ui` after `view`.
- **Engine UI** (`src/engine/ui/`):
  - `pixel-shapes.ts`: whole-pixel rounded rects and outlines (stepped corners), bitmaps from `'#.'` strings, cursor triangles. The geometry is pure (`roundRectRuns`, `roundStrokeRuns`, `bitmapRuns`).
  - `spatial-nav.ts`: `nearestInDirection` and `firstInReadingOrder` (pure).
  - `tooltip.ts`: `TooltipLayer` (register targets, hover delay, placement clamped to the screen, keyboard pin) and `InspectWidget` (a focus-stack widget with a blinking frame that the directions move between targets; E/Q/click closes it).
  - `theme.ts`: optional `UiSkin` (`panel`, `cursor`, `more`). `Panel`, `Menu` and `DialogBox` use it. `Menu` items can have an `icon` and a right-aligned `hint`. Menu and dialog geometry is rounded to whole pixels.
  - `src/engine/render/pixel-texture.ts`: `PixelSprite` → nearest-filtered Pixi texture.
- **Game UI kit** (`src/game/ui/`): `skin.ts` (storybook paper, wells, cursor, `storybookSkin`), `text.ts` (text roles: body, label, name, number, callout), `icons.ts` (8 type glyphs, 8 condition glyphs, potion/orb sprites, coin), `badges.ts` (`TypeBadge`, `ConditionChip`, `KeyHint`, `row`), `bars.ts` (`HpBar` with a smooth drain and a "ghost" for lost HP, `XpBar`, `hpColor`), `battle-hud.ts` (`CombatantCard` foe/ally, `Hotbar` with portraits, key caps, mini HP and click-to-select), `panels.ts` (`MessageBox`, `MoveInfoPanel` with a live tip, `MoneyLabel`, item/coin drawing), `bag.ts` (`BagPanel`: tabs, counts against the cap, details, "use on" a target), `shop.ts` (`ShopPanel`: quantity, FULL, money, cap- and money-limited), `callout.ts` (`Callout`, `FloatNumber`, `Toast`, `EffectsLayer`).
- **Tokens and theme**: `paper` tokens (also as `--z-paper-*` CSS variables). `createUiTheme({ screen: true })` / `ZORAVIA_SCREEN_THEME` replaces the interim pixel theme. The game boot uses it.
- **Zorling frame player** `src/game/zorlings/actor.ts` (`ZorlingActor`, the C09 follow-up): plays clips lazily, honors `ms/dx/dy/alpha`, mirrors for the foe side and has a speed multiplier.
- **Input**: new `inspect` action on `F` (menu and battle contexts).
- **Lab** "UI kit & battle mock" section (`src/lab/sections/battle-mock.ts`, `src/lab/battle-mock/`) on a 960×540 stage (exactly 480×270 at ×2). It has three screens:
  - **Battle:** backdrop, animated Zorlings, cards, hotbar and prompt. Fight → move list + info; Switch menu or `1 2 3` / click a slot; Items → bag → use on; Run. Scripted turns cover battle text, attack/hurt/faint clips, HP drain, damage numbers, reactions (callout and consumed condition), applied conditions, ticking turns, forced switch after a faint, and a reset after a win or run.
  - **Shop:** a list you can buy from, plus the shopkeeper dialog with a speaker tag.
  - **UI kit:** every piece on one sheet, with live callouts and toasts.
  - Mock data (`data.ts`) follows DESIGN.md's type chart and reaction table and stands in until C12.
- Tests: `pixel-ui.test.ts` (shapes and spatial nav, 10), scene UI views (2), `bars.test.ts` (3), storybook contrast and theme (2), `battle-mock/data.test.ts` (5): **243 total**.

## Decisions
- **Decision (user, preview round):** Storybook panel style (C), chosen over "night glass" (A) and "framed" (B).
  - **Why:** user choice from a scratchpad preview of five screens in three styles. Done as previews first, per the user's standing preference.
- **Decision (user):** Smooth text instead of the pixel font from the preview.
  - **How:** the engine draws the UI layer at native resolution instead of into the 480×270 texture. Panels, icons and bars are still whole-game-pixel shapes, so they look identical to pixel art. Text gets `resolution = fit.scale`. Fonts are Nunito (body and labels) and Fredoka (names and callouts), as already chosen in C07.
  - **Alternatives considered:** a code-drawn pixel font (built in the preview; rejected by the user); text inside the pixel texture (blurry and soft).
  - **Trade-off:** Pixi renders the UI root with a `transform` and leaves it in the group's world transform. The engine resets it after each frame so hit tests and bounds stay in game pixels. This is a contained hack next to the C08b `lastObjectRendered` one. Recheck both on Pixi upgrades.
- **Decision (user):** Tooltips, reachable by keyboard through an inspect mode on `F`.
  - **Why:** the game must be fully playable by keyboard, so hover-only tooltips would hide information. Spatial navigation lets one widget cover any free layout (cards, hotbar, move info).
  - **Alternatives considered:** `Tab` (it would trap keyboard focus in the lab and fights browser focus); per-menu info panels only (they don't cover cards or the hotbar).
- **Decision:** Panels and icons are drawn with `Graphics` rectangles from bitmap strings, not textures.
  - **Why:** they work in any layer at any scale, need no canvas (the geometry is unit-tested in node), and recolor from tokens.
- **Decision:** Kit components take plain view data (`CombatantView`, `MoveView`, `BagItem`, `ShopItem`) and caller-supplied tooltip text.
  - **Why:** the engine and UI hold no content. Descriptions come from packs later (C12). The lab mock supplies them from DESIGN.md for now.
- **Decision:** The move info tip shows the most useful fact against the current foe: a combo first (e.g. "Foe is Wet: Conducted ×1.75"), then type effectiveness, then a warning that the foe's type exploits the condition this move applies.
- **Decision:** Battle text uses the C06 `DialogBox` over the message area at the full bar height. Lines that lead into an animation close on their own after a beat. Everything else waits for `E`, as in DESIGN.md.

## Deviations from plan / design
- `DESIGN.md` updated: the Presentation section adds the UI style (storybook), smooth UI text at native resolution, and tooltips. Controls gain `F` = inspect. Reason: user decisions at the C10 review.
- The "pixel font" follow-up from C07/C08b is dropped (user wants smooth text).
- The C06 demo on the game page now uses the storybook theme on the UI layer. Its dim header text is low-contrast on the dark background. It is a placeholder until C33.

## Issues & known limitations
- Two Pixi-internals workarounds in the engine (see Decisions). Covered by the browser checks: hover tooltips, menu clicks, click-outside and right-click all work.
- Text sizes are tuned for ×2–×4 scales. At ×1 (a window under about 960×540 device pixels) 7-px labels are hard to read.
- Icons are 7×7 and some are still abstract (Airborne, Exposed, Muddy). Tooltips name them; polish at G1.
- The 32×32 hotbar portraits of busy plans (dragon) are noisy.
- The battle mock is scripted, not the battle engine: damage is `power / 5 × effectiveness × reaction`, every hit applies its condition, and capture always fails. It exists to exercise the UI.
- `TooltipLayer` keeps entries for destroyed targets until they are unregistered (they are skipped as hidden). The kit sheet leaks a few on resize. Fine in the lab; real screens unregister on rebuild.
- No UI sounds yet (C24). No open/close motion on panels beyond the callouts and toasts.

## Verification
- `npm run check`: typecheck, lint, format, **243 tests**: all pass. `npm run build` succeeds.
- Browser (headless Chrome, dev server, `/lab/#ui-kit`, 960×540 stage at DPR 2 → exactly 480×270 at ×4). Screenshots reviewed:
  - Keyboard only: Fight → move list with info and live tip (W/S updates it) → use Spark Lash: battle text, attack/hurt clips, −26 damage, "Conducted! ×1.75" callout, foe's Wet consumed, HP drain with ghost, "super effective", the foe's turn applies Wet to the ally, turns tick. Items → bag → potion → "use on" (A/D) → back. `2` switches to Thornwing (conditions cleared). Run → "Got away safely!" → reset. `F` inspect shows tooltips and the directions move between targets.
  - Mouse only: click Fight opens moves, right-click goes back, click Items opens the bag, a click outside closes it, a click on hotbar slot 3 switches. Hovering the Water badge and a hotbar slot shows tooltips.
  - Shop: dialog with speaker tag, buying deducts money and updates "own", a capped item becomes FULL and is skipped, the price turns red when you can't afford it, quantity is capped by the bag cap.
  - Kit sheet: all 8 type badges and condition chips, bars (one animated), hotbar, key hints, callouts and toast, battle text, speaker dialog, confirm menu.
  - FPS on the battle mock: 60.0, max frame 16.8 ms, 0 slow frames. No console errors.
  - Game page `/`: the C06 demo runs with the storybook theme, smooth text at ×3 (480×300), no errors.
- Done when:
  - The lab battle mock is navigable by keyboard: ✅ (and by mouse)
  - …and looks like a real game screen: ✅ (user to confirm at G1)

## Follow-ups
- G1: icon polish (Airborne, Exposed, Muddy), portrait readability at 32 px, text sizes at ×1, battle layout after playtesting (user: "we can change it later").
- C12: type and condition data carry tooltip text and colors; replace `src/lab/battle-mock/data.ts`.
- C18: the battle scene reuses the kit plus `ZorlingActor`. Use the type's VFX and battle speed (`actor.speed`). Cache actors per genome. Panel open/close motion.
- C22: scrolling lists for the bag and shop (current panels fit about 6 rows); the overworld bag reuses `BagPanel`.
- C24: UI sounds (cursor, confirm, back, buy, toast).
- C33: the real start flow replaces the C06 demo on the game page; settings for text size and battle speed.
- Engine: consider a small `TooltipLayer.clear()`, and auto-unregister on destroy.

## Notes for the next chunk
- Scenes that show UI: put world art in `view` and UI in `ui` (same game-pixel coordinates). Text in `ui` is smooth automatically. Use whole-pixel positions.
- In-game theme: `ZORAVIA_SCREEN_THEME`. Paper drawing: `drawPaper`, `drawWell`, `drawCursor` from `@game/ui/skin`. Text: `uiText(role, text, color)`.
- Tooltips: create a `TooltipLayer` (its `view` on top of the scene UI), pass `HudTips` to cards and the hotbar, and open an `InspectWidget` on the `inspect` action.
- Zorlings in scenes: `new ZorlingActor(genome, { facing })`, call `update(dt)`, `play('attack', onDone)`.
