# G2b · Text overflow fixes (G2 feedback) — Log

- **Date:** 2026-11-13
- **Status:** done
- **Depends on:** G2a

## Summary
Two places where text ran out of its panel, from the user's G2 screenshots:
- Elder Rowan's first lore page wrapped to three lines in the two-line dialogue box.
- The quest log's step list ran past the bottom of the panel once the main quest had five steps.

Both are fixed.

## What was built
- **Dialogue box** (`src/engine/ui/dialog-box.ts`): a page that wraps to more lines than the box shows now continues on extra pages, each advanced with `E` as usual. This happens in the engine, so every dialogue, sign and story page gets it. The last of those pages still counts as the last page for choice menus.
- **Quest log** (`src/game/ui/quest-panel.ts`):
  - The right column is built once with all steps.
  - When it is taller than the panel, the finished steps fold into one ticked line ("3 steps done"), so the current step and the reward always show.
  - Anything still too tall is clipped to the panel (a mask) instead of drawing over the world.

## Decisions
- **Decision:** Fold finished steps rather than scroll the details.
  - **Why:** the current step is what the player needs. Scrolling would need a second set of keys in a panel where `W/S` already choose the quest.

## Issues & known limitations
- In a quest with very many open steps, the lower ones are clipped. Today's quests have one open step at a time.

## Verification
- `npm run check` passes (see the commit).
- Browser (headless Chrome, dev server, keyboard):
  - New game, Elder Rowan: "Every spring a warm wind … It wakes the" on one page, "whole forest." on the next.
  - Verdion checkpoint, `J`: "3 steps done", the Heartwood step and "Reward: 3000 coins, 2 × Max Potion", all inside the panel.
  - No console errors.

## Follow-ups
- G2 continues: more notes become G2c, …
