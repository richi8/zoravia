# C35a · Regional body models — Log

- **Date:** 2026-11-14
- **Status:** done
- **Depends on:** C34 (and C29's stage rules)

## Summary
Each region now draws its Zorlings from its own **model kit**: a list of body plans and part weights in the pack's data. The generator has 20 new body plans:
- 8 desert plans;
- 9 frozen-coast plans;
- 3 legendary dragons, one per region.

It also has 7 new parts. Emberwaste's 13 looks moved to the desert kit, and Verdion became Verdale's dragon. Every other Verdale look renders pixel-identically.

The preview ran three rounds with the user:
1. New plans for each region.
2. The kits stopped sharing any plans with each other.
3. Each region's legendary got its own dragon and a shine in battle.

Rimeholm's looks (frozen kit) were approved in the same rounds. They are applied on `c35-wip`, because the Rimeholm pack lives on that branch.

## What was built
- **Body plans** in `src/game/zorlings/`. All face right with the ground at y = 0. Each lists its weights, moods and a cry voice.
  - `plans-desert.ts`:
    - lizard / salamander;
    - scorpion (stinger fixed);
    - beetle (rhino horn or stag mandibles, optional wings);
    - cactus (arms, spines, flower);
    - tortoise (scutes, a vent on fire types);
    - sandworm (ringed, toothed maw);
    - vulture;
    - fennec.
  - `plans-frozen.ts`:
    - pinniped (seal; with tusks a walrus);
    - tusker (mammoth: trunk, tusks, shaggy fringe);
    - jelly (hovers);
    - crab;
    - angler (always has its lure, hovers);
    - mustelid (stoat, otter, wolverine);
    - owl;
    - caribou;
    - urchin.
  - `plans-legendary.ts`:
    - leafwyrm: a floating eastern dragon in an S-coil, with antlers, a leaf mane, glowing whiskers and a pearl;
    - magmadrake: rock plates, lava cracks, a glowing chest, great horns, wings, a magma club tail;
    - frostwyrm: a rearing wyvern with crystal wings, lightning veins, an icicle crest and a tail blade.
  - `CLASSIC_PLANS` holds the 13 original plans.
- **Parts** (`genome.ts`, `parts.ts`):

  | Slot | New kinds |
  |---|---|
  | horns | `tusks`, `lure` |
  | back | `ruff`, `icicles`, `carapace` |
  | tail | `stinger` |
  | markings | `frost` (rime on top surfaces, frosted feet, ear and tail tips) |

  - Shared helpers `jointed` (legs) and `pincer` (claws).
  - New fixed ramps `frost` and `ivory`.
  - Per-genome ramps `glow` and `glow2`: the first and second type's glow color.
  - The fish plan also draws the lure for `lure`.
- **Kit options** for `generateGenome`:
  - `plans`: what an unforced plan rolls from. The default is the classic set.
  - `parts`: weights added to the plan's own. `0` removes a kind. A slot where the plan allows only one kind (beaks, stingers) ignores the kit. If a kit removes every kind, the plan's own weights are used.
- **Stage rules** (`variants.ts`):
  - Babies lose tusks and lures (to none), icicles and carapaces, and keep ruffs and frost.
  - Middle stages turn a carapace into spikes.
- **Legendary shine** (`animate.ts`, `shine`): a dithered glow edge plus 7 sparkles near the silhouette that twinkle in turn over the idle loop. It is deterministic per seed.
  - `BattleLook.legendary` → `ActorOptions.legendary` → `animateZorling({ legendary })`, set for any legendary species in battle.
  - Motion: leafwyrm, jelly and angler hover; vulture, owl, magmadrake and frostwyrm flap.
- **Data**:
  - New registry `modelKits` (`src/game/data/kits.ts`), loaded before species.
  - `look.kit` on species. It is checked: the ref exists, the plan and young plans are in the kit, and a look with a kit names its plan.
  - `speciesLook` passes the kit's plans and parts to the generator.
- **Packs**:
  - `core/kits.ts` (`core:verdale`): the 13 classic plans plus leafwyrm. All Verdale looks name it. Glacivar is left alone because it moves out of core in C35.
  - **Verdion** is now `leafwyrm` (seed 5002).
  - `emberwaste/kits.ts` (`emberwaste:desert`): the desert plans plus magmadrake.

  | Line | Plan | Seed |
  |---|---|---|
  | Magmaroth | lizard | 3702 |
  | Dunemaul | tortoise | 4100 |
  | Saguardian | cactus | 3724 |
  | Pyrebeetle | beetle | 3730 |
  | Dunewyrm | sandworm, young lizard | 4111 |
  | Ironjaw | beetle | 3762 |
  | Mirageel | lizard | 4123 |
  | Brambleroll | cactus | 4134 |
  | Dustwhirl | vulture | 4141 |
  | Voltsting | scorpion | 3795 |
  | Shimmerfox | fennec | 4150 |
  | Forgeback | lizard | 3811 |
  | Calderon | magmadrake | 5010 |

  - Reworded descriptions (user OK): Magmaroth ("sail-backed lizard"), Pebbit ("tortoise hatchling"), Tumblet ("cactus pup"), Dustwhirl ("vulture").
- **Rimeholm** (frozen kit, applied on `c35-wip`): `rimeholm:frozen` with the frozen plans plus frostwyrm.
  - Parts: ruff +3, icicles +3, frost +1.5…3, fluffy tails +1. Leaves, carapaces, sails, flame and leaf tails, and socks are removed.

  | Line | Plan | Seed |
  |---|---|---|
  | Selkaris | pinniped | 3900 |
  | Tundramoth | tusker | 3913 |
  | Auroryx | caribou | 4204 |
  | Rimestoat | mustelid | 4210 |
  | Lumenaw | angler, dark | 4220 |
  | Brineclaw | crab | 3950 |
  | Tanglekelp | mustelid (otter) | 4234 |
  | Floemaw | pinniped (walrus) | 3974 |
  | Urchivolt | urchin | 4241 |
  | Jellivolt | jelly | 3994 |
  | Frostcairn | crab | 4250 |
  | Squallwing | owl | 4262 |
  | Glacivar | frostwyrm | 5020 |

- **Tests** (745):
  - `zorlings.test.ts`: every part kind is reachable, now over all plans. Kits: no kit keeps the classic rolls; kit plans and parts; fixed slots; the remove-everything fallback.
  - `animate.test.ts`: babies of every plan follow the stage rules, and the shine is brighter, twinkles and is deterministic. The every-plan clip test gets 20 s.
  - `data.test.ts`: looks against their kit.
  - `species-look.test.ts`: Verdion is a leafwyrm and shines.
  - `emberwaste/roster.test.ts`: every look uses the desert kit, which shares no plan with Verdale.

## Decisions
- **Decision:** The kits share **no** plans across regions (round 2), and each legendary is a unique dragon (round 3). This came from the user's review.
  - **Why:**
    - Round 1 mixed new plans with classic ones carrying regional parts. The user wanted the sets "to not share as much".
    - They then asked for a cool, unique legendary per region, "maybe a dragon of the zone element".
  - **Alternatives considered:** round 1's mixed kits, with about 6 of 13 lines on new plans per region.
- **Decision:** Kit part weights are **added** to each plan's own, with 0 to remove a kind. Fixed slots ignore the kit.
  - **Why:** a kit can push a region's parts (ruffs, icicles) onto every plan without making a scorpion lose its stinger or an avian its beak. It also never changes genomes without a kit: zero-weight kinds are appended at the end of the part lists, so `Rng.weighted` rolls exactly as before.
  - **Alternatives considered:**
    - Replacing the plan's weights: this broke anatomy.
    - Per-plan kit weights: too much data for little gain.
- **Decision:** The plans are named by form (lizard, frostwyrm), not by species. Packs pick them through kits.
  - **Why:** "The engine holds no game content". The drawing code is a library, and a region's choice of plans is pack data.
- **Decision:** An unforced plan rolls from `CLASSIC_PLANS`, not all `BODY_PLANS`.
  - **Why:** existing seeds without a forced plan (test fixtures, ids used as seeds) keep their looks.
- **Decision:** Only the final form has a look. Young stages of the new lines use the same plan as the final form unless `young` says otherwise, and C29's stage rules make the babies.
  - **Why:** the preview showed the babies reading well (seal pups, mammoth calves, cactus sprouts). Only Dunewyrm keeps a young plan (lizard → sandworm).

## Deviations from plan / design
- The plan listed 4 desert and 5 frozen plans (the anglerfish as a lure part). The build has 8 desert, 9 frozen and 3 legendary plans, after the user's review rounds.
- "Rimeholm's looks set from the frozen kit, in C35's species file": done on `c35-wip`, since the Rimeholm pack only exists there. The frozen kit file is `packs/rimeholm/kits.ts` on that branch.
- `DESIGN.md` updated:
  - "Regional model kits" (plans per region, the parts, no sharing).
  - "Legendaries" (unique element dragons, the shine).

## Issues & known limitations
- **Overworld sprites:** the new plans render at 32 px. Thin parts (scorpion legs, owl tufts) are only a pixel or two there. They were checked at battle size in the previews, not in the overworld.
- **Legendary shine:** applies only in battle, not to the overworld lair NPC (C32 left those at Zorling NPC size).
- **Vulture:** the weakest of the new plans; it reads a little blobby in the dark mood. The user approved it.
- **Lab:** the Zorling lab lists every plan, but can't preview a kit.

## Verification
- `npm run check`: typecheck, lint, format and tests all pass (72 files, 745 tests).
- `npm run build`: passes.
- **Verdale unchanged:** every core species was rendered with the old and new code (a HEAD worktree vs this branch; battle size, stage fill). Only Verdion's hash differs.
- **Preview rounds:** scratch worktree renders, published at https://claude.ai/artifact/FpWCjMHtVFjgfLYiQ57Pe1 (3 versions).
  - Round 1: 8 plans, 7 parts, picks for every line.
  - Round 2: 9 more plans, no shared plans.
  - Round 3: legendary dragons, animated with the shine.
- **Browser** (headless Chrome, `vite`, 960×540): a new Emberwaste game, then a wild Lv 30 Calderon. Calderon showed as a magmadrake with its glow edge, and the player's Sizzlet as a baby lizard. No console errors.
- **Done when:**
  - User approved a preview round with images shown before code: ✅ (3 rounds, all in a scratch worktree before any repo change).
  - Emberwaste and Rimeholm rosters render with their own kits: ✅ Emberwaste (roster test). Rimeholm: ✅ on `c35-wip` (see Notes).
  - Existing generator tests pass, and new plans pass the same render and animation checks: ✅ (the every-plan tests loop over all 33 plans).

## Follow-ups
- **C35:** Rimeholm's looks are on `c35-wip`, and its roster test should get the same "own kit, nothing shared" check.
- **C35, descriptions:** reword any whose shape changed:
  - Rimestoat: "snow ferret" is fine.
  - Auroryx: now a caribou.
  - Squallwing: now an owl.
- **C37 or a small chunk:**
  - Kit previews in the lab.
  - The overworld lair NPC for legendaries could shine too.
- **C36:** a cross-region legendary or new region needs a new dragon plan and a kit.

## Notes for the next chunk
- New region looks: add a kit (`modelKits`) to the pack, give every look `kit: '<pack>:<kit>'` and a plan from it, and preview first.
- `generateGenome(seed, { plans, parts })` takes a kit's data directly. Scratch preview scripts can pass `parts` the same way `speciesLook` does.
- To resume C35:
  1. `git checkout c35-wip` (already rebased onto C35a, with the frozen kit and Rimeholm looks applied).
  2. Continue with the log's "Still to do" list.
