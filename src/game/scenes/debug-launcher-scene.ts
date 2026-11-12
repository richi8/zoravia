/**
 * Debug launcher (C18): starts sample battles with the core pack's test Zorlings until the
 * world (C19+) and the start flow (C33) exist, and opens the overworld (C20) and the region map
 * viewer (C19). Keyboard: W/S choose, E start, A/D or E change
 * a setting. Every battle starts from fresh teams; the last result shows at the bottom.
 */

import { Container, Graphics } from 'pixi.js';
import type { InputManager } from '@engine/input';
import type { Engine } from '@engine/render/engine';
import type { Scene } from '@engine/scenes/scene-manager';
import { FocusStack, Menu, type MenuItem, type UiInput, type UiTheme } from '@engine/ui';
import { bossZorling, type BattleResult, type BattleSetup } from '@game/battle/logic';
import { BATTLE_SPEEDS, BattleScene } from '@game/battle/scene/battle-scene';
import { battleTransition } from '@game/battle/scene/transition';
import type { GameContent } from '@game/data';
import type { Action } from '@game/input/actions';
import { createZorling, displayName, type Zorling } from '@game/progression';
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
}

const BAG = { 'core:potion': 3, 'core:super-potion': 2, 'core:zorb': 5 };

export class DebugLauncherScene implements Scene<Container> {
  readonly id = 'debug-launcher';
  readonly view = new Container({ label: 'world:launcher' });
  readonly ui = new Container({ label: 'ui:launcher' });
  private readonly bg = new Graphics();
  private readonly panel = new Graphics();
  private readonly title = uiText('name', 'Zoravia · battle test launcher (C18)', paper.title);
  private readonly note = uiText('body', '');
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
      { label: 'Overworld: test region', hint: 'C20' },
      { label: 'Map viewer: test region', hint: 'C19' },
      { label: 'Battle speed', hint: `${BATTLE_SPEEDS[this.speed] ?? 1}×` },
      { label: 'Confirm 1 2 3 switch', hint: this.confirmSwitch ? 'On' : 'Off' },
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
        else if (i === battles.length) void this.openWorld('core:test-region');
        else if (i === battles.length + 1) void this.openMap('core:test-region');
        else if (i === battles.length + 2) {
          this.speed = (this.speed + 1) % BATTLE_SPEEDS.length;
          this.buildMenu(i);
        } else {
          this.confirmSwitch = !this.confirmSwitch;
          this.buildMenu(i);
        }
      },
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

  private async openWorld(mapId: string): Promise<void> {
    const { engine, content, input } = this.options;
    const scene = new OverworldScene({
      content,
      input,
      mapId,
      onExit: () => void engine.scenes.pop({ transition: engine.fade({ duration: 0.25 }) }),
    });
    await engine.scenes.push(scene, { transition: engine.fade({ duration: 0.25 }) });
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
    const h = 40 + menuH + 26;
    const y = Math.round((this.height - h) / 2);
    drawPaper(this.panel.clear(), x, y, w, h);
    this.title.position.set(x + 10, y + 6);
    this.status.position.set(x + 10, y + 20);
    this.menu.view.position.set(x + 10, y + 36);
    this.note.position.set(x + 10, y + 40 + menuH + 6);
  }
}
