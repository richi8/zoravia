/**
 * Title screen and start flow (C33). The dragon crest (C07) over the first start region's
 * map, dimmed and drifting slowly, with the title theme. The menu:
 *
 * - **Continue**: the most recently saved slot.
 * - **New game**: a save slot (asks before overwriting) → a start region (pack `starts`) → a
 *   starter → the world, with the iris.
 * - **Load game**: the slot cards; a saved slot can be continued or deleted.
 * - **Settings**: the settings menu (also in the pause menu).
 * - **Debug**: the old battle launcher with checkpoints (dev builds only; C38 leaves it out of
 *   the release bundle).
 *
 * Keyboard: W/S choose, E pick, Q back. Mouse: hover and click. While the world is open,
 * hiding the tab autosaves; quitting from the pause menu comes back here.
 */

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { InputManager } from '@engine/input';
import { blendPacked, PixelBuffer } from '@engine/render/pixel-buffer';
import { pixelateSvg } from '@engine/render/pixelate';
import type { Engine } from '@engine/render/engine';
import type { Scene } from '@engine/scenes/scene-manager';
import {
  FocusStack,
  Menu,
  UiMotion,
  uiSound,
  type MenuItem,
  type UiInput,
  type UiTheme,
  type Widget,
} from '@engine/ui';
import { titleAudio } from '@game/audio';
import { LOGO_PIXEL_OPTIONS, logoSvg } from '@game/brand/logo';
import type { GameContent, Start } from '@game/data';
import type { Action } from '@game/input/actions';
import { newGameState, SaveQueue, type GameState, type SaveSlots, type SlotInfo } from '@game/save';
import { pixelTexture } from '@engine/render/pixel-texture';
import { logoColors, paper, surface } from '@game/style/tokens';
import { styleTypes } from '@game/style/ids';
import type { SizedWidget } from '@game/ui/settings-menu';
import { SettingsMenu } from '@game/ui/settings-menu';
import { SlotPanel } from '@game/ui/slot-panel';
import { RegionPanel, StarterPanel } from '@game/ui/start-panels';
import { uiText } from '@game/ui/text';
import { BIOMES, TILE } from '@game/world/biomes';
import { loadRegion } from '@game/world/map';
import { TerrainStream } from '@game/world/overworld/stream';
import { speciesLook } from '@game/zorlings/species-look';
import { renderZorling } from '@game/zorlings/render';
import { OverworldScene } from './overworld-scene';
import { keyHint, upDownHint } from '@game/input/key-hint';

const titleHint = (): string => `${upDownHint()} choose · ${keyHint('confirm')} select`;

export interface TitleOptions {
  readonly engine: Engine;
  readonly content: GameContent;
  readonly input: InputManager<Action>;
  readonly ui: UiInput;
  readonly theme: UiTheme;
  readonly saves: SaveSlots;
  /** False when saves only live in memory (IndexedDB not available). */
  readonly savesPersist: boolean;
  /** Shows the Debug item (the old launcher). Only honored in dev builds (C38). */
  readonly debug: boolean;
  /** Game version shown in the corner. */
  readonly version: string;
}

/** Logo width in game pixels (C33 preview, variant A). */
const LOGO_W = 280;
/** Extra map width the background drifts across. */
const PAN = 160;
/** Seconds for one drift from side to side. */
const PAN_PERIOD = 90;
const MENU_W = 168;
const DIM = 0.42;

