import type { Container } from 'pixi.js';
import { Engine } from '@engine/render/engine';
import type { Scene } from '@engine/scenes/scene-manager';
import { SCREEN, surface } from '@game/style/tokens';
import { BIOME_IDS, BIOMES, type BiomeId } from '@game/world/biomes';
import { TerrainView } from '@game/world/terrain-view';
import { WEATHER_IDS, WEATHER_LABELS, type WeatherId } from '@game/world/weather';
import { sampleMap } from '../biomes/sample-maps';
import { h, type LabSection } from '../dom';

/** Lab scene: one biome sample map with its weather, on the 480×270 game screen. */
class BiomeScene implements Scene<Container> {
  readonly id = 'lab-biomes';
  readonly terrain: TerrainView;

  constructor(biome: BiomeId) {
    this.terrain = new TerrainView(sampleMap(biome), BIOMES[biome]);
  }

  get view(): Container {
    return this.terrain.view;
  }

  update(dt: number): void {
    this.terrain.update(dt);
  }

  render(): void {
    this.terrain.render();
  }

  resize(width: number, height: number): void {
    this.terrain.resize(width, height);
  }

  exit(): void {
    this.terrain.destroy();
  }
}

type WeatherChoice = WeatherId | 'auto';

/**
 * C11: procedural tiles for the three launch biomes (storybook style), autotiled shores,
 * paths and patches, animated water/lava/grass, and weather.
 */
export const biomesSection: LabSection = {
  id: 'biomes',
  title: 'Biome tiles & weather',
  chunk: 'C11',
  ready: true,
  render(el) {
    const stage = h('div', {
      class: 'pixi-stage game-stage',
      tabindex: 0,
      'aria-label': 'Biome sample map: 1 2 3 biome, W weather, G tile grid',
    });
    const biomeRow = h('div', { class: 'zl-controls', role: 'group', 'aria-label': 'Biome' });
    const weatherRow = h('div', { class: 'zl-controls', role: 'group', 'aria-label': 'Weather' });
    el.append(
      h(
        'p',
        { class: 'lead' },
        'Sample maps for the three launch biomes on the 480×270 game screen (16×16 tiles), drawn in code. Shores, paths and patches are autotiled from terrain stored per tile corner.',
      ),
      biomeRow,
      weatherRow,
      stage,
      h(
        'p',
        { class: 'note' },
        'Click or Tab into the screen: 1 2 3 biome · W next weather · G tile grid. The buttons work by keyboard too.',
      ),
    );

    const state: { biome: BiomeId; weather: WeatherChoice; grid: boolean } = {
      biome: 'forest',
      weather: 'auto',
      grid: false,
    };
    const choices: WeatherChoice[] = ['auto', ...WEATHER_IDS];
    let scene: BiomeScene | undefined;
    let engine: Engine | undefined;
    let started = false;

    const button = (label: string, onClick: () => void): HTMLButtonElement => {
      const b = h('button', { type: 'button', class: 'zl-button', 'aria-pressed': false }, label);
      b.addEventListener('click', onClick);
      return b;
    };
    const biomeButtons = BIOME_IDS.map((id) =>
      button(BIOMES[id].label, () => {
        state.biome = id;
        void showBiome();
      }),
    );
    const weatherButtons = choices.map((id) =>
      button(id === 'auto' ? 'Biome default' : WEATHER_LABELS[id], () => {
        state.weather = id;
        applyWeather();
      }),
    );
    const gridButton = button('Tile grid', () => {
      state.grid = !state.grid;
      applyGrid();
    });
    biomeRow.append(...biomeButtons);
    weatherRow.append(...weatherButtons, gridButton);

    const sync = (): void => {
      biomeButtons.forEach((b, i) =>
        b.setAttribute('aria-pressed', String(BIOME_IDS[i] === state.biome)),
      );
      weatherButtons.forEach((b, i) =>
        b.setAttribute('aria-pressed', String(choices[i] === state.weather)),
      );
      gridButton.setAttribute('aria-pressed', String(state.grid));
    };
    const applyWeather = (): void => {
      scene?.terrain.setWeather(
        state.weather === 'auto' ? BIOMES[state.biome].weather : state.weather,
      );
      sync();
    };
    const applyGrid = (): void => {
      if (scene) scene.terrain.showGrid = state.grid;
      sync();
    };
    const showBiome = async (): Promise<void> => {
      if (!engine) return;
      const next = new BiomeScene(state.biome);
      scene = next;
      sync();
      // The first scene goes in without a fade: transitions need the running loop.
      await engine.scenes.replace(
        next,
        started ? { transition: engine.fade({ duration: 0.12 }) } : undefined,
      );
      applyWeather();
      applyGrid();
    };

    stage.addEventListener('keydown', (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= BIOME_IDS.length) {
        state.biome = BIOME_IDS[n - 1] ?? 'forest';
        void showBiome();
      } else if (e.key === 'w' || e.key === 'W') {
        state.weather = choices[(choices.indexOf(state.weather) + 1) % choices.length] ?? 'auto';
        applyWeather();
      } else if (e.key === 'g' || e.key === 'G') {
        state.grid = !state.grid;
        applyGrid();
      } else return;
      e.preventDefault();
    });
    stage.addEventListener('pointerdown', () => stage.focus());
    stage.addEventListener('focusin', () => stage.classList.add('active'));
    stage.addEventListener('focusout', () => stage.classList.remove('active'));

    void (async () => {
      engine = await Engine.create({
        parent: stage,
        background: surface.background,
        virtual: SCREEN,
      });
      await showBiome();
      engine.start();
      started = true;
      if (import.meta.env.DEV) {
        (window as unknown as { __biomes?: unknown }).__biomes = { engine, state };
      }
    })();
  },
};
