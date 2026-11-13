# tools

Offline scripts. Not shipped in the game bundle. TypeScript tools run through
`node tools/run.mjs <module.ts> [args]`, which loads them with Vite so the `@game/*` /
`@engine/*` aliases work.

## World tool (`tools/world`, C19)

Regions are **generated once** from a seed, then **hand-edited** through an overlay. The
game ships the merged result.

```
packs/<pack>/maps/<region>/
  region.json     generator input (name, biome, seed, size, zones by tier, exits)   hand-written
  generated.json  the frozen generated base                                         tool output
  overlay.json    hand edits: zone spawns, anchors, connections, terrain fixes       hand-written
  map.json        generated + overlay, imported by the pack                          tool output
```

```sh
npm run world -- gen core/test-region            # region.json → generated.json (once; --force to redo)
npm run world -- build                           # generated + overlay → map.json (all regions)
npm run world -- check                           # fails if a map.json is stale
npm run world -- show core/test-region           # text view; add --zones, --generated, or "x y w h"
```

`npm run build` runs `world -- build` first, and `npm run check` fails when a `map.json` is
out of date. Never edit `generated.json` or `map.json` by hand. Regenerating a base
(`gen --force`) can shift everything the overlay was placed against.

### What the generator makes

A hub town near the middle (plaza, `spawn` and `center` anchors, no zone), tiers as noisy
rings around it (zones of the same tier split the ring into sectors), paths from the hub to
an exit on each listed edge (each gets a connection point), lakes / lava / a sea coast,
second ground, props and tall grass by per-biome rules, and a solid prop border. Water never
cuts a path and nothing solid stands on one, so every exit is reachable from the spawn.
Zones start with the tier's full level range and no spawns. The overlay fills them in.

### Authored layout (C28)

A `region.json` with a `layout` (Region 1, `core/verdale`) is laid out by hand instead of in
rings: the generator only adds the organic detail. See `layoutSchema` in
`tools/world/config.ts`.

- `towns`: cleared ground with a path plaza and no zone; the first is where the player
  starts (`spawn` anchor). Each gets a `town-<key>` anchor.
- `routes`: path polylines (`width`, `wobble`). Where a route crosses water it gets bridge
  decks (`bridge-v` / `bridge-h` props, walkable).
- `rivers` (polylines), `lakes` and `islands` (noisy ellipses), `ponds` (random pond
  threshold, 0 = none).
- `clearings`: cleared spots that become anchors (`id`, `kind`: lair, shrine, arena,
  landmark, secret). `ring: true` walls one with trees, open toward `gap`.
- `fords`: walkable lily-pad crossings over water.
- `zones`: per zone, `seeds` (each tile joins the zone of the nearest seed, noise-warped)
  and `trees` / `grass` / `wet` density shifts.
- `exits`: connection points on the edge (`edge`, `pass`, `ferry`, `sea`); the tree border
  stays open there.

Last, walkable pockets the spawn cannot reach are opened by removing the props in the way,
and whatever is still cut off is marked blocked, so every walkable tile is reachable.

### Overlay (`overlay.json`)

All positions are tiles from the map's top-left. Rects are `{ "x", "y", "w", "h" }`.

```json
{
  "name": "Optional new region name",
  "zones": {
    "meadow": { "levels": [3, 8], "spawns": [{ "species": "core:sproutle", "weight": 3 }] },
    "shore": { "name": "Lakeshore", "glyph": "s", "tier": "t1", "levels": [5, 9] },
    "unused": null
  },
  "anchors": { "shop": { "x": 52, "y": 46, "kind": "shop", "facing": "down" }, "old": null },
  "connections": { "east": { "x": 95, "y": 61, "kind": "edge", "to": "core:other#west" } },
  "edits": [
    { "op": "terrain", "layer": "liquid", "set": true, "rect": { "x": 60, "y": 53, "w": 4, "h": 2 } },
    { "op": "stamp", "layer": "path", "at": [10, 4], "rows": ["##-", ".##"] },
    { "op": "tall", "set": true, "rect": { "x": 63, "y": 46, "w": 6, "h": 2 } },
    { "op": "clearProps", "rect": { "x": 59, "y": 52, "w": 7, "h": 5 } },
    { "op": "prop", "kind": "pad", "at": [62, 54], "variant": 2 },
    { "op": "collision", "rect": { "x": 47, "y": 44, "w": 3, "h": 2 }, "mode": "block" },
    { "op": "zone", "rect": { "x": 30, "y": 47, "w": 12, "h": 10 }, "zone": "shore", "note": "why" }
  ]
}
```

- `zones`: fields replace the generated zone's. A new key needs `name`, `glyph`, `tier` and
  `levels`. `null` removes the zone. Levels must stay inside the tier's range (T1 3–15,
  T2 15–30, T3 30–45, danger 45–60).
- `anchors` / `connections`: a full entry adds or replaces, `null` removes.
- `edits` run in order:
  - `terrain` sets every **corner** of the tiles in the rect.
  - `stamp` edits corners one by one from corner `at`: `#` set, `-` clear, `.` keep.
    Corner (x, y) is the top-left corner of tile (x, y).
  - `prop` replaces whatever prop stands on that tile.
  - `collision`: `block` / `open` force a tile, `auto` follows terrain and props again.
  - `note` on any edit is kept for humans and shown in error messages.
- Errors list every problem at once, e.g.
  `edits[0] (tall: too wide): rect (6, 0, 4×1) leaves the 8×6 map`.

Town pieces are props too (C28): `center`, `shop` and `house` cover several tiles (their
tile is the door, in the bottom row; houses with `variant & 4` have the door on the right,
`variant & 3` picks the roof color), plus `well`, `sign`, `fence`, `lamp` and `menhir`.
Clear the footprint first (`clearProps`). Talking to a center or shop door talks to the
nearest NPC with that role. `packs/core/maps/verdale/overlay.json` places three towns.

### Map format

See `src/game/data/maps.ts` (schema, validated when packs load) and
`src/game/world/map/` (`WorldMap`, `decodeRegion`, `loadRegion`). Collision is not stored:
it follows from terrain and props (a tile with 3+ liquid corners or under a solid prop's
footprint is blocked, a bridge deck opens water), plus the overlay's forced tiles.

## Balance report (`tools/balance`, C31)

```sh
npm run balance                      # Markdown report for Verdale (10 seeds per team plan)
npm run balance -- --seeds 20 --out report.md
```

- `playthrough.ts`: an AI player plays a region's story in order from a new game with real
  progression. It catches its team, grinds the zones reached (real spawn tables), evolves and
  learns moves, buys potions, and fights every story trainer and boss through the battle
  engine, retrying after a loss. After 3 losses to a boss it follows the boss's hint (catches
  a Zorling of a type the Armor-breaking reaction needs). Pure and deterministic per seed.
- `verdale.ts`: Verdale's route (zones opened, shops, fights in order), the team plans (each
  starter plus two catches) and the assumed start.
- `report.ts`: the tables. Pacing and money from the playthroughs, every story trainer by
  team level, the bosses by play style, and each starter against the first zone.
- `playthrough.test.ts` runs the campaign for each team plan in CI and checks the pacing.

A new region adds its own route file and team plans next to `verdale.ts`.

