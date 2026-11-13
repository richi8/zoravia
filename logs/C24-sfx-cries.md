# C24 · SFX & cries — Log

- **Date:** 2026-11-13
- **Status:** done
- **Depends on:** C18

## Summary
The game now has sound. A small Web Audio synth in the engine plays sounds described as plain data (`SoundSpec`). The game has 52 synthesized effects: UI, one launch sound per type, hits, reactions, capture, jingles and overworld sounds. Every Zorling gets a cry built from its genome, so a species always sounds the same. Menus, dialogs, panels, the battle scene and the overworld all play sounds. Master, music and effects volumes are in a Sound menu (launcher and pause menu) and are kept in `localStorage`. The lab has a sound board with every effect and cry.

## What was built
- **Engine audio** (`src/engine/audio/`), content-free:
  - `spec.ts`: `SoundSpec` / `Tone` (wave or noise, pitch curve, attack/hold/decay envelope, filter sweep, vibrato, detune, pan), `specDuration`, `scaleSpec` (pitch, time, gain), `sequence`, `midiHz`, `clampFreq`.
  - `audio-engine.ts`: `AudioEngine`. Buses `sfx`, `music` and `ambience` feed `master`, and volume maps to gain as v². `attachUnlock` creates the context on the first key press or click. It has per-key throttling and a 48-voice cap. `renderSpec` renders a spec offline (lab waveforms, browser checks). Frequencies are clamped to the context's Nyquist frequency.
- **UI sound hook** (`src/engine/ui/ui-sound.ts`): `uiSound('move' | 'select' | 'back' | 'blocked' | 'open' | 'advance')` and `setUiSoundSink`.
  - Wired into `Menu` (move, select, back, blocked click), `DialogBox` (next page), `InspectWidget` (open, move, close).
  - Also wired into the game panels: bag, party, storage, Dex, shop.
- **Game audio** (`src/game/audio/`):
  - `sfx.ts`: the `SFX` table and `SfxId`. Groups:
    - `ui.*`
    - `move.<type>` for the 8 types, plus `move.status`
    - `battle.*`: hit / strong / weak, miss, fumble, skipped, reaction, Armor break / restore, condition, blocked, status tick, heal, status ended, send-out, switch-out, faint, subdued, item, throw, absorb, drop, wobble, caught, break free, run, victory, defeat, level up, learned
    - `world.*`: encounter, battle start, bump, heal, buy, save, evolve
  - `cry.ts`: `cryFor(genome, { boss })`, pure and seeded from the genome. `speciesCry(content, id, { boss, titanMark })` is cached per content and uses `battleLook`, so a Titan in boss form gets the deeper cry.
  - `settings.ts`: `AudioSettings` (Zod schema with defaults), `loadAudioSettings` / `saveAudioSettings` (key `zoravia:audio`), `stepVolume`, `formatVolume`.
  - `sound.ts`: the sound service. It has `installAudio`, `playSfx`, `playSpec`, `setVolume` and `audioSettings`, and it installs the UI sink. Before `installAudio`, every call is a no-op.
- **Battle** (`src/game/battle/present/sounds.ts`, pure):
  - `eventCues(content, shown, event)` gives the sounds of each event kind. The switch is exhaustive.
  - `progressCue` covers level up, learned, move offer and evolved.
  - The scene plays them:
    - A move sounds when its VFX launches, and every other event when it is shown.
    - Cries are panned to their side, and a faint plays the cry low and slow.
    - The capture animation plays absorb, drop, one sound per wobble, then caught or break free.
    - A blocked `1 2 3` switch or an item that can't be used plays `ui.blocked`.
- **Overworld:**
  - Bumps are throttled. The encounter "!" and the battle-start whoosh play; the whoosh is in `battleTransition`, so every battle gets it.
  - Center heal, shop purchases (or "can't afford"), manual save.
  - Evolution: a 3 s rising sweep and jingle, then the new form's cry.
