# C02 · Core utilities — Log

- **Date:** 2026-11-12
- **Status:** done
- **Depends on:** C01

## Summary
Low-level building blocks in `src/engine/core/`: a seeded, splittable, serializable RNG; scalar + `Vec2` math helpers; a typed event bus; a scoped logger with sinks; and assertion helpers. All are content-free, have no DOM/Pixi dependencies (safe for the pure battle engine), and are covered by 52 unit tests.

## What was built
- `src/engine/core/rng.ts` — `Rng` (sfc32), seeds from number or string, `nextU32/next/float/int/chance/pick/weighted/shuffle`, `getState`/`Rng.fromState`/`clone`, `split(label)` for streams; `hashString` (FNV-1a + murmur3 finalizer).
- `src/engine/core/math.ts` — `clamp`, `clamp01`, `lerp`, `inverseLerp`, `remap`, `smoothstep`, `mod`, `approxEqual`, `roundTo`; immutable `Vec2` with `vec2`, `add`, `sub`, `scale`, `dot`, `length`, `distance`, `manhattan`, `normalize`, `lerpVec`, `equals`, `ZERO`.
- `src/engine/core/events.ts` — `EventBus<EventMap>` with `on` (returns unsubscribe), `once`, `off`, `emit`, `listenerCount`, `clear`.
- `src/engine/core/logger.ts` — `createLogger(scope)`, `.child()`, levels `debug|info|warn|error|silent`, `setLogLevel`, `addLogSink`, `setLogSinks`, `consoleSink`, `createMemorySink`.
- `src/engine/core/assert.ts` — `AssertionError`, `assert`, `assertDefined`, `defined`, `assertNever`, `unreachable`.
- `src/engine/core/index.ts` — barrel; math is exported as a namespace (`math.clamp`) to avoid generic names like `add`/`length` colliding.
- Tests: `*.test.ts` next to each module.

## Decisions
- **Decision:** sfc32 with plain `[a,b,c,d]` uint32 state.
  - **Why:** fast, good quality, and the state is JSON-safe so the battle state can carry it (`(state, action) → state + events`) and replays/saves resume exactly.
  - **Alternatives considered:** mulberry32 (single 32-bit state, weaker, short period); xoshiro128** (similar, no advantage); seedrandom library (extra dependency, opaque state).
- **Decision:** `split(label)` derives a child from the *current state + label* and does **not** advance the parent.
  - **Why:** adding a new stream later never shifts numbers in existing streams (tested), which keeps fixtures and replays stable as features grow.
  - **Alternatives considered:** fork-by-consuming (simpler but every new consumer shifts everyone downstream).
- **Decision:** `int()` uses rejection sampling.
  - **Why:** no modulo bias — matters for damage rolls/capture odds.
- **Decision:** Golden-value test for `Rng(12345)` and `hashString`.
  - **Why:** any accidental algorithm change would silently break saved seeds and replay tests; this makes it loud.
- **Decision:** Events without a payload are typed `undefined` (not `void`).
  - **Why:** lint rule `no-invalid-void-type` (strict config) rejects `void` in type maps; `undefined` works identically with `EmitArgs` (`emit('x')` takes no payload).
- **Decision:** Logger is global-configured (level + sinks), loggers are cheap scoped handles.
  - **Why:** one place to mute in tests or route to a future debug overlay. Default level is `debug` in Vite dev, `info` otherwise.

## Deviations from plan / design
None.

## Issues & known limitations
- `Rng` is a mutable class. Pure battle code must clone it or store `getState()` in state and rebuild — C14 should pick one pattern and stick with it (suggested: state holds `RngState`, reducer does `Rng.fromState(s.rng)` … `next.rng = rng.getState()`).
- Distribution tests are statistical with fixed seeds (deterministic, so not flaky), not rigorous randomness tests.

## Verification
- `npm run check` — typecheck, lint, format, 52 tests: all pass.
- Done when:
  - Same seed → same sequence: ✅ (numeric + string seeds, all helpers, state restore, golden values)
  - Event bus typed end-to-end: ✅ (`expectTypeOf` + `@ts-expect-error` cases for wrong name, wrong/missing payload, extra payload, wrong handler type — enforced by `tsc`)

## Follow-ups
- C04: route logger output to the debug overlay if useful.
- C14: adopt the `RngState`-in-state pattern above.

## Notes for the next chunk
- Import with `import { Rng, EventBus, createLogger, assert, math } from '@engine/core'`.
- Never use `Math.random()` in game logic.
- In tests that log, call `setLogSinks([])` or use `createMemorySink()` to keep output clean.
