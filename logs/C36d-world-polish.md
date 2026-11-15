# C36d · World polish — Log

- **Date:** 2026-11-15
- **Status:** done
- **Depends on:** C36c

## Summary
Route trainers now spot the player. A trainer shows "!", walks up and starts its battle. Entering another region shows its name as a toast, gold-edged the first time. In the map window, labels no longer overlap, and the selected zone blinks as the outline of its real tiles. Saves did not change, and the ferry stays free.

## What was built
- **Trainer sight:**
  - `NpcData.sight` (`src/game/data/npcs.ts`) is optional and goes from 0 to 8. 0 means the NPC never spots.
  - `trainerSight` (`src/game/world/sight.ts`, pure) decides how far an NPC sees:
    - `TRAINER_SIGHT` (4) for an NPC whose Atlas mark is `trainer` and whose trainers are all unbeaten;
    - 0 for objects, Zorling NPCs, NPCs with a role or a boss battle, and every other mark.
  - `OverworldSim.spotter(at, sight)` (`sim.ts`) finds the first NPC that sees tile `at` straight ahead. Walls, props, NPCs and wild Zorlings block its line. NPCs that are talking or walking don't look. It returns the NPC and the tile next to the player that it walks to.
  - `NpcActor` (`actors.ts`) gained a scripted walk: `walkTo(goal, speed, faceAfter)`, `walking`, `goHome()` and `homeFacing`. During the walk it ignores its behavior.
  - **Overworld scene:**
    - The player's intent callback checks for a spotter at every decision point (standing, or arriving on a tile), so a held key stops on the tile where the player is seen.
    - The trainer gets a "!" bubble (the roamers' bubble) and the `world.encounter` sting for 0.7 s. Then it walks up at 3.2 tiles/s, and the player turns to it while its dialogue runs as if `E` had been pressed.
    - Menus, movement and wild encounters wait until it arrives.
    - If the walk is blocked for 1.5 s, the trainer gives up and walks home.
    - After its dialogue, the trainer walks back to its spot and faces the way it did before.
    - The trainers that spotted the player are kept in a set for the visit only, and they don't spot again during it.
  - **Test-region NPCs:** the trial masters and Mira had derived `trainer` marks. They now set `mark: 'trial'` or `'rival'` (`packs/core/npcs.ts`), so they don't spot, and the Atlas shows them correctly.
- **Arrival toast:**
  - `arrivalToast(region, first)` (`src/game/ui/toast.ts`) builds the toast: a gold-edged "New region" the first time, a plain "Region" after.
  - `OverworldOptions.arrived` is set by both hosts (title and debug launcher) when they open a map after travel.
  - The toast counts as a first arrival when the save has no exploration for that map yet. It is queued before the map's discovery toasts.
- **Map labels:**
  - `placeLabels` (`src/game/ui/label-layout.ts`, pure) places labels in priority order. Each label tries its offsets in turn and takes the first one that overlaps nothing placed before it. If none fits, it hides.
  - In the map window:
    - place names are ranked towns 0, then landmarks, shrines, arenas and hearts 1, then secrets 2;
    - each name can sit under its place, above its marker (−14 px) or one row lower (+9 px);
    - zoomed out, region names use the same layout, with the offsets 0, +9 and −9.
- **Zone outline:**
  - `zoneEdges(map)` (`atlas.ts`, pure) lists each zone's edge tiles as row runs `[x, y, length]`. An edge tile is a tile of the zone that touches a tile of another zone, a tile of no zone, or the map's edge.
  - The runs are stored on `AtlasZone.edge`.
  - The map window fills the runs that lie in the built area, in the blink colour, at both zooms. A fight is still a 9 px box.
- **Tests** (860 in total, 83 files):
  - `sight.test.ts`:
    - the line, its range, behind and to the side;
    - a Zorling in the way, and a talking NPC;
    - the scripted walk there and back home, with the old facing;
    - `trainerSight` for every non-trainer NPC, a beaten trainer, and `sight` 6 and 0.
  - `label-layout.test.ts`: priority, moving up or down, hiding, and no overlaps in a crowd of 40 labels.
  - `atlas.test.ts`: the edges of a small grid, and that every Verdale zone's outline is made of its own tiles.
  - `toast.test.ts`: the arrival toast.

## Decisions
- **Decision:** a trainer spots at most once per visit, and that is not saved.
  - **Why:**
    - A trainer the player talked down without a battle, or lost to, would otherwise spot them again at once, which is a loop.
    - The plan says nothing new is saved.
  - **Alternatives considered:** re-arming when the player leaves the line. It is harder to reason about, and a trainer next to a center could still loop after a loss.
- **Decision:** after its dialogue, the trainer walks back to its spot.
  - **Why:** a trainer left standing next to where the player was seen could block a one-tile path.
  - **Alternatives considered:** staying put, as in classic games, which risks blocked paths.
- **Decision:** the spot check runs in the player's intent callback.
  - **Why:** `GridMover` asks for an intent on every arrival, so a held key stops on the exact tile where the player is seen. It also catches a trainer turning to face a player who is standing still.
- **Decision:** the default sight is 4 tiles.
  - **Why:** it is close to the roamers' notice range (4), and far enough to read as "they saw me" on a 30×17-tile screen.
- **Decision:** a trainer with any boss battle never spots, even if its mark is `trainer`.
  - **Why:** the plan rules out bosses, and a Titan-like fight should not walk up.
- **Decision:** a label moves above its marker, not just one row up.
  - **Why:** a row straight up would cover the place's own marker.

## Deviations from plan / design
- `DESIGN.md` updated: a new "Trainers spot you" bullet in World, the arrival toast in the Exploration bullet, and label layout and the zone outline in the map window bullets.
- The plan said "a trainer whose path is blocked doesn't start". The line check already makes sure the path is free when the player is spotted. If something walks into the path later, the trainer gives up after 1.5 s and walks home, so nothing gets stuck.

## Issues & known limitations
- Once a trainer has spotted the player, it doesn't spot again until the map is entered again. That includes after losing to it. The player can still talk to it with `E`.
- A trainer walking home waits if the player stands in its way. It isn't blocked for good, since the player can always move.
- **Pre-existing, not from this chunk:** a `RangeError: offset is out of bounds` in `TerrainRenderer.draw` (`animate.ts:46`), thrown from `TitleScene.drawBackground` during a resize. It showed in headless Chrome when the viewport was changed while the title was loading. The game went on normally.
- Zoomed out, the outline uses ½ px rounding, so a zone's top and bottom rows can merge into one pixel row.

## Verification
- `npm run check`: typecheck, lint, format and tests all pass (83 files, 860 tests).
- Headless Chrome on `vite` (960×540, the scratch `cdp.mjs` script):
  - **Spotting:**
    - New game at Verdale (100, 228), with Picnicker Nell at (96, 228) facing right.
    - At 0.12 s the "!" shows over Nell and the player is held.
    - She walks to (99, 228), the player turns left, and her dialogue opens.
    - With a Lv 60 team, `E` presses won the battle. Nell was recorded as beaten, walked back to (96, 228) and stood there.
  - **Arrival:** walking east from Verdale (197, 184) through Ember Pass opened Emberwaste with the toast "New region: Emberwaste", then the discovery toasts.
  - **Map window:** with Verdale fully explored, the labels Hidden Glade, Heartwood Shrine, Stone Circle, Crown Rock, Fernhollow, Mist Isle, Willowmere, Galecrest, Lookout, Drowned Ruins and Old Orchard don't overlap. Willow Shore blinks as its real shoreline shape at 1 px, and Fernwood as its outline at ½ px.
- Done when:
  - Route trainers spot and walk up to the player once, and none can trap the player in a loop: ✅ (browser, `sight.test.ts`, once per visit).
  - Entering a region shows the arrival toast: ✅ (browser).
  - Labels don't overlap at either zoom, and the selected zone's outline matches its tiles: ✅ (`label-layout.test.ts`, `atlas.test.ts`, browser).
  - The ferry stays free, old saves load unchanged, and everything stays keyboard-playable: ✅ (no save or ferry change; the save fixture tests pass; spotting needs no input).

## Follow-ups
- Look into the title-screen `RangeError` on resize (`TitleScene.drawBackground` → `TerrainRenderer.draw`). It is probably a buffer size that is out of date for one frame. Suggested for C38 (release prep).
- A trainer's sight could be shown faintly when the debug overlay is on, to help place trainers in the world tool.

## Notes for the next chunk
- C37 (seamless world): the arrival toast is driven by `OverworldOptions.arrived`. When regions merge, fire `arrivalToast` when the player crosses a region border, and drop the option.
- To give a trainer a different reach, set `sight` on its NPC. Only NPCs with the `trainer` mark spot.
- Scratch files in this session's scratchpad: `cdp.mjs`, plus `spot.json`, `spot2.json`, `travel.json` and `map.json` (the browser checks).
