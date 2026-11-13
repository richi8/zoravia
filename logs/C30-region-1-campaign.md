# C30 · Region 1 campaign & lore — Log

- **Date:** 2026-11-13
- **Status:** done
- **Depends on:** C29, C27

## Summary
Verdale now has its story. Its lore is the Heartwood and the Seedwind. The main quest, "The Still Wind", has 5 steps: the Grove Trial, both Titans, the region boss Stormcatcher Vex on Crown Rock, Verdion at the Heartwood Shrine, and back to Elder Rowan. Rival Mira appears three times, and there are four side quests. Dialogue gives hints for every Titan, the legendary and the region boss. One small engine addition, NPC **objects**, makes the map's signs and standing stones readable and lets hidden items lie in the secrets. The whole campaign is played start to finish from pack data through the real battle engine in a test, and the key pieces were checked in the browser.

## What was built
- **NPC objects** (`src/game/data/npcs.ts`, `src/game/scenes/overworld-scene.ts`): `object: 'sign' | 'item'`.
  - A `sign` is not drawn. It sits on a sign or menhir prop and makes it readable.
  - An `item` is drawn as the bag's Zorb sprite on the ground, with a navy outline, a shadow and a glint every 2 s.
  - Objects never move or turn, and their pages have no name tag.
  - Schema: an object must `stand` and has no `zorling` or `role`.
- **Story content** (`packs/core/verdale-story.ts`):
  - **Lore** (file header): the Heartwood, the Seedwind, Verdion as its keeper, the Titans as old witnesses, the first wardens and the trial's "set up, then set off" teaching (reactions).
  - **Main quest `core:still-wind`**:
    1. Grove Badge.
    2. Both Titans beaten or caught.
    3. Beat Vex.
    4. Verdion beaten or caught.
    5. Tell Rowan.
    - Reward: 3000 coins and 2 Max Potions.
    - Rowan has a reminder for every step. Tam sends new players to Rowan.
  - **Grove Trial** in Fernhollow:
    - Apprentice Linden (Lv 11–12) first, then Warden Elm (Lv 13–15, `perBadge` 4), who gives the Grove Badge.
    - When the main quest is active, Elm explains the Titans. Both offer rematches.
    - The Grove Badge moved from the test trial into Verdale; the test region's Oak still gives it.
  - **Rival Mira**, three trainers with `when` conditions:
    - Willowmere's north road (Lv 6–7).
    - The trial after the badge (Lv 15–16 with the badge).
    - Galecrest once both Titans are beaten (Lv 34–35).
  - **Region boss Stormcatcher Vex** at `boss-crown-rock`, a cheerful inventor whose Gale Engine bottles every breeze for her airship.
    - Her team with the badge: Voltbat 36, Rimewisp 37, and a Galehawk 38 in boss form.
    - The new boss is `core:storm-galehawk`: Armor that breaks on Slam, ×1.5 aura HP, and the new signature move Gale Engine.
    - Prize 2400, plus a rematch.
  - **Titans and Verdion** (`verdale-trainers.ts`):
    - After a win, each Titan's lair dialogue shows a "Vision" of the sails on Crown Rock.
    - Verdion's NPC appears only once Vex is beaten.
  - **Hints**: Scout Pell (Mossback: seed, then burn), Reedcutter Wade (new, on the marsh road; Bogmaw: soak, then shock) and Warden Elm (both Titans). Verdion's hint comes from Druid Ash (C29). Ranger Kit gives the Crown Rock directions when that step is active. Each hint giver changes their line once the boss is done.
  - **Side quests**:
    - *Sandwich Snatcher* (Tam: catch a Pipwing).
    - *The Lost Orchard* (Gardener Mo, plus Hazel, a new NPC in the Old Orchard secret, who sets the flag).
    - *Ringing Shells* (Tinker Pim in Galecrest, new: catch an Ironshell).
    - *Lights on the Water* (Ferryman Gus: read the Drowned Ruins stone, catch a Rimewisp).
  - **Signs and stones**: 11 road and town signs, plus the trial stone, the Stone Circle runes, the Shrine stone (its text changes once the wind is back) and the Drowned Ruins stone (a quest step).
  - **Hidden items** (5): Max Potions in the Hidden Glade and on Mist Isle, Super Potions at the Stone Circle and the Drowned Ruins, 5 Zorbs at the Lookout. Each is taken once (a flag plus `when`). A potion stays where it is while the bag holds 5 of it.
