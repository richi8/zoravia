# C32 · Juice & presentation — Log

- **Date:** 2026-11-14
- **Status:** done
- **Depends on:** G2

## Summary
Polish across the overworld, battles, menus and big moments. The user chose the full scope: the plan's four deliverables plus the four groups of follow-ups from earlier logs (overworld juice, battle VFX polish, UI motion and toasts, big moments). The two taste-led parts went through preview rounds first: lighting (picked **A · Soft**, the time-of-day cycle and the area moods as shown) and the big moments (picked **Evolution A "Stage" without the rings** and **Splash A "Slash band"**). Everything was checked in a headless Chrome on the dev server as well as by `npm run check`.

## What was built
- **2D lighting** (`src/engine/render/lighting.ts`, `src/game/world/lighting.ts`, `src/game/world/overworld/atmosphere.ts`):
  - The engine's `LightMap` multiplies the frame by an ambient color and lifts it inside soft, warm-tinted round lights. Emissive pixels swap to a lit color, but only if nothing was drawn over them since. It's one screen pass plus one pass per light box, about 3 ms at 480×270 in Node.
  - Day/night is cosmetic, on the play clock: `DAY_LENGTH` = 20 min, and a new game starts in the morning (day → dusk → night → dawn).
  - Glowing props: building glass, lamp heads (a new `flame` town material) and menhir runes carry a glow code (`src/game/world/glow.ts`, `PropSprite.glow`, `TerrainBake.glow`). `TerrainRenderer.draw` passes them to a `GlowSink`.
  - `propLights` places light pools for lamps, window clusters and runes.
  - Area moods `canopy`, `shrine` and `mist` come from map data:
    - New optional `mood`/`weather` on zones, and `mood`/`radius` on anchors (`src/game/data/maps.ts`).
    - Moods ease in and out as the player walks.
    - Verdale now has: Heartwood Shrine and Stone Circle (shrine), Hollow Oak and the Deepwood and Old Grove zones (canopy), Sunken Hollow and Mistmere (mist).
- **Overworld weather:** zones can set cosmetic weather through the C11 `WeatherSim`. There's a new `mist` look. Mistmere has mist and Reedmarsh has rain.
- **Overworld juice** (`src/game/world/overworld/fx.ts`):
  - Grass bits and a rustle sound when stepping into tall grass. Wild Zorlings in view rustle too.
  - Dust puffs leaving path tiles.
  - A 1-px camera nudge on a bump.
  - A puff when a beaten wild Zorling or a vanishing Zorling NPC leaves while on screen.
  - A sparkle and a pickup jingle when a ground item is taken.
- **Screen transitions:** `engine.iris(center)` (`src/engine/render/iris.ts`) is a stepped pixel circle. It's used for entering the world from the launcher and for leaving battles, and it centers on the player.
- **Battle tuning** (`battle-scene.ts`, `vfx.ts`, `zorlings/actor.ts`, `zorlings/animate.ts`):
  - The hit flash is tinted by the move's type: the flash frames are marked, and the actor tints only those.
  - Hit-stop and shake take effectiveness into account. Resisted hits barely stop, while super-effective and big hits stop longer and shake harder.
  - Wet shows bigger drips and a puddle at the feet. Exposed shows bigger glints and blinking target brackets.
  - Captions fade and rise in and out (`BattleCaption.update`).
  - A victory pose: a hop and gold sparkles, plus a "Level up!" callout when someone leveled.
- **UI motion and toasts:**
  - `UiMotion` (`src/engine/ui/motion.ts`) is a `FocusHost` that fades and rises views in and fades them out. It moves `pivot`, so layout code is untouched. Used by the overworld, battle and launcher stacks.
  - Quest and badge notes are now toasts (`src/game/ui/toast.ts`) that slide down under the HUD and don't stop play. Other notes stay dialog pages.
  - The quest log shows a "New" tag on quests started or moved on since it was last opened (per visit).
  - Dialogue nodes take `narration: true` to drop the name tag, and the Titan visions use it.
- **Big moments:**
  - The evolution scene (`src/game/ui/evolution-panel.ts`) is now full-screen: a navy dim, slowly turning gold pixel rays, rising sparkles, the 2× silhouette swap, a full-screen flash, then a sparkle burst and the new species name. No rings.
  - The intro splash (`src/game/ui/intro-splash.ts`) plays for trainer and story-boss battles. Trainers show their sprite ×5 and VS. Bosses show the boss Zorling with a red band, and the subtitle is the trainer or "Titan"/"Legendary". It starts once the battle transition has uncovered the screen, and the first battle events wait for it.
  - `playJingle` (`src/game/audio/sound.ts`) ducks the music under the heal, evolution and quest-complete jingles.
  - New SFX: `world.rustle`, `world.pickup`, `world.intro`.
- **Debug:** `__zoravia.engine.scenes.top.skipTo('night' | 'dusk' | 'dawn' | 'day')` on the overworld (dev console).
- **Tests:** `src/engine/render/lighting.test.ts`, `src/engine/ui/motion.test.ts`, `src/game/world/lighting.test.ts` (day cycle, moods, Verdale lights, atmosphere easing, FX), and `src/game/ui/toast.test.ts`.

