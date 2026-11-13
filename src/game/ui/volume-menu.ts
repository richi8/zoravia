/**
 * Sound settings menu (C24): master, music and effects volume in 10 % steps.
 * Keyboard: W/S choose, A/D change, E steps up (wrapping to Off), Q back. Each change plays a
 * short sound at the new volume. The settings screen (C33) can reuse it.
 */

import type { Container } from 'pixi.js';
import { Menu, uiSound, type UiInput, type UiTheme, type Widget } from '@engine/ui';
import {
  AUDIO_CHANNELS,
  audioSettings,
  formatVolume,
  playSfx,
  setVolume,
  stepVolume,
  type AudioChannel,
} from '@game/audio';

const LABELS: Record<AudioChannel, string> = {
  master: 'Master volume',
  music: 'Music',
  sfx: 'Sound effects',
};

export interface VolumeMenuOptions {
  readonly theme: UiTheme;
  readonly width?: number;
  readonly onBack: (menu: VolumeMenu) => void;
}

export class VolumeMenu implements Widget<Container> {
  private readonly menu: Menu;

  constructor(private readonly options: VolumeMenuOptions) {
    this.menu = new Menu({
      theme: options.theme,
      title: 'Sound',
      width: options.width ?? 170,
      items: this.items(),
      onSelect: (i) => this.change(i, 1, true),
      onBack: () => options.onBack(this),
    });
  }

  get view(): Container {
    return this.menu.view;
  }

  get width(): number {
    return this.menu.width;
  }

  get height(): number {
    return this.menu.height;
  }

  focus(): void {
    this.menu.focus();
  }

  blur(): void {
    this.menu.blur();
  }

  contains(x: number, y: number): boolean {
    return this.menu.contains(x, y);
  }

  dismiss(): void {
    this.options.onBack(this);
  }

  handleInput(input: UiInput): void {
    const dir = input.direction();
    if (dir === 'left' || dir === 'right') {
      this.change(this.menu.index, dir === 'right' ? 1 : -1, false);
      return;
    }
    this.menu.handleInput(input);
  }

  private items(): { label: string; hint: string }[] {
    const s = audioSettings();
    return AUDIO_CHANNELS.map((c) => ({ label: LABELS[c], hint: formatVolume(s[c]) }));
  }

  /** Steps a volume; `wrap` goes from 100 % back to Off (E cycles). */
  private change(index: number, steps: number, wrap: boolean): void {
    const channel = AUDIO_CHANNELS[index];
    if (!channel) return;
    const now = audioSettings()[channel];
    const next = wrap && now >= 1 ? 0 : stepVolume(now, steps);
    if (next === now) {
      uiSound('blocked');
      return;
    }
    setVolume(channel, next);
    this.menu.setItems(this.items());
    this.menu.cursor.set(index);
    this.menu.focus();
    // E already ticks (the menu's select sound); arrows preview the new level on that bus.
    if (!wrap) playSfx('ui.select', channel === 'music' ? { bus: 'music' } : {});
  }
}
