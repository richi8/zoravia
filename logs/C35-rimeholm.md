# C35 · Region 3: Rimeholm Isles (as a pack) — Log

- **Date:** 2026-11-14
- **Status:** done
- **Depends on:** C34, C35a (added during this chunk)

## Summary
Region 3, the **Rimeholm Isles**, ships as its own pack, `packs/rimeholm`. It has:
- a 200×200 frozen archipelago: nine islands joined by piers, three towns and 11 zones;
- 25 new Zorlings drawn from the frozen model kit, two Titans and the legendary Glacivar (moved here from core);
- 11 route trainers, the Tide Trial and Tide Badge, Rival Mira, and a region boss;
- a full campaign with four side quests;
- its own start entry.

Sleet storms set every battle in three zones Wet, and Verdale's ferry now runs both ways. The chunk was paused halfway for C35a (regional body models) and finished in a second session. The user settled the design in the first session and approved the map, story outline and looks at a preview round. The playthrough simulator finishes the region at Emberwaste's pace. No engine changes were needed.

## What was built
- **Pack** `packs/rimeholm/` (`dependsOn: core@^0.1.0`), in `SHIPPED_PACKS`.
- **Map** `maps/rimeholm/`:
  - `region.json`: seed 3535, frozen biome. The sea is one big "lake" with nine islands carved out of it, and roads cross the water as piers. Seven **skerries** (small islets with no ford) were added this session. The generator blocks unreachable land, so they are scenery.
  - `overlay.json`: edit it by hand.
  - **Towns:**
    - Brinewick (hub): center, shop, Elder Halvard, Ferryman Ola at the pier.
    - Glimmerholm: the Tide Trial and its trial stone, and a shop with Super and Max Potions.
    - Rimeport: center only, and Ranger Knut.
  - **Zones:**
    - T1: Shingle Shore 3–6, Hoarfrost Heath 5–9, Driftwood Strand 8–13.
    - T2: Sleet Fells 15–20 ❄, Kelp Shallows 16–22, Thunder Bluffs 17–23, Squall Reach 19–25 ❄, Frostfen 23–29.
    - T3: Shipwreck Shoals 30–36, Glacier Steps 32–38, White Crown 36–42 ❄.
    - ❄ marks a sleet storm: `battleWeather: ['core:wet']`, with snow in the air.
  - **Sites:**
    - Lairs: Tusk Rookery and Thunder Eyrie.
    - The Stormspire (arena) and the Crown Shrine.
    - Landmarks: Skerry Circle, Whalebone Arch, Seal Rock.
    - Secrets: Floe Garden (an islet reached by an ice-floe ford), Frozen Wreck, Hot Spring.
  - **Ferry pier** at (100, 0), `to: core:verdale#ferry`.
- **Roster** (`species.ts`, 25 species):
  - Starters: Selkit → Selkurr → Selkaris (Water), Woolump → Shagtusk → Tundramoth (Earth), Sparkit → Fluxine → Auroryx (Electric).
  - Wild lines: Flurret → Rimestoat, Glimfry → Lumenaw, Pinchill → Brineclaw, Kelpling → Tanglekelp, Tuskit → Floemaw, Spinzap → Urchivolt.
  - Single-stage: Jellivolt, Frostcairn, Squallwing.
  - Legendary: Glacivar (Ice/Electric).
  - Core's Rimewisp, Voltbat, Mudpaddle, Hearthog and Galehawk spawn here too.
  - Looks come from the frozen kit (C35a).
  - `moves.ts`: Thunderclap, plus the signatures Floe Crush, Squall Dive, Lodestar Beam and Whiteout.
  - `traits.ts`: Live Wire and Rimebound.
- **Bosses** (`bosses.ts`):

  | Boss | Lv | Aura HP | Breaks on |
  |---|---|---|---|
  | Floemaw Titan | 16 | ×2 | Frozen (the sleet storm soaks it) |
  | Squallwing Titan | 22 | ×2.5 | Overload |
  | Glacivar | 35 | ×1.75 | Slam |
  | Odessa's Lodestar Lumenaw | 37 with the badge | ×1.25 | Rooted (the first Armor break on Rooted) |

- **Trainers** (`trainers.ts`): 11 route trainers, built from one table like Emberwaste's, plus the three lairs. Glacivar appears once Odessa is beaten.
- **Campaign** (`story.ts`):
  - Lore: the Crownlight knits the sea ice every Long Night; Glacivar wakes it. The Tide Trial teaches "soak, then strike".
  - Main quest "The Fading Lights", 5 steps. Elder Halvard gives it; the reward is 3000 coins and 2 Max Potions.
  - The trial: Deckhand Pell, then Tidemaster Sigrun, who gives the **Tide Badge** (Water).
  - Rival Mira three times: Brinewick's west road, Glimmerholm after the badge, Rimeport after both Titans.
  - Region boss **Lampwright Odessa** at the Stormspire. She pulled the winter lights into her lamp so no ship would wreck on the shoals.
  - Hint givers:
    - Herder Gunnar: the Floemaw (freeze it in the sleet).
    - Storm-watcher Eira: the Squallwing (charge it, then strike with Metal).
    - Ranger Knut: Odessa (Earth, then Nature).
    - Ace Runa's after-line: Glacivar (Wind, then Earth).
  - Side quests:
    - The Lost Mitten: Little Kari, catch a Flurret.
    - The Netmaker's Lamp: Netmaker Gro, catch a Glimfry.
    - The Floe Garden: Old Sailor Bram, and his sister Agnete on the islet.
    - Singing Ice: Ice-singer Liv. Read the Skerry stone, then catch a Jellivolt.
  - 11 signs, the trial stone, 2 story stones (the Crown stone lights up once Odessa is beaten) and 5 hidden items.
