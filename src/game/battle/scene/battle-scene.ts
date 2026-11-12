/**
 * The battle scene (C18): the pure battle engine behind the C10 UI kit.
 *
 * Each player choice becomes one engine step. Its events go into a presentation queue and
 * are played one by one: battle text, attack lunges and type VFX, hits (flash, knockback,
 * hit-stop, shake, damage numbers), reaction callouts, condition overlays, switch dissolves,
 * the capture throw and wobbles, faints. The HUD follows a mirror of what has been shown
 * (`@game/battle/present`), so it never runs ahead of the animation.
 *
 * Keyboard: action menu (Fight / Switch / Items / Run), move list with info, `1 2 3` to
 * switch, bag with "use on", `F` inspect, `E` advances text (hold = faster). Mouse works too.
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
  type Widget,
} from '@engine/ui';
import type { GameContent } from '@game/data';
import type { Action } from '@game/input/actions';
import { xpForLevel } from '@game/progression';
import { conditionIdOf, typeIdOf } from '@game/style/ids';
import { conditionColors, paper, semantic, typeColors } from '@game/style/tokens';
import { BagPanel, type BagItem } from '@game/ui/bag';
import { TypeBadge } from '@game/ui/badges';
import { CombatantCard, Hotbar, type CombatantView, type HudTips } from '@game/ui/battle-hud';
import { Callout, EffectsLayer, FloatNumber } from '@game/ui/callout';
import { drawItem, MessageBox, MoveInfoPanel } from '@game/ui/panels';
import { ZorlingActor } from '@game/zorlings/actor';
import { renderZorling } from '@game/zorlings/render';
import { battleLook, type BattleLook } from '@game/zorlings/species-look';
import {
  aiChoice,
  aiReplacement,
  createBattle,
  finishBattle,
  isTrapped,
  legalChoices,
  needsReplacement,
  OPPONENT,
  PLAYER,
  sameChoice,
  step,
  activeOf,
  type BattleAction,
  type BattleEvent,
  type BattleResult,
  type BattleSetup,
  type BattleState,
  type Choice,
  type Combatant,
  type SideId,
} from '../logic';
import {
  applyShown,
  eventText,
  progressText,
  shownActive,
  shownFrom,
  syncStatuses,
  type Shown,
  type ShownZorling,
} from '../present';
import { drawBackdrop, platforms } from './backdrop';
import { bagTabsFor, cardView, conditionTip, moveViewFor, typeTip } from './view-data';
import {
  ConditionOverlay,
  MoveVfx,
  ReactionVfx,
  SparkleVfx,
  type OverlayId,
  type Point,
} from './vfx';

/** Battle speed options (settings come with C33). */
export const BATTLE_SPEEDS = [1, 1.5, 2] as const;

export interface BattleSceneOptions {
  readonly content: GameContent;
  readonly input: InputManager<Action>;
  readonly ui: UiInput;
  readonly theme: UiTheme;
  readonly setup: BattleSetup;
  /** Trainer battles: the trainer's name for battle text. */
  readonly trainer?: string;
  /** Badges held (soft level cap for XP). Default 0. */
  readonly badges?: number;
  /** Animation and text speed multiplier (1, 1.5, 2). Default 1. */
  readonly speed?: number;
  /** Shown in the bag. */
  readonly money?: number;
  /** Ask before switching with `1 2 3`. Default false. */
  readonly confirmHotbarSwitch?: boolean;
  /** Called once after the battle ended and its results were shown. */
  readonly onEnd: (result: BattleResult, state: BattleState) => void;
}

const BAR_H = 60;
const MARGIN = 6;
const MENU_W = 152;

/** Text that leads straight into an animation closes on its own after a beat. */
const AUTO_EVENTS: ReadonlySet<BattleEvent['kind']> = new Set([
  'sendOut',
  'switchOut',
  'useMove',
  'itemUsed',
]);

interface Tween {
  readonly end: number;
  readonly start: number;
  readonly fn: (k: number) => void;
  readonly resolve: () => void;
}

interface FieldActor {
  readonly actor: ZorlingActor;
  readonly look: BattleLook;
}

export class BattleScene implements Scene<Container> {
  readonly id = 'battle';
  readonly view = new Container({ label: 'world:battle' });
  readonly ui = new Container({ label: 'ui:battle' });

  private readonly world = new Container({ label: 'world' });
  private readonly backdrop = new Graphics();
  private readonly actorLayer = new Container({ label: 'actors' });
  private readonly vfxLayer = new Container({ label: 'vfx' });
  private readonly overlays: [ConditionOverlay, ConditionOverlay] = [
    new ConditionOverlay(),
    new ConditionOverlay(),
  ];
  /** Actors per side and team slot (rendered once per battle, kept while benched). */
  private readonly actors: [Map<number, FieldActor>, Map<number, FieldActor>] = [
    new Map(),
    new Map(),
  ];
  private readonly onField: [FieldActor | undefined, FieldActor | undefined] = [
    undefined,
    undefined,
  ];

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
  private readonly theme: UiTheme;
  private readonly portraits = new Map<number, ReturnType<typeof pixelTexture>>();
  private readonly placers = new Map<Widget<Container>, () => void>();
  private actionMenu: Menu | undefined;
  private moveMenu: Menu | undefined;

