/**
 * Engine runtime: PixiJS application + fixed-step loop + scene stack + debug overlay.
 *
 * ```ts
 * const engine = await Engine.create({ parent: document.getElementById('app')! });
 * engine.scenes.replace(new TitleScene(engine));
 * engine.start();
 * ```
 *
 * Without `virtual`, coordinates are CSS pixels (`engine.width/height`) and the renderer
 * resolution follows `devicePixelRatio`.
 *
 * With `virtual: { width: 480, height: 270 }` (pixel-art mode), scenes and transitions draw
 * into a game screen measured in game pixels: a nearest-neighbor render texture shown at a
 * whole-number scale. The game screen fills the whole window — `virtual` is its minimum
 * size; wider/taller windows get a larger game screen (see `virtual-screen.ts`), so scenes
 * must lay out for `engine.width/height` in `resize`. Pixi pointer events and
 * `engine.toScreen()` report game pixels; the debug overlay stays at native resolution.
 *
 * UI layer: a scene's optional `ui` view (and the transitions) are drawn straight to the
 * canvas, scaled to the game screen, instead of into the pixel texture. Coordinates are the
 * same game pixels, but text is rendered at device resolution (smooth, not pixelated);
 * shapes and nearest-filtered textures at whole game-pixel positions still look like pixel
 * art. Every `Text` in the UI layer gets `resolution = fit.scale` automatically.
 */

import { AbstractText, Application, Container, Matrix, RenderTexture, Sprite } from 'pixi.js';
import { EventBus } from '../core/events';
import { createLogger } from '../core/logger';
import { FpsCounter } from '../debug/fps-counter';
import { FpsOverlay } from '../debug/fps-overlay';
import { FixedStepLoop } from '../loop/fixed-step';
import { createRafDriver, type FrameDriver } from '../loop/raf';
import { SceneManager, type Transition } from '../scenes/scene-manager';
import { createFade, type FadeOptions } from './fade';
import { createIris, type IrisOptions } from './iris';
import { fitVirtual, toVirtual, type VirtualFit, type VirtualSize } from './virtual-screen';

const log = createLogger('engine:render');

export interface EngineOptions {
  readonly parent: HTMLElement;
  /** Clear color. Default `0x0f1115`. */
  readonly background?: number;
  /** Fixed updates per second. Default 60. */
  readonly stepHz?: number;
  /** Show the FPS overlay at start (toggle via `debugVisible`). Default false. */
  readonly debug?: boolean;
  /** Fixed game-screen size in game pixels (pixel-art mode). Default: none (CSS pixels). */
  /** Minimum game-screen size in game pixels (pixel-art mode). Default: none (CSS pixels). */
  readonly virtual?: VirtualSize;
}

export type EngineEvents = {
  resize: {
    readonly width: number;
    readonly height: number;
    readonly resolution: number;
    /** Set in virtual-screen mode: scale and game-screen size. */
    readonly fit?: VirtualFit;
  };
};

export class Engine {
  readonly events = new EventBus<EngineEvents>();
  readonly scenes: SceneManager<Container>;
  readonly fps = new FpsCounter();
  /** Layers, bottom to top. */
  readonly layers = {
    scenes: new Container({ label: 'scenes' }),
    /** Scene UI views (native-resolution text in virtual mode). */
    ui: new Container({ label: 'ui' }),
    transitions: new Container({ label: 'transitions' }),
    debug: new Container({ label: 'debug' }),
  };
  private readonly loop: FixedStepLoop;
  private readonly driver: FrameDriver;
  private readonly overlay: FpsOverlay;
  private readonly disposers: (() => void)[] = [];
  private readonly preUpdate: ((dt: number) => void)[] = [];
  /** Event root of the game screen: the pixel world + the UI layer, both in game pixels. */
  private readonly screenRoot = new Container({ label: 'screen' });
  /** Pixel layer (rendered into `screenTexture` in virtual mode). */
  private readonly worldRoot = new Container({ label: 'world' });
  /** UI layer + transitions (rendered to the canvas at native resolution in virtual mode). */
  private readonly uiRoot = new Container({ label: 'ui-root' });
  private readonly uiTransform = new Matrix();
  private readonly virtual: VirtualSize | undefined;
  private screenTexture: RenderTexture | undefined;
  private readonly screenSprite: Sprite | undefined;
  private currentFit: VirtualFit | undefined;

