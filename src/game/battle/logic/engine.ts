/**
 * The battle engine: `step(content, state, action) → { state, events }`. Pure and
 * deterministic: the input state is never changed, and all randomness comes from the RNG
 * state stored in the battle, so the same state and action always give the same result.
 */

import { Rng, type Seed } from '@engine/core';
import type { GameContent, Item, Reaction } from '@game/data';
import { takeFromBag, type Bag } from '@game/inventory';
import { statsOf, type Zorling } from '@game/progression';
import { armorHit, hpUnit, isSubdued } from './boss';
import {
  ACTION_RANK,
  ARMOR_BROKEN_TURNS,
  captureChance,
  CAPTURE_WOBBLES,
  captureWobbles,
  computeDamage,
  DAMAGE_ROLL_MIN,
  hitChance,
  runChance,
  statusHpLoss,
} from './rules';
import {
  activeOf,
  canFight,
  foe,
  needsReplacement,
  OPPONENT,
  PLAYER,
  type BattleAction,
  type BattleEvent,
  type BattleKind,
  type BattleSide,
  type BattleState,
  type BossState,
  type Choice,
  type Combatant,
  type SideId,
  type Status,
  type StepResult,
} from './state';
import {
  conditionTurnBonus,
  effectiveSpeed,
  fumbleChance,
  immunityTo,
  isTrapped,
  statMultiplier,
  statusEffects,
  statusWith,
  typePower,
} from './status';

/** Working copy the engine changes while resolving one action (never the caller's state). */
type DraftStatus = { -readonly [K in keyof Status]: Status[K] };
type DraftBoss = { -readonly [K in keyof BossState]: BossState[K] };
type DraftCombatant = Omit<Combatant, 'hp' | 'statuses' | 'boss'> & {
  hp: number;
  statuses: DraftStatus[];
  boss: DraftBoss | null;
};
interface DraftSide {
  team: DraftCombatant[];
  active: number;
}
type Draft = Omit<
  BattleState,
  'turn' | 'phase' | 'outcome' | 'runAttempts' | 'sides' | 'bag' | 'rng'
> & {
  turn: number;
  phase: BattleState['phase'];
  outcome: BattleState['outcome'];
  runAttempts: number;
  sides: [DraftSide, DraftSide];
  bag: Bag;
  rng: BattleState['rng'];
};

/** Everything one step works with. */
interface Ctx {
  readonly content: GameContent;
  readonly draft: Draft;
  readonly rng: Rng;
  readonly events: BattleEvent[];
  /** Sides whose move this turn has not been resolved yet. */
  readonly pending: Set<SideId>;
}

export interface BattleSetup {
  readonly kind: BattleKind;
  readonly seed: Seed;
  /** The player's team in hotbar order. Fainted members may be included. */
  readonly player: readonly Zorling[];
  /** The wild Zorling, or the trainer's team in send-out order. */
  readonly opponent: readonly Zorling[];
  /**
   * Conditions the weather puts on both Zorlings sent out first (e.g. ash storms → Burning).
   * Traits can block them as usual.
   */
  readonly weather?: readonly string[];
  /** The player's bag (items usable in battle). Default: empty. */
  readonly bag?: Bag;
  /**
   * An opposing Zorling that fights in boss form (`content.bosses` id; `slot` defaults to 0).
   * Its Zorling should be the boss species (see `bossZorling`). Beaten in a wild battle, it is
   * Subdued instead of fainting.
   */
  readonly boss?: { readonly id: string; readonly slot?: number };
}

