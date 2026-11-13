# C25 · Music & ambience — Log

- **Date:** 2026-11-13
- **Status:** done
- **Depends on:** C24

## Summary
The game now has music and ambience. A step sequencer in the engine plays looping songs written as plain data, with crossfades. A seeded composer builds each biome's field and battle music from a style (key, mode, tempo, instruments, patterns). Packs can add hand-written music in a short text format, and a boss can name one as its theme. The core Titan and legendary each have one. Each biome also has ambience: continuous beds plus occasional sounds, with a rain layer in wet weather. The overworld, battles and launcher choose what plays. The lab has a "Music & ambience" board with a piano roll.

## What was built
- **Engine** (`src/engine/audio/`), content-free:
  - `song.ts` (pure):
    - Types: `Song`, `SongTrack`, `SongNote`, and `Instrument`, a list of tone templates a note fills in.
    - Helpers: `noteSpec`, `indexSong`, `stepTime` (swing), `songProblems`.
    - Text formats: `parseNotes` reads `"E4:2! G4:1 B4 | C4+E4+G4:8 . F4?"`: note names, `+` chords, `.` rests, `:n` lengths that carry on, `!`/`?` accents, `|` bar marks. `parseHits` reads drum lines (`"x..xo..."`). `loopNotes` repeats a short track to fill the loop. `noteNumber` reads one note name.
  - `music-player.ts`: `MusicPlayer`.
    - Notes are scheduled 0.25 s ahead on the audio clock by a 40 ms timer. While the tab is hidden it schedules 1.6 s ahead, and a timer that fell behind skips ahead instead of playing a burst.
    - Each song plays on its own gain "deck", which allows crossfades. The player remembers each song's position and resumes it from the start of that bar (`restart` overrides this).
    - Other features: `setLevel` (ducking), a 40-voice cap separate from effects, and starting on unlock when a song was asked for earlier.
    - `renderSong` renders a song offline.
  - `ambience.ts`: `Ambience` = layers.
    - `bed`: looping noise or a tone, filtered, with a slow swell and a filter sweep.
    - `events`: random short sounds with pitch, gain and pan ranges, and optional bursts. Timing is seeded.
    - `AmbiencePlayer` has the same crossfade and level controls as the music player.
  - `audio-engine.ts`: exports `scheduleSpec` (a spec at an exact time into any node) and `longNoiseBuffer` (5 s, for beds).
