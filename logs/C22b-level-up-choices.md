# C22b · Level-up choices — Log

- **Date:** 2026-11-13
- **Status:** done
- **Depends on:** C22

## Summary
Level-ups now lead to choices. Until now, the battle text said "wants to learn X, but already knows 3 moves" and "is ready to evolve", and then nothing happened. Now, back in the overworld after the battle, the player picks a move to forget (or skips the new one) and chooses to evolve now or later. Evolving plays a short animation. A Zorling that waited can evolve any time from the party screen. Added at the user's request ("implement the level up mechanisms"); it was a C22 follow-up.

## What was built
- **Rules** (pure), `src/game/player/level-up.ts`:
  - `Offer` is a move offer or an evolution offer for a team member (by uid).
  - `offersFrom(team, progress)` turns battle progress events into offers. Each member gets its move offers first, then at most one evolution offer, even after several level-ups past the evolution level.
  - `offerValid` drops offers that no longer apply: the move is already known, it already evolved, or it left the team.
  - `answerMoveOffer(…, slot | null)` replaces a move or skips. With a free slot, the move just goes in.
  - `evolveMember` evolves the member, logs the new species in the Dex as caught, and returns the evolution events plus new move offers (moves the new form learns at its current level).
  - `memberOf` finds a team member by uid.
- **Flow**, `src/game/scenes/level-up-flow.ts`, `LevelUpFlow` (owned by `OverworldMenus` as `menus.levelUp`). It asks the offers one at a time:
  - **Move offer:** two dialog pages (new move with type, power and accuracy, then "Forget one to make room?"). Then a menu of the current moves with type icons and stats, plus "Don't learn X". Q means don't learn. Then the result: "1, 2, and… poof! X forgot Y." / "And X learned Z!", or "did not learn".
  - **Evolution offer:** "X is ready to evolve!" → "Evolve into Y" / "Not now". Q means not now, which reminds the player about the party screen. Evolving plays the animation, then "X evolved into Y!", then any move the new form learns now (taught into a free slot, or offered).
  - `run(offers, done)` queues a second batch if one is already running. `evolve(uid, done)` serves the party screen.
- **Evolution animation**, `src/game/ui/evolution-panel.ts`: a paper panel with the 96 px sprite.
  - The old form glows into a white silhouette.
  - The old and new silhouettes swap faster and faster (2 → 8 swaps per second).
  - A white flash, then the new form fades in. About 4 s; `E` skips to the flash.
  - Silhouettes are made from the sprite's own pixels, kept white with their alpha.
- **Party screen**: `E` now opens an options menu: Reorder, "Evolve into Y" (only when it can), Cancel. The row of a Zorling that can evolve gets a small gold diamond, and its details say "Can evolve into Y". `PartyPanel` gained `onSelect`, `hold(index)` and `setTeam(views)`, and `ZorlingView` gained `evolveInto`.
- **Overworld**: `finishBattle` keeps `offersFrom(result.team, result.progress)`, and `resume()` asks them after any messages from the battle (e.g. "sent to storage").
- `OverworldMenus.open`, `close` and `menu` are now public (with an optional `onBack`) so the flow can use them.
- **Tests**, `src/game/player/level-up.test.ts` (4): offer order and one evolution offer per member, replace / skip / free slot, evolving (species, level kept, Dex, Tide Crash offered to a full Torrentoad), dropping stale offers. **545 tests total.**

## Decisions
- **Decision:** The choices are asked in the overworld after the battle, not inside the battle scene.
  - **Why:** the battle already tells what happened, and the overworld has the menu stack, dialogs and party. Doing it there needs no new battle-scene states, and the same flow serves the party screen.
  - **Alternatives considered:** prompting in the battle's result phase. That means a second copy of the menus inside `BattleScene`, and evolving in the middle of the battle's exit.
- **Decision:** Skipping a move is final for that level-up; the relearner (C22, 100 coins) can teach it later.
  - **Why:** DESIGN already says "replace or skip" and has a relearner. It keeps the choice simple.
- **Decision:** "Not now" doesn't block anything. The offer comes back on the next level-up (C13 already emits `canEvolve` each time), and the party screen can evolve it any time.
  - **Why:** DESIGN: "the player may wait, and it is offered again on later level-ups". The party option means waiting never locks you out.
- **Decision:** The evolution animation is silhouette swapping in the existing paper panel, with no preview round.
  - **Why:** it is a small, familiar effect made only from the existing sprites and panel. If the user wants more (particles, sound in C24, a full-screen version), it can be iterated with previews in C32.

## Deviations from plan / design
- New chunk C22b added to IMPLEMENTATION_PLAN.md and PROGRESS.md (user request).
- DESIGN.md: Creatures has a note on how the choices work (after the battle; forget or don't learn; evolve or not now; evolve later from the party screen). This adds detail, not a new rule.

## Issues & known limitations
- Captured Zorlings that go to storage don't gain XP, so they never get offers. That is as designed (only the team gets shared XP).
- The "Don't learn X" row shows the new move's type icon, which may read as if it were a known move. It is clear enough with the label.
- The evolution animation has no sound yet (C24) and isn't full-screen.
- Offers live only until they are answered. If the player quits to the launcher while one is open, it is lost (the Zorling can still evolve from the party screen; a skipped move can be relearned). Saves (C23) don't need to store pending offers.
- In the browser, I injected battle results with level-up events through the dev handle, using the same `finishBattle` → `resume` path as a real battle. Real battles produce those events through `finishBattle` (C13/C14 tests).

## Verification
- `npm run check`: typecheck, lint, format, **545 tests (49 files)**: all pass.
- Browser (headless Chrome, 480×270 at ×4, keyboard only):
  - After a win where Puddlit reached Lv 22 and Emberkit Lv 14, the world resumed with "Puddlit is ready to evolve!" → E. The animation played (silhouettes swapping, flash, Torrentoad), then "Puddlit evolved into Torrentoad!" and "…learned Tide Crash!" (free slot). Then Emberkit's offer: "wants to learn Flame Pounce (Fire, Pow 65 · Acc 95)", "Forget one?", a menu with Ember / Gust / Kindle + "Don't learn Flame Pounce". Picked Gust, and the moves became Ember, Flame Pounce, Kindle. The Dex now lists Torrentoad as caught.
  - Party screen with an Lv 16 Emberkit: "Can evolve into Blazekit" in its details. E → Reorder / Evolve into Blazekit / Cancel → Evolve. The animation played, it became Blazekit, and the party screen updated in place. The options for Blazekit no longer offer evolving.
  - No console errors or warnings.
- Done when "a level-up past a full move set and an evolution level both lead to the right choices, and the results are kept in the party": ✅

## Follow-ups
- **C24:** evolution jingle and the cry of the new form. A level-up chime.
- **C32:** a bigger evolution scene (sparkles, background dim). Let `Q` cancel an evolution mid-animation, if wanted.
- **C23:** nothing extra to save (offers are answered at once). Save the evolved species as usual.

## Notes for the next chunk
- `menus.levelUp.run(offers, done?)` asks any list of `Offer`s; `menus.levelUp.evolve(uid, done?)` evolves now.
- `offersFrom(team, progress)` works on any `BattleResult` (trainer battles in C27 can reuse it).