- **Services** (`npcs.ts`): three healers, two clerks, and Ferryman Ola.
- **Start** (`starts.ts`): Rimeholm Isles, Lv 6 starter, 2 Potions, 5 Zorbs, 500 coins, in Brinewick.
- **Core content touched:**
  - Ferryman Gus's lines and the Willowmere ferry sign now say the ferry runs (`verdale-story.ts`).
  - Glacivar was moved out of core in the first session: its species, boss, Whiteout, test shrine, dialogue and theme.
  - Engine tests that used `core:glacivar` now use `core:verdion` with the same intent: battle, sounds, data, progression, save, trials, map and species-look (12 tests in 8 files). The trials test now runs Verdion's lair dialogue.
- **Emberwaste:** Mira's counters gained three flag-only entries for Rimeholm's starters: Nature against Selkit and Woolump, Earth against Sparkit.
- **Balance tools:**
  - `tools/balance/rimeholm.ts`: the route, team plans and start.
  - A `REGIONS` entry: `npm run balance -- --region rimeholm`.
- **Tests (787 total, 76 files):**
  - `packs/rimeholm/rimeholm.test.ts`:
    - the map is walkable, and its tiers are right;
    - the storms;
    - centers and shops;
    - piers;
    - the skerries are blocked land;
    - the ferry works both ways, and leads nowhere without the pack;
    - Glacivar's theme passes `songProblems` and fills its loop.
  - `roster.test.ts`:
    - stat bands, starters, and the wild weighted to Ice/Water/Electric;
    - spawn levels vs evolution;
    - trainers;
    - starter vs the Shingle Shore;
    - boss sims (reactions vs brute force);
    - every look uses `rimeholm:frozen`, which shares no plan with another kit.
  - `story.test.ts`:
    - placement;
    - the whole main quest through the engine, in the sleet where the NPC stands in it;
    - Mira's counters for all nine starters;
    - Odessa with and without her hint;
    - reminders, side quests, hidden items, signs and stones.
  - `tools/balance/rimeholm.test.ts`: the playthrough, the route's storms matching the NPCs' zones, and every story trainer on the route.

## Decisions
- **Decision:** Mira's Rimeholm counters reach Emberwaste's starters by flag only.
  - Against Sizzlet and Pebbit she uses the Rimeholm line that wins (Water). Against Pricklet she uses Verdale's Fire line, her default.
  - Emberwaste's Mira got the mirror entries.
  - **Why:**
    - Rimeholm must not depend on Emberwaste, because each expansion builds only on core.
    - A starter flag is only a name, and `instead` is satisfied by any flag.
    - 7 of the 8 `instead` slots are used.
  - DESIGN now states the travelling-rival rule in "Starting a game".
  - **Alternatives considered:** a `dependsOn` on Emberwaste (it would chain the expansions together), or ignoring other regions' starters (Mira would lead with Fire against a Water player from Emberwaste).
- **Decision:** the **Floemaw Titan is Lv 16**, not 17.
  - **Why:** a team two levels up won only 3% on five Super Potions at Lv 17. At Lv 16, the roster-test team wins 75% with reactions, 0% by brute force and 55% with potions.
- **Decision:** the **Squallwing Titan's aura is ×2.5**, not ×2. DESIGN allows "~×3, set per boss".
  - **Why:** Electric/Wind is weak to Ice, Earth and Metal, and its HP and Defense are low. At ×2, plain super-effective hits won 78–100% with no reaction. A higher level didn't help: at Lv 23 brute force still won 97%.
  - At ×2.5 the three test teams win 68–95% with reactions and 33–65% by brute force.
- **Decision:** **Odessa** is one level below Vex and Gorran (35/36/37 with the badge), and her Lodestar Lumenaw's aura is ×1.25.
  - **Why:** Rooted needs two types (Earth sets up Muddy, then Nature). The Selkit plan has neither, so following the hint (the simulator catches one Zorling) only gets halfway.
  - At 36–38 and ×1.5 the playthrough needed 4.9 tries, and 3.8 at one level lower. Now it is 2.0, with 83% won first try, close to Gorran's 1.9.
  - The hint still matters: an Earth + Earth + Nature team wins 75% at her level; the region's best team without it wins 25% (65% at +2).
  - Her test checks her real ace level (37) and +2.
