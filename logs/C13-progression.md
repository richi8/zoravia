# C13 · Zorling instances & progression — Log

- **Date:** 2026-11-12
- **Status:** done
- **Depends on:** C12

## Summary
Individual Zorlings now exist as plain, pure data in `src/game/progression/`. Each one has a level, XP, current HP, up to 3 moves, an optional nickname and an optional Titan mark. Functions cover the stat formula, a cubic XP curve, XP for a win, team-wide shared XP, a badge-based soft level cap, learning moves (replace or skip), the move relearner list, and level-based evolution. Every change returns a new instance plus ordered events for the UI.

## What was built
- `src/game/progression/rules.ts`: numbers and formulas.
  - `statsAt(base, level, titanMark)`: HP = 2·base·L/100 + L + 10, others = 2·base·L/100 + 5, Titan mark ×1.05.
  - `xpForLevel` (L³ − 1, level 1 = 0) / `levelForXp`, `LEVEL_LIMIT` 100.
  - `levelCap(badges)`: 30 / 45 / 52 / 60, then +5 per badge. `OVER_CAP_XP_MULTIPLIER` 0.1.
  - `xpYield(species)` (the `xpYield` field, or stat total / 5) and `defeatXp(species, level, { trainer })` = yield·L/7, trainers ×1.5.
- `src/game/progression/zorling.ts`: the instance and what can happen to it.
  - `zorlingSchema` (Zod, for saves): `uid, species, nickname?, level, xp (total), hp, moves (1–3), titanMark`, and it checks that level matches XP. Type `Zorling`.
  - `createZorling(content, { uid, species, level, nickname?, titanMark? })`: full HP, knows the last 3 learnset moves up to its level.
  - `statsOf`, `displayName`, `normalizeNickname` / `setNickname` (trims, collapses spaces, ≤ 12 characters, no control characters, empty clears it).
  - `gainXp(content, z, amount, { badges })` → `{ zorling, events }`. Events: `xp`, `levelUp`, `learned`, `moveOffer`, `canEvolve`.
  - `shareXp(content, team, amount, { badges })`: full XP to every member that has not fainted.
  - `learnMove(content, z, move, slot | null)`: fills a free slot, replaces a slot, or skips with `null`.
  - `relearnableMoves`, `canEvolve`, `evolve` (keeps level/XP/moves/nickname/mark, then teaches or offers the new species' moves for the current level).
- `src/game/data/species.ts`: optional `xpYield` field.
- Tests: `src/game/progression/progression.test.ts` (24 tests).

## Decisions
- **Decision:** No IVs/EVs/natures. Stats come only from species, level and the Titan mark.
  - **Why:** "Natures/hidden stats" are listed under Future. Keeps stats readable.
- **Decision:** The soft cap only cuts XP (×0.1 at or above the cap). It never blocks leveling. Only the part of a win past the cap is cut.
  - **Why:** DESIGN.md says "sharply reduced", not "stopped". Splitting the amount at the cap avoids a big win being cut completely just before the cap.
  - **Alternatives considered:** a hard stop (feels bad with caught high-level Zorlings).
- **Decision:** Caps 30 / 45 / 52 / 60 for 0–3 badges, then +5 per badge.
  - **Why:** a fresh save must be able to clear T2 (≤ 30) before its first trial. After one badge it can finish T3 (≤ 45). With all 3 badges it reaches the endgame zones (45–60). Expansion badges keep raising the cap. Starting values for C31. Added to DESIGN.md.
- **Decision:** Shared XP gives the full amount to each team member that has not fainted, not a split.
  - **Why:** simple and readable. With a team of 3 there is no reason to bench anyone. Added to DESIGN.md.
- **Decision:** Evolution is an event (`canEvolve`), not done automatically. `evolve()` is a separate step, and waiting is allowed.
  - **Why:** the UI can animate it and ask the player. It costs nothing to also allow "not now".
- **Decision:** On evolving, only the new species' moves for exactly the current level are taught or offered.
  - **Why:** level-1 learnset entries of evolved species are their wild starting moves. Teaching those too would flood the player with offers.
- **Decision:** Gaining max HP (level-up, evolution) adds the same amount to current HP. Fainted Zorlings stay at 0.
  - **Why:** damage already taken is kept, and leveling never revives.
- **Decision:** Instances store total `xp` and `level`, and the schema checks they agree. Stats are derived, never stored.
  - **Why:** saves stay small and can't drift from the formula when C31 changes numbers. The stored level makes save files readable.
- **Decision:** `uid` is passed in by the caller.
  - **Why:** IDs belong to the save/storage (C22/C23). No RNG or global counter is needed here.

## Deviations from plan / design
- DESIGN.md updated: cap values and the ×0.1 cut, shared XP rule, nickname length, evolution can wait.
- The Titan mark is the +5% stats flag only. The signature move and the bigger glowing sprite belong to C17 (bosses) and the battle scene.

## Issues & known limitations
- XP and cap numbers are untested in play. A 0-badge Lv 30 needs about 60+ even-level wins to reach 31 (tested as > 50).
- `moveOffer` events from a multi-level win are resolved one by one by the caller. Moves learned into free slots are applied right away, so the order is "auto-learned first, offers after" within a single award.
- `learnMove` accepts any existing move (no learnset check), so the relearner or future tutors can use it. Callers decide what is allowed.

## Verification
- `npm run check`: typecheck, lint, format, 317 tests (33 files), all pass.
- Done when:
  - Tests cover leveling: ✅ (multi-level gains, HP kept, fainted stays 0, level limit, curve round-trip)
  - Tests cover cap slowdown: ✅ (×0.1 over cap, split at the cap, caps per badge, slow leveling past cap)
  - Tests cover move replacement: ✅ (free slot, offer, replace, skip, invalid cases, relearner)
  - Tests cover evolution: ✅ (event at level, keeps identity, HP, can wait, 3-stage line, final/legendary refuse, moves on evolve)

## Follow-ups
- C14: battle works on `Zorling` + `statsOf`. After a win, call `defeatXp` + `shareXp`. Write battle HP back into `hp`.
- C17: Titan signature move. Captured Titans are created with `titanMark: true`.
- C22: move relearner UI on `relearnableMoves` + `learnMove`. Storage gives out `uid`s.
- C23: save Zorlings with `zorlingSchema`. Content-aware checks (species/moves exist) still need doing on load.
- C31: tune `rules.ts` numbers (curve, yield divisor, caps, over-cap multiplier).

## Notes for the next chunk
- `import { createZorling, statsOf, gainXp, shareXp, defeatXp } from '@game/progression'`.
- Everything is pure and takes `GameContent` as its first argument. No RNG is used.
- `statsOf(content, z).hp` is max HP. `z.hp` is current HP.
