# C21 · NPCs & encounters — Log

- **Date:** 2026-11-13
- **Status:** done
- **Depends on:** C18, C20

## Summary
The overworld now has people and wild Zorlings. Packs place NPCs on any map through a new `npcs` registry. NPCs stand, look around or wander, block the player, turn to face them and talk (paged dialog box). Wild Zorlings spawn from the zone spawn tables around the view, roam their zone as 32×32 sprites and react to the player: calm, curious (a "!" and a chase) or shy (they run). Walking into one, or being caught by one, plays the battle transition into a wild battle. The world resumes after it with the result written to the party.

## What was built
- **NPC data**, `src/game/data/npcs.ts`: the `npcs` registry (Zod). Fields: `name`, `map`, either `anchor` or `x`/`y`, `facing` (default: the anchor's), `look` (outfit, hair, skin presets), `behavior` (`stand` | `look` with `every` | `wander` with `radius` and `every`) and `lines` (one dialog page each). Load-time checks: the map exists, the anchor exists in it, x/y inside it, exactly one of anchor or x/y. `npcPlace(npc, map)`. `GameContent.npcs`.
- **Outfits**, `src/game/world/overworld/outfits.ts`: 12 outfit ids (the C20 preview color variants: teal, white, red, navy, forest, mustard, black, sky, purple, orange, mono, maroon), 5 hair colors, 4 skin tones. `outfitOf(spec)` gives a full `Outfit` for `buildCharacterSheet`.
- **Actors**, `src/game/world/overworld/actors.ts` (pure, seeded):
  - `NpcActor`: a `GridMover` at 2.2 tiles/s, behavior timers, `talking` (stands still), `faceToward`.
  - `Roamer`: a wild Zorling with species, level, zone, home and temperament. States `idle | walk | chase | flee`; `alert` ("!" timer), `cooldown` (after the player ran), `side` (sprite facing). Tunables in `ROAM`: wander 2, chase 3, flee 3.2 tiles/s (the player walks 3.75, so you can always get away); notice range 4, flee range 3, give up at 8; home radius 5; temperaments 35% calm / 40% curious / 25% shy.
- **Simulation**, `src/game/world/overworld/sim.ts`: `OverworldSim` holds the player, the map's NPCs and the roamers.
  - Everyone blocks everyone: an actor holds its tile and the tile it walks to.
  - Spawns (`SPAWN`): at most 8 wild Zorlings, one per 70 zone tiles in the view plus 6 tiles. Never in a zone without spawns (towns), never within 4 tiles of the player. Tall grass is preferred (other ground kept 35% of the time). After the first fill, spawns only happen off screen. Zorlings more than 12 tiles outside the view despawn, and they stay in their zone.
  - `pickSpawn(zone, rng)`: species by weight, level from the spawn's own range or the zone's.
  - Encounters: the player bumps into a wild Zorling, or a chasing one walks into the standing player. `facing()` is what `E` talks to or touches. `battleSeed()`, `remove`, `clearWild`.
- **Party**, `src/game/player/party.ts`: `Party` (team, storage, bag, money), `applyBattleResult` (HP, XP and items written back; a catch goes to the team while it has fewer than 3, else to storage), `teamDown`, `healTeam`. A placeholder until C22 and C23.
- **Overworld scene** (`src/game/scenes/overworld-scene.ts`, rewritten around the sim):
  - Draws the player, NPCs and wild Zorlings back to front by y. All of them are hidden by props in front (C20 depth), get a shadow, and have tall grass drawn over their feet. Wild sprites are `renderZorling` at 32 px (cached per species, mirrored for left) with a 1 px hop while walking. A paper "!" bubble shows on alert.
  - `E` talks to the NPC in front (it turns to the player; a dialog box replaces the HUD while it is open; the world pauses). Clicking an NPC or a wild Zorling walks next to it, faces it and talks or starts the battle.
  - Encounter: a 0.4 s "!" beat, then `BattleScene` (wild, the party's team and bag) with `battleTransition`. On return: win or catch removes the Zorling; a catch into storage says so; running spooks it (no battle for 4 s, it runs off). Losing heals the team, clears the wild Zorlings and puts the player at the spawn point with a message (no centers yet).
- **Launcher**: "Overworld: test region" (C21) now passes `engine`, `ui`, `theme`, battle speed, confirm-switch and a party (three Lv 9 starters plus the test bag), kept between visits. After each battle the launcher shows the team's HP and the storage count.
- **Content**, `packs/core/npcs.ts`: 5 test NPCs in the test region. Elder Rowan (looks around), Shopkeeper Ida (stands), Pip (wanders), Ranger Ode (looks around) and Fisher Lou (stands by the pond).
- `GridMover.speed` is now mutable (wild Zorlings change it per state).
- Tests: `src/game/world/overworld/sim.test.ts` (17): registry and load errors, outfits, NPC placement, blocking, facing, the three behaviors, no moves while talking, spawn weights and levels, fill rules, determinism per seed, zones kept, despawn, no spawns in town, bump encounter, cooldown, curious chase with "!", shy flight, the party helpers, and a 10-minute random-walk soak. **528 tests total.**

## Decisions
- **Decision:** NPCs live in their own `npcs` registry that points at a map, not inside the map file.
  - **Why:** any pack can add people to any region (expansions, quests) without touching the map or the world tool. The map keeps its anchors, so an NPC can stand at a named point.
  - **Alternatives considered:** an `npcs` block in `overlay.json`. It would tie NPCs to the region's own pack and need world-tool changes.
- **Decision:** NPC looks use presets (outfit, hair, skin) instead of raw colors.
  - **Why:** the C20 body has 14 palette slots. Presets keep NPCs on the approved look and make pack data short. The outfit sets are the C20 preview variants the user saw.
- **Decision:** Wild Zorlings have temperaments: calm, curious (notices within 4 tiles, shows "!", chases at 3 tiles/s) and shy (runs away).
  - **Why:** DESIGN.md says encounters are visible and there are no random grass battles. Reactions make roaming Zorlings feel alive. Chasers are slower than the player, so a battle is always avoidable.
- **Decision:** The world pauses while a dialog is open and during the encounter beat.
  - **Why:** nothing can walk into the player while they read, and the scene does not need extra rules for that.
- **Decision:** Running away leaves the Zorling in the world, but it can't start a battle for 4 s and it runs off. Winning or catching removes it.
  - **Why:** otherwise the player would be pulled straight back into the same battle.
- **Decision:** Losing heals the team and returns the player to the spawn point.
  - **Why:** there are no Zorling centers yet (C22). Recorded as a follow-up.
- **Decision:** Battles use the existing placeholder backdrop and no weather.
  - **Why:** the overworld has no weather yet, and the test region is a forest anyway. Biome backdrops and weather are follow-ups (see below).

## Deviations from plan / design
- `DESIGN.md` unchanged: no rule changed. Spawn density, speeds, ranges and temperaments are new starting values in code (`SPAWN`, `ROAM`), to tune in C31.
- The plan says "level by tier". Levels come from each zone's fixed levels (and a spawn's narrower range), and those sit inside the tier's band (C19 checks it). So levels follow the tier.
- A minimal `Party` holder was added (`src/game/player/`). The overworld needs a team for battles before C22's party screens exist.

## Issues & known limitations
- Zorlings only have side-view sprites. Walking up or down keeps the last left/right facing.
- A 32 px Zorling standing next to the player can overlap them by a few pixels (both are wider than a tile); they are sorted by y, so overlap order is right.
- Wild Zorlings appear in a zone next to its border with that zone's levels (a Lv 16 Voltbat from Reed Marsh can stand right next to Sunny Meadow). That is per the map's zones; C28 shapes real borders.
- Catching into storage was checked by unit test only. In the browser, catching was not repeated (C18 already covered the capture flow). The storage message comes from the same code path.
- During the browser checks, two driver runs hung right after the laptop woke from sleep. Re-running the same steps passed, and the soak test (10 min of random walking with encounters) passes. No hang was found in game code.
- The dialog box is the engine's C06 widget. There are no portraits or choices yet (C26).

## Verification
- `npm run check`: typecheck, lint, format, **528 tests (47 files)**: all pass.
- Browser (headless Chrome via puppeteer in the scratchpad, dev server, 960×540 × DPR 2 → 480×270 at ×4, keys unless noted):
  - Launcher → "Overworld: test region": the 5 NPCs stand in town in their outfits. The fisher is hidden behind a tree by depth.
  - Walked left to Elder Rowan and pressed E. He turned to the player, the dialog box ("Elder Rowan") replaced the HUD, E paged through 2 pages and closed it. E again talks again.
  - Clicked the shopkeeper (mouse): walked to her, faced up, and her line opened.
  - East into the meadow: 8 wild Zorlings around (Voltbat, Torrentoad, Emberkit, Sproutle…) roaming as 32 px sprites; a shy Voltbat flew off as the player came near.
  - Walked into a calm Voltbat: "!" bubble, battle transition, wild Voltbat Lv 16 battle.
  - Walked into an Emberkit Lv 3 and fought by E only: won, back in the world, the Emberkit gone, XP on all three (728 → 753).
  - Ran from an Emberkit: "Got away safely!", back in the world, the Emberkit fleeing with a 2.6 s cooldown; walking after it did not restart the battle.
  - Lost on purpose (team HP set to 1 through the dev handle): back at the spawn, team healed, wild Zorlings cleared, message "Your team fainted… You hurried back to town…".
  - 60.3 fps, max frame 16.8 ms in the meadow with 8 Zorlings. No console errors or warnings.
- Done when "walking into a roaming Zorling starts a battle and returns correctly after": ✅ (browser: win, run and lose all return to the world with the right state; unit tests for the bump and chase encounters)

## Follow-ups
- **C22:** losing sends the player to the last Zorling center (replace the spawn-point warp); the shop NPC opens the shop; party, storage and Dex screens use `Party`; the Dex logs Zorlings seen in the overworld.
- **C23:** save `Party`, the player's position and facing.
- **C24:** an alert sting on "!", footsteps, bump, NPC talk blips.
- **C26:** NPC `lines` become dialogue scripts (branches, conditions, quest hooks). Trainers that spot the player.
- **C27/C29:** trainer NPCs (line of sight → walk up → trainer battle) can reuse `NpcActor` and the encounter flow.
- **C31:** tune `SPAWN` and `ROAM` (density, chase speed, temperament mix).
- **C32:** spawn and despawn puffs, a front/back Zorling pose for up/down, an idle bob, a grass rustle when one walks in tall grass.
- **C34 (or with biomes in packs):** biome battle backdrops and overworld weather → `BattleSetup.weather` (C19 follow-up, still open).
- **Later:** rare spawns, time-of-day spawns (DESIGN "Later").

## Notes for the next chunk
- `new OverworldScene({ engine, content, input, ui, theme, mapId, party, onParty, onExit })`. `scene.sim` is the `OverworldSim` (`player`, `npcs`, `roamers`, `occupant`, `facing`), and `scene.party` is the current `Party`.
- Add NPCs in a pack's `npcs` content: `{ name, map, anchor | x/y, look, behavior, lines }`.
- After a battle, call `applyBattleResult(party, result)` and use `caughtTo` to tell the player where a catch went.
