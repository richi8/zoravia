# C37 · Seamless world — Log

- **Date:** 2026-11-15
- **Status:** done
- **Depends on:** C36e

## Summary
The regions are now one big map at load. The player walks from Verdale into Emberwaste through Ember Pass with no loading or fade, and the biome, music, ambience, weather and HUD change at the border. The double tree wall where the two regions touch is now one natural border, preview pick B "tree line into scrub". The ferry is a free rowboat ride (preview pick B "rowboat and ferryman") over animated sea between the piers, both ways. Saves did not change.

## What was built
- **World composition** (`src/game/world/world-compose.ts`, pure):
  - `composeWorld(content, layout)` copies every placed region into one `WorldMap` at its C36c world place: tile flags, corners, zones, props and anchors. Zone and anchor keys become `<map>/<key>`, so they stay unique. A world holds at most 255 zones; today it has 39.
  - `World`:
    - `regionAt`, `biomeAt` and `lookAt` per tile;
    - `toWorld` and `toLocal` between a region's local tile and a world tile;
    - `npcs(content)`: every NPC of every region at its world tile;
    - `ferries`, with `ferryAt(from, facing)` and `ferryFrom(map, connection)`.
  - `worldFor(content, mapId)` gives the whole world (cached per content) when the map has a world place, else that map alone. The debug test region still loads by itself.
  - **Filler:** every tile outside a region is blocked and takes the nearest region's biome.
    - It is sea in the band a ferry crosses (the rows between Verdale and Rimeholm, across the whole world) and next to a region whose edge is water.
    - `seaLook` gives a lava biome water and a sandy bank, so the sea south of Emberwaste is water with desert colors.
    - Elsewhere it is land, planted within 24 tiles of a region: forest gets trees and bushes, desert cacti, rocks and shrubs, frozen pines and snow rocks.
  - **Seams** (`findSeams`, `buildSeam`): where two regions touch, each side's two wall rows are cleared and planted again from its own biome. The line on the seam is always solid and `TILE_BLOCK`, and the row behind thins out. A row stays open only where both sides were open before. That is only Ember Pass (Verdale rows 182–186).
  - **Ferries:** a ferry link between two placed regions gives a route in world tiles, from the link's `route` data or straight between the two docks. Each end has its connection tile, the `front` tile toward the boat, the `dock` and the facing after stepping off.
- **Data:**
  - `route` on a connection (`src/game/data/maps.ts`): up to 32 `[x, y]` tiles in the map's coordinates, which may lie outside the map.
  - Rimeholm's ferry has a 5-point route from its pier (100, −2) to under Verdale's dock (100, −23).
  - `ferry` on an NPC (`src/game/data/npcs.ts`): a ferryman offers the crossing after talking. Gus and Ola have it. Ola's first line now says the crossing is free.
- **Terrain** (`terrain.ts`, `animate.ts`, `overworld/stream.ts`):
  - `TerrainStream` takes one biome or a biome per tile.
  - A block whose surroundings (within the warp) hold one biome bakes as before. A block where biomes meet bakes once per biome, each on only the pixels it owns (`BakeOptions.only`), with its own props and tufts but every prop's shadow and every tall tile's shade. `mergeBlock` then joins them: ground by owner, a prop pixel from whichever layer's prop stands in front, and each layer animating its own liquid, tufts and vents.
  - `biomeOwner`: a pixel shows the biome of the tile at a smooth noise warp (±44 px, sampled every 4 px) plus a ±5 px jitter, which frays the edge into a dither. On a wet tile, the warp never swaps water for lava or back.
  - `TerrainRenderer.draw` is split into `drawBase`, `drawLiquid`, `drawTufts`, `drawOverlay` and `drawVents`.
  - Prop sprites are now cached per biome and shared by every bake. Before, every block painted its props again. A plain block went from about 5 ms to about 3.8 ms, and a mixed one bakes in about 5.7 ms (Node, steady state).
- **Boat** (`src/game/world/overworld/boat.ts`, pure):
  - `boatFrame(dir, phase)`: the rowboat for each heading, the ferryman drawn over the hull at the stern, oars in 8 phases (cached).
  - `drawWake`: a foam V and churn behind a moving boat plus a bow wave, or rings around a docked one.
  - `voyage`, `along`, `heading` and `rideSeconds`: 2 tiles per second, kept between 10 and 15 s.
