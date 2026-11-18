# Zoravia — Implementation Plan

The game is built in **chunks**. Each chunk is sized so one AI session can finish it, test it, and log it.
Source of truth for *what* the game is: `DESIGN.md`. This file says *in what order* and *what "done" means*.

## How to work a chunk
1. Read `DESIGN.md`, this file, `PROGRESS.md`, and the logs of the chunks this one depends on.
2. Do only the chunk's scope. Anything extra → write it under "Follow-ups" in the log.
3. Meet every "Done when" item. Run `npm run check` (typecheck + lint + tests) before finishing.
4. Write `logs/CXX-<slug>.md` using `logs/TEMPLATE.md`.
5. Update the chunk's row in `PROGRESS.md`.
6. If a design decision has to change, update `DESIGN.md` too and record why in the log.

**Gates** (🚦) are points where the user reviews before work continues.

---

## Phase 0 — Foundation

### C01 · Project setup
- **Goal:** Empty, well-configured project.
- **Deliverables:** Vite + TypeScript (strict), ESLint, Prettier, Vitest; folder layout (`src/engine`, `src/game`, `src/lab`, `packs/core`, `tools/`); `npm run dev | build | test | check`; README with commands.
- **Done when:** blank page renders in browser; `npm run check` passes with one sample test.
- **Depends:** —

### C02 · Core utilities
- **Goal:** Shared low-level building blocks.
- **Deliverables:** seeded RNG (deterministic, splittable streams), math/vector helpers, typed event bus, logger, `assert` helpers.
- **Done when:** unit tests prove same seed → same sequence; event bus typed end-to-end.
- **Depends:** C01

### C03 · Content pack system
- **Goal:** Engine has no content; everything comes from packs.
- **Deliverables:** pack manifest (`id`, `version`, `dependsOn`), namespaced registries (`core:xyz`), Zod schemas, loader with dependency ordering, add/override rules, clear errors for invalid packs, hook registration.
- **Done when:** tests load 2 fixture packs where one overrides the other; invalid pack fails with a readable message.
- **Depends:** C02

### C04 · Rendering, game loop, scenes
- **Goal:** Something can draw and update.
- **Deliverables:** PixiJS app, fixed-timestep loop, scene manager (push/pop/replace, transitions hook), resize + devicePixelRatio handling, debug FPS overlay.
- **Done when:** two placeholder scenes switch with a fade; stable at 60fps.
- **Depends:** C01

### C05 · Input system
- **Goal:** Keyboard-first, context-sensitive input.
- **Deliverables:** action map (`move`, `confirm`, `back`, `hotbar1-3`, `inventory`, ...), default bindings from `DESIGN.md`, input context stack (overworld vs menu), rebinding data model (no UI yet), mouse as optional input.
- **Done when:** tests show WASD maps to movement in overworld context and to navigation in menu context; rebinding a key works.
- **Depends:** C04

### C06 · UI framework
- **Goal:** Reusable keyboard-navigable UI.
- **Deliverables:** focusable list/grid menu (wrap-around cursor), dialog box with typewriter text (`E` advance, hold to speed up), panels, theming hook for design tokens.
- **Done when:** demo scene with nested menus fully usable by keyboard only, and by mouse.
- **Depends:** C05

---

## Phase 1 — Style lab (in-project `/lab` route)

### C07 · Design tokens & brand
- **Goal:** Visual identity in code.
- **Deliverables:** token file (colors, 8 type colors, condition colors, typography, spacing, radii, motion timings), font choice, Zoravia logo generated in code (SVG/canvas, light + dark), `/lab` page shell with sections.
- **Done when:** `/lab` shows palette, type colors, fonts, logo.
- **Depends:** C04

