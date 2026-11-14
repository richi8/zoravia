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

### C37 · Release prep
- **Deliverables:** performance pass, accessibility pass (contrast, remapping, text speed), production build, deployment, final trademark check reminder.

---

## Later / future (not scheduled)
See "Feature plan" in `DESIGN.md`: day/night, fishing, following Zorling, league, held items, safari zone, condition flasks, item evolution; and future/server items (trading, PvP, breeding, mod loader, etc.).
