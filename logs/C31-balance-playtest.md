# C31 · Balance & playtest pass — Log

- **Date:** 2026-11-13
- **Status:** done
- **Depends on:** C30

## Summary
Verdale now has an automated playthrough simulator and a balance report (`npm run balance`). An AI player plays the whole campaign from a new game with real XP, money, shops and battles, retrying after a loss. Running it found and fixed several problems:
- One rule bug: fainted Zorlings got no XP, so the lead fell 5–7 levels behind.
- Three walls: Warden Elm, Scout Fen, and a 75-battle grind before Mira in Galecrest.
- A hint that didn't work: Verdion's plan (Chill, then Earth) lost to plain potions.
- Money with nothing to buy late in the region.

After tuning, every team plan finishes the campaign in about 3–4 hours (118–142 wild battles), and no fight takes more than 9 tries in 60 runs. The playthrough runs in CI.

## What was built
- **Playthrough simulator** (`tools/balance/playthrough.ts`): an AI player for a region's story.
  - Starts with one starter, catches two planned wild Zorlings and grinds the zones reached so far (real spawn tables via `pickSpawn`). It picks the toughest zone whose weakest wilds are not above the team.
  - Evolves whenever offered. Learns a new move over its weakest move when the new one is better.
  - Before every story fight it buys potions up to 5 carried, upgrading to a better tier only while the rest can still be the tier below. It drinks one below 35% HP.
  - Fights each story trainer and boss through the real engine (`trainerBattle` / `bossBattle`, `finishBattle`, `applyBattleResult`). Badges are awarded. A Subdued boss is caught with a Zorb.
  - Fights once the team's mean level is at most 1 below the fight's top level. After a loss it fights 3 more wild battles and retries.
  - **Follows hints**: after 3 losses to a boss (a wild boss, or a trainer's boss-form member), it catches the highest-level wild Zorling of a type the Armor-breaking reaction needs that the team lacks. It uses it for that fight, then swaps its regular member back.
  - Logs, per fight: tries, team levels, wild battles and losses since the previous fight, potions bought and used, money, prize, and estimated minutes (6 s per turn, 20 s per battle).
  - Pure and deterministic per seed. About 100 ms per full playthrough.
- **Verdale route** (`tools/balance/verdale.ts`): 9 stages with the zones each opens, the shops (Fernhollow adds Super and Max Potions), and the 20 story fights in order. Team plans: each starter plus two catches (Sprigling + Pipwing + Puddlit, Drizzlet + Sproutle + Pipwing, Emberkit + Sproutle + Mudpaddle). The start is one Lv 6 starter, 2 Potions, 5 Zorbs and 500 coins.
- **Report** (`tools/balance/report.ts`, `cli.ts`, `npm run balance [-- --seeds N --out file]`) has these tables:
  - Summary per team plan.
  - Every story fight.
  - Every stage.
  - Money.
  - Story trainers by team level (each plan at −1 / ±0 / +2 levels, no potions).
  - Bosses by play style (reactions / brute / brute with 5 Super Potions) and level gap.
  - Each starter alone against the first zone.
- **Tests**:
  - `tools/balance/playthrough.test.ts` (5 tests): each team plan finishes over 3 seeds in 80–200 wild battles and under 5 hours. No fight needs more than 60 wild battles before it or more than 10 tries, and every level stays below the one-badge cap. The first fight comes without grinding. Runs are deterministic.
  - `verdale-roster.test.ts`: Verdion now has to pass the same rule as the Titans (reactions ≥ 50%, brute force at least 25 points lower). The starter test now checks a Lv 6 starter against the meadow's real spawn table and level range. It used to say Lv 6 but tested Lv 7.
  - **657 tests total.**

## Changes from tuning

| What | Before | After | Why |
|---|---|---|---|
| Shared XP | members that have not fainted | **every member**, fainted ones too | The lead faints most, so it fell 5–7 levels behind its teammates (Drizzlet plan: 21/28/26 at Scout Fen). |
| Warden Elm | Voltbat 13, Mudpaddle 14, **Thornwing 15** | Voltbat 12, Mudpaddle 13, **Sproutle 15** (same teaching moves) | Thornwing evolves at 20. At 15 it is effectively 5+ levels stronger. Won on the first try 7% of the time; now 82%. |
| Rival Mira (Fernhollow) | Blazekit 12, Pipwing 12, Ironshell 11 | **Emberkit** 11, Pipwing 11, Ironshell 10 (+4 with the badge) | Blazekit below its evolution level. First try 47% → 67%. |
| Rival Mira (sandbox team) | Galehawk 17 | Galehawk 18 | Its natural evolution level. |
| Rival Mira (Galecrest) | 30 / 30 / 31 (+4 → 34–35) | 26 / 26 / 27 (+4 → 30–31) | 75 wild battles of grinding right after the Titans; now 31. She opens T3 instead of walling it. |
| Scout Fen | Ironshell 21, Hearthog 22, Thornwing 21; 660 | 18 / 19 / 20; 600 | Three final forms. First try 23% → 70%. |
| Verdion's Armor | breaks on **Shatter** (Chill, then Earth) | breaks on **Overload** (Electric, then Metal) | Nature resists Earth, and Verdion's Nature hits do ×2.25 to the Earth/Water Bogmaw the plan needed. Reactions 15% vs 5 Super Potions 80%. Now reactions 98% vs brute 5% at +2. Voltbat and Ironshell both resist Verdion's types. |
| Druid Ash's hint | "Chill it first, then strike with Earth." | "Charge it with Electric first, then strike with Metal. Its wind and leaves glance off iron." | Matches the new break. |
| Meadow levels | 3–7 | 3–6 | A lone Lv 5–6 starter lost often to type-advantaged Lv 7 wilds (Drizzlet: 8.8 losses before its first fight). |
| Downs levels | 21–27 | 23–29 | Bridges T2 into T3 (all its spawns are final forms). |
| Fernhollow shop | Potion, Super Potion, Zorb | + **Max Potion** (900) | T3 money piled up (4 000–7 000) with nothing to buy. |

## Balance report (20 seeds per team plan, after tuning)

Before tuning (10 seeds, first run): 174–223 wild battles, 10–27 story losses per run, 3.5–5.7 hours. Elm 7% first try (5.3 tries), Fen 23% (6.4 tries), 75 wild battles before Mira in Galecrest, Verdion 57% (3.8 tries, 12.5 potions).

### Summary

| Team plan | Finished | Wild battles | Wild losses | Story losses | Hours (est.) |
| --- | --- | --- | --- | --- | --- |
| sprigling | 100% | 142 | 11.5 | 6.1 | 3.4 |
| drizzlet | 100% | 132 | 10.8 | 7.2 | 3.7 |
| emberkit | 100% | 118 | 3.9 | 4.8 | 3.0 |

### Story fights

| Fight | Foe Lv | Team Lv | Wild before | Won 1st try | Tries | Potions used | Hint followed | Money after |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| picnicker-nell | 6 | 6.5 | 2 | 100% | 1.0 | 2.5 |  | 380 |
| mira-willowmere | 7 | 7.7 | 1 | 100% | 1.0 | 1.8 |  | 360 |
| fisher-dot | 8 | 8.7 | 0 | 100% | 1.0 | 1.1 |  | 400 |
| hiker-brann | 11 | 11.3 | 4 | 85% | 1.3 | 4.4 |  | 358 |
| apprentice-linden | 12 | 12.3 | 0 | 95% | 1.1 | 3.6 |  | 409 |
| warden-elm | 15 | 15.0 | 6 | 82% | 1.3 | 4.6 |  | 1061 |
| mira-fernhollow | 15 | 16.0 | 0 | 67% | 1.7 | 5.9 |  | 810 |
| marsh-guide-tess | 19 | 19.0 | 12 | 98% | 1.1 | 3.8 |  | 665 |
| bogmaw-titan | 17 | 19.0 | 0 | 100% | 1.0 | 2.7 |  | 113 |
| forager-juno | 20 | 20.0 | 0 | 98% | 1.0 | 1.5 |  | 643 |
| scout-fen | 20 | 20.7 | 0 | 70% | 1.5 | 5.8 |  | 698 |
| ranger-holt | 24 | 23.3 | 10 | 90% | 1.2 | 4.1 |  | 818 |
| birder-wren | 25 | 24.3 | 1 | 80% | 1.5 | 5.9 |  | 828 |
| mossback-titan | 22 | 25.0 | 0 | 87% | 1.3 | 4.2 | 5% | 97 |
| mira-galecrest | 31 | 30.0 | 31 | 85% | 1.8 | 6.0 |  | 1552 |
| mystic-sora | 34 | 33.0 | 15 | 97% | 1.0 | 2.3 |  | 1177 |
| druid-ash | 36 | 35.0 | 10 | 90% | 1.4 | 5.5 |  | 1370 |
| ace-lyra | 40 | 39.0 | 27 | 100% | 1.0 | 3.9 |  | 1458 |
| stormcatcher-vex | 38 | 40.0 | 0 | 83% | 1.8 | 6.8 | 12% | 2591 |
| verdion | 36 | 40.0 | 0 | 77% | 2.1 | 7.7 | 23% | 296 |

### Stages

| Stage | Wild battles | Wild losses | Minutes | Prize money | Potions bought |
| --- | --- | --- | --- | --- | --- |
| Willowmere meadow | 2 | 0.5 | 3 | 180 | 3.1 |
| Lakeshore & north road | 1 | 0.0 | 4 | 540 | 4.0 |
| Brookside Trail | 4 | 0.8 | 9 | 300 | 4.2 |
| Grove Trial | 7 | 0.1 | 18 | 2060 | 13.8 |
| Marsh, Fernwood, Bramble | 15 | 7.0 | 37 | 1770 | 13.8 |
| Deepwood & Downs | 12 | 0.2 | 23 | 1470 | 16.3 |
| Galecrest | 31 | 0.1 | 29 | 1300 | 6.6 |
| Mistmere, Old Grove, Galeback | 52 | 0.0 | 59 | 5700 | 21.8 |
| Heartwood Shrine | 0 | 0.0 | 3 | 0 | 7.5 |

### Money (median per run)

| Wild prizes | Story prizes | Spent (potions, Zorbs) | Left at the end |
| --- | --- | --- | --- |
| 6952 | 13320 | 20460 | 296 |

- **Economy reading:** before each T2 Titan the player spends nearly everything (about 100 coins left after each): two T2 trainers (about 1 300) buy 4 Super Potions. That matches DESIGN's "brute-forcing a Titan ≈ 4–5 good potions ≈ one route of trainer income". In T3, Max Potions now take the surplus. Quest rewards are on top (the main quest's 3 000 coins come after the last fight). Prices and the wild prize formula are kept.