## Decisions
- **Decision:** Day/night is cosmetic, with a 20-minute day, and spawns don't change.
  - **Why:** DESIGN lists day/night spawns as "Later". A cosmetic cycle adds mood without touching balance or the C31 simulator.
  - **Alternatives considered:** a real-time clock (it ties the look to when people play) and a shorter day (night would come too often while grinding).
- **Decision:** Lighting runs on the CPU, over the overworld's existing pixel buffer.
  - **Why:** the overworld already draws every pixel there. One extra pass keeps the look on the pixel grid and stays in pure, testable code.
- **Decision:** Glowing windows are marked by material when the props are baked, not detected by color.
  - **Why:** it's exact and costs nothing per frame. The preview round used color detection, which only works as a hack.
- **Decision:** Toasts are used only for quest and badge news. Item notes stay dialog pages.
  - **Why:** quest news is a status update that the quest log keeps. Items received are part of the conversation.
- **Decision:** The "New" quest tag is tracked per visit, not saved.
  - **Why:** it's a convenience marker. Saving it would mean a save schema change for little gain.
- **Decision:** The evolution ray texture is cached once and never destroyed, and the intro splash frees its own portrait.
  - **Why:** with `UiMotion`, a closed view keeps drawing for 80 ms. Destroying its texture right away crashed Pixi (`getAdjustedBlendModeBlend`), which the browser test caught.
- **Decision:** Spawn and despawn puffs only show for Zorlings that leave on screen.
  - **Why:** wild Zorlings spawn and despawn outside the view by design (C21), so those puffs would never be seen.

## Deviations from plan / design
- `DESIGN.md` gained three lines under the presentation bullets: day/night is cosmetic with a 20-minute day, area moods and weather come from map data and never change battles, and the C32 presentation pieces.
- A small engine change: `TerrainRenderer.draw` / `TerrainStream.draw` take an optional `GlowSink`. The terrain bake has a `glow` layer and `PropSprite` has `glow`. All three are additions and backward compatible.
- Map schema additions are optional fields: zone `mood`/`weather`, and anchor `mood`/`radius`. `WEATHER_IDS` is now a `const` tuple with `mist`.
- The G2a follow-up "a short sound for blocked actions shown as captions" was already done (`flash()` plays `ui.blocked`), so nothing was added.

## Issues & known limitations
- Zone weather swaps instantly when you cross a zone border. There's no crossfade.
- The intro splash band edges and the evolution rays are vector or rotated shapes in the UI layer, so the diagonals aren't on the pixel grid. This is accepted, the same as the rest of the UI layer.
- The quest "New" tag resets on every visit (load).
- Lights are only for props. NPCs, the player and Zorlings give off no light (an Ember-type glow at night could be nice).
- In-world check: night, iris, menu motion, evolution and the trainer splash were checked in headless Chrome. The boss splash, the weather zones and the moods were checked through headless renders and tests, not by walking there in the browser.

## Verification
- `npm run check`: typecheck, lint, format and tests all pass (66 files, 681 tests).
- Headless renders of the real `Atmosphere` code: Willowmere at night and dusk, the shrine by day and night, Hollow Oak, and Mistmere.
- Headless Chrome on `vite` (a CDP script in the session scratchpad):
  - The launcher, then Play: Verdale with the iris centered on the player.
  - Dusk and night via `skipTo`: lit windows, lamp pools, no console errors.
  - The quest log opening with motion.
  - A full evolution: the scene, the reveal, back to the world, "Game saved".
  - A trainer intro splash (Picnicker Nell).
  - The dim was measured from screenshot pixels: it matches 0.78 navy.
- Plan deliverables:
  - 2D lighting ✅
  - Screen transitions ✅ (iris; the battle bars kept)
  - Camera shake / hit-stop tuning ✅ (battle tuning plus the overworld bump nudge)
  - Particles polish ✅ (overworld FX, Wet/Exposed overlays, evolution and victory sparkles)

## Follow-ups
- **C33:** a settings toggle for screen shake and flashes (accessibility), and the battle speed setting. The start flow should begin the play clock in the morning, which it already does with playtime 0.
- **C37:** an accessibility pass for flashes (the evolution and battle-transition white flashes) and reduced motion (`UiMotion` and toasts can be turned off).
- **Later:** crossfade the zone weather, light from Fire- and Electric-type Zorlings at night, and save the quest "New" markers if players miss them.
- Not done from older follow-ups (out of the picked groups): click a door to walk there, a zoomable region map, per-zone or town music, lanes as thin paths, bigger overworld sprites for Titans and legendaries, trainer line of sight, cries for Zorling NPCs, a badge case, dialogue text blips, a low-HP beep and music change, stereo pan by actor x, opening the bag on the Capture tab while the foe is Subdued, and per-move VFX variation.

## Notes for the next chunk
- New presentation hooks:
  - `engine.iris(() => point)` for transitions.
  - `UiMotion` as a `FocusStack` host (call `update(dt)`).
  - `ToastQueue` + `splitNotes` for quest news.
  - `playJingle(id)` for any fanfare that should duck the music.
  - The battle option `intro?: IntroSpec`.
- A view that closes through `UiMotion` keeps drawing for 80 ms. Don't destroy textures it shows right when it closes.
- Map moods and weather: add `mood` / `radius` to an anchor (overlay entries replace generated anchors, so copy x/y/kind), or `mood` / `weather` to a zone in `overlay.json`, then run `npm run world -- build`.