- **Volume menu** (`src/game/ui/volume-menu.ts`): `VolumeMenu`. W/S choose, A/D change, E steps up (100 % wraps to Off). It is in the launcher ("Sound", the hint shows the master volume) and in the pause menu ("Sound").
- **`main.ts`**: creates the `AudioEngine`, unlocks it on the first gesture, and loads the settings from `localStorage`. `audio` is on the dev handle.
- **Lab** (`src/lab/sections/sound.ts`): a "Sound" section. Every effect and every core species cry (with its sprite) is shown with its waveform, and a click plays it. It also has the two boss forms and 12 random genomes (with a reroll button).
- **Tests** (15 new, **573 total**):
  - `src/engine/audio/audio.test.ts` (4): spec helpers, and the engine is silent without Web Audio.
  - `src/game/audio/audio.test.ts` (8):
    - The same species always gives the same cry, and every core species sounds different.
    - Every cry is valid and ≤ 1.6 s, for core species and 200 random genomes.
    - Final forms and Titans sound deeper. Avian sounds far higher than golem.
    - Every effect is valid, and UI sounds are < 0.2 s.
    - Settings round-trip, fall back when broken, and step in tenths.
  - `src/game/battle/present/sounds.test.ts` (3):
    - 26 AI-played battles (trainer, wild, rain, Titan with capture, legendary). Every event that isn't a turn marker has a cue, and every cue is a real effect.
    - Send-out and faint cries. The hit sound follows effectiveness.
    - Progress cues.

## Decisions
- **Decision:** Sounds are plain data (`SoundSpec`) played by a small synth, not code that builds Web Audio graphs per sound.
  - **Why:** specs can be tested in Node (valid ranges, lengths, determinism), scaled (pitch for faints, stretch), shown in the lab and rendered offline. The engine stays content-free.
  - **Alternatives considered:** a library (ZzFX-style parameter arrays). Rejected: less readable, and noise and filter sweeps are clumsy in it.
- **Decision:** The game reaches audio through a module-level service (`playSfx`) and the UI through a sink (`uiSound`). Audio is not passed through scene options.
  - **Why:** sounds come from many places (menus, panels, battle, overworld, transitions). Threading an engine through every constructor would touch ~20 signatures for no gain. With nothing installed (tests, lab), the calls do nothing.
- **Decision:** The `AudioContext` is created on the first key press or click. Sounds before that are dropped.
  - **Why:** browsers block audio until a gesture, and Chrome warns when a context is created earlier. The game opens on a menu, so the first input unlocks it before any sound matters.
- **Decision:** Cries are derived from the genome of `battleLook`, not stored in packs.
  - **Why:** "same species → same cry" then holds by construction (the look is already deterministic per species), pack authors get cries for free, and stages differ (bigger stages sound deeper). A pack could add a cry override later if one ever needs a hand-made sound.
- **Decision:** A move's sound plays when its VFX launches; a hit plays on the `damage` event (the impact).
  - **Why:** sound in step with the animation. `eventCues` stays pure and the scene picks the moment.
- **Decision:** Turn markers (`turnStart`, `turnEnd`, `replaceNeeded`) are silent. A battle that ends by running or catching has no end jingle.
  - **Why:** they aren't actions. "Ran" and "caught" already have their own sounds just before the end.
- **Decision:** Volume settings live in `localStorage` under `zoravia:audio`, not in save slots.
  - **Why:** the C23 follow-up ("settings saved separately from slots"). A device setting shouldn't change when you switch playthroughs.
- **Decision:** The music slider exists now and drives both the `music` and `ambience` buses.
  - **Why:** C25 only has to connect to the buses. Its arrow keys preview a tick on the music bus.
- **Decision:** Autosave is silent. Only a manual Save plays the chime.
  - **Why:** autosave runs every 30 s and after battles. A chime each time would be noise.
- **Decision:** No preview round with the user before coding.
  - **Why:** the "previews first" rule is about visual direction. For sound, the lab board is the listening page, and changing a sound is a one-line edit in `sfx.ts`.

## Deviations from plan / design
- DESIGN.md updated (Visual & audio direction → Audio): how cries are built, "every battle and UI action has a sound, turn markers are silent", and volume settings belong to the device. These are new rules, not changes.
- The plan only asked for "volume settings". The Sound menu is in the launcher and the pause menu until the settings screen (C33), which can reuse `VolumeMenu`.
- The battle-start whoosh is in `battleTransition` (a render module) rather than at each call site, so the launcher and the overworld can't diverge.

