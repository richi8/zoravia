# C42 · A Dex you can finish — Log

- **Date:** 2026-11-18
- **Status:** done
- **Depends on:** C41

## Summary
You can now catch every Zorling in one save. A zone spawn can carry a story condition. Once the player holds a region's badge, all three of its starters spawn in that region's T1 zones at about 10%. The hub town's kid hints at them. The Dex has tabs (All, then one per region), each with its own "Seen · Caught / total". A seen species lists the zones where the player found it. A test over every shipped pack checks that each species can be obtained. Balance is unchanged.

## What was built
- **Conditional spawns:** `src/game/data/maps.ts`: a spawn takes an optional `if` (a story condition), and its references are checked like any other condition's. `src/game/world/overworld/sim.ts`: `openSpawns(zone, test)` gives the spawns that can appear now, `pickSpawn` takes the test, and `OverworldSim.spawnsWhen(test)` sets it. Until it is set, spawns with a condition never appear. A zone counts toward the roamer target only when it has an open spawn. `overworld-scene.ts` passes `holds` against the live party.
- The same rule in the map window's zone lists (`atlasRegion`), the balance simulator (`playthrough.ts`: catching, grinding, the hint catch) and the first-zone table of the balance report.
- **Starter spawns** (the overlays, with `map.json` rebuilt):

  | Region (badge) | Zone: starter |
  | --- | --- |
  | Verdale (Grove) | Sunny Meadow: Sprigling · Willow Shore: Drizzlet · Brookside Trail: Emberkit |
  | Emberwaste (Kiln) | Sunbaked Flats: Sizzlet · Dustway: Pricklet · Redrock Trail: Pebbit |
  | Rimeholm (Tide) | Shingle Shore: Selkit · Hoarfrost Heath: Woolump · Driftwood Strand: Sparkit |

  Each spawn is the first stage at the zone's levels, with a weight of 9.7–11.1% of the zone's table.
