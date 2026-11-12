# C16 · Items, capture, AI — Log

- **Date:** 2026-11-12
- **Status:** done
- **Depends on:** C15

## Summary
The battle engine now takes items: potions heal any team member that has not fainted (cost the turn, taken from the bag), and a capture item thrown in a wild battle can catch the Zorling, which ends the battle with outcome `caught`. The bag is a small pure module with the 5-per-type potion cap. Two AIs pick choices from `legalChoices`: a wild AI (random move) and a trainer AI that scores damage, reactions and condition setup, and switches to a teammate that can exploit a condition on the foe. In 20 sample fights the trainer AI set off reactions in 17, all deterministic.

## What was built
- `src/game/inventory/bag.ts`: `Bag` (item id → count, JSON-safe), `bagCount`, `bagRoom`, `addToBag` (stops at `bagCap`, returns how many were added), `takeFromBag` (throws if short; drops empty entries), `EMPTY_BAG`.
- `src/game/data/species.ts`: optional `catchRate` (multiplier, default 1, max 3). Was a C12 follow-up.
- `src/game/battle/logic/state.ts`: `BattleState.bag` (the player's), `Choice` `{ kind: 'item', item, target? }`, outcome `caught`, events `itemUsed`, `capture { success, wobbles }`. The `heal` event now carries `slot` (potions can heal a benched Zorling).
- `src/game/battle/logic/rules.ts`: `captureChance`, `captureWobbles`, constants `CAPTURE_BASE` 0.1, `CAPTURE_HP_WEIGHT` 0.75, `CAPTURE_CONDITION_BONUS` 1.2, `CAPTURE_WOBBLES` 3, `DAMAGE_ROLL_MEAN`. `ACTION_RANK.item` = same rank as switching.
- `src/game/battle/logic/engine.ts`: `BattleSetup.bag`, item choices in `legalChoices` (player only), `useItem` / `throwCapture`, exported `sameChoice`.
- `src/game/battle/logic/result.ts`: `BattleResult.bag` and `BattleResult.caught` (the wild Zorling with its battle HP). A catch gives the XP of a win.
- `src/game/battle/logic/ai.ts`: `aiChoice(content, state, side, 'wild' | 'trainer')`, `aiReplacement(content, state, side)`, `moveValue` (exported for tuning/inspection), tuning constants `AI_*`.
- Tests: `src/game/inventory/bag.test.ts` (5), `src/game/battle/logic/items.test.ts` (12), `src/game/battle/logic/ai.test.ts` (12).

## Decisions
- **Decision:** Items are a `Choice` with the same rank as switching, resolved player first, before moves.
  - **Why:** "potion use costs the turn" like a switch. Healing before the foe's hit is the genre convention, and a catch must end the battle before the foe acts.
- **Decision:** Only the player has a bag (`BattleState.bag`). Opponents never use items.
  - **Why:** DESIGN.md only describes the player's economy. Trainer potions would make Titan/trainer fights longer without a design reason. Easy to add later as a per-side bag.
- **Decision:** A potion can target any team member that has not fainted and is not at full HP. No revives.
  - **Why:** matches the C10 bag UI ("use on" a team Zorling). Offering a potion at full HP only wastes a turn and an item, so `legalChoices` leaves it out.
- **Decision:** Capture chance = (0.1 + 0.75 × missing HP fraction) × strength × catch rate, ×1.2 with a condition. One RNG roll; wobbles show how close it was.
  - **Why:** easy to read ("weaken it first"), and the condition bonus ties capture to the battle's main system. ~10% at full HP keeps "throw at once" a gamble; ~85% at 1 HP (~100% with a condition) rewards care. One roll keeps the RNG order simple; the wobble count is for the C18 animation.
  - **Alternatives considered:** a per-species catch rate only (no HP factor): no reason to fight. The classic 4-shake formula: more numbers for the same feel.
- **Decision:** Catching gives the same XP as defeating it (outcome `caught`).
  - **Why:** otherwise catching is punished against fighting, and players would knock out Zorlings they wanted. DESIGN.md updated.
- **Decision:** The AI's randomness is `Rng.fromState(state.rng).split('ai:side:turn')`.
  - **Why:** the AI stays a pure function of the state with no RNG to carry around, it does not advance the battle RNG (engine rolls are unaffected), and the split stream is unrelated to the engine's next rolls, so the AI cannot "see" whether its move will hit.
- **Decision:** Trainer AI = one-ply scoring. A move's value (in foe max-HP fractions) = expected damage including the reaction it would set off, +0.5 for a likely KO, +0.15 for a reaction with a lingering effect, + apply chance × 0.3 for a condition the team can exploit (0.08 if nobody can, 0 if already there or blocked), all × chance to land. A switch = the teammate's best value against the foe's conditions that survive this turn × 0.7, and must beat the best move by 0.1 (no margin when the active Zorling will lose its move, e.g. Frozen). Small noise (≤ 0.03) breaks ties.
  - **Why:** it finds both kinds of combos in the design — self-combos (Drench → Static Bite) and "apply → switch → exploit" — without lookahead, and the numbers are few and named for C31.
  - **Alternatives considered:** minimax / lookahead: much more code and harder to tune; the design wants readable trainers, not optimal ones.
- **Decision:** Wild AI picks a uniformly random move.
  - **Why:** "simple" per the plan; wild Zorlings still apply conditions by chance, and dual types can still self-combo by luck (DESIGN.md: "rare, dangerous").

## Deviations from plan / design
- `DESIGN.md` updated (Combat): items in turn order, potion targets, capture formula, XP for a catch, opponents use no items, short AI description.
- The `heal` event gained a `slot` field (needed for potions on the bench).

## Issues & known limitations
- The trainer AI ignores what the player might do (no threat assessment, no fleeing bad matchups unless a teammate scores clearly better). Good enough for region 1 trainers; C31 may want difficulty tiers.
- The AI never uses items, and the player-side bag is the only bag.
- Subdued (guaranteed capture) is C17; `throwCapture` is where it goes.
- Capture with a full team (to storage) is the caller's job: `finishBattle` returns `caught`, C22/C23 place it.
- The capture-rate tests use 2000 seeds; they take ~0.1 s.

## Verification
- `npm run check`: typecheck, lint, format, 426 tests (38 files), all pass.
- Done when:
  - Tests for item rules: ✅ bag cap 5 per type and per tier, no cap for Zorbs, taking/empty stacks; in battle: potion choices only for hurt, unfainted members; heal before the faster foe's move; costs the turn; never above max; Max Potion; bench target; illegal items throw; bag returned by `finishBattle`. Capture: formula values, wobbles, catch ends the battle and costs the Zorb, failed throw costs the turn, rates over 2000 seeds match 10% / 5% (catch rate 0.5) / ×1.2 with a condition, deterministic, catch gives XP.
  - Simulated trainer AI performs at least one combo in sample fights: ✅ 20 AI-vs-random 3v3 trainer fights (Puddlit/Voltbat/Sproutle vs Emberkit/Ironshell/Thornwing, Lv 25): reactions on the player in 17 of 20, 6 of them in fights where the trainer also switched. The trainer AI wins 27 of 30 mirror matches against random moves. Unit tests also check: picks the effective move, picks the reacting move on a Wet foe, sets up Wet only when the team can exploit it, switches in Voltbat on a Wet foe (not when Wet ends this turn), switches out when Frozen, best replacement, only legal choices, never changes the state.

## Follow-ups
- C17: Subdued → guaranteed capture in `throwCapture`; the AI should value breaking Armor (it already likes reactions).
- C18: present `itemUsed`, `heal` (with slot), `capture` (wobbles); use `aiChoice` / `aiReplacement` for the opponent.
- C21/C29: per-trainer AI style or difficulty, maybe trainer potions.
- C22: catches with a full team go to storage; shop uses `addToBag` and its `added` count.
- C31: tune capture numbers, `catchRate` per species, and the `AI_*` weights.

## Notes for the next chunk
- `createBattle(content, { …, bag })`; `finishBattle(...)` returns `bag` and `caught`.
- Opponent turn: `aiChoice(content, state, OPPONENT, kind === 'wild' ? 'wild' : 'trainer')`; after a faint: `aiReplacement(content, state, OPPONENT)`.
- RNG draws per turn: (speed tie) → capture roll (only on a throw) → per move as in C15. The AI draws nothing from the battle RNG.
