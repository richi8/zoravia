# C36 · Cross-region endgame — Log

- **Date:** 2026-11-15
- **Status:** done
- **Depends on:** C35 (and C34, C35a, whose regions it extends)

## Summary
Each of the three regions now has its own Lv 45–60 **danger zone**, in a strip its main map grew by:
- **Thornveil**: north of Verdale's Heartwood Shrine.
- **Ashen Rift**: east of Emberwaste's Lookout.
- **Polar Drift**: an ice shelf reached by a pier south of Rimeholm's Crown Shrine.

A ranger blocks each way in until the player holds 3 badges. Each zone has:
- two zones and a camp with no center;
- three aces and a heart guarded by a Keeper;
- two **Elder Titans**;
- hidden items;
- two new **rare** Zorlings from the region's own model kit.

Core's meta-quest **Beyond the Map** opens at 3 badges. It asks the player to chart three hearts, then ends with **Rival Mira's finale** at Thornveil Camp.

To grow finished maps without breaking them, the world tool gained **extensions** (`world extend`). It glues a strip on and leaves every existing tile as it was. Maps gained an `origin`, and saves (v5) record it, so old positions follow Verdale's 80-tile shift.

The user settled the design over three rounds:
1. One zone per region, owned by its pack, own species plus new rares, a meta-quest in core ending with Mira, empowered Titans, no centers.
2. Then: zones **inside the main maps, made bigger**, rather than separate maps, because the long-term goal is a seamless world.
3. A map-exploration idea, which became chunk C36b.

They approved the rare looks ("your picks") from a preview round.

## What was built
- **World tool: extensions** (`tools/world/extend.ts`, `config.ts`, `files.ts`, `cli.ts`):
  - `region.json` has `extensions`, by id: `side`, `size`, `seed`, `zones`, and a `layout` in strip coordinates.
  - `npm run world -- extend <region> <id>` freezes a strip in `generated-<id>.json`.
  - `build` glues the strips onto the base, in order, before the overlay.
  - `show --generated` shows the glued base.
  - `stitch` keeps every base tile, corner, zone, prop, anchor and connection. The strip's zones get free glyphs.
  - The strip's exits on the glued side become **joins**: the base's border trees in front of each join are removed (5×2 tiles), and the strip's path is carried through.
  - A north or west strip moves the base and its `origin`.
- **Map `origin`** (`src/game/data/maps.ts`, `world-map.ts`, `codec.ts`): where the region's first shipped tile sits now. It is omitted at (0, 0).
- **Save v5** (`src/game/save/`):
  - Each place keeps the `origin` it was written at, and `placeIn` moves it by however far the map's origin has moved.
  - The v4→v5 step adds origin (0, 0).
  - New fixture `tests/fixtures/saves/v4.json`. Tests cover the migration, a moved origin, and a real Willowmere place (100, 119 → 100, 199).
- **Rares** (`species.rare`, C36):
  - single-stage, stat band ~520, catch rate ×0.6;
  - validated as single-stage and not legendary;
  - `statBand(…, rare)`.
- **The three strips** (`region.json` `extensions`, frozen strips, overlays):

  | Region | Strip | Joins at | Zones (Lv) | Weather |
  |---|---|---|---|---|
  | Verdale | north, 200×80 | Heartwood Shrine → (100, 81) | Tanglewild 45–52, Elderroot Deep 52–60 | canopy mood |
  | Emberwaste | east, 80×200 | Lookout → (199, 134) | Cinder Rift 45–52, Molten Deep 52–60 | ash storm (Burning) in Cinder Rift |
  | Rimeholm | south, 200×80 | pier below the Crown Shrine → (90, 197) | Driftice Floes 45–52, Aurora Shelf 52–60 | sleet storm (Wet) in Driftice |

  - Each strip has a camp (a widened clearing with two lamps), two lairs, a ringed heart, a secret and a landmark.
  - The overlays add a road from the existing site to the join, and a one-tile gate where the ranger stands: trees, rocks, or a narrowed pier.
  - Verdale's road goes around the shrine stone.
