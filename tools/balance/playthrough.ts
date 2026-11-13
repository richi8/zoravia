/**
 * Playthrough simulator (C31): an AI player plays a region's story in order with real
 * progression. It starts with one starter, catches its team in the wild, grinds the zones it
 * has reached (real spawn tables, real XP and prize money), evolves and learns moves, buys
 * potions before story fights, and fights every route trainer, rival, Titan, region boss and
 * legendary through the real battle engine, retrying after a loss.
 *
 * It answers the balance questions of C31: how many wild battles each part of the campaign
 * takes, at what levels the player arrives at each fight, how often fights are lost, and how
 * money compares to potion prices. Pure and deterministic for a seed.
 */

import { Rng } from '@engine/core/rng';
import {
  activeOf,
  aiChoice,
  aiReplacement,
  createBattle,
  finishBattle,
  legalChoices,
  needsReplacement,
  OPPONENT,
  PLAYER,
  step,
  type BattleResult,
  type BattleSetup,
  type BattleState,
  type Choice,
} from '@game/battle/logic';
import type { GameContent } from '@game/data';
import {
  addBadge,
  answerMoveOffer,
  applyBattleResult,
  buyItem,
  evolveMember,
  healTeam,
  maxBuyable,
  memberOf,
  newParty,
  offersFrom,
  offerValid,
  wildPrize,
  type ApplyOptions,
  type Offer,
  type Party,
} from '@game/player';
import { createZorling, type ProgressEvent } from '@game/progression';
import { bossBattle, trainerBattle, type StoryBattle } from '@game/story';
import type { Zone } from '@game/world/map';
import { pickSpawn } from '@game/world/overworld/sim';

/** A story fight: a trainer (rival, trial, region boss) or a wild boss (Titan, legendary). */
export type Goal =
  { readonly trainer: string; readonly badge?: string } | { readonly boss: string };

/** A part of the campaign: the zones it opens for grinding, then its fights in order. */
export interface RouteStage {
  readonly name: string;
  readonly zones: readonly string[];
  /** Shop stock reachable from here on (cumulative). */
  readonly shop?: readonly string[];
  readonly goals: readonly Goal[];
}

export interface PlaythroughSetup {
  readonly route: readonly RouteStage[];
  readonly zones: readonly Zone[];
  /** The starter and its level. */
  readonly starter: string;
  readonly starterLevel: number;
  /** Species caught in the wild for the rest of the team, in order. */
  readonly catches: readonly string[];
  readonly bag: Readonly<Record<string, number>>;
  readonly money: number;
  readonly seed: number;
  readonly policy?: Partial<PlayerPolicy>;
  /** Story fights (ids) to keep a party snapshot for, taken just before the first try. */
  readonly snapshots?: readonly string[];
}

/** How the simulated player plays (defaults in `DEFAULT_POLICY`). */
export interface PlayerPolicy {
  /** Fights a story battle once the team's mean level is at least its top level minus this. */
  readonly readyMargin: number;
  /** Wild battles fought after a lost story battle before trying again. */
  readonly retryGrind: number;
  /** Drinks a potion when the active Zorling is below this fraction of its HP. */
  readonly potionBelow: number;
  /** Buys potions (best tier on sale, up to the bag cap) before story fights. */
  readonly buyPotions: boolean;
  /** Gives up on a goal after this many lost attempts. */
  readonly maxAttempts: number;
  /**
   * After this many losses to a boss (wild, or a trainer's boss-form member), the player
   * follows its hint: catches a wild Zorling of a type the Armor-breaking reaction needs and
   * puts it on the team for that fight (0 = never).
   */
  readonly adaptAfter: number;
}

export const DEFAULT_POLICY: PlayerPolicy = {
  readyMargin: 1,
  retryGrind: 3,
  potionBelow: 0.35,
  buyPotions: true,
  maxAttempts: 25,
  adaptAfter: 3,
};

/**
 * Time estimates for the report (not measured in the browser): a battle turn with its text
 * and animations, and the walking, encounter and transitions around each battle.
 */
export const SECONDS_PER_TURN = 6;
export const SECONDS_PER_BATTLE = 20;

/** One story fight, as it went. */
export interface GoalLog {
  readonly id: string;
  readonly stage: string;
  readonly boss: boolean;
  /** The opposing team's highest level. */
  readonly foeLevel: number;
  /** Team levels when it was won (or given up). */
  readonly teamLevels: readonly number[];
  readonly attempts: number;
  readonly won: boolean;
  /** The species the player caught and put on the team for this fight (`adaptAfter`). */
  readonly adapted?: string;
  /** Wild battles fought since the previous goal, and how many of them were lost. */
  readonly wildBattles: number;
  readonly wildLosses: number;
  readonly potionsBought: number;
  readonly potionsUsed: number;
  readonly moneySpent: number;
  /** Money after the fight. */
  readonly money: number;
  readonly prize: number;
  /** Estimated play minutes since the previous goal. */
  readonly minutes: number;
}

