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

### Map format

See `src/game/data/maps.ts` (schema, validated when packs load) and
`src/game/world/map/` (`WorldMap`, `decodeRegion`, `loadRegion`). Collision is not stored:
it follows from terrain and props (a tile with 3+ liquid corners or a solid prop is
blocked), plus the overlay's forced tiles.
