/**
 * Debug launcher (C18; behind the title screen's "Debug" item since C33): sample battles with
 * the core pack's test Zorlings, the overworld from a save slot with the old test team (C23:
 * continue, new game, delete), the test region and the region map viewers (C19).
 * Checkpoints (G2 prep) start Verdale later in the campaign with the party the C31
 * playthrough simulator had there. Battle speed and the switch prompt come from the settings
 * (C33). Keyboard: W/S choose, E start, Q back to the title. Every battle starts from fresh
 * teams; the last result shows at the bottom. While the overworld is open, hiding the tab
 * autosaves.
 */

import { Container, Graphics } from 'pixi.js';
import type { InputManager } from '@engine/input';
import type { Engine } from '@engine/render/engine';
import type { Scene } from '@engine/scenes/scene-manager';
import { FocusStack, Menu, UiMotion, type MenuItem, type UiInput, type UiTheme } from '@engine/ui';
import { bossZorling, type BattleResult, type BattleSetup } from '@game/battle/logic';
import { BattleScene } from '@game/battle/scene/battle-scene';
import { battleTransition } from '@game/battle/scene/transition';
import { stopAllMusic } from '@game/audio';
import { gameSettings } from '@game/settings';
import { BIOME_IDS, BIOMES, type BiomeId } from '@game/world/biomes';
import type { GameContent } from '@game/data';
import type { Action } from '@game/input/actions';
import { newParty, type Party } from '@game/player';
import { createZorling, displayName, statsOf, type Zorling } from '@game/progression';
import {
  formatPlaytime,
  SaveQueue,
  SLOT_COUNT,
  type GameState,
  type SaveSlots,
  type SlotInfo,
} from '@game/save';
import { paper, surface } from '@game/style/tokens';
import { drawPaper } from '@game/ui/skin';
import { uiText } from '@game/ui/text';
import { MapViewerScene } from './map-viewer-scene';
import { OverworldScene } from './overworld-scene';

interface SampleBattle {
  readonly label: string;
  readonly hint: string;
  readonly trainer?: string;
  setup(seed: number): BattleSetup;
}

export interface LauncherOptions {
  readonly engine: Engine;
  readonly content: GameContent;
  readonly input: InputManager<Action>;
  readonly ui: UiInput;
  readonly theme: UiTheme;
  readonly saves: SaveSlots;
  /** False when saves only live in memory (IndexedDB not available). */
  readonly savesPersist: boolean;
  /** Back to the title screen (Q on the main list). */
  onExit(): void;
}

const BAG = { 'core:potion': 3, 'core:super-potion': 2, 'core:zorb': 5 };

export class DebugLauncherScene implements Scene<Container> {
  readonly id = 'debug-launcher';
  readonly view = new Container({ label: 'world:launcher' });
  readonly ui = new Container({ label: 'ui:launcher' });
  private readonly bg = new Graphics();
  private readonly panel = new Graphics();
  private readonly title = uiText('name', 'Zoravia · debug launcher', paper.title);
  private readonly note = uiText('body', '', paper.ink, { wordWrap: true, wordWrapWidth: 220 });
  private readonly status = uiText(
    'body',
    'Pick a battle. W/S choose · E start · Q title',
    paper.inkDim,
  );
  private readonly layer = new Container();
  private readonly stack: FocusStack<Container>;
  private readonly motion: UiMotion;
  private menu!: Menu;
  /** Map a new game starts on (C28: Verdale, or the C19 test region with the C21–C27 content). */
  private newGameMap = 'core:verdale';
  /** A checkpoint's state waiting for a save slot to be picked. */
  private pending: GameState | undefined;
  private biome: BiomeId = 'forest';
  private seed = 1;
  /** The open overworld, saved when the tab is hidden. */
  private world: OverworldScene | undefined;
  /** Slot menus on top of the main menu. */
  private readonly overlays: Menu[] = [];
  private width = 480;
  private height = 270;

