import { Engine } from '@engine/render/engine';
import { GAME_TITLE } from '@game/index';
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

  await engine.scenes.replace(sceneA);
  engine.start();

  const toggle = (): void => {
    if (engine.scenes.isTransitioning) return;
    const next = engine.scenes.top === sceneA ? sceneB : sceneA;
    void engine.scenes.replace(next, { transition: engine.fade() });
  };
  // Temporary raw input; C05 replaces this with the action map.
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') {
      e.preventDefault();
      toggle();
    }
  });
  engine.app.canvas.addEventListener('pointerdown', toggle);

  if (import.meta.env.DEV) {
    (window as unknown as { __zoravia?: unknown }).__zoravia = { engine, toggle };
  }
}

main().catch((err: unknown) => {
  console.error(err);
});
