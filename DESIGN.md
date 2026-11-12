# Zoravia — Design Notes

*Zoravia* is both the game title and the name of the world; launch regions are regions of Zoravia.
Name status (checked 2026-11-12): no game or trademark with this exact name found (nearest: ZORA, a tech trademark — different word). zoravia.com is registered by someone else; **zoravia.game** was available. Still to do: formal USPTO/EUIPO check (Class 9 & 41).

The creatures are called **Zorlings** (same word for singular and plural: "a Zorling", "three Zorlings").

Browser monster-collecting RPG in the spirit of classic handheld creature games, built in TypeScript.
All graphics and audio are code-generated. Built from day one for expansion via content packs.

## Pillars
- Simple, readable turn-based combat with a tactical twist (conditions + reactions).
- Static, hand-curated world players get attached to.
- Sandbox: start in any region, each with its own light-toned campaign and lore.
- Infinite expandability: new regions / creatures / moves ship as packs, no engine changes.

## Tech
- TypeScript + Vite + PixiJS (WebGL), Web Audio API.
- Engine contains no content; everything loads from **packs** (`core` is itself a pack).
- Namespaced registries (`core:emberfox`), schema-validated (Zod), event hooks.
- Pure, deterministic battle engine: `(state, action) → state + events` (server-ready later).
- Saves in IndexedDB.

## World
- **Static map**: generated once offline from a fixed seed by a world tool, then hand-edited (towns, routes, landmarks, secrets). Shipped as data; identical for all players.
- Expansions attach new regions at defined connection points (sea routes, passes, ferries).
- Launch: **3 regions**, each ~200×200 tiles.
- Each region is **tiered concentrically**:
  - T1 (Lv 3–15): hub town, creature center, starters
  - T2 (Lv 15–30): mid campaign, Titans
  - T3 (Lv 30–45): region boss, legendary, rare species
  - Cross-region danger zones (Lv 45–60) for endgame
- Wild/zone levels fixed. Only campaign story bosses scale lightly (~+4 Lv per badge held).
- Badge-based soft level cap: XP gain sharply reduced above cap. Starting values (C13, tuned in C31): cap Lv 30 / 45 / 52 / 60 for 0 / 1 / 2 / 3 badges (+5 per further badge); XP at or above the cap ×0.1.

### Launch regions
1. **Temperate forest & lakes** — Nature / Water / Wind. Gentlest start.
2. **Volcanic desert** — Fire / Earth / Metal. Ash storms: battles start with Burning.
3. **Frozen coast islands** — Ice / Water / Electric. Storms: battles start with Wet.

Every region has all 8 types, weighted toward its own three.
Each region has its own lore, a legendary, a trial/badge, and **its own 3 starters**.

## Team
- **Hotbar = active team of 3** (keys `1 2 3`).
- **Storage** holds all other owned creatures; swapping only at a creature center.
- **Dex** tracks seen/caught species.
- Captures with a full team go to storage.

## Creatures
- **3 move slots**, moves learned by level-up only. Learning a 4th → replace or skip.
- Move relearner at centers (small fee).
- **Stats: HP, Attack, Defense, Speed** (no physical/special split; decided 2026-11-12, C12). Stat totals below are the sum of these four.
- **0 or 1 trait** per species (passive). Trait-less species get slightly higher stats.
- **Evolution lines vary**: single-stage, 2-stage, or 3-stage. Level-based evolution.
- Stat-total bands:
  - Single stage: ~470
  - 2-stage: ~330 → ~490
  - 3-stage: ~300 → ~410 → ~520 (starters, rares)
  - Captured Titan: its stage +5%
  - Legendary: ~575, never evolves
- No shiny variants (dropped 2026-11-12, C09 review: a recolored Zorling can be mistaken for another type, since type identity is carried by color).
- Nicknames (up to 12 characters).
- **Team-wide shared XP**: every team member that has not fainted gets the full XP of a win (decided 2026-11-12, C13).
- Evolution is offered on reaching the level; the player may wait, and it is offered again on later level-ups.

## Types (8)
Fire, Water, Nature, Electric, Ice, Earth, Wind, Metal (tank: high HP/DEF, low SPD).

Base effectiveness (×1.5 strong / ×0.67 weak):
- Fire > Nature, Ice, Metal
- Water > Fire, Earth
- Nature > Water, Earth
- Electric > Water, Wind
- Ice > Nature, Wind
- Earth > Fire, Electric, Metal
- Wind > Nature
- Metal > Ice, Wind; resists Nature, Ice, Wind, Metal

