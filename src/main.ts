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
import { UiDemoScene } from '@game/scenes/ui-demo-scene';
import { gameSettings, installSettings, persistBindings } from '@game/settings';
import { corePack } from '@packs/core';
import { installCssVars } from '@game/style/css';
import { loadFonts } from '@game/style/fonts';
import { ZORAVIA_SCREEN_THEME } from '@game/style/theme';
import { SCREEN, surface } from '@game/style/tokens';

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

  const settingsStore = safeLocalStorage();
  // Settings and key bindings belong to the device (C33), like the volumes (C24).
  installSettings(settingsStore);
  const input = createInput();
  persistBindings(input.bindings, settingsStore);
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

  // The title screen (C33); `?demo` opens the UI framework demo (C06). The battle test
  // launcher (C18) is the title's Debug item in dev builds and with `?debug`.
  const content = loadGameContent([corePack]);
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
  const first = params.has('demo')
    ? new UiDemoScene(engine, ui, ZORAVIA_SCREEN_THEME)
    : new TitleScene({
        engine,
        content,
        input,
        ui,
        theme: ZORAVIA_SCREEN_THEME,
        saves,
        savesPersist,
        debug: import.meta.env.DEV || params.has('debug'),
        version: GAME_VERSION,
      });
  await engine.scenes.replace(first);
  engine.start();

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
});
