# C11 · Biome tiles & weather — Log

- **Date:** 2026-11-12
- **Status:** done
- **Depends on:** C07 (plus C08b's virtual screen for the lab stage)

## Summary
The three launch biomes now have tiles drawn in code: forest & lakes, volcanic desert and frozen coast. Shorelines, paths and ground patches are autotiled from terrain stored per tile corner. Water ripples with pulsing foam, lava flows, tall grass sways and desert vents puff. Weather (rain, ash storm, snow) is drawn as particles plus a haze. The look is style **A · Storybook bright**, which the user picked from a three-style preview round. The lab section "Biome tiles & weather" shows a sample map for each biome on the 480×270 game screen, with a weather toggle and a tile grid overlay.

## What was built
- **Engine (no content):**
  - `src/engine/core/noise.ts`: `hash2`, `valueNoise`, `fbm` (seeded, stateless, in [0, 1)).
  - `src/engine/world/autotile.ts`: `CornerGrid` (a "dual grid": (W+1)×(H+1) corners per layer), `cornerMask` (0–15), `tileIs`, `coverage` (bilinear inside a tile, so it is continuous across tile borders).
  - `src/engine/render/pixel-buffer.ts`: `PixelBuffer` (a `Uint32Array` and RGBA bytes on the same memory), `packColor`, `unpackColor`, `blendPacked`, `dot`.
  - `src/engine/render/ramp.ts`: `rampIndex` (light → ramp tone, with a Bayer 4×4 dither band set by `sharpness`) and `bayer4`.
  - `src/engine/render/weather.ts`: `WeatherSim` runs data-described particle layers (dots or streaks, depth-based speed and alpha, sway, flicker, splashes) and a `HazeSpec` (a tint with moving diagonal bands and a top boost). It is seeded and pure.
- **Game** (`src/game/world/`):
  - `biomes.ts`: `BIOMES` (ramps per material: ground, alt, path, bank, liquid, tall, foliage, wood, rock, accent; foam, flowers, ground details, default weather) and `TILE_STYLE` (storybook settings).
  - `weather.ts`: `WEATHER` presets: rain (streaks and splashes, a cool tint), ash (grey flakes, flickering embers that rise, warm moving haze), snow (flakes in two sizes that sway).
  - `props.ts`: `Painter` (ramp lookup and outlines tinted from each material's darkest tone) and `buildProp` for 12 props: tree, pine, cactus, rock, snowrock, bush, crystal, shrub, flowers, pad, floe, vent. Each prop is a light field lit from the upper left. `PROP_INFO` holds the shadow, on-liquid, lift and vent flags.
  - `terrain.ts`: the `TerrainMap` format (layers alt, path and liquid as corner grids, plus props and tall-grass tiles) and `bakeTerrain(map, biome, rect?)`. It produces the static base, a prop overlay, a list of liquid pixels (edge and depth), tufts and vents. Shadows lower the light before the ramp lookup, so they stay on the palette. All noise is sampled in world pixels, so chunks join without seams.
  - `animate.ts`: `TerrainRenderer.draw(buf, camX, camY, t)` draws the ground, then water or lava, swaying grass, props and vent puffs, clipped to the screen.
  - `terrain-view.ts`: `TerrainView`, a Pixi container that draws terrain and weather into a screen-sized buffer every frame and shows it as one nearest-filtered sprite.
- **Lab:** `src/lab/sections/biomes.ts` (biome and weather buttons, tile grid, keys `1 2 3` / `W` / `G` on the focused stage) and `src/lab/biomes/sample-maps.ts` (30×17 sample maps with per-biome prop rules). The "coming in C11" placeholder (`sections/upcoming.ts`) is removed.
- Tests: `noise.test.ts` (3), `autotile.test.ts` (4), `weather.test.ts` (pixel buffer, ramp, weather: 7), `game/world/world.test.ts` (11). **268 total.**

## Decisions
- **Decision (user, preview round):** Style A, "Storybook bright", chosen over B "Classic crisp" (flat tones, black outlines) and C "Rich & moody".
  - **Why:** user choice from a scratchpad preview (all three biomes in three styles, animated, with weather), shown before any repo code, as the user prefers. A matches the paper UI and the battle mock backdrop.
- **Decision:** Autotiling by corners (a dual grid with bilinear coverage) instead of a hand-made 16- or 47-tile blob set.
  - **Why:** any coastline or path shape works with no transition art. Edges are rounded and organic, and the math is tiny and unit-tested (seams are tested). Layer order: ground < alt < path < bank+liquid.
  - **Trade-off:** tiles are not reusable per tile type, because each pixel depends on world-pixel noise. Instead, the map is **baked per chunk** (`bakeTerrain(..., rect)`). A test proves that two chunks match the whole map pixel for pixel. C20 can bake chunks as they stream in.
- **Decision:** Water, lava and grass animation run on the CPU (a per-pixel "software shader" into a `PixelBuffer`, then one texture upload per frame), not as a GPU shader as the plan said.
  - **Why:** the game screen is only about 130k game pixels whatever the window size, and only liquid pixels and tufts are recomputed. The lab runs at 60.0 fps (max frame 16.8 ms, 0 slow frames). It stays pure and testable in Node, and it keeps exact palette colors. A Pixi filter would need custom WGSL/GLSL and still has to snap to the palette.
  - **Revisit if:** C20 profiling on slow machines shows the frame is too heavy. The liquid pass would be the first thing to move to a shader.
- **Decision:** Shadows are a "light reduction" applied before the ramp lookup, not a dark overlay.
  - **Why:** every shadow pixel is still a ramp tone (it stays on the palette), and it gets the same soft dither.
- **Decision:** The engine weather sim is generic (`ParticleSpec` and `HazeSpec`). Rain, ash and snow are game data.
  - **Why:** the engine holds no content, and new regions can add weather without engine changes.
- **Decision:** Biome palettes live in `src/game/world/biomes.ts` for now, like the type colors in `tokens.ts`.
  - **Why:** packs have no biome schema yet. C19 (map format) is the natural place to move them into `packs/core`.

## Deviations from plan / design
- "Water shader" is a CPU per-pixel pass (see Decisions).
- `DESIGN.md` Presentation: added the world tile style (storybook bright, corner autotiling).

## Issues & known limitations
- Prop placement rules (trees in clusters, tall grass patches, and so on) are lab-only (`sample-maps.ts`). The real map tool (C19) will need its own placement and hand-edits.
- Tall grass is drawn under props. A tree directly south of a tall-grass tile would hide part of it correctly, but the player/NPC sorting with grass (walking "in" grass) is C20/C21 work.
- There is no player sprite on the sample maps yet, so the scale against a 16×24 character has not been judged. Check it at G1/C20.
- Trees in dense clusters overlap in a fairly regular grid. Fine for forest edges; hand-placed maps will vary it.
- The lava palette is bright. The user liked it in the preview, but it may need toning down next to battle UI.
- The ash haze blends every pixel every frame. That is cheap at 480×270, but it is the heaviest part of the frame.
- Pixel packing assumes little-endian (all browser targets).

## Verification
- `npm run check`: typecheck, lint, format, **268 tests**: all pass. `npm run build` succeeds.
- Browser (headless Chrome, dev server, `/lab/#biomes`, 960×540 stage at DPR 2 → 480×270 at ×4). Screenshots reviewed: forest with rain, desert with ash storm and vents, frozen coast with snow, frozen with clear weather + tile grid (shores and paths cross tiles cleanly), frozen with rain (weather switch), and biome change from a keyboard-pressed button. Keys `1 2 3`, `W` and `G` work on the focused stage. FPS: 60.0, max frame 16.8 ms, 0 slow frames. No console errors.
- Done when:
  - Lab shows a small sample map per biome: ✅
  - …with a weather toggle: ✅ (biome default, clear, rain, ash storm, snow)

## Follow-ups
- G1: judge tile scale against a player sprite. Also check lava brightness, tree cluster variety, and whether props need more variety (dead trees, logs, signs, buildings come with towns in C28).
- C19: move biome palettes and weather presets into pack data. The map format can reuse `CornerGrid` layers, `PropPlacement` and tall tiles. The world tool needs placement rules like `sample-maps.ts`.
- C20: bake chunks with `bakeTerrain(map, biome, rect)` and draw only the visible ones. Add camera scrolling (`TerrainRenderer.draw` already takes a camera). Sort players and NPCs against props by `by`, and add grass rustle on step.
- C15/C18: weather to battle-start conditions (ash → Burning, coastal storms → Wet, per `DESIGN.md`). Battle backdrops can reuse biome ramps.
- C32: lighting, and day/night tint through the haze path.

## Notes for the next chunk
- Draw a map: `new TerrainView(map, BIOMES[id])` in a scene, then call `resize(w, h)`, `update(dt)` and `render()`. For custom screens, use `bakeTerrain`, `TerrainRenderer.draw(buf, camX, camY, t)` and `WeatherSim.draw(buf)` directly.
- Terrain layers are per corner: a map of W×H tiles has (W+1)×(H+1) values per layer.
- Colors come from ramps (dark → light) plus a light value. Use `Painter.tone(material, light, x, y)` for anything new so it stays on the palette.
