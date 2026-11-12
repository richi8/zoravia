# C18 · Battle scene — Log

- **Date:** 2026-11-12
- **Status:** done
- **Depends on:** C10, C17 (and C14–C16 through C17)

## Summary
Battles are now playable and animated on the game page. A `BattleScene` puts the pure battle engine (C14–C17) behind the C10 UI kit. Each player choice becomes one engine step, and its events play one by one as a presentation queue: battle text, attack lunges with a VFX per type, hits (flash and knockback, hit-stop, shake, damage numbers), reaction callouts, condition overlays, Armor breaks, switch dissolves, the capture throw with wobbles, and faints. A pure mirror of what has been shown keeps the HUD in step with the animation. The game page now opens a debug launcher with wild, rain, trainer, Titan and legendary battles, a battle speed setting (1× / 1.5× / 2×) and a confirm-before-switch toggle. Species also got a `look`, so every species renders the same way everywhere.

## What was built
- **Presentation, pure** (`src/game/battle/present/`):
  - `shown.ts`: `Shown` (what the screen shows per side: active slot, on field, team with HP, statuses, Armor, Subdued), `shownFrom(content, state, xp, beforeStart)`, `applyShown(content, shown, event)`, `syncStatuses(shown, state)` (the engine counts statuses down without an event per countdown), `shownActive`.
  - `text.ts`: `eventText(content, shown, event, { trainer })` gives the battle text of every event kind, `nameOf` ("Voltbat", "the wild Sproutle", "the foe's Blazekit", "the Thornwing Titan"), and `progressText` (XP, level up, learned, move offer, can evolve).
