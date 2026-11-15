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
- Saves in IndexedDB. Rules settled in C23 (2026-11-13):
  - **3 save slots**, each one playthrough. Writing a slot keeps the previous write as a backup, used if the main copy can't be read.
  - **Autosave** after every battle, when a menu, dialog or service closes with something changed, every 30 s of play while something changed, on quitting, and when the tab is hidden. The pause menu also has **Save**.
  - A save keeps the party (team, storage, bag, money, Dex, boss log, story flags and quests), the player's map, tile and facing, the last center used, and play time. Wild Zorlings and NPC positions are not kept; they respawn.
  - Saves are **versioned** and old versions are upgraded on load. Since C36 (v5) each saved place keeps its map's `origin`, so a map that grew on its north or west side moves old positions with it. Since C36b (v6) a save keeps each visited map's **exploration** (revealed cells and discovered places); a save from before gets a reveal around what its progress proves (its place, last center, trainers beaten, bosses logged and the hubs of regions with any of those). A save that needs content from a pack that isn't loaded is refused with the missing ids. Numbers a pack update moved (HP above the new max, bag counts above a new cap) are lowered instead.

## World
- **Static map**: generated once offline from a fixed seed by a world tool, then hand-edited (towns, routes, landmarks, secrets). Shipped as data; identical for all players.
- Expansions attach new regions at defined connection points (sea routes, passes, ferries). Settled in C34: a link is written on **either end** (`to: "pack:region#connection"`), so an expansion attaches itself to a core exit without changing the core map; an exit whose other end isn't loaded leads nowhere. Stepping onto a linked connection saves and opens the other map, with the player on its connection facing inland. The respawn center stays per map (the region's first center until one is used there).
- Launch: **3 regions**, each ~200×200 tiles, plus an endgame strip (200×280 or 280×200 in all, C36).
- **Maps grow by strips** (C36): a region that already shipped is extended by a strip glued onto one side (`extensions` in `region.json`, frozen like the base). Its existing tiles stay as they are; only the border trees in front of a join open. The long-term goal (user, 2026-11-15) is one seamless world with no loading between regions; that is a later engine chunk.
- Each region is **tiered concentrically**:
  - T1 (Lv 3–15): hub town, creature center, starters
  - T2 (Lv 15–30): mid campaign, Titans
  - T3 (Lv 30–45): region boss, legendary, rare species
  - Danger zones (Lv 45–60) for the endgame. Settled in C36 (2026-11-15):
    - **One per region**, inside its own map, in the strip it grew by. A future region pack ships its own.
    - What crosses regions is the meta-quest (see "Story"), not a shared map.
    - Each has two zones (Lv 45–52 and 52–60), a camp with no center, three ace trainers, two Elder Titans, hidden items, and a heart guarded by a Keeper (Lv 57–59).
    - A ranger blocks the only way in until the player holds 3 badges, which is when the XP cap reaches 60.
    - Wild Zorlings are the region's own and core species, plus two **rares** per region from its own model kit.
- Wild/zone levels fixed. Only campaign story bosses scale lightly (~+4 Lv per badge held).
- Badge-based soft level cap: XP gain sharply reduced above cap. Values (C13, kept in C31): cap Lv 30 / 45 / 52 / 60 for 0 / 1 / 2 / 3 badges (+5 per further badge); XP at or above the cap ×0.1. In the C31 playthrough simulator Verdale ends at Lv ~40–42, under the one-badge cap.
- **Pacing** (C31 balance pass, `npm run balance`): a region's campaign takes about 120–145 wild battles and 3–4 hours. Trainers field the stage a wild Zorling has at that level (no final forms below their evolution level), except a rival's ace. A new game starts with one **Lv 6** starter, 2 Potions, 5 Zorbs and 500 coins (C33); a region's first zone tops out at that level.

