import { attachDomInput } from '@engine/input';
import { Engine } from '@engine/render/engine';
import { GAME_TITLE } from '@game/index';
import { createInput } from '@game/input/actions';
import { PlaceholderScene } from '@game/scenes/placeholder-scene';

document.title = GAME_TITLE;

async function main(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) throw new Error('#app element missing');

  const params = new URLSearchParams(window.location.search);
  const engine = await Engine.create({
    parent: root,
    debug: params.has('debug') || import.meta.env.DEV,
  });

  const input = createInput();
  attachDomInput(input, { pointerTarget: engine.app.canvas });
  input.setContexts(['menu']);

  // Placeholder scenes (C04). Replaced by the real title/start flow later.
  const sceneA = new PlaceholderScene({
    id: 'a',
    title: 'Scene A',
    background: 0x1d3b2a,
    accent: 0x7bd88f,
  });
  const sceneB = new PlaceholderScene({
    id: 'b',
    title: 'Scene B',
    background: 0x1f2a4d,
    accent: 0x8fb4ff,
  });

  const toggle = (): void => {
    if (engine.scenes.isTransitioning) return;
    const next = engine.scenes.top === sceneA ? sceneB : sceneA;
    void engine.scenes.replace(next, { transition: engine.fade() });
  };

  engine.addPreUpdate((dt) => {
    input.update(dt);
    if (input.pressed('debug_overlay')) engine.debugVisible = !engine.debugVisible;
    if (input.pressed('confirm') || input.rawPressed('Mouse0')) toggle();
  });

  await engine.scenes.replace(sceneA);
  engine.start();

  if (import.meta.env.DEV) {
    (window as unknown as { __zoravia?: unknown }).__zoravia = { engine, input, toggle };
  }
}

main().catch((err: unknown) => {
  console.error(err);
});