/** Starts a battle: each side sends out its first Zorling that has not fainted. */
export function createBattle(content: GameContent, setup: BattleSetup): StepResult {
  const bossSlot = setup.boss ? (setup.boss.slot ?? 0) : -1;
  const toSide = (team: readonly Zorling[], side: SideId): BattleSide => {
    if (team.length === 0) throw new Error(`Side ${side} has no Zorlings`);
    const combatants = team.map((z, i) =>
      toCombatant(content, z, side === OPPONENT && i === bossSlot ? setup.boss?.id : undefined),
    );
    const active = combatants.findIndex((c) => c.hp > 0);
    if (active < 0) throw new Error(`Side ${side} has no Zorling that can fight`);
    return { team: combatants, active };
  };
  const player = toSide(setup.player, PLAYER);
  const opponent = toSide(setup.opponent, OPPONENT);
  if (setup.kind === 'wild' && opponent.team.length !== 1) {
    throw new Error('A wild battle has exactly one opposing Zorling');
  }
  if (setup.boss && !opponent.team[bossSlot]) {
    throw new Error(`No opposing Zorling in boss slot ${bossSlot}`);
  }
  const bag = setup.bag ?? {};
  for (const [item, count] of Object.entries(bag)) {
    content.items.require(item);
    if (!Number.isInteger(count) || count < 0) throw new Error(`Bad count for "${item}"`);
  }
  const state: BattleState = {
    kind: setup.kind,
    turn: 1,
    phase: 'choose',
    outcome: null,
    runAttempts: 0,
    sides: [player, opponent],
    bag,
    rng: new Rng(setup.seed).getState(),
  };
  const ctx: Ctx = {
    content,
    draft: clone(state),
    rng: Rng.fromState(state.rng),
    events: [
      { kind: 'sendOut', side: PLAYER, slot: player.active },
      { kind: 'sendOut', side: OPPONENT, slot: opponent.active },
    ],
    // Both still act in turn 1, so weather conditions count down from turn 1.
    pending: new Set([PLAYER, OPPONENT]),
  };
  for (const condition of setup.weather ?? []) {
    content.conditions.require(condition);
    for (const side of [PLAYER, OPPONENT] as const) applyCondition(ctx, side, condition, null);
  }
  return { state: ctx.draft, events: ctx.events };
}

/**
 * A Zorling as it enters the battle. In boss form (`bossId`) the aura multiplies its max HP
 * (its HP keeps the same fraction), adds the signature move and puts on its Armor.
 */
function toCombatant(content: GameContent, z: Zorling, bossId?: string): Combatant {
  const base = statsOf(content, z);
  const hp = Math.min(Math.max(0, z.hp), base.hp);
  const types = content.species.require(z.species).types;
  if (bossId === undefined) {
    return { zorling: z, moves: z.moves, types, stats: base, hp, statuses: [], boss: null };
  }
  const boss = content.bosses.require(bossId);
  if (boss.species !== z.species) {
    throw new Error(`Boss "${boss.id}" is a "${boss.species}", not a "${z.species}"`);
  }
  const maxHp = Math.floor(base.hp * boss.hpMultiplier);
  return {
    zorling: z,
    moves: z.moves.includes(boss.signatureMove) ? z.moves : [...z.moves, boss.signatureMove],
    types,
    stats: { ...base, hp: maxHp },
    hp: hp >= base.hp ? maxHp : Math.ceil((hp / base.hp) * maxHp),
    statuses: [],
    boss: {
      id: boss.id,
      baseHp: base.hp,
      armor: boss.armor ? 'armored' : 'none',
      rearmTurn: null,
      subdued: false,
    },
  };
}

/**
 * Every choice a side may make this turn (phase `'choose'`). A trapped Zorling (Rooted)
 * cannot switch out. The player may also use items: a potion on any team member that has not
 * fainted and is not at full HP, a capture item in a wild battle (not at a boss until it is
 * Subdued). A Subdued boss can only wait; the player can then only throw capture items.
 */