"A > B" means A's moves deal ×1.5 to B, and B resists A: B's moves deal ×0.67 to A. Against a dual-type defender the two multipliers multiply (decided 2026-11-12, C12; matches the C10 mock tooltips).

## Conditions & reactions
Each type applies one condition; another type exploits it. Conditions last **3 turns** (enough to apply → switch → exploit). A reaction consumes the condition.

| Type | Applies | Side effect | Exploits | Reaction |
|---|---|---|---|---|
| Fire | Burning | damage over time | Overgrown | Wildfire ×2 |
| Water | Wet | −speed (small) | Burning | Steam Burst ×1.75, −accuracy |
| Nature | Overgrown | small HP drain | Muddy | Rooted: can't switch, drain grows |
| Electric | Charged | 10% fumble | Wet | Conducted ×1.75 |
| Ice | Chilled | −speed | Wet | Frozen: skip turn |
| Earth | Muddy | −accuracy | Chilled / Airborne | Shatter ×2 ignore DEF / Slam ×1.75 |
| Wind | Airborne | −evasion | Exposed | Shred ×1.75 ignore DEF |
| Metal | Exposed | −defense | Charged | Overload ×1.5 + stun |

- Side-effect sizes (e.g. Burning = 1/16 max HP per turn, Wet = speed ×0.85) are starting values in `packs/core`, tuned in C31.
- Switching out clears your creature's conditions (switch costs the turn).
- Wild creatures apply conditions too; dual-type wilds can self-combo (rare, dangerous).
- Biome weather can apply conditions at battle start.
- Trainers combo via switching.

## Combat
- 1v1 turn-based, menu-driven (see Controls). Switch costs the turn (shortcut `1 2 3`); free after a faint.
- Potion use costs the turn.
- Visible overworld encounters (no random grass battles).

## Bosses
- **Titans** (2–3 per region): boosted regional species with boss aura (~×3 HP, Armor, extra move).
  - **Armor**: takes ×0.3 damage until the right reaction breaks it → ×1.5 damage for 2 turns, then re-arms.
  - Hinted via NPC dialogue; weakness logged in Dex after first encounter.
- **Regional legendary**: campaign finale, T3 level, one clear weakness, never evolves, bound by level cap.
- **Capture**: defeat the boss → it becomes **Subdued** → standard capture item, guaranteed.
- **Boss form ≠ captured form**: aura is gone after capture. Titans keep a Titan mark (+5% stats, bigger glowing sprite, signature move).
- **One per save**, with **rematches** available later (higher level, rewards).

## Economy
- Potions: **shop-only, money-only**, tiered prices, **bag cap 5 per type**.
- Money: trainers (one-time, good), quests (one-time, good), wild creatures (small change).
- Brute-forcing a Titan ≈ 4–5 good potions ≈ one route of trainer income: doable sometimes, not always.

## Presentation
- **Pixel art** (decided 2026-11-12, C07 review): everything is generated in code as shapes, then rendered small, snapped to a limited palette and scaled up with crisp, nearest-neighbor pixels. Dark outlines, flat shading bands, optional pixel textures (e.g. scales).
- **Base resolution 480×270** ("modern pixel", decided 2026-11-12): everything is drawn in game pixels, shown at a whole-number scale (×2, ×3, ×4, … ×8 for 4K) so pixels stay crisp. 480×270 is the **minimum** visible area: the game always fills the whole window, and windows of other shapes or sizes show more game pixels (e.g. 480×300 on a 16:10 laptop at ×3). No stretching, no letterbox bars. UI, Zorlings and tiles keep their size in game pixels; the world and battle backgrounds extend to fill, and UI anchors to screen edges.
- **UI style** (decided 2026-11-12, C10 review): "storybook" — cream paper panels with brown ink borders and a gold cursor, drawn as pixel art in game pixels. **UI text is smooth** (not pixelated): it is laid out in game pixels but rendered at the screen's native resolution on a UI layer above the pixel screen (Nunito for text, Fredoka for names and callouts). Icons, badges and bars stay pixel art.
- **Tooltips** explain icons and badges (types, conditions, team slots): on mouse hover, and by keyboard via inspect mode (`F`).
- **World tiles** (decided 2026-11-12, C11 review): "storybook bright", the same friendly palette as the UI. It uses 3–5 tone ramps per material, soft dithered shading, outlines tinted from each object's own color, and soft shadows on the palette. Shores, paths and patches are autotiled from terrain stored per tile corner, so any shape works.
- Starting sizes (tunable in playtesting):
  - World tiles **16×16** (≈ 30×17 tiles on screen); player and NPCs about 16×24.
  - Overworld (roaming) Zorlings fit 32×32.
  - Battle sprites **96×96** (Titans 128×128; legendaries up to 128×128).