  private state!: BattleState;
  private shown!: Shown;
  private busy = true;
  private ended = false;
  private time = 0;
  private freeze = 0;
  private shake = { t: 0, amp: 0 };
  private waiters: { pred: () => boolean; resolve: () => void }[] = [];
  private tweens: Tween[] = [];
  private clickedSlot: number | undefined;
  private lastInspected: Container | undefined;
  private width = 480;
  private height = 270;
  private readonly speed: number;
  private vfxSeed = 1;
  /** Clips to render ahead of time, one per frame while nothing animates. */
  private preloads: { actor: ZorlingActor; clip: 'attack' | 'hurt' | 'faint' }[] = [];

  constructor(private readonly options: BattleSceneOptions) {
    this.speed = options.speed ?? 1;
    this.theme = {
      ...options.theme,
      motion: { ...options.theme.motion, textSpeed: options.theme.motion.textSpeed * this.speed },
    };
    // The backdrop stays put; screen shake moves the Zorlings and effects only, so no edge
    // of the screen ever shows past the backdrop.
    this.world.addChild(this.actorLayer, this.vfxLayer);
    this.view.addChild(this.backdrop, this.world);

    this.tooltips = new TooltipLayer({
      theme: this.theme,
      area: () => ({ width: this.width, height: this.height }),
    });
    const content = options.content;
    this.tips = {
      layer: this.tooltips,
      type: (t) => typeTip(content, t),
      condition: (id, turns) => conditionTip(content, id, turns),
      zorling: (v, slot) => ({
        title: `${slot + 1} · ${v.name}  Lv${v.level}`,
        body: `HP ${v.hp}/${v.maxHp} · ${v.types.map((t) => typeColors[t].label).join('/')}. Press ${slot + 1} to switch (costs the turn).`,
      }),
    };
    this.foeCard = new CombatantCard({ side: 'foe', tips: this.tips });
    this.allyCard = new CombatantCard({ side: 'ally', tips: this.tips });
    this.hotbar = new Hotbar(this.tips);
    this.hotbar.onSelect = (i) => (this.clickedSlot = i);
    this.moveInfo = new MoveInfoPanel({
      layer: this.tooltips,
      type: (t) => typeTip(content, t),
      condition: (id) => conditionTip(content, id),
    });
    this.moveInfo.visible = false;
    this.veil.visible = false;
    this.foeCard.visible = false;
    this.allyCard.visible = false;
    this.hud.addChild(this.foeCard, this.allyCard, this.hotbar, this.message, this.moveInfo);
    this.ui.addChild(this.hud, this.effects, this.veil, this.stackLayer, this.tooltips.view);
    this.stack = new FocusStack<Container>(
      { attach: (v) => this.stackLayer.addChild(v), detach: (v) => this.stackLayer.removeChild(v) },
      options.ui,
    );
  }

  /** Current state for tests and tools. */
  get debug(): {
    state: BattleState;
    shown: Shown;
    busy: boolean;
    top: string;
    ended: boolean;
  } {
    return {
      state: this.state,
      shown: this.shown,
      busy: this.busy,
      top: this.stack.top ? this.stack.top.view.label : '',
      ended: this.ended,
    };
  }

  enter(): void {
    this.options.input.setContexts(['battle']);
    this.options.input.suppressHeld();
    const { content, setup } = this.options;
    const { state, events } = createBattle(content, setup);
    this.state = state;
    this.shown = shownFrom(content, state, this.xpOf, true);
    this.refreshHud(false);
    this.message.set('');
    void this.playEvents(events).then(() => this.next());
  }

  exit(): void {
    for (const side of this.actors)
      for (const fa of side.values()) fa.actor.destroy({ children: true });
    for (const t of this.portraits.values()) t.destroy(true);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    drawBackdrop(this.backdrop, width, height);
    for (const side of [PLAYER, OPPONENT] as const) this.placeActor(side);
    const y = this.barY;
    this.foeCard.position.set(8, 8);
    this.allyCard.position.set(
      width - 8 - this.allyCard.cardWidth,
      y - 4 - this.allyCard.cardHeight,
    );
    this.hotbar.position.set(MARGIN, y);
    const x0 = this.barX;
    this.message.position.set(x0, y);
    this.message.resize(width - MARGIN - MENU_W - 4 - x0, BAR_H);
    this.moveInfo.position.set(x0 + 154, y);
    this.moveInfo.resize(width - MARGIN - (x0 + 154), BAR_H);
    this.veil.clear().rect(0, 0, width, height).fill({ color: paper.veil, alpha: 0.45 });
    for (const [w, place] of this.placers) {
      if (this.stack.includes(w)) place();
      else this.placers.delete(w);
    }
  }