export function legalChoices(content: GameContent, state: BattleState, side: SideId): Choice[] {
  if (state.phase !== 'choose') return [];
  const s = state.sides[side];
  const active = activeOf(state, side);
  if (isSubdued(active)) return [{ kind: 'wait' }];
  if (isSubdued(activeOf(state, foe(side)))) {
    if (side !== PLAYER) return [];
    return itemChoices(content, state).filter((c) => c.kind === 'item' && c.target === undefined);
  }
  const out: Choice[] = active.moves.map((_, slot) => ({ kind: 'move', slot }));
  if (!isTrapped(content, active)) {
    s.team.forEach((c, to) => {
      if (to !== s.active && c.hp > 0) out.push({ kind: 'switch', to });
    });
  }
  if (side === PLAYER) out.push(...itemChoices(content, state));
  if (side === PLAYER && state.kind === 'wild') out.push({ kind: 'run' });
  return out;
}

function itemChoices(content: GameContent, state: BattleState): Choice[] {
  const out: Choice[] = [];
  for (const [id, count] of Object.entries(state.bag)) {
    if (count <= 0) continue;
    const item = content.items.require(id);
    if (item.effect.kind === 'heal') {
      state.sides[PLAYER].team.forEach((c, target) => {
        if (c.hp > 0 && c.hp < c.stats.hp) out.push({ kind: 'item', item: item.id, target });
      });
    } else if (state.kind === 'wild' && canBeCaught(activeOf(state, OPPONENT))) {
      out.push({ kind: 'item', item: item.id });
    }
  }
  return out;
}

/** A boss can only be caught once Subdued. */
function canBeCaught(c: Combatant): boolean {
  return c.boss === null || c.boss.subdued;
}

/** Whether the bag holds a capture item. */
function hasCaptureItem(content: GameContent, bag: Bag): boolean {
  return Object.entries(bag).some(
    ([id, n]) => n > 0 && content.items.require(id).effect.kind === 'capture',
  );
}

/** Whether two choices are the same. */
export function sameChoice(a: Choice, b: Choice): boolean {
  switch (a.kind) {
    case 'move':
      return b.kind === 'move' && a.slot === b.slot;
    case 'switch':
      return b.kind === 'switch' && a.to === b.to;
    case 'run':
      return b.kind === 'run';
    case 'item':
      return b.kind === 'item' && a.item === b.item && a.target === b.target;
    case 'wait':
      return b.kind === 'wait';
  }
}

/** Slots a side may send in during phase `'replace'`. */
export function legalReplacements(state: BattleState, side: SideId): number[] {
  if (!needsReplacement(state, side)) return [];
  return state.sides[side].team.flatMap((c, i) => (c.hp > 0 ? [i] : []));
}

/** Applies one action. Throws on an action that is not allowed in the current state. */
export function step(content: GameContent, state: BattleState, action: BattleAction): StepResult {
  switch (action.kind) {
    case 'turn':
      return playTurn(content, state, action.player, action.opponent);
    case 'replace':
      return replace(state, action.side, action.to);
  }
}

function replace(state: BattleState, side: SideId, to: number): StepResult {
  if (!legalReplacements(state, side).includes(to)) {
    throw new Error(`Side ${side} cannot send in slot ${to} now`);
  }
  const draft = clone(state);
  draft.sides[side].active = to;
  const events: BattleEvent[] = [{ kind: 'sendOut', side, slot: to }];
  if (!needsReplacement(draft, PLAYER) && !needsReplacement(draft, OPPONENT)) {
    draft.phase = 'choose';
  }
  return { state: draft, events };
}

interface Queued {
  readonly side: SideId;
  readonly choice: Choice;
}

