# C15 · Conditions & reactions — Log

- **Date:** 2026-11-12
- **Status:** done
- **Depends on:** C14

## Summary
The battle engine now uses conditions and reactions. Moves apply their type's condition by their apply chance. Conditions last 3 of the holder's own turns and have their side effects (HP loss, drains, speed/accuracy/evasion/defense multipliers, fumbles). A matching hit sets off a reaction, which uses up the condition, changes the damage and can leave a lingering effect (Steam Burst, Rooted, Frozen, Overload). Switching out clears a Zorling's statuses, weather can put conditions on both Zorlings at battle start, and the three trait kinds (immunity, type power, longer conditions) work. Everything stays pure, deterministic and JSON-safe.

## What was built
- `src/game/battle/logic/state.ts`: `Status` (`id`, `origin: condition | reaction`, `turnsLeft`, `ticks`, `source`, `fresh`) and `Combatant.statuses`. New events: `conditionApplied` (with `source`, `refreshed`), `conditionBlocked` (trait), `reaction`, `fumbled`, `skipped`, `statusDamage`, `heal`, `statusEnded`.
- `src/game/battle/logic/status.ts`: pure lookups that give the data meaning: `statusEffects`, `statusWith`, `statMultiplier`, `effectiveSpeed`, `fumbleChance`, `isTrapped`, `traitEffects`, `immunityTo`, `typePower`, `conditionTurnBonus`.
- `src/game/battle/logic/rules.ts`: `computeDamage` takes `multiplier` (reaction × trait) and `ignoreDefense`. `hitChance(accuracy, accuracyMult, evasionMult)`. `statusHpLoss`.
- `src/game/battle/logic/engine.ts`: one context object per step (`Ctx`), which also tracks which sides have not moved yet. Move resolution order: skip → `useMove` → fumble → hit → reaction → damage → lingering → apply condition. End-of-turn status ticks run before `turnEnd`. Weather goes through `BattleSetup.weather`. `legalChoices(content, state, side)` drops switches while trapped.
- Tests: `src/game/battle/logic/conditions.test.ts` (50 tests, with its own small test pack of sure-hit moves).

## Decisions
- **Decision:** "3 turns" = 3 of the holder's own turns. A status put on a Zorling that already acted this turn is `fresh` and skips this turn's countdown and HP loss.
  - **Why:** without this, a slower applier gets one turn less out of every condition, and Frozen/Overload put on a Zorling that already moved would run out without doing anything. With it, Burning always ticks 3 times, and apply → switch → exploit works for either speed (tested).
  - **Alternatives considered:** count down at every end of turn (unfair to slow Zorlings, breaks skip effects). Count down when the holder acts (DoT would then depend on what it chooses).
- **Decision:** Re-applying a condition that is already ticking restarts it, keeps this turn's tick and adds one countdown.
  - **Why:** found by a test. Without this, a slower Zorling re-applying Burning every turn would mark it `fresh` each time, and the foe would stay Burning forever without taking any damage.
- **Decision:** Several different conditions can be on a Zorling at once. One hit sets off at most one reaction, from the oldest matching condition.
  - **Why:** chains (Steam Burst → the Water hit leaves Wet → Conducted next) are the fun of the system. One reaction per hit keeps it readable. Earth is the only type with two possible reactions (Shatter / Slam).
- **Decision:** Only moves with power set off reactions. Status moves only apply their condition.
  - **Why:** "a hit triggers a reaction" is easy to explain, and a reaction multiplier on 0 damage means nothing.
- **Decision:** Ignore DEF = the target's defense counts as at most the attacker's attack.
  - **Why:** it never lowers damage and it pays off most against tanks, which is what the reaction is for. It needs no new number.
  - **Alternatives considered:** defense = 1 (huge numbers), ignore only defense multipliers (barely noticeable).
- **Decision:** `skipTurn` makes the Zorling lose its move while it is active. Switching still works and clears it.
  - **Why:** switching clears statuses anyway, and a switch is not the frozen Zorling acting. It also gives the player a way out.
- **Decision:** Drains heal the applier side's Zorling on the field (if it is up). Weather has no source and heals no one.
- **Decision:** Weather conditions go on both first Zorlings, through `BattleSetup.weather: string[]` (condition ids). Which biome has which weather is region data for later (C19/C21).
- **Decision:** Status effects are looked up from content by id and are not copied into the state.
  - **Why:** the state stays small. Replays already need the same content.
- **Decision:** `legalChoices` now takes `content` (it needs it to know about trapping), like `step`.

## Deviations from plan / design
- `DESIGN.md` updated ("Conditions & reactions"): weather hits both sides, plus the C15 rules list above.
- None of the plan scope was left out.

## Issues & known limitations
- RNG draw order changed (fumble, apply rolls). Old seeds replay differently, which is fine because there are no saved battles yet.
- The condition roll happens even if the target is immune (roll first, then the trait check), so immunity does not shift later rolls.
- Effects are found by scanning statuses each time. That is cheap with ≤ ~5 statuses.
- Trapped Zorlings can still run from wild battles (DESIGN only says "can't switch").
- The opponent's choice still has to be given by the caller. AI is C16.

## Verification
- `npm run check`: typecheck, lint, format, 397 tests (35 files), all pass.
- Done when:
  - A test for every reaction in the table: ✅ (`it.each` over all 9: event, the condition is used up, exact damage against the engine's own roll. A guard test checks the table matches the pack.) Lingering effects tested one by one: Steam Burst accuracy for 2 turns, Rooted trap and growing drain, Frozen skip this turn, Overload skip next turn.
  - Edge cases: expiry ✅ (both timings, `statusEnded`), re-apply ✅ (refresh, no stacking, a refresh every turn still ticks), switch clear ✅ (own cleared, foe's kept, also lingering). Also covered: weather + immunity, Waterproof/Heatproof/Kindling/Lingering, side effects (Burning ×3, drain + heal, speed order, fumble rate, accuracy/evasion, Exposed), status moves do not react, oldest condition reacts, chains, dual-type self-combo, fainting from statuses (and a double KO goes to the player), determinism with JSON round trips.

## Follow-ups
- C16: `legalChoices(content, …)` is what the AI picks from. The trainer AI can read `content.reactionsOn(condition)` against foe statuses to find combos.
- C17: Armor goes into the damage step next to the reaction multiplier. Breaking it is a `reaction` event.
- C18: present the new events. Lingering after-effects show via `reaction` plus the content's `lingering`. `switchOut` implies the statuses are cleared (no separate event).
- C19/C21: map biome weather to condition ids for `BattleSetup.weather`.
- C31: tune durations and side-effect sizes. Maybe stop trapped Zorlings from running.

## Notes for the next chunk
- `legalChoices` signature is now `(content, state, side)`.
- RNG draw order per move: (speed tie at turn start) → fumble (only if Charged) → hit → damage (power > 0) → condition (apply chance > 0, target up).
- `conditions.test.ts` has a reusable test pack (`t:hit-x`, `t:hitapply-x`, `t:apply-x`, `t:poke`) and `withStatus` / `expectedDamage` helpers.
