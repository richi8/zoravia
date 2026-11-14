# emberwaste pack

Region 2 (C34): **Emberwaste**, a volcanic desert. Depends on `core` (types, conditions,
reactions, shared moves and items). Loaded with the rest in `packs/index.ts` (`SHIPPED_PACKS`).

| File | Registry | Contents |
|---|---|---|
| `species.ts` | `species` | 24 species in Dex order: starters Sizzlet, Pebbit, Pricklet (3-stage), the wild lines, the Titans' species, legendary Calderon |
| `moves.ts` | `moves` | Iron Crash (Metal's strong hit) and the bosses' signature moves |
| `traits.ts` | `traits` | Landslide (Earth +20%), Forged (Metal +20%) |
| `bosses.ts` | `bosses` | Dunewyrm Titan (Steam Burst), Forgeback Titan (Shred), Calderon (Frozen), Gorran's Kiln Ironjaw (Shatter) |
| `maps.ts` | `maps` | `emberwaste`, 200×200 desert, built by the world tool from `maps/emberwaste/` (`ember-pass` links to Verdale) |
| `npcs.ts` | `npcs` | healers and clerks |
| `trainers.ts` | `trainers`, `dialogues`, `npcs` | 11 route trainers (one table) and the Titan / legendary lairs |
| `story.ts` | `badges`, `trainers`, `quests`, `dialogues`, `npcs` | the Kiln Badge and Forge Trial, Rival Mira, Glassmaker Gorran, "The Cold Forge", four side quests, signs, stones, hidden items |
| `starts.ts` | `starts` | the Emberwaste start (Lv 6 starter, 2 Potions, 5 Zorbs, 500 coins) |

Ash storms: the Cinder Dunes, Ashfall Slopes and Caldera Rim zones set `battleWeather:
['core:burning']`. Tests: `emberwaste.test.ts` (map, storms, Ember Pass), `roster.test.ts`
(roster, trainers, boss sims), `story.test.ts` (placement and the whole campaign);
`tools/balance/emberwaste.test.ts` (playthrough).