function playTurn(
  content: GameContent,
  state: BattleState,
  player: Choice,
  opponent: Choice,
): StepResult {
  if (state.phase !== 'choose') throw new Error(`Cannot play a turn in phase "${state.phase}"`);
  checkChoice(content, state, PLAYER, player);
  checkChoice(content, state, OPPONENT, opponent);

  const queue: Queued[] = [
    { side: PLAYER, choice: player },
    { side: OPPONENT, choice: opponent },
  ];
  const ranked = (rank: number): Queued[] =>
    queue.filter((q) => ACTION_RANK[q.choice.kind] === rank);
  const ctx: Ctx = {
    content,
    draft: clone(state),
    rng: Rng.fromState(state.rng),
    events: [{ kind: 'turnStart', turn: state.turn }],
    pending: new Set(ranked(ACTION_RANK.move).map((q) => q.side)),
  };

  // Only the player can choose to run (checked above).
  if (player.kind === 'run') tryRun(ctx);
  if (ctx.draft.phase !== 'ended') {
    // Switches and items, player first. A catch ends the battle at once.
    for (const q of ranked(ACTION_RANK.switch)) {
      if (isOver(ctx)) break;
      if (q.choice.kind === 'switch') doSwitch(ctx, q.side, q.choice.to);
      if (q.choice.kind === 'item') useItem(ctx, q.side, q.choice.item, q.choice.target);
    }
  }
  if (ctx.draft.phase !== 'ended') {
    for (const q of moveOrder(ctx, ranked(ACTION_RANK.move))) {
      if (q.choice.kind === 'move') useMove(ctx, q.side, q.choice.slot);
    }
    tickStatuses(ctx);
    rearm(ctx);
    endTurn(ctx);
  }
  ctx.draft.rng = ctx.rng.getState();
  return { state: ctx.draft, events: ctx.events };
}

function checkChoice(content: GameContent, state: BattleState, side: SideId, choice: Choice) {
  const ok = legalChoices(content, state, side).some((c) => sameChoice(c, choice));
  if (!ok) throw new Error(`Side ${side} cannot choose ${JSON.stringify(choice)} now`);
}

function active(ctx: Ctx, side: SideId): DraftCombatant {
  const s = ctx.draft.sides[side];
  const c = s.team[s.active];
  if (!c) throw new Error(`Side ${side} has no Zorling in slot ${s.active}`);
  return c;
}

/** Faster Zorling first (after Wet, Chilled, …); a speed tie is a coin flip. */
function moveOrder(ctx: Ctx, moves: Queued[]): Queued[] {
  const [a, b] = moves;
  if (!a || !b) return moves;
  const speedA = effectiveSpeed(ctx.content, active(ctx, a.side));
  const speedB = effectiveSpeed(ctx.content, active(ctx, b.side));
  const aFirst = speedA === speedB ? ctx.rng.chance(0.5) : speedA > speedB;
  return aFirst ? [a, b] : [b, a];
}

function tryRun(ctx: Ctx): void {
  const speed = effectiveSpeed(ctx.content, active(ctx, PLAYER));
  const foeSpeed = effectiveSpeed(ctx.content, active(ctx, OPPONENT));
  if (ctx.rng.chance(runChance(speed, foeSpeed, ctx.draft.runAttempts))) {
    ctx.events.push({ kind: 'ran' });
    finish(ctx, 'ran');
  } else {
    ctx.draft.runAttempts += 1;
    ctx.events.push({ kind: 'runFailed' });
  }
}

/** Takes the item from the bag and uses it: a potion heals, a capture item is thrown. */
function useItem(ctx: Ctx, side: SideId, id: string, target: number | undefined): void {
  const item = ctx.content.items.require(id);
  ctx.draft.bag = takeFromBag(ctx.draft.bag, item.id);
  ctx.events.push({ kind: 'itemUsed', side, item: item.id, slot: target ?? null });
  if (item.effect.kind === 'heal') {
    const slot = target ?? -1;
    const c = ctx.draft.sides[side].team[slot];
    if (!c) throw new Error(`No Zorling in slot ${slot}`);
    const amount = item.effect.amount === 'full' ? c.stats.hp : item.effect.amount;
    heal(ctx, side, amount, slot);
  } else {
    throwCapture(ctx, item, item.effect.strength);
  }
}