export class TitleScene implements Scene<Container> {
  readonly id = 'title';
  readonly view = new Container({ label: 'world:title' });
  readonly ui = new Container({ label: 'ui:title' });
  private readonly bg = new Sprite();
  private bgTexture: Texture | undefined;
  private readonly logo = new Sprite();
  private readonly layer = new Container({ label: 'title-menus' });
  /** Dims the logo while a screen is open over the main menu. */
  private readonly veil = new Graphics();
  private readonly hint = uiText('body', titleHint(), paper.light);
  private readonly version: ReturnType<typeof uiText>;
  private readonly stack: FocusStack<Container>;
  private readonly motion: UiMotion;
  private readonly sizes = new Map<Widget<Container>, () => { w: number; h: number }>();
  private readonly portraits = new Map<string, Texture>();
  private menu: Menu | undefined;
  private slots: SlotInfo[] = [];
  private width = 480;
  private height = 270;
  private time = 0;
  /** A scene change is under way: ignore picks until it is done (C25's double push bug). */
  private busy = false;
  /** The open world, saved when the tab is hidden. */
  private world: OverworldScene | undefined;
  private readonly bgMap: { map: string; x: number; y: number } | undefined;
  private bgStream: TerrainStream | undefined;

  constructor(private readonly options: TitleOptions) {
    const first = options.content.starts.values()[0];
    const anchor = first && options.content.maps.require(first.map).anchors[first.anchor];
    this.bgMap = first && anchor ? { map: first.map, x: anchor.x, y: anchor.y - 7 } : undefined;
    this.version = uiText('label', options.version, paper.shade);
    this.view.addChild(this.bg, this.logo);
    this.ui.addChild(this.hint, this.version, this.veil, this.layer);
    this.motion = new UiMotion(this.layer);
    this.stack = new FocusStack<Container>(this.motion, options.ui);
    void pixelateSvg(logoSvg({ id: 'title' }), LOGO_W, LOGO_PIXEL_OPTIONS).then((canvas) => {
      const t = Texture.from(canvas);
      t.source.scaleMode = 'nearest';
      this.logo.texture = t;
      this.layout();
    });
    const hide = (): void => {
      if (document.visibilityState === 'hidden') void this.world?.saveNow('auto');
    };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', () => void this.world?.saveNow('auto'));
    void this.refresh();
  }

  enter(): void {
    this.options.input.setContexts(['menu']);
    this.options.input.suppressHeld();
    titleAudio();
  }

  /** Covered scenes stay drawn: hide while the world or the launcher is on top. */
  pause(): void {
    this.view.visible = false;
    this.ui.visible = false;
  }

  resume(): void {
    this.view.visible = true;
    this.ui.visible = true;
    this.busy = false;
    this.enter();
    void this.refresh();
  }

  update(dt: number): void {
    this.time += dt;
    const phase = (1 - Math.cos((this.time / PAN_PERIOD) * Math.PI * 2)) / 2;
    this.bg.x = -Math.round(phase * PAN);
    this.stack.update(dt);
    this.motion.update(dt);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.drawBackground();
    this.layout();
  }

  // ------------------------------------------------------------ main menu

  private async refresh(): Promise<void> {
    this.slots = await this.options.saves.list();
    const latest = this.latest();
    const anySaved = this.slots.some((s) => s.state !== 'empty');
    const entries: [MenuItem, () => void][] = [];
    if (latest) {
      entries.push([
        { label: 'Continue', hint: `${latest.summary.lead} · Slot ${latest.slot}` },
        () => void this.continueGame(latest.slot),
      ]);
    }
    entries.push(
      [{ label: 'New game' }, () => this.openNewGame()],
      [{ label: 'Load game', disabled: !anySaved }, () => this.openLoad()],
      [{ label: 'Settings' }, () => this.openSettings()],
    );
    if (import.meta.env.DEV && this.options.debug)
      entries.push([{ label: 'Debug launcher' }, () => void this.openDebug()]);
    const old = this.menu;
    const index = old?.index ?? 0;
    this.menu = new Menu({
      theme: this.options.theme,
      width: MENU_W,
      items: entries.map(([item]) => item),
      onSelect: (i) => {
        if (!this.busy) entries[i]?.[1]();
      },
    });
    this.menu.cursor.set(Math.min(index, entries.length - 1));
    if (old) {
      const above = this.stack.size > 1;
      this.stack.remove(old);
      if (above) {
        // A screen is open on top: put the new main menu under it.
        this.rebuildUnder(this.menu);
        return;
      }
    }
    this.stack.push(this.menu);
    this.layout();
  }