export interface PlaythroughResult {
  readonly finished: boolean;
  readonly goals: readonly GoalLog[];
  readonly wildBattles: number;
  /** Wild battles the team lost (sent back to a center). */
  readonly wildLosses: number;
  readonly wildMoney: number;
  readonly prizeMoney: number;
  readonly minutes: number;
  readonly party: Party;
  /** Species on the final team. */
  readonly team: readonly string[];
  /**
   * The party just before the first try at each fight listed in `snapshots`: ready for it,
   * potions bought, team healed (debug checkpoints).
   */
  readonly snapshots: Readonly<Record<string, Party>>;
}

/** A Zorling caught for one boss fight, and the team member it stood in for. */
interface Adapted {
  readonly species: string;
  readonly uid: string;
  readonly benched: string;
}

const ZORB = 'core:zorb';
const POTIONS = ['core:max-potion', 'core:super-potion', 'core:potion'];
/** Potions the simulated player likes to carry into a story fight. */
const POTIONS_CARRIED = 5;

export function playthrough(content: GameContent, setup: PlaythroughSetup): PlaythroughResult {
  return new Run(content, setup).play();
}

class Run {
  private party: Party;
  private readonly rng: Rng;
  private readonly policy: PlayerPolicy;
  private readonly zones: Zone[] = [];
  private shop: string[] = [];
  private uid = 0;
  private battleSeed: number;
  private wild = { battles: 0, losses: 0, money: 0, turns: 0 };
  private sinceGoal = { battles: 0, turns: 0, losses: 0 };
  private prizeMoney = 0;
  private readonly goals: GoalLog[] = [];
  private readonly snapshots: Record<string, Party> = {};

  constructor(
    private readonly content: GameContent,
    private readonly setup: PlaythroughSetup,
  ) {
    this.rng = new Rng(`playthrough-${setup.seed}`);
    this.battleSeed = setup.seed * 100_000;
    this.policy = { ...DEFAULT_POLICY, ...setup.policy };
    this.party = newParty({
      team: [this.zorling(setup.starter, setup.starterLevel)],
      bag: { ...setup.bag },
      money: setup.money,
    });
  }

  play(): PlaythroughResult {
    let finished = true;
    outer: for (const stage of this.setup.route) {
      for (const key of stage.zones) {
        const zone = this.setup.zones.find((z) => z.key === key);
        if (!zone) throw new Error(`No zone "${key}"`);
        this.zones.push(zone);
      }
      if (stage.shop) this.shop = [...new Set([...this.shop, ...stage.shop])];
      this.catchTeam();
      for (const goal of stage.goals) {
        const log = this.fightGoal(stage.name, goal);
        this.goals.push(log);
        if (!log.won) {
          finished = false;
          break outer;
        }
      }
    }
    return {
      finished,
      goals: this.goals,
      wildBattles: this.wild.battles,
      wildLosses: this.wild.losses,
      wildMoney: this.wild.money,
      prizeMoney: this.prizeMoney,
      minutes: this.goals.reduce((s, g) => s + g.minutes, 0),
      party: this.party,
      team: this.party.team.map((z) => z.species),
      snapshots: this.snapshots,
    };
  }

  // ------------------------------------------------------------------ team

  private zorling(species: string, level: number) {
    return createZorling(this.content, { uid: `p${this.uid++}`, species, level });
  }

  /** Catches the planned species that live in the zones reached so far. */
  private catchTeam(): void {
    for (const species of this.setup.catches) {
      if (this.party.team.length >= 3) return;
      if (this.party.team.some((z) => this.lineOf(z.species) === this.lineOf(species))) continue;
      const zone = this.zones.find((z) => z.spawns.some((s) => s.species === species));
      if (!zone) continue;
      for (let tries = 0; tries < 60; tries++) {
        this.restock(ZORB, 5);
        const spawn = this.spawnOf(zone, species);
        if (this.wildBattle(spawn.species, spawn.level, true)) break;
      }
    }
  }

  /** The first stage of a species' line (so a caught Puddlit and Torrentoad count as one). */
  private lineOf(species: string): string {
    const all = this.content.species.values();
    let cur = species;
    for (;;) {
      const prev = all.find((s) => s.evolution?.into === cur);
      if (!prev) return cur;
      cur = prev.id;
    }
  }

