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
| `npm run dev` | Start the Vite dev server (game at `/`, style lab at `/lab/`). In dev builds the title screen has a **Debug launcher** and `?demo` opens the UI demo; neither ships in a release |
| `npm run build` | Typecheck, rebuild region maps, then build the release (game only, relative paths, no source maps) to `dist/`. `ZORAVIA_LAB=1 npm run build` also builds the style lab, with source maps |
| `npm run preview` | Serve the production build |
| `npm run world -- <cmd>` | World tool: `gen`, `build`, `check`, `show` region maps (see `tools/README.md`) |
| `npm test` | Run unit tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | TypeScript, browser code + Node-side config/tools |
| `npm run lint` | ESLint |
| `npm run format` / `format:check` | Prettier write / check |
| `npm run check` | typecheck + lint + format check + tests — run before every commit |

## Release & deployment
The game is a static site. `.github/workflows/pages.yml` deploys it to **GitHub Pages** on every
push to `main` (or by hand from the Actions tab): `npm ci`, `npm run check`, `npm run build`,
then it publishes `dist/`. Asset paths are relative, so it works at `https://<user>.github.io/<repo>/`.

One-time setup:
1. Create a GitHub repository and push this one to it (`git remote add origin <url>`, `git push -u origin main`).
2. In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main`, or run the workflow from the Actions tab. The page URL shows on the run.

Before a public launch: finish the formal trademark check for "Zoravia" (EUIPO; USPTO
Class 9 & 41). See "Open" in `DESIGN.md`.

The version on the title screen is `GAME_VERSION` in `src/game/index.ts`; keep it equal to
`version` in `package.json` (a test checks).

## Layout
```
src/engine/   generic, content-free engine systems
src/game/     Zoravia-specific wiring on top of the engine
src/lab/      style lab (/lab/ page, Phase 1) — entry: lab/index.html
packs/core/   the core content pack (the engine holds no content)
tools/        offline scripts (world generator, ...)
logs/         per-chunk work logs
```
Path aliases: `@engine/*`, `@game/*`, `@lab/*`, `@packs/*`.
Tests live next to code as `*.test.ts` (or under `tests/`).
