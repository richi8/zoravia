# C09 · Zorling rig & animation, variants — Log

- **Date:** 2026-11-12
- **Status:** done
- **Depends on:** C08

## Summary
Zorlings are rigged and animated. Shapes carry a bone (body, head, tail, wingFar, wingNear), a pose turns/moves/squashes bones, and every animation frame is rasterized fresh at pixel size (true pixel art, no rotated bitmaps). Clips: idle (breathe or hover, head bob, tail wag, wing flap, blink), attack lunge, hurt (flash, squeezed eyes, knockback) and faint (droop, sink, fade). Evolution stages (1/2/3) are derived from one genome, the final form, and Titans are bulkier, 128×128, with a pulsing aura. The lab has a "Rig & animation" section.

## What was built
- `src/engine/render/rig.ts` — pure 2D rig: `Affine`, `Bone`/`Rig`, `BonePose`/`Pose`, `boneMatrices` (hierarchy, pivots, cycle check), `transformPrimitive` (inverse-transformed distance field, bounds), `transformShape` (per-pixel ramps keep local coordinates, so markings move with the part), `poseModel`.
- `src/engine/render/sdf-sprite.ts` — `Shape.bone`; `silhouette` (hit flash); `aura` (1-px rings, optionally dithered, `parity` for pulsing).
- `src/game/zorlings/parts.ts` — `Builder.bone` / `setBone`, `BONES`, `ZorlingModel.rig`; eyes and mouth go on `head` when the plan has a separate head. `addTail`/`addWings` put their shapes on their own bones.
- `build.ts`, `plans-wild.ts` — head bones for quadruped, serpent, biped, feline/canine, dragon, insect, golem; inline tails (avian/raptor fans, feline thin tail, fish fin) and wings (membrane/feather/insect) on bones. Blob, avian, bat, raptor and fish heads are part of the body blob, so they have no head bone.
- `src/game/zorlings/render.ts` — `ZorlingRenderer` (rest-pose framing computed once; `frame({ pose, eyes })`; `pad`, `fill`, `anchor`), eye states `open | closed | squeeze`, `fitView(b, size, fill)`.
- `src/game/zorlings/animate.ts` — `CLIP_NAMES`, `clipSpecs` (poses + offsets per frame; motion amplitudes in pixels, scaled to the size), `animateZorling(genome, { size, fill, pad, titan, clips })` → frames with `dx/dy` (sprite px), `alpha`, `ms`.
- `src/game/zorlings/variants.ts` — `stageGrowth`, `stageFill`, `stageGenome`, `titanGenome`, `TITAN_SIZE`.
- `src/game/zorlings/palette.ts` — `glowColor(type)` export.
- Lab: `src/lab/sections/animation.ts` (seed/type/plan/stage-count controls, idle/attack/hurt/faint buttons, stages + Titan + overworld animated), CSS; the C09 placeholder removed.
- Tests: `rig.test.ts` (8), `animate.test.ts` (11) — 221 total.

## Decisions
- **Decision:** Animate by posing the distance-field model and re-rasterizing each frame, not by transforming sprites in Pixi.
  - **Why:** rotated/scaled bitmaps break the pixel grid (mixels, jaggy outlines). Re-rasterizing keeps 1-px outlines, shading bands and stamped eyes crisp in every frame. Whole-sprite moves (lunge, knockback, sink) are whole-pixel `dx/dy` offsets and `alpha` that the presentation layer applies.
  - **Alternatives considered:** Pixi container transforms on part sprites (blurry/aliased at pixel scale, seams between parts).
- **Decision:** Fixed framing per Zorling (rest pose), plus transparent padding (~17% of size) for motion; `anchor` = ground point between the feet.
- **Decision:** A species line stores one genome: the final form. Earlier stages are derived (bigger head, shorter limbs, rounder body, adult horns/spikes/fangs softened or removed, fierce → cute for babies, smaller in the frame: 60% / 82% / 100%). Plan, palette, tail, ears and markings stay, so the line reads as one creature.
- **Decision:** Hovering plans (bat, fish, winged insect) bob instead of breathing; the front-facing bat mirrors its wing flap.
- **Decision:** Titan aura = solid 1-px ring + dithered 1-px ring in the type's glow color; the dithered ring pulses with the idle loop. User approved the strength.
- **Decision (user review): drop shiny variants.**
  - **Why:** a shiny is just a recolor, and a recolored Zorling can look like another type (e.g. a fire fox turned teal reads as Water); type identity is carried by color. A hue-rotation `shinyGenome` was built for the preview and removed.

## Deviations from plan / design
- Shiny palette deliverable dropped (user decision). `DESIGN.md` updated (Creatures: no shiny variants; removed from V1 list), `IMPLEMENTATION_PLAN.md` updated (C09 deliverables/done-when, C13 "shiny roll" removed), `semantic.shiny` token removed.

## Issues & known limitations
- Cost: ~9 ms per frame at 96 (+padding); all four clips (~33 frames) ≈ 0.3 s per Zorling. The lab renders clips lazily. Battles (C18) should cache per genome or render in idle time / a worker.
- Plans whose head is merged into the body (blob, avian, bat, raptor, fish) only move as a whole; no head bob.
- Legs have no bones: leaning rotates the whole body about the feet, and squash slightly stretches legs (invisible at 1–2 px).
- Distance under non-uniform scale is approximate (√det); fine for the mild squash used.
- Model polish from C08 (raptor wings, boxy cat legs, dragon near wing, serpents) is still open for G1.

## Verification
- `npm run check` — typecheck, lint, format, **221 tests**: all pass.
- Tests cover: affine math, pivots and parenting, scale about the ground, cycle/unknown-bone errors, rotated distance exactness, rest pose = unposed pixels, pose determinism, silhouette/aura pixels; every plan has a valid rig; rest frame = still sprite; every plan × every clip renders with stable hashes after a JSON round-trip; idle varies, attack lunges, hurt flashes/recoils, faint fades to 0; padding keeps every frame off the edges; Titan size and aura; stage growth/fill and baby rules; smaller early stages.
- Preview page (scratchpad, published for review) with 6 lines × stages/shiny/Titan/overworld, all clips; user approved motion and Titan glow, dropped shiny.
- Browser (headless Chrome, dev server, `/lab/`): Rig & animation section renders 3 stages, Titan with aura, overworld sprite; no console errors.
- Done when:
  - Lab shows a full 3-stage line animated: ✅
  - plus Titan version: ✅ (shiny dropped by the user)

## Follow-ups
- C10/C18: Pixi textures from frames (nearest), frame player honoring `ms`, `dx/dy`, `alpha`, battle speed; enemy side = `flipX` of each frame (negate `dx`).
- C18: frame cache per genome; render non-idle clips lazily or off the main thread.
- C12/C13: species data carries the final-form genome + stage count; evolution uses `stageGenome`. Titan mark uses `titanGenome` (+ aura only in boss form).
- C20: walk cycle (needs leg bones) for overworld sprites.
- G1: head bones for merged-head plans; C08 model polish list.

## Notes for the next chunk
- `animateZorling(genome, opts).clips.idle.frames[i]` → `{ sprite, dx, dy, alpha, ms }`; place the sprite so `anchor` sits on the ground point.
- For early stages pass `fill: stageFill(stageGrowth(stage, of))` together with `stageGenome(g, stage, of)`.
- `ZorlingRenderer` gives single posed frames if a scene needs custom poses.