  constructor(private readonly options: LauncherOptions) {
    this.view.addChild(this.bg);
    this.ui.addChild(this.panel, this.title, this.note, this.status, this.layer);
    this.motion = new UiMotion(this.layer);
    this.stack = new FocusStack<Container>(this.motion, options.ui);
    this.buildMenu(0);
    const hide = (): void => {
      if (document.visibilityState === 'hidden') void this.world?.saveNow('auto');
    };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', () => void this.world?.saveNow('auto'));
  }

  enter(): void {
    this.options.input.setContexts(['menu']);
    this.options.input.suppressHeld();
  }

  /** Covered scenes stay drawn: hide while a battle is on top. */
  pause(): void {
    this.view.visible = false;
    this.ui.visible = false;
  }

  resume(): void {
    this.view.visible = true;
    this.ui.visible = true;
    this.enter();
    // Back from a battle or the world: the launcher is quiet (C25).
    stopAllMusic(0.8);
  }

  update(dt: number): void {
    this.stack.update(dt);
    this.motion.update(dt);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.bg.clear().rect(0, 0, width, height).fill({ color: surface.background });
    this.layout();
  }

  private get battles(): SampleBattle[] {
    const { content } = this.options;
    let uid = 0;
    const z = (species: string, level: number): Zorling =>
      createZorling(content, { uid: `d${uid++}`, species: `core:${species}`, level });
    const team = (level: number, ...species: string[]): Zorling[] =>
      species.map((s) => z(s, level));
    const wilds = ['emberkit', 'puddlit', 'sproutle', 'voltbat', 'ironshell', 'thornwing'];
    return [
      {
        label: 'Wild battle',
        hint: 'Lv 8',
        setup: (seed) => ({
          kind: 'wild',
          seed,
          player: team(9, 'puddlit', 'emberkit', 'sproutle'),
          opponent: [z(wilds[seed % wilds.length] ?? 'emberkit', 8)],
          bag: BAG,
        }),
      },
      {
        label: 'Wild battle in the rain',
        hint: 'Wet',
        setup: (seed) => ({
          kind: 'wild',
          seed,
          player: team(12, 'voltbat', 'puddlit', 'emberkit'),
          opponent: [z('sproutle', 11)],
          bag: BAG,
          weather: ['core:wet'],
        }),
      },
      {
        label: 'Trainer battle',
        hint: '3 vs 3',
        trainer: 'Rival Mira',
        setup: (seed) => ({
          kind: 'trainer',
          seed,
          player: team(22, 'puddlit', 'voltbat', 'sproutle'),
          opponent: team(21, 'blazekit', 'ironshell', 'thornwing'),
          bag: BAG,
        }),
      },
      {
        label: 'Titan: Thornwing',
        hint: 'Lv 24',
        setup: (seed) => ({
          kind: 'wild',
          seed,
          player: team(24, 'voltbat', 'ironshell', 'blazekit'),
          opponent: [bossZorling(content, 'core:thornwing-titan', { uid: 'boss' })],
          boss: { id: 'core:thornwing-titan' },
          bag: { 'core:super-potion': 3, 'core:zorb': 2 },
        }),
      },
      {
        label: 'Legendary: Verdion',
        hint: 'Lv 36',
        setup: (seed) => ({
          kind: 'wild',
          seed,
          player: team(38, 'voltbat', 'ironshell', 'infernyx'),
          opponent: [bossZorling(content, 'core:verdion', { uid: 'boss' })],
          boss: { id: 'core:verdion' },
          bag: { 'core:super-potion': 4, 'core:max-potion': 1, 'core:zorb': 2 },
        }),
      },
    ];
  }