- **Exploration** (C36b, user idea 2026-11-15): every map starts dark. Walking reveals it in 4×4-tile cells within 9 tiles of the player. Entering a zone, or coming near a town, landmark, secret, lair, shrine, arena or heart, **discovers** it: a toast shows its name and level range ("Discovered", "Town", gold-edged "Secret place").
  - The `M` map shows unexplored land as blank parchment (preview pick), labels discovered places, and centers on the player at 1 px per tile when the region is bigger than the screen. `E` on it opens the Atlas.
  - The **Atlas** (pause menu, layout "Ledger" from the preview round) shows every start region: its map tinted by tier with markers for towns, trainers, trial, rival, Titans, region boss, legendary, gate, Elder Titans and Keepers; a zone list (levels, storms, wild Zorlings seen and caught); a fight list (level, result, and the weak spot once beaten or caught); the quest log; and badges, hearts and the Dex. Nothing undiscovered shows: unknown zones, fights and Zorlings read "?". `A/D` region, `W/S` select, `Tab` next list, `F` a details card.
  - Packs mark special NPCs for the Atlas (`mark`: trial, rival, boss, gate, elder, keeper); trainers, Titans and legendaries are recognized from the battles their dialogue starts.

- Region maps settled in C28 (2026-11-13):
  - A region's big shapes (towns, roads, rivers, lakes, zone areas, landmark clearings, exits) are placed by hand in its layout; the world tool adds the organic detail (edges, ponds, trees, grass) once, then the overlay places buildings, signs and NPC spots.
  - Every walkable tile of a shipped region is reachable from its start town.
  - Towns have no zone, so no wild Zorlings walk between the houses.
  - Buildings (Zorling center, shop, houses) have **no interiors**: pressing `E` at a center or shop door talks to its attendant, who stands next to the door. Building look: storybook style "A" (C28 preview round), fixed town colors in every region, red-roofed center with a heart emblem.
  - Roads crossing water get wooden bridges; secrets may hide behind a gap in a tree wall or across walkable lily pads.

### Launch regions
1. **Verdale** (temperate forest & lakes) — Nature / Water / Wind. Gentlest start. Hub town Willowmere, second town Fernhollow (Grove Trial), outpost Galecrest; exits: Ember Pass (east, to region 2) and a ferry dock (south, to region 3).
   - Zorlings (C29): 23 species. Starters **Sprigling** (Nature), **Drizzlet** (Water) and **Emberkit** (Fire): the Fire > Nature > Water > Fire triangle reads best for a first choice, even though Fire is not one of Verdale's three types. Titans: **Mossback** (Hollow Oak, Deepwood; breaks on Wildfire) and **Bogmaw** (Sunken Hollow, Reed Marsh; breaks on Conducted). Legendary: **Verdion** (Nature/Wind, Heartwood Shrine; breaks on Overload since C31, was Shatter: Nature resists Earth, so that plan lost to plain potions in the simulator).
   - Danger zone (C36): **Thornveil**, north of the Heartwood Shrine (Verdale grew north by 80 tiles). Tanglewild 45–52 and Elderroot Deep 52–60 (canopy). Keeper Ysolde at the Elder Tree; Elder Mossback and Elder Bogmaw. Rares: **Elderhorn** (Nature/Earth stag) and **Stormoth** (Wind/Electric moth). Rival Mira's finale is at Thornveil Camp.
   - Campaign (C30): every spring the Heartwood breathes out the **Seedwind**, which wakes the forest; this year it has not come. Main quest **The Still Wind** (Elder Rowan): Grove Badge in Fernhollow → face both Titans (each shows a vision of Crown Rock) → beat the region boss **Stormcatcher Vex** on Crown Rock, whose Gale Engine bottles the wind (her Storm Galehawk fights in boss form) → Verdion appears at the Heartwood Shrine → tell Rowan. Rival **Mira** meets the player on Willowmere's north road, at the trial after the badge, and in Galecrest after both Titans. Her starter line is the one that beats the player's (C33): Fire against Sprigling, Nature against Drizzlet, Water against Emberkit. Four side quests, readable signs and lore stones, and hidden items in the secrets and landmarks.
