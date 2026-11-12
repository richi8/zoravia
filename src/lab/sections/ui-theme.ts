import { attachDomInput } from '@engine/input';
import { Engine } from '@engine/render/engine';
import { uiInputFrom } from '@engine/ui';
import { createInput } from '@game/input/actions';
import { UiDemoScene } from '@game/scenes/ui-demo-scene';
import { ZORAVIA_THEME } from '@game/style/theme';
import { surface } from '@game/style/tokens';
import { h, type LabSection } from '../dom';

/**
 * The C06 UI demo running live in Pixi with the token-derived theme. Keyboard input is only
 * captured while the preview has focus (Tab into it or click it), so the lab page still scrolls.
 */
export const uiThemeSection: LabSection = {
  id: 'ui-theme',
  title: 'UI theme (live)',
  chunk: 'C07',
  ready: true,
  render(el) {
    const stage = h('div', {
      class: 'pixi-stage',
      tabindex: 0,
      'aria-label': 'UI theme preview — focus to use the keyboard',
    });
    const hint = h(
      'p',
      { class: 'note' },
      'Click or Tab into the preview to use it with the keyboard; click outside to release.',
    );
    el.append(
      h(
        'p',
        { class: 'lead' },
        'The C06 menus and dialogs, themed by createUiTheme() from the tokens.',
      ),
      stage,
      hint,
    );

    void (async () => {
      const engine = await Engine.create({ parent: stage, background: surface.background });
      const input = createInput();
      input.setContexts(['menu']);
      let detach: (() => void) | undefined;
      stage.addEventListener('focusin', () => {
        detach ??= attachDomInput(input, { pointerTarget: engine.app.canvas });
        stage.classList.add('active');
      });
      stage.addEventListener('focusout', () => {
        detach?.();
        detach = undefined;
        input.releaseAll();
        stage.classList.remove('active');
      });
      stage.addEventListener('pointerdown', () => stage.focus());
      engine.addPreUpdate((dt) => input.update(dt));
      const ui = uiInputFrom(input, {
        up: 'nav_up',
        down: 'nav_down',
        left: 'nav_left',
        right: 'nav_right',
        confirm: 'confirm',
        back: 'back',
      });
      await engine.scenes.replace(new UiDemoScene(engine, ui, ZORAVIA_THEME));
      engine.start();
      if (import.meta.env.DEV) {
        (window as unknown as { __labEngine?: unknown }).__labEngine = engine;
      }
    })();
  },
};