  private buildMenu(index: number): void {
    const battles = this.battles;
    const items: MenuItem[] = [
      ...battles.map((b) => ({ label: b.label, hint: b.hint })),
      { label: 'Play: Verdale', hint: 'Saves' },
      { label: 'Checkpoint: Verdale', hint: 'Later' },
      { label: 'Play: test region', hint: 'Saves' },
      { label: 'Map viewer: Verdale', hint: 'C28' },
      { label: 'Map viewer: test region', hint: 'C19' },
      { label: 'Battle place', hint: BIOMES[this.biome].label.split(' ')[0] ?? '' },
    ];
    const old = this.menu as Menu | undefined;
    if (old) this.stack.remove(old);
    this.menu = new Menu({
      theme: this.options.theme,
      title: 'Battles',
      width: 220,
      items,
      onSelect: (i) => {
        const b = battles[i];
        if (b) void this.start(b);
        else if (i === battles.length || i === battles.length + 2) {
          this.newGameMap = i === battles.length ? 'core:verdale' : 'core:test-region';
          this.pending = undefined;
          void this.openSlots();
        } else if (i === battles.length + 1) void this.openCheckpoints();
        else if (i === battles.length + 3) void this.openMap('core:verdale');
        else if (i === battles.length + 4) void this.openMap('core:test-region');
        else {
          // Battle music and ambience of another biome (C25).
          this.biome =
            BIOME_IDS[(BIOME_IDS.indexOf(this.biome) + 1) % BIOME_IDS.length] ?? 'forest';
          this.buildMenu(i);
        }
      },
      onBack: () => this.options.onExit(),
    });
    this.menu.cursor.set(index);
    this.stack.push(this.menu);
    this.layout();
  }

  private async start(b: SampleBattle): Promise<void> {
    const { engine, content, input, ui, theme } = this.options;
    const seed = this.seed++;
    const scene = new BattleScene({
      content,
      input,
      ui,
      theme,
      setup: b.setup(seed),
      ...(b.trainer ? { trainer: b.trainer } : {}),
      speed: gameSettings().battleSpeed,
      money: 1240,
      confirmHotbarSwitch: gameSettings().confirmSwitch,
      biome: this.biome,
      onEnd: (result) => {
        this.report(b, seed, result);
        void engine.scenes.pop({ transition: engine.fade({ duration: 0.3 }) });
      },
    });
    const transition = battleTransition(engine.layers.transitions, () => ({
      width: this.width,
      height: this.height,
    }));
    await engine.scenes.push(scene, { transition });
  }

  private startParty(): Party {
    const { content } = this.options;
    const z = (species: string, uid: string): Zorling =>
      createZorling(content, { uid, species: `core:${species}`, level: 9 });
    return newParty({
      team: [z('puddlit', 'p1'), z('emberkit', 'p2'), z('sproutle', 'p3')],
      bag: BAG,
      money: 1240,
    });
  }

  // ------------------------------------------------------------ save slots

  private async openSlots(index = 0): Promise<void> {
    const { saves, savesPersist } = this.options;
    const infos = await saves.list();
    this.closeOverlays();
    const detail = (i: number): void => {
      const info = infos[i];
      const off = savesPersist ? '' : ' (saves are kept in memory only this time)';
      this.note.text = info ? slotDetail(info) + off : '';
      this.layout();
    };
    const menu = new Menu({
      theme: this.options.theme,
      title: 'Save slots',
      width: 210,
      items: infos.map((info) => slotItem(info)),
      onSelect: (i) => {
        const info = infos[i];
        if (!info) return;
        if (this.pending) this.placeCheckpoint(info, this.pending);
        else if (info.state === 'empty') void this.newGame(info.slot);
        else this.slotOptions(info);
      },
      onHighlight: (i) => detail(i),
      onBack: () => {
        this.pending = undefined;
        this.closeOverlays();
      },
    });
    menu.cursor.set(Math.min(index, SLOT_COUNT - 1));
    detail(menu.cursor.index);
    this.pushOverlay(menu);
  }

  // ------------------------------------------------------------ checkpoints