  private spawnOf(zone: Zone, species: string): { species: string; level: number } {
    for (;;) {
      const s = pickSpawn(zone, this.rng);
      if (s.species === species) return s;
    }
  }

  /** Evolves whenever offered; learns a new move over its weakest one when it is better. */
  private decide(progress: readonly (readonly ProgressEvent[])[]): void {
    const queue: Offer[] = offersFrom(this.party.team, progress);
    while (queue.length) {
      const offer = queue.shift();
      if (!offer || !offerValid(this.content, this.party, offer)) continue;
      if (offer.kind === 'evolve') {
        const r = evolveMember(this.content, this.party, offer.uid);
        this.party = r.party;
        queue.push(...r.offers);
        continue;
      }
      const { zorling } = memberOf(this.party, offer.uid);
      const score = (m: string): number => {
        const move = this.content.moves.require(m);
        return move.power > 0 ? move.power * (move.accuracy / 100) : 45;
      };
      let worst = 0;
      zorling.moves.forEach((m, i) => {
        if (score(m) < score(zorling.moves[worst] ?? m)) worst = i;
      });
      const old = zorling.moves[worst] ?? '';
      const better = score(offer.move) > score(old);
      this.party = answerMoveOffer(
        this.content,
        this.party,
        offer.uid,
        offer.move,
        better ? worst : null,
      );
    }
  }

  // ------------------------------------------------------------------ shop

  private restock(item: string, count: number): void {
    const have = this.party.bag[item] ?? 0;
    const want = Math.min(count - have, maxBuyable(this.content, this.party, item));
    if (want > 0) this.party = buyItem(this.content, this.party, item, want);
  }

  /**
   * Fills the bag up to `POTIONS_CARRIED` potions, best tier on sale first, with the money
   * there is (a Max Potion only while it leaves enough for the cheaper ones).
   */
  private buyPotions(): number {
    if (!this.policy.buyPotions) return 0;
    const before = this.potionCount();
    const tiers = POTIONS.filter((p) => this.shop.includes(p));
    const price = (item: string): number => this.content.items.require(item).price;
    tiers.forEach((tier, i) => {
      const want = POTIONS_CARRIED - this.potionCount();
      if (want <= 0) return;
      // Upgrade a potion to this tier only while the rest can still be the next tier down.
      const next = tiers[i + 1];
      const extra = price(tier) - (next ? price(next) : 0);
      const spare = this.party.money - (next ? want * price(next) : 0);
      const n = Math.min(want, Math.floor(spare / extra));
      if (n > 0) this.restock(tier, (this.party.bag[tier] ?? 0) + n);
    });
    return this.potionCount() - before;
  }

  private potionCount(): number {
    return POTIONS.reduce((s, p) => s + (this.party.bag[p] ?? 0), 0);
  }

  // ------------------------------------------------------------------ battles

  private meanLevel(): number {
    const t = this.party.team;
    return t.reduce((s, z) => s + z.level, 0) / t.length;
  }

  /** The zone a player grinds in: the toughest one whose weakest wilds are not above the team. */
  private grindZone(): Zone {
    const level = this.meanLevel();
    const ok = this.zones.filter((z) => z.levels[0] <= level);
    const pick = (zs: Zone[], by: (z: Zone) => number): Zone | undefined =>
      [...zs].sort((a, b) => by(b) - by(a))[0];
    return (
      pick(ok, (z) => z.levels[0] + z.levels[1]) ??
      pick(this.zones, (z) => -(z.levels[0] + z.levels[1])) ??
      this.fail('No zone to grind in')
    );
  }

  private fail(msg: string): never {
    throw new Error(msg);
  }

  private grind(): void {
    const zone = this.grindZone();
    const s = pickSpawn(zone, this.rng);
    this.wildBattle(s.species, s.level, false);
  }

  /** One wild battle. Returns true when the Zorling was caught. */
  private wildBattle(species: string, level: number, catching: boolean): boolean {
    const foe = createZorling(this.content, { uid: 'wild', species, level });
    const setup: BattleSetup = {
      kind: 'wild',
      seed: this.battleSeed++,
      player: this.party.team,
      opponent: [foe],
      bag: this.party.bag,
    };
    const { state, turns } = this.fight(setup, catching);
    const result = finishBattle(this.content, state, { badges: this.party.badges.length });
    const won = result.outcome === 'win';
    const prize = won ? wildPrize(level) : 0;
    this.wild.battles++;
    this.wild.turns += turns;
    this.sinceGoal.battles++;
    this.sinceGoal.turns += turns;
    if (result.outcome === 'lose') {
      this.wild.losses++;
      this.sinceGoal.losses++;
    }
    this.wild.money += prize;
    this.after(result, { opponents: [species], prize });
    return result.outcome === 'caught';
  }

