/**
 * C10 battle mock: a real-looking battle screen built from the UI kit, fully playable by
 * keyboard (and mouse). Turns are scripted with the mock data (no battle engine yet), just
 * enough to exercise every piece: action menu, move list + info, switching (menu or 1 2 3),
 * bag with "use on", battle text, HP drain, damage numbers, reaction callouts, conditions,
 * tooltips (hover or `F` to inspect).
 */

import { Container, Graphics } from 'pixi.js';
import type { InputManager } from '@engine/input';
import type { Scene } from '@engine/scenes/scene-manager';
import {
  DialogBox,
  FocusStack,
  InspectWidget,
  Menu,
  TooltipLayer,
  type UiInput,
  type UiTheme,
  type Widget,
} from '@engine/ui';
import { pixelTexture } from '@engine/render/pixel-texture';
import type { Action } from '@game/input/actions';
import { conditionColors, paper, typeColors, type ConditionId } from '@game/style/tokens';
import { BagPanel, type BagItem, type BagTab } from '@game/ui/bag';
import { TypeBadge } from '@game/ui/badges';
import { CombatantCard, Hotbar, type CombatantView, type HudTips } from '@game/ui/battle-hud';
import { Callout, EffectsLayer, FloatNumber, Toast } from '@game/ui/callout';
import { MessageBox, MoveInfoPanel } from '@game/ui/panels';
import { ZorlingActor } from '@game/zorlings/actor';
import { renderZorling } from '@game/zorlings/render';
import { drawBackdrop, platforms } from '@game/battle/scene/backdrop';
import {
  APPLIES,
  BAG,
  CONDITIONS,
  FOE,
  HEAL,
  TEAM,
  conditionTooltip,
  effectiveness,
  moveView,
  typeTooltip,
  type MockMove,
  type MockZorling,
} from './data';

interface Fighter {
  readonly data: MockZorling;
  hp: number;
  conditions: { id: ConditionId; turns: number }[];
}

const BAR_H = 60;
const MARGIN = 6;

export class BattleMockScene implements Scene<Container> {
  readonly id = 'battle-mock';
  readonly view = new Container({ label: 'world:battle-mock' });
  readonly ui = new Container({ label: 'ui:battle-mock' });

  private readonly backdrop = new Graphics();
  private readonly actors = new Container();
  private allyActor: ZorlingActor | undefined;
  private foeActor: ZorlingActor | undefined;

  private readonly hud = new Container({ label: 'hud' });
  private readonly veil = new Graphics();
  private readonly stackLayer = new Container({ label: 'widgets' });
  private readonly effects = new EffectsLayer();
  private readonly tooltips: TooltipLayer;
  private readonly tips: HudTips;
  private readonly foeCard: CombatantCard;
  private readonly allyCard: CombatantCard;
  private readonly hotbar: Hotbar;
  private readonly message = new MessageBox();
  private readonly moveInfo: MoveInfoPanel;
  private readonly stack: FocusStack<Container>;
  private readonly actionMenu: Menu;
  private readonly portraits = TEAM.map((z) => pixelTexture(renderZorling(z.genome, { size: 32 })));

  private team: Fighter[] = [];
  private foe!: Fighter;
  private active = 0;
  private bag: BagTab[] = [];
  private busy = false;
  private lastInspected: Container | undefined;
  private waiters: { pred: () => boolean; resolve: () => void }[] = [];
  /** Where each open widget goes; re-applied on resize. */
  private readonly placers = new Map<Widget<Container>, () => void>();
  private time = 0;
  private clickedSlot: number | undefined;
  private width = 480;
  private height = 270;