### C08 · Zorling genome & sprite generator v1
- **Goal:** Prove procedural Zorlings can look good. *(Highest-risk chunk.)*
- **Deliverables:** genome format (body plan, parts, palette, seed), 5 body plans (quadruped, serpent, avian, blob, biped), part library, type-driven palettes, pixel-art battle sprites 96×96 and overworld sprites 32×32 (see `DESIGN.md` Presentation) with outlines + shading bands; lab controls (seed, type, body plan, randomize).
- **Done when:** lab shows a grid of 24 random Zorlings; same genome always renders identically; log includes honest assessment of quality.
- **Depends:** C02, C07

### C08b · Virtual screen (480×270)
- **Goal:** The game renders at its pixel-art resolution (see `DESIGN.md` Presentation).
- **Deliverables:** engine option to render scenes in game pixels at a whole-number scale (device-pixel exact, HiDPI-aware); the game screen fills the whole window with at least 480×270 game pixels (no bars, no stretching); pointer events and input in game pixels; debug overlay stays native.
- **Done when:** the game fills any window crisply (×2/×3/×4…), showing ≥ 480×270 game pixels; keyboard and mouse still work; stable 60 fps.
- **Depends:** C04, C05, C06
- *(Added 2026-11-12: follow-up from the C07 pixel-art decision, needed before C10/C20.)*

### C09 · Zorling rig & animation, variants
- **Goal:** Zorlings feel alive.
- **Deliverables:** part-based rig, animations (idle breathe/blink, attack lunge, hurt, faint), evolution stages from one genome (1/2/3-stage), Titan variant (bigger, glow). *(Shiny palette dropped at C09 review, see `DESIGN.md` Creatures.)*
- **Done when:** lab shows a full 3-stage line animated, plus the Titan version.
- **Depends:** C08

### C10 · UI kit & battle mock
- **Goal:** All game UI pieces in one place.
- **Deliverables:** HP/XP bars, type badges, condition icons (8), hotbar slots 1–3, action menu, move list with info panel, bag/shop panels, dialog styles; static battle mock screen combining everything.
- **Done when:** lab battle mock is navigable by keyboard and looks like a real game screen.
- **Depends:** C06, C07, C09

### C11 · Biome tiles & weather
- **Goal:** World look for the 3 launch biomes.
- **Deliverables:** procedural tile generator per biome (forest/lakes, volcanic desert, frozen coast), autotiling edges, grass sway + water shader, weather particles (rain, ash, snow).
- **Done when:** lab shows a small sample map per biome with weather toggle.
- **Depends:** C07

### 🚦 G1 · Art direction review
User reviews `/lab`. Feedback becomes tweak chunks before Phase 2. Log the decisions.

---

## Phase 2 — Data model

### C12 · Core schemas & core pack v0
- **Goal:** All game data has a typed home.
- **Deliverables:** schemas for types + effectiveness chart, conditions + reactions, moves, species (stat totals, evolution line, optional trait, learnset), items, traits; `packs/core` with the 8 types, full reaction table, ~10 test species, ~20 moves, potions + capture item.
- **Done when:** core pack loads and validates; tests cover the type chart and reaction table from `DESIGN.md`.
- **Depends:** C03

### C13 · Zorling instances & progression
- **Goal:** Individual Zorlings that grow.
- **Deliverables:** stat formula, XP curve, team-wide shared XP, badge-based soft level cap, learning moves (3 slots, replace or skip), level-based evolution, nicknames, Titan mark.
- **Done when:** tests cover leveling, cap slowdown, move replacement, evolution.
- **Depends:** C12

---

## Phase 3 — Battle

### C14 · Battle engine core (pure)
- **Goal:** Deterministic battle logic, no rendering.
- **Deliverables:** `(state, action) → state + events`; turn order, damage formula, type effectiveness, accuracy, fainting, switching (costs the turn; free after a faint), run, win/lose.
- **Done when:** tests replay scripted battles with fixed seed → identical results.
- **Depends:** C13

### C15 · Conditions & reactions
- **Deliverables:** applying conditions, 3-turn duration, side effects, reaction triggers + consumption, switching clears own conditions, weather-applied conditions at start, traits that interact (e.g. Waterproof).
- **Done when:** test for every reaction in the table plus edge cases (expiry, re-apply, switch clear).
- **Depends:** C14

