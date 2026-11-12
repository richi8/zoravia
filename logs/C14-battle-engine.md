# C14 · Battle engine core — Log

- **Date:** 2026-11-12
- **Status:** done
- **Depends on:** C13

## Summary
A pure, deterministic 1v1 battle engine now lives in `src/game/battle/logic/`. `step(content, state, action)` returns a new state plus ordered events, and never changes its input. The battle state is plain JSON data that carries the RNG state, so a battle replays identically from a seed and the recorded actions, and continues identically after a save/load round trip. It covers turn order, damage, type effectiveness, accuracy, fainting, switching, free replacement after a faint, running, win/lose, HP write-back and XP for a win.

## What was built
- `state.ts`: `BattleState` (`kind wild | trainer`, `turn`, `phase choose | replace | ended`, `outcome win | lose | ran`, `runAttempts`, two `sides`, `rng`), `Combatant` (the entering `Zorling`, types, stats at battle start, current HP), `Choice` (`move` / `switch` / `run`), `BattleAction` (`turn` with both sides' choices, or `replace`), `BattleEvent` (`sendOut`, `turnStart`, `switchOut`, `useMove`, `miss`, `damage`, `fainted`, `runFailed`, `ran`, `turnEnd`, `replaceNeeded`, `end`). Helpers `activeOf`, `canFight`, `needsReplacement`, `foe`, `PLAYER`/`OPPONENT`.
- `rules.ts`: `computeDamage`, `hitChance`, `runChance`, constants `SAME_TYPE_BONUS` 1.25, `DAMAGE_ROLL_MIN` 0.85, `RUN_BASE_CHANCE` 0.5, `RUN_CHANCE_STEP` 0.25, `ACTION_RANK`.
- `engine.ts`: `createBattle(content, { kind, seed, player, opponent })` → `{ state, events }`, `step`, `legalChoices(state, side)`, `legalReplacements(state, side)`. Illegal actions throw.
- `result.ts`: `teamAfter(state, side)` (Zorlings with battle HP), `winXp`, `finishBattle(content, state, { badges })` → outcome, updated team, XP and each member's progression events (via `shareXp`).
- Tests: `src/game/battle/logic/battle.test.ts` (30 tests).

## Decisions
- **Decision:** One action per turn holds both sides' choices (`{ kind: 'turn', player, opponent }`); replacements after a faint are separate `replace` actions.
  - **Why:** the engine stays a plain reducer with no "waiting for the other side" state. The opponent's choice comes from AI (C16) or later a server/second player.
  - **Alternatives considered:** one action per side with a pending slot in state. More state, no gain.
- **Decision:** Order within a turn: run, then switches, then moves by Speed; ties are a coin flip from the battle RNG. No move priority.
  - **Why:** classic and readable. The schema has no priority field, and none is in DESIGN.md.
- **Decision:** Damage formula as in DESIGN.md "Combat", with a same-type bonus of ×1.25 and no critical hits.
  - **Why:** the familiar formula scales well with the C13 stat formula. The same-type bonus keeps each Zorling's own types worth using. Crits add swingy randomness the design does not ask for. Added to DESIGN.md.
- **Decision:** Run: always succeeds when at least as fast, else 50% + 25% per failed attempt. Player only, wild only.
  - **Why:** simple, never traps the player for long (guaranteed by the third try).
- **Decision:** XP is awarded once at the end of a win, as the sum over all opposing Zorlings.
  - **Why:** DESIGN.md says "the full XP of a win". Leveling mid-battle would change stats mid-fight and complicate the scene.
- **Decision:** If both sides are out at once, the player wins.
  - **Why:** only possible with C15 damage over time. Friendlier for a light-toned game.
- **Decision:** Stats are fixed at battle start inside `Combatant`. The battle never changes the `Zorling`; `teamAfter` / `finishBattle` write HP back.
  - **Why:** keeps the battle state self-contained and serializable.
- **Decision:** Code in `src/game/battle/logic/`, matching the existing ESLint purity rule.

## Deviations from plan / design
- `DESIGN.md` updated (Combat): turn order, damage formula and same-type bonus, run rule, XP of a win.
- Status moves (power 0) only roll to hit for now. Applying conditions (and `applyChance` on damaging moves) is C15.

## Issues & known limitations
- No condition, reaction, stat-modifier or trait effects yet (C15). `hitChance` and the speed comparison will need modifiers.
- Wild Zorlings cannot flee, and the opponent cannot run. Items and capture are C16.
- Numbers are untuned (C31). At equal level a 40-power hit takes roughly 1/5–1/6 of HP.
- `structuredClone` copies the whole state each step. Fine for 1v1 with ≤ 6 Zorlings.

## Verification
- `npm run check`: typecheck, lint, format, 347 tests (34 files), all pass.
- Done when:
  - Tests replay scripted battles with fixed seed → identical results: ✅ (3-vs-3 trainer battle played twice with the same seed gives the same state and event log; replaying the recorded actions gives the same end; JSON round trip continues identically; different seeds differ)
  - Also covered: turn order and tie-break, damage formula, effectiveness in events, accuracy rates, faint skips the move, win/lose, free replacement, switch costs the turn and happens first, run rules, illegal choices, input state never mutated (deep-frozen), HP write-back and shared XP.

## Follow-ups
- C15: conditions on `Combatant` (with turns left), end-of-turn effects before `turnEnd`, switching clears own conditions, stat modifiers in `hitChance`/speed/damage, weather conditions in `createBattle` events, traits.
- C16: `items` / `capture` choices (add to `Choice` and `ACTION_RANK`), AI picking from `legalChoices`.
- C17: boss aura and Armor in the damage step.
- C18: the scene feeds `BattleEvent`s into its presentation queue.

## Notes for the next chunk
- `import { createBattle, step, legalChoices, finishBattle, PLAYER, OPPONENT } from '@game/battle/logic'`.
- Move resolution lives in `useMove` in `engine.ts`. RNG draw order per move: hit roll, then damage roll. Adding draws changes replays of old seeds, which is fine (no saved battles yet).
- Every step clones the state into a `Draft` and mutates only that.