/** One roll decides the catch; how close it came sets the wobbles. Subdued: always caught. */
function throwCapture(ctx: Ctx, item: Item, strength: number): void {
  const wild = active(ctx, OPPONENT);
  if (isSubdued(wild)) {
    ctx.events.push({ kind: 'capture', item: item.id, success: true, wobbles: CAPTURE_WOBBLES });
    return finish(ctx, 'caught');
  }
  const chance = captureChance({
    hp: wild.hp,
    maxHp: wild.stats.hp,
    strength,
    catchRate: ctx.content.species.require(wild.zorling.species).catchRate,
    hasCondition: wild.statuses.some((s) => s.origin === 'condition'),
  });
  const roll = ctx.rng.next();
  const success = roll < chance;
  ctx.events.push({
    kind: 'capture',
    item: item.id,
    success,
    wobbles: captureWobbles(chance, roll),
  });
  if (success) finish(ctx, 'caught');
}

/** Switching out clears the Zorling's conditions and lingering effects. */
function doSwitch(ctx: Ctx, side: SideId, to: number): void {
  const s = ctx.draft.sides[side];
  active(ctx, side).statuses = [];
  ctx.events.push({ kind: 'switchOut', side, slot: s.active });
  s.active = to;
  ctx.events.push({ kind: 'sendOut', side, slot: to });
}

/**
 * Resolves one move. RNG draws in order: fumble (only when Charged), hit, damage (moves with
 * power), condition (moves with an apply chance, if the target is still up).
 */
function useMove(ctx: Ctx, side: SideId, slot: number): void {
  const { content, rng, events } = ctx;
  ctx.pending.delete(side);
  const user = active(ctx, side);
  if (user.hp <= 0) return; // fainted earlier this turn
  const targetSide = foe(side);
  const target = active(ctx, targetSide);
  if (target.hp <= 0) return;

  const skip = statusWith(content, user, 'skipTurn');
  if (skip) {
    events.push({ kind: 'skipped', side, status: skip.id });
    return;
  }
  const move = content.moves.require(user.moves[slot] ?? '');
  events.push({ kind: 'useMove', side, move: move.id });
  const fumble = fumbleChance(content, user);
  if (fumble > 0 && rng.chance(fumble)) {
    events.push({ kind: 'fumbled', side, move: move.id });
    return;
  }
  const accuracy = statMultiplier(content, user, 'accuracy');
  const evasion = statMultiplier(content, target, 'evasion');
  if (!rng.chance(hitChance(move.accuracy, accuracy, evasion))) {
    events.push({ kind: 'miss', side, move: move.id });
    return;
  }

  if (move.power > 0) {
    // Only hits with power set off reactions; status moves just apply their condition.
    const reaction = triggerReaction(ctx, targetSide, move.type);
    const armor = armorHit(content, target, reaction?.id);
    if (armor.breaks && target.boss && reaction) {
      target.boss.armor = 'broken';
      target.boss.rearmTurn = ctx.draft.turn + ARMOR_BROKEN_TURNS;
      events.push({ kind: 'armorBroken', side: targetSide, reaction: reaction.id });
    }
    const effectiveness = content.effectiveness(move.type, target.types);
    const amount = computeDamage({
      level: user.zorling.level,
      power: move.power,
      attack: user.stats.attack * statMultiplier(content, user, 'attack'),
      defense: target.stats.defense * statMultiplier(content, target, 'defense'),
      effectiveness,
      roll: rng.float(DAMAGE_ROLL_MIN, 1),
      multiplier:
        (reaction?.damageMultiplier ?? 1) * typePower(content, user, move.type) * armor.multiplier,
      ignoreDefense: reaction?.ignoreDefense ?? false,
    });
    const dealt = Math.min(amount, target.hp);
    target.hp -= dealt;
    events.push({ kind: 'damage', side: targetSide, amount: dealt, hp: target.hp, effectiveness });
    if (target.hp <= 0) return faint(ctx, targetSide);
    if (reaction?.lingering) addLingering(ctx, targetSide, reaction, side);
  }
  if (move.applyChance > 0 && rng.chance(move.applyChance)) {
    applyCondition(ctx, targetSide, content.conditionOf(move.type).id, side);
  }
}