  /** Checkpoint → starter → save slot. The simulator code is loaded only when used. */
  private async openCheckpoints(): Promise<void> {
    const { content, theme } = this.options;
    const mod = await import('../../../tools/balance/checkpoints');
    this.closeOverlays();
    const points = mod.VERDALE_CHECKPOINTS;
    this.note.text =
      'Starts Verdale just before this fight, with the party the balance simulator had there.';
    this.layout();
    this.pushOverlay(
      new Menu({
        theme,
        title: 'Checkpoint',
        width: 200,
        items: points.map((p) => ({ label: p.label, hint: p.hint })),
        onSelect: (ci) => {
          const point = points[ci];
          if (!point) return;
          const starters = mod.CHECKPOINT_STARTERS;
          this.pushOverlay(
            new Menu({
              theme,
              title: 'Starter',
              width: 140,
              items: starters.map((s) => ({ label: content.species.require(s).name })),
              onSelect: (si) => {
                const starter = starters[si];
                if (!starter) return;
                try {
                  this.pending = mod.checkpointState(content, point, starter);
                } catch (e) {
                  this.note.text = `Checkpoint failed: ${e instanceof Error ? e.message : e}`;
                  this.layout();
                  return;
                }
                this.newGameMap = 'core:verdale';
                void this.openSlots();
              },
              onBack: () => this.popOverlay(),
            }),
          );
        },
        onBack: () => this.closeOverlays(),
      }),
    );
  }

  /** Writes a checkpoint into a slot (asking first if it holds a save) and plays it. */
  private placeCheckpoint(info: SlotInfo, state: GameState): void {
    const go = async (): Promise<void> => {
      this.pending = undefined;
      await this.options.saves.write(info.slot, state);
      await this.play(info.slot, state);
    };
    if (info.state === 'empty') return void go();
    this.pushOverlay(
      new Menu({
        theme: this.options.theme,
        title: `Overwrite slot ${info.slot}?`,
        width: 140,
        items: [{ label: 'No, keep it' }, { label: 'Yes, overwrite' }],
        onSelect: (i) => (i === 0 ? this.popOverlay() : void go()),
        onBack: () => this.popOverlay(),
      }),
    );
  }

  private slotOptions(info: SlotInfo): void {
    const entries: [string, () => void][] = [];
    if (info.state === 'ok') entries.push(['Continue', () => void this.continueGame(info.slot)]);
    entries.push(
      ['Delete', () => this.confirmDelete(info.slot)],
      ['Back', () => this.popOverlay()],
    );
    this.pushOverlay(
      new Menu({
        theme: this.options.theme,
        title: `Slot ${info.slot}`,
        width: 120,
        items: entries.map(([label]) => ({ label })),
        onSelect: (i) => entries[i]?.[1](),
        onBack: () => this.popOverlay(),
      }),
    );
  }

  private confirmDelete(slot: number): void {
    const menu = new Menu({
      theme: this.options.theme,
      title: `Delete slot ${slot}?`,
      width: 120,
      items: [{ label: 'No, keep it' }, { label: 'Yes, delete' }],
      onSelect: (i) => {
        if (i === 0) return this.popOverlay();
        void this.options.saves.remove(slot).then(() => this.openSlots(slot - 1));
      },
      onBack: () => this.popOverlay(),
    });
    this.pushOverlay(menu);
  }

  private async newGame(slot: number): Promise<void> {
    const { saves, content } = this.options;
    const map = content.maps.require(this.newGameMap);
    const spawn = map.anchors['spawn'];
    const state: GameState = {
      party: this.startParty(),
      place: {
        map: map.id,
        x: spawn?.x ?? 0,
        y: spawn?.y ?? 0,
        facing: spawn?.facing ?? 'down',
      },
      playtime: 0,
    };
    await saves.write(slot, state);
    await this.play(slot, state);
  }

  private async continueGame(slot: number): Promise<void> {
    try {
      const loaded = await this.options.saves.load(slot);
      if (!loaded) return void this.newGame(slot);
      await this.play(slot, loaded.state);
    } catch (e) {
      this.note.text = `Slot ${slot} cannot be loaded: ${e instanceof Error ? e.message : e}`;
      this.layout();
    }
  }

  private async play(slot: number, state: GameState): Promise<void> {
    const { engine, saves } = this.options;
    this.closeOverlays();
    const queue = new SaveQueue((s) => saves.write(slot, s));
    const scene = this.worldScene(slot, state, queue);
    this.reportParty(state.party);
    await engine.scenes.push(scene, { transition: engine.iris(() => scene.playerScreen()) });
  }