  update(dt: number): void {
    const sdt = dt * this.speed;
    this.time += sdt;
    this.handleKeys();
    this.stack.update(dt);
    this.tooltips.update(dt);
    this.foeCard.update(sdt);
    this.allyCard.update(sdt);
    this.effects.update(sdt);
    if (this.freeze > 0) {
      this.freeze -= sdt;
    } else {
      for (const fa of this.onField) fa?.actor.update(dt);
      for (const o of this.overlays) o.update(sdt);
      for (const c of [...this.vfxLayer.children]) {
        const fx = c as Container & { update?(dt: number): void; done?: boolean };
        fx.update?.(sdt);
        if (fx.done) fx.destroy({ children: true });
      }
    }
    this.updateShake(sdt);
    this.updateTweens();
    this.preloadOne();
    const ready = this.waiters.filter((w) => w.pred());
    this.waiters = this.waiters.filter((w) => !ready.includes(w));
    for (const w of ready) w.resolve();
  }

  // ---- flow ------------------------------------------------------------------------------

  /** What comes after the events of a step: next choice, a replacement, or the end. */
  private next(): void {
    const { content } = this.options;
    const state = this.state;
    this.shown = syncStatuses(shownFrom(content, state, this.xpOf), state);
    this.refreshHud(false);
    if (state.phase === 'ended') {
      void this.finish();
      return;
    }
    if (state.phase === 'replace') {
      if (needsReplacement(state, OPPONENT)) {
        void this.doStep({
          kind: 'replace',
          side: OPPONENT,
          to: aiReplacement(content, state, OPPONENT),
        });
        return;
      }
      if (needsReplacement(state, PLAYER)) {
        this.busy = false;
        this.openSwitch(true);
        return;
      }
    }
    this.busy = false;
    this.openActions();
  }

  private choose(choice: Choice): void {
    if (this.busy) return;
    const { content } = this.options;
    const style = this.state.kind === 'wild' ? 'wild' : 'trainer';
    const opponent = aiChoice(content, this.state, OPPONENT, style);
    void this.doStep({ kind: 'turn', player: choice, opponent });
  }

  private async doStep(action: BattleAction): Promise<void> {
    this.busy = true;
    this.closeMenus();
    const res = step(this.options.content, this.state, action);
    this.state = res.state;
    await this.playEvents(res.events);
    this.next();
  }

  private async finish(): Promise<void> {
    this.busy = true;
    this.ended = true;
    const { content, badges = 0 } = this.options;
    const result = finishBattle(content, this.state, { badges });
    if (result.xp > 0) {
      await this.say(`Your team gained ${result.xp} XP each!`);
      for (const [i, events] of result.progress.entries()) {
        const z = result.team[i];
        if (!z) continue;
        const name = this.shown.sides[PLAYER].team[i]?.name ?? '';
        for (const e of events) {
          if (e.kind === 'xp') continue;
          for (const line of progressText(content, name, e)) await this.say(line);
        }
      }
    }
    this.options.onEnd(result, this.state);
  }

