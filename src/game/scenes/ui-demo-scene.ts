/**
 * C06 demo: nested menus, a grid menu, toggles, disabled items and dialog boxes — all usable
 * by keyboard alone and by mouse alone. Placeholder content only (not game data).
 */

import { Container, Text } from 'pixi.js';
import type { Engine } from '@engine/render/engine';
import type { Scene } from '@engine/scenes/scene-manager';
import {
  DEFAULT_THEME,
  DialogBox,
  FocusStack,
  Menu,
  type MenuItem,
  type UiInput,
  type UiTheme,
  type Widget,
} from '@engine/ui';
import { PlaceholderScene } from './placeholder-scene';

const GAP = 12;

/** Layout numbers below are for a 20 px theme font; they scale with the theme. */
const BASE_FONT = 20;

export class UiDemoScene implements Scene<Container> {
  readonly id = 'ui-demo';
  readonly view = new Container({ label: 'scene:ui-demo' });
  /** Everything here is UI: drawn in the native-resolution UI layer. */
  readonly ui = new Container({ label: 'ui:ui-demo' });
  private readonly layer = new Container();
  private readonly stack: FocusStack<Container>;
  private readonly layouts = new Map<Widget<Container>, () => void>();
  private readonly header: Text;
  private readonly status: Text;
  private readonly root: Menu;
  private width = 0;
  private height = 0;
  private settings = { textSpeed: 1, confirmSwitch: true };

  constructor(
    private readonly engine: Engine,
    private readonly input: UiInput,
    private readonly theme: UiTheme = DEFAULT_THEME,
  ) {
    const font = theme.font.family;
    const u = (n: number): number => this.u(n);
    this.header = new Text({
      text:
        'UI framework demo\n' +
        'Keyboard: WASD / arrows move · E / Enter / Space select (hold E = faster text) · Q / Esc back\n' +
        'Mouse: hover to highlight · click to select / advance text · right-click back',
      style: {
        fontFamily: font,
        fontSize: Math.max(8, u(14)),
        fill: theme.colors.textDim,
        lineHeight: Math.max(10, u(20)),
      },
    });
    this.status = new Text({
      text: 'Ready.',
      style: { fontFamily: font, fontSize: Math.max(8, u(14)), fill: theme.colors.accent },
    });
    this.ui.addChild(this.header, this.layer, this.status);

    this.stack = new FocusStack<Container>(
      { attach: (v) => this.layer.addChild(v), detach: (v) => this.layer.removeChild(v) },
      input,
    );

    this.root = new Menu({
      theme,
      title: 'Menu',
      items: [
        { label: 'Party' },
        { label: 'Bag' },
        { label: 'Talk' },
        { label: 'Settings' },
        { label: 'Fade test' },
        { label: 'Locked', disabled: true },
      ],
      onSelect: (i, menu) => this.onRoot(i, menu),
      onBack: () => this.setStatus('Already at the top menu.'),
      onHighlight: (i, menu) => this.setStatus(`Highlight: ${menu.selectedItem?.label ?? i}`),
    });
    this.open(this.root, () => this.root.view.position.set(this.u(32), this.u(96)));
  }

  enter(): void {
    this.layoutAll();
  }

  update(dt: number): void {
    this.stack.update(dt);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.header.position.set(this.u(32), this.u(16));
    this.status.position.set(this.u(32), height - this.u(32));
    this.layoutAll();
  }

  // ------------------------------------------------------------------ menus

  private onRoot(index: number, menu: Menu): void {
    switch (index) {
      case 0:
        return this.openParty(menu);
      case 1:
        return this.openBag(menu);
      case 2:
        return this.say(
          [
            'Welcome to Zoravia! This box types its text one letter at a time.',
            'Hold E to make it type faster. Press Q to show the whole page at once.',
            'Press E (or click) on a finished page to continue. That was the last page!',
          ],
          'Guide',
        );
      case 3:
        return this.openSettings(menu);
      case 4:
        return this.fadeTest();
    }
  }

  private openParty(parent: Menu): void {
    const names = ['Emberfox  Lv 5', 'Ripplet  Lv 4', 'Gustling  Lv 6'];
    const party: Menu = new Menu({
      theme: this.theme,
      title: 'Party',
      items: names.map((label) => ({ label })),
      onSelect: (i, m) => this.openPartyActions(m, names[i] ?? '?'),
      onBack: (m) => this.close(m),
    });
    this.open(party, () => this.rightOf(party, parent));
  }

