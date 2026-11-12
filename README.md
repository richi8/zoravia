# Zoravia

Browser monster-collecting RPG in TypeScript. The creatures are called **Zorlings**.
All graphics and audio are generated in code. See `DESIGN.md` (what the game is),
`IMPLEMENTATION_PLAN.md` (build order), and `PROGRESS.md` (status).

## Requirements
Node.js 22+ (developed on Node 24).

## Commands
| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Typecheck, then build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Run unit tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | TypeScript, browser code + Node-side config/tools |
| `npm run lint` | ESLint |
| `npm run format` / `format:check` | Prettier write / check |
| `npm run check` | typecheck + lint + format check + tests — run before every commit |

## Layout
```
src/engine/   generic, content-free engine systems
src/game/     Zoravia-specific wiring on top of the engine
src/lab/      style lab (/lab route, Phase 1)
packs/core/   the core content pack (the engine holds no content)
tools/        offline scripts (world generator, ...)
logs/         per-chunk work logs
```
Path aliases: `@engine/*`, `@game/*`, `@lab/*`, `@packs/*`.
Tests live next to code as `*.test.ts` (or under `tests/`).