  private constructor(
    readonly app: Application,
    private readonly parent: HTMLElement,
    options: EngineOptions,
  ) {
    this.virtual = options.virtual;
    this.worldRoot.addChild(this.layers.scenes);
    this.uiRoot.addChild(this.layers.ui, this.layers.transitions);
    this.screenRoot.addChild(this.worldRoot, this.uiRoot);
    if (this.virtual) {
      this.screenTexture = createScreenTexture(this.virtual.width, this.virtual.height);
      this.screenSprite = new Sprite({ texture: this.screenTexture, label: 'screen-view' });
      app.stage.addChild(this.screenSprite);
      this.routePointerEvents();
    } else {
      app.stage.addChild(this.screenRoot, this.layers.debug);
    }

    this.scenes = new SceneManager<Container>({
      attach: (view) => this.layers.scenes.addChild(view),
      detach: (view) => this.layers.scenes.removeChild(view),
      attachUi: (view) => this.layers.ui.addChild(view),
      detachUi: (view) => this.layers.ui.removeChild(view),
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
        if (this.screenTexture && this.currentFit) {
          app.renderer.render({
            container: this.worldRoot,
            target: this.screenTexture,
            clear: true,
            clearColor: options.background ?? 0x0f1115,
          });
          app.render(); // the scaled pixel screen
          syncTextResolution(this.uiRoot, this.currentFit.scale);
          app.renderer.render({
            container: this.uiRoot,
            transform: this.uiTransform,
            clear: false,
          });
          // Pixi leaves the render transform in the group's world transform; reset it so hit
          // tests and bounds stay in game pixels (pointer events are mapped to game pixels).
          this.uiRoot.renderGroup?.worldTransform.identity();
          app.renderer.render({ container: this.layers.debug, clear: false });
        } else {
          app.render();
        }
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
      antialias: !options.virtual,
      roundPixels: Boolean(options.virtual),
      autoStart: false,
      sharedTicker: false,
    });
    app.ticker.stop(); // the engine drives rendering itself
    // A block canvas: an inline one leaves a gap below it that overflows a 100%-high parent,
    // and the scrollbars that adds resize the parent, every frame (blank screen until the
    // window happened to reach a size without overflow).
    app.canvas.style.display = 'block';
    options.parent.appendChild(app.canvas);
    log.info('renderer ready', { type: app.renderer.name, resolution: app.renderer.resolution });
    return new Engine(app, options.parent, options);
  }

  /** Game-screen width: virtual width, or the canvas width in CSS pixels. */
  get width(): number {
    return this.currentFit?.width ?? this.app.screen.width;
  }

  get height(): number {
    return this.currentFit?.height ?? this.app.screen.height;
  }

  /** Current game-screen scale and size (undefined without `virtual`). */
  get fit(): VirtualFit | undefined {
    return this.currentFit;
  }

  /** Canvas CSS coordinates → game-screen coordinates (identity without `virtual`). */
  toScreen(cssX: number, cssY: number): { x: number; y: number } {
    return this.currentFit ? toVirtual(this.currentFit, cssX, cssY) : { x: cssX, y: cssY };
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

  /** Iris wipe sized to the screen, closing on and opening around `center` (game px). */
  iris(center?: () => { x: number; y: number } | undefined, options?: IrisOptions): Transition {
    return createIris(
      this.layers.transitions,
      () => ({ width: this.width, height: this.height }),
      center ?? (() => undefined),
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
    this.screenTexture?.destroy(true);
    this.app.destroy({ removeView: true }, { children: true });
  }

  /**
   * Pixi hit-tests pointer events against the last container rendered to the canvas and in
   * canvas coordinates. In virtual mode the scenes live in a render texture, so point the
   * event system at the game-screen root and map positions into game pixels.
   */
  private routePointerEvents(): void {
    const renderer = this.app.renderer;
    const events = renderer.events;
    const map = events.mapPositionToPoint.bind(events);
    events.mapPositionToPoint = (point, x, y) => {
      map(point, x, y);
      const v = this.toScreen(point.x, point.y);
      point.x = v.x;
      point.y = v.y;
    };
    Object.defineProperty(renderer, 'lastObjectRendered', {
      configurable: true,
      get: () => this.screenRoot,
    });
  }

  private watchResize(): void {
    const apply = (): void => {
      const resolution = window.devicePixelRatio || 1;
      if (this.app.renderer.resolution !== resolution) {
        this.app.renderer.resolution = resolution;
      }
      this.app.resize();
      if (this.virtual && this.screenSprite) {
        const fit = fitVirtual(
          this.app.screen.width,
          this.app.screen.height,
          resolution,
          this.virtual,
        );
        this.currentFit = fit;
        // A new texture instead of `resize`: Pixi keeps the GPU render target at the size it
        // was first rendered at, so a resized texture only showed the first 480×270 pixels.
        const old = this.screenTexture;
        if (!old || old.width !== fit.width || old.height !== fit.height) {
          this.screenTexture = createScreenTexture(fit.width, fit.height);
          this.screenSprite.texture = this.screenTexture;
          old?.destroy(true);
        }
        this.screenSprite.scale.set(fit.cssScale);
        this.uiTransform.set(fit.cssScale, 0, 0, fit.cssScale, 0, 0);
      }
      this.scenes.resize(this.width, this.height);
      this.events.emit('resize', {
        width: this.width,
        height: this.height,
        resolution,
        ...(this.currentFit ? { fit: this.currentFit } : {}),
      });
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

/**
 * Gives every text in the UI layer the device resolution of one game pixel, so it is drawn
 * smooth at native resolution. Only changed texts are re-rasterized.
 */
function syncTextResolution(root: Container, resolution: number): void {
  const visit = (c: Container): void => {
    if (!c.visible) return;
    if (c instanceof AbstractText && c.resolution !== resolution) c.resolution = resolution;
    for (const child of c.children) visit(child);
  };
  visit(root);
}

/** The pixel screen: game pixels, nearest-neighbor scaling. */
function createScreenTexture(width: number, height: number): RenderTexture {
  return RenderTexture.create({
    width,
    height,
    resolution: 1,
    antialias: false,
    scaleMode: 'nearest',
  });
}