- **Verdale's 80-tile shift**:
  - its overlay (181 positions);
  - 35 NPC positions in `verdale-story.ts` and `verdale-trainers.ts`;
  - two tests.
  - Starts use the `spawn` anchor, so they moved with it.
- **Core endgame** (`packs/core/endgame.ts`):
  - the quest `core:beyond-the-map`, 4 steps: three hearts (`core:hearts-charted` ≥ 1, 2, 3), then beat Mira. Its reward is 10 000 coins and 3 Max Potions;
  - the `core:surveyor` dialogue;
  - `core:mira-finale` (Lv 62/62/64, with starter counters for all regions by flag) at Thornveil Camp, rematchable;
  - `dangerZone(spec)`, which builds a zone's ranger, scout, Surveyor, aces, Keeper, Elder Titans (boss entry, trainer, lair NPC) and hidden items from a spec.
- **Zones** (each region's people are built by `dangerZone`):

  | Region | File | Rares | Keeper | Elder Titans | Aces |
  |---|---|---|---|---|---|
  | Verdale | `packs/core/thornveil.ts` | Elderhorn (Nature/Earth stag, seed 3741), Stormoth (Wind/Electric moth, 3708) | Ysolde | Mossback 52 (×3), Bogmaw 56 (×2.5) | Bryn, Iris, Corin |
  | Emberwaste | `packs/emberwaste/ashen-rift.ts` | Brimscorp (Fire/Metal scorpion, 3663), Shardwing (Metal/Wind vulture, 3675) | Ashka | Dunewyrm 52 (×3), Forgeback 56 (×3) | Rhea, Tor, Varga |
  | Rimeholm | `packs/rimeholm/polar-drift.ts` | Starhorn (Ice/Wind caribou, 3685), Deepjaw (Water/Ice angler, 3694) | Aurelle | Floemaw 52 (×3), Squallwing 56 (×4) | Sven, Maren, Ingrid |

  - The Elder Dunewyrm and Elder Floemaw sit in their zone's storm, like their Titans.
- **Spawn tables**: the region's final forms, plus a few core species, plus one rare per zone (weight 1 of 9).
- **Tests** (823 total, 78 files):
  - `tools/world/extend.test.ts`, on all four sides:
    - existing tiles kept outside the join;
    - the strip reachable from the spawn;
    - joins are not connections;
    - glyphs, origin round-trip, and size mismatches refused.
  - `packs/core/endgame.test.ts`, for each zone:
    - the ranger's tile is the only way in;
    - the ranger is gone and the Surveyor present at 3 badges;
    - aces, Keeper, Elders and items are in danger zones, and the Keeper is in the inner zone;
    - each Elder wakes after its Titan and copies its species, signature move and Armor;
    - each rare spawns in exactly one danger zone.
  - The whole meta-quest through the engine, across three regions:
    - Surveyor, then three Keepers (hearts can't be counted twice);
    - Mira appears, and the finale pays her prize plus the quest reward;
    - against Emberkit she brings Tidefang.
  - Simulations:
    - aces and Keepers are beaten by a region team two levels up;
    - each Elder falls to the scout's hint (reactions ≥ 70%) but not to brute force (≤ 35%);
    - Mira is above the cap and a cap-level team wins ≥ 30%.
  - Updated map, route and roster tests for the grown maps.

## Decisions
- **Decision:** the danger zones live **inside each region's main map**, which grows by a strip. They are not separate maps.
  - **Why:** the user's choice. They want one seamless world eventually, with a boat to Rimeholm and no loading. Separate maps would add more seams to remove later.
  - **Alternatives considered:**
    - Separate 112×88 maps behind a new exit. These were previewed first. They need no map surgery.
    - Regenerating the regions bigger: it would shift the base every overlay edit was placed against.
    - Carving a zone out of an existing T3 area: smaller, odd shapes, and it would shrink areas the campaign was balanced on.
- **Decision:** grow with **frozen strips glued on**, not by regenerating.
  - **Why:** the shipped regions' overlays (towns, NPCs, bridges, signs) depend on the frozen base. The stitch test proves the base is untouched except at the join.
- **Decision:** Verdale grows **north**, which shifts its coordinates. Emberwaste grows east and Rimeholm south, which do not.
  - **Why:** Verdale's east and south edges carry the links to the other regions, and should stay free for a seamless world. North sits beyond the Old Grove and the Heartwood Shrine, which suits the story.
  - The cost is a one-time shift of Verdale's overlay and pack coordinates, plus the map `origin` and save v5, so existing saves follow.
  - **Alternative considered:** growing Verdale south or east. That would put the endgame between Verdale and another region.
- **Decision:** a map `origin`, and saves record the origin they were written at.
  - **Why:** it is generic, with no content in the engine. Any later north or west growth moves old saves correctly. Old saves migrate to origin (0, 0).
- **Decision:** what makes the endgame "cross-region" is the **meta-quest**, not a shared map. DESIGN.md is updated.
  - **Why:** the user's choice, so expansions stay self-contained. Badges and hearts count as numbers, so a future region's zone counts automatically.
- **Decision:** the meta-quest and Mira's finale are in **core**; each region's Surveyor uses core's dialogue.
  - **Why:**
    - Core depends on no region pack.
    - The finale needs a map core owns, so it is at Thornveil Camp.
    - Mira reaches other regions' starters by flag only (the C34/C35 rule).
  - Against Sparkit she brings a Mossback: no Verdale starter line beats Electric.
- **Decision:** **Keepers**, not "Wardens", guard the hearts.
  - **Why:** Verdale already has Warden Elm in the Grove Trial.
- **Decision:** **Elder Titans** are boss entries of their own (the Titan's data with their own name, level and aura), fought as a one-boss trainer.
  - **Why:** with the Titans' own ×2 aura, endgame teams won by brute force 63–90% of the time. A trainer's boss faints and is never caught, so the one-per-save rule holds, with no engine change.
  - Auras were tuned in simulation. The results, at the Elder's level + 2:

    | Elder (aura) | Reactions | Brute force | Potions only |
    |---|---|---|---|
    | Mossback (×3) | 83% | 7% | 37% |
    | Dunewyrm (×3) | 80% | 0% | 30% |
    | Forgeback (×3) | 83% | 7% | 10% |
    | Floemaw (×3) | 80% | 3% | 3% |
    | Squallwing (×4) | 83% | 17% | 60% |
    | Bogmaw (×2.5) | see below | | |

  - The Bogmaw is the exception. Nature hits Earth/Water ×2.25, so a team with Nature wins outright; one without does not. The aura is ×2.5 and the scout's hint names Nature.
- **Decision:** Mira's finale is Lv 62/62/64, above the level cap.
  - **Why:** at 58–60 she lost to most cap-level teams (83–100%). Now the sampled cross-region teams win 27–100%, depending on the matchup, so she is the hardest fight.
  - Her line "no badges and no level caps to hide behind" says so.
- **Decision:** rares are **single-stage, ~520** (a new `rare` band).
  - **Why:** the preview offered them at final-form strength. DESIGN listed rares among 3-stage lines, but an endgame rare caught at Lv 45+ has no use for baby stages.
  - DESIGN.md now lists the band.
- **Decision:** no center in the zones (the user's choice). The camps are clearings with lamps.
  - There is no tent or campfire prop yet (see Follow-ups).

## Deviations from plan / design
- **Engine changes**, all general:
  - map `origin` (schema, `WorldMap`, codec);
  - save v5 (place origin);
  - the species `rare` flag and band;
  - world-tool extensions.
- `DESIGN.md` updated:
  - saves (v5 origin);
  - World (maps grow by strips; the seamless-world goal; danger zones settled);
  - each region's danger zone;
  - the rare stat band;
  - Elder Titans;
  - "Endgame: Beyond the Map".
- `IMPLEMENTATION_PLAN.md`:
  - C36 got its settled scope, Done-when items and dependency;
  - new **C36b Map exploration** (the map starts dark and is revealed by exploring; the user's idea);
  - **Seamless world** under Later.

## Issues & known limitations
- **Map size:** the three map files grew by about 50% (Verdale 547 KB → 834 KB). Lazy-loading maps is still a C37 item.
- **Tile textures shift with Verdale's origin.** The data is identical, but tile dithering is seeded by coordinates, so Verdale's ground texture looks slightly different from before. Nothing moves.
- **The seams are double tree walls.** The strip's border and the base's border meet in a 4-tile wall along the whole edge, broken only at the join. That suits a gated zone, but a seamless world will want it softened.
- **The Rimeholm pier narrows to one plank** at the ranger (a missing deck tile). It reads as a gate, but looks a little odd.
- **Camps have no tents or campfire.** There is no prop for them; a camp is a clearing with two lamps.
- The playthrough simulator does not play the endgame; only the zone simulations in `endgame.test.ts` check it. Grinding from Lv ~42 to the zones' levels is not simulated.
- Wild rares spawn at weight 1 of 9, with no extra rarity mechanic.
- `animate.test.ts`'s padding test takes about 4.6 s alone, close to Vitest's 5 s default since C35a's new plans. With C36's extra test file it timed out under full-suite load, so it now has an explicit 20 s timeout. The test itself is unchanged.

## Verification
- `npm run check`: typecheck, lint, format and tests all pass (78 files, 823 tests). `npm run world -- check`: 4 region maps up to date.
- The stitch is checked against the C35 maps (scratch compare):
  - Verdale: 10 tiles changed (the join), 0 corners, 0 zones, 10 border trees removed, 0 anchors moved after the origin.
  - Emberwaste: 10 tiles, 3 path corners, 10 rocks.
  - Rimeholm: 0 tiles, 6 path corners, 0 props.
- Headless Chrome on `vite` (960×540):
  - A new Verdale game spawns at (100, 199) on the 200×280 map.
  - Ranger Hollis stands in the gap north of the shrine, and his lines show (screenshot checked).
  - With 3 badges he is gone, and walking north reaches Tanglewild.
  - The Willowmere Surveyor starts "Beyond the Map" (screenshot: quest toast and Guild Surveyor). After this check they were moved off a spot a lamp blocked, to (97, 197).
  - Thornveil Camp and the Elder Tree render, and a wild battle starts in Elderroot Deep.
  - No console errors.
- Rendered the grown maps and seams for all three regions (scratch PNGs). The six rares render via `speciesLook` exactly as previewed.
- Done when:
  - The user approved the map and rare previews: ✅ The rares were approved ("your picks are OK"). The maps were previewed as separate maps first; the user then chose in-map zones. The grown strips follow the same layouts.
  - Each region map extended with existing tiles unchanged: ✅ by stitch tests and the scratch compare.
  - Meta-quest runs start to finish through the engine: ✅ `Beyond the Map` test.
  - Zones' fights checked in simulation: ✅ aces, Keepers, Elders and Mira.

## Follow-ups
- **C36b, map exploration** (planned): a dark map revealed by exploring, with discovery toasts showing a place's name and levels.
- **Seamless world** (Later): stream neighbouring maps at world offsets, make the ferry a boat ride, and soften seam walls.
- Camp props (tent, campfire), with a preview round.
- An arrival toast when entering a danger zone (C36b can do it with its discovery toasts).
- The playthrough simulator could add an endgame leg: grind to the zones and play the meta-quest.
- Battle backdrops per biome (still open from C34/C35).

## Notes for the next chunk
- **Positions:**
  - Verdale's coordinates moved by +80 y. Anything hand-placed on `core:verdale` now uses the grown map.
  - Strips in `region.json` use strip coordinates. Overlays and pack code use final map coordinates.
- **A future region pack:**
  - Give it an `extensions` strip.
  - Run `world extend`.
  - Write its zone spec with `dangerZone()` from `@packs/core/endgame`: Keeper, Elders (`from: bosses[...]`, own `aura`), aces, ranger, scout, Surveyor, hidden items.
  - Add `rare: true` species from its kit.
  - Its Keeper adds to `core:hearts-charted` automatically.
- Scratch scripts were in the session scratchpad:
  - `maps.ts`, `rares.ts` and `grown.ts` (renders);
  - `cmp.ts` (old vs new map compare);
  - `spots2.ts` (roadside finder);
  - `probe.ts`, `elders.ts` and `mira.ts` (fight probes);
  - `cdp.mjs` with the step files.
- Preview artifact: https://claude.ai/artifact/MmczfZ6nu3SMviZW7nh9Fu
