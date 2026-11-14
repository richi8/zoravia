/**
 * Settings menu (C33): the title screen's and the pause menu's Settings. Battle speed, text
 * speed, the `1 2 3` switch prompt, comfort options, Sound (the C24 volume menu) and Controls
 * (key rebinding). Values apply at once and are stored on the device (`@game/settings`).
 *
 * Keyboard: W/S choose, A/D change a value, E changes it too (or opens Sound / Controls),
 * Q back. Each row has a short explanation under the menu.
 */

import { Container, Graphics } from 'pixi.js';
import type { Bindings, KeyCode } from '@engine/input';
import { Menu, uiSound, type MenuItem, type UiInput, type UiTheme, type Widget } from '@engine/ui';
import type { Action } from '@game/input/actions';
import {
  BATTLE_SPEEDS,
  cycle,
  gameSettings,
  TEXT_SPEEDS,
  updateSettings,
  type GameSettings,
} from '@game/settings';
import { paper } from '../style/tokens';
import { KeysPanel } from './keys-panel';
import { drawPaper } from './skin';
import { uiText } from './text';
import { VolumeMenu } from './volume-menu';

/** A widget with a size, so the host can place it. */
export type SizedWidget = Widget<Container> & { readonly width: number; readonly height: number };

export interface SettingsMenuOptions {
  readonly theme: UiTheme;
  readonly bindings: Bindings<Action>;
  /** The first key pressed this step, any key (for the Controls screen). */
  readonly capture: () => KeyCode | undefined;
  /** Opens a sub-screen on top (Sound, Controls). */
  readonly open: (widget: SizedWidget) => void;
  /** Closes a sub-screen opened with `open`. */
  readonly close: (widget: SizedWidget) => void;
  readonly onBack: (menu: SettingsMenu) => void;
}

type Toggle = 'confirmSwitch' | 'shake' | 'flashes' | 'muteHidden';

interface Row {
  readonly label: string;
  readonly help: string;
  value?(s: GameSettings): string;
  change?(step: number): void;
  open?(): void;
}

const WIDTH = 200;
const HELP_H = 34;
const onOff = (b: boolean): string => (b ? 'On' : 'Off');
const TEXT_LABEL = { slow: 'Slow', normal: 'Normal', fast: 'Fast' } as const;

export class SettingsMenu implements SizedWidget {
  readonly view = new Container({ label: 'settings' });
  private readonly menu: Menu;
  private readonly helpBg = new Graphics();
  private readonly help = uiText('body', '', paper.inkDim, {
    wordWrap: true,
    wordWrapWidth: WIDTH - 14,
  });
  private readonly rows: Row[];

  constructor(private readonly options: SettingsMenuOptions) {
    const toggle = (key: Toggle): Pick<Row, 'value' | 'change'> => ({
      value: (s) => onOff(s[key]),
      change: () => updateSettings({ [key]: !gameSettings()[key] }),
    });
    this.rows = [
      {
        label: 'Battle speed',
        help: 'How fast battle animations and captions play.',
        value: (s) => `${s.battleSpeed}×`,
        change: (step) =>
          updateSettings({ battleSpeed: cycle(BATTLE_SPEEDS, gameSettings().battleSpeed, step) }),
      },
      {
        label: 'Text speed',
        help: 'How fast dialogue text appears. Hold E to speed it up.',
        value: (s) => TEXT_LABEL[s.textSpeed],
        change: (step) =>
          updateSettings({ textSpeed: cycle(TEXT_SPEEDS, gameSettings().textSpeed, step) }),
      },
      {
        label: 'Confirm 1 2 3 switch',
        help: 'Ask before switching Zorlings with 1 2 3 in battle.',
        ...toggle('confirmSwitch'),
      },
      { label: 'Screen shake', help: 'Shake on big hits and bumps.', ...toggle('shake') },
      {
        label: 'Flashes',
        help: 'White full-screen flashes (battle start, evolution).',
        ...toggle('flashes'),
      },
      {
        label: 'Sound',
        help: 'Master, music and sound effect volumes.',
        open: () => this.openSound(),
      },
      {
        label: 'Mute when hidden',
        help: 'Silence the game while its tab or window is in the background.',
        ...toggle('muteHidden'),
      },
      {
        label: 'Controls',
        help: 'Change the keys. Esc always stays Back and Menu.',
        open: () => this.openKeys(),
      },
    ];
    this.menu = new Menu({
      theme: options.theme,
      title: 'Settings',
      width: WIDTH,
      items: this.items(),
      onSelect: (i) => this.select(i),
      onBack: () => options.onBack(this),
      onHighlight: (i) => this.showHelp(i),
    });
    this.view.addChild(this.helpBg, this.help, this.menu.view);
    this.showHelp(0);
  }

  get width(): number {
    return WIDTH;
  }

  get height(): number {
    return this.menu.height + HELP_H + 2;
  }

  focus(): void {
    this.menu.focus();
  }

  blur(): void {
    this.menu.blur();
  }

  contains(x: number, y: number): boolean {
    const p = this.view.toLocal({ x, y });
    return p.x >= 0 && p.y >= 0 && p.x <= this.width && p.y <= this.height;
  }

  dismiss(): void {
    this.options.onBack(this);
  }

  handleInput(input: UiInput): void {
    const dir = input.direction();
    if (dir === 'left' || dir === 'right') {
      const row = this.rows[this.menu.index];
      if (row?.change) {
        row.change(dir === 'right' ? 1 : -1);
        uiSound('move');
        this.refresh();
      } else uiSound('blocked');
      return;
    }
    this.menu.handleInput(input);
  }

  private select(i: number): void {
    const row = this.rows[i];
    if (row?.open) row.open();
    else if (row?.change) {
      row.change(1);
      this.refresh();
    }
  }

  private items(): MenuItem[] {
    const s = gameSettings();
    return this.rows.map((r) => ({ label: r.label, hint: r.value ? r.value(s) : '›' }));
  }

  private refresh(): void {
    const i = this.menu.index;
    this.menu.setItems(this.items());
    this.menu.cursor.set(i);
    this.menu.focus();
  }

  private showHelp(i: number): void {
    this.help.text = this.rows[i]?.help ?? '';
    const y = this.menu.height + 2;
    drawPaper(this.helpBg.clear(), 0, y, WIDTH, HELP_H);
    this.help.position.set(7, y + 5);
  }

  private openSound(): void {
    const menu = new VolumeMenu({
      theme: this.options.theme,
      width: 180,
      onBack: () => this.options.close(menu),
    });
    this.options.open(menu);
  }

  private openKeys(): void {
    const panel: KeysPanel = new KeysPanel({
      bindings: this.options.bindings,
      capture: this.options.capture,
      onBack: () => this.options.close(panel),
    });
    this.options.open(panel);
  }
}
