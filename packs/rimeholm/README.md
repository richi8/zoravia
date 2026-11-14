# rimeholm pack

Region 3 (C35): the **Rimeholm Isles**, a frozen archipelago joined by piers. Depends on `core`
(types, conditions, reactions, shared moves and items). Loaded with the rest in
`packs/index.ts` (`SHIPPED_PACKS`).

| File | Registry | Contents |
|---|---|---|
| `kits.ts` | `modelKits` | the frozen model kit (C35a): seals, walruses, jellyfish, crabs, anglerfish, stoats, owls, caribou, urchins |
| `species.ts` | `species` | 25 species in Dex order: starters Selkit, Woolump, Sparkit (3-stage), the wild lines, the Titans' species, legendary Glacivar |
| `moves.ts` | `moves` | Thunderclap (Electric's strong hit) and the bosses' signature moves |
| `traits.ts` | `traits` | Live Wire (Electric +20%), Rimebound (Ice +20%) |
| `bosses.ts` | `bosses` | Floemaw Titan (Frozen), Squallwing Titan (Overload), Glacivar (Slam), Odessa's Lodestar Lumenaw (Rooted) |
| `music.ts` | `music` | Glacivar's theme, "The White Crown" |
| `maps.ts` | `maps` | `rimeholm`, 200×200 frozen islands, built by the world tool from `maps/rimeholm/` (`ferry` links to Verdale) |
| `npcs.ts` | `npcs` | healers, clerks and Ferryman Ola |
| `trainers.ts` | `trainers`, `dialogues`, `npcs` | 11 route trainers (one table) and the Titan / legendary lairs |
| `story.ts` | `badges`, `trainers`, `quests`, `dialogues`, `npcs` | the Tide Badge and Tide Trial, Rival Mira, Lampwright Odessa, "The Fading Lights", four side quests, signs, stones, hidden items |
| `starts.ts` | `starts` | the Rimeholm start (Lv 6 starter, 2 Potions, 5 Zorbs, 500 coins) |

Sleet storms: the Sleet Fells, Squall Reach and White Crown zones set `battleWeather:
['core:wet']` (with snow in the air). Tests: `rimeholm.test.ts` (map, storms, the ferry),
`roster.test.ts` (roster, trainers, boss sims), `story.test.ts` (placement and the whole
campaign); `tools/balance/rimeholm.test.ts` (playthrough).
