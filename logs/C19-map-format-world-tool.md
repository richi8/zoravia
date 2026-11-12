# C19 · Map format & world tool — Log

- **Date:** 2026-11-12
- **Status:** done
- **Depends on:** C11, C12

## Summary
Regions now have a shipped data format and an offline pipeline. The world tool generates a region once from a seed (`generated.json`), merges a hand-edit overlay on top (`overlay.json`), and writes `map.json`, which the core pack imports. The game validates the map when packs load and decodes it into a `WorldMap`: terrain corner grids, tall grass, collision, zones with spawn tables, anchors and connection points, cut into chunks. A 96×96 forest test region ships in `packs/core`. A new launcher entry, "Map viewer: test region", shows it as an overview and as real tiles.

## What was built
- **Format and registry**, `src/game/data/maps.ts`: the `maps` registry (format v1, Zod).
  - Chunks of `chunkSize` tiles (32 by default) store rows of characters:
    - `corners`: one digit per corner (bits: alt 1, path 2, liquid 4). Same dual grid as C11.
    - `tiles`: one digit per tile (bits: tall grass 1, force-block 2, force-open 4).
    - `zones`: one zone glyph per tile.
    - `props`: `[kind, x, y, variant, dx, dy]`.
  - `zones` (name, glyph, tier `t1|t2|t3|danger`, fixed `levels`, `spawns` with weight and an optional narrower level range), `anchors` (kind, facing) and `connections` (`edge|sea|pass|ferry`, optional `to: "pack:region#id"`).
  - Load-time checks: chunk grid complete, row lengths, glyphs known and unique, props inside their chunk, anchors and connections inside the map, zone levels inside the tier band (T1 3–15 … danger 45–60). After loading: spawn species exist and are not legendaries. `GameContent.maps`.
- **Runtime**, `src/game/world/map/`:
  - `WorldMap`: corner grids, `flags`, `zoneIndex`, zones, props, anchors, connections. It derives collision: 3+ liquid corners or a solid prop blocks a tile, and forced flags win. Methods: `blocked`, `tall`, `zoneAt`, `chunkRect`, `chunksIn`, `reachableFrom` (flood fill), and `toTerrainMap()` for C11's `bakeTerrain(map, biome, rect)`.
  - `codec.ts`: `decodeRegion` / `encodeRegion`. `index.ts`: `loadRegion(content, id)`, decoded once per content.
  - `props.ts`: `PROP_KINDS` list and a `solid` flag per prop (trees, rocks, cacti, crystals, bushes and vents block; flowers, shrubs, pads and floes do not).
- **World tool**, `tools/world/` (run through `tools/run.mjs`, which loads TS through Vite so the path aliases work):
  - `config.ts`: `region.json` schema (name, biome, seed, size, zones by tier, exits).
  - `generate.ts`: seeded noise → a region. It builds a hub plaza with `spawn`/`center` anchors and no zone, and noisy tier rings with sectors per zone. Paths run from the hub to each exit (connection points), and lakes and lava never cut them. The frozen biome gets a sea coast. It adds alt ground, props and tall grass by per-biome rules (denser in outer tiers) and a solid border except at exits.
  - `overlay.ts`: overlay schema and `applyOverlay`. It merges zones (patch, add, `null` removes), anchors and connections, then runs these edits: `terrain` (rect), `stamp` (per-corner `#`/`-`/`.`), `tall`, `clearProps`, `prop`, `collision` (`block|open|auto`) and `zone`. Every problem is collected into one `OverlayError` with the edit index and note.
  - `files.ts`: region folders `packs/<pack>/maps/<region>/`, `buildRegion`, stable JSON (one chunk row per line, short arrays inline).
  - `ascii.ts` + `cli.ts`: `npm run world -- gen | build | check | show`. `gen` refuses to replace an existing base without `--force`.
  - `npm run build` runs `world -- build` first.
