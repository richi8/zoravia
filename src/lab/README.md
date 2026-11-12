# Style lab

Second Vite page at `/lab/` (`lab/index.html` → `src/lab/main.ts`): a living reference for
brand, tokens, UI kit, Zorling generator, biome tiles and the battle mock. Its code is reused
by the game; the lab only displays it.

Add a section: create `sections/<name>.ts` exporting a `LabSection` (`id`, `title`, `chunk`,
`ready`, `render(el)`), then list it in `SECTIONS` in `main.ts` (replace the matching
placeholder in `sections/upcoming.ts`). Sections render lazily when scrolled near.
Styling uses the token CSS variables (`--z-…`, from `src/game/style/css.ts`).
