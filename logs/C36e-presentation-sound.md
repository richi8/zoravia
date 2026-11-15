# C36e · Presentation & sound polish — Log

- **Date:** 2026-11-15
- **Status:** done
- **Depends on:** C36d

## Summary
Battles now use a backdrop for their biome. Emberwaste has "Ember dusk" and Rimeholm has "Aurora pines", and danger zones draw theirs in a darker dusk-violet tone. Titans and legendaries stand in their lairs at 48 px, with a glow or the legendary shine. New sounds: a low-HP sting with muffled battle music, dialogue text blips pitched per speaker, and overworld cries panned with their place on screen. Every key hint now shows the player's current key. The user picked the backdrops, the danger tone and the boss size from a preview round.

## What was built
- **Battle backdrops** (`src/game/battle/scene/backdrop.ts`):
  - `drawBackdrop(g, w, h, { biome, danger })` draws forest (unchanged from C10), desert ("Ember dusk": violet-orange sky, a volcano with a glowing crater, a lava streak and smoke, basalt ridges, ground with ember cracks) or frozen ("Aurora pines": night sky, two aurora ribbons with dithered curtains, stars, far hills, a pine line with snowy tips, a sparkly snowfield).
  - Shared pieces: `sky`, `ridge`, `ground` and `pads`. The drawing only uses `rect` and `fill` through a small `Painter` interface, so tests paint into a grid.
  - `dangerTone(c)` desaturates a color by 30 %, then mixes it 42 % toward `0x2a1d44`. A danger backdrop wraps the painter so every fill goes through it.
  - `BattleSceneOptions.danger` is set by the overworld when the player stands in a `danger`-tier zone. The biome was already passed.
