/**
 * C10 UI kit sheet: every piece on one game screen — type badges, condition chips, HP/XP
 * bars, hotbar, key hints, callouts, toast, battle text, speaker dialog and a confirm menu.
 * Tooltips work on hover and with `F` (inspect).
 */

import { Container, Graphics } from 'pixi.js';
import type { InputManager } from '@engine/input';
import { pixelTexture } from '@engine/render/pixel-texture';
import type { Scene } from '@engine/scenes/scene-manager';
import {
  DialogBox,
  FocusStack,
  InspectWidget,
  Menu,
  TooltipLayer,
  type UiInput,
  type UiTheme,
} from '@engine/ui';
import type { Action } from '@game/input/actions';
import { CONDITION_IDS, TYPE_IDS, conditionColors, ink, paper } from '@game/style/tokens';
import { ConditionChip, KeyHint, TypeBadge, row } from '@game/ui/badges';
import { HpBar, XpBar } from '@game/ui/bars';
import { Hotbar, type CombatantView } from '@game/ui/battle-hud';
import { Callout, EffectsLayer, FloatNumber, Toast } from '@game/ui/callout';
import { MessageBox } from '@game/ui/panels';
import { uiText } from '@game/ui/text';
import { renderZorling } from '@game/zorlings/render';
import { TEAM, conditionTooltip, typeTooltip } from './data';

export class KitScene implements Scene<Container> {
  readonly id = 'ui-kit';
  readonly view = new Container({ label: 'world:ui-kit' });
  readonly ui = new Container({ label: 'ui:ui-kit' });
  private readonly bg = new Graphics();
  private readonly content = new Container();
  private readonly stackLayer = new Container();
  private readonly effects = new EffectsLayer();
  private readonly tooltips: TooltipLayer;
  private readonly stack: FocusStack<Container>;
  private readonly confirm: Menu;
  private readonly liveBar = new HpBar(64);
  private dialog: DialogBox | undefined;
  private registered: Container[] = [];
  private t = 0;
  private next = 0.3;
  private beat = 0;
  private width = 480;
  private height = 270;

  constructor(
    private readonly input: InputManager<Action>,
    ui: UiInput,
    private readonly theme: UiTheme,
  ) {
    this.view.addChild(this.bg);
    this.tooltips = new TooltipLayer({
      theme,
      area: () => ({ width: this.width, height: this.height }),
    });
    this.ui.addChild(this.content, this.effects, this.stackLayer, this.tooltips.view);
    this.stack = new FocusStack<Container>(
      {
        attach: (v) => this.stackLayer.addChild(v),
        detach: (v) => this.stackLayer.removeChild(v),
      },
      ui,
    );
    this.confirm = new Menu({
      theme,
      title: 'Switch?',
      width: 76,
      items: [{ label: 'Yes' }, { label: 'No' }],
      onSelect: () => this.effects.add(new Toast('Confirmed.'), this.width - 120, 8),
    });
  }

  get state(): { top: string; tooltip: { title: string; body: string } | undefined } {
    return {
      top: this.stack.top?.view.label ?? '',
      tooltip: this.tooltips.visible ? this.tooltips.text : undefined,
    };
  }

  enter(): void {
    this.stack.push(this.confirm);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.bg.clear().rect(0, 0, width, height).fill({ color: ink[900] });
    this.build();
  }

  update(dt: number): void {
    if (this.input.pressed('inspect')) {
      const top = this.stack.top;
      if (top instanceof InspectWidget) this.stack.remove(top);
      else
        this.stack.push(
          new InspectWidget({
            layer: this.tooltips,
            color: paper.cursor,
            onClose: (w) => this.stack.remove(w),
          }),
        );
    }
    this.stack.update(dt);
    this.tooltips.update(dt);
    this.liveBar.update(dt);
    this.dialog?.update(dt);
    this.effects.update(dt);
    this.t += dt;
    if (this.t >= this.next) {
      this.next = this.t + 1.6;
      this.demoBeat();
    }
  }

