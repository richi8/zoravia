# C36b · Map exploration — Log

- **Date:** 2026-11-15
- **Status:** done
- **Depends on:** C36

## Summary
Every map now starts dark and is revealed as the player walks. Entering a zone, or coming near a town, landmark or secret, shows a discovery toast with the place's name and level range. Discovered places are labelled on the `M` map.

A new **Atlas** is in the pause menu and opens with `E` from the map. It is layout A, "Ledger", from the preview round:
- each region's map, tinted by tier and fogged, with markers;
- Zones, Bosses and Quests lists;
- badges, hearts and Dex counts.

It never shows what the player has not discovered. Saves are now v6 and keep each map's exploration. Older saves get a reveal around what their progress proves.

## What was built
- **Exploration** (`src/game/world/explore.ts`, pure):
  - `ExploredMap`: 4×4-tile cells, revealed within 9 tiles of the player, plus the places discovered.
  - `mapPlaces`: a map's zones and its place anchors (`town`, `landmark`, `secret`, `lair`, `shrine`, `arena`, `heart`). Names come from the anchor keys ("town-thornveil-camp" → "Thornveil Camp").
  - `visit(map, explored, x, y)` reveals around a tile and returns the places discovered there for the first time:
    - a zone is discovered when the player enters it;
    - a town within 8 tiles of the player;
    - any other place within its anchor `radius`, or 4 tiles.
  - The save form `ExploredData` stores the cells as base64 bits, the places by key, and the map's `origin`. If a map later grows north or west, the cells move along, like saved places (C36).
  - `legacyExploration`: the reveal for saves made before exploration (see Decisions).
- **Atlas model** (`src/game/world/atlas.ts`, pure):
  - `atlasRegion(content, party, mapId, map, explored)` gives a region's:
    - zones: known flag, tier, levels, storm names, and each spawn seen or caught (its name only once seen);
    - fights: level, result, the weak spot once beaten or caught, and the zone it is in;
    - markers, on explored tiles only;
    - discovered places.
  - `atlasProgress` counts badges, hearts (Keepers beaten out of Keepers marked) and the Dex.
  - `atlasMaps` lists every start region's map.
  - `npcMark` derives an NPC's marker from the battles its dialogue starts: a trainer battle gives `trainer`, a boss battle gives `titan` or `legendary`. A pack's own `mark` wins.
- **NPC `mark`** (`src/game/data/npcs.ts`, optional): `trainer`, `trial`, `rival`, `titan`, `legendary`, `boss`, `gate`, `elder` or `keeper`. The packs now tag:
  - the trial master and apprentice in each region;
  - every Mira, including the finale;
  - the three region bosses;
  - in `dangerZone()`, the gate ranger, the Keeper and both Elder Titans.
- **Overworld** (`overworld-scene.ts`):
  - It reveals around each new tile the player stands on and toasts new places (`discoveryToast` in `ui/toast.ts`).
  - Its snapshot includes every map's exploration, so the exploration travels with `onTravel` and is saved.
  - Toasts now wait while a menu is open; before, they covered the Atlas.
- **`M` map** (`ui/map-panel.ts`, `overworld-menus.ts`):
  - Unexplored land is blank parchment with faint hatching (`fogTint` in `minimap.ts`).
  - Discovered places are labelled. Center and shop markers show only where explored.
  - At 1 px per tile it shows the part of the region around the player. Verdale is 280 tiles tall and no longer fit the screen whole.
  - `E` opens the Atlas, and a long key row widens the panel.
- **Atlas screen** (`ui/atlas-panel.ts`, 468×258):
  - Header: the regions as tabs, with badges, hearts and Dex counts.
  - Left: the map at 1 px per tile (`tierTint` + `fogTint`). It scrolls to the selected entry, which blinks.
  - Right: the Zones, Bosses and Quests lists, with a detail box below. Unknown entries read "???", including the kind of fight.
  - `F` opens a details card: every spawn seen, how many are not seen yet, storms, weak spot, the zone, and quest steps and reward.
  - Keys: `A/D` region, `W/S` select, `Tab` next list, `Q` close (the card first).
  - Map textures are cached by map and by how much is explored. None is freed on close, because the closing screen still draws during its animation.