- **Overworld scene** (`overworld-scene.ts`):
  - The scene plays `worldFor(...)`. `region` is the region under the player.
  - `crossBorder()` runs on every move, after a ride and after waking at a center. It crossfades `fieldAudio` and shows the arrival toast before that tile's discovery toasts: gold-edged when the save had no exploration there and none was made this visit.
  - Exploration is kept per region (`exploredOf`) and written back per region.
  - `snapshot()` stores the place and respawn as region map plus local tile (`placeOf`). Saved places are read through `toWorld` (`onMap`).
  - The menu host's `map`, `mapId`, `where()` and `services()` follow the current region, so the map window needed no other change.
  - Battles take `biomeAt` under the player. Step and roamer grass effects use the tile's look.
  - `travel()` only fires for a connection whose other end is outside the world.
  - **Ferry:**
    - `offerFerry` runs on a bump into the boat, on `E` facing it, or after a ferryman's talk. It asks "Sail to <region>? The crossing is free." with Yes and No.
    - `startRide` clears wild Zorlings, plays `seaAudio()` and rows the route.
    - `updateRide` moves the boat and camera and keeps the HUD at "At sea · to <region>" with "The ferryman rows you across". At the far pier it places the player on the connection tile facing inland, then explores, crosses the border, autosaves and restores the field sound.
    - Autosave waits while at sea. Menus, `Q` and `Esc` are unreachable during the ride.
  - **Drawing:** a boat waits at each dock (bobbing, with ripples), or the riding boat with its wake and the player seated at the bow. NPC sprite sheets are built the first time an NPC is drawn, and only NPCs and roamers near the view are drawn.
- **Sim** (`sim.ts`): takes placed NPCs (`npcs` option). Only NPCs within `ACTIVE_RANGE` (40 tiles) of the player move.
- **Audio:** `seaAmbience()` (surf beds, wind, gulls, oar dips every 1.1–1.4 s) and `seaAudio()`.
- **Map window:** `WorldLink.route` and `MapWindowLink.route`. The dotted ferry line follows the boat's route.
- **Saves:** a new `tests/fixtures/saves/v6.json`: a game standing in Emberwaste, with exploration in Verdale and Emberwaste and the respawn in Verdale.
- **Tests** (899 in total, 89 files):
  - `world-compose.test.ts`:
    - places and bounds, and the tile-for-tile copy;
    - unique keys, conversions both ways;
    - no walkable filler, open water across the sea band (and water next to the desert);
    - the seam is closed except at the pass, with the inner rows thinned, and Cinderwell is reachable from Willowmere;
    - the ferry's ends, docks, facing and boarding, every route step on open water, 10–15 s;
    - NPC placement, the debug map alone, an empty world;
    - the v5 and v6 fixtures at the same place with the same exploration.
  - `c37.test.ts`:
    - a mixed block takes pixels from both biome bakes;
    - the warp's reach and determinism;
    - wet tiles keep their biome;
    - boat frames per heading, `along`, the ride's length clamp, the wake trailing behind;
    - far NPCs wait and near ones wander.

## Decisions
- **Decision:** one composed `WorldMap` with per-tile biome and region indices, not several region maps streamed side by side.
  - **Why:** the plan asked for a pure composition step. One map lets props, collision, pathing, the camera and the depth sort cross a seam with no special cases, and it costs about 90 ms once at load (cached).
  - **Alternatives considered:** keeping region maps and stitching at draw time. That clips props at region edges and needs per-region coordinates everywhere.
- **Decision:** seams are built at compose time from each side's biome, not drawn in the region overlays.
  - **Why:** packs keep their own maps unchanged, and the world tool still edits one region at a time. A future region that touches another gets a natural border without editing either pack.
- **Decision:** a row on the seam is open only where both regions were open next to it.
  - **Why:** the regions' walls already encode their openings. This keeps Ember Pass and can never open a gap that only one side planned.
- **Decision:** the biome edge is a noise-warped per-pixel owner with a little jitter, and one bake per biome per block.
  - **Why:** the user picked a wide, natural blend. Warping keeps the edge organic for any region shape. Baking each layer only where it owns pixels keeps a mixed block close to the cost of a plain one.
- **Decision:** sea next to a lava biome uses `seaLook`, the biome's colors with water.
  - **Why:** the plan says the gap is sea. With the desert biome it rendered as a lava sea. A different biome there would have blended green grass onto the desert coast.
- **Decision:** the boat docks on the route's end tiles, and boarding is by the tile in front of the pier (`front`).
  - **Why:** a dock right next to the pier made the hull overlap the pier end. The boat now floats one tile out, and walking into the water in front of it, or pressing `E` facing it, still boards.
- **Decision:** the ferryman shows his face both ways and is drawn over the hull.
  - **Why:** heading north, the hull hid him. The picked preview showed his face.
- **Decision:** saves keep the region map and local tile, with no v7.
  - **Why:** the plan preferred this when it works. It does, because the world converts both ways and the player never stands on filler outside a ride, during which autosave waits.

## Deviations from plan / design
- `DESIGN.md` updated:
  - World: a new "Seamless world" block (filler, seams, the region under the player, the ferry, saves).
  - Links: a pass is walked through and a ferry is ridden inside the world.
  - The arrival toast now shows on a border crossing.
  - The respawn center can be in any region.
  - The map window's ferry line follows the route.
- The plan named "a ferryman" as one way to board. Gus and Ola already stood at the piers, so they got the new `ferry` field. The rowboat's own ferryman has no dialogue.
- A v6 save fixture did not exist. It was added, since the plan's done-when needs one.
- The plan asked that "terrain chunks are baked only near the camera". That was already true (C20 blocks). Mixed blocks follow the same rule.