- **Townsfolk** whose placeholder lines (C28) became dialogues: Rowan, Tam, Mo, Pell (moved off the trial anchor to Fernhollow's west road), Kit, Gus. `verdale-npcs.ts` now holds only healers and clerks.
- **Pack wiring**: `index.ts` (badges, trainers, dialogues, quests), `npcs.ts`, `moves.ts` (Gale Engine), `bosses.ts` (Storm Galehawk), `trainers.ts` (test badge removed).
- **Tests** (`packs/core/verdale-story.test.ts`, 9 tests):
  - Placement: people and items stand on reachable tiles. Signs sit on a blocked prop that can be read from a reachable tile. No two NPCs share a tile.
  - The **whole main quest from a new game**, with the starting Lv 9 team trained between stages:
    - Mira, the trial, Mira again, both Titans caught, Mira in Galecrest, Vex, then Verdion caught.
    - Rowan's reward is checked, and so is every NPC appearing and leaving.
    - A lost battle is retried, as a player would.
  - The region boss's win rate at +2 levels (≥ 40%) and at her level (< 50%).
  - Reminders, and a step that passes at once when the badge is already held.
  - All 4 side quests to completion, with real catches through the engine.
  - Hidden items (full bag, taken once, gone).
  - Signs.
  - `verdale-roster.test.ts` now picks only the C29 route trainers.
  - **652 tests total.**

## Decisions
- **Decision:** Signs and hidden items are NPC objects, not a new map or prop mechanic.
  - **Why:** talking, dialogue, flags, `when` presence and autosave already work for NPCs. An item is then "a dialogue that gives once and hides itself", written in pack data. The engine change is about 60 lines.
  - **Alternatives considered:** interactive props in the map overlay (sign text in `overlay.json`). That needs a second interaction path and a story link from map data to flags. Truly invisible items found by pressing `E` on bare grass were also rejected, because players would have no clue where to look. The secrets themselves are the hidden part.
- **Decision:** The region boss is a trainer (Vex) with a boss-form member, not a wild boss.
  - **Why:** a region boss in a light-toned story is better as a person with a reason, and this gives the campaign a clear antagonist and turning point (the wind is freed). A boss member keeps the Armor-and-reaction fight. It isn't Subdued or caught, so the region still has exactly two Titans and one legendary to catch.
- **Decision:** Vex's aura is ×1.5 HP, and her team is Lv 36–38 with the badge.
  - **Why:** at ×2 and Lv 38–40, a Lv 40 Verdale team won 0–10% in the simulator. Now a Lv 40 team wins about 55–70% without potions, and a Lv 38 team about 5%. Two levels above the boss, with potions, is about where a T3 player arrives (Galeback 36–42, Ace Lyra Lv 40).
- **Decision:** Titan steps count "beaten or caught" (`{ boss }`), not "caught".
  - **Why:** catching is optional (DESIGN: one per save, rematches). The story asks the player to face them.
- **Decision:** The Grove Badge entry moved to Verdale and is shared with the test region's debug trial.
  - **Why:** one badge per region (DESIGN). The debug trial is only reachable from the launcher.
- **Decision:** Titan visions show with the speaker "Vision".
  - **Why:** the default speaker is the Titan, which would read as the Titan talking. Nodes can't have an empty speaker.

## Deviations from plan / design
- `DESIGN.md` updated:
  - Verdale's campaign summary (World → Launch regions).
  - The rule for sign and item objects (Story section).
- The plan says "trial" as a deliverable. The C27 test trial stays on the test region as debug content. Verdale's real trial uses new trainers (Linden, Elm).
- Shop stock by tier (a C28 follow-up) is still not done. Max Potions are only found, never sold.

## Issues & known limitations
- **Level gap after the Titans:** from Lv ~26 (Titans) to Lv ~40 (Vex), the player has to train through the T3 zones and trainers. That is the tier design, but the pacing should be checked in C31.
- Vex's Armor breaks on Slam: Wind to make the Galehawk Airborne, then Earth. The simulator AI rarely sets this up, so the win rate above is mostly brute force. Whether the reaction plan beats brute force wasn't measured (C31).
- Mira's teams don't counter the player's starter yet: there is no starter choice until C33.
- The boss lair's "Vision" pages use a name tag. Narration without a tag would read better (C32).
- A hidden item at an anchor blocks that tile until it is taken. The Lookout's item stands on the lookout point itself.
- Ranger Kit still says Ember Pass is closed, and Gus that the ferry isn't running. The exits open with C34/C35.
- In the browser the battles were won by pressing `E` with a dev-boosted team. The real-level fights are covered by the engine test.

## Verification
- `npm run check`: typecheck, lint, format, **652 tests (60 files)**, all pass.
  - With the new campaign tests adding parallel load, the C09 render test "every body plan renders" (~550 sprites) went over the 5 s default timeout twice. It passes alone, so it now has an explicit 20 s timeout (`zorlings.test.ts`).
- Browser (headless Chrome over CDP, dev server, 960×540 at DPR 2, keyboard, with the dev handle for teleports):
  - Play: Verdale → new slot. Tam: "Elder Rowan was looking for you!", then the sandwich offer; "Maybe later" was picked.
  - Rowan: 4 lore pages, then "New quest: The Still Wind".
  - The north sign reads "North: Brookside Trail and Fernhollow." with no name tag (screenshot checked).
  - Shrine stone: the inscription, then "The air here is very still.". Drowned Ruins stone: its two pages.
  - Hidden Glade: "Something is tucked away under a mossy root…", "You received Max Potion.", flag set, item gone. The Mist Isle Zorb sprite was drawn on the island (screenshot checked).
  - Warden Elm's intro. Rival Mira: talk → battle → "…buys the berry tarts!", then she leaves.
  - `J` shows "The Still Wind", from Elder Rowan, with step 1 and its reward (screenshot checked). No console errors.
- Done when "campaign completable start to finish": ✅. `verdale-story.test.ts` plays the main quest from a new game to "Quest complete: The Still Wind!", and all four side quests, through the real battle engine. Every story NPC, sign and item is checked as reachable on the shipped map.

## Follow-ups
- **C31:**
  - Pacing from the Titans (Lv ~26) to Vex (Lv ~40).
  - Vex's reaction plan vs brute force, and her ×1.5 aura.
  - Mira's levels.
  - Quest rewards vs the economy.
  - Whether Max Potions should be sold.
- **C32:**
  - Narration without a name tag (Titan visions).
  - A bigger region-boss intro.
  - A badge case.
  - Item pickup sparkle and sound.
- **C33:** Mira picks the starter that beats the player's. Introduce the player's name to Rowan.
- **C34/C35:** open Ember Pass and the ferry (Kit's and Gus's lines, and Vex's airship could tie into Region 3).

## Notes for the next chunk
- Story content is in `packs/core/verdale-story.ts`. Route trainers and boss lairs are still in `verdale-trainers.ts`.
- Signs: add an entry to `SIGNS` (x/y of a sign or menhir prop). Hidden items: add an entry to `HIDDEN` (an anchor, item and count). Both are placement-tested.
- `verdale-story.test.ts` has `talk` / `beat` / `catchWild` / `train` helpers for playing story content through the engine. C31's playthrough can build on them.