- **Game** (`src/game/audio/music/`):
  - `instruments.ts`: 27 presets.
    - Leads: flute, ocarina, reed, square lead, brass, bell, strings.
    - Chords: pads, harp, pluck, oud, celesta, organ.
    - Bass: three basses.
    - Drums: kick, snare, hat, shaker, clap, tom, timpani, doum/tek hand drum, chime.
    - `MUSIC_MIX` sets the overall music level.
  - `compose.ts`: `composeSong(id, arrangement, seed?)`.
    - Form: A B A′ C for the field (8-bar sections, C is a break without melody) and A B for battle.
    - Melody: a 2-bar motif, the same motif moved onto the next chords, a new idea, then a cadence. Rhythms come from calm or busy cell libraries. Strong beats land on chord tones, and a leap is followed by a step back. A′ repeats A's motif. The loop ends on the tonic.
    - Accompaniment: pads (held or stabs); bass patterns (roots, walk, pulse, octaves, gallop, drone); arpeggios; one-bar drum lines; section fills.
  - `styles.ts`: `BIOME_MUSIC` (field and battle arrangement per biome) and `bossArrangement` (lower, slower, harmonic minor, brass, strings, timpani).
  - `themes.ts`: `themeSong(content, id)` turns a pack `music` entry into a `Song` (cached).
  - `ambience.ts`: `biomeAmbience(biome, weather)`. Forest, desert and frozen layers, and rain for `core:wet`.
  - `director.ts`: `fieldSong`, `battleSong`, `bossSong` and `battleMusic(content, { biome, boss })` (a boss's theme, else composed boss music).
- **Service** (`src/game/audio/sound.ts`, `scene-audio.ts`):
  - `sound.ts`: `playMusic`, `stopMusic`, `setMusicLevel`, `playAmbience`, `stopAmbience`, `setAmbienceLevel`, `stopAllMusic`, `currentMusic` and `currentAmbience`.
  - `scene-audio.ts`, one place for what scenes sound like:
    - `fieldAudio(biome)`: the field song, 1.5 s fade, resumed.
    - `battleAudio(content, { biome, boss, weather })`: battle music from the top with a 0.4 s crossfade, and the ambience at 35 %.
    - `battleOverAudio()`: the music fades out in 0.35 s for the jingle.
- **Data:**
  - `src/game/data/music.ts`: the `music` registry (bpm, grid, bars, swing, gain, tracks of `notes` or `hits`, transpose, gain, pan). Its check parses every line and reports bad tokens (with the token number). A track's length must divide the loop.
  - `bosses` got an optional `theme` reference.
  - `packs/core/music.ts`: two hand-written 8-bar themes.
    - **Wrath of the Titan:** E minor, 150 bpm, brass over strings, a pulse bass, timpani and drums with a tom fill.
    - **The White Crown:** D minor, 108 bpm, strings over bell arpeggios and a glass pad.
  - The core Thornwing Titan and Glacivar use them.
- **Scenes:**
  - Overworld: plays the biome's field music and ambience on enter and on return from a battle. It passes the map's biome to the battle.
  - `BattleScene`: has a `biome` option (default forest). It starts the music on enter and stops it on the `end` event.
  - Launcher: is quiet when you come back to it, and has a new **"Battle place"** option (Forest / Volcanic / Frozen) for the battle music and ambience of its test battles.
- **Lab** (`src/lab/sections/music.ts`, `/lab/#music`):
  - Per biome: Field, Battle, Boss (composed), Ambience and Ambience + rain.
  - The pack themes, Stop buttons, a now-playing line and a piano roll.
  - Clicking another song crossfades, as in the game.
- **Tests** (17 new, **590 total**):
  - `src/engine/audio/song.test.ts` (7): note names, the melody format, errors with token positions, drum lines, looping, swing timing, indexing and problems, note → tones.
  - `src/game/audio/music.test.ts` (10):
    - Every biome's field, battle and boss song is well formed, in range and unique.
    - Composing is deterministic and the seed matters. Field songs are long and calm, battle songs fast and short.
    - The melody stays in the key, A′ repeats A, and the loop ends on the tonic. The biomes differ.
    - Core themes load and fill their loop, and their bar marks sit on bar lines. A boss gets its theme, or composed music without one.
    - The registry rejects bad notes, bad lengths, `notes`+`hits` together, and an unknown theme.
    - Ambience layers and the rain layer.

## Decisions
- **Decision:** Songs are data played by a look-ahead step sequencer, with notes rendered through the C24 tone synth (`scheduleSpec`).
  - **Why:** music and effects share one synth, songs can be tested in Node, and the lab can render them offline. Timing comes from the audio clock, not frames.
  - **Alternatives considered:** a tracker library, or rendering each loop to a buffer once. Rendering is simpler to play, but costs seconds of CPU and megabytes per song and makes crossfading positions awkward.
- **Decision:** Procedural music is composed once per biome (seeded by its id), not live and endless.
  - **Why:** "static, hand-curated world players get attached to": a place should have a recognizable theme. Endless variation sounds aimless. A 80–107 s field loop with an A B A′ C form is long enough not to tire.
  - **Alternatives considered:** a fresh melody each loop. Rejected as above.
- **Decision:** Hand-written music is a pack registry (`music`), and bosses point to it with `theme`.
  - **Why:** story pieces (C27/C30) can reuse it. The note format is short enough to write by hand and reads in a diff. The check catches typos with a token position.
  - **Alternatives considered:** inline themes in the boss entry. Rejected because two bosses couldn't share one, and it is harder to reuse for story scenes.
- **Decision:** Instruments are named presets in the game (`INSTRUMENT_IDS`), not defined in packs.
  - **Why:** packs stay simple and the mix stays balanced. A pack can't add a harsh instrument at full volume. Adding a preset is a one-line change.
- **Decision:** Biome music styles and ambience live in `src/game/audio/music/`, next to `world/biomes.ts`, not in packs.
  - **Why:** biomes themselves aren't pack data yet (`biomes.ts` says "interim home"). Styles move together with biomes when that happens.
- **Decision:** Field music resumes at the bar where it stopped; battle music restarts.
  - **Why:** coming back from a fight into the middle of the same tune feels continuous. A battle should open with its intro energy.
- **Decision:** When a battle is decided, the music fades out in 0.35 s and the existing victory/defeat jingle plays alone. There is no separate stinger system.
  - **Why:** the C24 jingles already are the stingers (the C24 follow-up suggested reusing them). Fading under them was enough.
- **Decision:** Levels were set by measurement. `MUSIC_MIX` = 0.33, per-arrangement gains, and ambience levels per biome.
  - **Why:** measured before the fix, music was ~3× louder than effects. Now music RMS is 0.035–0.045 with peaks ≤ 0.32 (a hit is 0.045 RMS, 0.46 peak). Ambience is 0.011–0.013 per biome and 0.016 with rain.
- **Decision:** No preview round with the user before coding.
  - **Why:** the user asked to review all sounds (C24 and C25) together after this phase. The lab board is the listening page, and every style, instrument and theme is a small data edit.

## Deviations from plan / design
- DESIGN.md updated (Visual & audio direction → Audio). The new rules are: each biome's field and battle themes and their character; boss themes from packs with a composed fallback; field music resumes and battle music restarts; music stops for the end jingle; ambience layers, quieter in battle and following the music volume.
- "Each biome has music": only the forest can be walked (the test region). Desert and frozen field music and ambience are heard in the lab. Their battle music can also be heard in real battles through the launcher's new "Battle place" option.
- The map format has no per-zone music or ambience override. Region maps (C28) may want one (a cave, a town theme).

## Issues & known limitations
- **I could not listen to any of it** (headless Chrome, no speakers). What I checked:
  - every song renders to finite, non-clipping audio at even levels;
  - the right song and ambience play in each scene;
  - transitions overlap with no gap.

  Whether it is *pleasant* needs your ears (`/lab/#music`).
- The composer gives the melody a clear shape (motif, sequence, cadence), but it is still rule-based. Some phrases may wander. Changing a field's seed or style is a one-line edit in `styles.ts`.
- Hand-written themes are 8 bars (13–18 s), so a long boss fight repeats them often. Longer themes are just more bars in `packs/core/music.ts`.
- A hidden tab keeps playing music. Scheduling covers the throttled 1 s timer, so it shouldn't stutter, but this was not tested (headless Chrome can't hide a tab the same way).
- Ambience events are seeded per ambience id, so each visit hears the same birds at the same times after the fade-in. This is unlikely to be noticed.
- **Pre-existing bug (not C25):** pressing confirm several times quickly in the debug launcher pushes several battle scenes. The menu keeps taking input during the push transition. I confirmed it with C25 stashed. The launcher is replaced in C33.

