import { AudioEngine } from '@engine/audio';
import { attachDomInput } from '@engine/input';
import { Engine } from '@engine/render/engine';
import { uiInputFrom } from '@engine/ui';
import { installAudio, loadAudioSettings, setMuted } from '@game/audio';
import { installFavicon } from '@game/brand/logo';
import { GAME_TITLE, GAME_VERSION } from '@game/index';
import { createInput } from '@game/input/actions';
import { loadGameContent } from '@game/data';
import { IndexedDbStore, MemoryStore, SaveSlots, type KeyValueStore } from '@game/save';
import { TitleScene } from '@game/scenes/title-scene';
import { gameSettings, installSettings, persistBindings } from '@game/settings';
import { SHIPPED_PACKS } from '@packs/index';
import { installCssVars } from '@game/style/css';
import { loadFonts } from '@game/style/fonts';
import { ZORAVIA_SCREEN_THEME } from '@game/style/theme';
import { SCREEN, surface } from '@game/style/tokens';
import { installKeyHints } from '@game/input/key-hint';
import { showCrashScreen } from '@game/release/crash';

document.title = GAME_TITLE;

async function main(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) throw new Error('#app element missing');

  installCssVars();
  installFavicon();
  await loadFonts(); // Pixi measures text on creation: fonts must be ready first.

  const params = new URLSearchParams(window.location.search);
  const engine = await Engine.create({
    parent: root,
    background: surface.background,
    debug: params.has('debug'),
    virtual: SCREEN,
  });

  // Screen readers get a name for the game canvas (C38).
  engine.app.canvas.setAttribute('role', 'application');
  engine.app.canvas.setAttribute('aria-label', 'Zoravia game. Play with the keyboard.');

  const settingsStore = safeLocalStorage();
  // Settings and key bindings belong to the device (C33), like the volumes (C24).
  // With the OS asking for reduced motion, shake and flashes start off (C38).
  installSettings(settingsStore, {
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  });
  const input = createInput();
  persistBindings(input.bindings, settingsStore);
  installKeyHints(input.bindings);
  attachDomInput(input, {
    pointerTarget: engine.app.canvas,
    mapPoint: (x, y) => engine.toScreen(x, y),
  });
  input.setContexts(['menu']);
  const ui = uiInputFrom(input, {
    up: 'nav_up',
    down: 'nav_down',
    left: 'nav_left',
    right: 'nav_right',
    confirm: 'confirm',
    back: 'back',
  });

  // Sound (C24): the audio context starts on the first key press or click.
  const audio = new AudioEngine();
  audio.attachUnlock(window);
  installAudio(audio, {
    settings: loadAudioSettings(settingsStore),
    ...(settingsStore ? { storage: settingsStore } : {}),
  });

  // Mute while the tab is hidden (a setting, C33).
  document.addEventListener('visibilitychange', () => {
    setMuted(document.visibilityState === 'hidden' && gameSettings().muteHidden);
  });

  engine.addPreUpdate((dt) => {
    input.update(dt);
    if (input.pressed('debug_overlay')) engine.debugVisible = !engine.debugVisible;
  });

  // The title screen (C33). In dev builds only (C38), `?demo` opens the UI framework demo
  // (C06) and the title has the battle test launcher (C18) as its Debug item. Both are dead
  // code in a release build, so neither ships.
  const content = loadGameContent([...SHIPPED_PACKS]);
  let store: KeyValueStore;
  let savesPersist = true;
  try {
    store = await IndexedDbStore.open();
  } catch (err) {
    console.warn('Saves will only last this session:', err);
    store = new MemoryStore();
    savesPersist = false;
  }
  const saves = new SaveSlots(store, content);
  const first =
    import.meta.env.DEV && params.has('demo')
      ? new (await import('@game/scenes/ui-demo-scene')).UiDemoScene(
          engine,
          ui,
          ZORAVIA_SCREEN_THEME,
        )
      : new TitleScene({
          engine,
          content,
          input,
          ui,
          theme: ZORAVIA_SCREEN_THEME,
          saves,
          savesPersist,
          debug: import.meta.env.DEV,
          version: GAME_VERSION,
        });
  await engine.scenes.replace(first);

  // A frame that throws stops the loop (C39): save through the overworld if it is there, and
  // show the crash screen instead of a frozen picture.
  engine.onCrash = (error) => {
    console.error(error);
    setMuted(true);
    showCrashScreen(document, { error, version: GAME_VERSION, saved: emergencySave(engine) });
  };
  engine.start();
  document.getElementById('boot')?.remove();

  if (import.meta.env.DEV) {
    (window as unknown as { __zoravia?: unknown }).__zoravia = {
      engine,
      input,
      content,
      first,
      saves,
      audio,
    };
  }
}

/** Saves through the scene that can (the overworld, also under a battle). True when written. */
async function emergencySave(engine: Engine): Promise<boolean> {
  for (const scene of engine.scenes.stack) {
    const saver = scene as { saveNow?: (mode: 'manual') => Promise<string | undefined> };
    if (typeof saver.saveNow !== 'function') continue;
    try {
      return (await saver.saveNow('manual')) === undefined;
    } catch {
      return false;
    }
  }
  return false;
}

/** `localStorage`, or undefined where it is blocked (private modes, sandboxed frames). */
function safeLocalStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

main().catch((err: unknown) => {
  console.error(err);
  const boot = document.getElementById('boot');
  if (boot) {
    boot.textContent =
      'Zoravia could not start in this browser. Try an up-to-date Chrome, Firefox, Edge or Safari.';
  }
});
