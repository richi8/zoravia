import { attachDomInput } from '@engine/input';
import { Engine } from '@engine/render/engine';
import { uiInputFrom } from '@engine/ui';
import { GAME_TITLE } from '@game/index';
import { createInput } from '@game/input/actions';
import { UiDemoScene } from '@game/scenes/ui-demo-scene';

document.title = GAME_TITLE;

async function main(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) throw new Error('#app element missing');

  const params = new URLSearchParams(window.location.search);
  const engine = await Engine.create({
    parent: root,
    debug: params.has('debug'),
  });

  const input = createInput();
  attachDomInput(input, { pointerTarget: engine.app.canvas });
  input.setContexts(['menu']);
  const ui = uiInputFrom(input, {
    up: 'nav_up',
    down: 'nav_down',
    left: 'nav_left',
    right: 'nav_right',
    confirm: 'confirm',
    back: 'back',
  });

  engine.addPreUpdate((dt) => {
    input.update(dt);
    if (input.pressed('debug_overlay')) engine.debugVisible = !engine.debugVisible;
  });

  // Until the real start flow exists (C33), the app opens the UI framework demo (C06).
  const demo = new UiDemoScene(engine, ui);
  await engine.scenes.replace(demo);
  engine.start();

  if (import.meta.env.DEV) {
    (window as unknown as { __zoravia?: unknown }).__zoravia = { engine, input, demo };
  }
}

main().catch((err: unknown) => {
  console.error(err);
});