- Procedural creatures, genome-based (body plan, parts, palette, seed), drawn as pixel-art sprites at those sizes.
- Rigged parts animated via transforms (tail wag, wing flap, breathing).
- Battle animations: idle breathing, attack lunge, type VFX, hit flash/knockback/hit-stop/shake, damage numbers, reaction callouts, condition overlays, switch dissolve, capture arc + wobble, faint fade. Actions ≤ ~1.5s; battle speed setting.
- Overworld: 4-dir walk cycles, grass rustle, water ripple, roaming creatures/NPCs, battle transition.
- Lighting, weather particles, grass/water shaders, camera easing.
- Audio: synth SFX, genome-derived cries, procedural biome music, hand-authored boss themes, ambience.

## Controls
**The whole game must be fully playable with the keyboard alone.** Mouse is optional (click-to-move, click menu items), never required. All keys rebindable; gamepad later.

### Universal keys (everywhere, including every menu)
| Action | Keys |
|---|---|
| Move (overworld) / navigate (when a menu is open) | `W A S D` or arrows |
| Confirm / interact | `E` (also `Enter`, `Space`) |
| Back / cancel | `Q` (also `Esc`, `Backspace`) |
| Inspect (tooltips for icons/badges on screen; directions move between them) | `F` |

Input is context-sensitive: `WASD`/arrows move the player in the overworld; while any menu is open (including the battle action menu) they navigate that menu instead. Every menu is a focusable list/grid with a clearly highlighted cursor. Cursor wraps around at the ends.

The player has **one movement speed** (no running / running shoes), **3.75 tiles/second** (one tile per 16 frames at 60 fps). Tunable in playtesting, but there is never a slower walk.

### Overworld
`I` inventory, `M` map, `P` party, `B` dex, `J` quests, `Esc` pause menu.

### Battle flow (keyboard)
1. Encounter starts → **action menu** appears: `Fight`, `Switch`, `Items`, `Run`.
   - `W/S` (or arrows) move the cursor, `E` confirms.
2. `Fight` → **move list** (up to 3 moves). `W/A/S/D` / arrows move between moves, `E` uses the move, `Q` goes back.
   - The highlighted move shows type, power, accuracy, and which condition it applies or exploits on this enemy.
3. `Switch` → hotbar list of 3 creatures, `E` confirms (costs the turn), `Q` back. Kept as an alternative for players who prefer menus; the primary way to switch is `1 2 3`.
4. `Items` → bag list, `E` selects item → `E` selects target, `Q` back.
5. Dialogue/battle text advances with `E`; holding `E` speeds it up.

**Primary switching:** `1 2 3` switch directly to that hotbar creature whenever it's the player's turn (costs the turn). Optional confirm prompt, toggleable in settings. Moves have no letter hotkeys because `W` is used for navigation.

## Feature plan
**V1 (core):** evolution, trials/badges, rival across regions, regional legendaries, team-wide shared XP, hidden items/secrets, autosave, fast travel, nicknames, traits, move relearner.

**Later:** day/night spawns, fishing, following creature, league endgame, held items, safari-style zone, condition flasks (shop items applying conditions), item-based evolution.

**Future / server:** trading & PvP, natures/hidden stats, breeding/eggs, mega-style gimmicks, bond system, creature ecology/behaviors, crafting, mounts, seed sharing / daily dungeons, photo mode, mod loader.

## Roadmap
Detailed, AI-sized chunks live in `IMPLEMENTATION_PLAN.md`; progress in `PROGRESS.md`; per-chunk logs in `logs/`.
1. Engine foundation: packs/registries, input, scenes, UI framework
2. **Style lab** (in-project, `/lab` route): brand/logo, design tokens, UI kit, Zorling generator + animation, biome tiles, battle mock. Validates procedural art early; its code is reused by the game. Ends with an art-direction approval gate.
3. Data model: types, conditions, moves, species, items, Zorling instances
4. Battle engine (pure) + battle scene
5. World: map tool, overworld, encounters, centers/shops/storage, saves
6. Audio
7. Campaign systems: dialogue, quests, trials, rival, bosses
8. **One full region** (T1–T3, campaign, Titans, legendary) — the fun gate
9. Polish, then regions 2 & 3 as packs, endgame, release prep

## Open
- Logo: current dragon crest is a first version; revisit later.
- Formal trademark check for "Zoravia" (EUIPO; USPTO Class 9 & 41).
