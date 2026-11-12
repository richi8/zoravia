/**
 * Engine runtime: PixiJS application + fixed-step loop + scene stack + debug overlay.
 *
 * ```ts
 * const engine = await Engine.create({ parent: document.getElementById('app')! });
 * engine.scenes.replace(new TitleScene(engine));
 * engine.start();
 * ```
 *
 * Coordinates are CSS pixels (`engine.width/height`); the renderer resolution follows
 * `devicePixelRatio` (also when the window moves to another monitor).
 */

import { Application, Container } from 'pixi.js';
import { EventBus } from '../core/events';
import { createLogger } from '../core/logger';
import { FpsCounter } from '../debug/fps-counter';
import { FpsOverlay } from '../debug/fps-overlay';
import { FixedStepLoop } from '../loop/fixed-step';
import { createRafDriver, type FrameDriver } from '../loop/raf';
import { SceneManager, type Transition } from '../scenes/scene-manager';
import { createFade, type FadeOptions } from './fade';

const log = createLogger('engine:render');

export interface EngineOptions {
  readonly parent: HTMLElement;
  /** Clear color. Default `0x0f1115`. */
  readonly background?: number;
  /** Fixed updates per second. Default 60. */
  readonly stepHz?: number;
  /** Show the FPS overlay at start (toggle via `debugVisible`). Default false. */
  readonly debug?: boolean;
}

export type EngineEvents = {
  resize: { readonly width: number; readonly height: number; readonly resolution: number };
};

export class Engine {
  readonly events = new EventBus<EngineEvents>();
  readonly scenes: SceneManager<Container>;
  readonly fps = new FpsCounter();
  /** Layers, bottom to top. */
  readonly layers = {
    scenes: new Container({ label: 'scenes' }),
    transitions: new Container({ label: 'transitions' }),
    debug: new Container({ label: 'debug' }),
  };
  private readonly loop: FixedStepLoop;
  private readonly driver: FrameDriver;
  private readonly overlay: FpsOverlay;
  private readonly disposers: (() => void)[] = [];
  private readonly preUpdate: ((dt: number) => void)[] = [];

  private constructor(
    readonly app: Application,
    private readonly parent: HTMLElement,
    options: EngineOptions,
  ) {
    app.stage.addChild(this.layers.scenes, this.layers.transitions, this.layers.debug);

    this.scenes = new SceneManager<Container>({
      attach: (view) => this.layers.scenes.addChild(view),
      detach: (view) => this.layers.scenes.removeChild(view),
    });

    this.overlay = new FpsOverlay(this.fps);
    this.overlay.visible = options.debug ?? false;
    this.layers.debug.addChild(this.overlay.view);

    this.loop = new FixedStepLoop({
      stepHz: options.stepHz ?? 60,
      update: (dt) => {
        for (const hook of this.preUpdate) hook(dt);
        this.scenes.update(dt);
      },
      render: (alpha) => {
        this.scenes.render(alpha);
        app.render();
      },
    });

    this.driver = createRafDriver((elapsed) => {
      this.fps.record(elapsed);
      const { steps } = this.loop.advance(elapsed);
      this.overlay.refresh(elapsed, {
        steps,
        scenes: this.scenes.stack.map((s) => s.id).join(' > ') || '—',
      });
    });

    this.watchResize();
  }

  static async create(options: EngineOptions): Promise<Engine> {
    const app = new Application();
    await app.init({
      background: options.background ?? 0x0f1115,
      resizeTo: options.parent,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: true,
      autoStart: false,
      sharedTicker: false,
    });
    app.ticker.stop(); // the engine drives rendering itself
    options.parent.appendChild(app.canvas);
    log.info('renderer ready', { type: app.renderer.name, resolution: app.renderer.resolution });
    return new Engine(app, options.parent, options);
  }

  get width(): number {
    return this.app.screen.width;
  }

  get height(): number {
    return this.app.screen.height;
  }

  get debugVisible(): boolean {
    return this.overlay.visible;
  }

  set debugVisible(value: boolean) {
    this.overlay.visible = value;
  }

  /** Fade transition sized to the screen, for `scenes.push/pop/replace`. */
  fade(options?: FadeOptions): Transition {
    return createFade(
      this.layers.transitions,
      () => ({ width: this.width, height: this.height }),
      options,
    );
  }

  /**
   * Runs `fn(dt)` every fixed step before scenes update (e.g. sampling input).
   * Returns a function that removes it.
   */
  addPreUpdate(fn: (dt: number) => void): () => void {
    this.preUpdate.push(fn);
    return () => {
      const i = this.preUpdate.indexOf(fn);
      if (i >= 0) this.preUpdate.splice(i, 1);
    };
  }

  start(): void {
    this.loop.reset();
    this.driver.start();
  }

  stop(): void {
    this.driver.stop();
  }

  destroy(): void {
    this.stop();
    for (const dispose of this.disposers) dispose();
    this.app.destroy({ removeView: true }, { children: true });
  }

  private watchResize(): void {
    const apply = (): void => {
      const resolution = window.devicePixelRatio || 1;
      if (this.app.renderer.resolution !== resolution) {
        this.app.renderer.resolution = resolution;
      }
      this.app.resize();
      this.scenes.resize(this.width, this.height);
      this.events.emit('resize', { width: this.width, height: this.height, resolution });
    };

    const observer = new ResizeObserver(apply);
    observer.observe(this.parent);
    this.disposers.push(() => observer.disconnect());

    // devicePixelRatio changes (zoom, moving to another monitor) don't fire resize everywhere.
    let mql: MediaQueryList | undefined;
    const watchDpr = (): void => {
      mql?.removeEventListener('change', onDpr);
      mql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      mql.addEventListener('change', onDpr);
    };
    const onDpr = (): void => {
      apply();
      watchDpr();
    };
    watchDpr();
    this.disposers.push(() => mql?.removeEventListener('change', onDpr));

    apply();
  }
}