  /** Swaps in a new root menu under the open screens. */
  private rebuildUnder(menu: Menu): void {
    const open: Widget<Container>[] = [];
    while (this.stack.top) {
      const top = this.stack.top;
      open.unshift(top);
      this.stack.remove(top);
    }
    this.stack.push(menu);
    for (const w of open) this.stack.push(w);
    this.layout();
  }

  /** The saved slot written last. */
  private latest(): Extract<SlotInfo, { state: 'ok' }> | undefined {
    let best: Extract<SlotInfo, { state: 'ok' }> | undefined;
    for (const s of this.slots) {
      if (s.state !== 'ok') continue;
      if (!best || s.summary.savedAt > best.summary.savedAt) best = s;
    }
    return best;
  }

  // ------------------------------------------------------------ screens

  private open(w: Widget<Container>, size: () => { w: number; h: number }): void {
    this.sizes.set(w, size);
    this.stack.push(w);
    this.layout();
  }

  private close(w: Widget<Container>): void {
    this.stack.remove(w);
    this.sizes.delete(w);
    this.layout();
  }

  private openSized(w: SizedWidget): void {
    this.open(w, () => ({ w: w.width, h: w.height }));
  }

  /** Closes every screen above the main menu. */
  private closeAll(): void {
    while (this.stack.top && this.stack.top !== this.menu) {
      const top = this.stack.top;
      this.close(top);
    }
  }

  /** A small centered question; `Q` picks the last item. */
  private ask(title: string, items: readonly string[], pick: (i: number) => void): Menu {
    const m: Menu = new Menu({
      theme: this.options.theme,
      title,
      width: 150,
      items: items.map((label) => ({ label })),
      onSelect: (i) => {
        this.close(m);
        pick(i);
      },
      onBack: () => this.close(m),
    });
    this.open(m, () => ({ w: m.width, h: m.height }));
    return m;
  }

  private openSettings(): void {
    const { input, theme } = this.options;
    this.openSized(
      new SettingsMenu({
        theme,
        bindings: input.bindings,
        capture: () => input.anyPressed(),
        open: (w) => this.openSized(w),
        close: (w) => this.close(w),
        onBack: (m) => this.close(m),
      }),
    );
  }

  private slotPanel(
    title: string,
    action: string,
    onSelect: (info: SlotInfo, p: SlotPanel) => void,
  ): SlotPanel {
    const panel: SlotPanel = new SlotPanel({
      title,
      action,
      slots: this.slots,
      ...(this.options.savesPersist
        ? {}
        : { note: 'Saves only last until the page is closed this time.' }),
      portrait: (species) => this.portrait(species),
      onSelect,
      onBack: (p) => this.close(p),
    });
    this.open(panel, () => ({ w: panel.width, h: panel.height }));
    return panel;
  }

  private openLoad(): void {
    const panel = this.slotPanel('Load game', 'Choose', (info, p) => {
      if (info.state === 'empty') {
        uiSound('blocked');
        return;
      }
      const entries: [string, () => void][] =
        info.state === 'ok' ? [['Continue', () => void this.continueGame(info.slot)]] : [];
      entries.push(['Delete', () => this.confirmDelete(info.slot, p)], ['Back', () => undefined]);
      this.ask(
        `Slot ${info.slot}`,
        entries.map(([label]) => label),
        (i) => entries[i]?.[1](),
      );
    });
    const latest = this.latest();
    if (latest) panel.select(latest.slot - 1);
  }

  private confirmDelete(slot: number, panel: SlotPanel): void {
    this.ask(`Delete slot ${slot}?`, ['Yes, delete', 'No, keep it'], (i) => {
      if (i !== 0) return;
      void this.options.saves.remove(slot).then(async () => {
        await this.refresh();
        panel.setSlots(this.slots, slot - 1);
      });
    });
  }

