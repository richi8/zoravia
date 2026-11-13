# G2a · Battle screen (G2 feedback) — Log

- **Date:** 2026-11-13
- **Status:** done
- **Depends on:** C31 (G2 in progress)

## Summary
The user's first G2 notes were about the battle screen:
- Long lines ran out of the message box.
- There were too many messages, and some waited for `E` while others didn't.
- Picking **Fight** before every move was a chore.

Three layouts were mocked up over real screenshots on a preview page, and the user picked **B**: moves always on screen, battle text as timed captions, and a log behind `L`. The user also asked that `E` never advance text during a battle; it now only closes the end-of-battle results. G2 itself stays open while the user keeps playing.

## What was built
- **Move bar** (`src/game/ui/battle-bar.ts`, `MoveBar`):
  - The active Zorling's moves as cards in the bottom bar, each with its name, type badge, the condition it applies, "Pow · Acc" (or "Status"), and the live hint against this foe (`moveTip`: effectiveness, reactions, combos, Armor).
  - `A/D` + `E`, or hover + click. Type and condition badges have tooltips (`F` inspect).
  - A key column with `I` Items, `Q` Run (dimmed when running isn't allowed), `L` Log and `1-3` Switch; the first three are clickable.
  - The bar stays visible, dimmed, during the turn. It draws into `display` in the HUD, and `view` is an empty anchor for the focus stack.
- **Captions** (`BattleCaption`): one paper ribbon at the top of the battlefield, centered and clear of the foe's card. It wraps (at most 280 px wide).
  - A line stays 1–2.4 s depending on its length, or 0.6 s when it leads into an animation. Battle speed shortens both. No key advances it.
  - Effectiveness is appended to the move's caption ("…used Flame Pounce! It's not very effective…").
  - Blocked actions flash a caption for 2.5 s, for example "You can't run from a trainer battle!", "Your bag is empty." and the bag's "Its HP is already full.". The bag now stays open instead of closing.
- **Battle log** (`BattleLogPanel`, `L`): every caption of the battle with "Turn N" markers. It opens at the newest line, `W/S` scroll, and `L`, `E` or `Q` close it.
- **Results panel** (`BattleResultPanel`): titled Victory! / Caught! / Defeated / Got away. It lists the outcome line, the shared XP, level ups, moves learned or offered and evolutions. This is the only battle text that waits for `E`.
- **Run** is `Q` on the move bar, with a "Run away?" confirm.
- **Input** (`src/game/input/actions.ts`): a new rebindable `log` action (`L`). The battle context gains `inventory` (`I`) and `log`.
- `battle-scene.ts`:
  - The action menu, the move list with its info panel, the battle `DialogBox` and the message box are gone.
  - `say()` now shows a caption, logs it and waits a reading time.
  - The `end` event's text goes to the results panel.
  - Clip preloading runs while the player is choosing.
- `DESIGN.md` → Controls → Battle flow rewritten.

## Decisions
- **Decision:** Option B (captions plus a log on demand) over A (a log always in the corner) and C (keep the box, open the moves directly).
  - **Why:** the user's pick from the preview page (https://claude.ai/artifact/PsmaPjWvNmEPBmVHHoD7xP). It keeps the eye on the Zorlings, and the log covers missed lines.
- **Decision:** `E` advances no battle text at all, and there is no hold-to-speed-up. Only the results panel waits for `E`.
  - **Why:** the user's instruction. Battle speed (launcher now, settings in C33) is the way to make it faster.
- **Decision:** `Q` on the move bar is Run, with a confirmation.
  - **Why:** `Q` is "back" everywhere, and on the bar there is nothing to go back to. The confirmation keeps a stray `Q` from ending a wild battle.

## Deviations from plan / design
- `DESIGN.md` battle flow replaced (see above). The old `MessageBox` and `MoveInfoPanel` stay in `panels.ts`: the lab's battle mock still uses them.

## Issues & known limitations
- Caption timing (1–2.4 s per line) is a first guess. Watch it at G2.
- While the bag or a menu is open, the dimmed bar shows through the veil. That's fine but busy.
- The log cuts lines longer than one row with "…". Most lines fit.
- No automated test drives the battle scene (Pixi): it was checked in the browser.

## Verification
- `npm run check`: all pass (see the commit).
- Browser (headless Chrome over CDP, dev server, 960×540 at DPR 2, keyboard only):
  - Trainer battle: the move bar on the player's turn, with hints ("Super effective (×1.5)", "Sets up Wet for a combo") and Run dimmed. `D` moved the cursor and `E` used Drench.
  - Captions "The foe's Blazekit used Flame Pounce! It's not very effective…" (two lines, wrapped) and "The foe's Blazekit is Wet!".
  - `L` opened the log with "Turn 1" and the merged line, and `L` closed it again.
  - Wild battle: `Q` asked "Run away?", and Stay went back. Played to the end: "Victory! You defeated Puddlit! Your team gained 75 XP each!", and `E` returned to the launcher.
  - No console errors.

## Follow-ups
- G2: the user keeps playing. More notes become more tweaks (G2b, …).
- C33: battle speed in the settings. A caption speed option, if the timing needs one.
- C32: caption fade in/out, and a short sound for blocked actions shown as captions.
