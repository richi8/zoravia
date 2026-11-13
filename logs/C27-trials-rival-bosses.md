# C27 · Trials, rival, story bosses, legendary — Log

- **Date:** 2026-11-13
- **Status:** done (legendary shrine checked by unit test only, not in the browser)
- **Depends on:** C26, C17

## Summary
Packs can now define badges and trainers, and a dialogue node can start a trainer or boss battle. A win (or a catch) continues the dialogue, and any other outcome ends it. Badges come from a dialogue action. They set the soft level cap in battle and scale story bosses (+`perBadge` levels per badge). Trainers can have teams by badges held (the rival), and trainers and bosses have rematches. NPCs can come and go with a story condition, and can be drawn as a Zorling (the legendary at its shrine). The save is now v4. A sample trial (Fern → Oak → Grove Badge), two rival encounters and Glacivar's shrine are pure pack data and work end to end.

## What was built
- `src/game/data/trainers.ts`: `badges` registry (name, description, type for the icon color). `trainers` registry: `teams` by badges (the first starts at 0, then going up), members (`species`, `level`, optional `moves`, optional `boss` for boss form, at most one per team), `prize`, `perBadge`, `rematch { levels, prize }`. `trainerTeam(t, badges)`.
- `bosses`: optional `rematch { levels, prize }`.
- Story data: conditions `{ badge }`, `{ badges: n }`, `{ beat, times? }`; action `{ badge }`; dialogue node `battle: { trainer } | { boss }` with `win` (a battle ends a node, so no choices/branch/goto; `win` needs a battle).
- NPCs: `when` (present only while the condition holds) and `zorling` (drawn as that species, never wanders).
- Party: `badges` (in the order won) and `trainers` (`{ wins }`). The boss log gets `rematches`. `applyBattleResult` takes `trainer` and `rematch`.
- `src/game/story/battles.ts` (pure): `storyBattle` → setup, trainer name, prize and what to log. Trainers: the team for the badges held, + `perBadge` × (badges above the team's threshold), + `rematch.levels` once beaten. Bosses: wild boss battle until done, then a `trainer`-kind rematch (boss form, faints, cannot be caught); no rematch → no battle. Prize: the first win, the rematch prize once, then 0.
- `DialogueRun`: battle views and `battleOver(party, won)`.
- Overworld: `dialogueBattle` → `launch` (shared with wild battles) → `finishStoryBattle`. `resume` shows messages, then continues the dialogue, then level-up choices. `wakeAtCenter` is shared. NPC presence syncs whenever nothing is open (an appearing NPC waits for its tile to be free). Zorling NPCs are drawn. `badges` is passed to `BattleScene` (the level cap was always 0 before). Badge notes play the fanfare.
- Save v4 (`badges`, `trainers`, `rematches`). v3 → v4 step and the `tests/fixtures/saves/v3.json` fixture, written with the v3 code from a HEAD worktree before the bump. Unknown badges or trainers are refused.
- Content (`packs/core/trainers.ts`, `npcs.ts`, `bosses.ts`): Grove Badge; Apprentice Fern, Warden Oak (perBadge 4), Rival Mira (two teams by badges, perBadge 4), Rival Mira at the grove; Keeper Bryn; Glacivar shrine NPC in the Old Grove (48,12); rematches for both test bosses.
- Tests: `src/game/story/trials.test.ts` (8): validation, team by badges and scaling, a boss member in a trainer team, **the whole Grove Trial and both rival fights from pack data through the real engine**, losing ends the dialogue, the legendary caught once then rematches, and a boss with no rematch. Plus a sim presence test and 2 save tests. **615 tests total.**

## Decisions
- **A trial is data, not a system:** a badge + trainers + dialogues with battle nodes and `{ beat }` / `{ badge }` branches. *Why:* reuses C26 completely; a region can shape its trial freely. *Alternative:* a `trials` registry with ordered challengers (more code, less flexible).
- **Trainer money is one-time, plus one rematch prize:** later wins pay only XP. *Why:* DESIGN Economy (trainer money is one-time); repeatable prizes would allow farming.
- **Scaling counts badges above the team's own threshold.** *Why:* the rival's teams by badges and `perBadge` scaling then work together without double counting.
- **Boss rematches are trainer-kind battles:** the boss faints, cannot be caught, and the player cannot run. A boss inside a trainer team is not written to the boss log (it is not the wild Titan).
- **Losing a story battle ends the dialogue** (the player wakes at the center); there is no `lose` node.
- **NPC presence updates only when nothing is open,** so a beaten rival doesn't vanish mid-sentence.

## Deviations from plan / design
- No DESIGN rule changed. Trainer line-of-sight spotting (C21 follow-up) is not built.

## Issues & known limitations
- Boss rematches use the trainer AI, which is much stronger: a Lv 60 team that catches Glacivar (Lv 40, wild AI) loses its Lv 45 rematch. Tune in C31.
- Badges are not shown anywhere yet except in dialogue (no badge case/HUD).
- The legendary shrine (Zorling NPC, wild boss → capture → it disappears) was verified by unit tests, not in the browser.
- Zorling NPCs play no cry when talked to.

## Verification
- `npm run check`: typecheck, lint, format, 615 tests (57 files) pass.
- Browser (headless Chrome, 960×540 at DPR 2, keyboard driven, team set to Lv 40 through the dev handle): Rival Mira: talk → battle → "See you at the trial!", +300 coins, she leaves. Keeper Bryn's intro; Oak sends you to Fern first; Fern battle +240; Oak battle +900, "You received the Grove Badge!" (screenshot), badges saved in the party; Keeper's line changes; the second Mira appears after the badge, battle +600, she leaves; Fern rematch choice → battle +200 (wins 2); "Not now" skips. No console errors.
- Done when "a sample trial and rival fight work end-to-end from data": ✅ (unit tests through the real engine + browser).

## Follow-ups
- C29/C30: line-of-sight trainers that walk up; real trial, rival and story bosses; rival starter counter-pick once a starter choice exists (C33).
- C32: a badge case / HUD badge, a trainer intro splash, cries for Zorling NPCs.
- C31: rematch levels/prizes, boss rematch difficulty (trainer AI), `perBadge`.

## Notes for the next chunk
- A battle from a dialogue: `{ say: [...], battle: { trainer: 'pack:id' }, win: 'node' }`. Give badges with `do: [{ badge: 'pack:id' }]`.
- `storyBattle(content, party, ref, seed)` is the pure entry point.
- Save format is v4.
