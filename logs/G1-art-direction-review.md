# G1 · Art direction review — Log

- **Date:** 2026-11-12
- **Status:** done
- **Depends on:** C07, C08, C08b, C09, C10, C11

## Summary
The user reviewed `/lab` during C07–C11 and approved the art direction as it is: "everything is ok as it is for now". No tweak chunks are needed before Phase 2. The open polish items from earlier chunks are kept as follow-ups.

## What was built
- Nothing. This is a review gate. Its outcome is this log.

## Decisions
- **Decision:** Pass G1 with no tweak chunks.
  - **Why:** The user had already reviewed each area while its chunk was being built: the logo (C07), the Zorling style and pixel scale (C08/C08b), animation (C09), the storybook UI and battle layout (C10), and the storybook-bright tiles (C11). They approved the current state.
  - **Alternatives considered:** Tweak chunks for the open polish items (below). Deferred: the user wants to move on and come back to them later.
- Directions confirmed: pixel art at 480×270, filling the window. Storybook paper UI with smooth text and tooltips. Storybook-bright tiles. Dragon-crest logo, to be revisited later.

## Deviations from plan / design
None. `DESIGN.md` is unchanged.

## Issues & known limitations
- The polish items below are still open. None of them blocks Phase 2.

## Verification
- The user confirmed in the session that the lab review was done during C07–C11 and that everything is OK for now.
- Done when (the user reviews `/lab`, feedback becomes tweak chunks, decisions are logged): ✅. The feedback was "no changes now", so there are no tweak chunks.

## Follow-ups
- Zorling models (C08/C09): raptor wings, blocky cat legs, the dragon's near wing, serpent pose variety, membrane wings, crowded head parts, more variety per body plan, and head bones for bodies where the head is part of the torso. Revisit when C18 or C29 touches the sprites.
- UI (C10): polish the Airborne, Exposed and Muddy icons. Check portrait readability at 32 px and text sizes at ×1. Revisit the battle layout after playtesting (C31).
- Tiles (C11): judge the tile scale against a player sprite (C20). Check lava brightness, tree cluster variety and prop variety (C28/C34).
- Logo (C07): the dragon crest is to be revisited, at the latest in C33 (title screen).

## Notes for the next chunk
- Phase 2 starts with C12 (core schemas & core pack v0). Art is frozen for now. Don't change the look without the user.