### Bosses (wild battle, Zorb ready; the C29 reaction teams)

| Boss | Gap | reactions | brute | brute + 5 Super |
| --- | --- | --- | --- | --- |
| Bogmaw Titan Lv 17 | +0 / +2 / +4 | 18% / 85% / 98% | 0% / 25% / 48% | 40% / 100% / 100% |
| Mossback Titan Lv 22 | +0 / +2 / +4 | 25% / 60% / 75% | 10% / 28% / 48% | 23% / 50% / 50% |
| Verdion Lv 36 | +0 / +2 / +4 | 93% / 98% / 100% | 0% / 5% / 50% | 8% / 100% / 100% |

The ×2 aura is kept: reactions clearly beat brute force for all three, and 5 Super Potions make brute force doable without making it sure.

### Story trainers by team level (no potions) and the first battles
The full tables are in `npm run balance`. Their main points:
- Most trainers go from a coin flip at ±0 to 85–100% at +2.
- Rival Mira at Fernhollow beats a Sprigling team even at +2 (40%), because her Emberkit counters it. C33 will give her the counter starter for every player.
- Vex without potions is 0–18% at ±0 and 5–43% at +2. With potions and the hint, the playthrough wins her first try 83% of the time.
- A lone Lv 6 starter wins 55–100% against each meadow Zorling at the meadow's top level. Sprigling vs Pipwing (Wind > Nature) and Drizzlet vs Sproutle (Nature > Water) are the hard ones.

