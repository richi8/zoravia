# C20 · Overworld movement — Log

- **Date:** 2026-11-12
- **Status:** done
- **Depends on:** C19, C05

## Summary
The player now walks the test region. Movement is on the tile grid at 3.75 tiles/s, tweened, with turn-in-place, collision and click-to-move along an A* path. Terrain streams in 8×8-tile blocks around the camera. The camera eases after the player and stays inside the map. The new player sprite has a 4-frame walk cycle in 4 directions. Props in front of the player hide it, so the player can walk behind trees, and tall grass covers the feet. A new launcher entry, "Overworld: test region", opens it.

## What was built
- **Movement**, `src/game/world/overworld/mover.ts`: `GridMover`, pure and deterministic.
  - One tile per 16 frames from the key press. Holding a key keeps walking with no stop between tiles (leftover progress carries over).
  - From standing, a tap toward a new direction only turns. Holding it walks after `TURN_DELAY` (0.1 s).
  - Walking into a blocked tile turns and "bumps" (one `bump` event).
  - Directions come from an `intent(at)` callback asked at each decision point, so keyboard and click paths share one code path.
  - Events: `step`, `arrive`, `bump` (C21 will hang encounters on `arrive`).
- **Pathfinding**, `path.ts`: A* with 4-way steps and a node limit (4000). Ties prefer straight runs. `pathToward` walks next to a blocked target (clicking a tree walks up to it and faces it).
- **Camera**, `camera.ts`: exponential easing (rate 9/s) that settles exactly. It is clamped to the map, a map smaller than the screen is centered, and it jumps instead of easing beyond 160 px.
- **Streaming**, `stream.ts`: `TerrainStream` bakes `BLOCK` = 8×8-tile blocks (128 px).
  - Each block is baked only with props from its 3×3 block neighbourhood and its own tall-grass tiles. That cut a block bake from ~12 ms to a few ms, because `placeProps` no longer walks every prop on the map.
  - Blocks in view are baked at once (no holes). The ring around the view is baked ahead within a 4 ms budget per frame. Blocks more than 2 blocks outside the view are dropped.
  - `occludes(wx, wy, baseY)` and `drawGrassOver(...)` handle entity depth.
- **Depth sorting**: `bakeTerrain` now also writes `depth` (`Int32Array`): for every prop pixel, the world y of its prop's base. A player pixel (and its shadow) is skipped where a prop pixel's base is below the player's base. `TerrainRenderer.drawTufts` (split out of `draw`) can redraw only the tufts in front of an entity's feet.
- **Player sprite**, `character-sprite.ts`: 16×24 run-length row templates in code, outlined in navy.
  - Outfit palette `PLAYER_OUTFIT` (teal and gold).
  - `buildCharacterSheet(outfit)` → 4 facings × 4 frames. Left is right mirrored.
  - `walkFrame(walked, moving)`: two frames per tile, starting on a step.
- **Scene**, `src/game/scenes/overworld-scene.ts`: draws terrain, the click target marker, the shadow, the player with occlusion, and grass over the feet into one screen-sized `PixelBuffer`. A paper HUD shows the zone name (or "town") and the controls. `Esc` (`pause`) goes back until the pause menu exists (C22).
- **Launcher**: "Overworld: test region" (C20) above the map viewer.
- **Tests**, `src/game/world/overworld/overworld.test.ts` (22), plus the updated collision test in `map.test.ts` (side shore blocked, top shore walkable):
  - Mover timing, turn, bump and events.
  - A* shortest path, unreachable targets, few turns, blocked target.
  - Camera easing, clamping and snap.
  - Streamed blocks equal a whole-area bake pixel for pixel. The stream stays bounded. Tree canopies occlude an entity behind them but not one in front.
  - Sprite: size, face identical across frames, left = mirrored right, walk-frame order.
  - **511 tests total.**

## Decisions
- **Decision:** The player sprite follows the user's own reference sheet, at 16×24. It is drawn by templates in code, not sampled from the image.
  - **Why:** eight preview rounds with the user. The earlier code-shape kids (cap, hood, scarf, beanie…) were rejected as looking old or weird or not fitting, and the user disliked every side view with a protruding nose. Pixels sampled straight from the reference were close 1:1, but each frame came from a different pose. The eyes and mouth "moved" while walking, the sprite was 24×32, and it would have bent the "graphics generated in code" rule. A hand-drawn 16×24 version keeps the look and the rule, and the face stays identical in every frame. The user then asked for a rounder head and a body dip with arm swing ("much better"), tried red, white and 12 color variants, and kept the original teal.
  - **Alternatives considered:** 20×32 (the reference's own size; it would change DESIGN.md's 16×24 and make NPCs 1.5 tiles wide); sampled pixel data.
