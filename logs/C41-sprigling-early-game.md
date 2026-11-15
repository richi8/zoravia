# C41 · Sprigling's early game — Log

- **Date:** 2026-11-15
- **Status:** done
- **Depends on:** C39

## Summary
Sprigling's early game no longer costs more than the other starters'. Rival Mira at Fernhollow now brings a Puddlit in place of her Ironshell against a Sprigling. Sprigling learns Iron Bash (Metal) at Lv 12 in place of Updraft, so its line has an answer to the Wind Zorlings after the badge. The two zones after Fernhollow are softer: no Galehawk in Fernwood, and Bramble's Hearthog and Ironshell top out at Lv 21. Up to the late fights the three Verdale plans are now within 5 wild battles and 3 wild losses of each other. Verdion and Vex were left as they are (the user's call), and they still cost a Sprigling team about 14 extra wild battles.

## What was built
- `packs/core/verdale-story.ts`: Mira at Fernhollow, third member: Ironshell, or **Puddlit** (`instead`) when the player picked Sprigling.
- `packs/core/species.ts`: Sprigling learns **Iron Bash** at Lv 12 (was Updraft).
- `packs/core/maps/verdale/overlay.json` (and the rebuilt `map.json`): Fernwood loses its Galehawk (Lv 18–22, weight 1). In Bramble, Hearthog and Ironshell are now Lv 17–21 (were the zone's 17–23); Thornwing stays at 20–23.
- `tools/balance/playthrough.test.ts`: new test "no starter is quietly worse up to the late fights". Over seeds 1–6, leaving out Vex and Verdion, the spread between the plans must be at most 10 wild battles and 3.5 wild losses. It fails on the code before C41 (loss spread 4.8).

## Balance report (20 seeds per team plan)

| Team plan | Wild battles before → after | Wild losses before → after | Wild battles before Vex | Story losses after |
| --- | --- | --- | --- | --- |
| sprigling | 141.8 → **135.6** | 11.5 → **4.5** | 128.7 → **121.1** | 6.0 |
| drizzlet | 116.4 → 117.0 | 2.1 → 1.6 | 116.4 → 116.4 | 1.2 |
| emberkit | 120.0 → 118.3 | 3.9 → 2.2 | 120.0 → 118.1 | 5.4 |

Where Sprigling's extra battles were and are (mean per run):

| Fight | Sprigling before | Sprigling after | Drizzlet after | Emberkit after |
| --- | --- | --- | --- | --- |
| mira-fernhollow: wild before / tries | 2.1 / 1.7 | 0.1 / 1.1 | 0.0 / 1.0 | 0.0 / 1.0 |
| marsh-guide-tess (the marsh stage): wild / losses | 18.1 / 10.4 | 12.4 / 3.4 | 8.0 / 0.1 | 9.8 / 1.3 |
| stormcatcher-vex: wild / tries | 2.8 / 1.9 | 2.5 / 1.8 | 0.8 / 1.3 | 0.0 / 1.0 |
| verdion: wild / tries | 10.3 / 4.2 | 11.8 / 4.7 | 0.0 / 1.0 | 0.0 / 1.0 |

Trainer sweep, Mira at Fernhollow (no potions, −1 / ±0 / +2 levels): Sprigling **0% / 0% / 25% → 0% / 53% / 100%**. Drizzlet is 33% / 95% / 100% and Emberkit 0% / 28% / 100%. The other trainers stay within noise.

What a Sprigling team lost to in the wild before C41 (10 seeds, 91 losses): Ironshell 25, Thornwing 23, Hearthog 18, Galehawk 17, Voltbat 7. Almost all of these came at team Lv 16–20 in Fernwood and Bramble, where every Zorling but Sproutle resists Nature (Wind, Fire, Metal). The team was Fernwick, an unevolved Pipwing and Puddlit. At Lv 16–17 it won 0% against a Galehawk of Lv 18 or more and 3–10% against a Lv 20 Thornwing.

## Decisions
- **Decision:** against a Sprigling, Mira's Fernhollow Ironshell becomes a Puddlit.
  - **Why:** all three of her Zorlings beat Nature (Fire ace, Wind, Metal). The other starters each face one counter plus Zorlings they can hit; an Emberkit player hits her Ironshell for double. A Puddlit is the same for a Sprigling.
  - **Alternatives considered:** a Mudpaddle (Earth/Water takes ×4 from Nature, too easy); lower levels (C33 found that the ace's level is not the lever).
- **Decision:** Sprigling learns Iron Bash at Lv 12, in place of Updraft.
  - **Why:** Drizzlet's line has Frost Fang (Ice beats Wind and Nature), and Emberkit's Fire beats Thornwing. Sprigling's line had nothing against Wind. Updraft (a Wind status move) did nothing for it. A Fernwick with Iron Bash hits Galehawk and Thornwing for double. Alone, this cut the Sprigling plan from 146 to 136 wild battles and from 13.4 to 8.6 losses.
  - **Alternatives considered:** Rock Slam at Lv 18 or 20 in place of 24 (no measurable gain); a new Metal move such as an "Ironbark" (no need, since Iron Bash exists).
- **Decision:** Galehawk out of Fernwood; Bramble's Hearthog and Ironshell top out at Lv 21.
  - **Why:** these were the two biggest loss sources left. Fernwood's Galehawk was a Wind final form up to 6 levels above a team that had just earned its badge, and Emberkit also won only 30–60% against it at Lv 16–17. Galehawk stays in the Downs (Lv 23–29), and Pipwing in Fernwood still evolves into it.
  - **Alternatives tried:** Thornwing in Fernwood at weight 1 and Lv 20–21 (kept as it was: the gain was within noise once Galehawk was gone); capping only Ironshell (5.8 losses, against 4.5 with both caps); capping only Galehawk at Lv 20 (little effect).
- **Decision:** Verdion and Vex were left as they are, and the plan's "within about 15 wild battles" is met only up to those two fights.
  - **Why:** the user chose this ("Leave late fights"). The plan says the grind before late fights stays as it is. Verdion is Nature/Wind and resists everything a Sprigling, Pipwing and Puddlit line can do, so the team wins it through the hint (C31 accepted this).
  - **Alternatives tried:** Slam as a second Armor break for Verdion (Sprigling −4 battles, but Emberkit +4, then reverted); Thornmane learning Steel Claw at 40 in place of Quake (no gain: Verdion's Armor needs the Electric + Metal plan, not a plain Metal hit); a Sprigling plan with Voltbat in place of Pipwing (worse, at 142 battles).
- **Decision:** the new test's bounds (10 battles / 3.5 losses over 6 seeds) are tighter than the plan's 15 / 5.
  - **Why:** over those seeds the pre-C41 loss spread was 4.8, so a bound of 5 would not have caught the problem this chunk fixed.

## Deviations from plan / design
- Done-when "the three Verdale plans within about 15 wild battles": met up to the late fights (spread 4.7). It is not met over the whole campaign (spread 18.6), because Verdion and Vex were left as they are by the user's decision (see Decisions). The 5 wild-loss criterion is met overall (spread 2.9).
- `DESIGN.md` is unchanged: learnsets, spawn tables and trainer teams are pack content, and no rule changed.

## Issues & known limitations
- A Sprigling team still needs about 12 wild battles and 4–5 tries for Verdion, and a few more tries for Vex, where the other starters need about 1. A real player who reads Verdion's hint and has a Voltbat will do better than the simulated player.
- Fernwood now has only three species (Sproutle, Thornwing, Pipwing).
- The new test runs 18 playthroughs (about 0.8 s).

## Verification
- `npm run check`: typecheck, lint, format and 929 tests pass (the world map check included).
- `npm run balance -- --seeds 20`: the tables above. A scratch breakdown per plan and fight, plus a log of what each wild loss was against, was used while tuning and then removed.
- The new C41 test fails on the pre-C41 content (stash of the four content files) and passes after.
- Done when:
  - Mira at Fernhollow tuned against Sprigling ✅ (+2 levels: 25% → 100%)
  - Sprigling's first zones tuned ✅ (wild losses 11.5 → 4.5; marsh stage 10.4 → 3.4)
  - Plans within about 15 wild battles and 5 wild losses ✅ up to the late fights (4.7 / 2.9); ❌ over the whole campaign for wild battles (18.6), by the user's decision on Verdion and Vex
  - Playthrough tests pass ✅

## Follow-ups
- If Verdion should be fair for a Sprigling team too, it needs its own chunk: a second Armor break or a late move for the Sprigling line, tuned across all three plans (Slam alone shifted the cost onto Emberkit).
- Balance: rests are still not modeled (C40 follow-up).

## Notes for the next chunk
- `npm run balance` now shows Sprigling at about 136 wild battles and 4.5 losses. If species, zones or trainers change, run the C41 test in `tools/balance/playthrough.test.ts` too.
- Sprigling's Lv 12 move is Iron Bash. Anything that teaches or names Updraft for Sprigling, such as dialogue or a guide, should follow.