## Decisions
- **Decision:** The simulator is a *player*, not a scripted level schedule. It grinds, fights, loses and retries, and money only comes from wins.
  - **Why:** the C30 campaign test used `train()` to teleport levels, which can't show pacing. Here, the number of wild battles between fights, losses and money are all outputs.
  - **Alternatives considered:** a level-curve table (XP needed vs XP available per zone). It is simpler but ignores losses, type matchups and the economy.
- **Decision:** The simulated player follows boss hints after 3 losses.
  - **Why:** without it, a team with no answer to a boss (Sprigling's Nature/Wind/Water against Verdion, or a team without Earth against Vex's Galehawk) retried 10–25 times or never finished. That measured stubbornness, not balance. Real players read the hints, which name the types. The swap is undone after the fight.
- **Decision:** Fainted members get shared XP (DESIGN updated).
  - **Why:** see the table. It removes a spiral that punishes the lead, and it is friendlier. Battle text already shows each member's XP line.
  - **Alternatives considered:** half XP for fainted members (still a spiral, just slower), or leaving it to the player to reorder the team (the sim can't judge that, and new players won't).
- **Decision:** Verdion's Armor breaks on Overload instead of Shatter (DESIGN updated).
  - **Why:** see the table. Overload was unused in Verdale, and its two types are both catchable there (Voltbat everywhere; Ironshell in the Bramble, Old Grove and Galeback, and in the Ringing Shells side quest).
  - **Alternatives considered:** a lower aura (×1.75). It made brute force with potions trivial and kept the bad plan. Verdion at Lv 38: the plan team still won 90% at ±0, while teams without the plan were stranded (Sprigling plans finished only 80% of runs). The level is not the lever; the plan is.
- **Decision:** Trainer teams use the stage a wild Zorling has at that level (no final forms below their evolution level). The exception is a rival's ace (Mira's Infernyx at 31; Emberkit's line evolves at 34), which is the point of that fight.
  - **Why:** the trainer sweep showed that final forms below their evolution level, not raw levels, made the walls.
