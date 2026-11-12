# C08 · Zorling genome & sprite generator v1 — Log

- **Date:** 2026-11-12
- **Status:** done
- **Depends on:** C02, C07

## Summary
Zorlings are now generated from a small JSON genome (one of 13 body plans, a mood, 9 part slots, palette, proportions, seed) and drawn as pixel art at 96×96 (battle) and 32×32 (overworld). Shapes are built in code as signed-distance primitives and rasterized directly to pixels by a pure engine module: hard edges, flat shading bands with hue-shifted ramps, a 1-px outline, lines between overlapping parts, and pixel-stamped eyes and mouths. The lab has a Zorling section: a grid of 24 with seed/type/body-plan controls and a detail view (both sizes, flipped enemy view, genome JSON).

## What was built
- `src/engine/render/sdf-sprite.ts` — pure rasterizer: primitives (`circle`, `ellipse`, `capsule` (tapered), `polygon`, `union` (optionally smooth), `subtract`, `intersect`), `rasterize(model, { width, height, view, stamps, partLines, outline, light, bands })`, `modelBounds`, `flipX`, `spriteHash`. Shapes carry a ramp (or per-pixel ramp function for markings), z, group, `depth` (darker far limbs), `thin` (survives small sizes), `lines`.
- `src/engine/render/sprite-canvas.ts` — `spriteToCanvas(sprite, scale)` (browser, nearest-neighbor).
- `src/engine/core/color.ts` — `toHsl`, `fromHsl`, `rotateHueToward`.
- `src/game/zorlings/genome.ts` — `ZorlingGenome` (version 1) with `mood` (`cute` | `fierce` | `dark`, weighted per plan; biases eyes, mouths, horns, spikes), `zorlingGenomeSchema` (Zod), `BODY_PLANS`, `PART_KINDS` (the part library), `generateGenome(seed, { plan?, type?, dualChance? })`. Part weights per body plan × type bias (fire → flame tails, nature → leaves/antlers, ice → crystals, …). Each slot rolls from its own `rng.split(slot)` stream.
- `src/game/zorlings/palette.ts` — `generatePalette` from `typeColors` (dark mood: near-black desaturated body, glowing accent + eyes per type; golems: stone) (+ per-type secondary/accent candidates, second type feeds the secondary), `makeRamp` (light/base/shade/deep + tinted outline, highlights warm, shadows cool), `FIXED` ramps (eye white, dark, flame).
- `src/game/zorlings/parts.ts` — shape builder (`Builder`, ramps, markings) and the part library; `build.ts` — `buildZorling(genome)` and the classic plans (quadruped, serpent, avian, blob, biped); `plans-wild.ts` — feline, canine, dragon, bat, raptor, insect, fish, golem, plus spread wings (`membraneWing`: arm/finger bones + scalloped membrane; `featherWing`: primaries fanning from the wrist). Part builders: ears (pointy, round, long, fin, tuft), horns (single, pair, curved, antlers, nubs), tails (thin, fluffy, flame, fin, leaf, club, bolt), back (spikes, plates, sail, leaves, crystals, mane), wings (feather, membrane), markings (spots, stripes, mask, socks, tip) + belly, snout (short, long, beak).
- `src/game/zorlings/render.ts` — `renderZorling(genome, { size })`: fits the model into the square (feet on the bottom, 1-px outline margin), part lines only at ≥ 48 px, eye stamps (round/big/fierce/sleepy/slit/glow; a 1×2 bean when tiny), mouth stamps (smile/fang/fangs/open). Fitting uses `tightBounds` (sampled), because primitive bounds of intersections/lenses are loose. `SPRITE_SIZE = { battle: 96, overworld: 32 }`.
- Lab: `src/lab/sections/zorlings.ts` (+ CSS), placeholder removed from `upcoming.ts`.
- Tests: `sdf-sprite.test.ts`, `zorlings.test.ts`, HSL tests in `color.test.ts` (21 new; 196 total).

## Decisions
- **Decision:** Rasterize distance fields directly to the pixel grid in pure TS, instead of drawing SVG and pixelating it on a canvas (the C07 logo path).
  - **Why:** canvas anti-aliasing and SVG rendering differ between browsers, so "same genome → same pixels" could not be guaranteed or tested in Node. The pure path gives exact bytes everywhere, per-part shading (normals from the distance field), clean part lines and stamped eyes. Rendering all 48 sprites of the lab grid takes ~140 ms in Chrome.
  - **Alternatives considered:** SVG + `pixelateSvg` (non-deterministic, no per-part control); hand-drawn pixel parts composited (much more art authoring, less variety).
- **Decision:** Eyes and mouths are pixel stamps, not shapes.
  - **Why:** they are what makes a sprite read as a creature; at 32 px a shape-based eye vanishes or turns into mush. Stamps are drawn per size (full eye with ring, pupil and glint at 96; a 1×2 bean at 32).
