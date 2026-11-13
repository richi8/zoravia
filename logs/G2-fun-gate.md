# G2 · Fun gate — Log

- **Date:** 2026-11-13
- **Status:** done
- **Depends on:** C31

## Summary
The user played Region 1 (Verdale) for about an hour, from a new game and from the debug checkpoints. Their verdict: "the game is quite fun, progression feels good, there is some depth to combat, I think we are on a good path." Their notes became three tweaks (G2a–c), done during the gate. The user closed the gate after the last one ("feels better now").

## What was built
- Before the gate (user request): **debug checkpoints** in the launcher, to start just before later fights with the party the C31 simulator had there (see the C31 log's addendum).
- **G2a · Battle screen** ([log](G2a-battle-screen.md)):
  - Picked as option B from a preview round.
  - Moves always on screen as cards, so there is no Fight menu.
  - Battle text as timed captions that no key advances, with a battle log behind `L`.
  - One results panel at the end, the only text that waits for `E`.
- **G2b · Text overflow** ([log](G2b-text-overflow.md)): long dialogue pages continue on the next page, and the quest log folds finished steps.
- **G2c · Fewer captions** ([log](G2c-fewer-captions.md)): what the screen already shows only goes to the log.

## Decisions
- **Decision:** Pass G2 and go on to Phase 8 (polish).
  - **Why:** the user's verdict above. The tweaks are done.
- **Decision:** Keep the C31 balance changes. That includes fainted Zorlings getting the shared XP ("is ok").
- **Decision:** Keep the caption timing (1–2.4 s per line).
  - **Why:** "the time they stay on is ok".

## Deviations from plan / design
- The plan expected changes to be decided at the gate and built afterwards. Here they were small, so they were built during the gate, each as its own commit and log (G2a–c).

## Follow-ups
- **C33:** the start flow. The balance simulator assumes one Lv 6 starter (`VERDALE_START` in `tools/balance/verdale.ts`), so keep them in step. It also brings the battle speed setting and the replacement for the debug launcher (keep checkpoints as a debug option).
- **C32:** juice and presentation, including caption fades and sounds for blocked actions.
- Watch in later play: the grinding before Mira in Galecrest (about 30 wild battles) and before Ace Lyra (about 27).
