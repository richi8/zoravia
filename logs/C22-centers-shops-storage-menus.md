# C22 · Centers, shops, storage, menus — Log

- **Date:** 2026-11-13
- **Status:** done
- **Depends on:** C21

## Summary
The overworld now has its menus and town services. `Esc` opens a pause menu. `P I B M J` open the party, bag, Dex, map and quest screens directly. NPCs can have a role: talking to the healer opens the Zorling center (heal, storage, move relearner), and talking to the shopkeeper opens her shop. Money comes in from wild wins and shows in the HUD. Losing a battle wakes the player at the last center they used. The full loop (catch → storage → swap at a center → buy potions → use one in battle) works in a unit test and in the browser.

## What was built
- **Player rules** (pure), `src/game/player/`:
  - `party.ts`: `Party` gains `dex`. New `newParty(...)` logs owned Zorlings as caught. `applyBattleResult(party, result, { opponents, prize })` now also pays the prize (wins only), logs the foe as seen, and gives a caught Zorling a free uid (`freeUid`). `healed(content, z)`.
  - `dex.ts`: `Dex` (`seen`, `caught`, kept in the order first logged), `markSeen`, `markCaught` (caught implies seen), `dexEntries(content, dex)` (registry order = Dex number).
  - `center.ts`: `healAll` (team + storage). `Spot` (team slot or storage index), `canMove` and `moveZorling` handle swaps, deposits, withdrawals and hotbar reordering, with no gaps left in the lists and the team never empty. Move relearner: `RELEARN_FEE` (100), `relearnOptions`, `relearnProblem`, `relearn`.
  - `shop.ts`: `WILD_PRIZE` / `wildPrize(level)` (4 + 2 × level), `maxBuyable` (money and bag cap), `buyItem`, `fieldUseProblem` and `useItemInField` (potions outside battle).
- **NPC roles**, `src/game/data/npcs.ts`: an optional `role`, either `{ kind: 'center' }` or `{ kind: 'shop', title?, stock }`. Load-time checks reject stock items that don't exist, have no price, or are listed twice.
- **Content**, `packs/core/npcs.ts`: Healer Wren stands at the test region's `center` anchor (role center). Shopkeeper Ida now runs "Ida's Shop" (Potion, Super Potion, Max Potion, Zorb).
- **Screens** (storybook kit), `src/game/ui/`:
  - `party-panel.ts`: the team with portraits, HP and hotbar keys. Details on the right: types, HP/Atk/Def/Spd, XP to next level, trait and moves (type, power, accuracy). `E` picks a Zorling up and puts it down to reorder the hotbar.
  - `storage-panel.ts`: team column plus a 7×4 box grid that scrolls by rows. The last cell is always empty, for depositing. Pick up / put down swaps or moves. An info line shows the Zorling under the cursor, or why a move was refused.
  - `dex-panel.ts`: numbered list (unseen = "???", a Zorb mark when caught), with a 64 px sprite, types and the description once caught. `A`/`D` page through the list.
  - `map-panel.ts`: `MapPanel` shows the region minimap with a blinking player marker, the center and shop markers, and a legend. `NoticePanel` is a small paper panel (the quest log placeholder).
  - `zorling-view.ts`: `ZorlingView` data, `portraitSlot`, and `PointerQueue` (mouse hover/click queued into the fixed step, like `Menu`).