## Issues & known limitations
- **Nothing was listened to by me.** Headless Chrome has no speakers. I checked that every sound renders to finite, non-silent audio (offline peak and RMS), and that the expected sounds fire in order during real key-driven play. Whether they sound *good* needs the user's ears: use the lab's Sound section (`/lab/#sound`).
- Levels were balanced by measured peak and RMS, not by ear. Big moments (strong hit, Armor break, heal jingle) are louder on purpose.
- No text blips while dialog types (only a tick when the page turns). It could be a juice option (C32).
- Cries of the same plan and mood share a contour shape. The seed varies pitch, syllables and lengths, but two cute avians still sound related. That is intended (a "family" sound) but may need more variety once Region 1 has ~40 species (C29).
- The lab renders lazily on scroll. The Sound section is last, so scrolling straight to it can leave it empty until the sections above it have rendered (an existing lab behavior).
- A sound played before the first key press is dropped (by design). The first `ui.move` comes from the unlocking key itself, so nothing audible is lost in practice.

## Verification
- `npm run check`: typecheck, lint, format, **573 tests (53 files)**: all pass.
- Browser (headless Chrome, dev server, 960×540 at DPR 2, keyboard only). `AudioEngine.play` was wrapped to log each sound by id:
  - First key press → context `running`. The menu move, select and back sounds play.
  - **Wild battle by keys to the end (won):** the sequence was:
    - battle start, send-out and cry (both sides)
    - `move.water` / `move.status` on launch, `battle.hit` on impact
    - `battle.conditionBlocked`, `ui.advance` per page
    - the faint cry, then `battle.faint`, then `battle.victory`
  - **Trainer battle (3 vs 3) by keys:**
    - moves of 4 types (fire, water, nature, electric)
    - hits at all three strengths, 2 reactions
    - conditions and status ticks, status ended, heal
    - switch-outs, 6 send-outs with cries, 2 faints
  - **Capture:** Items → Capture tab → Zorb played item, throw, absorb, drop, wobble, then break free.
  - **Overworld:** new game, then walked into things: bump, encounter "!", battle start. Pause menu → Sound panel. Save played `world.save`.
  - **Sound menu:** A/D changed master to 60 % and music to 80 %. `localStorage` held them, the engine's bus volumes matched, and they survived a reload.
  - **Offline render** of all 52 effects and all 10 species cries plus the Titan form: every one finite and non-silent. The 7 quietest (wind, miss, run, throw, battle start, send-out) were raised and Armor break was lowered after this measurement.
  - **Lab Sound section:** 76 buttons with waveforms and sprites. Screenshots reviewed.
  - Fixed during the check:
    - The lab's 8 kHz waveform renders logged "value outside nominal range" warnings. The engine now clamps frequencies to Nyquist, and the lab renders at 22 kHz.
    - The launcher's Sound panel covered the "Battles" title. It is now centered on the menu.
  - No console errors or warnings in the final runs.
- Done when:
  - "All battle and UI actions have sounds": ✅
    - `eventCues` is exhaustive over event kinds. A test plays 26 battles and checks that every non-marker event has a real cue.
    - Menus, dialogs, inspect, bag, party, storage, Dex, shop and volume all report through `uiSound`.
    - Confirmed in the browser by the sound log.
  - "Same species → same cry": ✅ (`audio.test.ts`: identical spec from a cloned genome, all core species distinct; cached per content.)

## Follow-ups
- **C25:**
  - Music and ambience connect to `audioEngine().bus('music' | 'ambience')` and `context`. The music volume already applies to both buses.
  - Add victory/defeat stingers that duck the battle music (the `battle.victory` / `battle.defeat` jingles exist and could be reused or replaced).
- **C29:** with ~40 species, listen through the cries in the lab. If same-plan species sound too alike, add per-species contour variation or an optional `cry` override in species data.
- **C32:** optional dialog text blips, a low-HP warning beep, a footstep/grass rustle, stereo pan following the actor's x.
- **C33:** the settings screen reuses `VolumeMenu`, plus a mute toggle.
- **User:** listen in the lab (`/lab/#sound`) and in a battle. Any sound can be tuned by editing its spec in `src/game/audio/sfx.ts`.

## Notes for the next chunk
- Play a sound: `playSfx('battle.hit', { gain, pitch, pan, delay })`, or `playSpec(spec, …)` for a custom spec. Add new effects to `SFX` in `src/game/audio/sfx.ts`. The tests check every entry is valid.
- A cry: `playSpec(speciesCry(content, speciesId, { boss, titanMark }))`.
- UI widgets call `uiSound(kind)` from `@engine/ui`, and the game maps it to `ui.<kind>`.
- The engine is `audioEngine()` (or `__zoravia.audio` in dev). `renderSpec(spec)` renders offline in the browser.
- A new battle event kind must get a case in `eventCues` (the switch is exhaustive, so TypeScript will ask).