2. **Emberwaste** (volcanic desert, pack `emberwaste`, C34) — Fire / Earth / Metal. Hub town Cinderwell, trial town Kilnreach (Forge Trial, Kiln Badge), outpost Slagwatch; Ember Pass (west) leads to Verdale's.
   - **Ash storms** (C34): a zone can set `battleWeather` (conditions put on both Zorlings sent out first in every battle started there). The Cinder Dunes, Ashfall Slopes and Caldera Rim have ash storms: every battle starts with both Zorlings Burning, so a Water hit sets off Steam Burst. Cosmetic weather stays separate (C32).
   - Zorlings (C34): 24 species. Starters **Sizzlet** (Fire), **Pebbit** (Earth) and **Pricklet** (Nature): Fire > Nature > Earth > Fire. Core's Hearthog, Ironshell and Voltbat live here too. Titans: **Dunewyrm** (Sunken Sands, Cinder Dunes; breaks on Steam Burst, which its ash storm sets up) and **Forgeback** (Old Foundry, Rust Canyon; breaks on Shred). Legendary: **Calderon** (Fire/Earth, Ember Heart; Heatproof, breaks on Frozen; aura ×1.75 HP).
   - Danger zone (C36): the **Ashen Rift**, east of the Lookout (the map grew east by 80 tiles). Cinder Rift 45–52 (ash storm) and Molten Deep 52–60, across a lava river. Keeper Ashka at the Rift Forge; Elder Dunewyrm (in the storm) and Elder Forgeback. Rares: **Brimscorp** (Fire/Metal scorpion) and **Shardwing** (Metal/Wind glass vulture).
   - Campaign (C34): the vents of Mount Caldus have gone quiet, the forges of Kilnreach are cold, and the trapped heat bursts out as ash storms. Main quest **The Cold Forge** (Elder Sabra): Kiln Badge → both Titans (each shows a vision of iron lids on the caldera vents) → region boss **Glassmaker Gorran** at the Cap Works, who capped the vents to heat a glass dome against the storms (his Kiln Ironjaw fights in boss form, breaks on Shatter) → Calderon at the Ember Heart → tell Sabra. Rival Mira travels: she meets the player in Cinderwell, Kilnreach and Slagwatch, with the starter line that beats the player's, from the player's own region. Four side quests, signs, stones and hidden items.
3. **Rimeholm Isles** (frozen coast islands, pack `rimeholm`, C35) — Ice / Water / Electric. Nine islands joined by wooden piers, plus skerries (unreachable islets, scenery only). Hub town Brinewick (with the ferry pier to Verdale's dock), trial town Glimmerholm (Tide Trial, Tide Badge), outpost Rimeport.
   - **Sleet storms** (C35): the Sleet Fells, Squall Reach and White Crown set `battleWeather: ['core:wet']`, with snow in the air. Every battle there starts with both Zorlings Wet, so Ice sets off Frozen and Electric sets off Conducted.
   - Zorlings (C35): 25 species, drawn from the frozen model kit (C35a). Starters **Selkit** (Water), **Woolump** (Earth) and **Sparkit** (Electric): Water > Earth > Electric > Water (no triangle includes Ice, which beats only Nature and Wind). Core's Rimewisp, Voltbat, Mudpaddle, Hearthog and Galehawk live here too. Titans: **Floemaw** (Tusk Rookery, Sleet Fells; breaks on Frozen, which its sleet storm sets up; Lv 16) and **Squallwing** (Thunder Eyrie, Thunder Bluffs; breaks on Overload; aura ×2.5 HP, because Electric/Wind is weak to Ice, Earth and Metal). Legendary: **Glacivar** (Ice/Electric, Crown Shrine; breaks on Slam; aura ×1.75 HP; moved here from core, where it was the test legendary).
   - Danger zone (C36): the **Polar Drift**, an ice shelf reached by a pier south of the Crown Shrine (the map grew south by 80 tiles). Driftice Floes 45–52 (sleet storm) and Aurora Shelf 52–60. Keeper Aurelle at the Starfall Cairn; Elder Floemaw (in the sleet) and Elder Squallwing. Rares: **Starhorn** (Ice/Wind aurora caribou) and **Deepjaw** (Water/Ice angler).
   - Campaign (C35): every Long Night the **Crownlight** (the winter lights over the White Crown) knits the sea ice between the islands; this winter the lights are fading, the ice will not knit, and the open sea churns into sleet storms. Main quest **The Fading Lights** (Elder Halvard): Tide Badge ("soak, then strike") → both Titans (each shows a vision of the lights pouring into a lighthouse) → region boss **Lampwright Odessa** at the Stormspire, who pulled the lights into her lamp so no ship would wreck on the shoals again (her Lodestar Lumenaw fights in boss form, breaks on Rooted, aura ×1.25 HP; her team is one level below Vex's and Gorran's) → Glacivar at the Crown Shrine → tell Halvard. Rival Mira meets the player in Brinewick, Glimmerholm and Rimeport. Four side quests, signs, stones and hidden items. Verdale's ferry (Ferryman Gus) now runs.

Every region has all 8 types, weighted toward its own three.
Each region has its own lore, a legendary, a trial/badge, and **its own 3 starters**.

## Starting a game
Settled in C33 (2026-11-14):
- The game opens on a **title screen**: the dragon crest over the first start region's map, dimmed and drifting, with its own theme. Its menu: Continue (the slot saved last), New game, Load game, Settings.
- **New game**: pick a save slot (it asks before overwriting one), then a **start region**, then one of that region's **starters**. Start regions are pack data (`starts`): the map and spot, the starters, their level, the bag and the money. Verdale, Emberwaste (C34) and the Rimeholm Isles (C35) exist.
- Choosing a starter sets its story flag (`core:starter-sprigling`, …), so dialogue and trainers can react to it. A trainer's team member can name another species for a story condition (`instead`), which is how the rival counter-picks.
- **Rival Mira travels** (C34, C35): in every region her starter line beats the player's. Against a starter of the region she is in, or of a region whose pack that one depends on (Verdale's, from core), she brings that region's winning line. A pack never names another pack's species unless it depends on it, but a starter flag is only a name, so against a starter from a region it does not depend on she brings her own region's line that wins, or her default (Verdale's Fire line) when none does. Emberwaste and Rimeholm count each other's starters this way.
- **Load game** shows the slot cards (team portraits, lead and level, region, badges, Zorlings caught, play time, when it was saved); a slot can be continued or deleted there. Quitting from the pause menu goes back to the title.
- **Settings** (title and pause menu) belong to the device, like the volumes: battle speed (1×, 1.5×, 2×), text speed (slow, normal, fast), the `1 2 3` switch prompt, screen shake, full-screen flashes, Sound (volumes), mute while the tab is hidden, and Controls.
- **Controls**: every key group (Up is both walking and menu up) has two key slots. Taking a key another control uses swaps the two. `Esc` always stays Back and Menu and can't be taken, a swap that would leave a control with no key is refused, and mouse buttons keep their roles.