  private openNewGame(): void {
    const free = this.slots.find((s) => s.state === 'empty');
    const panel = this.slotPanel('New game · choose a save slot', 'Start here', (info) => {
      if (info.state === 'empty') return this.openRegions(info.slot);
      this.ask(`Overwrite slot ${info.slot}?`, ['Yes, overwrite', 'No, keep it'], (i) => {
        if (i === 0) this.openRegions(info.slot);
      });
    });
    if (free) panel.select(free.slot - 1);
  }

  private openRegions(slot: number): void {
    const { content } = this.options;
    const starts = content.starts.values();
    const panel = new RegionPanel({
      regions: starts.map((s) => ({
        name: s.name,
        description: s.description,
        detail: `Starters: ${s.starters.map((x) => content.species.require(x.species).name).join(', ')}`,
      })),
      onSelect: (i) => {
        const start = starts[i];
        if (start) this.openStarters(slot, start);
      },
      onBack: (p) => this.close(p),
    });
    this.open(panel, () => ({ w: panel.width, h: panel.height }));
  }

  private openStarters(slot: number, start: Start): void {
    const { content } = this.options;
    const panel = new StarterPanel({
      region: start.name,
      level: start.level,
      starters: start.starters.map((s) => {
        const sp = content.species.require(s.species);
        return { name: sp.name, types: styleTypes(sp.types), blurb: s.blurb, art: this.art(sp.id) };
      }),
      onSelect: (i) => {
        const pick = start.starters[i];
        if (!pick) return;
        const name = content.species.require(pick.species).name;
        this.ask(`Start with ${name}?`, ['Yes, let’s go!', 'Not yet'], (yes) => {
          if (yes === 0) void this.newGame(slot, start.id, pick.species);
        });
      },
      onBack: (p) => this.close(p),
    });
    this.open(panel, () => ({ w: panel.width, h: panel.height }));
  }

  // ------------------------------------------------------------ playing

  private async newGame(slot: number, start: string, species: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const state = newGameState(this.options.content, start, species);
    try {
      await this.options.saves.write(slot, state);
    } catch (e) {
      console.warn('New game not saved:', e);
    }
    await this.play(slot, state);
  }