- **Decision:** Stormchaser Bjorn has two Zorlings (Voltbat 19, Urchivolt 20), not three.
  - **Why:** with three he took 2.2 tries, and the Selkit and Sparkit plans lost every time one level down. Now he takes 2.1, the same as Emberwaste's hardest trainers. C34 did the same for Firewatcher Rook.
- **Decision:** the roster test's "balanced team" is Water + Electric + Ice (Selkit / Spinzap / Flurret lines).
  - **Why:** an Earth-led team lost every time to the Water trainers on the strand. That says more about the test team than the trainers: three other plans won 90–100%.
- **Decision:** the `elder` anchor moved from (92, 29) to (97, 29).
  - **Why:** the WIP overlay had put it inside the Brinewick center's footprint, so it was unreachable.

### Balance report (`npm run balance -- --region rimeholm --seeds 20`)

| Team plan | Finished | Wild battles | Story losses | Hours (est.) |
|---|---|---|---|---|
| Selkit + Flurret + Spinzap | 100% | 125 | 5.8 | 3.8 |
| Woolump + Tuskit + Spinzap | 100% | 117 | 0.3 | 2.8 |
| Sparkit + Flurret + Kelpling | 100% | 122 | 3.8 | 2.6 |

- **Hardest fights:**
  - Bjorn: 2.1 tries.
  - Odessa: 2.0; 17% of runs follow her hint.
  - Herder Eskil (in the sleet): 1.4.
  - Trapper Knud: 1.3.
  - Everything else: ≤ 1.1.
- **Money:** 6 882 coins from wild battles and 13 200 from trainers, 20 330 spent, 182 left. That is the other regions' economy.
- **Bosses at +2:**
  - Floemaw: reactions 75%, brute 0%, with potions 55%.
  - Squallwing: 95% / 68% / 100%. The gap is thin with this Metal-heavy team, but every team's gap is at least 0.25.
  - Glacivar: 93% / 0% / 48%.

## Deviations from plan / design
- No engine changes. Everything is pack data, plus core text (Gus, the ferry sign) and the test fixtures Glacivar's move required.
- Boss tuning differs from the other regions (Floemaw Lv 16, Squallwing ×2.5, Odessa one level lower and ×1.25), for the reasons under Decisions.
- `DESIGN.md` updated:
  - the Rimeholm summary (storms, roster, bosses, campaign);
  - the start list;
  - the travelling-rival rule.

## Issues & known limitations
- **Battle backdrop is still the forest placeholder** in every biome, so sleet battles show green hills (C34 follow-up).
- The playthrough's hint-following catches one Zorling. Reactions that need two types the team lacks (Rooted here) cannot be fully followed. Odessa is tuned so the fight is finishable anyway.
- Mira's Rimeport fight needs about 30 wild battles of grinding before it (team Lv 24 → 29). Emberwaste's Slagwatch has the same gap.
- The Squallwing Titan's reactions-vs-brute gap at +2 is 0.27 with the Metal-heavy test team. Electric/Wind simply has many weaknesses.
- `map.json` adds about 0.5 MB to the bundle, like each region (lazy-loading maps is still a C37 item).

## Verification
- `npm run check`: typecheck, lint, format and tests all pass (76 files, 787 tests). `npm run world -- check`: 4 region maps up to date.
- `npm run balance -- --region rimeholm --seeds 20`: see the report above.
- Headless Chrome on `vite` (C34's CDP script, 960×540):
  - **New game:** the region list shows Verdale, Emberwaste and Rimeholm Isles, with the description and starters (screenshot checked). Starting there put the player in Brinewick at (100, 35), with Selkit Lv 6 and `rimeholm:starter-selkit` set (screenshot checked).
  - **Ferry:** walking north off the pier at (100, 0) opened Verdale at (88, 199) facing up. Walking back south opened Rimeholm at (100, 0) facing down.
  - **Sleet storm:** a wild battle started in the Sleet Fells. Both Zorlings showed the Wet chip (screenshot checked). No console errors.
- Done when "same rule as C34" (added with zero engine changes, or each change logged): ✅ no engine changes.
- C35a's "Rimeholm's looks set from the frozen kit, in C35's species file": ✅ and checked by the roster test.

## Follow-ups
- **Small chunk or C37:**
  - Biome battle backdrops (desert, frozen), with a preview round.
  - An arrival toast on travel ("Rimeholm Isles").
  - The playthrough's hint-following could catch one Zorling per missing type.
- **C36:**
  - Mira's finale can read all three regions' starter flags.
  - Cross-region danger zones can link through new connections, as the ferry does.
- The ferry is walked onto, like Ember Pass. There is no boarding dialogue or fare.

## Notes for the next chunk
- A new region = a pack folder like `packs/rimeholm/`, added to `SHIPPED_PACKS`, a map whose exit `to` names the core connection, a `REGIONS` entry and a route file.
- Placement problems are caught by the story test (`people and hidden items stand on reachable tiles`, `no two NPCs share a tile`). Also check overlay anchors against building footprints: the map test's "reaches every anchor" check caught the elder anchor.
- Scratch scripts from this session (the roadside spot finder, the boss and trainer probes) were in the session scratchpad.
- The WIP branch `c35-wip` was squashed into this commit.