### C16 · Items, capture, AI
- **Deliverables:** potions (cost the turn, bag cap 5 per type), capture item, wild AI (simple), trainer AI (uses conditions, switches to exploit).
- **Done when:** tests for item rules; simulated trainer AI performs at least one combo in sample fights.
- **Depends:** C15

### C17 · Bosses
- **Deliverables:** boss aura (HP ×3, extra move), Armor (×0.3 damage) broken by reactions (×1.5 for 2 turns, then re-arms), Subdued state → guaranteed capture with normal item, aura removed on capture + Titan mark.
- **Done when:** tests for armor cycle and capture flow; a simulation shows a boss is beatable by reactions and by ~4–5 potions.
- **Depends:** C16

### C18 · Battle scene
- **Goal:** Battles playable and animated.
- **Deliverables:** engine events → presentation queue; keyboard flow (action menu, moves, `1 2 3` switching, Switch menu, items); attack/hit/VFX animations, damage numbers, reaction callouts, condition overlays, capture animation, battle speed setting, battle transition.
- **Done when:** a full wild battle and trainer battle playable keyboard-only from a debug launcher.
- **Depends:** C10, C17

---

## Phase 4 — World

### C19 · Map format & world tool
- **Deliverables:** map data format (chunked tiles, collision, zone/tier metadata, spawn tables, anchors, connection points), offline generator script in `tools/` (seeded noise → biomes), hand-edit overlay format merged at build time.
- **Done when:** tool generates a test region; game loads it; overlays override generated tiles.
- **Depends:** C11, C12

### C20 · Overworld movement
- **Deliverables:** tilemap renderer with chunk streaming, tweened grid movement at the single speed from `DESIGN.md` (3.75 tiles/s), collision, camera easing, click-to-move pathfinding, walk-cycle animation.
- **Done when:** player walks the test region smoothly with keyboard and mouse.
- **Depends:** C19, C05

### C21 · NPCs & encounters
- **Deliverables:** NPC entities (idle, facing, talk), visible roaming wild Zorlings from zone spawn tables (level by tier), touch → battle transition → return to world.
- **Done when:** walking into a roaming Zorling starts a battle and returns correctly after.
- **Depends:** C18, C20

### C22 · Centers, shops, storage, menus
- **Deliverables:** Zorling center (heal, storage ↔ hotbar swap, move relearner), shop + money, inventory, party, Dex, storage UI; `I M P B J Esc` menus.
- **Done when:** full loop: catch → storage → swap at center → buy potions → use in battle.
- **Depends:** C21