/**
 * A hit of `moveType` on a target with a condition it exploits: uses the condition up and
 * returns the reaction. With several matching conditions, the oldest one reacts.
 */
function triggerReaction(ctx: Ctx, side: SideId, moveType: string): Reaction | undefined {
  const target = active(ctx, side);
  for (const status of target.statuses) {
    if (status.origin !== 'condition') continue;
    const reaction = ctx.content.reactionFor(status.id, moveType);
    if (!reaction) continue;
    target.statuses = target.statuses.filter((s) => s !== status);
    ctx.events.push({ kind: 'reaction', side, reaction: reaction.id, condition: status.id });
    return reaction;
  }
  return undefined;
}

/** Puts a condition on `side`'s active Zorling, or refreshes it if it is already there. */
function applyCondition(ctx: Ctx, side: SideId, condition: string, source: SideId | null) {
  const target = active(ctx, side);
  if (target.hp <= 0) return;
  const trait = immunityTo(ctx.content, target, condition);
  if (trait) {
    ctx.events.push({ kind: 'conditionBlocked', side, condition, trait });
    return;
  }
  const bonus = source === null ? 0 : conditionTurnBonus(ctx.content, active(ctx, source));
  const turns = Math.max(1, ctx.content.conditions.require(condition).turns + bonus);
  const refreshed = addStatus(ctx, side, condition, 'condition', turns, source);
  ctx.events.push({ kind: 'conditionApplied', side, condition, turns, source, refreshed });
}

function addLingering(ctx: Ctx, side: SideId, reaction: Reaction, source: SideId): void {
  if (!reaction.lingering) return;
  addStatus(ctx, side, reaction.id, 'reaction', reaction.lingering.turns, source);
}

/**
 * Adds a status, or restarts the same one in place. Returns whether it was already there.
 *
 * Applied after the holder acted this turn, a new status is `fresh` (skips this turn's
 * countdown and HP loss). A status that was already ticking keeps this turn's tick and gets
 * one extra countdown instead, so re-applying it every turn never stops its HP loss.
 */
function addStatus(
  ctx: Ctx,
  side: SideId,
  id: string,
  origin: Status['origin'],
  turns: number,
  source: SideId | null,
): boolean {
  const holder = active(ctx, side);
  const i = holder.statuses.findIndex((s) => s.id === id && s.origin === origin);
  const existing = holder.statuses[i];
  const acted = !ctx.pending.has(side);
  const keepTick = acted && existing !== undefined && !existing.fresh;
  const status: DraftStatus = {
    id,
    origin,
    turnsLeft: keepTick ? turns + 1 : turns,
    ticks: 0,
    source,
    fresh: acted && !keepTick,
  };
  if (existing) holder.statuses[i] = status;
  else holder.statuses.push(status);
  return existing !== undefined;
}

/**
 * End of turn, player first: each status on a Zorling on the field takes its HP (drains
 * heal the applier's side), then counts down and ends at 0. A status applied after its
 * holder acted this turn skips this countdown.
 */
