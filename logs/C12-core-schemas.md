# C12 · Core schemas & core pack v0 — Log

- **Date:** 2026-11-12
- **Status:** done
- **Depends on:** C03

## Summary
All rules content now has a typed, validated home. `src/game/data/` declares seven registries: types, conditions, reactions, moves, traits, species and items. `GameContent` loads them and offers shared lookups (effectiveness, reaction for a condition and move type, evolution line). `packs/core` holds the 8 types with the full chart, the 8 conditions, all 9 reactions, 20 moves, 4 traits, 10 test species, 3 potion tiers and the Zorb capture item. The C03 follow-up is done: references between entries are checked after loading, with pack and path in the error.

## What was built
- Engine, `src/engine/packs/registry.ts` + `loader.ts`: `defineRegistry(kind, schema, { refs, check })`. These run once after all packs have loaded, so later patches count. Unknown refs say `Unknown moves "x:zap". Did you mean "a:zap"?`. Issues are attributed to the pack and path that last set the entry (`patches.species.core:glacivar.legendary`).
- `src/game/data/`:
  - `common.ts`: shared pieces, stat ids (`hp attack defense speed`), the `statusEffectSchema` vocabulary (`hpLoss` with growth/drain, `stat` multiplier, `fumble`, `trapped`, `skipTurn`).
  - `types.ts`: `strongAgainst`, `resists`, `applies` (condition). ×1.5 / ×0.67 constants.
  - `conditions.ts`: name, description, `turns` (default 3), side effects.
  - `reactions.ts`: condition + move type → `damageMultiplier`, `ignoreDefense`, optional `lingering` effects. Only one reaction per (condition, type).
  - `moves.ts`: type, power (0 = status move, which must then apply its condition), accuracy %, `applyChance` for the type's condition.
  - `traits.ts`: effects `conditionImmunity`, `typePower`, `conditionTurns`.
  - `species.ts`: 1–2 types, base stats, optional trait, ordered learnset, level evolution, `legendary`. Checks: at most one pre-evolution, levels rise along a line, ≤ 3 stages, no loops, legendaries never evolve, no duplicate moves or types. Also `statTotal` and `statBand(stage, stages, legendary)`.
  - `items.ts`: category `potion | capture`, price, `bagCap`, effect `heal` (amount or `full`) / `capture`.
  - `content.ts`: `GAME_REGISTRIES`, `loadGameContent(packs)`, `GameContent` (`effectiveness`, `reactionFor`, `reactionsOn`, `conditionOf`, `evolutionLine`).
- `packs/core/` (`index.ts` exports `corePack`): one file per registry. Typed with `satisfies Record<string, XInput>`, so authoring errors show up in the editor too.
- Tests: `packs/core/core.test.ts` checks the full 8×8 chart, conditions, every reaction and its specials against tables typed straight from DESIGN.md, plus stat bands within 5%, line shapes and items. `src/game/data/data.test.ts` covers mod-pack validation errors and patching. `loader.test.ts` gets 3 tests for refs/check.

## Decisions
- **Decision:** "A > B" also means B resists A (B's moves deal ×0.67 to A). Dual types multiply.
  - **Why:** DESIGN.md only said "×1.5 strong / ×0.67 weak". The C10 mock tooltips the user reviewed already used this reading. Metal's explicit resist list fits it too.
  - **Alternatives considered:** ×0.67 only from Metal's list. That would leave the 0.67 mostly unused.
- **Decision:** Each type lists `resists` explicitly instead of deriving it from other types' `strongAgainst`.
  - **Why:** a type's entry then fully describes it, the rule has no hidden part, and the core test checks it against DESIGN.md.
- **Decision:** 4 stats: HP, Attack, Defense, Speed. No physical/special split.
  - **Why:** "simple, readable combat". DESIGN.md only ever names HP/DEF/SPD and attack. Added to DESIGN.md.
- **Decision:** The condition a move applies comes from its type (`type.applies`). A move only says how likely it is (`applyChance`).
  - **Why:** DESIGN.md says each type applies one condition. Keeps a single source of truth.
- **Decision:** Conditions and reaction after-effects share one small effect vocabulary (`statusEffectSchema`).
  - **Why:** Rooted, Frozen, Overload's stun and Steam Burst's accuracy drop are all "an effect for N turns". Modders can combine effects without engine changes. C15 implements their meaning.
- **Decision:** Cross-entry validation is a generic engine feature (`refs` / `check` on registries), not a game-only pass.
  - **Why:** errors come out as normal `PackIssue`s with pack and path, and every future registry gets it for free.
- **Decision:** Stat bands are a test-time guide (5% tolerance), not a load error.
  - **Why:** DESIGN.md calls them "~". Titans, mods and balance tuning need room.
- **Decision:** Capture item named **Zorb**. Potions: Potion 30 HP / 100, Super Potion 80 HP / 300, Max Potion full / 900; Zorb 60.
  - **Why:** placeholder starting values; C31 tunes the economy.

## Deviations from plan / design
- `DESIGN.md` updated: how effectiveness works, the 4 stats, and a note that condition side-effect sizes live in `packs/core` (Burning 1/16 HP, Wet speed ×0.85, Overgrown 1/24 drain, Charged 10% fumble, Chilled speed ×0.7, Muddy accuracy ×0.85, Airborne evasion ×0.85, Exposed defense ×0.75).
- Reaction details DESIGN.md left open, now set as data: Steam Burst lowers accuracy ×0.8 for 2 turns. Rooted = trapped + drain 1/16 growing by 1/32 per turn for 3 turns. Frozen and Overload = skip the next turn.

## Issues & known limitations
- Type and condition colors and labels still live in `src/game/style/tokens.ts` as fixed unions (`TypeId`). A pack-added type would have no color yet. The core test checks that both lists agree.
- The C10 lab mock (`src/lab/battle-mock/data.ts`) still has its own copy of the chart and conditions. It is left alone (lab art is frozen), but it could read `GameContent` now.
- Species have no look (genome seed/plan), XP yield or catch rate yet.
- Patches are still shallow, so changing one learnset entry replaces the whole learnset.

## Verification
- `npm run check`: typecheck, lint, format, 293 tests (32 files), all pass.
- Done when:
  - Core pack loads and validates: ✅ (`core.test.ts` "loads and validates"; `data.test.ts` loads core + mod packs)
  - Tests cover the type chart from DESIGN.md: ✅ (all 64 pairs vs an independent table, plus dual types)
  - Tests cover the reaction table from DESIGN.md: ✅ (each type's condition, all 9 reactions with name and multiplier, none extra, specials)

## Follow-ups
- C13: stat formula over `baseStats`, XP curve. Species may need `xpYield`. Learnset level-1 moves can exceed 3 slots (Glacivar has exactly 3).
- C15: give `statusEffectSchema` and trait effects their meaning in battle.
- C16: catch rate per species (or a fixed rule) for the Zorb `strength`.
- C18/C29: a species `look` field (genome seed, body plan, mood) so species render consistently.
- Later: move type/condition colors into pack data so new types can come from packs. Point the lab mock at `GameContent`.

## Notes for the next chunk
- `import { loadGameContent } from '@game/data'; import { corePack } from '@packs/core'; const content = loadGameContent([corePack]);`
- All refs are full ids (`'core:ember'`). Entries are frozen and carry `id`.
- `content.effectiveness(moveType, defender.types)`, `content.reactionFor(conditionId, moveType)`, `content.conditionOf(typeId)`, `content.evolutionLine(speciesId)` → `{ members, stage }`.
- New cross-entry rules go in a registry's `check`. It gets `ctx.get(kind, id)` / `ctx.values(kind)`.