### C22b · Level-up choices
- **Goal:** Level-up results become player choices (DESIGN.md → Creatures).
- **Deliverables:** after a battle, "replace a move or skip" for move offers and "evolve now or later" for evolution offers; an evolution animation; evolving later from the party screen; moves the new form learns are taught or offered.
- **Done when:** a level-up past a full move set and an evolution level both lead to the right choices, and the results are kept in the party.
- **Depends:** C22
- *(Added 2026-11-13 at the user's request; it was a C22 follow-up.)*

### C23 · Save system
- **Deliverables:** IndexedDB saves, versioned schema + migrations, autosave, save slots, one-per-save boss tracking.
- **Done when:** reload restores exact state; migration test from v1 → v2 fixture.
- **Depends:** C22

---

## Phase 5 — Audio

### C24 · SFX & cries
- **Deliverables:** Web Audio synth for UI/battle SFX, genome-derived Zorling cries, volume settings.
- **Done when:** all battle and UI actions have sounds; same species → same cry.
- **Depends:** C18

### C25 · Music & ambience
- **Deliverables:** procedural sequencer (key, tempo, scale, instruments per biome), battle variant, data format for hand-written boss themes, ambience layers, crossfading.
- **Done when:** each biome and battle has music; transitions are seamless.
- **Depends:** C24

---

## Phase 6 — Campaign systems

### C26 · Dialogue & quest engine
- **Deliverables:** data-driven dialogue (branches, conditions), quest definitions (steps, conditions, actions, rewards), flags, quest log `J`.
- **Done when:** a sample 3-step quest defined only in pack data is completable.
- **Depends:** C22

### C27 · Trials, rival, story bosses, legendary
- **Deliverables:** trial/badge flow, badge-based story boss scaling, rival encounters, legendary encounter + one-per-save tracking, rematch system.
- **Done when:** a sample trial and rival fight work end-to-end from data.
- **Depends:** C26, C17

---

## Phase 7 — Region 1: Temperate forest & lakes

### C28 · Region 1 map
- **Deliverables:** hand-curated region from the world tool: hub town, T1/T2/T3 zones, routes, landmarks, secrets, Titan lairs, legendary site.
- **Done when:** whole region walkable; zones have correct tier metadata.
- **Depends:** C19–C23

### C29 · Region 1 Zorlings & trainers
- **Deliverables:** ~20 species (mix of 1/2/3-stage lines, 3 starters), moves, traits, spawn tables, trainers, 2 Titans, legendary.
- **Done when:** all content validates; Dex shows them; balance sim within stat bands.
- **Depends:** C28, C13

### C30 · Region 1 campaign & lore
- **Deliverables:** region lore, main quest chain (3–5 steps), side quests (3–6), trial, NPC dialogue with Titan hints.
- **Done when:** campaign completable start to finish.
- **Depends:** C29, C27

### C31 · Balance & playtest pass
- **Deliverables:** automated battle simulator for balance reports, economy tuning (potion prices vs income), level curve tuning, bug fixes.
- **Done when:** balance report in the log; full playthrough by AI-driven test or manual checklist.
- **Depends:** C30

### 🚦 G2 · Fun gate
User plays Region 1. Decide what to change before building more.

---

## Phase 8 — Polish

### C32 · Juice & presentation
- **Deliverables:** 2D lighting, screen transitions, camera shake/hit-stop tuning, particles polish.
- **Depends:** G2

### C33 · Title, settings, start flow
- **Deliverables:** title screen with logo, start-region selection, settings (key rebinding UI, battle speed, volumes, switch confirm toggle), pause menu.
- **Depends:** G2

---

## Phase 9 — Expansion & release

### C34 · Region 2: Volcanic desert (as a pack)
- **Done when:** added with zero engine changes (or each engine change logged and justified).

### C35a · Regional body models
- **Goal:** each region's Zorlings look like they come from that region, not like recolors of one shared model set (user feedback during C35, 2026-11-14).
- **Deliverables:**
  - New body plans and part kinds in the Zorling generator (`src/game/zorlings/`):
    - Frozen: seal / pinniped, walrus / mammoth (tusks, heavy shoulders), jellyfish (bell, tendrils), crab (carapace, claws), anglerfish lure. Parts: tusks, fur ruff, frost tips, icicle spines.
    - Desert: salamander / lizard, scorpion, beetle carapace, cactus body. Parts: stinger tail, carapace, sail.
  - A per-pack **model kit** in pack data: which plans and parts the region's species draw from. The engine keeps only the drawing code.
  - Verdale keeps today's set as its kit.
  - Emberwaste retrofitted to desert models: new seeds and plans for its 24 species.
  - Rimeholm's looks set from the frozen kit, in C35's species file.
  - Stage rules (C29) still hold for new plans (babies rounder, no horns or plates).
- **Done when:**
  - The user has approved a preview round (all variants shown as images before any code goes into the repo).
  - Emberwaste and Rimeholm rosters render with their own kits.
  - Existing generator tests pass, and new plans pass the same render and animation checks.
- **Depends:** C34

### C35 · Region 3: Frozen coast islands (as a pack)
- Same rule as C34.
- **Depends:** C35a (looks use the frozen model kit)

### C36 · Cross-region endgame
- **Deliverables:** danger zones (Lv 45–60), rival finale, meta-quest after X badges, Titan rematches.
- Settled with the user (2026-11-15):
  - **One danger zone per region**, inside its own main map. The map grows by a strip that the world tool glues on (`world extend`), and existing tiles stay unchanged:
    - Verdale grows north (Thornveil);
    - Emberwaste grows east (Ashen Rift);
    - Rimeholm grows south (Polar Drift).
  - A ranger blocks the way in until the player holds 3 badges. No center inside.
  - **Wild Zorlings:** the region's own species and core species, plus two new single-stage rares per zone from the region's model kit (preview approved).
  - **Elder Titans:** the region's two Titans again, at endgame level, in its zone. They can't be caught. The +8 lair rematches stay.
  - **Meta-quest "Beyond the Map"** (core): it opens with 3 badges. Beat the Warden at three zone hearts, then Rival Mira's finale.
- **Done when:**
  - The user has approved the map and rare previews.
  - Each region map is extended with existing tiles unchanged.
  - The meta-quest runs start to finish through the engine.
  - The zones' fights are checked in simulation.
- **Depends:** C35

### C36b · Map exploration
- **Goal:** the map screen starts dark and is revealed by exploring (user idea, 2026-11-15).
- **Deliverables:**
  - The save keeps the explored cells of each map.
  - The `M` map shows only explored areas.
  - Entering a zone, town or landmark for the first time shows a toast with its name and level range. Discovered places are labelled on the map.
  - **Atlas** (user request, 2026-11-15): a permanent pause-menu item with an in-game version of the C36 World Atlas page. It is drawn in code from pack data, like everything else:
    - each region's map, tinted by tier, with markers for towns, trainers, trial, Mira, Titans, legendary, region boss, gate, Elder Titans and Keepers;
    - a zone list (levels, storms, wild Zorlings seen or caught);
    - bosses (level, weak spot once logged in the Dex), quests (from the quest log) and progress counts (badges, hearts, Dex).
    - It shows only what the player has discovered. Undiscovered places, trainers and Zorlings stay dark or appear as “?”, so the atlas never spoils the world.
    - Fully keyboard-driven: regions with `A/D`, list and markers with `W/S`, `F` for tooltips. It also opens from the `M` map.
    - Preview round first (layout options as images).
- **Done when:**
  - Exploring reveals the map.
  - The Atlas opens from the pause menu, follows exploration and is fully usable by keyboard.
  - Old saves load with a sensible reveal (e.g. around visited towns).
  - The map stays fully usable by keyboard.
- **Depends:** C36

### C36c · Unified map window
- **Goal:** one window for the map, the Atlas and the quest log, built around a single world map (user idea, 2026-11-15). Every region sits at its place in the world, so there is no region switch. It is a first step toward the seamless world.
- **Deliverables:**
  - **World positions:** each region pack gives its map a world offset in tiles (a new optional field on the region's start entry or map, validated so that regions don't overlap). Emberwaste lies east of Verdale at Ember Pass and Rimeholm south across the ferry. The later seamless-world chunk reuses these offsets.
  - **World map:** every region's map drawn at its offset, tinted by tier, with parchment fog and the C36b markers and labels. The sea or blank parchment fills the space between regions.
    - It pans around the player at 1 px per tile. One key zooms out to the whole world at ½ px per tile, and pans follow the selection.
    - Exploration and save data stay per map (no save change).
  - **One window** replaces the `M` map panel, the Atlas and the quest panel:
    - `M` opens it centered on the player, and `J` opens it with Quests expanded. The pause menu has one entry, "Map", which replaces "Map", "Atlas" and "Quests".
    - The right side has **expandable groups**: Zones, Bosses and Quests, each with a count ("Zones 11/13 ▸"). Zones and Bosses are sorted by region, with small region subheadings. Quests are split into active and done, and the "New" marker of quests is kept.
    - `W/S` moves through headers and rows, and `E` opens or closes a group. Selecting an entry pans the map to it. `F` opens the details card, which now also holds a quest's steps and reward. `Q` closes.
    - Mouse: click a header to open or close it, a row to select it (and again for the card), the map to pick the nearest entry, and key hints. Dragging the map pans it (optional).
  - Nothing undiscovered shows, as in C36b.
  - Preview round first: two or three layouts of the window as images (memory: previews before code).
- **Done when:**
  - The user picked a layout from the preview.
  - All regions show on one world map at their offsets, with no region switch.
  - `M`, `J` and the pause menu open the same window, which is fully usable by keyboard and by mouse.
  - Everything the quest log showed (steps, reward, giver, "New") is still reachable.
  - Old saves load unchanged.
- **Depends:** C36b

### C36d · World polish
- **Goal:** finish existing world features without new content, and keep the game's friction (user picks, 2026-11-15). No fast travel, quest waypoints, healing outside centers, running shoes, battle skipping or XP sharing.
- **Deliverables:**
  - **Trainers who spot you:**
    - A route trainer that has not been beaten sees a few tiles straight ahead, with an optional `sight` on the NPC and a default for derived `trainer` marks. When the player steps into that line, it shows "!", plays the alert sting, walks up and starts its dialogue and battle.
    - Walls, props and other NPCs block the line.
    - Beaten trainers, trial masters, Mira, bosses and NPCs without a battle never spot.
    - The player can't move or open menus until the trainer arrives. Nothing new is saved: it reads the trainers already beaten.
  - **Arrival toast:** entering another region shows a toast with the region's name ("Emberwaste"), in the style of the discovery toasts. The first arrival is gold-edged, as a discovery. For now this happens on travel; after C37 it happens on crossing a region border.
  - **Map labels:** in the map window, labels that would overlap shift up or down, or the one with the lower priority hides. Towns come first, then landmarks, then secrets. The selected zone blinks as an outline of its real tiles, not a fixed box.
- **Done when:**
  - Route trainers spot and walk up to the player once, and no trainer can trap the player in a loop (a trainer whose path is blocked doesn't start).
  - Entering a region shows the arrival toast.
  - Labels don't overlap at either zoom, and the selected zone's outline matches its tiles.
  - The ferry stays free (user, 2026-11-15). Old saves load unchanged. Everything stays keyboard-playable.
- **Depends:** C36c

### C36e · Presentation & sound polish
- **Goal:** what is already in the game looks and sounds finished (user picks, 2026-11-15). No new content.
- **Deliverables:**
  - **Battle backgrounds by biome:** desert for Emberwaste and frozen coast for Rimeholm, drawn in code like Verdale's hills, chosen from the zone's biome. Danger zones may get a darker variant. Preview round first (images of each biome, memory: previews before code).
  - **Bigger overworld Titans and legendaries:** their lair NPCs are drawn larger than a person (the Zorling's battle look at overworld scale), with the legendary's shine. Preview round first.
  - **Sound:**
    - Low HP: a short warning sting when the active Zorling drops under ¼ HP, and a subtle change in the battle music while it stays there. It is not a looping beep.
    - Dialogue text blips: a soft blip every few characters, pitched per speaker. It is off for narration and signs, and it follows the SFX volume.
    - Cries in the overworld: a roaming wild Zorling cries when it starts to chase, and a Titan or legendary in its lair cries when the player talks to it. The sound pans left or right with its place on screen.
  - **Key hints follow the bindings:** every key hint shows the player's current key, through a `keyHint(action)` helper that reads the bindings. That covers the overworld help line, the battle bar, panels, the map window and the title. This item is moved here from release prep.
- **Done when:**
  - The user picked the backgrounds and the boss sprite size from the previews, and each biome's battles use its background.
  - Titans and legendaries stand out in the overworld.
  - The low-HP sting, text blips and overworld cries play, and each follows its volume setting.
  - Rebinding a key changes every hint that shows it.
  - Everything stays keyboard-playable.
- **Depends:** C36d

### C37 · Seamless world
- **Goal:** merge the regions into one big world map, so the player walks between regions with no loading, and the ferry becomes an animated boat that sails over the water from pier to pier (user, 2026-11-15). Content stays in the region packs.
- **Deliverables:**
  - **World composition:**
    - At load, a pure step builds one world map from every region at its C36c `world` place. Each region's tiles, zones, props, anchors, connections and NPC spots are shifted by the region's offset.
    - Packs keep region-local maps and data, and the world tool still edits one region at a time. Zone and anchor keys stay unique per region.
    - A debug map (the test region) still loads on its own.
  - **Between regions:**
    - Open sea lies between Verdale's south coast and Rimeholm, and around the Rimeholm islands. It is the ferry's water and is never walkable.
    - Other empty world space is impassable land drawn in the neighbouring biome (cliffs, dunes, forest).
    - Nothing outside a region is walkable.
  - **Seams:**
    - Where Verdale and Emberwaste touch, the double border tree wall becomes one natural border that blends the two biomes (for example a ridge, or a tree line thinning into scrub). It stays closed except at Ember Pass.
    - Ember Pass becomes an ordinary walk with no travel step.
    - Danger-zone strips and their gates keep their own walls.
  - **One biome per area:**
    - The terrain, tall grass, footstep dust, minimap, ambience, music, overworld weather and battle backgrounds follow the region under the player.
    - Music and ambience crossfade when the player crosses a border. Discovery and arrival toasts fire on crossing.
  - **Ferry boat:**
    - A boat is docked at each pier. Talking to the ferryman, or stepping onto the boat, asks "Sail to <region>?" with Yes and No. The ride is free.
    - On Yes, the player boards and the boat sails a set route over the water to the far pier. The camera follows, the input is locked, and the boat bobs and leaves a wake to sea ambience for about 10–15 s. Then the player steps off.
    - The route is data on the ferry link. Both directions work.
    - `Q` doesn't cancel mid-sea, but a ride can be declined at the pier.
  - **Streaming and performance:**
    - Terrain chunks are baked only near the camera, over the whole world.
    - NPCs and wild roamers are active only near the player.
    - The frame rate holds while crossing a border, and memory stays bounded.
  - **Saves:**
    - A place keeps its region map and local tile, if that works, so no migration is needed. Otherwise a v7 stores world tiles, with a migration step.
    - Exploration stays per region (the map window already shows it in world tiles).
    - Old saves load at the same spot with the same exploration.
    - The respawn center works across regions.
  - Preview round first: images of the Verdale–Emberwaste border and of the boat at sea (memory: previews before code).
- **Done when:**
  - The user picked the border and the boat from the previews.
  - Walking from Verdale to Emberwaste through Ember Pass has no loading or fade, and the biome, music and weather change at the border.
  - The ferry is a free boat ride over animated water between the piers, both ways.
  - No seam has a walkable gap or a hole, and no double tree wall is left where regions touch.
  - The v5 and v6 save fixtures load at the same place with the same exploration.
  - 60 fps holds while walking across a border (measured in the browser).
  - The balance sim and all tests pass, and keyboard-only play is unchanged.
- **Depends:** C36e

### C38 · Release prep
- **Deliverables:** performance pass, accessibility pass (contrast, remapping, text speed), production build, deployment, final trademark check reminder.

---

## Phase 10 — Post-release polish

Design stance (user, 2026-11-15): keep old-game friction. No tutorial, no objective tracker, no fast travel, no nicknames. Save export/import, touch and gamepad are future features.

### C39 · Browser smoke test & crash screen
- **Goal:** A release can't ship if the game doesn't boot, start, fight and save in a real browser; a crash shows a message instead of a frozen frame.
- **Deliverables:**
  - `npm run smoke`: builds, serves `dist/` and drives headless Chrome (system Chrome, `playwright-core`, no browser download). Flow: boot → new game → walk → Save → reload → Continue → a trainer battle to its end. State is read from the save in IndexedDB (the release has no debug hook); the battle is made deterministic by moving the saved place to the tile in front of a route trainer. Any console error or page error fails it.
  - The Pages workflow runs it after the build and before the deploy.
  - Frame loop guard: an error thrown in update or render stops the loop, tries one autosave through the overworld scene, and shows a DOM message with the error, the version and a Reload button. The smoke test forces one and checks the message.
  - `navigator.storage.persist()` asked after the first successful save write (Safari can evict saves after a week without a visit; Firefox asks the player once).
- **Done when:** `npm run smoke` passes locally and in the workflow; breaking the boot or the save makes it fail; `npm run check` passes.
- **Depends:** C38

### C40 · Campfires (rest spots)
- **Goal:** A way to heal without potions that removes no walking and no risk.
- **Deliverables:**
  - A campfire prop (and a tent for camps). **Preview round first.**
  - `E` at a fire asks "Rest?": every Zorling still standing is healed to full HP. Fainted ones stay fainted. It is not a respawn point, storage or move relearner.
  - Cost: the day clock moves on a few hours and the wild Zorlings nearby respawn.
  - Placed by hand: the three danger-zone camps and one or two long T2/T3 routes per region. Shown on the map window once discovered.
  - `DESIGN.md` updated (Team rules, World).
- **Done when:** the user picked the prop from previews; resting works by keyboard; saves, the balance sim and all tests pass.
- **Depends:** C39

### C41 · Sprigling's early game
- **Goal:** No starter is quietly worse than the others. Grind before late fights stays as it is.
- **Deliverables:** tune Rival Mira in Fernhollow against a Sprigling team (25% at +2 levels in the trainer sweep) and Sprigling's first zone (10 wild losses per run against 3 for Drizzlet); balance report in the log.
- **Done when:** the three Verdale plans are within about 15 wild battles and 5 wild losses of each other in `npm run balance`; the playthrough tests pass.
- **Depends:** C39

### C42 · A Dex you can finish
- **Goal:** Catching every Zorling in one save is possible and worth chasing. Today 24 of 78 species can't be caught: every starter line except the player's own appears nowhere else (no wild spawn, no gift).
- **Deliverables:**
  - **Conditional spawns:** a zone spawn takes an optional `if` (a story condition, e.g. `{ badge: 'core:grove-badge' }`). Roamers only spawn from spawns whose condition holds; the check stays pure and seeded. The balance sim and the map window's per-zone lists follow the same rule. Saves are unchanged.
  - **Starter spawns, badge-gated:** once the player holds a region's badge, all three of its starters (stage 1, the zone's levels) spawn in that region's T1 zones at a low weight (~10%), each in the zone that fits its type. Verdale after the Grove Badge (Sunny Meadow, Willow Shore, Brookside Trail), Emberwaste after the Kiln Badge, Rimeholm after the Tide Badge.
  - **In-world rumour:** one T1 NPC per region gets a new line after the badge, hinting at the new Zorlings ("little sprouts in the meadow lately"). No marker, no quest.
  - **Dex counts and region pages:** the Dex shows "Seen x · Caught y / total", with tabs on a key that doesn't clash with `A`/`D` paging (e.g. `Tab`): All, then one page per region (core = Verdale), each with its own counts.
  - **Habitat:** a seen species' entry lists the zones where the player has met it (from the per-zone seen data the map window already keeps). Nothing the player hasn't found shows.
  - **Completability test:** every species can be obtained in one save, through a wild spawn, a boss capture or evolving one of those. It runs over all shipped packs, so a future pack can't repeat the gap.
  - `DESIGN.md` updated: the Dex goal (World/Team), conditional spawns, starter spawns per region.
- **Done when:** the completability test passes; a gated starter never spawns before its badge and does after (tests); the Dex tabs and habitat work by keyboard; `npm run balance` for all three regions stays within C41's bounds; `npm run check` passes.
- **Depends:** C41

---

## Later / future (not scheduled)

See "Feature plan" in `DESIGN.md`: day/night, fishing, following Zorling, league, held items, safari zone, condition flasks, item evolution; and future/server items (trading, PvP, breeding, mod loader, etc.).