  constructor(
    private readonly input: InputManager<Action>,
    ui: UiInput,
    private readonly theme: UiTheme,
  ) {
    this.view.addChild(this.backdrop, this.actors);
    this.tooltips = new TooltipLayer({
      theme,
      area: () => ({ width: this.width, height: this.height }),
    });
    this.tips = {
      layer: this.tooltips,
      type: typeTooltip,
      condition: conditionTooltip,
      zorling: (v, slot) => ({
        title: `${slot + 1} · ${v.name}  Lv${v.level}`,
        body: `HP ${v.hp}/${v.maxHp} · ${v.types.map((t) => typeColors[t].label).join('/')}. Press ${slot + 1} to switch (costs the turn).`,
      }),
    };
    this.foeCard = new CombatantCard({ side: 'foe', tips: this.tips });
    this.allyCard = new CombatantCard({ side: 'ally', tips: this.tips });
    this.hotbar = new Hotbar(this.tips);
    // Clicks are queued like keys and handled in the fixed step.
    this.hotbar.onSelect = (i) => (this.clickedSlot = i);
    this.moveInfo = new MoveInfoPanel({
      layer: this.tooltips,
      type: typeTooltip,
      condition: (id) => conditionTooltip(id),
    });
    this.moveInfo.visible = false;
    this.veil.visible = false;
    this.hud.addChild(this.foeCard, this.allyCard, this.hotbar, this.message, this.moveInfo);
    this.ui.addChild(this.hud, this.effects, this.veil, this.stackLayer, this.tooltips.view);

    this.stack = new FocusStack<Container>(
      {
        attach: (v) => this.stackLayer.addChild(v),
        detach: (v) => this.stackLayer.removeChild(v),
      },
      ui,
    );
    this.actionMenu = new Menu({
      theme,
      items: [
        { label: 'Fight' },
        { label: 'Switch', hint: '1 2 3' },
        { label: 'Items' },
        { label: 'Run' },
      ],
      width: 152,
      onSelect: (i) => this.onAction(i),
    });
    this.reset();
  }

  /** Current state for tests and tools. */
  get state(): {
    active: number;
    hp: number[];
    foeHp: number;
    foeConditions: string[];
    top: string;
    busy: boolean;
    tooltip: { title: string; body: string } | undefined;
  } {
    return {
      active: this.active,
      hp: this.team.map((f) => f.hp),
      foeHp: this.foe.hp,
      foeConditions: this.foe.conditions.map((c) => `${c.id}:${c.turns}`),
      top: this.stack.top ? this.stack.top.view.label : '',
      busy: this.busy,
      tooltip: this.tooltips.visible ? this.tooltips.text : undefined,
    };
  }