- **Decision:** The assumed start is one Lv 6 starter, and the meadow tops out at Lv 6.
  - **Why:** the start flow is C33's, but the first zone's levels belong to balance. At Lv 5 against a 3–7 meadow, the Water starter lost about 9 battles before its first fight.

## Deviations from plan / design
- `DESIGN.md` updated:
  - Shared XP includes fainted members.
  - Verdion breaks on Overload.
  - Level caps kept, with the playthrough's end level.
  - A new **Pacing** rule: about 120–145 wild battles and 3–4 hours per region campaign, trainers use natural stages, and the assumed Lv 6 start.
  - Economy prices kept, Max Potions sold in Fernhollow, and the income totals.
- Deliverable "level curve tuning": the XP curve (cubic), XP yield (/7) and the trainer XP ×1.5 are unchanged. The curve was fine; the problems were content levels and the fainted-XP rule.
- Deliverable "bug fixes": the simulator ran 60 full campaigns plus thousands of extra battles through the engine with no battle that failed to end, no exception and no invalid state. The only bug found was the XP spiral, a rule bug.
- The plan's "full playthrough by AI-driven test" is the playthrough test. A manual checklist wasn't needed.

## Issues & known limitations
- **Time estimates are guesses** (6 s per turn, 20 s per battle, no walking between towns, no menus, no side quests). Real play will be longer. Battle speed (C33) changes them.
- The simulated player keeps the same team for the whole region. It never swaps in better wild Zorlings or Titans it caught. Real players will usually be stronger than the sim (and the sim's teams are type-unbalanced on purpose: each starter plus two early catches).
- Wild losses in the Marsh / Fernwood / Bramble stage (about 7 per run): Thornwings (Lv 20–23) roam beside a Lv ~19 team. Encounters are visible, so players can avoid them. The sim doesn't.
- The Mossback with 5 Super Potions only reaches 50% even at +4. Brute force with potions is weaker here than for the other bosses, because its Armor makes most hits ×0.4. It fits "doable sometimes, not always".
- Region boss Vex is the hardest fight per try for teams without Earth and with Wind/Nature types (Drizzlet plan: 0–5% without potions). With potions and the hint it is fine, but a struggle for those teams.
- The meadow change rebuilt `map.json` (zone levels only).
- Not checked by hand in the browser: battle feel at the new levels (G2 is the place for that).

## Verification
- `npm run check`: typecheck, lint, format, **657 tests (61 files)**, all pass.
- `npm run balance -- --seeds 20`: the report above.
- Browser (headless Chrome over CDP, dev server, 960×540 at DPR 2, keyboard plus the dev handle for teleports):
  - Play: Verdale → new slot. At Fernhollow's shop door, `E` opens the Fernhollow Shop with Potion 100, Super Potion 300, **Max Potion 900** and Zorb 60 (screenshot checked).
  - Druid Ash, once beaten, says "Verdion dwells at the shrine. Charge it with Electric first, …" (screenshot checked).
  - No console errors.
- Done when:
  - Balance report in the log: ✅ (above).
  - Full playthrough by AI-driven test: ✅ `tools/balance/playthrough.test.ts`. Each team plan plays the whole campaign from a new game through the real engine with real progression and money, in CI.

## Follow-ups
- **G2 (fun gate):** play Region 1 with these numbers. Watch especially:
  - The grind before Mira in Galecrest (~30 wild battles).
  - T3 before Ace Lyra (~27).
  - Whether giving fainted members XP feels right.
- **C32:** item pickup sparkle (C30). The sim's minute estimates can be replaced with measured battle times once the battle speed setting exists.
- **C33:**
  - The start flow: one starter at **Lv 6** (assumed here; `VERDALE_START` in `tools/balance/verdale.ts` must follow the real start).
  - Mira picks the starter that beats the player's.
  - Battle speed changes the time estimates.
- **C34/C35:** add a route file and team plans per new region (`tools/balance/<region>.ts`), and keep `playthrough.test.ts` green for each. Regions 2 and 3 start at other levels for sandbox starts; the sim's start then needs a badge count and levels.
- **Later:** a smarter simulated player (swaps in caught Zorlings, avoids strong visible wilds, does side quests for money), if the report needs it.

## Notes for the next chunk
- `npm run balance` takes about 3 s at 10 seeds and 8 s at 20. Run it after any change to species, moves, trainers, bosses, zones or prices.
- A new story fight goes into `VERDALE_ROUTE` (`tools/balance/verdale.ts`) where a player meets it. Use `badge` on a goal that awards one.
- Watch the "Won 1st try" and "Wild before" columns. A trainer sweep row at 0% / 0% / 100% means the team has final forms below their evolution level.