## Issues & known limitations
- Trainers spot the player once per scene now, not once per region visit (C36d's "visit" was the map). They re-arm after quitting to the title.
- The filler between regions is classed by the nearest region in tile distance. Far from any region this gives odd diagonal borders between sea and land, but nobody can see that far from a walkable tile. The map window shows parchment there.
- The sea darkens toward Rimeholm where forest water meets frozen water. It reads as colder, deeper water, but it is a warp edge, not a gradient.
- Regions' outer walls that face filler stay as they were (for example Emberwaste's two rock rows on its south coast). Only walls where two regions touch are rebuilt.
- **Pre-existing, not from this chunk:** the title-screen `RangeError` in `TerrainRenderer.drawBase` on resize showed again in headless Chrome. It now reports `drawBase` instead of `draw`, since `draw` was split. It is still listed for C38.
- Frame timings were measured in headless Chrome, which caps at the display rate (16.7 ms). Slower machines were not tested.

## Verification
- `npm run check`: typecheck, lint, format and tests all pass (89 files, 899 tests). `npm run balance` runs.
- **Preview round:** the scratch renderer baked the real maps, and the page is https://claude.ai/artifact/BidqLPC7u6Ey1TYcZcp37m. The user picked border B, "tree line into scrub" (over A rock ridge and C single line), and boat B, "rowboat and ferryman" (over A sailboat and C little ferry).
- **Headless Chrome on `vite`** (960×540, scratch `cdp.mjs`):
  - **Ember Pass:**
    - Walking east from Verdale (192, 184) crosses into Emberwaste with no fade: region `emberwaste:emberwaste`, music `field:forest` → `field:desert`, ambience forest → desert, and back when walking west.
    - The pass screenshot shows the blended border and the HUD with the Emberwaste zone.
    - Frame times over 15 s of crossing back and forth (898 frames): average 16.67 ms, p99 16.8 ms, max 16.8 ms, none over 20 ms.
    - The first run had a single 50 ms frame, which came with a wild battle starting.
  - **Ferry, Verdale → Rimeholm:**
    - Walking down onto the ferry tile and bumping the boat asks "Sail to Rimeholm Isles? The crossing is free."
    - Yes starts the ride: 380 px of route at 32 px/s (11.9 s).
    - `Q` and `Esc` mid-sea do nothing, and the HUD reads "At sea · to Rimeholm Isles".
    - The player steps off at Rimeholm (100, 0) facing down. The save place is `rimeholm:rimeholm` (100, 0), and the discovery toast shows.
  - **Ferry, Rimeholm → Verdale:** walking up the pier into the boat, then Yes, arrives at Verdale (88, 279) facing up.
  - **Gus:** after his dialogue (the quest start), the sail prompt opens.
  - **Map window in Emberwaste:** the explored bits of both regions sit at their places, with the player at the seam.
  - **Respawn:** with the place in Emberwaste and the respawn in Verdale, waking at the center moves the player to Verdale (101, 229), and the music is `field:forest`.
  - **Debug map:** an `OverworldScene` on `core:test-region` loads alone (96×96, one region).
- Done when:
  - The user picked the border and the boat from the previews: ✅ (B and B).
  - Walking from Verdale to Emberwaste through Ember Pass has no loading or fade, and the biome, music and weather change at the border: ✅ (browser; weather is per zone, as before).
  - The ferry is a free boat ride over animated water between the piers, both ways: ✅ (browser, both directions).
  - No seam has a walkable gap or a hole, and no double tree wall is left where regions touch: ✅ (`world-compose.test.ts`: filler blocked, seam closed except the pass, inner rows under 60 % solid).
  - The v5 and v6 save fixtures load at the same place with the same exploration: ✅ (`world-compose.test.ts`).
  - 60 fps holds while walking across a border, measured in the browser: ✅ (headless Chrome, no frame over 20 ms).
  - The balance sim and all tests pass, and keyboard-only play is unchanged: ✅ (the ferry is keys only: walk into the boat or `E`, then Yes or No).

## Follow-ups
- C38: the title-screen `RangeError` on resize (`TerrainRenderer.drawBase`).
- Trainer spotting could re-arm when the player leaves the trainer's region.
- A smoother gradient where two water colors meet at sea (a dither band instead of the warp edge).
- Rebuild a region's outer wall where it faces filler land, so the edge of the world looks less like a fence.
- The map window could draw the filler (sea and blocked land) instead of parchment, once the world is fully explored.

## Notes for the next chunk
- The overworld always plays a `World` (`worldFor`). Use `world.toLocal` and `world.toWorld` for anything saved or shown per region. `scene.map` is the world map, and region maps are `world.region(id).map`.
- A new region pack that sets `world` on its start joins the world automatically. If it touches another region, the seam is built for it, and a row is open only where both maps are open. A ferry can carry a `route` in its map's coordinates.
- Zone keys on the world map are `<map>/<key>`. Region maps keep plain keys.
- Scratch files in this session's scratchpad:
  - `border.ts`, `boat.ts` and `prev/` (the preview page and images);
  - `ws.ts` and `wt.ts` (world renders and bake timings);
  - `cdp.mjs` with `pass*.json`, `ferry*.json`, `c.json`, `gus.json` and `resp.json` (browser checks);
  - `mkv6.ts` (the v6 fixture).