  enter(): void {
    this.stack.push(this.actionMenu);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    drawBackdrop(this.backdrop, width, height);
    const p = platforms(width, height);
    this.foeActor?.position.set(p.foe.x, p.foe.y + 4);
    this.allyActor?.position.set(p.ally.x, p.ally.y + 4);
    const y = height - BAR_H - 4;
    this.foeCard.position.set(8, 8);
    this.allyCard.position.set(
      width - 8 - this.allyCard.cardWidth,
      y - 4 - this.allyCard.cardHeight,
    );
    this.hotbar.position.set(MARGIN, y);
    const x0 = MARGIN + Hotbar.WIDTH + 4;
    const menuW = 152;
    const msgW = width - MARGIN - menuW - 4 - x0;
    this.message.position.set(x0, y);
    this.message.resize(msgW, BAR_H);
    this.actionMenu.view.position.set(width - MARGIN - menuW, y);
    this.moveInfo.position.set(x0 + 154, y);
    this.moveInfo.resize(width - MARGIN - (x0 + 154), BAR_H);
    this.veil.clear().rect(0, 0, width, height).fill({ color: paper.veil, alpha: 0.45 });
    for (const [w, place] of this.placers) {
      if (this.stack.includes(w)) place();
      else this.placers.delete(w);
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.handleKeys();
    this.stack.update(dt);
    this.tooltips.update(dt);
    this.foeCard.update(dt);
    this.allyCard.update(dt);
    this.allyActor?.update(dt);
    this.foeActor?.update(dt);
    this.effects.update(dt);
    const ready = this.waiters.filter((w) => w.pred());
    this.waiters = this.waiters.filter((w) => !ready.includes(w));
    for (const w of ready) w.resolve();
  }

  // ---- input -----------------------------------------------------------------------------

  private handleKeys(): void {
    const top = this.stack.top;
    if (this.input.pressed('inspect')) {
      if (top instanceof InspectWidget) {
        this.stack.remove(top);
      } else if (!(top instanceof DialogBox)) {
        this.stack.push(
          new InspectWidget({
            layer: this.tooltips,
            color: paper.accent,
            ...(this.lastInspected ? { start: this.lastInspected } : {}),
            onClose: (w) => {
              this.lastInspected = w.target;
              this.stack.remove(w);
            },
          }),
        );
      }
      return;
    }
    const clicked = this.clickedSlot;
    this.clickedSlot = undefined;
    if (this.busy || top !== this.actionMenu) return;
    if (clicked !== undefined) this.trySwitch(clicked);
    const keys = ['hotbar1', 'hotbar2', 'hotbar3'] as const;
    keys.forEach((k, i) => {
      if (this.input.pressed(k)) this.trySwitch(i);
    });
  }

  private onAction(i: number): void {
    if (this.busy) return;
    if (i === 0) this.openMoves();
    else if (i === 1) this.openSwitch();
    else if (i === 2) this.openBag();
    else void this.run();
  }

  private openMoves(): void {
    const me = this.ally;
    const menu = new Menu({
      theme: this.theme,
      title: 'Moves',
      width: 150,
      items: me.data.moves.map((m) => ({
        label: m.name,
        icon: () => new TypeBadge(m.type, { label: false }),
      })),
      onHighlight: (idx) => this.showMove(me.data.moves[idx]),
      onSelect: (idx) => {
        const move = me.data.moves[idx];
        if (!move) return;
        this.closeMoves(menu);
        void this.playerTurn(move);
      },
      onBack: () => this.closeMoves(menu),
    });
    this.showMove(me.data.moves[0]);
    this.message.visible = false;
    this.moveInfo.visible = true;
    this.actionMenu.view.visible = false;
    this.push(menu, () => menu.view.position.set(this.barX, this.barY));
  }

  private closeMoves(menu: Menu): void {
    this.stack.remove(menu);
    this.moveInfo.visible = false;
    this.message.visible = true;
    this.actionMenu.view.visible = true;
  }

  private showMove(move: MockMove | undefined): void {
    if (!move) return;
    this.moveInfo.set(
      moveView(
        move,
        this.foe.data.genome.types,
        this.foe.conditions.map((c) => c.id),
      ),
    );
  }

  private openSwitch(forced = false): void {
    const menu = new Menu({
      theme: this.theme,
      title: forced ? 'Choose a Zorling' : 'Switch',
      width: 152,
      items: this.team.map((f, i) => ({
        label: `${i + 1}  ${f.data.name}`,
        hint: f.hp > 0 ? `${f.hp}/${f.data.maxHp}` : 'Fainted',
        disabled: f.hp <= 0 || i === this.active,
      })),
      onSelect: (idx) => {
        this.stack.remove(menu);
        void this.switchTurn(idx, forced);
      },
      ...(forced ? {} : { onBack: () => this.stack.remove(menu) }),
    });
    this.push(menu, () =>
      menu.view.position.set(this.width - MARGIN - menu.width, this.barY - menu.height - 3),
    );
  }

  private openBag(): void {
    const panel = new BagPanel({
      tabs: this.bag,
      team: this.team.map((f, i) => this.viewOf(f, i)),
      money: 1240,
      onUse: (item, target) => {
        this.closeBag(panel);
        void this.itemTurn(item, target);
      },
      onBack: () => this.closeBag(panel),
    });
    this.veil.visible = true;
    this.push(panel, () =>
      panel.view.position.set(
        Math.round((this.width - BagPanel.WIDTH) / 2),
        Math.round((this.height - BAR_H - BagPanel.HEIGHT) / 2),
      ),
    );
  }

  private closeBag(panel: BagPanel): void {
    this.stack.remove(panel);
    this.veil.visible = false;
  }

  private trySwitch(i: number): void {
    const f = this.team[i];
    if (!f || f.hp <= 0 || i === this.active) return;
    void this.switchTurn(i, false);
  }

  // ---- turns -----------------------------------------------------------------------------

  private async playerTurn(move: MockMove): Promise<void> {
    this.busy = true;
    await this.attack(this.ally, this.foe, move, 'ally');
    if (this.foe.hp <= 0) {
      await this.victory();
      return;
    }
    await this.foeTurn();
  }

  private async foeTurn(): Promise<void> {
    const move = this.foe.data.moves[0];
    if (move) await this.attack(this.foe, this.ally, move, 'foe');
    if (this.ally.hp <= 0) {
      this.allyActor?.play('faint');
      await this.say(`${this.ally.data.name} fainted!`);
      this.endTurn();
      if (this.team.some((f) => f.hp > 0)) {
        this.busy = false;
        this.openSwitch(true);
      } else {
        await this.say('You have no Zorlings left… The mock starts over.');
        this.reset();
      }
      return;
    }
    this.endTurn();
  }

  private async attack(
    user: Fighter,
    target: Fighter,
    move: MockMove,
    side: 'ally' | 'foe',
  ): Promise<void> {
    const userActor = side === 'ally' ? this.allyActor : this.foeActor;
    const targetActor = side === 'ally' ? this.foeActor : this.allyActor;
    const targetPos =
      side === 'ally'
        ? platforms(this.width, this.height).foe
        : platforms(this.width, this.height).ally;
    await this.say(
      `${side === 'foe' ? 'The wild ' : ''}${user.data.name} used ${move.name}!`,
      false,
    );
    await this.playClip(userActor, 'attack');

    const eff = effectiveness(move.type, target.data.genome.types);
    const exploited = target.conditions.find((c) =>
      CONDITIONS[c.id].exploitedBy.some((e) => e.type === move.type),
    );
    const reaction = exploited
      ? CONDITIONS[exploited.id].exploitedBy.find((e) => e.type === move.type)
      : undefined;
    const mult = reaction?.mult ?? 1;
    const dmg = Math.max(1, Math.round((move.power / 5) * eff * mult));
    target.hp = Math.max(0, target.hp - dmg);
    if (exploited) target.conditions = target.conditions.filter((c) => c !== exploited);

    targetActor?.play('hurt');
    this.effects.add(new FloatNumber(dmg), targetPos.x, targetPos.y - 70);
    if (reaction) {
      this.effects.add(
        new Callout(
          `${reaction.reaction.split(/[,:(]/)[0]?.trim() ?? ''}!${reaction.mult ? ` ×${reaction.mult}` : ''}`,
        ),
        Math.round(this.width / 2),
        Math.round(this.height * 0.36),
      );
    }
    this.refreshCards(true);
    await this.until(() => !this.foeCard.hpBar.animating && !this.allyCard.hpBar.animating);

    if (reaction)
      if (exploited) {
        await this.say(`${conditionColors[exploited.id].label} reacted: ${reaction.reaction}!`);
      }
    if (eff > 1) await this.say("It's super effective!");
    else if (eff < 1) await this.say("It's not very effective…");

    if (!exploited && target.hp > 0) {
      const cond = APPLIES[move.type];
      const had = target.conditions.find((c) => c.id === cond);
      if (had) had.turns = 3;
      else target.conditions.push({ id: cond, turns: 3 });
      this.refreshCards(false);
      await this.say(`${target.data.name} is ${conditionColors[cond].label}!`);
    }
  }

  private async victory(): Promise<void> {
    this.foeActor?.play('faint');
    await this.say(`The wild ${this.foe.data.name} fainted!`);
    await this.say(`${this.ally.data.name} gained 42 XP.`);
    this.effects.add(new Toast('Mock battle won: starting over.'), MARGIN + 2, MARGIN + 52);
    this.reset();
  }

  private async switchTurn(i: number, free: boolean): Promise<void> {
    this.busy = true;
    if (!free) await this.say(`Come back, ${this.ally.data.name}!`, false);
    this.ally.conditions = []; // switching out clears conditions (DESIGN.md)
    this.active = i;
    this.spawnAlly();
    this.refreshCards(false);
    await this.say(`Go, ${this.ally.data.name}!`);
    if (free) {
      this.busy = false;
      this.showPrompt();
      return;
    }
    await this.foeTurn();
  }

  private async itemTurn(item: BagItem, target: number | undefined): Promise<void> {
    this.busy = true;
    this.takeItem(item.id);
    if (target === undefined) {
      await this.say(`You threw a ${item.name}!`, false);
      await this.say(`${this.foe.data.name} broke free! (Capture comes in C16.)`);
    } else {
      const f = this.team[target];
      if (f) {
        const before = f.hp;
        f.hp = Math.min(f.data.maxHp, f.hp + (HEAL[item.id] ?? 0));
        this.refreshCards(true);
        if (target === this.active) {
          const p = platforms(this.width, this.height).ally;
          this.effects.add(new FloatNumber(f.hp - before, true), p.x, p.y - 70);
        }
        await this.say(`${f.data.name} recovered ${f.hp - before} HP.`);
      }
    }
    await this.foeTurn();
  }

  private async run(): Promise<void> {
    this.busy = true;
    await this.say('Got away safely!');
    this.reset();
  }

  private endTurn(): void {
    for (const f of [this.foe, ...this.team]) {
      for (const c of f.conditions) c.turns--;
      f.conditions = f.conditions.filter((c) => c.turns > 0);
    }
    this.refreshCards(false);
    this.busy = false;
    this.showPrompt();
  }

  // ---- helpers ---------------------------------------------------------------------------

  private get ally(): Fighter {
    const f = this.team[this.active] ?? this.team[0];
    if (!f) throw new Error('battle mock: empty team');
    return f;
  }

  private reset(): void {
    this.team = TEAM.map((data, i) => ({
      data,
      hp: [38, 49, 6][i] ?? data.maxHp,
      conditions: i === 0 ? [{ id: 'charged', turns: 2 }] : [],
    }));
    this.foe = { data: FOE, hp: 31, conditions: [{ id: 'wet', turns: 2 }] };
    this.active = 0;
    this.bag = BAG.map((t) => ({ ...t, items: t.items.map((it) => ({ ...it })) }));
    this.busy = false;
    this.spawnAlly();
    this.spawnFoe();
    this.refreshCards(false);
    this.showPrompt();
  }

  private takeItem(id: string): void {
    this.bag = this.bag.map((t) => ({
      ...t,
      items: t.items.map((it) => (it.id === id ? { ...it, count: Math.max(0, it.count - 1) } : it)),
    }));
  }

  private spawnAlly(): void {
    this.allyActor?.destroy({ children: true });
    this.allyActor = new ZorlingActor(this.ally.data.genome, { facing: 'right' });
    this.actors.addChild(this.allyActor);
    const p = platforms(this.width, this.height);
    this.allyActor.position.set(p.ally.x, p.ally.y + 4);
  }

  private spawnFoe(): void {
    this.foeActor?.destroy({ children: true });
    this.foeActor = new ZorlingActor(this.foe.data.genome, { facing: 'left' });
    this.actors.addChildAt(this.foeActor, 0);
    const p = platforms(this.width, this.height);
    this.foeActor.position.set(p.foe.x, p.foe.y + 4);
  }

  private viewOf(f: Fighter, i: number): CombatantView {
    return {
      name: f.data.name,
      level: f.data.level,
      types: f.data.genome.types,
      hp: f.hp,
      maxHp: f.data.maxHp,
      conditions: f.conditions.map((c) => ({ ...c })),
      xp: f.data.xp,
      ...(i >= 0 ? { portrait: this.portraits[i] } : {}),
    } as CombatantView;
  }

  private refreshCards(animate: boolean): void {
    this.foeCard.set(this.viewOf(this.foe, -1), animate);
    this.allyCard.set(this.viewOf(this.ally, this.active), animate);
    this.hotbar.set(
      this.team.map((f, i) => this.viewOf(f, i)),
      this.active,
    );
  }

  private showPrompt(): void {
    this.message.set(`What will ${this.ally.data.name} do?`, [
      ['E', 'Select'],
      ['1-3', 'Switch'],
      ['F', 'Info'],
    ]);
  }

  /** Battle text in the message area; resolves when the player has read it. */
  private say(text: string, waitForKey = true): Promise<void> {
    return new Promise((resolve) => {
      const dialog = new DialogBox({
        theme: this.theme,
        width: Math.round(this.width - MARGIN * 2 - Hotbar.WIDTH - 4),
        lines: 4,
        pages: [text],
        onDone: (d) => {
          this.stack.remove(d);
          this.message.set(text);
          resolve();
        },
      });
      this.push(dialog, () =>
        dialog.view.position.set(this.barX, this.barY + BAR_H - dialog.height),
      );
      if (!waitForKey) {
        // Short lines that lead into an animation finish on their own after a beat.
        void this.until(() => dialog.typewriter.pageComplete).then(() =>
          this.delay(0.45).then(() => {
            if (this.stack.includes(dialog)) {
              this.stack.remove(dialog);
              this.message.set(text);
              resolve();
            }
          }),
        );
      }
    });
  }

  private playClip(actor: ZorlingActor | undefined, clip: 'attack' | 'hurt'): Promise<void> {
    return new Promise((resolve) => {
      if (!actor) resolve();
      else actor.play(clip, resolve);
    });
  }

  private until(pred: () => boolean): Promise<void> {
    return new Promise((resolve) => this.waiters.push({ pred, resolve }));
  }

  private delay(seconds: number): Promise<void> {
    const end = this.time + seconds;
    return this.until(() => this.time >= end);
  }

  private get barX(): number {
    return MARGIN + Hotbar.WIDTH + 4;
  }

  private get barY(): number {
    return this.height - BAR_H - 4;
  }

  private push(w: Widget<Container>, place: () => void): void {
    this.placers.set(w, place);
    place();
    this.stack.push(w);
  }
}