function tickStatuses(ctx: Ctx): void {
  for (const side of [PLAYER, OPPONENT] as const) {
    const holder = active(ctx, side);
    if (holder.hp <= 0) continue; // fainted during the turn
    for (const status of [...holder.statuses]) {
      if (holder.hp <= 0) break;
      if (status.fresh) {
        status.fresh = false;
        continue;
      }
      for (const effect of statusEffects(ctx.content, status)) {
        if (effect.kind !== 'hpLoss' || holder.hp <= 0) continue;
        const loss = statusHpLoss(hpUnit(holder), effect.fraction, effect.growth, status.ticks);
        const amount = Math.min(loss, holder.hp);
        holder.hp -= amount;
        ctx.events.push({ kind: 'statusDamage', side, status: status.id, amount, hp: holder.hp });
        if (effect.toSource && status.source !== null) {
          heal(ctx, status.source, amount, ctx.draft.sides[status.source].active);
        }
      }
      status.ticks += 1;
      status.turnsLeft -= 1;
      if (status.turnsLeft <= 0 && holder.hp > 0) {
        holder.statuses = holder.statuses.filter((s) => s !== status);
        ctx.events.push({ kind: 'statusEnded', side, status: status.id, origin: status.origin });
      }
    }
    if (holder.hp <= 0) faint(ctx, side);
  }
}

/** Heals the Zorling in `slot` of `side` (if it is still up), never above max HP. */
function heal(ctx: Ctx, side: SideId, amount: number, slot: number): void {
  const c = ctx.draft.sides[side].team[slot];
  if (!c || c.hp <= 0) return;
  const healed = Math.min(amount, c.stats.hp - c.hp);
  if (healed <= 0) return;
  c.hp += healed;
  ctx.events.push({ kind: 'heal', side, slot, amount: healed, hp: c.hp });
}

/** At 0 HP: a boss in a wild battle is Subdued (its aura and Armor go), others faint. */
function faint(ctx: Ctx, side: SideId): void {
  const c = active(ctx, side);
  c.statuses = [];
  const slot = ctx.draft.sides[side].active;
  if (c.boss && ctx.draft.kind === 'wild') {
    c.boss.subdued = true;
    c.boss.armor = 'none';
    c.boss.rearmTurn = null;
    ctx.events.push({ kind: 'subdued', side, slot });
    return;
  }
  ctx.events.push({ kind: 'fainted', side, slot });
}

/** Broken Armor whose time is up re-arms at the end of the turn. */
function rearm(ctx: Ctx): void {
  for (const side of [PLAYER, OPPONENT] as const) {
    const boss = active(ctx, side).boss;
    if (boss?.armor !== 'broken' || boss.rearmTurn === null || boss.rearmTurn > ctx.draft.turn) {
      continue;
    }
    boss.armor = 'armored';
    boss.rearmTurn = null;
    ctx.events.push({ kind: 'armorRestored', side });
  }
}

function endTurn(ctx: Ctx): void {
  const { draft, events } = ctx;
  events.push({ kind: 'turnEnd', turn: draft.turn });
  draft.turn += 1;
  const playerUp = canFight(draft, PLAYER);
  const opponentUp = canFight(draft, OPPONENT);
  // A Subdued boss waits for a capture item; without one (or a team to throw it), it is a win.
  const subdued = isSubdued(activeOf(draft, OPPONENT));
  const catchable = subdued && playerUp && hasCaptureItem(ctx.content, draft.bag);
  // If both sides are out at once (damage over time), the player wins.
  if (!opponentUp && !catchable) return finish(ctx, 'win');
  if (!playerUp) return finish(ctx, 'lose');

  const waiting = ([PLAYER, OPPONENT] as const).filter(
    (s) => activeOf(draft, s).hp <= 0 && !isSubdued(activeOf(draft, s)),
  );
  if (waiting.length > 0) {
    draft.phase = 'replace';
    events.push({ kind: 'replaceNeeded', sides: waiting });
  }
}

/** Read through a function so TypeScript does not narrow `phase` across calls that set it. */
function isOver(ctx: Ctx): boolean {
  return ctx.draft.phase === 'ended';
}

function finish(ctx: Ctx, outcome: NonNullable<BattleState['outcome']>): void {
  ctx.draft.phase = 'ended';
  ctx.draft.outcome = outcome;
  ctx.events.push({ kind: 'end', outcome });
}

function clone(state: BattleState): Draft {
  return structuredClone(state) as unknown as Draft;
}