- **Battle scene** (`src/game/battle/scene/`):
  - `battle-scene.ts`: `BattleScene` (options: content, input, setup, trainer name, badges, speed, money, `confirmHotbarSwitch`, `onEnd(result, state)`), `BATTLE_SPEEDS`. It handles the action menu (entries follow `legalChoices`), the move list with info and live tip, `1 2 3` and hotbar clicks, the Switch menu, the forced replacement after a faint, the bag with "use on" (an item that can't be used now says why and reopens the bag), Run, `F` inspect and battle text (`E` advances, hold = faster). The opponent's choice comes from `aiChoice` and its replacements from `aiReplacement`. After the end it calls `finishBattle`, shows XP and progress, then calls `onEnd`.
  - `vfx.ts`: `MoveVfx` (one look per type: fire embers, water droplet arc and splash, swirling leaves, electric bolt, ice shards and glints, falling rocks and dust, wind streaks, metal slashes; status moves swirl sparkles onto the target; `impacted` marks the hit), `ReactionVfx` (pixel ring and sparks in the condition and move colors), `SparkleVfx`, `ConditionOverlay` (ambient particles for the 8 conditions plus Frozen, Rooted, Overload and Steam Burst).
  - `particles.ts`: a small pure particle sim (`ParticleSystem`, `lineCells`, `particleSize`). Everything is drawn as whole pixels into the pixel layer.
  - `transition.ts`: `battleTransition` (white flash, then pixel bars sweep in from alternating sides; they sweep out at full cover) and `barCover`.
  - `view-data.ts`: content → kit view data: `moveViewFor` / `moveTip` (reaction, Armor break, Armor warning, effectiveness, then condition setup or warning), `bagTabsFor`, `itemLook`, `cardView` (condition chips plus pills), `typeTip`, `conditionTip`.
  - `backdrop.ts`: moved here from the lab mock (the lab imports it from the game now).
- **Species look**: `species.look` (`seed`, optional `plan` and `mood`), allowed only on the final form of a line (load error otherwise). `src/game/zorlings/species-look.ts`: `speciesLook` (stage genome and fill from the final form, cached per content), `battleLook` (96 px; 128 px for Titans in boss form, Titan-marked Zorlings and legendaries; Titans bulkier and glowing). `generateGenome` got a `types` option so a look uses the species' real types. Looks were added to the 6 final forms in `packs/core`.
- **Style ids**: `src/game/style/ids.ts` (`typeIdOf`, `conditionIdOf`, `styleTypes`) map content ids (`core:wet`) to the style tokens (`wet`).
- **Zorling actor**: `ZorlingActor.preload(clip)`.
- **UI kit**: `StatusPill` (`badges.ts`), and `CombatantView.pills` on the HUD card for lingering reaction effects, Armor / Broken and Subdued, each with a tooltip.
- **Debug launcher** (`src/game/scenes/debug-launcher-scene.ts`), the game page's first scene until C33 (`?demo` still opens the C06 demo): wild Lv 8, wild in the rain (Wet weather), trainer 3 vs 3 ("Rival Mira"), Titan Thornwing, legendary Glacivar, battle speed, confirm `1 2 3`. It shows the last result.
- Tests: `present.test.ts` (7, including 13 full AI-played battles where the mirror must match the state after every step), `view-data.test.ts` (7), `particles.test.ts` (3), `species-look.test.ts` (4). **463 total.**

## Decisions
- **Decision:** One engine step per turn, then a presentation queue that plays its events in order. A mirror (`Shown`) is updated per event, and the HUD only ever shows the mirror.
  - **Why:** the engine returns the state after the whole turn. If the HUD read it directly, HP would drop before the hit lands. The mirror is pure, so a test plays whole battles and checks it against the real state after every step.
  - **Alternatives considered:** diffing states (loses order: who got hit first), stepping the engine event by event (not how it is built, and not needed).
- **Decision:** Status countdowns come from the state at `turnEnd` (`syncStatuses`).
  - **Why:** the engine counts down at the end of a turn and only reports when a status ends. Adding a countdown event to the engine would change it just for display.
- **Decision:** Battle text that leads straight into an animation (send-out, call back, "X used Y!", item used) closes on its own after a beat. Everything else waits for `E`, as in the C10 mock.
- **Decision:** Battle speed scales the scene clock (animations, VFX, tweens, HP bars, callouts) and the typewriter speed. Input timing does not change.
- **Decision:** Hit-stop freezes only the Zorlings and VFX for 0.06–0.14 s (longer for bigger hits). The shake moves the Zorlings and VFX, not the backdrop.
  - **Why:** found in the browser. Shaking the whole view showed the dark page background at the screen edge.
- **Decision:** Big foes (128 px) stand a little lower than the platform so they fit on the 270 px screen.
  - **Why:** found in the browser. The Titan's wing was cut off at the top.
- **Decision:** The action menu follows `legalChoices`: Fight, Switch and Run are greyed out when they can't be chosen (Run in trainer battles, everything but items while a boss is Subdued). Items stays open whenever the bag holds something. An item that can't be used now says why ("Its HP is already full.", "…too strong to catch. Defeat it first!") and reopens the bag.
  - **Why:** the bag is also where players look things up. A silent no-op would read as a bug.
- **Decision:** `1 2 3` work while the action menu or the move list is open. A blocked switch says why (Rooted, fainted) in the message box and costs nothing. The confirm prompt is an option (`confirmHotbarSwitch`, default off), toggled in the launcher until settings exist (C33).
- **Decision:** Actors are rendered once per battle per team slot and kept while benched. Portraits are rendered once per slot. After a send-out, the attack, hurt and faint clips are rendered one per frame while text or a menu waits (`ZorlingActor.preload`).
  - **Why:** rendering all clips costs ~0.3 s per Zorling (C09 log). Measured in the browser, the first attack hitched (one 67 ms frame) without preloading, and none with it. Switching back stays instant.
- **Decision:** Species looks live on the final form only (`look` on an earlier stage is a load error). Without a look, the seed is the final form's id.
  - **Why:** the C09 rule ("a line stores one genome: the final form"). Pack authors can add species without a look and still get a stable sprite.
- **Decision:** Condition overlays flicker particles out instead of fading alpha.
  - **Why:** keeps every pixel on the palette (pixel-art direction).

## Deviations from plan / design
- `DESIGN.md` unchanged: no rule changed.
- The "battle transition" is the encounter transition into the battle scene. It will be reused by overworld encounters (C21).
- The battle speed and confirm-switch settings live in the debug launcher until the settings screen (C33).
- The move-offer prompt (replace a move or skip) and the evolution prompt are not in this chunk's scope. The battle shows them as text ("…wants to learn X, but already knows 3 moves.", "…is ready to evolve…"), and `onEnd` gets the `BattleResult` with the progress events.

## Issues & known limitations
- Fixed after review (user screenshot): the first Zorling sent out floated above its platform on screens that aren't 480×270. The scene enters, and its send-out animation starts, before it gets its real size; the animation kept the stale ground point. The switch-in and switch-out animations now read the ground point every frame.
- Fixed after review (user screenshot): on windows that aren't exactly 480×270 game pixels, the pixel layer only showed its first 480×270 pixels, so backdrops did not span the screen. The bug dates from C08b: Pixi keeps a render texture's GPU target at its first size after `resize`. The engine now makes a new screen texture when the game-screen size changes (`src/engine/render/engine.ts`). Checked at 500×300 and 650×320. Earlier checks all ran at exactly 480×270, which hid it.
- Placeholder backdrop (the C10 forest) for every battle. Biome backdrops come with the world.
- Caught Zorlings and battle results are not kept: the launcher starts fresh teams for each battle (storage, C22; saves, C23).
- VFX and overlays were tuned by eye on a few screenshots. Some overlays (Wet drips, Exposed glints) are subtle at ×2. The polish pass is C32.
- Clip preloading only runs while text or a menu waits. A battle that opens on a very fast first action could still render a clip on demand (a single ~0.1 s hitch).
- Players read the outcome from the text. There is no victory or defeat jingle yet (audio, C24/C25).
- At ×1 scale (windows under ~960×540) the 7 px labels are hard to read (known from C10).

## Verification
- `npm run check`: typecheck, lint, format, **463 tests (43 files)**, all pass.
- Browser (headless Chrome, dev server, game page at 960×540 CSS × DPR 2 → 480×270 at ×4). It was driven by key presses only through a puppeteer script in the scratchpad. Screenshots reviewed:
  - Launcher → battle transition → wild battle: send-out text, move list with info and tip, attack, damage number, HP drain, effectiveness text. Autoplay by keys to the end: **won in 9 turns, "+75 XP each"**, back at the launcher with the result.
  - Rain battle: "The weather left the wild Sproutle Wet!", both Zorlings Wet. Static Bite on the Wet foe shows the tip "Foe is Wet: Conducted ×1.75", then the reaction ring, the "Conducted! ×1.75" callout and the shake, and Wet is used up.
  - Trainer battle 3 vs 3 by keys: the AI switches, forced replacements on both sides, Run greyed out, fainted portraits grey, Burning and Charged overlays and chips. Lost in 15 turns ("You lost.").
  - `2` switches (costs the turn). Bag → Potion → "use on" → a full-HP target says "Its HP is already full." and reopens the bag. `F` inspect shows the Water type tooltip. Run → "Got away safely!" → launcher.
  - Titan: a 128 px glowing Thornwing Titan with an Armor pill. Playing only the first move every turn (brute force) lost in 23 turns, as the C17 simulation predicts. For the capture flow, the Titan's HP was set to 1 through the dev handle, then everything else was done by keys: one hit → "Subdued" pill, the Titan dims, only Items is enabled, prompt "…is Subdued. Throw a capture item!" → Items → Capture tab → Zorb → throw arc, the Titan is drawn into the orb, drop, 3 wobbles, sparkles, "Gotcha!" → launcher: "Caught Thornwing · +336 XP each" (captured form, no aura).
  - Zorb at a full-HP wild Puddlit: it wobbled, broke free and came back at full size.
  - Battle speed 1.5× from the launcher. The scene runs at 1.5 and a full wild battle plays through (won, 9 turns).
  - FPS during an attack (hit, number, HP drain): 60.2, max frame 16.8 ms, 0 slow frames. Before clip preloading, the first attack hitched (67 ms frame).
  - No console errors or warnings in any run. The lab still loads (the backdrop moved).
- Done when:
  - A full wild battle playable keyboard-only from a debug launcher: ✅ (won by key presses only, also ran away)
  - A full trainer battle playable keyboard-only from a debug launcher: ✅ (3 vs 3 with switches and replacements, played to the end)

## Follow-ups
- C19/C21: biome backdrops (reuse the C11 tile ramps) and biome weather → `BattleSetup.weather`. Overworld encounters start battles with `battleTransition`.
- C22: catches go to the team or storage, the move-offer prompt (replace or skip), the evolution prompt, and the Dex logs seen/caught and a Titan's weakness.
- C23: the battle result goes into the save.
- C24/C25: hit, reaction, capture-wobble and faint sounds, cries on send-out, battle and boss music.
- C32: VFX polish (bigger Wet and Exposed overlays, per-move variation, a type-tinted flash on hit), panel open/close motion, a level-up sparkle on the card, a victory pose.
- C33: battle speed and confirm-switch in the settings screen; the start flow replaces the launcher.
- Perf: move clip rasterizing to a worker if region content (more Zorlings per battle) makes preloading noticeable.
- G1 leftovers: Zorling model polish (spiky Sproutle baby stage; the dragon's near wing).

## Notes for the next chunk
- Start a battle: `engine.scenes.push(new BattleScene({ content, input, ui, theme, setup, trainer?, badges, speed, onEnd }), { transition: battleTransition(engine.layers.transitions, size) })`. In `onEnd(result)`, pop the scene and apply `result.team`, `result.bag` and `result.caught`.
- The scene sets the `battle` input context on enter. The scene below must set its own context again in `resume`.
- Species sprites: `battleLook(content, speciesId, { boss, titanMark })`, or `speciesLook` for the plain stage genome (overworld sprites at 32 px use `renderZorling(look.genome, { size: 32, fill: look.fill })`).
- Event text and the HUD mirror are pure (`@game/battle/present`), so they can be reused for a battle log or replay viewer.