- **Decision:** Characters get one navy outline instead of the tiles' tinted outlines.
  - **Why:** it is part of the reference look, and it makes the player read clearly against the bright world. Added to DESIGN.md → Presentation.
- **Decision:** Stream in 8×8-tile blocks, separate from the map's 32×32 storage chunks.
  - **Why:** a 32×32 bake took ~55 ms (a visible hitch), an 8×8 bake a few ms. Bakes can use any tile rect, so the two sizes do not need to match.
- **Decision:** Depth uses a per-pixel prop "base y" baked with the terrain, not separate sprite objects.
  - **Why:** props stay baked, so drawing them costs nothing per frame. Hiding an entity is one array lookup per sprite pixel. It gives correct overlap for canopies and rocks, and it works for NPCs in C21 the same way.
- **Decision:** Half-water shore tiles are walkable only when the water is on the top half.
  - **Why:** the sprite stands at the bottom of its tile. Water at the bottom puts the feet in it, and water on one side or diagonally runs the waterline through the body. Water at the top only shows behind the player.
- **Decision:** A step starts in the same frame as the key press.
  - **Why:** otherwise every walk took one extra frame, and a tile would not be exactly 16 frames as DESIGN.md says.

## Deviations from plan / design
- DESIGN.md: added the overworld character look (Presentation). Sizes unchanged (16×24).
- Shore collision tuned (the C19 follow-up). On a 2-corner tile with water at the bottom, the player stood with their feet in the water (seen in the browser). `WorldMap.liquidBlocks` now blocks 3+ liquid corners and any 2-corner tile except water on the two top corners, where the feet stand on the bank. Every exit is still reachable from the spawn (world-tool tests), and `map.json` is unchanged because collision is derived.

## Issues & known limitations
- Tall grass covers only the lower few pixels of the feet (the tufts in front of the base line). A proper "grass rustle" is C32 juice.
- A click while a path is running re-paths from the tile the player is walking to. A click on an unreachable tile does nothing (no feedback yet).
- The mouse cannot be held to keep walking toward the cursor. It is click only.
- `TerrainStream.occludes` reads only baked blocks. Entities are always in view, so this is fine; NPCs off screen are not drawn anyway.
- The HUD is a placeholder (zone name and controls). The real overworld UI and menus come in C22.
- `GridMover` has no running and no ledges or jumps, as designed (one speed).

## Verification
- `npm run check`: typecheck, lint, format, **511 tests (46 files)**: all pass.
- Browser (headless Chrome via puppeteer in the scratchpad, dev server, 960×540 × DPR 2 → 480×270 at ×4):
  - Launcher → "Overworld: test region": the player is at the spawn on the town crossroads, and the HUD reads "Test region · town".
  - Held D for 1.1 s → 4 tiles. Held S for 1.5 s → 6 tiles (finishes the step in progress). The HUD changed to "Sunny Meadow · Lv 3–8".
  - A tree below and to the left covers the player. Placed north of a tree, the player is hidden behind the canopy, shadow included, and walks out of it with A.
  - In tall grass, tufts are drawn over the feet.
  - Shore: before the fix, the player could stand on a bottom-water tile with the feet in the water. After it, that tile is blocked, and a top-water tile shows the feet on the bank with the water behind.
  - Click at a far tile: a 14-step path, the gold marker, arrival on the exact tile. The camera eased along.
  - 60.5 fps while running, max frame 16.8 ms. No console errors or warnings. Esc → back at the launcher.
- Done when "player walks the test region smoothly with keyboard and mouse": ✅

## Follow-ups
- **C21:** NPCs use `buildCharacterSheet(outfit)` with other outfits (the preview had 12 color variants: white, red, navy, forest…) and `GridMover` for roaming. Encounters hook into the `arrive` events. Entities drawn with the same `occludes` / `drawGrassOver` calls need sorting among themselves by base y.
- **C22:** pause menu on `Esc` (replaces "back to launcher"). The HUD moves into the real overworld UI.
- **C32:** grass rustle when stepping into tall grass, footstep dust, a bump sound/shake, camera lookahead.
- **C24:** bump and footstep SFX on `bump` / `step` events.
- **Later:** hold the mouse button to walk toward the cursor. Feedback for unreachable clicks.

## Notes for the next chunk
- `new OverworldScene({ content, input, mapId, onExit })`. `scene.player` is the `GridMover` (`tx`, `ty`, `facing`, `destination`, `moving`), and `scene.map` is the `WorldMap`.
- `GridMover.update(dt, intent, blocked)` returns `MoveEvent[]`. NPC tiles should be added to `blocked`.
- Entity drawing: sprite bottom on the tile bottom, base line `ty*16 + 14` (same as prop bases), and skip pixels where `stream.occludes(wx, wy, baseY)`.