- **Content**, `packs/core/maps/test-region/`: `region.json` (forest, seed 1919, 96×96, 3×3 chunks, zones Sunny Meadow T1, Deepwood and Reed Marsh T2, Old Grove T3), `generated.json`, `overlay.json` (spawn tables and levels, a new "Lakeshore" zone, shop and elder anchors, a town pond with a lily pad, a tall-grass patch, the Zorling center's blocked footprint) and `map.json`. `packs/core/maps.ts` exports it.
- **Game**, `src/game/scenes/map-viewer-scene.ts` (launcher item "Map viewer: test region"):
  - Overview: 2 game px per tile, spawn, anchors and connections marked, the close-up viewport shown.
  - Close-up: real C11 tiles, baked one chunk per frame as they come into view.
  - Overlays: zones by tier, or collision.
  - Info line: tile, walkable, zone, tier, levels and spawns.
  - Keys: WASD/arrows move, E switches view, F cycles the overlay, Q goes back.
- Docs: `tools/README.md` (pipeline, commands, overlay reference), `packs/core/README.md`, `README.md`.
- Tests: `src/game/world/map/map.test.ts` (12) and `tools/world/world.test.ts` (14). **489 total.**

## Decisions
- **Decision:** Commit the generated base (`generated.json`) and treat it as frozen. `gen` needs `--force` to replace it.
  - **Why:** DESIGN.md says "generated once … then hand-edited". Overlay edits are placed against exact tiles, so a later generator change must not silently move the ground under them. The generator can keep improving for new regions.
  - **Alternatives considered:** regenerating from the seed on every build. Smaller repo, but any generator tweak would break every overlay.
- **Decision:** "Merged at build time" means `npm run world -- build` writes `map.json`, which the pack imports as plain JSON. `npm run build` runs it first, and a test fails when `map.json` is stale.
  - **Why:** the game ships only the merged map and never needs the overlay code. The staleness test keeps the three files from drifting.
  - **Alternatives considered:** merging at pack load (ships the overlay logic and the base). A Vite plugin with a virtual module would add tooling for little gain.
- **Decision:** Terrain stays per corner (C11 dual grid), packed as one digit per corner, with rows of characters in chunks.
  - **Why:** the C11 renderer and autotiler use it directly. Row strings make map diffs readable and gzip well (141 kB → 17 kB).
  - **Chunk ownership:** a chunk owns the top-left corners of its tiles, and the last chunk of a row or column also owns the closing corners. Nothing is stored twice.
- **Decision:** Collision is derived, not stored. Blocked: 3+ liquid corners, or a solid prop on the tile. The overlay can force tiles (`block` / `open`).
  - **Why:** it can never disagree with what is drawn. Overlay terrain edits update it automatically, and forced tiles cover buildings and bridges until they exist as real objects.
  - **Note:** 2-corner shore tiles are walkable. Tune in C20 if the edge feels off.
- **Decision:** Zone metadata (levels, spawns) for generated zones lives in the overlay, not in `region.json`.
  - **Why:** `region.json` is read only once, when the base is generated. Everything authored later belongs to the overlay, so you never have to regenerate to change a spawn table.
- **Decision:** Tiers are concentric rings around the hub, and zones sharing a tier split the ring by angle.
  - **Why:** this follows DESIGN.md's "tiered concentrically" with no extra data. Hand edits reshape zones where needed.
- **Decision:** Tools run through Vite's SSR module loader (`tools/run.mjs`).
  - **Why:** source files use extensionless `@game/*` imports and TS parameter properties. Node's type stripping cannot load them, and Vite is already a dependency (~50 ms startup).
- **Decision:** The map's biome is one of the game's `BiomeId`s (`forest`/`desert`/`frozen`), not a pack reference.
  - **Why:** moving biome palettes and weather into pack registries (a C11 follow-up) would change the lab and renderers. That goes beyond the map format, so it is kept as a follow-up.

## Deviations from plan / design
- No `DESIGN.md` changes. Tier level bands, "generated once, hand-edited", and fixed zone levels are all as designed.
- `tsconfig.node.json` now includes `vite/client` types, because tools import game code that reads `import.meta.env`.
- The C11 follow-up "move biome palettes and weather presets into pack data" is **not** done (see Decisions).

## Issues & known limitations
- **Bundle size:** the core pack now bundles the 141 kB map (17 kB gzipped). Vite's ">500 kB chunk" warning now shows for the shared chunk. Three full 200×200 regions would add roughly 1.5 MB raw. Maps should be fetched lazily before Region 1 ships (follow-up).
- The generator is a first version. The hub is an empty plaza, and there are no rivers, bridges, buildings or landmarks yet. Some tier rings reach the map edge as large T3 areas. Tall grass is dense. It is good enough for a test region. C28 will hand-curate the real one.
- Trees block only their trunk tile. The canopy above is drawn over the tile behind it, so the player can walk "behind" a tree. That needs depth sorting in C20.
- The map viewer's close-up bakes a chunk on first view (one per frame). That is a short hitch on slow machines, fine for a debug view. Real streaming is C20.
- A zone's spawns point to `core` test species, which C29 replaces.
- `connections[].to` is format-checked only. No other region exists yet to resolve it against.

## Verification
- `npm run check`: typecheck (browser + node projects), lint, format, **489 tests (45 files)**: all pass.
- `npm run build` succeeds. It rebuilds `map.json` byte-identically (git shows no change).
- `npm run world -- gen core/test-region` with the base present refuses (exit 1). `world -- check` reports "1 region map(s) up to date". `world -- show` prints the text map and zone view.
- Browser (headless Chrome via puppeteer in the scratchpad, dev server, 960×540 × DPR 2 → 480×270 at ×4, keys only):
  - Launcher → "Map viewer: test region" → overview with zone rings, paths to 4 red exit marks, spawn and anchors.
  - F → collision overlay → F → none → E close-up at the spawn: real forest tiles, plaza crossroads, the overlay's pond with its lily pad.
  - Held D/S pans into chunks not yet baked. Zones and collision overlays in the close-up: the pond is blocked, tree trunks and rocks are blocked, and the info line reads "Sunny Meadow (T1, Lv 3–8): Sproutle ×3, Emberkit ×2, Puddlit ×2, Voltbat ×1".
  - Q → back at the launcher.
  - 60.2 fps, max frame 16.8 ms in the close-up. No console errors or warnings.
- Done when:
  - Tool generates a test region: ✅ (`npm run world -- gen core/test-region`; the generator is deterministic per seed, and every exit is reachable from the spawn in all 3 biomes, tested)
  - Game loads it: ✅ (core pack validates and loads `core:test-region`; `loadRegion` test; map viewer in the running game)
  - Overlays override generated tiles: ✅ (test: the pond, forced collision, tall grass and the new zone differ from `generated.json` in the map the game loads; untouched areas are identical; `map.json` must equal base + overlay)

## Follow-ups
- **C20:** stream chunks with `map.chunksIn(view)` + `bakeTerrain(map.toTerrainMap(), biome, map.chunkRect(cx, cy))`. Collision is `map.blocked(tx, ty)`, and the start point is `map.anchors.spawn`. Add depth sorting so trees can be walked behind. Tune the shore rule (`LIQUID_BLOCK_CORNERS`).
- **C21:** roaming Zorlings from `map.zoneAt(tx, ty).spawns` (weights, level ranges). Biome weather becomes `BattleSetup.weather`, and battle backdrops come from the biome.
- **C28:** hand-curate Region 1 with the overlay. The generator may need rivers, bridges (`collision: open` over water), building footprints and landmarks. Check how big the tier rings are.
- **C28/C37:** load region maps lazily (fetch JSON per region or chunk) instead of bundling them in the pack module. Then remove the chunk-size warning.
- **C34:** move biome palettes and weather presets into a pack registry, so new regions can bring new biomes without game changes. The map's `biome` then becomes a ref.
- **Later:** a visual overlay editor (click to paint in the map viewer, export overlay JSON) would speed up C28.

## Notes for the next chunk
- `import { loadRegion } from '@game/world/map'; const map = loadRegion(content, 'core:test-region');`. It is decoded once per `GameContent`; treat it as read-only.
- Tile queries: `map.blocked`, `map.tall`, `map.zoneAt`, `map.anchors.spawn`, `map.connections`. Chunks: `map.chunksWide/High`, `map.chunkRect`, `map.chunksIn(rect)`.
- Drawing: `const t = map.toTerrainMap()` once, then `new TerrainRenderer(bakeTerrain(t, BIOMES[map.biome], map.chunkRect(cx, cy)), biome, map.seed)` per chunk. `src/game/scenes/map-viewer-scene.ts` shows a working example.
- To change the test map: edit `packs/core/maps/test-region/overlay.json`, run `npm run world -- build`, and use `npm run world -- show core/test-region [x y w h]` to find coordinates.
