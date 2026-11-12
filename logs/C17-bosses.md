# C17 · Bosses — Log

- **Date:** 2026-11-12
- **Status:** done
- **Depends on:** C16

## Summary
Bosses are now content (a `bosses` registry) and the battle engine fights them in boss form. The aura gives ×3 max HP, the signature move as an extra move, and Armor. Armor takes reduced damage until one of the boss's listed reactions breaks it. Broken Armor takes ×1.5 for 2 turns, then re-arms. Beaten in a wild battle, a boss is Subdued: any capture item then catches it for sure, and it comes out in its captured form (no aura, Titan mark, keeps its signature move). A pure simulator plays whole boss fights. Against a typical Titan, a reaction player wins 96% of fights with no potions, while brute force needs ~4–5 Super Potions. Getting there took Armor ×0.4 instead of the designed ×0.3 (DESIGN.md updated).

## What was built
- `src/game/data/bosses.ts`: `bosses` registry (`kind titan | legendary`, `species`, `level`, `hpMultiplier` default 3, `signatureMove`, optional `armor.breaks` reaction ids). Checks: a legendary boss needs a legendary species, and a Titan must not be one. The signature move must not be in the learnset. No duplicate breakers. Added to `GAME_REGISTRIES` and `GameContent.bosses`.
- `packs/core/bosses.ts`: test bosses `core:thornwing-titan` (Lv 24, broken by Overload) and `core:glacivar` (legendary, Lv 40, broken by Slam). New core moves: `bramble-gale`, `whiteout` (signature moves), `static-field` (Electric status move), `cold-snap` (Ice status move).
- `src/game/battle/logic/state.ts`: `Combatant.moves` (its usable moves, which can be 4 for a boss) and `Combatant.boss: BossState | null` (`id`, `baseHp`, `armor armored | broken | none`, `rearmTurn`, `subdued`). New choice `{ kind: 'wait' }` (a Subdued boss's only choice). New events `subdued`, `armorBroken`, `armorRestored`.
- `src/game/battle/logic/boss.ts`: `bossZorling`, `withSignature`, `bossOf`, `hpUnit`, `isSubdued`, `armorHit`, `breaksArmor`, `capturedForm`.
- `src/game/battle/logic/rules.ts`: `ARMOR_DAMAGE_MULTIPLIER` 0.4, `ARMOR_BROKEN_MULTIPLIER` 1.5, `ARMOR_BROKEN_TURNS` 2, `ACTION_RANK.wait`.
- `src/game/battle/logic/engine.ts`: `BattleSetup.boss { id, slot? }`. Boss form in `toCombatant`. Armor in the damage step (reaction → `armorBroken` → `damage`). `rearm` at the end of the turn, after status ticks. Subdue instead of faint in wild battles. A Subdued boss → guaranteed catch in `throwCapture`. `legalChoices` while Subdued (player: capture items only; boss: `wait`), and no capture items at a boss before that. `endTurn` keeps the battle going while a Subdued boss can be caught, or calls it a win. Status HP loss uses `hpUnit`.
- `src/game/battle/logic/result.ts`: `finishBattle(...).caught` is the captured form for a boss.
- `src/game/battle/logic/ai.ts`: armor-aware `moveValue` (×0.4 / ×1.5, `AI_ARMOR_BREAK_BONUS` 0.25), setup value against Armor (`AI_ARMOR_SETUP_BONUS` 0.15 for a breaking combo; a non-breaking combo × 0.4). Damage is valued in `hpUnit` (HP without the aura). `wait` is handled.
- `src/game/battle/logic/boss-sim.ts`: `simulateBoss(content, { boss, team, bag, policy, seed })`. The policy is `reactions` (trainer AI) or `brute` (hardest hit alone, no reactions or setup), plus a potion rule. It returns outcome, turns, potions used, Armor breaks, reactions and boss HP left.
- Tests: `src/game/battle/logic/bosses.test.ts` (17): data rules, aura, Armor cycle with exact damage, DoT on the base HP, Subdued/capture/win/trainer faint, captured form, AI, and the simulation.

## Decisions
- **Decision:** Armor ×0.4 instead of ×0.3 (DESIGN.md changed).
  - **Why:** "Done when" asks for a boss that is beatable by ~4–5 potions, and DESIGN "Economy" says brute force ≈ 4–5 good potions, "doable sometimes, not always". In the simulation, ×0.3 with ×3 HP made the boss ~10× as tough as a normal Zorling, so brute force won 1% of fights with 5 Super Potions (it needed ~8). ×0.4 gives 54% with 4 and 80% with 5. The reaction player wins 96% at either value, so reactions keep their edge.
  - **Alternatives considered:** lowering HP to ×2–2.5 (also works, but "~×3 HP" is the more visible rule and keeps fights feeling big). Leaving ×0.3 for C31 (would fail this chunk's "Done when").
- **Decision:** Status HP loss (Burning, drains) on a boss is a fraction of its HP without the aura (`BossState.baseHp`).
  - **Why:** found in the simulation. Burning took 1/16 of ×3 HP, ignored Armor and outdamaged most hits, so it would be the answer to every boss whatever its weakness.
- **Decision:** The AI measures damage in HP without the aura.
  - **Why:** found in a trace. With ×3 HP every hit's value shrank to a third while the fixed setup/switch bonuses stayed, so the AI kept setting up and switching, and wasted the broken-Armor window.
- **Decision:** Against intact Armor, setting up a combo that does not break it is worth only ×0.4.
  - **Why:** the flat combo bonus assumed the follow-up does full damage. Against Armor, Blazekit kept re-casting Kindle for a Steam Burst that would barely scratch it.
- **Decision:** The extra move = the signature move. It is added on top of the 3 slots in boss form (so `Combatant.moves` can differ from the Zorling's). Caught, it takes the place of the oldest move.
  - **Why:** DESIGN names an "extra move" for the aura and a "signature move" the Titan keeps. Making them one move gives the player a reason to want the catch, and needs one field.
- **Decision:** The breaking hit already counts ×1.5. Armor stays broken for the 2 turns after the break turn and re-arms at the end of the second (`rearmTurn = turn + 2`).
  - **Why:** counting the break turn as one of the 2 would leave the player only one more turn, and the payoff for pulling off the reaction should be felt at once.
- **Decision:** Subdued only in wild battles. The player can then only throw capture items (always works), and the boss only `wait`s. Without a capture item, the battle ends as a win. Capture items can't be thrown at a boss before it is Subdued. In trainer battles bosses faint.
  - **Why:** "defeat → Subdued → guaranteed capture" without extra menus. Forcing the throw costs nothing (a full team sends it to storage). Story bosses (C27) are likely trainers, and their Zorlings cannot be caught.
  - **Alternatives considered:** a free capture outside the battle (would skip the C18 capture animation). Allowing early throws at a boss (a lucky Zorb would skip the whole fight).
- **Decision:** A caught boss comes with 1 HP, and a Titan gets the Titan mark (legendaries don't).
- **Decision:** A boss is set per battle (`BattleSetup.boss`), not per Zorling, and its Zorling is a normal instance (`bossZorling`).
  - **Why:** the boss form is battle-only (DESIGN: "boss form ≠ captured form"). Saves never store an aura, and rematches just pass a higher level.
- **Decision:** The test Titan is Thornwing (2-stage final, Nature/Wind), not Ironshell.
  - **Why:** a normal Ironshell (base DEF 170) already beats each test Zorling 1v1, so no ×3 version can be balanced against a team at its level. Thornwing is a typical Titan base.

## Deviations from plan / design
- `DESIGN.md` updated ("Bosses"): Armor ×0.4 with the reason, and the list of C17 rules above.
- Dex weakness logging, NPC hints, one per save and rematches are not engine work. They are left to C22/C26/C27 (see Follow-ups).

## Issues & known limitations
- The simulation uses one Titan and one well-matched team (Voltbat with Static Field, Ironshell, Blazekit, all Lv 24). Other matchups will differ. Real tuning with region 1 content is C31.
- The reaction player wins 96% with no potions. That may be too easy, but the team here is close to ideal against this Titan (Ice ×2.25, Electric and Metal both strong).
- Boss XP is the normal XP of its species and level (no aura bonus).
- The trainer AI is still one ply deep. It breaks Armor ~3 times per fight here, but it does not plan around the re-arm.
- `Combatant.moves` is the source of moves in battle now. Code reading `zorling.moves` for a battle Zorling would miss a boss's signature move.
- RNG draw order is unchanged (no new rolls). A Subdued catch draws nothing.

## Verification
- `npm run check`: typecheck, lint, format, 443 tests (39 files), all pass.
- Simulation report (500 seeds per row; Thornwing Titan Lv 24 vs Voltbat/Ironshell/Blazekit Lv 24; Super Potion below 40% HP; win = caught):

  | Potions in bag | Reactions: win | Brute force: win |
  |---|---|---|
  | 0 | 96% | 0% |
  | 1 | 99% | 2% |
  | 2 | 100% | 9% |
  | 3 | 100% | 27% |
  | 4 | 100% | 54% |
  | 5 | 100% | 80% |

  Reaction fights: ~2.8 Armor breaks, ~16 turns. Brute force: 0 breaks, ~33–35 turns with 4–5 potions.
- Done when:
  - Tests for the Armor cycle: ✅ ×0.4 armored (exact damage), a non-breaking reaction (Shred) does not break it, Overload breaks it (event order, ×1.5 × reaction on the hit), ×1.5 for 2 more turns, `armorRestored` at the end of the second, ×0.4 again after.
  - Tests for the capture flow: ✅ no throws before Subdued; Subdued (no `fainted`), boss only waits, player only throws; guaranteed catch (3 wobbles), Zorb used up, XP given; captured form (Titan mark, 1 HP, signature move, no aura); legendary has no mark; no Zorb = win; trainer battle = normal faint.
  - Simulation shows a boss beatable by reactions and by ~4–5 potions: ✅ (table above; tests assert ≥ 90% with reactions and no potions, brute 0% with none, < 50% with 3, ≥ 60% with 5).

## Follow-ups
- C18: present `subdued`, `armorBroken`, `armorRestored`; show Armor on the boss HUD; the boss's 4th move; the `wait` choice for a Subdued boss (skip its turn presentation); capture animation on a Subdued boss.
- C22: Dex logs a Titan's weakness (`boss.armor.breaks`) after the first encounter.
- C26/C27: NPC hints, one boss per save (catch or win), rematches (`bossZorling(..., { level })`), story bosses with `BattleSetup.boss` on a trainer slot.
- C29: real Titans and the legendary. Make sure the hinted condition can be applied reliably (a status move in the region), since breaks fell to ~0.8 per fight without one.
- C31: tune `ARMOR_*`, `hpMultiplier`, `AI_ARMOR_*`, boss XP; run `simulateBoss` over many Titan × team pairs.

## Notes for the next chunk
- `createBattle(content, { kind: 'wild', …, opponent: [bossZorling(content, id, { uid })], boss: { id } })`.
- Use `Combatant.moves` (not `zorling.moves`) for move menus in battle.
- While the opponent is Subdued: `legalChoices(PLAYER)` = capture items only; the opponent's choice is `{ kind: 'wait' }` (`aiChoice` returns it).
- Turn end order: status ticks → Armor re-arm → `turnEnd`.