## Verification
- `npm run check`: typecheck, lint, format, **590 tests (55 files)**: all pass.
- Browser (headless Chrome via CDP, dev server, keyboard only). Analysers were attached to the music and ambience buses.
  - **Offline render** (16 s each) of 9 composed songs and 2 themes: no NaN, levels as above. The first measurement showed music ~3× too loud, which led to `MUSIC_MIX`.
  - **Launcher:**
    - Silent at start.
    - Wild battle: `battle:forest` + `forest` ambience at 35 %.
    - The battle's end event stopped the music. Back in the launcher, everything was silent.
  - **Overworld** (Play → slot):
    - `field:forest` + `forest` ambience.
    - Walked into a wild encounter. The trace showed battle music taking over during the transition, with no silent gap.
    - After winning, the field song faded back in.
    - The longest near-silent stretch while music was on was 160 ms, inside the fade-in.
  - **Bosses:** Titan → `theme:core:titan-theme`. Glacivar → `theme:core:glacivar-theme`. A trainer battle → `battle:forest`.
  - **Battle place = Volcanic,** rain battle: `battle:desert` + `desert+core:wet`.
  - **Ambience measured live:**
    - Before levelling: forest 0.006, desert 0.010, frozen 0.005, rain alone 0.024.
    - After: 0.011 / 0.012 / 0.012, forest + rain 0.016.
  - Found and fixed during the check:
    - Pads held only 80 % of a note, which left a gap between chords; they now overlap.
    - The forest battle's chord stabs moved from the pad to the organ, so they stay short.
  - **Lab:** 17 buttons, the piano roll and the now-playing line. Screenshots reviewed.
  - No console errors or warnings.
- Done when:
  - "Each biome and battle has music": ✅
    - Field and battle music for forest, desert and frozen, and boss music (2 hand-written themes plus a composed fallback per biome).
    - Tests cover all of them, and the right one plays in each scene in the browser.
  - "Transitions are seamless": ✅
    - Crossfades on every change. Field music resumes at the bar.
    - The RMS trace showed no gap at field → battle, and only the intended fade at battle end → jingle → field.

## Follow-ups
- **User:** listen to everything in `/lab/#sound` and `/lab/#music`, and in a real battle and the test region. To tune:
  - styles: `src/game/audio/music/styles.ts`
  - instruments: `instruments.ts`
  - boss themes: `packs/core/music.ts`
  - ambience: `music/ambience.ts`
- **C27/C30:** use the `music` registry for trial, rival and story themes. Each needs a way to request one (a quest/dialogue action `playMusic`).
- **C28:** optional per-zone or per-anchor music and ambience overrides in the map format (town theme, caves). The overworld then calls `fieldAudio` with the zone's choice.
- **C32:** duck the music under the center heal and evolution jingles (`setMusicLevel`). Also a short victory fanfare loop during the XP text, and a low-HP music change.
- **C33:** title music; mute when the tab is hidden (a setting); a separate ambience volume slider if wanted. Also the launcher's multi-push on repeated confirm (see Issues), if the launcher survives.
- **C34/C35:** when biome data moves to packs, move `BIOME_MUSIC` and the ambience layers with it.

## Notes for the next chunk
- What a scene sounds like is set in one place: `src/game/audio/scene-audio.ts` (`fieldAudio`, `battleAudio`, `battleOverAudio`). Use `playMusic(song, { fade, restart })` / `stopAllMusic()` for anything else.
- A hand-written piece: add it to a pack's `music` (format documented in `src/game/data/music.ts`) and play `themeSong(content, id)`. Give a boss one with `theme: 'pack:id'`.
- `BattleScene` takes `biome`. New battle call sites should pass the map's biome.
- Music levels: keep a new piece's offline RMS near 0.04 (`renderSong` in the browser). `MUSIC_MIX` applies to every song.