  private after(result: BattleResult, apply: ApplyOptions): void {
    this.party = applyBattleResult(this.party, result, apply).party;
    this.decide(result.progress);
    // A center between battles (free); the sim heals after every battle.
    this.party = healTeam(this.content, this.party);
  }

  private fight(setup: BattleSetup, catching = false): { state: BattleState; turns: number } {
    const cx = this.content;
    let state = createBattle(cx, setup).state;
    let turns = 0;
    for (let guard = 0; state.phase !== 'ended'; guard++) {
      if (guard > 600) throw new Error('Battle did not end');
      if (state.phase === 'replace') {
        const side = needsReplacement(state, OPPONENT) ? OPPONENT : PLAYER;
        state = step(cx, state, {
          kind: 'replace',
          side,
          to: aiReplacement(cx, state, side),
        }).state;
        continue;
      }
      const player = this.choose(state, catching);
      const opponent = aiChoice(cx, state, OPPONENT, state.kind === 'wild' ? 'wild' : 'trainer');
      state = step(cx, state, { kind: 'turn', player, opponent }).state;
      turns++;
    }
    return { state, turns };
  }

  private choose(state: BattleState, catching: boolean): Choice {
    const cx = this.content;
    const legal = legalChoices(cx, state, PLAYER);
    const foe = activeOf(state, OPPONENT);
    const zorb = legal.find((c) => c.kind === 'item' && c.item === ZORB);
    if (foe.boss?.subdued && zorb) return zorb;
    const me = activeOf(state, PLAYER);
    if (!catching && me.hp < me.stats.hp * this.policy.potionBelow) {
      const slot = state.sides[PLAYER].active;
      for (const p of [...POTIONS].reverse()) {
        const c = legal.find((x) => x.kind === 'item' && x.item === p && x.target === slot);
        if (c) return c;
      }
    }
    if (catching) {
      if (zorb && foe.hp <= foe.stats.hp * 0.5) return zorb;
      // Weakest hit, to wear it down without knocking it out.
      const moves = legal.filter(
        (c): c is Extract<Choice, { kind: 'move' }> =>
          c.kind === 'move' && cx.moves.require(me.moves[c.slot] ?? '').power > 0,
      );
      const weakest = moves.sort(
        (a, b) =>
          cx.moves.require(me.moves[a.slot] ?? '').power -
          cx.moves.require(me.moves[b.slot] ?? '').power,
      )[0];
      if (weakest) return weakest;
    }
    return aiChoice(cx, state, PLAYER, 'trainer');
  }

  // ------------------------------------------------------------------ goals

  private plan(goal: Goal): StoryBattle {
    const seed = this.battleSeed++;
    if ('trainer' in goal) return trainerBattle(this.content, this.party, goal.trainer, seed);
    const plan = bossBattle(this.content, this.party, goal.boss, seed);
    if (!plan) throw new Error(`Boss "${goal.boss}" already done`);
    return plan;
  }

  /**
   * Follows a boss's hint: catches the highest-level wild Zorling in reach whose type sets up
   * or sets off an Armor-breaking reaction, and swaps it in for the team member whose own
   * type fares worst against the boss (it is swapped back after the fight). Undefined if no
   * such Zorling lives in reach.
   */
  private adaptTo(bossId: string): Adapted | undefined {
    const cx = this.content;
    const boss = cx.bosses.require(bossId);
    const bossTypes = cx.species.require(boss.species).types;
    // The types the reaction needs (the hitting type, and the type that sets up its condition)
    // that no team member has; all of them if the team has every one.
    const teamTypes = new Set(
      this.party.team.flatMap((z) => cx.species.require(z.species).types as string[]),
    );
    const wanted: string[] = [];
    for (const r of boss.armor?.breaks ?? []) {
      const reaction = cx.reactions.require(r);
      wanted.push(reaction.type);
      for (const t of cx.types.values()) if (t.applies === reaction.condition) wanted.push(t.id);
    }
    const lacking = wanted.filter((t) => !teamTypes.has(t));
    const need = new Set(lacking.length ? lacking : wanted);
    const onTeam = new Set(this.party.team.map((z) => z.species));
    let best: { zone: Zone; species: string; level: number } | undefined;
    for (const zone of this.zones) {
      for (const s of zone.spawns) {
        const types = cx.species.require(s.species).types;
        if (onTeam.has(s.species) || !types.some((t) => need.has(t))) continue;
        const level = (s.levels ?? zone.levels)[1];
        if (!best || level > best.level) best = { zone, species: s.species, level };
      }
    }
    if (!best) return undefined;
    const before = this.party.storage.length;
    for (let tries = 0; tries < 60 && this.party.storage.length === before; tries++) {
      this.restock(ZORB, 5);
      const spawn = this.spawnOf(best.zone, best.species);
      this.wildBattle(spawn.species, spawn.level, true);
    }
    const caught = this.party.storage[before];
    if (!caught) return undefined;
    // The member whose own types take the boss's hits worst (both of its types' moves).
    const hurt = (species: string): number =>
      Math.max(...bossTypes.map((t) => cx.effectiveness(t, cx.species.require(species).types)));
    let out = 0;
    this.party.team.forEach((z, i) => {
      if (hurt(z.species) > hurt(this.party.team[out]?.species ?? z.species)) out = i;
    });
    const old = this.party.team[out];
    if (!old) return undefined;
    this.swap(caught.uid, old.uid);
    return { species: caught.species, uid: caught.uid, benched: old.uid };
  }

