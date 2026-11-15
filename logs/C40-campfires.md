# C40 · Campfires (rest spots) — Log

- **Date:** 2026-11-15
- **Status:** done
- **Depends on:** C39

## Summary
Campfires are a way to heal without potions that keeps the walking and the risk. Facing a burning fire, `E` asks "Rest here for a while?". Yes heals the standing team, moves the day clock on 6 hours, respawns the wild Zorlings around and burns the fire down to embers for one in-game day. Fires sit in the three danger-zone camps (each with a tent) and on two long T2/T3 routes per region. The map window marks them once explored, and saves (v7) keep the clock and each fire's timer.

## What was built
- Props `campfire` (one solid tile) and `tent` (3×2 footprint), style A from the preview round: `src/game/world/campfire.ts`, registered in `props.ts`. The map bakes the fire burnt down (ash, logs, a few glowing embers). While a fire burns, the scene draws one of 4 full fire frames over it (`campfireLit`), so the flames sit between the back and front stones and flicker.
- New town ramps `fire`, `fireCore`, `ash`, `canvas`, `shade` in `buildings.ts`; `fire`/`fireCore` glow as `GLOW.flame`. `Canvas` is now exported for reuse.
- Rest rules, pure: `src/game/world/rest.ts` (`REST`, `restParty`, `restAt`, `fireLit`, `fireKey`, `dayClock`, `CampState`).
- `src/game/world/overworld/campfires.ts`: the world's fires, the one in front of the player, light pools (`campfire` 52 px, `embers` 14 px in `lighting.ts`) and the cached flicker frames per biome.
- Overworld scene: `offerRest` after NPCs and the ferry on `E`, `restAt` (heal, clock, `clearWild`, `world.heal` sound, a note when fainted Zorlings still need a center), fire drawables in the depth-sorted list with emissive flame pixels, and the day clock (`playtime + camp.clock`) for lighting. The debug `skipTo` now moves the day clock instead of the play time.
- `Atmosphere.begin` takes the day-clock time and extra lights (the fires, whose state changes in play).
- Map window: `campfire` marker (orange) from the region's props on explored tiles (`atlas.ts`, `map-window.ts`).
- Save v7: `camp: { clock, fires }` (`schema.ts`, `migrate.ts` 6→7, `codec.ts`, `new-game.ts`; title and debug launcher pass it to the scene).
- Overlay edits (`C40:` notes) in all three regions: camp fire + tent, and two route fires each (Verdale: Reed Marsh, Mistmere; Emberwaste: Cinder Dunes, Obsidian Wastes; Rimeholm: Squall Reach, Glacier Steps). Picked with a scratch script: the path tiles farthest (walking steps) from any center in each T2/T3 zone, then an open tile beside the path near there.
- Tests: `src/game/world/rest.test.ts` (resting, cooldown, key stability, sprites, placement, reachability, map markers) and a v6 → v7 migration test in `save.test.ts`.

## Decisions
- **Decision:** preview pick **A**: stone ring with crossed logs + cream canvas A-frame tent with a teal hem.
  - **Why:** user picked it ("go with A") from the preview page (https://claude.ai/artifact/CnEzD5ReiXa6aMmWEE4yoR).
  - **Alternatives considered:** B log teepee + patched dome, C cookfire with pot + lean-to.
- **Decision:** a per-fire cooldown of one in-game day, shown in the world as embers.
  - **Why:** the user asked for a cooldown. Embers need no UI, and "by this time tomorrow" keeps the old-game feel (no timer shown).
  - **Alternatives considered:** a global cooldown (would make the camp fire useless after a route rest); a cooldown in wild battles or steps (less readable in the world).
- **Decision:** the day clock is play time + an offset kept in the save; the play time itself is not changed.
  - **Why:** the save slots show play time; resting should not inflate it.
- **Decision:** 6 hours per rest (300 s of day clock).
  - **Why:** "a few hours" from the plan; enough to turn day into dusk or night into dawn, so a rest is felt.
- **Decision:** a fire heals the team only, not storage.
  - **Why:** storage lives at centers (DESIGN.md → Team); the plan says "every Zorling still standing".
- **Decision:** fire keys are `map:x,y` counted from the map's origin.
  - **Why:** a map that grows north or west (C36) keeps its fires' timers.
- **Decision:** the save version goes to v7 (with a migration) instead of an optional field in v6.
  - **Why:** consistent with earlier format changes, and `camp` is then always present after load.

## Deviations from plan / design
- None in scope. `DESIGN.md` updated: Tech (save keeps camp, v7), World (campfires, placement, map marker), Team (resting rules), and the map window's marker list.

## Issues & known limitations
- The balance sim (`npm run balance`) does not model rests; it ran as before. Rests may shorten potion use on the six long routes, which the sim does not see.
- Standing directly south of a fire, the player covers most of it (correct depth, but the flames are hard to see from there).
- On the map window a camp's fire marker can sit under the town label or the player marker when zoomed out.
- Resting is keyboard-only (`E` facing the fire); clicking a fire does not offer a rest.
- The night in the screenshots is the existing C32 soft night; the fire's pool shows clearly only from dusk to dawn, as lamps do.

## Verification
- `npm run check`: typecheck, lint, format and 928 tests pass.
- `npm run balance`: runs, report unchanged in kind (no rests modeled).
- `npm run smoke`: passed (boot, new game, save, load, battle, crash screen).
- Manual (scratch Playwright driver on the release build): a save moved next to Thornveil Camp's fire at night with the starter at 3 HP. `E` → "The campfire crackles. Rest here for a while?" → Yes → "Hours pass by the fire…", HP back to full, the save has `camp.clock = 300` and the fire's key. `E` again → the embers line. Screenshots showed the lit fire, its orange light pool, the tent and the map window.
- Done when:
  - the user picked the prop from previews ✅ (A)
  - resting works by keyboard ✅
  - saves, the balance sim and all tests pass ✅

## Follow-ups
- Balance: consider modeling rests in `npm run balance` if route potion use matters (C41 or later).
- Optional: offer the rest when the player clicks a fire (mouse path), like NPCs.

## Notes for the next chunk
- Day/night now reads `dayClock(camp, playtime)`, not play time. Anything new that depends on the time of day should use it.
- Save is v7; `GameState.camp` is optional in code (missing means no rests yet).
- New camp props go in the overlay as `{"op": "prop", "kind": "campfire" | "tent", "at": [x, y]}`; `rest.test.ts` checks every region has exactly one camp fire and tent near its `town-*-camp` anchor, 1–2 route fires in T2/T3, and that each fire can be walked up to.
