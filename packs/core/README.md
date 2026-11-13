# core pack

The base content pack. The engine loads it like any other pack (`loadGameContent([corePack])`).

| File | Registry | Contents |
|---|---|---|
| `types.ts` | `types` | the 8 types: who each beats (×1.5), what it resists (×0.67), the condition it applies |
| `conditions.ts` | `conditions` | the 8 conditions: 3 turns each, side effects |
| `reactions.ts` | `reactions` | the 9 reactions (condition + move type → damage ×, ignore DEF, lingering effect) |
| `moves.ts` | `moves` | weak / mid / strong hits per type, status moves, boss signature moves |
| `traits.ts` | `traits` | 10 traits: type boosts, condition immunities, longer conditions |
| `species.ts` | `species` | Verdale's 23 species in Dex order (C29), plus Glacivar, the frozen coast's legendary, until Region 3 has its pack |
| `items.ts` | `items` | 3 potion tiers (bag cap 5) and the Zorb capture item |
| `music.ts` | `music` | hand-written boss themes (format in `src/game/data/music.ts`) |
| `bosses.ts` | `bosses` | Verdale's Titans (Mossback, Bogmaw), legendary (Verdion) and region boss's Storm Galehawk (C30), plus the test region's Thornwing Titan and Glacivar |
| `maps.ts` | `maps` | region maps built by the world tool (`maps/<region>/map.json`): `verdale` (Region 1, C28) and the C19 `test-region`. See `tools/README.md` |
| `npcs.ts` | `npcs` | test NPCs in the test region (anchor or x/y, look, behavior, lines or a dialogue, role), plus `verdale-npcs.ts`: Verdale's healers and clerks, and `verdale-trainers.ts`: its 11 route trainers and the Titan / legendary lairs (trainers, dialogues and NPCs) |
| `story.ts` | `dialogues`, `quests` | the test region's sample quest "Nothing Biting" (3 steps) and the dialogues of Fisher Lou and Ranger Ode. Format in `src/game/data/story.ts` |
| `verdale-story.ts` | `badges`, `trainers`, `dialogues`, `quests`, `npcs` | Verdale's campaign and lore (C30): the Grove Badge and trial, Rival Mira, the region boss Stormcatcher Vex, the main quest "The Still Wind", four side quests, townsfolk, readable signs and stones, hidden items |

Schemas live in `src/game/data/`. References are full ids (`"core:fire"`) and are checked after
loading, so a typo fails with `Unknown moves "core:embr"` and the pack and path it came from.