- **Rumours:** Tam (Willowmere), Juna (Cinderwell) and Little Kari (Brinewick) say two new pages first once the badge is held, unless their own quest is under way. Each region's story file has a small `withRumour` wrapper. The pages describe the starters (from their Dex entries) and name their zones. There is no marker and no quest.
- **Dex:** `dexPages` (`src/game/player/dex.ts`) gives All, then one page per start region with its pack's species (core = Verdale), each page with its counts. `speciesHabitats` (`src/game/world/atlas.ts`) lists, for each seen species, the entered zones whose open spawns include it, across all regions. `src/game/ui/dex-panel.ts` shows the tabs in the header (the one showing is underlined; clicking one opens it). `Z`/`Tab` (the `zoom` action) goes to the next tab, and each tab keeps its own cursor. The counts moved to the bottom right, next to the key hints. "Found in" plus the zones show under the description, trimmed to "…, and N more" when they don't fit.
- **Tests:** `packs/dex.test.ts` checks completability over `SHIPPED_PACKS` (wild spawns whose condition only needs a badge the story gives, boss captures from NPCs on world maps, then evolutions). It also checks that every start region's starters are wild and that the kids' rumours appear only after the badge. Sim tests check that `openSpawns`/`pickSpawn` leave out a gated spawn, and that Verdale's starters never fill the T1 zones before the Grove Badge but do after it (40 seeds per zone). Atlas tests cover the Dex pages and counts, the habitat (nothing unseen, unentered or still gated), and the map window list. The three roster tests now say "joins the wild only after the badge": the first stage only, in one T1 zone, gated on that region's badge.
- `DESIGN.md` (World: conditional spawns, starters in the wild; Team: the Dex goal, tabs, habitat) and `tools/README.md` (the overlay's `if`).

## Decisions
- **Decision:** reach about 10% by scaling the zone's existing integer weights (×3 or ×4 where needed) instead of allowing fractional weights.
  - **Why:** `Rng.weighted` gives the same result when every weight is scaled by the same factor, so tables before the badge draw exactly as before (the balance reports are byte-identical). The schema keeps integer weights.
  - **Alternatives considered:** fractional weights (a schema change, and odd numbers like 0.7 in the data).
- **Decision:** zone per starter. Verdale follows the plan. Emberwaste: Sizzlet (Fire) on the Sunbaked Flats with Cindermite, Pricklet (a water-storing cactus) on the Dustway with Oasip, Pebbit (Earth) on the Redrock Trail. Rimeholm: Selkit (a seal) on the Shingle Shore, Woolump (a woolly calf) on the heath, Sparkit (Electric) on the Strand with Spinzap.
  - **Why:** the plan asked for "the zone that fits its type". This puts one starter in each zone.
- **Decision:** the rumour comes from the three kids with the "catch the thief" quests, said before their usual line and skipped while their quest is active.
  - **Why:** they live in the hub towns and already talk about the first zone. A mid-quest reminder still comes first. Turning a plain `lines` NPC into a dialogue would have meant more change.
  - **Alternatives considered:** branching only after the quest is done (a player who skipped the quest would never hear it).
- **Decision:** habitat = "zones the player entered whose open spawns have the species, for a seen species". This is the map window's own rule, not a per-zone encounter log.
  - **Why:** the plan says "from the per-zone seen data the map window already keeps", and that data is exactly this: the Dex's seen list crossed with the zones entered. Saves are unchanged.
- **Decision:** the tab key is the existing `zoom` action (`Z`, plus `Tab`), shown as "Z Region".
  - **Why:** `Tab` is already bound to `zoom`, so a new action on `Tab` would clash. In the menu context, `zoom` was used only by the map window.
- **Decision:** the counts moved from the header to the bottom right.
  - **Why:** the first build put the tabs and counts on one header line. "All · Verdale · Emberwaste · Rimeholm Isles" did not fit next to the counts, and the fallback (only the current tab named) hid the other tabs. The hint row has room. If many regions are added later, the header falls back to naming only the current tab.

## Deviations from plan / design
- The plan says 24 of 78 species couldn't be caught. The new test found 27 on the old maps: all nine starter lines × 3 stages. The test fails on the old maps and passes now.
- `DESIGN.md` updated as the plan asked (see above). No earlier rule changed.

## Issues & known limitations
- The rumour plays every time the player talks to the kid after the badge (unless their quest is active). After the quest is done, it comes before their thank-you line.
- A species seen only in a trainer battle has no "Found in" until the player enters a zone that spawns it.
- The habitat line names zones only, not the region. Zone names are unique across the three regions today.
- The sim test that fills Verdale's T1 zones over 40 seeds × 3 zones × 2 parties takes about 1 s.

## Verification
- `npm run check`: typecheck, lint, format and 937 tests pass.
- `npm run balance -- --region verdale|emberwaste|rimeholm --seeds 20`, before (a worktree at HEAD) and after: the reports are **identical** for all three regions. The simulator gets the badge (`addBadge`), so the gate is live, but it never grinds a T1 zone after the badge, and the tables before the badge draw the same. C41's bounds hold.
- `packs/dex.test.ts` fails on the pre-C42 maps (27 species missing) and passes after.
- In the browser (headless Chrome, dev build, Verdale checkpoint after the Grove Badge): opened the Dex with `B`. Checked the tabs in the header, the counts "Seen 15 · Caught 7 / 78" at the bottom right, Sprigling "Found in Sunny Meadow", and Pipwing "Found in Sunny Meadow, Willow Shore, Brookside Trail, Fernwood". `Z` cycled through Verdale, Emberwaste ("Seen 0 · Caught 0 / 26", numbers 026 onwards) and Rimeholm Isles, all by keyboard.
- Done when:
  - Completability test passes ✅
  - A gated starter never spawns before its badge and does after (tests) ✅ (sim, `openSpawns`/`pickSpawn`, the map window, habitat)
  - Dex tabs and habitat work by keyboard ✅ (`Z`/`Tab` and W/S, A/D; checked in the browser)
  - `npm run balance` for all three regions stays within C41's bounds ✅ (unchanged)
  - `npm run check` passes ✅

## Follow-ups
- A per-zone encounter log (where a species was actually met) would make the habitat exact for species met only in battles. It needs a save change, so it was left out here.
- If more regions ship, the Dex header may need a scrolling tab strip. Today it falls back to naming only the current tab.

## Notes for the next chunk
- Anything that rolls or lists wild spawns must go through `openSpawns(zone, test)` / `pickSpawn(zone, rng, test)` (`src/game/world/overworld/sim.ts`). Without a test, gated spawns are left out, which is what a new game sees.
- `packs/dex.test.ts` runs over `SHIPPED_PACKS`: a new pack whose species can't be obtained in the wild, from a boss or by evolution fails it. Its spawn conditions may only need badges the story gives.
- In the Dex, `Z`/`Tab` changes tabs (the `zoom` action).
