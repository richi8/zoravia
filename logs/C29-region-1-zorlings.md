# C29 · Region 1 Zorlings & trainers — Log

- **Date:** 2026-11-13
- **Status:** done
- **Depends on:** C28, C13

## Summary
Verdale now has its own 23 Zorlings. They are three 3-stage starter lines (Sprigling, Drizzlet, Emberkit), wild 1- and 2-stage lines spread over all 8 types, two Titan species and the legendary Verdion. The roster also adds 12 moves and 6 traits. All 11 zones have new spawn tables. 11 route trainers stand along the roads, and the Mossback and Bogmaw Titans and Verdion wait in their lairs. Evolution stages now change shape and features, not just size, after a preview round with the user. `npm run check` passes, and the Dex, a route trainer and a Titan were checked in the browser.

## What was built
- **Evolution stages** (`src/game/zorlings/variants.ts`, `species-look.ts`):
  - **Babies**: rounder and paler, big eyes, fawn spots. No horns (nubs at most), back plates or wings unless the line always flies (avian, bat, insect, raptor). Plain tails.
  - **Middle stages**: the first adult features (one horn for antlers, spikes for plates/sails/crystals, the adult markings), still wingless.
  - `look.young` (species schema, validated against the line length) gives young stages another body plan. A dragon with `wings: 'none'` is now drawn wingless (`plans-wild.ts`); dragons never roll that, so no existing look changed.
  - Cries use the final form's body plan for the whole line (`cry.ts`), so a blob-shaped baby Emberkit still sounds like its line and higher than its final form.
- **Species** (`packs/core/species.ts`), in Dex order:
  - Starters: Sprigling → Fernwick → Thornmane (Nature; young as quadruped → feline, final dragon). Drizzlet → Brooklet → Tidefang (Water; blob → fish). Emberkit → Blazekit → Infernyx (Fire; blob → feline).
  - Wild 2-stage lines: Pipwing → Galehawk (Wind; puffball chick → bird). Sproutle → Thornwing (Nature/Wind dragon, keeps its shape). Puddlit → Torrentoad (Water; tadpole → toad). Mudpaddle → Bogmaw (Earth/Water; fish → serpent).
  - Single-stage: Voltbat, Hearthog (the wild Fire type), Ironshell, Mossback (rare, catch rate 0.7) and Rimewisp (Ice/Wind, T3).
  - Legendary: Verdion (Nature/Wind). Glacivar stays in core, last in the Dex (see Deviations).
  - The 9 former test species keep their stats and learnsets. They got descriptions, and two got `look.young`.
- **Moves** (`moves.ts`):
  - Strong hits: Timber Crush, Riptide, Blaze Rush, Cyclone, Quake, Blizzard.
  - Status moves: Updraft (Airborne), Mud Bath (Muddy), Corrode (Exposed).
  - Signatures: Ancient Root, Bog Surge, Verdant Gale.
- **Traits** (`traits.ts`): Overgrowth, Torrent, Tailwind (+20% type power); Grounded, Sure-footed, Frostproof (immune to Charged, Airborne, Chilled).
- **Bosses** (`bosses.ts`):
  - Mossback Titan: Lv 22, breaks on Wildfire.
  - Bogmaw Titan: Lv 17, breaks on Conducted.
  - Verdion: legendary, Lv 36, breaks on Shatter.
  - All three have aura HP ×2, rematches, and a hint in `description`.
- **Trainers and lairs** (`packs/core/verdale-trainers.ts`):
  - 11 route trainers, built from one table into trainer, dialogue and NPC entries: Nell, Dot and Brann in T1; Tess, Juno, Fen, Holt and Wren in T2; Sora, Ash and Lyra in T3. Each stands at a roadside tile in its zone, facing the road.
  - Prizes are about 30 coins per level of the trainer's strongest Zorling, paid once.
  - Each lair is a Zorling NPC on its anchor (`titan-hollow-oak`, `titan-sunken-hollow`, `legendary`) with "Face it / Step back", a rematch once beaten, and gone once caught.
- **Story condition** `{ boss, caught: true }` (`src/game/data/story.ts`, `story/conditions.ts`): true only once that boss is caught. Needed because `{ caught: species }` reads the Dex, so catching any wild Mossback would otherwise have removed the Titan.
- **Spawns** (`maps/verdale/overlay.json`, map rebuilt): new tables for all 11 zones. Base forms stop spawning before their evolution level, and evolved forms start after it (per-spawn `levels`).
- **Tests**:
  - `packs/core/verdale-roster.test.ts` (11):
    - Roster: stat bands, starters and types, everyone lives somewhere, all 8 types wild and weighted toward Nature/Water/Wind, spawn levels vs evolution.
    - Trainers: placed and in their tier band, and a same-level team usually wins.
    - Starter vs meadow sims, and boss sims (reactions vs brute force).
  - `data.test.ts`: `look.young` length check. `story.test.ts`: `boss … caught`. `animate.test.ts`: the new stage rules and young body plans.
  - Updated for the new order and looks: player (Dex order), species-look, audio (cries), core (2 legendaries).
  - **643 tests.**

## Decisions
- **Decision:** Promote 9 test species to real Verdale Zorlings instead of replacing them.
  - **Why:** about 300 test references across 20 files use them. Keeping their numbers keeps those tests meaningful, and they already fit Verdale (water toad, nature/wind dragon, electric bat, metal tank, fire kit).
  - **Alternatives considered:** a separate `test` pack under a `test:` namespace (a large rename of tests, save fixtures and the test region for no gameplay gain).
