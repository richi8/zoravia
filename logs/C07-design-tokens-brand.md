# C07 · Design tokens & brand — Log

- **Date:** 2026-11-12
- **Status:** done
- **Depends on:** C04 (also uses C06's `UiTheme` hook)

## Summary
Zoravia now has a visual identity in code: one token file (colors incl. the 8 type and 8 condition colors, typography, spacing, radii, borders, motion), two bundled fonts (Fredoka for display, Nunito for UI), and a code-generated logo (wordmark + emblem, dark and light variants) that also serves as the favicon. The tokens feed the Pixi UI theme, the game boot, and CSS variables for DOM pages. A new style lab at `/lab/` shows the brand, palette, type/condition colors, fonts, spacing, motion and a live, themed copy of the C06 UI demo, plus placeholders for C08–C11.

## What was built
- `src/engine/core/color.ts` — `toRgb/fromRgb/toCss/parseHex/toCssRgba`, `mix/lighten/darken`, WCAG `luminance/contrastRatio/readableOn`, Lab + `deltaE` (perceptual distance).
- `src/engine/core/easing.ts` — named easings (`linear`, `quad*`, `cubic*`, `backOut`) + `EASINGS` map; both exported from `@engine/core` as `color` / `easing`.
- `src/game/style/tokens.ts` — `ink` (11-step cool-indigo neutral scale), `brand` (lagoon teal, sunbeam gold, ember coral, logo gradient), `semantic` (success/warning/danger/info, HP high/mid/low, XP, shiny, titan, boss aura, reaction), `surface` + `lightSurface`, `typeColors` and `conditionColors` (keyed by core ids, each with an `on` text color), `fonts`, `fontSize`, `fontWeight`, `lineHeight`, `space`, `radius`, `borderWidth`, `motion` (durations in seconds, easing roles, dialog text speed).
- `src/game/style/theme.ts` — `createUiTheme()` / `ZORAVIA_THEME` (C06 `UiTheme` from tokens).
- `src/game/style/css.ts` — `tokensToCssVars()` / `tokensToCss()` / `installCssVars()` (`--z-ink-900`, `--z-type-fire`, `--z-space-md`, …).
- `src/game/style/fonts.ts` — imports `@fontsource-variable/fredoka` + `@fontsource-variable/nunito`, `loadFonts()` (waits for the faces, 3 s timeout → system fallback).
- `src/game/brand/logo.ts` — `logoSvg({ variant, height })`, `emblemSvg({ variant, size })`, `logoSize()`, `svgDataUrl()`, `installFavicon()`.
- `src/main.ts` — game boot now installs CSS vars + favicon, awaits fonts, uses the token background and `ZORAVIA_THEME`.
- Style lab: `lab/index.html` (second Vite entry, added to `build.rollupOptions.input`), `src/lab/main.ts` (sticky header with logo, section nav with scroll-spy, lazy section rendering), `src/lab/lab.css` (only token variables), `src/lab/dom.ts` (`h()`, `svg()`, `LabSection`), `src/lab/sections/` — `brand`, `palette`, `types` (types + conditions), `typography`, `layout`, `motion`, `ui-theme` (live Pixi), `upcoming` (C08–C11 placeholders).
- Tests: `color.test.ts`, `easing.test.ts`, `game/style/tokens.test.ts`, `game/brand/logo.test.ts` (27 new; 169 total).

## Decisions
- **Decision:** Fonts: **Fredoka** (display) + **Nunito** (UI), variable versions via `@fontsource-variable`, bundled by Vite.
  - **Why:** rounded and friendly to match the light tone and creature theme; Nunito stays readable at 12–14 px and has full Latin-Ext (Czech diacritics checked). Both SIL OFL. Bundled (not Google Fonts CDN) so the game works offline and loads no third-party resources. Split by `unicode-range`, so only needed subsets download (~25–40 kB each).
  - **Alternatives considered:** system fonts only (no identity, varies per OS); pixel fonts (clash with the smooth-shaded 64–96 px Zorlings in DESIGN.md); drawing a font in code (huge effort, worse readability). The "no external assets" rule covers images and audio; fonts are not generated in code — flag for G1 if that should be stricter.
- **Decision:** The logo is pure SVG geometry (stroke-built letters with round caps), not text in a font.
  - **Why:** renders identically everywhere (DOM, favicon, future Pixi texture) with no font loading; fully "generated in code". The O is the emblem: three petals for the three launch regions (green forest/lakes, ember volcanic, ice frozen coast).
- **Decision:** Dark UI as the default (`surface` = ink scale), `lightSurface` only for the light logo and light presentations.
  - **Why:** type/condition colors and VFX pop on dark; matches the C06 placeholder look.
- **Decision:** Contrast and distinctness are unit-tested, not just eyeballed: UI text ≥ 7:1 / dim text ≥ 4.5:1 on all surfaces, cursor and title text ≥ 4.5:1, every badge/chip label ≥ 4.5:1 on its color, type colors pairwise ΔE > 20, condition colors ΔE > 15, type/condition colors ≥ 3:1 against the panel (Muddy excepted: dark by nature, always labelled).
  - **Why:** accessibility (C37) starts here; future token tweaks can't silently break readability.
- **Decision:** Wind = lavender (`#b39dff`), Metal = steel grey, Ice = pale cyan, Nature = green.
  - **Why:** a mint/white Wind collided with Nature and Ice; lavender keeps all 8 clearly distinct. Easy to change at G1.
- **Decision:** Type/condition colors live in game tokens keyed by core ids (`fire`, `burning`, …), not in the engine.
  - **Why:** the engine holds no content. When C12 adds type/condition data to `packs/core`, the pack should reference these colors (or carry its own for new packs) — see Follow-ups.
- **Decision:** `/lab/` is a second Vite HTML page (`lab/index.html`), DOM-based, with Pixi embedded where needed.
  - **Why:** palettes/specimens are simplest in HTML; Pixi sections (UI preview now, Zorlings later) mount an `Engine` into a section. The live preview only captures keyboard input while focused, so the page still scrolls with arrows/Space.
- **Decision:** Motion durations are seconds (engine unit); easing roles (`enter`, `exit`, `move`, `pop`) name functions in `@engine/core/easing`.

## Deviations from plan / design
- Added `src/engine/core/color.ts` and `easing.ts` (generic helpers the tokens and later chunks need). No `DESIGN.md` change.
- Favicon added (was a C37 follow-up; trivial once the emblem existed).

## Issues & known limitations
- The emblem at 16 px is mostly the gold ring; petals are barely visible. Fine as a favicon; a simplified small-size emblem could come later.
- Hebrew/Cyrillic/Vietnamese font subsets are also emitted into `dist/` (fontsource CSS); browsers don't download them unless needed. Could trim by importing only the Latin CSS files.
- The lab's "UI theme (live)" re-uses the C06 demo scene; real game UI components arrive in C10.
- `Menu` cursor marker uses `accent` (gold) on the teal cursor — reads well but is decorative only (no contrast requirement).
- Logo has no Pixi texture helper yet (title screen is C33); `svgDataUrl()` + an `Image` is all it needs.

## Verification
- `npm run check` — typecheck, lint, format, **169 tests**: all pass. `npm run build` succeeds (outputs `dist/index.html` + `dist/lab/index.html`, fonts bundled).
- Browser (headless Chrome via puppeteer-core in the session scratchpad, dev server):
  - `/lab/`: every section rendered and screenshotted (brand, palette, types, conditions, typography, layout, motion, UI theme, placeholders). Fonts loaded: Fredoka Variable 300–700, Nunito Variable 200–1000. No console errors or failed requests.
  - Logo dark + light variants and emblem at 128/64/32/16 px look as intended.
  - Live UI preview: focus → `S`, `E` opened the Bag grid; `Q`, `S`, `E` opened the typed "Guide" dialog — all in Nunito with the token colors. After blur, ArrowDown scrolls the page again (input released).
  - Motion: the `backOut` dot overshoots past the end and settles (measured).
  - Game `/`: themed demo, data-URL SVG favicon set, 60.0 fps, max frame 16.8 ms, 0 slow frames.
- Done when:
  - `/lab` shows palette: ✅
  - …type colors: ✅ (plus condition colors)
  - …fonts: ✅
  - …logo: ✅ (dark + light, emblem)

## Follow-ups
- C08: use `typeColors[type].base` as the palette seed for type-driven Zorling palettes; add the Zorling section to the lab (replace the placeholder in `sections/upcoming.ts`).
- C10: type badges, condition chips/icons and HP/XP bars in Pixi from these tokens (`semantic.hp*`, `typeColors`, `conditionColors`), menu open/close motion with `motion.duration` + easing roles.
- C12: type/condition schemas get a `color` field; `packs/core` fills it from these tokens (or the tokens read it from the pack) so new packs can add types with colors.
- C33: title screen logo as a Pixi texture from `svgDataUrl(logoSvg())`.
- C37: trim unused font subsets; recheck contrast in an accessibility pass.
- G1: review palette (esp. Wind = lavender), fonts, and logo.

## Notes for the next chunk
- Import tokens from `@game/style/tokens`, the theme from `@game/style/theme` (`ZORAVIA_THEME`). Never hard-code colors; add a token instead.
- Call `await loadFonts()` before creating Pixi `Text` in any new entry point (Pixi measures on creation).
- Color math: `import { mix, lighten, darken, contrastRatio, deltaE } from '@engine/core/color'`.
- Lab: `npm run dev` → `http://localhost:5173/lab/`. A Pixi section can follow `sections/ui-theme.ts` (own `Engine` in a fixed-height div).

---

## Addendum — logo iteration & pixel-art direction (review, 2026-11-12)

### Summary
The user reviewed the first logo and asked for iterations. Twelve rounds of previews were made **outside the repo** (session scratchpad + a private preview page republished each round), so no prototype code landed in the game. Directions tried: matured/metallic versions of the original, box-art treatments with world elements, single-color deck-box foil stamps, a world/forest line, full-color scenes, front-facing and profile dragons, and finally a dragon crest after reference esports-style logos. The user then sketched a concept with Nano Banana; it was rebuilt in code (one dragon, the sketch had two) and accepted as the current logo, to be revisited later.

### What changed in the repo
- `src/game/brand/logo.ts` — rewritten: dragon crest (`logoSvg({ crop: 'full' | 'emblem', height, id })`), `LOGO_PIXEL_OPTIONS`, `installFavicon` (head crop). Each call takes an `id` prefix so several logos can share a page (clip paths).
- `src/game/brand/glyphs.ts` — small stroke-letter kit (`UPPER`, `layoutWord`, `piecePaths`) used by the name.
- `src/engine/render/pixelate.ts` — generic vector → pixel-art step: `quantizePixels` (pure: snap to palette, alpha threshold, pattern texture) and `pixelateSvg` (browser canvas). Tests in `pixelate.test.ts`.
- `src/game/style/tokens.ts` — `logoColors` (navy, rust ×3, teal ×3, gold ×3, cream, white): the logo's colors and the fixed palette of its pixel version; exported as `--z-logo-*` CSS variables.
- Lab "Brand & logo" shows the pixel logo (400 / 260 px wide, night + light), the smooth source, and the favicon crop; the lab header uses the new logo.
- `DESIGN.md` — Presentation now says **pixel art**; base resolution added to Open. `IMPLEMENTATION_PLAN.md` C08 deliverable updated accordingly.

### Decisions
- **Decision:** The game's look is pixel art (user, after the Zorling style test: smooth vs pixel at 64/48/32 px and battle mocks at 240×160 / 480×270).
  - **Why:** the user preferred it. Generating shapes in code and pixelating them keeps the "all graphics generated in code" rule and lets one source produce every size.
  - **Open:** base resolution / sprite size — must be decided before C08.
- **Decision:** Logo concept from the user's AI sketch, but rebuilt as code geometry, not imported as an image.
  - **Why:** `CLAUDE.md` requires code-generated graphics; the code version is recolorable, scalable and produces the favicon and pixel versions from one source.
  - **Trade-off:** less organic than the sketch (geometric head and pose, procedural scale texture). The user accepted it as a first version.
- **Decision:** Exploration happens as image previews before touching the repo (user request).

### Issues & known limitations
- The previous logo, its light/dark variants and `emblemSvg` were removed; the logo no longer uses the Fredoka/Nunito-era brand colors (it has its own `logoColors`). UI tokens/theme are unchanged and may need a pixel-art pass (fonts, palette) once the resolution is fixed.
- Scale texture also lands on the rust wing bones (same palette color) — acceptable for now.
- At 16 px the favicon is mostly the head's silhouette.

### Verification
- `npm run check` — typecheck, lint, format, 175 tests: all pass.
- Browser (headless Chrome, dev server): lab Brand section renders 4 pixel canvases (400×235, 400×235, 260×153, 32×32) plus smooth/emblem SVGs; game favicon is the head crop (decodes 150×150); no console errors.

### Follow-ups
- Before C08: pick base resolution + sprite size; consider a pixel font for UI (C10).
- Later: revisit the logo (more organic head/pose, hand-tuned pixels), title-screen usage (C33).