  /** The presentation queue: plays the events of one step in order. */
  private async playEvents(events: readonly BattleEvent[]): Promise<void> {
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e) await this.present(e, events[i + 1]);
    }
  }

  private async present(e: BattleEvent, next: BattleEvent | undefined): Promise<void> {
    const { content } = this.options;
    const lines = eventText(
      content,
      this.shown,
      e,
      this.options.trainer ? { trainer: this.options.trainer } : {},
    );
    const before = this.shown;
    const apply = (): void => {
      this.shown = applyShown(content, this.shown, e);
    };
    const sayAll = async (auto = AUTO_EVENTS.has(e.kind)): Promise<void> => {
      for (const line of lines) await this.say(line, !auto);
    };

    switch (e.kind) {
      case 'sendOut': {
        apply();
        this.showActor(e.side, e.slot);
        this.refreshHud(false);
        const appear = this.appear(e.side);
        await sayAll();
        await appear;
        return;
      }
      case 'switchOut':
        await sayAll();
        await this.dissolve(e.side);
        apply();
        this.overlays[e.side].clear();
        this.refreshHud(false);
        return;
      case 'useMove': {
        await sayAll();
        if (next?.kind === 'fumbled') return;
        await this.attack(e.side, e.move, next?.kind === 'miss');
        return;
      }
      case 'damage': {
        const fa = this.onField[e.side];
        fa?.actor.play('hurt');
        this.hitStop(e.amount / Math.max(1, shownActive(before, e.side).maxHp));
        this.number(e.side, e.amount, false);
        apply();
        this.refreshHud(true);
        await this.untilBars();
        await sayAll();
        return;
      }
      case 'reaction': {
        const r = content.reactions.require(e.reaction);
        const t = typeIdOf(r.type);
        const c = conditionIdOf(e.condition);
        const at = this.center(e.side);
        this.vfxLayer.addChild(
          new ReactionVfx(
            at,
            [c ? conditionColors[c].color : 0xffffff, t ? typeColors[t].base : 0xffffff, 0xffffff],
            this.vfxSeed++,
          ),
        );
        const mult = r.damageMultiplier !== 1 ? ` ×${r.damageMultiplier}` : '';
        this.callout(`${r.name}!${mult}`, semantic.reaction);
        this.startShake(3, 0.3);
        apply();
        this.refreshHud(false);
        await this.delay(0.35);
        await sayAll();
        return;
      }
      case 'armorBroken':
        this.callout('Armor broken!', semantic.titan, 0.55);
        this.startShake(4, 0.4);
        this.vfxLayer.addChild(new SparkleVfx(this.center(e.side), semantic.titan, this.vfxSeed++));
        apply();
        this.refreshHud(false);
        await this.delay(0.3);
        await sayAll();
        return;
      case 'armorRestored':
        apply();
        this.refreshHud(false);
        this.vfxLayer.addChild(new SparkleVfx(this.center(e.side), semantic.titan, this.vfxSeed++));
        await sayAll();
        return;
      case 'conditionApplied': {
        apply();
        this.refreshHud(false);
        const c = conditionIdOf(e.condition);
        if (c)
          this.vfxLayer.addChild(
            new SparkleVfx(this.center(e.side), conditionColors[c].color, this.vfxSeed++),
          );
        await sayAll();
        return;
      }
      case 'statusDamage': {
        this.onField[e.side]?.actor.play('hurt');
        this.number(e.side, e.amount, false);
        apply();
        this.refreshHud(true);
        await this.untilBars();
        await sayAll();
        return;
      }
      case 'heal': {
        const shownSide = this.shown.sides[e.side];
        if (shownSide.active === e.slot && shownSide.onField) {
          this.number(e.side, e.amount, true);
          this.vfxLayer.addChild(
            new SparkleVfx(this.center(e.side), semantic.hpHigh, this.vfxSeed++),
          );
        }
        apply();
        this.refreshHud(true);
        await this.untilBars();
        await sayAll();
        return;
      }
      case 'fainted': {
        const fa = this.onField[e.side];
        apply();
        this.overlays[e.side].clear();
        this.refreshHud(false);
        if (fa) await new Promise<void>((resolve) => fa.actor.play('faint', resolve));
        await sayAll();
        return;
      }
      case 'subdued': {
        this.onField[e.side]?.actor.play('hurt');
        apply();
        this.overlays[e.side].clear();
        this.refreshHud(false);
        await this.tween(0.3, (k) => {
          const fa = this.onField[e.side];
          if (fa) fa.actor.alpha = 1 - 0.35 * k;
        });
        await sayAll();
        return;
      }
      case 'capture':
        await this.captureAnimation(e.item, e.success, e.wobbles);
        apply();
        await sayAll();
        return;
      case 'statusEnded':
      case 'turnEnd':
        apply();
        if (e.kind === 'turnEnd') this.shown = syncStatuses(this.shown, this.state);
        this.refreshHud(false);
        await sayAll();
        return;
      default:
        apply();
        this.refreshHud(false);
        await sayAll();
    }
  }

  // ---- animations ------------------------------------------------------------------------

  private async attack(side: SideId, moveId: string, miss: boolean): Promise<void> {
    const { content } = this.options;
    const move = content.moves.require(moveId);
    const type = typeIdOf(move.type) ?? 'metal';
    const fa = this.onField[side];
    const lunge = fa
      ? new Promise<void>((resolve) => fa.actor.play('attack', resolve))
      : Promise.resolve();
    await this.delay(0.12);
    const from = this.center(side);
    const target = this.center(side === PLAYER ? OPPONENT : PLAYER);
    const to = miss ? { x: target.x + (side === PLAYER ? 30 : -30), y: target.y - 16 } : target;
    const fx = new MoveVfx(type, from, to, move.power === 0, this.vfxSeed++);
    this.vfxLayer.addChild(fx);
    await this.until(() => fx.impacted || fx.destroyed);
    await lunge;
  }

  private hitStop(fraction: number): void {
    this.freeze = 0.06 + Math.min(0.08, fraction * 0.2);
    this.startShake(1 + Math.round(Math.min(1, fraction * 3) * 3), 0.25);
  }

  private startShake(amp: number, seconds: number): void {
    this.shake = { t: Math.max(this.shake.t, seconds), amp: Math.max(this.shake.amp, amp) };
  }

  private updateShake(dt: number): void {
    if (this.shake.t <= 0) {
      this.world.position.set(0, 0);
      return;
    }
    this.shake.t -= dt;
    const a = Math.round(this.shake.amp * Math.min(1, this.shake.t / 0.15));
    const f = Math.floor(this.time * 40);
    this.world.position.set(f % 2 ? a : -a, (f >> 1) % 2 ? Math.ceil(a / 2) : -Math.ceil(a / 2));
    if (this.shake.t <= 0) this.shake.amp = 0;
  }

  private number(side: SideId, amount: number, heal: boolean): void {
    const c = this.center(side);
    this.effects.add(new FloatNumber(amount, heal), c.x, c.y - 30);
  }

  private callout(text: string, color: number, hold = 0.7): void {
    this.effects.add(
      new Callout(text, color, 22, hold),
      Math.round(this.width / 2),
      Math.round(this.height * 0.36),
    );
  }

  /** Switch-in: steps in from transparent and a little above. */
  private appear(side: SideId): Promise<void> {
    const fa = this.onField[side];
    if (!fa) return Promise.resolve();
    const base = fa.actor.y;
    return this.tween(0.3, (k) => {
      fa.actor.alpha = Math.round(k * 4) / 4;
      fa.actor.y = Math.round(base - 6 * (1 - k));
    });
  }

  /** Switch-out: dissolves in alpha steps while it sinks. */
  private async dissolve(side: SideId): Promise<void> {
    const fa = this.onField[side];
    if (!fa) return;
    const base = fa.actor.y;
    await this.tween(0.3, (k) => {
      fa.actor.alpha = Math.round((1 - k) * 4) / 4;
      fa.actor.y = Math.round(base + 4 * k);
    });
    fa.actor.visible = false;
    fa.actor.y = base;
    this.onField[side] = undefined;
  }

  private async captureAnimation(itemId: string, success: boolean, wobbles: number): Promise<void> {
    const item = this.options.content.items.require(itemId);
    const look = item.effect.kind === 'capture' ? 0xff5c6c : 0xffffff;
    const orb = new Graphics();
    drawItem(orb, 'orb', -6, -6, look);
    this.vfxLayer.addChild(orb);
    const from = this.center(PLAYER);
    const target = this.center(OPPONENT);
    const ground = this.groundOf(OPPONENT);
    // Throw arc.
    await this.tween(0.45, (k) => {
      orb.position.set(
        Math.round(from.x + (target.x - from.x) * k),
        Math.round(from.y + (target.y - from.y) * k - Math.sin(k * Math.PI) * 50),
      );
      orb.rotation = k * Math.PI * 3;
    });
    orb.rotation = 0;
    // The Zorling is drawn into the orb.
    const foe = this.onField[OPPONENT];
    this.vfxLayer.addChild(new SparkleVfx(target, 0xffffff, this.vfxSeed++));
    if (foe) {
      await this.tween(0.25, (k) => {
        foe.actor.scale.set(Math.max(0.05, 1 - k));
        foe.actor.alpha = Math.round((1 - k) * 4) / 4;
      });
      foe.actor.visible = false;
    }
    // Drop to the ground.
    await this.tween(0.25, (k) => {
      orb.position.set(target.x, Math.round(target.y + (ground.y - 6 - target.y) * k * k));
    });
    // Wobbles.
    for (let i = 0; i < wobbles; i++) {
      await this.delay(0.25);
      await this.tween(0.3, (k) => {
        orb.rotation = Math.sin(k * Math.PI * 2) * 0.45;
      });
      orb.rotation = 0;
    }
    await this.delay(0.25);
    if (success) {
      this.vfxLayer.addChild(
        new SparkleVfx({ x: orb.x, y: orb.y - 4 }, semantic.reaction, this.vfxSeed++),
      );
      await this.delay(0.4);
      return;
    }
    // Breaks free.
    orb.destroy();
    this.vfxLayer.addChild(new SparkleVfx(target, 0xffffff, this.vfxSeed++));
    if (foe) {
      foe.actor.visible = true;
      await this.tween(0.2, (k) => {
        foe.actor.scale.set(Math.max(0.05, k));
        foe.actor.alpha = Math.round(k * 4) / 4;
      });
      foe.actor.scale.set(1);
      foe.actor.alpha = shownActive(this.shown, OPPONENT).subdued ? 0.65 : 1;
    }
  }

  // ---- field -----------------------------------------------------------------------------

  private lookOf(side: SideId, slot: number): BattleLook {
    const { content } = this.options;
    const c = this.state.sides[side].team[slot];
    if (!c) throw new Error(`No Zorling in slot ${slot} of side ${side}`);
    const boss = c.boss ? content.bosses.require(c.boss.id).kind : undefined;
    return battleLook(content, c.zorling.species, {
      ...(boss ? { boss } : {}),
      titanMark: c.zorling.titanMark,
    });
  }

  private showActor(side: SideId, slot: number): void {
    const prev = this.onField[side];
    if (prev) prev.actor.visible = false;
    let fa = this.actors[side].get(slot);
    if (!fa) {
      const look = this.lookOf(side, slot);
      const actor = new ZorlingActor(look.genome, {
        facing: side === PLAYER ? 'right' : 'left',
        size: look.size,
        fill: look.fill,
        titan: look.titan,
      });
      fa = { actor, look };
      this.actors[side].set(slot, fa);
      for (const clip of ['attack', 'hurt', 'faint'] as const) this.preloads.push({ actor, clip });
      if (side === OPPONENT) this.actorLayer.addChildAt(actor, 0);
      else this.actorLayer.addChild(actor);
    }
    fa.actor.visible = true;
    fa.actor.alpha = 0;
    fa.actor.scale.set(1);
    fa.actor.play('idle');
    this.onField[side] = fa;
    const overlay = this.overlays[side];
    overlay.clear();
    this.actorLayer.addChild(overlay);
    this.placeActor(side);
  }

  private placeActor(side: SideId): void {
    const g = this.groundOf(side);
    const fa = this.onField[side];
    fa?.actor.position.set(g.x, g.y);
    this.overlays[side].position.set(g.x, g.y);
  }

  private groundOf(side: SideId): Point {
    const p = platforms(this.width, this.height);
    const at = side === PLAYER ? p.ally : p.foe;
    // Big foes (Titans, legendaries: 128 px) stand a little lower so they fit on screen.
    const fa = this.onField[side];
    const tall = fa ? Math.round(fa.look.size * fa.look.fill) + 2 : 0;
    return { x: at.x, y: Math.max(at.y + 4, side === OPPONENT ? tall : 0) };
  }

  /** Middle of the figure on the field (VFX target). */
  private center(side: SideId): Point {
    const g = this.groundOf(side);
    const fa = this.onField[side];
    const size = fa?.look.size ?? 96;
    const fill = fa?.look.fill ?? 1;
    return { x: g.x, y: Math.round(g.y - size * fill * 0.38) };
  }

  // ---- HUD -------------------------------------------------------------------------------

  /** XP progress within the level, for the ally card. */
  private readonly xpOf = (c: Combatant): number => {
    const z = c.zorling;
    const lo = xpForLevel(z.level);
    const hi = xpForLevel(z.level + 1);
    return hi > lo ? Math.min(1, Math.max(0, (z.xp - lo) / (hi - lo))) : 0;
  };

  private viewOf(z: ShownZorling, side: SideId, slot: number): CombatantView {
    const v = cardView(this.options.content, z);
    if (side !== PLAYER) return v;
    let portrait = this.portraits.get(slot);
    if (!portrait) {
      const look = this.lookOf(PLAYER, slot);
      portrait = pixelTexture(renderZorling(look.genome, { size: 32, fill: look.fill }));
      this.portraits.set(slot, portrait);
    }
    return { ...v, portrait };
  }

  private refreshHud(animate: boolean): void {
    const [mine, theirs] = this.shown.sides;
    const foe = theirs.team[theirs.active];
    const ally = mine.team[mine.active];
    this.foeCard.visible = theirs.onField || (foe?.subdued ?? false);
    this.allyCard.visible = mine.onField;
    if (foe) this.foeCard.set(this.viewOf(foe, OPPONENT, theirs.active), animate);
    if (ally) this.allyCard.set(this.viewOf(ally, PLAYER, mine.active), animate);
    this.hotbar.set(
      mine.team.map((z, i) => this.viewOf(z, PLAYER, i)),
      mine.active,
    );
    for (const side of [PLAYER, OPPONENT] as const) {
      const s = this.shown.sides[side];
      const z = s.team[s.active];
      const fa = this.onField[side];
      if (!z || !fa || !s.onField) continue;
      const ids = z.statuses.flatMap((st): OverlayId[] => {
        const local = st.id.slice(st.id.indexOf(':') + 1);
        const c = conditionIdOf(st.id);
        if (c) return [c];
        return local === 'frozen' ||
          local === 'rooted' ||
          local === 'overload' ||
          local === 'steam-burst'
          ? [local]
          : [];
      });
      this.overlays[side].set(ids, fa.look.size * fa.look.fill);
    }
  }

  /**
   * Rasterizing a clip takes ~0.1 s (C09). Doing it while text waits for the player keeps
   * the hitch out of attacks and hits.
   */
  private preloadOne(): void {
    const job = this.preloads[0];
    if (!job || this.tweens.length > 0 || this.vfxLayer.children.length > 0) return;
    if (!(this.stack.top instanceof DialogBox) && !(this.stack.top instanceof Menu)) return;
    this.preloads.shift();
    if (!job.actor.destroyed) job.actor.preload(job.clip);
  }

  private untilBars(): Promise<void> {
    return this.until(() => !this.foeCard.hpBar.animating && !this.allyCard.hpBar.animating);
  }

  // ---- input and menus -------------------------------------------------------------------

  private handleKeys(): void {
    const input = this.options.input;
    const top = this.stack.top;
    if (input.pressed('inspect')) {
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
    if (this.busy || this.state.phase !== 'choose') return;
    if (top !== this.actionMenu && (top === undefined || top !== this.moveMenu)) return;
    if (clicked !== undefined) this.trySwitch(clicked);
    (['hotbar1', 'hotbar2', 'hotbar3'] as const).forEach((k, i) => {
      if (input.pressed(k)) this.trySwitch(i);
    });
  }

  private legal(): Choice[] {
    return legalChoices(this.options.content, this.state, PLAYER);
  }

  private openActions(): void {
    const legal = this.legal();
    const has = (kind: Choice['kind']): boolean => legal.some((c) => c.kind === kind);
    const me = shownActive(this.shown, PLAYER);
    const foe = shownActive(this.shown, OPPONENT);
    const menu = new Menu({
      theme: this.theme,
      items: [
        { label: 'Fight', disabled: !has('move') },
        { label: 'Switch', hint: '1 2 3', disabled: !has('switch') },
        // Open whenever the bag holds something; items that can't be used now say why.
        { label: 'Items', disabled: !Object.values(this.state.bag).some((n) => n > 0) },
        { label: 'Run', disabled: !has('run') },
      ],
      width: MENU_W,
      onSelect: (i) => {
        if (i === 0) this.openMoves();
        else if (i === 1) this.openSwitch(false);
        else if (i === 2) this.openBag();
        else this.choose({ kind: 'run' });
      },
    });
    this.actionMenu = menu;
    if (foe.subdued) {
      this.message.set(`${foe.name} is Subdued.\nThrow a capture item!`, [
        ['E', 'Select'],
        ['F', 'Info'],
      ]);
    } else {
      this.message.set(`What will ${me.name} do?`, [
        ['E', 'Select'],
        ['1-3', 'Switch'],
        ['F', 'Info'],
      ]);
    }
    this.push(menu, () => menu.view.position.set(this.width - MARGIN - MENU_W, this.barY));
  }

  private closeMenus(): void {
    for (const w of [...this.placers.keys()]) if (this.stack.includes(w)) this.stack.remove(w);
    this.placers.clear();
    this.actionMenu = undefined;
    this.moveMenu = undefined;
    this.moveInfo.visible = false;
    this.message.visible = true;
    this.veil.visible = false;
  }

  private openMoves(): void {
    const { content } = this.options;
    const me = activeOf(this.state, PLAYER);
    const foe = shownActive(this.shown, OPPONENT);
    const show = (i: number): void => {
      const id = me.moves[i];
      if (id) this.moveInfo.set(moveViewFor(content, id, foe));
    };
    const close = (): void => {
      this.stack.remove(menu);
      this.moveMenu = undefined;
      this.moveInfo.visible = false;
      this.message.visible = true;
      if (this.actionMenu) this.actionMenu.view.visible = true;
    };
    const menu = new Menu({
      theme: this.theme,
      title: 'Moves',
      width: 150,
      items: me.moves.map((id) => {
        const m = content.moves.require(id);
        const t = typeIdOf(m.type) ?? 'metal';
        return { label: m.name, icon: () => new TypeBadge(t, { label: false }) };
      }),
      onHighlight: (i) => show(i),
      onSelect: (slot) => {
        const choice: Choice = { kind: 'move', slot };
        if (this.legal().some((c) => sameChoice(c, choice))) this.choose(choice);
      },
      onBack: close,
    });
    this.moveMenu = menu;
    show(0);
    this.message.visible = false;
    this.moveInfo.visible = true;
    if (this.actionMenu) this.actionMenu.view.visible = false;
    this.push(menu, () => menu.view.position.set(this.barX, this.barY));
  }

  /** `1 2 3` / hotbar clicks: switch to that slot if allowed. */
  private trySwitch(slot: number): void {
    const s = this.state.sides[PLAYER];
    const target = s.team[slot];
    if (!target || slot === s.active) return;
    if (target.hp <= 0) {
      this.flash(
        `${shownActive(this.shown, PLAYER).name}'s teammate in slot ${slot + 1} has fainted.`,
      );
      return;
    }
    const choice: Choice = { kind: 'switch', to: slot };
    if (!this.legal().some((c) => sameChoice(c, choice))) {
      this.flash(this.switchBlockedText());
      return;
    }
    if (!this.options.confirmHotbarSwitch) {
      this.choose(choice);
      return;
    }
    const name = this.shown.sides[PLAYER].team[slot]?.name ?? '';
    const confirm = new Menu({
      theme: this.theme,
      title: `Switch to ${name}?`,
      width: MENU_W,
      items: [{ label: 'Switch' }, { label: 'Cancel' }],
      onSelect: (i) => {
        this.stack.remove(confirm);
        if (i === 0) this.choose(choice);
      },
      onBack: () => this.stack.remove(confirm),
    });
    this.push(confirm, () =>
      confirm.view.position.set(
        this.width - MARGIN - confirm.width,
        this.barY - confirm.height - 3,
      ),
    );
  }

  private switchBlockedText(): string {
    const me = activeOf(this.state, PLAYER);
    if (isTrapped(this.options.content, me))
      return `${shownActive(this.shown, PLAYER).name} is Rooted and can't switch out!`;
    return "You can't switch now.";
  }

  /** Shows a short note in the message box (no turn is used). */
  private flash(text: string): void {
    this.message.set(text, [['E', 'Select']]);
  }

  private openSwitch(forced: boolean): void {
    const s = this.state.sides[PLAYER];
    const legal = forced ? [] : this.legal();
    const menu: Menu = new Menu({
      theme: this.theme,
      title: forced ? 'Choose a Zorling' : 'Switch',
      width: MENU_W,
      items: s.team.map((c, i) => ({
        label: `${i + 1}  ${this.shown.sides[PLAYER].team[i]?.name ?? ''}`,
        hint: c.hp > 0 ? `${c.hp}/${c.stats.hp}` : 'Fainted',
        disabled: forced
          ? c.hp <= 0 || i === s.active
          : !legal.some((ch) => sameChoice(ch, { kind: 'switch', to: i })),
      })),
      onSelect: (to) => {
        this.stack.remove(menu);
        if (forced) void this.doStep({ kind: 'replace', side: PLAYER, to });
        else this.choose({ kind: 'switch', to });
      },
      ...(forced ? {} : { onBack: () => this.stack.remove(menu) }),
    });
    if (forced) this.message.set(`Who will you send out next?`, [['E', 'Select']]);
    else if (isTrapped(this.options.content, activeOf(this.state, PLAYER)))
      this.flash(this.switchBlockedText());
    this.push(menu, () =>
      menu.view.position.set(this.width - MARGIN - menu.width, this.barY - menu.height - 3),
    );
  }

  private openBag(): void {
    const { content } = this.options;
    const team = this.shown.sides[PLAYER].team.map((z, i) => this.viewOf(z, PLAYER, i));
    const panel = new BagPanel({
      tabs: bagTabsFor(content, this.state.bag),
      team,
      money: this.options.money ?? 0,
      onUse: (item, target) => this.useItem(panel, item, target),
      onBack: () => {
        this.stack.remove(panel);
        this.veil.visible = false;
      },
    });
    this.veil.visible = true;
    this.push(panel, () =>
      panel.view.position.set(
        Math.round((this.width - BagPanel.WIDTH) / 2),
        Math.round((this.height - BAR_H - BagPanel.HEIGHT) / 2),
      ),
    );
  }

  private useItem(panel: BagPanel, item: BagItem, target: number | undefined): void {
    const choice: Choice =
      target === undefined
        ? { kind: 'item', item: item.id }
        : { kind: 'item', item: item.id, target };
    if (this.legal().some((c) => sameChoice(c, choice))) {
      this.stack.remove(panel);
      this.veil.visible = false;
      this.choose(choice);
      return;
    }
    // Not allowed: say why and stay in the bag.
    const { content } = this.options;
    const effect = content.items.require(item.id).effect;
    const foe = shownActive(this.shown, OPPONENT);
    let why = "It won't have any effect.";
    if (effect.kind === 'capture') {
      if (this.state.kind !== 'wild') why = "You can't catch a trainer's Zorling!";
      else if (foe.boss && !foe.subdued)
        why = `The ${foe.name} is too strong to catch. Defeat it first!`;
    } else if (target !== undefined) {
      const z = this.state.sides[PLAYER].team[target];
      if (z && z.hp <= 0) why = 'Potions cannot revive a fainted Zorling.';
      else if (z && z.hp >= z.stats.hp) why = 'Its HP is already full.';
    } else if (foe.subdued) {
      why = 'Throw a capture item now!';
    }
    this.stack.remove(panel);
    this.veil.visible = false;
    void this.say(why).then(() => {
      if (!this.busy && this.state.phase === 'choose') this.openBag();
    });
  }

  // ---- text and timing -------------------------------------------------------------------

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
        void this.until(() => dialog.typewriter.pageComplete).then(() =>
          this.delay(0.35).then(() => {
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

  private until(pred: () => boolean): Promise<void> {
    return new Promise((resolve) => this.waiters.push({ pred, resolve }));
  }

  /** Waits `seconds` of battle time (shorter at higher battle speed). */
  private delay(seconds: number): Promise<void> {
    const end = this.time + seconds;
    return this.until(() => this.time >= end);
  }

  private tween(seconds: number, fn: (k: number) => void): Promise<void> {
    fn(0);
    return new Promise((resolve) =>
      this.tweens.push({ start: this.time, end: this.time + seconds, fn, resolve }),
    );
  }

  private updateTweens(): void {
    const done: Tween[] = [];
    for (const t of this.tweens) {
      const k = Math.min(1, (this.time - t.start) / Math.max(1e-6, t.end - t.start));
      t.fn(k);
      if (k >= 1) done.push(t);
    }
    if (done.length === 0) return;
    this.tweens = this.tweens.filter((t) => !done.includes(t));
    for (const t of done) t.resolve();
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