- **Decision:** 3/4 side view facing right; one eye for quadruped/serpent/avian, two for blob/biped. Enemy sprites are `flipX` of the same sprite.
- **Decision:** Each Zorling is fitted to fill its sprite square. Size differences between species/stages come later (C09 evolution stages, Titans 128×128).
- **Decision:** Shading = pillow-like normals from each shape's distance field, 4 tones, light from the upper left. Ramps are hue-shifted (highlights toward yellow, shadows toward blue/purple), outlines are a very dark tint of the part color.
- **Decision:** Genome stores base colors (hex numbers), not palette indices.
  - **Why:** simple for pack data and lets C09 shinies swap a palette without touching parts. Ramps are derived at render time.
- **Decision:** Avians always get feather wings; flames always use fixed bright flame colors.
  - **Why:** bat wings on birds and flames in dark secondary colors (brown, charcoal) looked broken in the previews.

- **Decision (review round 2, user feedback "more unique, some scary/dark, no bat/dragon/hawk, cat more realistic"):** 8 more body plans (13 total) and a `mood` gene.
  - **Why:** 5 plans gave too little variety and everything was cute. Mood is a separate gene, so any plan can be cute or menacing; it drives eyes (slit/glow), fangs, head size and the palette (dark = near-black body + glowing type color).
  - **Alternatives considered:** more parts on the 5 plans (can't make a bat or dragon silhouette); separate "scary" species list (less reuse).

## Deviations from plan / design
- None in scope. Genome lives in `src/game/zorlings/` (a game system); species genomes will be pack data from C12 on, validated by `zorlingGenomeSchema`.

## Issues & known limitations
Round 2 (after the 8 new plans and moods): bats, dragons, fish, beetles/bees and golems read clearly; dark Zorlings look menacing. Rough: raptor wings are small; cat/dog legs are a bit boxy; the near dragon wing covers much of the body; some dark-mood cute plans still roll white eyes. Lab grid render went from ~140 ms to ~300 ms (tight-bounds sampling) — fine for now, cache sprites per genome later.

Round 1 assessment (from preview sheets of ~200 random Zorlings, original 5 plans):
- **Good:** blobs and bipeds are consistently cute and read instantly; avians are clean and bird-like; quadrupeds read well (fox/deer/bear/rhino-like variety). Type identity comes through color and type parts (flames, fins, leaves, crystals, bolts). 32×32 versions stay recognizable as the same creature.
- **OK:** serpents read as humped sea serpents, but the coil can look lumpy and the neck is always the same "Nessie" pose. Worth a second pass (more curve variety, proper coiling) in C09 or after G1.
- **Weak:** membrane (bat) wings are crude; some part combinations crowd the head (horns + crest + ears); antlers are thin and a bit twiggy; masks are simple bands; at 32 px dense markings (stripes/spots) get noisy. No silhouette checks yet, so an occasional combo looks off (e.g. a long thin tail on a blob).
- Some Zorlings look same-y within a plan (proportion ranges are fairly narrow); more body variants per plan (e.g. long-neck quadruped, upright serpent) would help.
- Not an issue of this chunk but noticed: on `/lab/#section` the hash jump uses smooth scrolling, so in headless Chrome lazy sections may not render until scrolled.
- The engine still draws in CSS pixels; Zorlings are shown in the lab on canvases. The 480×270 virtual screen (C07 follow-up) is still pending.

## Verification
- `npm run check` — typecheck, lint, format, **196 tests**: all pass.
- Tests cover: distance primitives, coverage/shading/outline/part lines/stamps, determinism (`spriteHash` equal for repeat renders and after a JSON round-trip of the genome), every plan × 12 seeds at 96 and 32 (fills the frame, feet down, non-empty), pixel-art palette limits (opaque only, ≤ 40 colors), every part kind reachable, schema validation.
- Preview sheets rendered in Node (scratchpad contact sheets) for each body plan, per type and per mood; iterated over two review rounds with the user.
- Browser (headless Chrome, dev server, `/lab/`): 24 cards render; keyboard Tab + Enter selects a card and updates the detail; type and body-plan filters apply to all 24; Randomize re-renders in ~140 ms; no console errors.
- Done when:
  - Lab shows a grid of 24 random Zorlings: ✅
  - Same genome always renders identically: ✅ (unit-tested with pixel hashes; pure code, no canvas)
  - Log includes honest assessment of quality: ✅ (above)

## Follow-ups
- C09: rig needs parts grouped per limb/head/tail — `buildZorling` already tags shapes with groups and z; expose part ids for transforms. Evolution stages: scale proportions/part sizes from one genome. Shiny: alternate palette from the genome seed.
- C09/G1: serpent pose variety, better membrane wings, part-crowding rules on the head, per-plan body variants, silhouette sanity checks.
- C10: Pixi texture from `PixelSprite` (nearest scale mode) for the battle mock.
- C12: species data carries a `zorlingGenomeSchema` genome.
- Engine: 480×270 virtual screen (still pending from C07).

## Notes for the next chunk
- `renderZorling(genome, { size })` → `PixelSprite` (RGBA bytes); `spriteToCanvas` for DOM; `flipX` for enemies.
- `buildZorling(genome)` returns the shape model (shapes with z/group/ramp, eye and mouth specs) — the starting point for the C09 rig.
- Preview sheets in Node: a vitest run with path aliases can render contact sheets without a browser (see this log's verification).
