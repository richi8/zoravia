# C26 · Dialogue & quest engine — Log

- **Date:** 2026-11-13
- **Status:** done
- **Depends on:** C22 (and C23 for the save format)

## Summary
Packs can now write dialogue and quests as data. A dialogue is a graph of nodes with pages, choices, conditions and actions. Quests are steps that complete when their condition holds. Flags and quest progress live in the party and are saved (save v3). The overworld runs NPC dialogues, shows choices in a small menu above the last page, tells the player what happened ("New quest", "Quest updated", "Quest complete" with a chime), and moves quests on after every dialogue, battle and menu. `J` opens a real quest log. The sample quest "Nothing Biting" is defined only in `packs/core/story.ts` and is completable in a unit test and in the browser.

## What was built
- **Data** (`src/game/data/story.ts`, Zod, two new registries):
  - **Conditions**: `flag` (with `atLeast`), `quest` (`is: new | active | done`, optional `step`), `has` (items), `money`, `caught`, `seen`, `boss`, and `not` / `all` / `any`.
  - **Actions**: `set` / `add` / `clear` a flag, `give` / `take` items, `money` (+ or −), `start` a quest.
  - **`dialogues`**: `start` and `nodes`. A node has `say` (pages), `speaker` (default: the NPC), `do` (actions), and then either `choices` (up to 4, each with `if`, `do`, `goto`) or `branch` (`if` → `goto`, first match) with `goto` as the else. Load-time checks: the start node and every `goto` exist, choices don't mix with `goto` / `branch`, every item, quest, species and boss named exists, and `{ quest, step }` names a real step.
  - **`quests`**: `name`, `summary`, `from`, `steps` (`id`, `text`, `done` condition, optional `do`), `reward` (money, items). Step ids must be unique.
  - **NPCs**: an NPC now has either `lines` or `dialogue` (exactly one).
- **Story logic** (pure, `src/game/story/`):
  - `holds` (conditions), `flagValue`, `questState`, `questStep`.
  - `runActions`, plus `act` (actions, then `advanceQuests`). Each returns the new party and the notes to show. Giving stops at the bag cap and says so. Taking takes what there is. Money never goes below 0. Starting a quest twice does nothing.
  - `advanceQuests`: while an active quest's current step holds, it runs the step's actions and moves to the next step. After the last step it completes the quest and pays the reward. Several steps can pass in one call, and a guard stops it at 100.
  - `DialogueRun`: walks the graph. `view` gives the pages, speaker, notes and choices, and `next(choice)` moves on. Nodes with nothing to show are passed through at once, with a guard against endless routing. A choice's notes show before the node it leads to. A node whose choices are all hidden ends the dialogue. A choice left out (`Q`) picks the last one.
  - `questLog`: entries for the log (active first, newest first; steps reached; reward text).
- **Party**: `flags` and `quests` (`{ state: 'active', step } | { state: 'done' }`).
- **Save v3** (`src/game/save/`): the party gains `flags` and `quests`, and the v2 → v3 step adds them empty. The new fixture `tests/fixtures/saves/v2.json` was made from the v1 fixture with the v2 code, before the bump. A save that names a quest no pack has is refused. An active quest at a step its pack removed restarts at the first step.
- **Engine `DialogBox`**: new `onLastPage` option. The box holds on its last page (confirm no longer closes it), so a choice menu can sit on top. Without the option nothing changed.
- **Overworld** (`overworld-scene.ts`):
  - `runDialogue` / `showView` / `ask`: pages with the speaker, then notes without one, then a choice `Menu` right-aligned above the held box. Party changes are written as the dialogue goes.
  - `inDialogue` keeps the stack's `onEmpty` from treating the gaps between boxes as "closed". When the dialogue ends, the usual close (quest check, autosave) runs once.
  - Quests are checked when the stack empties (any menu, shop, center or dialog closed), after battles (the notes join the battle messages) and when a new species is seen.
  - Role NPCs still open their service after their dialogue.
- **Quest log** (`src/game/ui/quest-panel.ts`, `J`): list on the left with a tick box (ticked = done, gold = active). On the right: name, "From …" or "Done", summary, the steps reached with tick boxes, and the reward. With no quests it still shows the notice panel (new text).
- **Sounds**: `world.quest` (a two-note chime for new or updated quests) and `world.questDone` (a short fanfare).
- **Content** (`packs/core/story.ts`): the quest "Nothing Biting". Fisher Lou asks (you can accept or decline). Step 1: ask Ranger Ode (sets `core:pond-ode`). Step 2: catch a wild Voltbat (meadow, Lv 5–8). Step 3: tell Lou (sets `core:pond-lou`). Reward: 300 coins and a Super Potion. Lou and Ode use dialogues, with reminders and an "after" line.
- **Tests**: `src/game/story/story.test.ts` (12) and 2 new save tests. They cover validation errors, every condition, every action and its notes, multi-step advancing and rewards, step actions, the dialogue runner (routing, hidden choices, speaker override, notes order, `Q` = last choice, the loop guard), and **the whole sample quest from pack data, with the Voltbat caught through the real battle engine**. **604 tests total.**

## Decisions
- **Decision:** Quest steps complete only through conditions. No "advance quest" action exists.
  - **Why:** one mechanism covers both "talk to someone" (dialogue sets a flag) and "catch / have / beat something" (the state already says so). A step that already holds when it is reached passes straight away, so players are never asked to redo what they have done.
  - **Alternatives considered:** an `advance` action from dialogue. It would need its own checks (is the quest at that step?) and makes it easy to skip a step by accident.
- **Decision:** Flags and quests live in `Party`.
  - **Why:** conditions read the bag, money, Dex and boss log, which are already there. Everything then flows through `onParty` and autosave with no new wiring, as C23's notes suggested.