  /** Puts the stored Zorling `into` the team in the place of team member `outOf`. */
  private swap(into: string, outOf: string): void {
    const team = [...this.party.team];
    const storage = [...this.party.storage];
    const t = team.findIndex((z) => z.uid === outOf);
    const s = storage.findIndex((z) => z.uid === into);
    const [a, b] = [team[t], storage[s]];
    if (!a || !b) throw new Error('Nothing to swap');
    team[t] = b;
    storage[s] = a;
    this.party = { ...this.party, team, storage };
  }

  private fightGoal(stage: string, goal: Goal): GoalLog {
    const id = 'trainer' in goal ? goal.trainer : goal.boss;
    const first = this.plan(goal).setup;
    const foeLevel = Math.max(...first.opponent.map((z) => z.level));
    // A wild boss, or a trainer with a boss-form member (the region boss).
    const boss = first.boss?.id;
    while (this.meanLevel() < foeLevel - this.policy.readyMargin) this.grind();
    let attempts = 0;
    let won = false;
    let bought = 0;
    let used = 0;
    let spent = 0;
    let prize = 0;
    let goalTurns = 0;
    let adapted: Adapted | undefined;
    while (!won && attempts < this.policy.maxAttempts) {
      if (boss && !adapted && attempts > 0 && attempts === this.policy.adaptAfter) {
        adapted = this.adaptTo(boss);
      }
      attempts++;
      const moneyBefore = this.party.money;
      bought += this.buyPotions();
      this.restock(ZORB, 2);
      spent += moneyBefore - this.party.money;
      if (attempts === 1 && this.setup.snapshots?.includes(id)) this.snapshots[id] = this.party;
      const potionsBefore = this.potionCount();
      const plan = this.plan(goal);
      const { state, turns } = this.fight({ ...plan.setup, player: this.party.team });
      goalTurns += turns;
      const result = finishBattle(this.content, state, { badges: this.party.badges.length });
      won = result.outcome === 'win' || result.outcome === 'caught';
      if (won) prize = plan.prize;
      this.after(result, plan.apply);
      used += potionsBefore - this.potionCount();
      if (!won) for (let i = 0; i < this.policy.retryGrind; i++) this.grind();
    }
    // The regular team again (the benched member missed the XP of these fights).
    if (adapted) this.swap(adapted.benched, adapted.uid);
    if (won && 'trainer' in goal && goal.badge) {
      this.party = { ...this.party, badges: addBadge(this.party.badges, goal.badge) };
    }
    this.prizeMoney += prize;
    const turns = this.sinceGoal.turns + goalTurns;
    const battles = this.sinceGoal.battles + attempts;
    const log: GoalLog = {
      id,
      stage,
      boss: 'boss' in goal,
      foeLevel,
      teamLevels: this.party.team.map((z) => z.level),
      attempts,
      won,
      wildBattles: this.sinceGoal.battles,
      wildLosses: this.sinceGoal.losses,
      potionsBought: bought,
      potionsUsed: used,
      moneySpent: spent,
      ...(adapted ? { adapted: adapted.species } : {}),
      money: this.party.money,
      prize,
      minutes: (turns * SECONDS_PER_TURN + battles * SECONDS_PER_BATTLE) / 60,
    };
    this.sinceGoal = { battles: 0, turns: 0, losses: 0 };
    return log;
  }
}