- **Decision:** Starters are Nature / Water / Fire (user approved). The Fire > Nature > Water > Fire triangle is readable. With Nature / Water / Wind, the Water starter would beat neither of the other two.
- **Decision:** Looks picked at a preview round (published page, scratchpad renders).
  - The user chose option C for every new line, with young body plans ("2") for ordinary lines and all starters. Dragons and other distinctive lines keep their shape.
  - Sproutle → Thornwing therefore uses the new stage rules only, and Emberkit and Puddlit got young plans.
- **Decision:** Boss aura ×2 HP for Verdale's bosses (`hpMultiplier`), plus lower levels (Bogmaw 20→17, Mossback 24→22, Verdion 38→36).
  - **Why:** at ×3, a team 2 levels above the boss won ≤ 13% in the simulator even playing reactions. These are bulky species: Mossback has 145 base Defense.
  - With ×2, the sims give:
    - Mossback: reactions 60% vs brute force 30%.
    - Bogmaw: reactions 95% vs brute force 65%.
- **Decision:** One voice per line: cries take the final form's body plan.
  - **Why:** young stages that are a blob or a fish would otherwise sound deeper than their adult, which breaks the C24 rule.

## Deviations from plan / design
- `DESIGN.md` updated:
  - The stage look rules and `look.young`.
  - Verdale's starters, Titans and legendary.
  - Titans may have less than ×3 HP, set per boss.
- **Glacivar stays in `core`**, last in the Dex (#24), described as the frozen coast's legendary. The preview page said it would become test-only, but it has about 50 references across tests and the test region. It moves with Region 3 (C35).
- Trainer line-of-sight (walking up to the player) is still not built: trainers battle when talked to.
- The C28 follow-up "shop stock by tier" was not done. Galecrest has no shop, and Fernhollow already sells Super Potions.

## Issues & known limitations
- **Verdion's reaction plan is weak in the sim:** reactions 13% vs 5 Super Potions 80% for a Lv 38 team. The test only requires reactions > brute force and 5 potions ≥ 60%. For C31: Verdion's speed and power vs the Chill → Earth setup.
- Bogmaw Titan brute force without potions still wins 65% at +2 levels: Electric vs Earth is weak, but the team is strong. Tune in C31.
- Starters are slightly weaker than wild 2-stage babies (300 vs 330 stat total). At Lv 6 vs a Lv 5 Sproutle, Drizzlet loses (type plus rounding at low levels). At Lv 7 every starter wins ≥ 60% against each meadow Zorling, which the test checks. Fine-tune with the start flow (C33) and C31.
- The Titan / legendary NPCs are drawn at overworld Zorling size (32 px), not bigger.
- Thornmane (Nature dragon) rolled a flame-tipped tail from its seed. That is the look the user picked, but it may read as Fire.

## Verification
- `npm run check`: typecheck, lint, format, **643 tests (59 files)** pass. `npm run world -- build` rebuilt Verdale with the new spawn tables.
- Preview rounds (scratchpad renders; the published page https://claude.ai/artifact/7r6YGva83zsoCnhrgXJe6b, 2 versions):
  - Round 1: the roster, 3 look options per new line, the starter proposal. The user OK'd the starters and asked for evolutions that change more than size.
  - Round 2: the new stage rules ("1") and young body plans ("2"). The user picked C2 except dragons and distinctive lines, and 2 for starters.
- Browser (headless Chrome, dev server, 960×540 at DPR 2):
  - Play: Verdale → new slot. `B` opens the Dex: 24 entries in the new order (001 Sprigling unseen, 007 Emberkit caught).
  - Picnicker Nell: talk → battle → "Aww. Time for a sandwich, then." +180 coins, `trainers` logged; talking again gives her after-line.
  - Bogmaw Titan at the Sunken Hollow: drawn as a Zorling NPC on the road, "Face it / Step back", boss battle with a Lv 17 Titan, Armor badge and Titan sprite.
  - No console errors.
- Done when:
  - All content validates: ✅ (`core.test.ts` loads the pack; references, line lengths and `look.young` are checked).
  - Dex shows them: ✅ (browser, 24 entries; `dexEntries` test).
  - Balance sim within stat bands: ✅ every species within 5% of its band (`core.test.ts` and `verdale-roster.test.ts`). Plus battle sims: starters vs the meadow, trainers vs a same-level team, Titans and Verdion vs reactions and brute force.

## Follow-ups
- **C30:**
  - Titan and legendary hints in NPC dialogue, the real trial and rival with Verdale teams (Rival Mira could use the starter that beats the player's).
  - Crown Rock's region boss.
  - The trainers' lines are placeholders with some flavor.
- **C31:**
  - Verdion's reaction plan.
  - The Bogmaw Titan's brute-force margin.
  - Starter vs early wild balance.
  - Trainer prizes vs potion prices.
  - Whether ×2 aura HP is right.
- **C32:**
  - Bigger overworld sprites for Titan / legendary NPCs.
  - Trainer line-of-sight.
  - Cries for Zorling NPCs (C27 follow-up).
- **C35:** move Glacivar (species, boss, Whiteout, theme, shrine) into the Region 3 pack.

## Notes for the next chunk
- Verdale trainers are defined in one table in `packs/core/verdale-trainers.ts`. Add a row and the trainer, dialogue and NPC are generated. Ids are `core:<id>`, and the dialogue id equals the trainer id.
- Boss lairs: dialogues `core:<boss>-lair`; NPCs vanish on `{ not: { boss, caught: true } }`.
- Species looks: only the final form has `look`. `look.young` lists plans for stage 1 (and 2). Stage rules live in `stageGenome`.
- Previews of looks: the scratch renderer pattern (render via `node tools/run.mjs <script.ts>` with `renderZorling`, then a PNG writer) worked well. Keep variant code out of `src/`.
