/**
 * Debug launcher (C18): starts sample battles with the core pack's test Zorlings until the
 * world (C19+) and the start flow (C33) exist, opens the overworld from a save slot (C23:
 * continue, new game, delete) and the region map viewer (C19). Keyboard: W/S choose, E start,
 * Q back, E change a setting. Every battle starts from fresh teams; the last result shows at
 * the bottom. While the overworld is open, hiding the tab autosaves.
 */

import { Container, Graphics } from 'pixi.js';
import type { InputManager } from '@engine/input';
import type { Engine } from '@engine/render/engine';
import type { Scene } from '@engine/scenes/scene-manager';
import { FocusStack, Menu, type MenuItem, type UiInput, type UiTheme } from '@engine/ui';
import { bossZorling, type BattleResult, type BattleSetup } from '@game/battle/logic';
import { BATTLE_SPEEDS, BattleScene } from '@game/battle/scene/battle-scene';
import { battleTransition } from '@game/battle/scene/transition';
import { audioSettings, formatVolume } from '@game/audio';
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
import { VolumeMenu } from '@game/ui/volume-menu';
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
}

const BAG = { 'core:potion': 3, 'core:super-potion': 2, 'core:zorb': 5 };

export class DebugLauncherScene implements Scene<Container> {
  readonly id = 'debug-launcher';
  readonly view = new Container({ label: 'world:launcher' });
  readonly ui = new Container({ label: 'ui:launcher' });
  private readonly bg = new Graphics();
  private readonly panel = new Graphics();
  private readonly title = uiText('name', 'Zoravia · battle test launcher (C18)', paper.title);
  private readonly note = uiText('body', '', paper.ink, { wordWrap: true, wordWrapWidth: 220 });
  private readonly status = uiText(
    'body',
    'Pick a battle. W/S choose · E start · Q back',
    paper.inkDim,
  );
  private readonly layer = new Container();
  private readonly stack: FocusStack<Container>;
  private menu!: Menu;
  private speed = 0;
  private confirmSwitch = false;
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
    this.stack = new FocusStack<Container>(
      { attach: (v) => this.layer.addChild(v), detach: (v) => this.layer.removeChild(v) },
      options.ui,
    );
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
  }

  update(dt: number): void {
    this.stack.update(dt);
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
        label: 'Legendary: Glacivar',
        hint: 'Lv 40',
        setup: (seed) => ({
          kind: 'wild',
          seed,
          player: team(40, 'thornwing', 'torrentoad', 'infernyx'),
          opponent: [bossZorling(content, 'core:glacivar', { uid: 'boss' })],
          boss: { id: 'core:glacivar' },
          bag: { 'core:super-potion': 4, 'core:max-potion': 1, 'core:zorb': 2 },
        }),
      },
    ];
  }

  private buildMenu(index: number): void {
    const battles = this.battles;
    const items: MenuItem[] = [
      ...battles.map((b) => ({ label: b.label, hint: b.hint })),
      { label: 'Play: test region', hint: 'Saves' },
      { label: 'Map viewer: test region', hint: 'C19' },
      { label: 'Battle speed', hint: `${BATTLE_SPEEDS[this.speed] ?? 1}×` },
      { label: 'Confirm 1 2 3 switch', hint: this.confirmSwitch ? 'On' : 'Off' },
      { label: 'Sound', hint: formatVolume(audioSettings().master) },
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
        else if (i === battles.length) void this.openSlots();
        else if (i === battles.length + 1) void this.openMap('core:test-region');
        else if (i === battles.length + 2) {
          this.speed = (this.speed + 1) % BATTLE_SPEEDS.length;
          this.buildMenu(i);
        } else if (i === battles.length + 3) {
          this.confirmSwitch = !this.confirmSwitch;
          this.buildMenu(i);
        } else {
          this.openSound(i);
        }
      },
    });
    this.menu.cursor.set(index);
    this.stack.push(this.menu);
    this.layout();
  }

  private openSound(index: number): void {
    const menu = new VolumeMenu({
      theme: this.options.theme,
      width: 200,
      onBack: () => {
        this.stack.remove(menu);
        this.buildMenu(index);
      },
    });
    this.stack.push(menu);
    menu.view.position.set(
      this.menu.view.x + Math.round((this.menu.width - menu.width) / 2),
      this.menu.view.y + Math.round((this.menu.height - menu.height) / 2),
    );
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
      speed: BATTLE_SPEEDS[this.speed] ?? 1,
      money: 1240,
      confirmHotbarSwitch: this.confirmSwitch,
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
        if (info.state === 'empty') void this.newGame(info.slot);
        else this.slotOptions(info);
      },
      onHighlight: (i) => detail(i),
      onBack: () => this.closeOverlays(),
    });
    menu.cursor.set(Math.min(index, SLOT_COUNT - 1));
    detail(menu.cursor.index);
    this.pushOverlay(menu);
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
    const map = content.maps.require('core:test-region');
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
    const { engine, content, input, ui, theme, saves } = this.options;
    this.closeOverlays();
    const queue = new SaveQueue((s) => saves.write(slot, s));
    const scene = new OverworldScene({
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
      battleSpeed: BATTLE_SPEEDS[this.speed] ?? 1,
      confirmHotbarSwitch: this.confirmSwitch,
      seed: this.seed++,
      onExit: () => {
        this.world = undefined;
        void queue
          .idle()
          .catch(() => undefined)
          .then(() => this.openSlots(slot - 1));
        void engine.scenes.pop({ transition: engine.fade({ duration: 0.25 }) });
      },
    });
    this.world = scene;
    this.reportParty(state.party);
    await engine.scenes.push(scene, { transition: engine.fade({ duration: 0.25 }) });
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
