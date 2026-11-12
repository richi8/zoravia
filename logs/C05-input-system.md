# C05 · Input system — Log

- **Date:** 2026-11-12
- **Status:** done
- **Depends on:** C04

## Summary
A keyboard-first, context-sensitive input system. The engine provides a bindings data model (with conflict detection, rebinding and a serializable profile), an `InputManager` that samples per fixed step with a context stack, menu auto-repeat and optional mouse, and a DOM adapter. The game declares its actions, contexts and the default bindings from `DESIGN.md`. `W A S D`/arrows are movement in the `overworld` context and navigation in `menu`/`battle` contexts.

## What was built
- `src/engine/input/bindings.ts` — `Bindings<A>`: `keysFor`, `actionsForKey`, `conflicts()`, `rebind(action, slot, key | null, 'reject' | 'steal' | 'swap')`, `reset`, `toProfile`/`loadProfile` (Zod-validated, overrides only, versioned), `onChange`.
- `src/engine/input/input-manager.ts` — `InputManager<A>`: raw `keyDown/keyUp/releaseAll/pointer*`; `update(dt)` per step; `pushContext` (returns remover) / `popContext` / `setContexts`; queries `held`, `pressed`, `released`, `repeated`, `heldTime`, `consume`, `direction`, `rawPressed`, `pointer`.
- `src/engine/input/dom.ts` — `attachDomInput(input, { pointerTarget })`: keyboard on window, pointer on canvas, `preventDefault` for keys bound in the active context, ignores form fields and Ctrl/Cmd shortcuts, releases on blur.
- `src/engine/input/key-labels.ts` — `keyLabel(code)` for prompts / future rebinding UI.
- `src/game/input/actions.ts` — actions, contexts (`overworld`, `menu`, `battle`, `dialog`), global `debug_overlay`, `DEFAULT_BINDINGS`, `createBindings()`, `createInput()`.
- `src/engine/render/engine.ts` — `addPreUpdate(fn)` (runs before scenes each step); the temporary raw F3 listener from C04 was removed.
- `src/main.ts` — uses the input system: `confirm` / left click toggles placeholder scenes, `debug_overlay` (F3) toggles the overlay.
- Tests: `input-manager.test.ts` (engine), `actions.test.ts` (game bindings) — 29 new.

## Decisions
- **Decision:** Separate actions per context (`move_up` vs `nav_up`) bound to the same keys, instead of one action reinterpreted per context.
  - **Why:** each context's meaning is explicit; players can rebind movement and menu navigation independently. Conflicts are only reported when two actions can be active at once.
- **Decision:** Only the top context is live (plus global actions).
  - **Why:** menus are modal in this game; it makes "WASD moves *or* navigates" exact.
- **Decision:** Keys held during a context change are suppressed until released.
  - **Why:** the `E` that opens a dialog must not also count as "hold E to speed up", and a held `W` must not scroll a just-opened menu.
- **Decision:** Input is sampled in the fixed step with buffered edges; auto-repeat is ours (0.35 s delay, 0.08 s interval), OS repeat is ignored.
  - **Why:** deterministic, testable, and frame-rate independent; sub-frame taps are not lost.
- **Decision:** `KeyboardEvent.code` (physical keys).
  - **Why:** WASD keeps its shape on AZERTY/QWERTZ; letter shortcuts (I, M, …) can be rebound.
- **Decision:** `run` action bound to Shift.
  - **Why:** DESIGN.md lists running shoes but no key; Shift is the convention. Not added to DESIGN.md's key table yet — confirm at G1/C33.
- **Decision:** `Esc` is `pause` in the overworld and `back` in menus (no conflict since they never share a context), per DESIGN.md.
- **Decision:** Mouse buttons are bindable codes (`Mouse0`…); pointer position tracked for C06/C20.
  - **Why:** mouse stays optional and goes through the same machinery.

## Deviations from plan / design
- Added the `run` action (Shift) — implied by "running shoes", key not in DESIGN.md.
- Added a `dialog` context (`confirm`, `back`) for text boxes.

## Issues & known limitations
- No persistence of the profile yet (settings storage arrives with saves/settings, C23/C33).
- No gamepad (DESIGN.md: later).
- The overworld has no `hotbar1-3` binding (DESIGN.md mentions `1 2 3` only in battle).
- Clicks are exposed as raw `Mouse0` presses; hit-testing menu items is C06's job.

## Verification
- `npm run check` — typecheck, lint, format, 124 tests: all pass.
- Browser (headless Chrome, real DOM events): E, Enter, Space and a left click each toggled the scene; W did nothing in the `menu` context (no action bound there that changes scenes); F3 toggled the overlay; after `rebind('confirm', 0, 'KeyX')` at runtime, X toggled the scene; Space didn't scroll the page; no page errors.
- Done when:
  - Tests show WASD maps to movement in overworld context and navigation in menu context: ✅ (`actions.test.ts`, all WASD + arrows, plus context switch mid-hold)
  - Rebinding a key works: ✅ (rebind + immediate effect, conflict reject/steal/swap, profile round-trip)

## Follow-ups
- C06: menus should read `repeated(nav_*)`, `pressed(confirm/back)`, and use pointer position + `rawPressed('Mouse0')` (or Pixi pointer events) for mouse.
- C20: overworld movement via `input.direction(MOVE_DIRECTIONS)` and `held('run')`.
- C23/C33: persist `bindings.toProfile()`; rebinding UI can use `rebind(..., 'swap')` and `keyLabel`.
- G1/C33: confirm Shift for running and add it to DESIGN.md's controls table.

## Notes for the next chunk
- Create with `createInput()` from `@game/input/actions`, attach with `attachDomInput(input, { pointerTarget: engine.app.canvas })`, and call `input.update(dt)` in `engine.addPreUpdate` before reading it.
- Push a context when opening a menu and call the returned remover when closing it.
