# C01 · Project setup — Log

- **Date:** 2026-11-12
- **Status:** done
- **Depends on:** —

## Summary
Empty, strictly configured Vite + TypeScript project with ESLint, Prettier and Vitest. Folder layout, path aliases, and the `dev | build | test | check` scripts are in place. A blank page renders and `npm run check` passes with one sample test.

## What was built
- `package.json` scripts: `dev`, `build`, `preview`, `test`, `test:watch`, `typecheck`, `lint`, `format`, `format:check`, `check`.
- `tsconfig.json` (browser code: `src`, `packs`, `tests`) and `tsconfig.node.json` (Node-side: `tools`, `vite.config.ts`).
- `vite.config.ts` — aliases `@engine`, `@game`, `@lab`, `@packs`; Vitest config (node environment).
- `eslint.config.js` — flat config, `typescript-eslint` strict, `eslint-config-prettier`.
- `.prettierrc.json`, `.prettierignore`, `.editorconfig`.
- `index.html` + `src/main.ts` — blank dark page titled "Zoravia".
- Folders: `src/engine`, `src/game`, `src/lab`, `packs/core`, `tools` (short READMEs as placeholders).
- Sample test: `src/engine/index.test.ts`.
- `README.md` with commands and layout.

## Decisions
- **Decision:** Very strict TS (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `noImplicitOverride`).
  - **Why:** Catch bugs early in a codebase built across many AI sessions; deterministic battle logic benefits from explicit undefined handling.
  - **Alternatives considered:** plain `strict` only — cheaper now, but tightening later is painful.
- **Decision:** Two tsconfigs; browser config has no Node types.
  - **Why:** prevents `process`/`fs` from leaking into game code (verified: `process.env` in `src/` fails typecheck).
  - **Alternatives considered:** one config with `@types/node` everywhere — simpler but lets Node APIs slip into the bundle.
- **Decision:** `npm run check` = typecheck + lint + **format check** + tests.
  - **Why:** the plan says typecheck + lint + tests; adding Prettier check keeps diffs clean across sessions. Run `npm run format` to fix.
- **Decision:** ESLint rule forbidding `pixi.js` imports in `src/engine/battle/**` and `src/game/battle/logic/**`.
  - **Why:** enforces the "battle logic stays pure" rule mechanically. Paths are a guess at the future layout — C14 should adjust them if it uses a different folder.
- **Decision:** Markdown is excluded from Prettier.
  - **Why:** avoids reformatting the hand-written design docs and tables.
- **Decision:** No PixiJS / Zod installed yet.
  - **Why:** out of scope; C04 adds PixiJS, C03 adds Zod.

## Deviations from plan / design
None. (Extra: `format:check` in `check`, `.editorconfig`.)

## Issues & known limitations
- `npm audit` reports a moderate advisory (minimatch ReDoS) through `eslint`/`typescript-eslint`. Dev-only tooling, not shipped; the suggested fix downgrades ESLint to 9, so left as-is. Re-check when typescript-eslint updates.
- Tool versions are very new (Vite 8, Vitest 5, ESLint 10, TypeScript 6). TS 6 deprecates `baseUrl`, so `paths` use `./`-relative entries instead.
- `src/lab` has no route yet — `/lab` arrives in C07.

## Verification
- `npm run check` — typecheck (both configs), lint, format check, 1 test: all pass.
- `npm run build` — builds `dist/` successfully.
- `npm run dev` — dev server serves `index.html` (title "Zoravia") and `src/main.ts` (HTTP 200). Checked with curl, not visually in a browser; the page is intentionally blank.
- Done when:
  - Blank page renders in browser: ✅ (dev server + build verified; blank by design)
  - `npm run check` passes with one sample test: ✅

## Follow-ups
- C04: add PixiJS; decide whether `/lab` is a second Vite HTML entry (`lab/index.html`) or an in-app route.
- C14: confirm or adjust the battle-purity ESLint paths in `eslint.config.js`.
- Optional: CI workflow running `npm run check` (not requested yet).

## Notes for the next chunk
- C02 (core utilities) goes in `src/engine/` (e.g. `src/engine/core/`); put tests next to the code as `*.test.ts`.
- Import with aliases (`@engine/...`). `verbatimModuleSyntax` is on — use `import type` for type-only imports (lint enforces it).
- `noUncheckedIndexedAccess` is on: array/record indexing returns `T | undefined`.