  private async continueGame(slot: number): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const loaded = await this.options.saves.load(slot);
      if (!loaded) throw new Error('the slot is empty');
      await this.play(slot, loaded.state);
    } catch (e) {
      this.busy = false;
      uiSound('blocked');
      const why = e instanceof Error ? e.message : String(e);
      console.warn(`Slot ${slot} cannot be loaded:`, why);
      this.ask(`Slot ${slot} can't be loaded`, ['OK'], () => undefined);
    }
  }

  private async play(slot: number, state: GameState): Promise<void> {
    const { engine, saves } = this.options;
    this.closeAll();
    const queue = new SaveQueue((s) => saves.write(slot, s));
    const scene = this.worldScene(state, queue);
    await engine.scenes.push(scene, { transition: engine.iris(() => scene.playerScreen()) });
  }

  /** The overworld of `state`'s map; travel to another map replaces it (C34). */
  private worldScene(state: GameState, queue: SaveQueue, arrived = false): OverworldScene {
    const { engine, content, input, ui, theme } = this.options;
    const scene: OverworldScene = new OverworldScene({
      engine,
      content,
      input,
      ui,
      theme,
      mapId: state.place.map,
      party: state.party,
      start: state.place,
      ...(state.respawn ? { respawn: state.respawn } : {}),
      playtime: state.playtime,
      explored: state.explored,
      arrived,
      save: (s) => queue.save(s),
      onTravel: (next) => {
        const to = this.worldScene(next, queue, true);
        void engine.scenes.replace(to, { transition: engine.fade({ duration: 0.4 }) });
      },
      onExit: () => {
        this.world = undefined;
        void queue.idle().catch(() => undefined);
        void engine.scenes.pop({ transition: engine.iris(() => scene.playerScreen()) });
      },
    });
    this.world = scene;
    return scene;
  }

  private async openDebug(): Promise<void> {
    // Dead code in release builds, so the launcher and its checkpoints stay out of the bundle.
    if (!import.meta.env.DEV || this.busy) return;
    this.busy = true;
    const { engine, content, input, ui, theme, saves, savesPersist } = this.options;
    const { DebugLauncherScene } = await import('./debug-launcher-scene');
    const launcher = new DebugLauncherScene({
      engine,
      content,
      input,
      ui,
      theme,
      saves,
      savesPersist,
      onExit: () => void engine.scenes.pop({ transition: engine.fade({ duration: 0.25 }) }),
    });
    void engine.scenes.push(launcher, { transition: engine.fade({ duration: 0.25 }) });
  }

  // ------------------------------------------------------------ art

  private portrait(species: string): Texture {
    const key = `p:${species}`;
    let t = this.portraits.get(key);
    if (!t) {
      const look = speciesLook(this.options.content, species);
      t = pixelTexture(renderZorling(look.genome, { size: 32, fill: look.fill }));
      this.portraits.set(key, t);
    }
    return t;
  }

  private art(species: string): Texture {
    const key = `a:${species}`;
    let t = this.portraits.get(key);
    if (!t) {
      const look = speciesLook(this.options.content, species);
      t = pixelTexture(renderZorling(look.genome, { size: 64, fill: look.fill }));
      this.portraits.set(key, t);
    }
    return t;
  }

  /** The start region's map around its start, dimmed toward navy with darker edges. */
  private drawBackground(): void {
    const w = this.width + PAN;
    const h = this.height;
    const buf = new PixelBuffer(w, h);
    buf.fill(surface.background);
    if (this.bgMap) {
      // Kept across resizes (C38): a resize only draws again, it does not bake again.
      if (!this.bgStream) {
        const map = loadRegion(this.options.content, this.bgMap.map);
        this.bgStream = new TerrainStream(map, BIOMES[map.biome]);
      }
      const stream = this.bgStream;
      const camX = Math.floor(this.bgMap.x * TILE - w / 2);
      const camY = Math.floor(this.bgMap.y * TILE - h / 2);
      stream.draw(buf, camX, camY, 0.5);
    }
    const cx = w / 2;
    const cy = h / 2;
    const reach = Math.hypot(this.width / 2, h / 2);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        // Distance from the center of the visible part (which drifts), so use the buffer's.
        const d = Math.hypot((x - cx) * 0.8, y - cy) / reach;
        const edge = Math.max(0, Math.min(1, (d - 0.35) / 0.65));
        buf.data[i] = blendPacked(buf.data[i] ?? 0, logoColors.navy, DIM + edge * 0.35);
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(new ImageData(buf.bytes, w, h), 0, 0);
    const old = this.bgTexture;
    this.bgTexture = Texture.from(canvas);
    this.bgTexture.source.scaleMode = 'nearest';
    this.bg.texture = this.bgTexture;
    old?.destroy(true);
  }

  private layout(): void {
    const { width, height } = this;
    const menuH = this.menu?.height ?? 0;
    const logoH = this.logo.texture === Texture.EMPTY ? 165 : this.logo.height;
    const total = logoH + 6 + menuH + 16;
    const top = Math.max(2, Math.round((height - total) / 2));
    this.logo.position.set(Math.round((width - this.logo.width) / 2), top);
    this.menu?.view.position.set(Math.round((width - MENU_W) / 2), top + logoH + 6);
    // Follows the bindings (C36e): the keys panel opens from the title's settings.
    const text = titleHint();
    if (this.hint.text !== text) this.hint.text = text;
    this.hint.position.set(Math.round((width - this.hint.width) / 2), height - 14);
    this.veil.clear().rect(0, 0, width, height).fill({ color: paper.veil, alpha: 0.55 });
    this.veil.visible = this.stack.size > 1;
    this.hint.visible = !this.veil.visible;
    this.version.position.set(Math.round(width - 6 - this.version.width), height - 11);
    for (const [w, size] of this.sizes) {
      if (!this.stack.includes(w)) {
        this.sizes.delete(w);
        continue;
      }
      const s = size();
      w.view.position.set(Math.round((width - s.w) / 2), Math.round((height - s.h) / 2));
    }
  }
}
