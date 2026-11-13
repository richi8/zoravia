# G2c · Fewer battle captions (G2 feedback) — Log

- **Date:** 2026-11-13
- **Status:** done
- **Depends on:** G2a

## Summary
After about an hour of play, the user said:
- The game is fun, progression feels good, and combat has depth.
- The captions' timing is fine, but there are too many of them when a lot happens.
- Fainted Zorlings getting XP is fine.

Text for things the screen already shows now goes only to the battle log (`L`), with no caption.

## What was built
- `battle-scene.ts`: `LOG_ONLY_EVENTS`. These events log their line and get no caption or reading pause:
  - a condition applied, refreshed or ended (its chip is on the card);
  - damage over time and heals (numbers pop up);
  - reactions and Armor breaks (big callouts);
  - Armor coming back (its badge).
- Captions remain for moves (with their effectiveness), misses, fumbles, skipped turns, send-outs and switches, faints, Subdued, items, captures, run attempts and conditions a trait blocks.
- `DESIGN.md` → Battle flow: one sentence on what gets no caption.

## Decisions
- **Decision:** Fewer captions instead of shorter ones.
  - **Why:** the user said the time they stay is fine, but there are too many. Every line still goes to the log.

## Verification
- `npm run check` passes (see the commit).
- Browser: a trainer battle, Drench, then Splash Shot. Only the move lines were captioned ("…used Splash Shot! It's super effective!"). The log still lists "The foe's Blazekit is Wet!" and "…is still Wet (3 turns again)." No console errors.

## Follow-ups
- G2: user verdict "we are on a good path".