- **Decision:** Flags are free namespaced ids, not a registry.
  - **Why:** packs set and read them without declaring them. The `pack:` prefix keeps two packs from clashing.
- **Decision:** Actions run when a node is reached. Their notes show after the node's pages, without a speaker.
  - **Why:** "Here, take this." followed by "You received Super Potion." reads naturally. Notes said by an NPC's name tag would look like the NPC talking about itself.
- **Decision:** Choices sit in a small menu above the last page. `Q` picks the last choice.
  - **Why:** the question stays readable while choosing. Every menu in the game treats `Q` as "back", and the last choice is by convention the "no / leave" one. There is no way to leave a dialogue in a state no one wrote.
- **Decision:** The quest log shows only steps reached so far.
  - **Why:** later steps can spoil the story ("Catch the Voltbat" before Ode explains). The current step is what the player needs.
- **Decision:** No preview round for the quest log and the choice menu.
  - **Why:** both are built only from the approved kit (paper panel, cursor, key hints, `Menu`), like C22's screens. Screenshots were checked in the browser (see Verification).

## Deviations from plan / design
- `DESIGN.md` updated: a new section "Story: dialogue & quests" (rules settled in C26), and the save line lists story flags and quests. These are new rules, not changes.
- The plan says "quest definitions (steps, conditions, actions, rewards)". Steps have no separate start action because the quest's `start` action and each step's `do` cover it.

## Issues & known limitations
- No counter-style conditions from battles yet ("beat 3 wild Zorlings"). `add` counters exist, but nothing in battles increments them. Trainers (C27) can set flags on wins.
- No portraits in dialogue, no text variables (`{player}`; the player has no name yet), and no NPC movement or scripted scenes (cutscenes).
- An NPC can't open a service from a dialogue choice (e.g. "Heal / Storage" as choices). Role NPCs open their service after their dialogue as before.
- Quest notes after a battle join the same message box as the battle messages ("…sent to storage", then "Quest updated: …"), so the chime plays when the box opens, not when the quest line shows.
- In the browser, the Voltbat catch was injected through the scene's own `finishBattle` → `resume` path with a result from the real battle engine (as in C22/C23), not by playing the battle by hand. Running from a real wild battle during the session worked.
- The dialogue runner hides choices whose condition fails at the moment the node is reached. If a choice's own actions change that, the list isn't rebuilt (no node in packs relies on it).

## Verification
- `npm run check`: typecheck, lint, format, **604 tests (56 files)**, all pass.
- Browser (headless Chrome, dev server, 960×540 at DPR 2 → 480×270, keyboard; the dev handle placed the player next to NPCs and cleared wild Zorlings between talks):
  - New game in slot 1. Ranger Ode before the quest: only his two tip pages.
  - Fisher Lou: two pages, then "I'll ask Ode / Good luck!" right-aligned above the held box (screenshot checked). "Good luck!" → no quest. Talking again and choosing "I'll ask Ode" → "New quest: Nothing Biting", then Lou's thanks.
  - Lou again: the "ask Ode" reminder. `J`: the quest log with "From Fisher Lou", the summary, one gold step and the reward (screenshot checked).
  - Ranger Ode: the pond pages, then "Quest updated: Catch a wild Voltbat in the meadow.", and the flag set.
  - A wild Zorling chased the player into a real battle mid-test. Running away returned to the world with nothing broken.
  - The Voltbat catch (real engine result through `finishBattle` → `resume`): "Voltbat was sent to storage…", then "Quest updated: Tell Fisher Lou."
  - Lou: "You caught the Voltbat?…", "Here, take this…", "Quest complete: Nothing Biting!", "You received 300 coins.", "You received Super Potion.". Money 1 240 → 1 540, Super Potion 2 → 3. Talking again: only the thank-you line, no second reward.
  - `J`: the quest under "Done" with all three steps ticked (screenshot checked).
  - **Reload:** slot 1 on disk is `version: 3` with `flags { core:pond-ode: 1, core:pond-lou: 1 }` and the quest `done`.
  - No console errors or warnings.
- Done when "a sample 3-step quest defined only in pack data is completable": ✅ (unit test from pack data with a real catch; browser run start to finish, saved).

## Follow-ups
- **C27:** trainers with dialogue before and after battles. A `battle` action or a trainer link could start a trainer fight from a dialogue. Set flags on trainer wins, badges as flags or their own save field, and the rival's lines by badge count.
- **C30:** the Region 1 main chain and side quests are written with this format. Titan hints go in NPC dialogue branches (`{ boss }` / `{ seen }` conditions).
- **C32:** dialogue portraits, a quest-complete banner or toast instead of a plain note, and a "new" marker on the log.
- **C33:** the player's name and `{player}` substitution in pages. Dialogue choices for service NPCs ("Heal / Storage / Relearn").
- **Later:** battle counters (beat N wild Zorlings of a type), scripted NPC movement (cutscenes), timed or repeatable quests.

## Notes for the next chunk
- Write story content in a pack's `dialogues` and `quests` (see `packs/core/story.ts` and the header of `src/game/data/story.ts`). Point an NPC at a dialogue with `dialogue: 'pack:id'` instead of `lines`.
- Pure helpers: `holds(content, party, cond)`, `act(content, party, actions)` → `{ party, notes }`, `advanceQuests(content, party)`, `new DialogueRun(content, id, party, speaker)`.
- Anything that changes the party outside the overworld's menus and battles should call `advanceQuests` and show its notes. The overworld already does this when its stack empties, after battles and when a species is first seen.
- Save format is v3. The next change is a v3 → v4 step with a copy of a v3 save as a fixture.
