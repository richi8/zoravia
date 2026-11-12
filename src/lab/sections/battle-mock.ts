import { attachDomInput } from '@engine/input';
import { Engine } from '@engine/render/engine';
import { uiInputFrom } from '@engine/ui';
import type { Scene } from '@engine/scenes/scene-manager';
import type { Container } from 'pixi.js';
import { createInput } from '@game/input/actions';
import { ZORAVIA_SCREEN_THEME } from '@game/style/theme';
import { SCREEN, surface } from '@game/style/tokens';
import { BattleMockScene } from '../battle-mock/battle-mock-scene';
import { KitScene } from '../battle-mock/kit-scene';
import { ShopMockScene } from '../battle-mock/shop-mock-scene';
import { h, type LabSection } from '../dom';

/**
 * The C10 UI kit on the real game screen (480×270 virtual screen, storybook theme, smooth
 * text): a playable battle mock, a shop and a sheet of every UI piece.
 */
export const battleMockSection: LabSection = {
  id: 'ui-kit',
  title: 'UI kit & battle mock',
  chunk: 'C10',
  ready: true,
  render(el) {
    const stage = h('div', {
      class: 'pixi-stage game-stage',
      tabindex: 0,
      'aria-label': 'Battle mock: focus to play with the keyboard',
    });
    const tabs = h('div', { class: 'zl-controls', role: 'group', 'aria-label': 'Screen' });
    el.append(
      h(
        'p',
        { class: 'lead' },
        'The in-game UI on the 480×270 game screen: storybook paper panels drawn as pixel art, smooth text on top.',
      ),
      tabs,
      stage,
      h(
        'p',
        { class: 'note' },
        'Click or Tab into the screen. W A S D / arrows move · E select (hold E = faster text) · Q back · 1 2 3 switch · F inspect icons (tooltips; also on mouse hover). Mouse works too: click, right-click = back.',
      ),
    );

    void (async () => {
      const engine = await Engine.create({
        parent: stage,
        background: surface.background,
        virtual: SCREEN,
      });
      const input = createInput();
      input.setContexts(['battle']);
      let detach: (() => void) | undefined;
      stage.addEventListener('focusin', () => {
        detach ??= attachDomInput(input, {
          pointerTarget: engine.app.canvas,
          mapPoint: (x, y) => engine.toScreen(x, y),
        });
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
      const theme = ZORAVIA_SCREEN_THEME;
      const screens: [string, () => Scene<Container>][] = [
        ['Battle', () => new BattleMockScene(input, ui, theme)],
        ['Shop', () => new ShopMockScene(ui, theme)],
        ['UI kit', () => new KitScene(input, ui, theme)],
      ];
      const buttons = screens.map(([name, make], i) => {
        const b = h(
          'button',
          { type: 'button', class: 'zl-button', 'aria-pressed': i === 0 },
          name,
        );
        b.addEventListener('click', () => {
          for (const o of buttons) o.setAttribute('aria-pressed', String(o === b));
          void engine.scenes.replace(make(), { transition: engine.fade({ duration: 0.15 }) });
          stage.focus();
        });
        return b;
      });
      tabs.append(...buttons);
      const first = screens[0];
      if (first) await engine.scenes.replace(first[1]());
      engine.start();
      if (import.meta.env.DEV) {
        (window as unknown as { __battleMock?: unknown }).__battleMock = { engine, input };
      }
    })();
  },
};