- **Input**: a new action `next_tab` (`Tab`) in the menu context. It is also a key group, "Next list", on the Controls screen.
- **Save v6** (`src/game/save/`):
  - `explored` (map id → `ExploredData`), optional in the schema.
  - The v5→v6 step leaves it out, and `fromSave` then builds the legacy reveal.
  - `GameState.explored` is required (a new game starts with `{}`). Maps the packs no longer have are dropped.
  - New fixture `tests/fixtures/saves/v5.json`: a Verdale save at Fernhollow with one trainer beaten.
- **Balance checkpoints** (`tools/balance/checkpoints.ts`, the debug launcher's states) now get the legacy reveal, so their maps are not dark.
- **Tests** (840 in total, 80 files):
  - `explore.test.ts`:
    - the reveal radius;
    - place names and kinds;
    - zones and places discovered once;
    - save round trip, broken data reading as dark, and an origin shift;
    - the legacy reveal for Picnicker Nell's save.
  - `atlas.test.ts`:
    - a dark map gives nothing away;
    - every region has exactly 2 trial, 2 Titan, 1 legendary, 1 boss, 2 elder, 1 Keeper and 1 gate marker, plus at least 3 rivals and 14 trainers;
    - spawns seen and caught;
    - the weak spot only once a Titan is caught;
    - the finale Mira shows only once beaten;
    - progress counts.
  - Save tests: the v5 fixture migrates and gets a reveal that survives saving again; exploration round-trips, and unknown maps are dropped.
  - Toast test: `discoveryToast`.

- **Mouse support** (user follow-up, same day):
  - The Atlas reads left clicks in `handleInput` (`pointerPressed`) against hit areas rebuilt with each part:
    - region tabs and list tabs;
    - rows: a click selects a row, and a click on the selected row opens its card;
    - the ▲/▼ arrows, which page through the list;
    - the key hints, which do what their keys do.
  - A click on the map selects the nearest known entry of the list shown: a zone within 24 tiles of its middle, a fight within 10 tiles.
  - Any click closes the card. Right click is Back, as everywhere.
  - The `M` map's key hints (`E Atlas`, `Q Close`) are clickable.
  - Checked in headless Chrome with real mouse events:
    - pause menu → Atlas;
    - the Bosses tab, then a row, then the same row again (the card opens);
    - a click elsewhere closes the card;
    - a click on Hollow Oak on the map selects Mossback Titan;
    - the Emberwaste tab;
    - "Q Close";
    - "E Atlas" on the `M` map.

## Decisions
- **Decision:** layout A "Ledger" and blank-parchment fog.
  - **Why:** the user's picks from the preview round (https://claude.ai/artifact/LUA1tYrK6VKcgN117Ptr6c).
  - **Alternatives considered:**
    - B, map first, with the lists one key further away;
    - C, a world page first, which adds a step before the details;
    - an ink-wash fog.
- **Decision:** the `M` map keeps 1 px per tile and crops around the player, rather than shrinking the whole region.
  - **Why:** since C36, Verdale is 280 tiles tall and did not fit the 270 px screen. A half-size map was tiny and blurred, and the Atlas shows the whole region anyway. The preview was changed to this before the user picked.
- **Decision:** cells are 4×4 tiles, revealed within 9 tiles, about half the visible screen height.
  - **Why:** the fog edge reads as pixel art at 1 px per tile, and a save stays small. Verdale's 3 500 cells take about 600 base64 characters.
- **Decision:** zones are discovered by entering them; other places from within a radius.
  - **Why:** the plan says "entering a zone". Seeing the edge of a zone from outside should not count. Towns use a bigger radius because their anchor is the middle of the town.
- **Decision:** place names come from the anchor keys, so the schema did not change.
  - **Why:** every shipped anchor key reads well as a name. A pack that wants a different name can rename the key, or a `name` field can be added later.
- **Decision:** Atlas markers come from an optional NPC `mark`. Trainers, Titans and legendaries are derived from the NPC's battles.
  - **Why:** content stays in packs. Most NPCs need no tag, and the ones that do are made by a few helpers.
  - **Alternative considered:** deriving everything (for example, "a one-member trainer with a boss is an Elder"). It was too fragile.
- **Decision:** hearts are counted as Keepers beaten out of Keepers marked, not with core's `hearts-charted` flag.
  - **Why:** game code would otherwise name a pack's flag. A future region's Keeper counts automatically.
- **Decision:** an NPC marker shows while the NPC is there (its `when` holds) or once beaten. A fight already won counts as known even on a dark map.
  - **Why:**
    - Mira's finale should not appear before it happens.
    - Without the second rule, an old save would list a beaten trial master as "???".
- **Decision:** the Quests list is the global quest log, the same in every region.
  - **Why:** quests are not tied to a map, and core's meta-quest spans all regions.
- **Decision:** the reveal for old saves covers 12 tiles around the save's place and last center, every trainer beaten, every boss logged, and the start spot of each region with any of those. Zones at those spots and places inside the revealed cells are discovered quietly.
  - **Why:** it is the "sensible reveal" the plan asks for. Only what the save proves is revealed, so the danger zones stay dark.

## Deviations from plan / design
- `DESIGN.md` updated:
  - Tech: save v6 and the reveal for old saves;
  - World: exploration, the `M` map, the Atlas and NPC marks;
  - Controls: `Tab` "next list", `E` on the map, the Atlas in the pause menu.
- `IMPLEMENTATION_PLAN.md`: the user's Atlas addition to C36b (uncommitted at the start) is committed with this chunk.
- New input action `next_tab` (`Tab`). The plan named only `A/D`, `W/S` and `F`, and the lists needed a key.

## Issues & known limitations
- Exploration is per map. The ferry and pass links reveal nothing on the other side until the player arrives.
- The zone blink is a fixed 24×18 box around the zone's middle (the average of its tiles). For a long curved zone it can sit off the zone's actual tiles.
- Map labels can overlap where places are close together. There is no collision avoidance.
- The `M` map and Atlas show discovered **places**. NPC markers appear only in the Atlas.
- The count of "???" rows shows how many zones and fights a region has. The plan accepted this ("appear as ?").
- Map textures are rebuilt when exploration changes. That takes a few milliseconds per region, done once per opening.

## Verification
- `npm run check`: typecheck, lint, format and tests all pass (80 files, 840 tests).
- Headless Chrome on `vite` (960×540, scratch `cdp.mjs`):
  - A new Verdale game shows the "Town · Willowmere" toast.
  - Walking reveals cells.
  - After teleporting to several spots, the `M` map shows parchment fog, labels (Stone Circle, Fernhollow, Willowmere, Galecrest), center and shop markers, and "E Atlas".
  - The Atlas opens from the map:
    - Zones list: "???" rows, a selected zone that blinks, the F card;
    - Bosses list: Warden Elm beaten (✓), the caught Mossback Titan (★), Mira rows, unknown fights with no kind;
    - Quests list: "No quests yet";
    - `D` to Emberwaste: "Not explored yet".
  - The pause menu has "Atlas".
  - No console errors after the fixes. The first runs found two crashes, both fixed:
    - a destroyed blink outline when the map was rebuilt;
    - a texture freed while the closing animation still drew it.
- Done when:
  - Exploring reveals the map: ✅ (browser, and `explore.test.ts`).
  - The Atlas opens from the pause menu, follows exploration and is fully usable by keyboard: ✅ (browser, and `atlas.test.ts`).
  - Old saves load with a sensible reveal: ✅ (v5 fixture test and the legacy test).
  - The map stays fully usable by keyboard: ✅ (`M`, `E`, `Q`).

## Follow-ups
- **Seamless world** (Later): exploration would become per world, not per map.
- Label collision avoidance on the maps, and a zone outline instead of a fixed box for the selected zone.
- Optional `name` on anchors, if a pack wants a place name that differs from its key.
- An overworld hotkey for the Atlas, if playtesting wants one (it is in the pause menu and behind `E` on the map).
- C37 accessibility pass: check the Atlas's 7 px labels and the contrast of the fog.

## Notes for the next chunk
- **A new region pack**:
  - Give its special NPCs a `mark` (trial, rival, boss). `dangerZone()` already marks the gate, Keeper and Elders.
  - Its start map appears in the Atlas automatically.
  - Name its place anchors with readable keys and one of the place kinds, so they are discovered and labelled.
- `GameState.explored` is required. Anything that builds a state by hand must pass `{}`, or `legacyExploration(...)` to get a reveal.
- Scratch files in this session's scratchpad:
  - `atlasprev.ts` and `prev/` (preview renders and page);
  - `npcs.ts` (NPC battle listing);
  - `cdp.mjs` with `steps.json` (browser check).