  private openPartyActions(parent: Menu, name: string): void {
    const actions: Menu = new Menu({
      theme: this.theme,
      items: [{ label: 'Summary' }, { label: 'Swap' }, { label: 'Cancel' }],
      onSelect: (i, m) => {
        if (i === 0) this.say([`${name.split(' ')[0]} is a placeholder Zorling.`], 'Summary');
        else if (i === 1) {
          this.setStatus(`Swap ${name.split(' ')[0]} (demo).`);
          this.close(m);
        } else this.close(m);
      },
      onBack: (m) => this.close(m),
    });
    this.open(actions, () => {
      const row = Math.max(0, parent.index);
      this.rightOf(
        actions,
        parent,
        row * (this.theme.font.lineHeight + this.theme.spacing.item * 2),
      );
    });
  }

  private openBag(parent: Menu): void {
    const items: MenuItem[] = [
      { label: 'Potion ×3' },
      { label: 'Super Potion ×1' },
      { label: 'Net ×5' },
      { label: 'Berry ×2' },
      { label: 'Map' },
      { label: 'Empty', disabled: true },
      { label: 'Rope' },
      { label: 'Lantern' },
    ];
    const bag: Menu = new Menu({
      theme: this.theme,
      title: 'Bag (grid)',
      columns: 3,
      items,
      onSelect: (i) => this.say([`You used ${items[i]?.label.split(' ×')[0] ?? '?'}. (demo)`]),
      onBack: (m) => this.close(m),
    });
    this.open(bag, () => this.rightOf(bag, parent));
  }

  private openSettings(parent: Menu): void {
    const speeds = ['Slow', 'Normal', 'Fast'];
    const label = (i: number): string =>
      i === 0
        ? `Text speed: ${speeds[this.settings.textSpeed]}`
        : `Switch confirm: ${this.settings.confirmSwitch ? 'On' : 'Off'}`;
    const settings: Menu = new Menu({
      theme: this.theme,
      title: 'Settings',
      width: this.u(300),
      items: [{ label: label(0) }, { label: label(1) }, { label: 'Done' }],
      onSelect: (i, m) => {
        if (i === 0) this.settings.textSpeed = (this.settings.textSpeed + 1) % speeds.length;
        else if (i === 1) this.settings.confirmSwitch = !this.settings.confirmSwitch;
        else return this.close(m);
        m.setLabel(i, label(i));
        this.setStatus(`Changed: ${label(i)}`);
      },
      onBack: (m) => this.close(m),
    });
    this.open(settings, () => this.rightOf(settings, parent));
  }

  private fadeTest(): void {
    const scene = new PlaceholderScene({
      id: 'fade-test',
      title: 'Fade test',
      background: 0x1f2a4d,
      accent: 0x8fb4ff,
      hint: 'E / Q / click — go back',
      input: this.input,
      onLeave: () => void this.engine.scenes.pop({ transition: this.engine.fade() }),
    });
    void this.engine.scenes.push(scene, { transition: this.engine.fade() });
  }

  // ------------------------------------------------------------------ helpers

  /** A layout length designed for a 20 px theme font, scaled to the current theme. */
  private u(n: number): number {
    return Math.round((n * this.theme.font.size) / BASE_FONT);
  }

  private say(pages: readonly string[], speaker?: string): void {
    const speed = [20, 40, 80][this.settings.textSpeed] ?? 40;
    const theme = { ...this.theme, motion: { ...this.theme.motion, textSpeed: speed } };
    const dialog: DialogBox = new DialogBox({
      theme,
      pages,
      width: Math.min(this.u(720), Math.max(this.u(320), this.width - this.u(64))),
      ...(speaker ? { speaker } : {}),
      onDone: (d) => {
        this.close(d);
        this.setStatus('Dialog finished.');
      },
    });
    this.open(dialog, () =>
      dialog.view.position.set(
        (this.width - dialog.width) / 2,
        this.height - dialog.height - this.u(56),
      ),
    );
  }

  private open(widget: Widget<Container>, layout: () => void): void {
    this.layouts.set(widget, layout);
    layout();
    this.stack.push(widget);
  }

  private close(widget: Widget<Container>): void {
    this.stack.remove(widget);
    // Removing a widget also removes everything above it.
    for (const w of [...this.layouts.keys()]) if (!this.stack.includes(w)) this.layouts.delete(w);
  }

  private rightOf(menu: Menu, parent: Menu, dy = 0): void {
    const x = parent.view.x + parent.width + this.u(GAP);
    const fits = x + menu.width <= this.width - this.u(16);
    menu.view.position.set(
      fits ? x : Math.max(this.u(16), this.width - menu.width - this.u(16)),
      parent.view.y + dy + (fits ? 0 : this.u(24)),
    );
  }

  private layoutAll(): void {
    for (const layout of this.layouts.values()) layout();
  }

  private setStatus(text: string): void {
    this.status.text = text;
  }
}
