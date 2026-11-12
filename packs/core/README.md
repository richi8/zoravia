# core pack

The base content pack. The engine loads it like any other pack (`loadGameContent([corePack])`).

| File | Registry | Contents |
|---|---|---|
| `types.ts` | `types` | the 8 types: who each beats (×1.5), what it resists (×0.67), the condition it applies |
| `conditions.ts` | `conditions` | the 8 conditions: 3 turns each, side effects |
| `reactions.ts` | `reactions` | the 9 reactions (condition + move type → damage ×, ignore DEF, lingering effect) |
| `moves.ts` | `moves` | 20 test moves, 2–3 per type |
| `traits.ts` | `traits` | 4 test traits |
| `species.ts` | `species` | 10 test species (1-, 2-, 3-stage lines, a legendary); replaced by Region 1 content in C29 |
| `items.ts` | `items` | 3 potion tiers (bag cap 5) and the Zorb capture item |
| `bosses.ts` | `bosses` | test Titan and legendary boss forms |
| `maps.ts` | `maps` | region maps built by the world tool (`maps/<region>/map.json`); `test-region` for now. See `tools/README.md` |

Schemas live in `src/game/data/`. References are full ids (`"core:fire"`) and are checked after
loading, so a typo fails with `Unknown moves "core:embr"` and the pack and path it came from.