  /** The overworld of `state`'s map; travel to another map replaces it (C34). */
  private worldScene(slot: number, state: GameState, queue: SaveQueue): OverworldScene {
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
      save: (s) => queue.save(s),
      onParty: (p) => this.reportParty(p),
      seed: this.seed++,
      onTravel: (next) => {
        const to = this.worldScene(slot, next, queue);
        void engine.scenes.replace(to, { transition: engine.fade({ duration: 0.4 }) });
      },
      onExit: () => {
        this.world = undefined;
        void queue
          .idle()
          .catch(() => undefined)
          .then(() => this.openSlots(slot - 1));
        void engine.scenes.pop({ transition: engine.iris(() => scene.playerScreen()) });
      },
    });
    this.world = scene;
    return scene;
  }

  private pushOverlay(menu: Menu): void {
    this.overlays.push(menu);
    this.stack.push(menu);
    this.layout();
  }

  private popOverlay(): void {
    const menu = this.overlays.pop();
    if (menu) this.stack.remove(menu);
    this.layout();
  }

  private closeOverlays(): void {
    while (this.overlays.length) this.popOverlay();
  }

  private async openMap(mapId: string): Promise<void> {
    const { engine, content, input } = this.options;
    const scene = new MapViewerScene({
      content,
      input,
      mapId,
      onExit: () => void engine.scenes.pop({ transition: engine.fade({ duration: 0.25 }) }),
    });
    await engine.scenes.push(scene, { transition: engine.fade({ duration: 0.25 }) });
  }

  private reportParty(p: Party): void {
    const { content } = this.options;
    const team = p.team
      .map((z) => `${displayName(content, z)} Lv ${z.level} ${z.hp}/${statsOf(content, z).hp}`)
      .join(' · ');
    this.note.text = `Overworld team: ${team}${p.storage.length ? ` · storage ${p.storage.length}` : ''}`;
    this.layout();
  }

  private report(b: SampleBattle, seed: number, r: BattleResult): void {
    const { content } = this.options;
    const outcome = {
      win: 'You won',
      lose: 'You lost',
      ran: 'You ran away',
      caught: `Caught ${r.caught ? displayName(content, r.caught) : ''}`,
    }[r.outcome];
    const xp = r.xp > 0 ? ` · +${r.xp} XP each` : '';
    this.note.text = `Last: ${b.label} (seed ${seed}): ${outcome}${xp}.`;
    this.layout();
  }

  private layout(): void {
    const w = 240;
    const x = Math.round((this.width - w) / 2);
    const menuH = this.menu.height;
    const h = 40 + menuH + 12 + Math.max(14, Math.ceil(this.note.height));
    const y = Math.round((this.height - h) / 2);
    drawPaper(this.panel.clear(), x, y, w, h);
    this.title.position.set(x + 10, y + 6);
    this.status.position.set(x + 10, y + 20);
    this.menu.view.position.set(x + 10, y + 36);
    this.note.position.set(x + 10, y + 40 + menuH + 6);
    this.overlays.forEach((m, i) => m.view.position.set(x + 20 + i * 10, y + 44 + i * 10));
  }
}

function slotItem(info: SlotInfo): MenuItem {
  const n = `Slot ${info.slot}`;
  switch (info.state) {
    case 'empty':
      return { label: `${n} · empty`, hint: 'New' };
    case 'broken':
      return { label: `${n} · can't read`, hint: '!' };
    case 'ok':
      return {
        label: `${n} · ${info.summary.lead} Lv ${info.summary.level}`,
        hint: formatPlaytime(info.summary.playtime),
      };
  }
}

function slotDetail(info: SlotInfo): string {
  switch (info.state) {
    case 'empty':
      return `Slot ${info.slot}: empty. E starts a new game here.`;
    case 'broken':
      return `Slot ${info.slot}: ${info.problems.join('; ')}`;
    case 'ok': {
      const s = info.summary;
      const backup = info.fromBackup ? ' · from backup' : '';
      return `${s.place} · ${s.caught} caught · ${shortDate(s.savedAt)}${backup}`;
    }
  }
}

/** "13 Nov, 08:49" in local time. */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '?';
  const month = d.toLocaleString('en', { month: 'short' });
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${d.getDate()} ${month}, ${time}`;
}