## Team
- **Hotbar = active team of 3** (keys `1 2 3`).
- **Storage** holds all other owned creatures; swapping only at a creature center.
- **Dex** tracks seen/caught species.
- Captures with a full team go to storage.
- Rules settled in C22 (2026-11-13; starting values, tuned in C31):
  - The team always keeps at least one Zorling (the last one can be swapped, not deposited). The hotbar order can be changed anywhere from the party screen.
  - A center heals the team and storage for free. The move relearner costs 100 coins per move.
  - A Zorling counts as seen when it is on screen in the overworld or met in battle.
  - Losing a battle (whole team fainted) sends the player back to the last Zorling center they used (the region's first center until then), team healed. No money is lost.
  - Potions can be used outside battle on a team member that has not fainted (no revives).

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
  - Endgame rare (C36): ~520 (a final form's), single-stage, harder to catch (×0.6), found only in danger zones
- No shiny variants (dropped 2026-11-12, C09 review: a recolored Zorling can be mistaken for another type, since type identity is carried by color).
- Nicknames (up to 12 characters).
- **Team-wide shared XP**: every team member gets the full XP of a win, fainted ones too (decided 2026-11-12, C13; fainted members included since C31: without them the lead, which faints most, fell 5–7 levels behind its teammates in the playthrough simulator).
- Evolution is offered on reaching the level; the player may wait, and it is offered again on later level-ups.
- **Stages look different, not just smaller** (C29, user review): a baby is rounder and paler with big eyes and fawn spots, and has no horns, back plates or wings (unless the line always flies). A middle stage gets the first adult features (one horn for antlers, spikes for plates, the adult markings). Lines may also change body plan while young (`look.young`, e.g. fish → serpent, puffball chick → bird); that is the default for ordinary lines, while dragons and other distinctive lines keep their shape. A line keeps one voice (the final form's) across stages.
  - Settled in C22b (2026-11-13): the choices are asked after the battle, in the overworld. A new move with all 3 slots full: pick one to forget, or don't learn it (the move relearner can teach it later). Evolution: "Evolve" or "Not now"; a Zorling that waited can also evolve any time from the party screen. Moves the new form learns at its current level are taught (free slot) or offered the same way.

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
- Biome weather can apply conditions at battle start: they go on **both** Zorlings sent out first (traits such as Waterproof still block them). It is set per zone (`battleWeather`, C34), and story battles get the weather of the zone their NPC stands in.
- Rules settled in C15 (2026-11-12):
  - A Zorling can have several different conditions at once. Applying one it already has restarts its 3 turns (no stacking).
  - "Lasts 3 turns" means 3 of the holder's own turns. A condition put on a Zorling that has already acted this turn starts counting next turn. Side effects (HP loss) happen at the end of each turn it counts, player side first.
  - Only hits with power set off reactions; status moves just apply their condition. A hit sets off at most one reaction (the oldest matching condition), and it can then apply its own condition (chains are allowed).
  - "Ignore DEF" means the target's defense counts as no higher than the attacker's attack.
  - Frozen / Overload: the Zorling loses its next move (this turn if it has not acted yet). Switching out still works and clears it.
  - Rooted blocks switching only; running from a wild battle still works.
  - Drains (Overgrown, Rooted) heal the Zorling the applier's side has on the field. Weather drains heal no one.
- Trainers combo via switching.

## Combat
- 1v1 turn-based, menu-driven (see Controls). Switch costs the turn (shortcut `1 2 3`); free after a faint.
- Turn order: running first, then switches and items, then moves by Speed (a tie is a coin flip). A Zorling that faints before acting loses its move.
- Damage (starting values, C14; tuned in C31): ((2·Lv/5 + 2) · power · ATK/DEF) / 50 + 2, × type effectiveness, × a random roll 0.85–1. At least 1. No critical hits. No same-type bonus (dropped 2026-11-12: it would weaken the off-type moves that combos rely on; revisit in C31 only if everyone ends up using the same few moves).
- Run (wild battles only): always works when at least as fast as the foe; otherwise 50%, +25% per failed attempt. A failed attempt costs the turn.
- The XP of a win is the sum over every opposing Zorling, awarded when the battle is won or the wild Zorling is caught (none for running or losing).
- Potion use costs the turn. A potion can go on any team member that has not fainted and is not at full HP (no revives).
- Capture (wild battles; C16 starting values, tuned in C31): a capture item costs the turn and is used up. Chance = (0.1 + 0.75 × missing HP fraction) × item strength × species catch rate (default 1), ×1.2 if the Zorling has a condition. So ~10% at full HP, ~85% at 1 HP. A catch ends the battle at once.
- Opponents (wild and trainers) do not use items for now. Wild Zorlings pick a random move; trainers pick by expected damage, reactions and condition setup, and switch to a teammate that can exploit a condition on the foe.
- Visible overworld encounters (no random grass battles).

## Bosses
- **Titans** (2–3 per region): boosted regional species with boss aura (~×3 HP, Armor, extra move). Bulky species may get less (Verdale's bosses: ×2, C29 simulations), set per boss.
  - **Armor**: takes ×0.4 damage until the right reaction breaks it → ×1.5 damage for 2 turns, then re-arms. (Was ×0.3; changed 2026-11-12 in C17: with ×0.3, brute force needed ~8 good potions in the simulation instead of the ~4–5 the Economy section asks for.)
  - Hinted via NPC dialogue; weakness logged in Dex after first encounter.
- **Regional legendary**: campaign finale, T3 level, one clear weakness, never evolves, bound by level cap.
- **Capture**: defeat the boss → it becomes **Subdued** → standard capture item, guaranteed.
- **Boss form ≠ captured form**: aura is gone after capture. Titans keep a Titan mark (+5% stats, bigger glowing sprite, signature move).
- **One per save**, with **rematches** available later (higher level, rewards). A boss counts as done once it is beaten or caught; losing or running leaves it waiting (C23).
- **Elder Titans** (C36): each region's two Titans again, in its danger zone, at Lv 52 and 56. Each is a boss of its own, with the Titan's species, signature move and weak spot but an aura tuned for endgame teams (×3; the Elder Bogmaw ×2.5, the Elder Squallwing ×4). An Elder is fought like a trainer's boss: it faints and is never caught, so the one-per-save rule holds. It appears once that Titan is beaten or caught. The +8 rematches at the old lairs stay.
- Rules settled in C17 (2026-11-12; starting values, tuned in C31):
  - The extra move is the boss's **signature move**. A boss can know 4 moves in boss form; caught, it keeps the signature move in place of its oldest move.
  - Each boss lists the reactions that break its Armor (usually one). The breaking hit already counts ×1.5; Armor stays broken for the 2 turns after, then re-arms at the end of the second. Other reactions still hit ×0.4.
  - Damage over time and drains on a boss are fractions of its HP **without** the aura, so the aura does not make Burning stronger than the hint.
  - Defeated in a wild battle, a boss is **Subdued** (not fainted): it waits, and the player can only throw a capture item, which always works. Capture items cannot be thrown at a boss before that. With no capture item in the bag, the battle ends as a win. In trainer battles a boss faints as usual.
  - Running from a boss battle follows the wild rules.
  - Caught, it comes with 1 HP. Legendaries get no Titan mark.
  - Trainer AI against Armor: plain hits count ×0.4, and breaking it (or setting up the condition that breaks it) is worth a bonus.

## Story: dialogue & quests
Rules settled in C26 (2026-11-13):
- Dialogue and quests are **pack data only** (`dialogues` and `quests` registries); an NPC talks either in plain `lines` or through a `dialogue`.
- **Flags** are named numbers in the save (`core:met-elder`). A set flag is 1; counters go up by any amount. Nothing declares flags up front.
- A dialogue is a graph of nodes. A node shows some pages, runs its actions, then offers up to 4 **choices**, branches on conditions, goes on, or ends. Choices whose condition fails are hidden. Choices appear in a small menu above the last page; `Q` picks the last choice (by convention the "no / leave" one).
- What actions do is told to the player right after the node's pages, without a speaker ("You received Super Potion.", "New quest: …", "Quest updated: …", "Quest complete: …!"), with a short chime (a fanfare on completion).
- A **quest** is a list of steps. A step is done as soon as its condition holds, and quests are checked after every dialogue, battle and menu. So dialogue moves a quest on by setting a flag, and a step like "catch a Voltbat" can already be done when it is reached (the quest moves straight past it). The last step completes the quest and pays its reward once.
- The quest log (`J`) lists active quests first, then finished ones. It shows only the steps reached so far, never the ones ahead.
- Signs, lore stones and hidden items are NPC **objects** (C30): a `sign` is not drawn and makes a sign or standing-stone prop readable; an `item` lies on the ground as a small Zorb, gives its item once (a flag) and stays while the bag has no room for it. Neither shows a name tag.

### Endgame: Beyond the Map (C36)
- Once the player holds 3 badges, a **Guild Surveyor** turns up in every region's hub and gives the core quest **Beyond the Map**: chart three danger-zone hearts by beating their Keepers. Each Keeper beaten adds 1 to `core:hearts-charted`. The quest counts badges and hearts as numbers, so a future region's zone counts too.
- After three hearts, **Rival Mira** waits at Thornveil Camp for the finale. Her team is Lv 62/62/64, above the cap ("no level caps to hide behind"), with the Verdale line that beats the player's starter as her ace. Against Sparkit, which no Verdale starter line beats, she brings a Mossback. The quest pays 10 000 coins and 3 Max Potions. She can be fought again.

## Economy
- Potions: **shop-only, money-only**, tiered prices, **bag cap 5 per type**.
- Money: trainers (one-time, good), quests (one-time, good), wild creatures (small change: 4 + 2 × level per win, C22 starting value, kept in C31).
- Prices (kept in C31): Potion 100 (30 HP), Super Potion 300 (80 HP), Max Potion 900 (full), Zorb 60. Max Potions are sold in a region's second town (Fernhollow) since C31: in the simulator, T3 money piled up with nothing to buy. Over Verdale the simulated player earns about 7 000 coins from wild battles and 13 000 from trainers, and spends nearly all of it on potions.
- Brute-forcing a Titan ≈ 4–5 good potions ≈ one route of trainer income: doable sometimes, not always.

## Presentation
- **Pixel art** (decided 2026-11-12, C07 review): everything is generated in code as shapes, then rendered small, snapped to a limited palette and scaled up with crisp, nearest-neighbor pixels. Dark outlines, flat shading bands, optional pixel textures (e.g. scales).
- **Base resolution 480×270** ("modern pixel", decided 2026-11-12): everything is drawn in game pixels, shown at a whole-number scale (×2, ×3, ×4, … ×8 for 4K) so pixels stay crisp. 480×270 is the **minimum** visible area: the game always fills the whole window, and windows of other shapes or sizes show more game pixels (e.g. 480×300 on a 16:10 laptop at ×3). No stretching, no letterbox bars. UI, Zorlings and tiles keep their size in game pixels; the world and battle backgrounds extend to fill, and UI anchors to screen edges.
- **UI style** (decided 2026-11-12, C10 review): "storybook" — cream paper panels with brown ink borders and a gold cursor, drawn as pixel art in game pixels. **UI text is smooth** (not pixelated): it is laid out in game pixels but rendered at the screen's native resolution on a UI layer above the pixel screen (Nunito for text, Fredoka for names and callouts). Icons, badges and bars stay pixel art.
- **Tooltips** explain icons and badges (types, conditions, team slots): on mouse hover, and by keyboard via inspect mode (`F`).
- **World tiles** (decided 2026-11-12, C11 review): "storybook bright", the same friendly palette as the UI. It uses 3–5 tone ramps per material, soft dithered shading, outlines tinted from each object's own color, and soft shadows on the palette. Shores, paths and patches are autotiled from terrain stored per tile corner, so any shape works.
- **Overworld characters** (decided 2026-11-12, C20 review, after the user's reference sheet): 16×24 sprites with a single dark navy outline (unlike the tiles' tinted outlines, so characters stand out from the world), big round hair, plain 2×2 eyes, a flat side profile (no nose) and outfit colors from a palette, so NPCs reuse the same body. The face never changes between walk frames; the walk is stand, step, stand, other step, with a 1-pixel body dip and arm swing on steps. The player wears a teal jacket with gold trim and teal pants.
- Starting sizes (tunable in playtesting):
  - World tiles **16×16** (≈ 30×17 tiles on screen); player and NPCs about 16×24.
  - Overworld (roaming) Zorlings fit 32×32.
  - Battle sprites **96×96** (Titans 128×128; legendaries up to 128×128).
- Procedural creatures, genome-based (body plan, parts, palette, seed), drawn as pixel-art sprites at those sizes.
- **Regional model kits** (C35a, user review): each region's Zorlings come from its own body plans, so regions don't look like recolors of each other. A kit is pack data (`modelKits`): the plans a region's species may use, and part weights added to each plan's own (0 removes a kind). A species names its kit in `look.kit`, and its plans must come from it.
  - **Verdale:** the 13 classic plans.
  - **Emberwaste (desert):** lizard, scorpion, beetle, cactus, tortoise, sandworm, vulture, fennec. Sails, carapaces, long ears and stripes are common. No leaves, icicles, ruffs or manes.
  - **Rimeholm (frozen):** seal/walrus, mammoth, jellyfish, crab, anglerfish, stoat/otter, owl, caribou, urchin. Fur ruffs, icicles and frost are common. No leaves, sails, flame tails or socks.
  - The regions share no plans. New parts: tusks, angler lure, fur ruff, icicles, carapace, stinger and frost markings. Stage rules hold: babies have no tusks, lures, icicles or shells.
- **Legendaries** (C35a): each region's legendary is a one-of-a-kind dragon of its element, used by nothing else. Verdion is a leafwyrm (a floating eastern dragon), Calderon a magmadrake (lava-cracked and rock-plated), Glacivar a frostwyrm (a wyvern with crystal wings). Their glowing details use the type's glow color. In battle they **shine**: a soft glow edge plus sparkles that twinkle in turn.
- Rigged parts animated via transforms (tail wag, wing flap, breathing).
- Battle animations: idle breathing, attack lunge, type VFX, hit flash/knockback/hit-stop/shake, damage numbers, reaction callouts, condition overlays, switch dissolve, capture arc + wobble, faint fade. Actions ≤ ~1.5s; battle speed setting.
- Overworld: 4-dir walk cycles, grass rustle, water ripple, roaming creatures/NPCs, battle transition.
- Lighting, weather particles, grass/water shaders, camera easing.
  - **Day and night** (C32) are cosmetic: a 20-minute day on the play clock (a new game starts in the morning). Lamps and windows light up from dusk. Wild spawns do not change with the time of day (day/night spawns stay a "Later" idea).
  - **Area moods** (C32) come from map data: a zone or an anchor can set a light mood (`canopy`, `shrine`, `mist`) and a zone can set cosmetic weather. Overworld weather never changes battles.
- Presentation (C32): iris wipes into the world and out of battles; an intro splash before trainer and story-boss battles; quest and badge news as toasts that do not stop play; a full-screen evolution scene.
- Audio: synth SFX, genome-derived cries, procedural biome music, hand-authored boss themes, ambience.
  - **Cries** (C24) come from the species' genome, so a species always sounds the same: the body plan picks the voice (a canine barks, a feline meows, an insect buzzes, a golem rumbles), size lowers the pitch (later evolution stages sound deeper), mood shapes it (cute higher with a rising end, fierce harsher, dark lower and detuned) and the first type adds a texture. Titans and legendaries in boss form sound deeper and longer.
  - Every battle action and UI action has a sound; turn markers are silent. A cry plays on send-out, and a low, slow one on faint.
  - **Volume settings** (master, music, sound effects; 10 % steps) belong to the device, not to a save slot.
  - **Music** (C25): each biome has a field theme and a battle theme, composed by a seeded composer from the biome's style (key, mode, tempo, instruments), so they never change between runs. Forest is a swung D-major flute piece, the volcanic desert a reed in E Phrygian dominant over hand drums, the frozen coast slow Lydian bells. Bosses play a hand-written theme from their pack (`theme` on the boss), or boss music composed from the biome's battle style when they have none.
  - Field music resumes where it was left after a battle; battle music always starts from the top. Changes crossfade. When a battle is decided, the music stops for the victory or defeat jingle.
  - **Ambience** plays under the music: biome beds (wind, brook, lava rumble, surf) with occasional sounds (birds, crackles, ice creaks, gulls), plus rain in wet weather. It is turned down in battle. It follows the music volume.

## Controls
**The whole game must be fully playable with the keyboard alone.** Mouse is optional (click-to-move, click menu items), never required. All keys rebindable (Settings → Controls, C33; `Esc` stays Back and Menu); gamepad later.

### Universal keys (everywhere, including every menu)
| Action | Keys |
|---|---|
| Move (overworld) / navigate (when a menu is open) | `W A S D` or arrows |
| Confirm / interact | `E` (also `Enter`, `Space`) |
| Back / cancel | `Q` (also `Esc`, `Backspace`) |
| Inspect (tooltips for icons/badges on screen; directions move between them) | `F` |
| Next list or tab (screens with several, e.g. the Atlas) | `Tab` |

Input is context-sensitive: `WASD`/arrows move the player in the overworld; while any menu is open (including the battle action menu) they navigate that menu instead. Every menu is a focusable list/grid with a clearly highlighted cursor. Cursor wraps around at the ends.

The player has **one movement speed** (no running / running shoes), **3.75 tiles/second** (one tile per 16 frames at 60 fps). Tunable in playtesting, but there is never a slower walk.

### Overworld
`I` inventory, `M` map (`E` there opens the Atlas), `P` party, `B` dex, `J` quests, `Esc` pause menu (with the Atlas).

### Battle flow (keyboard)
Settled at the G2 review (2026-11-13, option B of a preview round; replaces the Fight / Switch / Items / Run menu):
1. **Move bar**: whenever it is the player's turn, the active Zorling's moves are on screen as cards in the bottom bar (no `Fight` step). Each card shows the type, the condition it applies, power and accuracy, and a live hint against this foe (effectiveness, a reaction it would set off, a combo it sets up). `A/D` (or arrows) pick, `E` uses the move. During the turn the bar stays visible, dimmed.
2. Next to the cards, a key column: `I` **items** (bag, `E` selects item → `E` selects target, `Q` back), `Q` **run** (wild battles only; asks first), `L` **battle log**, `1 2 3` **switch**.
3. **Battle text** is a caption at the top of the battlefield, at most about two lines. It plays on a timer (battle speed shortens it); **no key advances it**, and `E` does nothing to text during a battle. A move and its effectiveness read as one line. What the screen already shows (a condition's chip, damage-over-time and heal numbers, reaction and Armor callouts) gets no caption, only a log line (G2c). Every line goes into the battle log (`L`, with turn markers), so nothing missed is lost.
4. **End of battle**: one results panel (Victory / Caught / Defeated / Got away) lists the outcome, the XP and level ups. It is the only battle text that waits for `E`.
5. After a faint, the player picks the next Zorling from a list (`E`).

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
- Formal trademark check for "Zoravia" (EUIPO; USPTO Class 9 & 41).