  private demoBeat(): void {
    const b = this.beat++ % 4;
    const cx = 330;
    const cy = 138;
    if (b === 0) {
      this.effects.add(new Callout('Wildfire! ×2'), cx, cy);
      this.liveBar.set(0.25);
    } else if (b === 1) {
      this.effects.add(new FloatNumber(24), cx - 50, cy);
      this.effects.add(new FloatNumber(20, true), cx + 50, cy);
    } else if (b === 2) {
      this.effects.add(new Callout('Super effective!', paper.cursor, 16), cx, cy);
      this.liveBar.set(1);
    } else {
      this.effects.add(new Toast('Saved your game.'), cx - 50, cy - 8);
    }
  }

  private build(): void {
    for (const c of this.content.children) this.tooltips.unregister(c);
    for (const c of this.registered) this.tooltips.unregister(c);
    this.registered = [];
    for (const c of this.content.removeChildren()) c.destroy({ children: true });
    const register = (c: Container, source: () => { title: string; body?: string }): void => {
      this.tooltips.register(c, source);
      this.registered.push(c);
    };
    const add = <T extends Container>(c: T, x: number, y: number): T => {
      c.position.set(Math.round(x), Math.round(y));
      this.content.addChild(c);
      return c;
    };
    const heading = (t: string, x: number, y: number): void => {
      add(uiText('label', t, ink[300]), x, y);
    };

    heading('Type badges', 8, 4);
    const badges = TYPE_IDS.map((t) => {
      const b = new TypeBadge(t);
      this.content.addChild(b);
      register(b, () => typeTooltip(t));
      return b;
    });
    row(badges, 4, 8, 14);

    heading('Conditions · pips = turns left · hover or press F', 8, 30);
    CONDITION_IDS.forEach((c, i) => {
      const x = 8 + (i % 4) * 82;
      const y = 40 + Math.floor(i / 4) * 17;
      const chip = add(new ConditionChip(c, 3 - (i % 3)), x, y);
      register(chip, () => conditionTooltip(c, 3 - (i % 3)));
      add(uiText('body', conditionColors[c].label, ink[50]), x + 14, y - 1);
    });

    heading('HP · XP', 8, 76);
    [1, 0.45, 0.15].forEach((r, i) => {
      const bar = add(new HpBar(64), 8 + i * 70, 86);
      bar.set(r, false);
    });
    add(this.liveBar, 218, 86);
    add(new XpBar(64, 0.6), 288, 87);

    heading('Hotbar', 8, 96);
    const portraits = TEAM.map((z) => pixelTexture(renderZorling(z.genome, { size: 32 })));
    const team: CombatantView[] = TEAM.map((z, i) => ({
      name: z.name,
      level: z.level,
      types: z.genome.types,
      hp: [z.maxHp, Math.round(z.maxHp * 0.6), 4][i] ?? z.maxHp,
      maxHp: z.maxHp,
      conditions: [],
      ...(portraits[i] ? { portrait: portraits[i] } : {}),
    }));
    const hotbar = add(
      new Hotbar({
        layer: this.tooltips,
        type: typeTooltip,
        condition: conditionTooltip,
        zorling: (v, slot) => ({ title: `${slot + 1} · ${v.name}`, body: `HP ${v.hp}/${v.maxHp}` }),
      }),
      8,
      106,
    );
    hotbar.set(team, 0);

    heading('Key hints', 130, 96);
    const hints = [
      new KeyHint('E', 'Select'),
      new KeyHint('Q', 'Back'),
      new KeyHint('1-3', 'Switch'),
      new KeyHint('F', 'Info'),
    ];
    for (const h of hints) this.content.addChild(h);
    row(hints, 8, 130, 106);

    heading('Callouts · numbers · toast', 260, 120);

    heading('Battle text · dialog with speaker · confirm', 8, 172);
    const msg = add(new MessageBox(), 8, 182);
    msg.resize(170, 40);
    msg.set('Ripplet is Wet!\nEmberkit used Spark Lash.');
    this.dialog = new DialogBox({
      theme: this.theme,
      width: this.width - 8 - 186 - 90,
      lines: 2,
      speaker: 'Mira',
      pages: ['Potions are capped at five of each kind. Need anything else?'],
    });
    add(this.dialog.view, 186, 196);
    this.confirm.view.position.set(this.width - 8 - this.confirm.width, 182);
  }
}
