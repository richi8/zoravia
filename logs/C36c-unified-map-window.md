# C36c · Unified map window — Log

- **Date:** 2026-11-15
- **Status:** done
- **Depends on:** C36b

## Summary
The `M` map, the Atlas and the `J` quest log are now one **map window**, built around one world map. It is layout A, "Ledger", from the preview round (https://claude.ai/artifact/89DrgxinP33QcTg13WWfu4), with ½ px zoom.

Every region sits at a fixed world place. Emberwaste is east of Verdale at Ember Pass, and Rimeholm is south across the sea at the ferry. There is no region switch any more. On the right are expandable Zones, Bosses and Quests groups. Saves did not change.

## What was built
- **World places** (`src/game/data/starts.ts`): a new optional `world: { x, y }` on a start entry. It is the world tile of the map's top-left corner. The check reports:
  - regions that overlap;
  - one map placed differently by two starts.

  The packs set:
  - Verdale (0, 0);
  - Emberwaste (200, 80): its pass tile (0, 104) is the world tile east of Verdale's (199, 184);
  - Rimeholm (−12, 304): its ferry (100, 0) is straight under Verdale's (88, 279), across 24 tiles of sea.
- **World layout** (`src/game/world/world-layout.ts`, pure):
  - `worldLayout(content, extra)`: the start regions at their places. A map without a place (a start without `world`, or a debug map) goes east of the others with a 16-tile gap.
  - `worldBounds`: the world is 492×584 tiles.
  - `worldLinks`: every pass and ferry between placed regions, once each, with both ends in world tiles. For a link across a gap, it also gives the sea rectangle between the two regions (`gapBetween`).
- **Fog phase** (`minimap.ts`): `fogTint` takes a `phase`, the map's world `x + y`. The hatching of every region then lines up with the hatched ground between regions, so no region edge shows. Before the fix, the zoomed-out view showed each region's rectangle.
- **Map window** (`src/game/ui/map-window.ts`, 468×258). It replaces `atlas-panel.ts`, `map-panel.ts` (with `NoticePanel`) and `quest-panel.ts`.
  - **Header:** the title, where the player is, and badges, hearts and the Dex.
  - **Map:**
    - the ground is hatched parchment (a 5×5 tiling texture in the world's phase);
    - the sea and dotted route of a ferry once one end is explored;
    - each region's fogged, tier-tinted map at its place;
    - markers (and centers and shops of the current map);
    - discovered place names;
    - the blinking selection and the player.
    - Markers and labels are drawn unscaled on top, so they keep their size when zoomed out.
  - **Zoom:**
    - It toggles between 1 px and ½ px per tile.
    - Zoomed out, region names (in the middle of the discovered places) replace place names, and trainer dots are hidden.
    - The view clamps to the world bounds with 8 tiles of margin and follows the selection.
  - **Groups:** Zones, Bosses and Quests, with counts ("5/39", "2/37", "1 active", plus "New" when a quest is fresh).
    - One group is open at a time.
    - Zones and Bosses have a region subheading per region. A region with nothing discovered shows "Not explored yet", without its "???" rows.
    - Quests are split under "Active" and "Done · n".
    - Selecting a header centers the map on the player and the summary says where they are.
  - **Card (`F`):** what the Atlas card showed. A quest's card has its giver, summary, steps so far, reward and "New". The card sits over the map, so the list stays in view.
  - **Keys:** `W/S` headers and rows, `E` open or close a group (on a row: the card), `F` card, `Z` zoom, `Q` close (the card first).
  - **Mouse:**
    - a header click opens or closes the group;
    - a row click selects it, and a second click opens the card;
    - the ▲/▼ arrows page through the list;
    - key hints do what their keys do;
    - a map click picks the nearest known fight (10 tiles), else zone (24 tiles), from all regions, and opens its group;
    - any click closes the card.
- **Menus** (`overworld-menus.ts`):
  - `openMap(group?)` builds the window from the layout, each region's Atlas model and exploration, the quest log with "New" flags, and the known links.
  - `openQuests()` is `openMap('Quests')`.
  - The pause menu has one "Map" entry instead of "Map", "Atlas" and "Quests".
  - Quests count as read when the Quests group is first opened, not when the window opens.
- **Input:** the C36b action `next_tab` is now `zoom`, with keys `Z` and `Tab`. On the Controls screen it is "Map zoom". A stored binding for `next_tab` is skipped on load, as for any unknown action.
- **Tests** (846 in total, 81 files): `world-layout.test.ts`:
  - the three offsets and the world bounds;
  - no overlaps;
  - the pass ends are neighbours, and the ferry runs straight south over a 188×24 sea;
  - an unplaced map goes east;
  - `gapBetween`;
  - a pack whose start overlaps Verdale is rejected.

  `settings.test.ts` now uses `K` as its free key, since `Z` is bound.

- **Mouse follow-up** (user, same day: "the map list is not scrollable by mouse, also add mouse pan"):
  - **Engine input:**
    - `InputManager.wheel(dy)`, `wheelDelta` per step and `rawHeld(code)`;
    - the DOM adapter listens to `wheel` on the canvas (non-passive, so the page does not scroll) and counts lines and pages as 16 and 400 px;
    - `UiInput` has optional `pointerHeld()`, `pointer()` and `wheel()`, so existing widgets and test mocks need no change.
  - **Map window:**
    - The wheel over the list scrolls it, 30 px per line, without moving the selection.
    - The ▲/▼ arrows now page the list view instead of the selection.
    - Keys still keep the selection in view.
    - The wheel over the map zooms: down zooms out, up zooms in (90 px per step).
    - Dragging the map pans it. A press becomes a drag after 3 px; a press without a drag still picks the nearest entry on release.
    - The view stays within the world bounds. Zooming keeps a panned center.
    - The pan ends when the selection moves, so the map follows the selection again.
    - The map is built one box beyond each edge. A drag only moves it, and builds it again only near that edge, so text is not redrawn every frame.
  - `E` on an open group's header reads "Fold", so it no longer shows "Close" twice next to `Q`.
  - **Test:** `input-manager.test.ts` covers a held button and the wheel per step.
  - **Browser check** (real CDP mouse events):
    - a drag of 150×100 px moved the center from (160, 190) to (121, 240), stopping at the world's west edge;
    - the wheel over the list scrolled to Emberwaste and Rimeholm ("Not explored yet") with the selection kept;
    - the wheel over the map zoomed out and back in, keeping the center;
    - a drag at ½ px panned south over the sea;
    - `S` reset the pan to the selection.

## Decisions
- **Decision:** layout A and ½ px zoom.
  - **Why:** the user's picks from the preview round.
  - **Alternatives considered:**
    - B, a full map with floating groups, which cover the map;
    - C, details in a bottom strip, which makes the map shorter;
    - ⅓ px zoom, which fits the whole world but is too small to read.
- **Decision:** world places live on the start entry, not on the map JSON.
  - **Why:** the plan allowed either. A start entry is pack code next to the region's other settings, and needs no world-tool or map-format change. An expansion region places itself without touching core.
- **Decision:** the zoom key is `Z`, with `Tab` kept as a second key, and it replaces `next_tab`.
  - **Why:** the window has no list tabs any more, so `Tab` had nothing to do. A new action would have left a dead one. `Z` reads as "zoom" on the key hint.
- **Decision:** one group open at a time.
  - **Why:** each group is long (39 zones, 37 fights), and an accordion keeps the other headers in view. This matches the preview.
- **Decision:** a region with nothing discovered shows "Not explored yet" instead of 13 "???" rows.
  - **Why:** in one window the unvisited regions would otherwise fill the list with "???". The C36b rule still holds inside visited regions.
- **Decision:** the sea and route of a ferry show once either end is explored.
  - **Why:** "nothing undiscovered shows". The ferry is a known place on the Verdale side. The sea band has the width where the two regions face each other, so it hints at Rimeholm's width once the ferry is found.
- **Decision:** quest "New" tags count as read when the Quests group is opened.
  - **Why:** opening the map with `M` should not clear them unseen.

## Deviations from plan / design
- `DESIGN.md` updated:
  - World: one world map, the map window, zoom, and the groups. They replace the `M` map and Atlas bullets.
  - Story: the quest log is the Quests group.
  - Controls: `Z` (also `Tab`) map zoom; `M` and `J` open the map window.
- Map dragging (optional in the plan) was added in the mouse follow-up, with wheel scrolling and wheel zoom.

## Issues & known limitations
- Zoomed out, the world (292 px tall) is taller than the map box (214 px), so the map still scrolls vertically. The preview said so and the user accepted it.
- ½ px uses the 1 px textures scaled down with nearest sampling, so it drops every other tile column and row. It reads fine on tinted land, but thin paths can break up.
- The world places must be updated by hand if a region map grows north or west (as Verdale did in C36). The pass and ferry tests would then fail, which flags it.
- The zone blink is still a fixed box around the zone's middle (C36b limitation).
- Labels can still overlap (no collision avoidance).
- When a long group is open, the other headers can be scrolled out of view. The wheel, the ▲ arrow or `W/S` brings them back.

## Verification
- `npm run check`: typecheck, lint, format and tests all pass (81 files, 846 tests).
- Headless Chrome on `vite` (960×540, scratch `cdp.mjs`):
  - A new Verdale game with a few spots explored. `M` opens the window centered on the player (Galecrest), with labels, the sea band and the dotted ferry route.
  - `E` opens Zones, and `W/S` moves through the Verdale subheading, "???" rows and known zones. The map pans and blinks. `F` shows the card.
  - `Z` zooms out: hatching with no region seams, the "Verdale" name, and "Whole world · ½".
  - `J` opens the window with Quests open, the first quest selected, and the "New" tag on the header and the row.
  - The pause menu lists Party, Bag, Dex, Map, Save, Settings and Quit to title.
  - Travel to Emberwaste (scene `travel`, then fleeing the wild Dunewyrm at the pass). `M` centers on Cinderwell, with Verdale's saved exploration west of it at its world place.
  - Mouse:
    - a click on the Bosses header opens it;
    - a click on a row selects it, and a second click opens the card;
    - a click on the map closes the card;
    - picking near Hollow Oak selects the caught Mossback Titan.
  - No console errors.
- Done when:
  - The user picked a layout from the preview: ✅ (A, ½ px zoom).
  - All regions show on one world map at their offsets, with no region switch: ✅ (`world-layout.test.ts` and the browser).
  - `M`, `J` and the pause menu open the same window, which is fully usable by keyboard and by mouse: ✅ (browser).
  - Everything the quest log showed (steps, reward, giver, "New") is still reachable: ✅ (summary and card).
  - Old saves load unchanged: ✅ (no save change; the save fixture tests pass).

## Follow-ups
- **Seamless world** (Later): stream neighbouring maps at the world places, and turn the ferry into a boat ride. Exploration could then become per world.
- A ½ px minimap built by averaging 2×2 tiles, instead of nearest sampling, if thin paths look broken.
- C37 accessibility pass: the 7 px labels, the fog contrast, and whether `Z` is easy to find. The key hint shows it.

## Notes for the next chunk
- **A new region pack** sets `world` on its start entry. Pick a place that touches its link: a pass tile next to the other side's pass tile, or a ferry across a gap. The start check rejects overlaps. Without `world`, the region still shows, east of the world.
- The map window takes `AtlasRegion` models plus world places. To add something to it, extend `atlasRegion` (pure, tested) and draw it in `map-window.ts`.
- Scratch files in this session's scratchpad:
  - `worldprev.ts`, `png.ts` and `prev/` (the preview page);
  - `cdp.mjs` with `steps.json` and `steps2.json` (browser checks).