- **Titans and legendaries in the overworld:**
  - `lairLook(content, species)` (`src/game/zorlings/lair-look.ts`, pure) renders the battle look (the Titan genome, or the legendary's) at `LAIR_SIZE` 48 with a 4 px pad.
    - A Titan gets one frame with a dithered aura in its type's glow color.
    - A legendary gets `LAIR_FRAMES` (12) frames of `shine`, so its sparkles twinkle.
  - `OverworldScene.lairDrawable` draws every NPC with a `zorling` (lair Titans, shrine legendaries and Elder Titans) with these frames at 8 fps. The feet stay on its tile, and the shadow is wider.
- **Low HP** (`src/game/battle/scene/low-hp.ts`, `battle-scene.ts`):
  - `isLowHp(hp, max)` means alive and under ¼ of max HP.
  - `BattleScene.lowHpCue` runs from `refreshHud`. When the active Zorling turns low, it plays `battle.lowHp` (two falling square pulses) once and sets the music tone to `tense`. When it is no longer low (healed, switched or fainted), the tone goes back to `normal`. Nothing changes after the battle's `end` event.
  - `MusicPlayer.setLowpass(hz)` (`src/engine/audio/music-player.ts`) adds a lowpass filter between the player's level gain and its bus. `setMusicTone('tense' | 'normal')` (`sound.ts`) glides it to 1100 Hz or to fully open (`OPEN_HZ`).
  - The title, field, battle start and battle end audio all reset the tone to `normal`.
- **Text blips:**
  - `DialogOptions.onType(revealed)` (`src/engine/ui/dialog-box.ts`) is called with the characters the typewriter revealed by itself. It is not called for a page skip or a page turn.
  - `src/game/audio/blip.ts`:
    - `speakerPitch(name)` is an FNV hash of the name mapped to ×0.75–1.35.
    - `BlipCounter` blips on every third letter or digit, and a burst blips once.
  - `playBlip(pitch)` plays `world.blip` (a 28 ms triangle) on the SFX bus, throttled to one every 45 ms.
  - `OverworldScene.say` turns blips on when there is a speaker and the speaker is not a Zorling NPC.
- **Overworld cries:**
  - `screenPan(x, width)` (`scene-audio.ts`) gives ±0.8 at the screen edges.
  - `OverworldScene.cryAt(species, mover, boss?)` plays `speciesCry` with that pan at gain 0.8.
  - A roamer cries once when its state becomes `chase`, if it is on screen. The scene tracks this in the `chasing` set.
  - A Zorling NPC cries in its boss voice (`titan` or `legendary`) when the player talks to it.
- **Key hints** (`src/game/input/key-hint.ts`):
  - `keyHint(action)` returns the first keyboard key bound to the action, as `keyLabel` shows it. `keysHint(...)` joins several ("W/S", "1/2/3", and "WASD" when four single letters).
  - `upDownHint`, `leftRightHint` and `navHint` cover the navigation keys.
  - `main.ts` installs the live bindings. Before that (tests, lab), the defaults are used.
  - Replaced every spelled-out key:
    - the overworld help line (built every frame);
    - the title hint (on layout);
    - the battle bar side and log, and the result panel;
    - the battle captions "Press 1…" and "Press I…";
    - the bag, shop, dex, party (its slot numbers too), storage, slot, start, keys and map window hints, and the map window's detail text;
    - the settings help for text speed and the switch prompt. Help can now be a function, so it follows rebinding.
- **Tests** (880 in total, 87 files):
  - `backdrop.test.ts`: each biome covers the screen at 480×270 and 640×360, the biomes look different, danger is the same shapes in `dangerTone`, and the tone is darker.
  - `lair-look.test.ts`: Titan size and frame, the legendary's twinkle loop, purity.
  - `c36e-audio.test.ts`: `isLowHp`, the sting and blip specs, speaker pitch range and stability, blip counting, `screenPan`.
  - `key-hint.test.ts`: defaults, a rebound key and nav key, mouse keys skipped, arrows.

## Decisions
- **Decision:** the low-HP music change is a lowpass muffle, not a tempo or song change.
  - **Why:** it is subtle, it works for every song (biome, boss and composed) without new music data, and it glides back without a seam.
  - **Alternatives considered:** a heartbeat layer or a faster tempo. Both need per-song work and are easy to make annoying.
- **Decision:** blips come from the typewriter's own reveal, every third letter.
  - **Why:** holding `E` speeds the text up 5×, and the throttle plus counting keeps that from turning into a buzz. Skipping a page (`Q`) makes no sound.
- **Decision:** Zorling NPCs (Titans, legendaries, Elders) have no blips. They cry instead.
  - **Why:** a cry and blips on top of each other sound muddy, and a Titan's lines read as narration about it.
- **Decision:** Elder Titans in danger zones use the same 48 px lair look.
  - **Why:** they are drawn from the `zorling` NPC field like the lairs, and they are Titans.
- **Decision:** the 48 px Titan glow is static. Only the legendary's sparkles animate.
  - **Why:** this is what the user approved in the preview. A flickering dithered ring at overworld scale looked noisy.
- **Decision:** key hints read the bindings when a panel is built, not live.
  - **Why:** keys change only in Settings → Controls, and every panel is built when it opens. The overworld help line and the title hint are refreshed every frame or on layout, because they stay on screen while the keys panel is used.

## Deviations from plan / design
- `DESIGN.md` updated:
  - Presentation: the 48 px lair size, and a new "Battle backdrops" bullet.
  - Audio: low HP, text blips and overworld cries.
  - Controls: hints follow the bindings.
- The plan said "danger zones may get a darker variant". The user chose yes.
- Battle captions stay without blips. The plan names dialogue text only, and battle captions are timed.

## Issues & known limitations
- The keys-panel note "Esc cancels" and its `Esc` hint stay literal. Escape is fixed for capture and can't be rebound.
- The pre-existing `RangeError` in `TerrainRenderer.draw` on resize showed again in headless Chrome (each CDP reconnect resizes the viewport). It is not from this chunk, and it is still listed for C38.
- The lowpass is checked by hand only (the unit tests have no Web Audio). The browser check confirmed the low-HP state and the sting, not the filter's sound.
- A roamer that starts chasing off screen doesn't cry, and it won't cry later when it comes into view during that chase.

## Verification
- `npm run check`: typecheck, lint, format and tests all pass (87 files, 880 tests).
- Preview round (scratchpad renderer + published page): the user picked Emberwaste B "Ember dusk", Rimeholm B "Aurora pines", the darker danger tone, and 48 px for Titans and legendaries.
- Headless Chrome on `vite` (960×540, scratch `cdp.mjs`, `audio.play` wrapped to log sounds):
  - Emberwaste (36, 151): the Dunewyrm Titan draws at 48 px with its glow, about three tiles tall next to the player.
  - Talking to it played one cry (pan 0, the player centered) and no blips.
  - A wild Dustwhirl that chased the player cried (pan 0.175). Its battle showed the Ember dusk backdrop, and the battle bar reads "I Items · Q Run · L Log · 1/2/3 Switch".
  - Rimeholm danger tile (69, 211), lead at 4/25 HP: the battle had `danger: true` and `biome: frozen`, and drew the dark Aurora pines backdrop. `lowHp` was true and `battle.lowHp` played once.
  - Talking to Picnicker Nell played 8 blips in 0.8 s.
  - Rebinding confirm to `K` changed the help line to "WASD move · K talk · click to walk · Esc menu".
- Done when:
  - The user picked the backgrounds and boss size, and each biome's battles use its background: ✅ (preview answers, browser in desert and frozen).
  - Titans and legendaries stand out in the overworld: ✅ (48 px, glow and shine; screenshot).
  - The low-HP sting, text blips and overworld cries play, each following its volume: ✅ (all on the SFX bus; the muffle is on the music player).
  - Rebinding a key changes every hint that shows it: ✅ (`key-hint.test.ts`, browser help line; every `KeyHint` call reads the bindings).
  - Everything stays keyboard-playable: ✅ (no input changes).

## Follow-ups
- C38: the `TerrainRenderer` resize `RangeError` (from C36d).
- A roamer could cry when it first comes into view mid-chase.
- Battle captions could get a single soft tick per caption if the user misses blips there.

## Notes for the next chunk
- C37 (seamless world): `BattleScene` takes `biome` and `danger` from the zone under the player. With merged regions, take the biome from the region at the player's tile, not from the map.
- New on-screen keys should use `keyHint(action)` from `@game/input/key-hint`, never a literal letter.
- Scratch files in this session's scratchpad: `bd.ts` and `prev.ts` (the preview renderer), `prev/` (the preview page and images), `cdp.mjs`, and the `a.json`–`i.json` browser steps.