- **Menu controller**, `src/game/scenes/overworld-menus.ts`, `OverworldMenus`: builds each screen from the party, applies changes through `@game/player` and re-centers screens on resize. It covers the pause menu, party, bag (potions on team members; Zorbs say they're for wild battles), Dex, map and quests ("empty for now"). The center menu has heal, storage and the relearner chain (who → which move → which move to forget). It also runs the shop (buy messages, "you need N coins"). Speaker names come from the NPC.
- **Overworld** (`overworld-scene.ts`):
  - Menu keys and the pause menu. Its "Quit to launcher" replaces the old Esc exit.
  - The input context follows the top widget (dialog or menu). Held keys are suppressed only when the context changes.
  - Role NPCs open their service after their lines, and they keep facing the player until it closes.
  - Wild Zorlings in view are logged as seen. Wins pay `wildPrize`.
  - Losing sends the player to `respawn`: in front of the last center used, or the map's first center NPC until then.
  - The HUD shows money. `scene.party` is now a setter that reports every change through `onParty`.
- **Minimap shared**: `buildMinimap` / `minimapColor` moved from the C19 map viewer to `src/game/world/map/minimap.ts`. The viewer passes its zone and collision overlays as a tint callback.
- **Tests**, `src/game/player/player.test.ts` (13): Dex logging and entries; prize and Dex on battle results; uid clashes; center heal; swap, deposit, withdraw and reorder rules (team never empty); relearner fee, slots and problems; shop limits (money, cap, unsold); potions outside battle; NPC role validation. One test runs the **full loop through the real battle engine**: catch with a full team → storage → swap onto the hotbar → buy 3 potions → use one in the next battle. **541 tests total.**

## Decisions
- **Decision:** Centers and shops are NPC roles (`role` on the `npcs` registry), not map anchors or a separate registry.
  - **Why:** C21 already lets any pack place NPCs on any map. A role keeps a service and the person who offers it together, so a pack adds a shop with one entry. The map's `center` anchor just says where the healer stands. Building art and interiors come with towns (C28).
  - **Alternatives considered:** a `shops` registry keyed by anchor. It means two entries that must agree, and it gives no one to talk to.
- **Decision:** Storage is only reachable at a center. The party screen can reorder the hotbar anywhere.
  - **Why:** DESIGN says swapping with storage happens only at a center. Reordering the active three changes nothing about who you have with you.
- **Decision:** The team can never be empty: the last member can be swapped but not deposited.
  - **Why:** battles and the hotbar need at least one Zorling, and it is the rule players expect.
- **Decision:** The center heals the team **and** storage, for free.
  - **Why:** the stored Zorlings are healed whenever the player could take them out anyway (only at a center), so tracking their HP adds nothing.
- **Decision:** Relearner fee 100 coins; wild win prize 4 + 2 × level (Lv 5 → 14, Lv 20 → 44).
  - **Why:** "small fee" and "small change" from DESIGN. A potion (100) costs about 5–7 meadow wins, so trainers and quests stay the real income as the Economy section asks. Tuned in C31.
- **Decision:** Losing sends the player to the last center used, team healed, no money lost.
  - **Why:** classic, readable, and the C21 follow-up asked for it. A money penalty can come in C31 if losing turns out too cheap.
- **Decision:** Seen = on screen in the overworld (or fought).
  - **Why:** encounters are visible (no random battles), so seeing one is the natural moment to log it.
- **Decision:** No new preview round for these screens.
  - **Why:** they are built only from the approved C10 kit (paper panels, gold cursor, smooth text, key hints, type badges, portraits). If the user wants a different layout, it can be iterated with previews.

## Deviations from plan / design
- DESIGN.md updated: a "Rules settled in C22" list under Team (team never empty, free center heal, relearner fee, what counts as seen, losing → last center, potions outside battle) and the wild prize under Economy. These are new rules, not changes to old ones.
- The plan lists "inventory" and "shop + money". The bag screen is the C10 `BagPanel` used outside battle, and money is shown in the HUD, bag and shop. There is no separate inventory screen beyond the bag.
- `J` (quests) opens a placeholder panel. The quest log is C26.

## Issues & known limitations
- Nicknaming is not in the party screen yet. A text-entry widget is needed (keyboard-only typing).
- Evolution and "replace a move" offers from level-ups are still not interactive. The battle text says "can evolve" / "wants to learn", but nothing acts on it after the battle. The relearner covers missed moves for a fee.
- The center is an NPC at a door tile with no building art. Its 3×2 footprint is blocked (C19 overlay) but empty.
- The storage box has no sorting, search or multiple boxes. It scrolls by rows and is fine for dozens, not hundreds.
- The Dex sprite is the 64 px render of a species; Titans and legendaries in their boss look aren't shown.
- Menus that open on top of each other (relearner chain) stay visible underneath, slightly offset. That is readable, but a bit busy.
- `Party` is still in memory only (kept by the launcher between visits). Saves are C23.
- In the browser, I triggered the win prize and the loss with a direct call to the scene's `finishBattle` (same code path as a real battle end). The real battle covered potion use and running away.

## Verification
- `npm run check`: typecheck, lint, format, **541 tests (48 files)**: all pass.
- Browser (headless Chrome via puppeteer in the scratchpad, dev server, 960×540 × DPR 2 → 480×270 at ×4, keyboard only; party values set through the dev handle where noted):
  - HUD shows "Test region · town" and the money (1 240).
  - Esc → pause menu (Party P, Bag I, Dex B, Map M, Quests J, Quit to launcher). Q closes it. P, I, B, M, J each open their screen and Q closes it.
  - Party: three starters with portraits, HP and hotbar keys. Details show the type, stats, XP to next, trait (Kindling) and moves.
  - Bag: potions with counts against the cap. Use on → a 3 HP Puddlit healed to 33, and Potion 3 → 2. A message box confirms.
  - Dex: "Seen 3 · Caught 3" at first. Emberkit is shown with its sprite, Fire and "Caught", unseen ones as "???". After walking into the meadow, Seen grew to 5.
  - Map: the test region minimap with the gold "You" marker blinking next to the red center and blue shop markers, plus a legend.
  - Healer Wren (E): her line, then the Zorling center menu. Heal: a team at 3/36 HP back to full, with "Your Zorlings are fully healed."
  - Storage: picked up team slot 1, put it on box slot 1, and they swapped (`x1,p2,p3 | p1,x2`).
  - Relearner with an Lv 14 Emberkit: who → Flame Pounce → forget Gust → "learned Flame Pounce!". Money 450 → 350.
  - Relearner with nothing to relearn: says so instead of opening an empty menu (found in the browser and fixed).
  - Ida's Shop: D for quantity 2, E: "You bought 2 × Potion", 450 → 150 after the relearner. The Potion row shows FULL (5/5).
  - Win against a Lv 8 wild Zorling: money 1 240 → 1 260.
  - Loss: woke up at (48, 47) facing the healer, team healed, with "You hurried back to the Zorling center…".
  - Real wild battle (touched a Sproutle Lv 8): Items → Potion → Puddlit (5 HP), then ran. Back in the world, the bag showed 2 potions and Puddlit at 29 HP after a hit.
  - No console errors or warnings in any run.
- Done when "full loop: catch → storage → swap at center → buy potions → use in battle": ✅ (unit test through the real engine; in the browser, swap, buy and potion use in a real battle; catching was covered in C18 and C21)

## Follow-ups
- **C23:** save `Party` (now with `dex`), the respawn center, the player's map, position and facing.
- **C26:** the quest log behind `J`. NPC roles could become dialogue choices ("Heal / Storage / …").
- **C27/C29:** trainer prize money (paid through `applyBattleResult`'s `prize`). Titan weakness in the Dex after the first encounter (DESIGN Bosses).
- **C28:** center and shop buildings (art, door, maybe interiors). Shop stock per town tier (T1 towns probably shouldn't sell Max Potions).
- **C31:** tune `RELEARN_FEE`, `WILD_PRIZE`, potion prices. Decide whether losing should cost money.
- **C33:** nickname entry (keyboard text widget) from the party screen. Settings in the pause menu.
- **New (not in a chunk yet):** after-battle evolution and move-offer prompts. A party "Evolve" action for Zorlings that waited. Suggested for a small chunk before C28, or as part of C26.
- **C32:** open/close animations for menus, a cursor sound (C24), a sell option in shops if items beyond potions appear.

## Notes for the next chunk
- `Party` = `{ team, storage, bag, money, dex }`; build it with `newParty({ team, storage?, bag?, money? })`. All rules are pure in `@game/player`.
- `OverworldScene.party` is a getter/setter. Setting it calls `onParty`. The scene's `respawn` (private) is the center to wake up at, and C23 should save it.
- Give an NPC `role: { kind: 'center' }` or `role: { kind: 'shop', title, stock: [...] }` to make it a service.
- `buildMinimap(map, biome, scale, tint?)` draws any region overview.
