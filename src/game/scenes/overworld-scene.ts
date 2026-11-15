/**
 * Overworld (C20, C21): the player walks a region map on the tile grid among NPCs and
 * roaming wild Zorlings.
 *
 * - Keyboard: W A S D / arrows walk (tap to turn), `E` talks to the NPC in front (or touches
 *   the wild Zorling there). `Esc` opens the pause menu; `P I B M J` open the party, bag,
 *   Dex, map and quests directly (C22, see `overworld-menus.ts`).
 * - NPCs talk in lines or run a pack dialogue (C26): pages, choices (a menu over the last
 *   page; `Q` picks the last choice), actions and quest steps. Quests move on after every
 *   dialogue, battle and menu, with a note and a chime.
 * - NPCs with a role open the Zorling center or their shop after talking (C22). Losing a
 *   battle wakes the player up at the last center used (the map's first one until then).
 * - Story battles (C27): a dialogue node can start a trainer or boss battle. A win (or a
 *   catch) goes on with the dialogue; losing ends it. NPCs with `when` come and go as the
 *   story moves on (checked whenever nothing is open), and `zorling` NPCs are drawn as a
 *   Zorling (a legendary at its shrine). Badges held set the battles' soft level cap.
 * - Wild Zorlings in view are logged in the Dex as seen; a win pays a little money.
 * - Saves (C23): starts at a saved place, keeps play time, and autosaves through `save` after
 *   battles, when menus and dialogs close with something changed, every `AUTOSAVE_EVERY`
 *   seconds of walking, and on quitting. The pause menu has a manual "Save".
 * - Mouse (optional): click a tile to walk there along an A* path. Clicking an NPC or a wild
 *   Zorling walks next to it, faces it and talks / battles. Any direction key cancels the path.
 * - Walking into a roaming Zorling (or one catching the player) starts a wild battle with the
 *   battle transition; the world resumes after it, with the result written to the party.
 * - Terrain streams in 8×8-tile blocks; props in front hide everyone (walk behind trees),
 *   tall grass covers feet, and actors are drawn back to front. The camera eases after the
 *   player.
 * - Trainers who spot you (C36d): a route trainer not beaten yet that sees the player standing
 *   in its line shows "!", walks up and talks (its dialogue starts the battle). The player
 *   waits meanwhile. Each trainer spots once per visit, and walks back to its spot after.
 */

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { darken, lighten } from '@engine/core/color';
import { coverage } from '@engine/world/autotile';
import type { InputManager } from '@engine/input';
import type { Engine } from '@engine/render/engine';
import { blendPacked, packColor, PixelBuffer } from '@engine/render/pixel-buffer';
import type { Scene } from '@engine/scenes/scene-manager';
import { DialogBox, FocusStack, Menu, UiMotion, type UiInput, type UiTheme } from '@engine/ui';
import type { BattleResult, BattleSetup } from '@game/battle/logic';
import { BattleScene } from '@game/battle/scene/battle-scene';
import { battleTransition } from '@game/battle/scene/transition';
import { fieldAudio, playJingle, playSfx } from '@game/audio';
import type { GameContent } from '@game/data';
import { MOVE_DIRECTIONS, type Action } from '@game/input/actions';
import {
  applyBattleResult,
  healTeam,
  markSeen,
  offersFrom,
  type Offer,
  teamDown,
  wildPrize,
  type Party,
} from '@game/player';
import { createZorling, displayName } from '@game/progression';
import { gameSettings, textCharsPerSecond } from '@game/settings';
import type { GameState, Place } from '@game/save';
import {
  advanceQuests,
  BADGE_NOTE,
  DialogueRun,
  holds,
  QUEST_NOTE,
  storyBattle,
  type DialogueView,
  type StoryBattle,
} from '@game/story';
import type { DialogueBattle } from '@game/data';
import { paper, surface } from '@game/style/tokens';
import { ITEM_SPRITES } from '@game/ui/icons';
import { MoneyLabel } from '@game/ui/panels';
import { arrivalToast, discoveryToast, splitNotes, ToastQueue } from '@game/ui/toast';
import { drawPaper } from '@game/ui/skin';
import { uiText } from '@game/ui/text';
import { BIOMES, TILE } from '@game/world/biomes';
import { nextPhaseStart, type DayPhase } from '@game/world/lighting';
import { connectionAt, linkedArrival, loadRegion, type WorldMap } from '@game/world/map';
import {
  exploredData,
  exploredMap,
  visit,
  type ExploredData,
  type ExploredMap,
} from '@game/world/explore';
import type { NpcActor, Roamer } from '@game/world/overworld/actors';
import { Atmosphere } from '@game/world/overworld/atmosphere';
import { Camera } from '@game/world/overworld/camera';
import { WorldFx } from '@game/world/overworld/fx';
import {
  buildCharacterSheet,
  CHARACTER_H,
  CHARACTER_W,
  PLAYER_OUTFIT,
  walkFrame,
  type CharacterFrame,
  type CharacterSheet,
} from '@game/world/overworld/character-sprite';
import {
  dirBetween,
  type Dir,
  type GridMover,
  type Intent,
  type Tile,
} from '@game/world/overworld/mover';
import { outfitOf } from '@game/world/overworld/outfits';
import { pathToward } from '@game/world/overworld/path';
import { OverworldSim, type Occupant, type Spot } from '@game/world/overworld/sim';
import { trainerSight } from '@game/world/sight';
import { TerrainStream } from '@game/world/overworld/stream';
import { battleLook, speciesLook } from '@game/zorlings/species-look';
import { pixelTexture } from '@engine/render/pixel-texture';
import type { IntroSpec } from '@game/ui/intro-splash';
import { renderZorling, SPRITE_SIZE } from '@game/zorlings/render';
import { OverworldMenus } from './overworld-menus';

export interface OverworldOptions {
  readonly engine: Engine;
  readonly content: GameContent;
  readonly input: InputManager<Action>;
  readonly ui: UiInput;
  readonly theme: UiTheme;
  readonly mapId: string;
  /** The player's Zorlings, bag and money when entering. */
  readonly party: Party;
  /** Called whenever the party changes (battles, menus, center, shop). */
  onParty?(party: Party): void;
  /** Seed of the wild spawns and NPC behavior. Default: the map seed. */
  readonly seed?: number;
  /** Saved place to start at (used when it is on this map and walkable). */
  readonly start?: Place;
  /** Saved center to wake up at after losing (used when it is on this map). */
  readonly respawn?: Place;
  /** Seconds played before this visit. */
  readonly playtime?: number;
  /** Exploration of every map so far (C36b); this map's grows as the player walks. */
  readonly explored?: Readonly<Record<string, ExploredData>>;
  /** Entered by travel from another region (C36d): shows the region's arrival toast. */
  readonly arrived?: boolean;
  /** Writes the game state (autosave and the pause menu's "Save"). No saving when unset. */
  save?(state: GameState): Promise<void>;
  /**
   * The player stepped onto a connection linked to another map (C34). `state` is the game
   * as of now, with the player at the other end; the host opens that map. No travel when unset.
   */
  onTravel?(state: GameState): void;
  onExit(): void;
}

const HUD_H = 26;
/** World px from the top of a tile to an entity's base line (matches prop bases). */
const BASE = TILE - 2;
/** Beat between touching a wild Zorling ("!") and the battle transition. */
const ENCOUNTER_BEAT = 0.4;
/** A trainer that spotted the player (C36d): "!" seconds, walking speed, give-up seconds. */
const SPOT = { alert: 0.7, speed: 3.2, stuck: 1.5 } as const;
/** Seconds a wild Zorling the player ran from leaves the player alone. */
const RAN_COOLDOWN = 4;
const SHADOW = 0x1e3a14;
/** Seconds of play between autosaves while something changed. */
const AUTOSAVE_EVERY = 30;
/** Seconds the HUD shows "Saved". */
const SAVED_NOTE = 1.5;
const HELP = 'WASD move · E talk · click to walk · Esc menu';

/** A packed sprite plus where its figure starts (for the "!" bubble). */
interface Packed extends CharacterFrame {
  readonly top: number;
  readonly left: number;
  readonly right: number;
}

interface WildSprite {
  readonly right: Packed;
  readonly left: Packed;
}

interface Drawable {
  readonly y: number;
  draw(camX: number, camY: number): void;
}

export class OverworldScene implements Scene<Container> {
  readonly id = 'overworld';
  readonly view = new Container({ label: 'world:overworld' });
  readonly ui = new Container({ label: 'ui:overworld' });
  readonly map: WorldMap;
  readonly sim: OverworldSim;
  private readonly stream: TerrainStream;
  private readonly atmosphere: Atmosphere;
  private readonly fx: WorldFx;
  /** Last tile of each wild Zorling (grass rustle when it steps into tall grass). */
  private readonly roamerTiles = new Map<Roamer, number>();
  /** Camera nudge after bumping into something: direction and time left. */
  private nudge = { x: 0, y: 0, t: 0 };
  private readonly camera = new Camera();
  private readonly sheet: CharacterSheet;
  private readonly npcSheets = new Map<NpcActor, CharacterSheet>();
  /** Which way a Zorling NPC's sprite faces (it keeps its side when facing up or down). */
  private readonly npcSides = new Map<NpcActor, 'left' | 'right'>();
  private itemFrame: CharacterFrame | undefined;
  private readonly wildSprites = new Map<string, WildSprite>();
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly texture: Texture;
  private buf = new PixelBuffer(1, 1);
  private image: ImageData;
  private readonly panel = new Graphics();
  private readonly place = uiText('name', '', paper.title);
  private readonly help = uiText('label', '', paper.inkDim);
  private readonly money = new MoneyLabel();
  private readonly layer = new Container({ label: 'dialogs' });
  private readonly stack: FocusStack<Container>;
  private readonly motion: UiMotion;
  private readonly toasts = new ToastQueue();
  private current: Party;
  readonly menus: OverworldMenus;
  /** Where the player wakes up after losing: in front of the last center used. */
  private respawn: { x: number; y: number; facing: Dir };
  private path: Tile[] | undefined;
  private target: Tile | undefined;
  private faceAfter: Dir | undefined;
  /** Talk to / touch what the player faces once the click path ends. */
  private interactAfter = false;
  private encounter: { roamer: Roamer; t: number } | undefined;
  /** A trainer walking up to the player (C36d); `t` is the "!" time left. */
  private spot: (Spot & { t: number; stuck: number }) | undefined;
  /** Trainers that spotted the player on this visit: they don't spot again. */
  private readonly spotted = new Set<NpcActor>();
  private sightCache: { log: Party['trainers']; sight: Map<NpcActor, number> } | undefined;
  private context = '';
  /** The NPC whose center or shop is open. */
  private talkingTo: NpcActor | undefined;
  /** The NPC whose dialogue is running (its sprite is a trainer's intro portrait). */
  private dialogueNpc: NpcActor | undefined;
  /** A pack dialogue is running: the stack empties between its boxes, which is no "close". */
  private inDialogue = false;
  /** Choices shown over the dialog box. */
  private choiceMenu: Menu | undefined;
  private heldBox: DialogBox | undefined;
  private inBattle = false;
  /** Travelling to another map: the scene stops (C34). */
  private leaving = false;
  private afterBattle: string[] = [];
  /** The dialogue waiting on a story battle, and whether that battle was won. */
  private battleRun: { run: DialogueRun; step: () => void; won: boolean } | undefined;
  /** NPC `when` conditions may have changed (checked when nothing is open). */
  private presenceDirty = true;
  /** Move and evolution offers the last battle left (asked on return). */
  private offers: Offer[] = [];
  private time = 0;
  private width = 480;
  private height = 270;
  private lastZone: string | undefined = '-';
  private playtime: number;
  /** What the last save wrote (party object and place), to skip saves that change nothing. */
  private saved: { party: Party; key: string } | undefined;
  private autosaveTimer = AUTOSAVE_EVERY;
  private savedNote = 0;
  private saveFailed = false;
  /** This map's revealed cells and discovered places (C36b). */
  private readonly explored: ExploredMap;
  /** The tile last revealed around. */
  private visited = '';

  constructor(private readonly options: OverworldOptions) {
    this.map = loadRegion(options.content, options.mapId);
    this.current = options.party;
    this.playtime = options.playtime ?? 0;
    const start = this.onMap(options.start, true);
    this.sim = new OverworldSim({
      content: options.content,
      mapId: options.mapId,
      map: this.map,
      seed: options.seed ?? this.map.seed,
      ...(start ? { start, facing: start.facing } : {}),
    });
    this.explored = exploredMap(this.map, options.explored?.[options.mapId]);
    this.stream = new TerrainStream(this.map, BIOMES[this.map.biome]);
    this.atmosphere = new Atmosphere(this.map, BIOMES[this.map.biome], this.map.seed);
    this.atmosphere.update(0, this.player.x, this.player.y, true);
    this.fx = new WorldFx(this.map.seed + 7);
    this.sheet = buildCharacterSheet(PLAYER_OUTFIT);
    for (const npc of this.sim.allNpcs) {
      if (!npc.npc.zorling && !npc.npc.object) {
        this.npcSheets.set(npc, buildCharacterSheet(outfitOf(npc.npc.look)));
      }
    }
    this.syncPresence();
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas not available');
    this.ctx = ctx;
    this.image = ctx.createImageData(1, 1);
    this.texture = Texture.from(this.canvas);
    this.texture.source.scaleMode = 'nearest';
    this.view.addChild(new Sprite(this.texture));
    this.ui.addChild(this.panel, this.place, this.help, this.money, this.layer, this.toasts.view);
    this.motion = new UiMotion(this.layer);
    this.stack = new FocusStack<Container>(this.motion, options.ui);
    this.stack.onEmpty = () => {
      if (this.inDialogue) return;
      // Something a menu changed may finish a quest step: tell it before saving.
      if (this.checkQuests()) return;
      if (this.talkingTo) this.talkingTo.talking = false;
      this.talkingTo = undefined;
      this.setContext();
      this.autosave();
    };
    this.help.text = HELP;
    this.respawn = this.onMap(options.respawn, false) ?? this.firstRespawn();
    this.menus = new OverworldMenus(this.menuHost());
    if (options.arrived)
      this.toasts.push(arrivalToast(this.map.name, !options.explored?.[options.mapId]));
    this.explore();
    this.saved = { party: this.current, key: this.placeKey() };
  }

  /** Reveals around the player's tile (once per tile) and toasts places found (C36b). */
  private explore(): void {
    const { tx, ty } = this.player;
    const key = `${tx},${ty}`;
    if (key === this.visited) return;
    this.visited = key;
    for (const p of visit(this.map, this.explored, tx, ty)) this.toasts.push(discoveryToast(p));
  }

  /** Every map's exploration as of now (this map's live one included). */
  exploration(): Record<string, ExploredData> {
    return {
      ...this.options.explored,
      [this.options.mapId]: exploredData(this.map, this.explored),
    };
  }

  /** A saved place if it is on this map (and, for `walkable`, inside and not blocked). */
  private onMap(p: Place | undefined, walkable: boolean): Place | undefined {
    if (!p || p.map !== this.options.mapId) return undefined;
    if (walkable && (!this.map.inside(p.x, p.y) || this.map.blocked(p.x, p.y))) return undefined;
    return p;
  }

  /** Everything a save keeps, as of now. */
  snapshot(): GameState {
    const at = this.player.destination;
    const map = this.options.mapId;
    return {
      party: this.party,
      place: { map, x: at.x, y: at.y, facing: this.player.facing },
      respawn: { map, ...this.respawn },
      playtime: this.playtime,
      explored: this.exploration(),
    };
  }

  private placeKey(): string {
    const at = this.player.destination;
    const r = this.respawn;
    return `${at.x},${at.y},${this.player.facing}|${r.x},${r.y},${r.facing}`;
  }

  /** Whether the party or the place changed since the last save. */
  private get dirty(): boolean {
    return this.saved?.party !== this.party || this.saved.key !== this.placeKey();
  }

  /**
   * Saves now (`manual`) or only when something changed (`auto`). Resolves to an error
   * message when the write failed.
   */
  async saveNow(mode: 'auto' | 'manual' = 'auto'): Promise<string | undefined> {
    const { save } = this.options;
    // After travel the next map's scene saves; this one's place is stale.
    if (!save || this.leaving || (mode === 'auto' && !this.dirty)) return undefined;
    const state = this.snapshot();
    const key = this.placeKey();
    this.autosaveTimer = AUTOSAVE_EVERY;
    try {
      await save(state);
      this.saved = { party: state.party, key };
      this.savedNote = SAVED_NOTE;
      this.lastZone = '-';
      return undefined;
    } catch (e) {
      console.warn('Save failed', e);
      return e instanceof Error ? e.message : String(e);
    }
  }

  /** Autosave; a failure is told once per visit, not on every try. */
  private autosave(): void {
    void this.saveNow('auto').then((error) => {
      if (!error || this.saveFailed) return;
      this.saveFailed = true;
      this.say([`Autosave failed: ${error}`, 'Try "Save" in the menu (Esc).']);
    });
  }

  /** The current party. Setting it reports the change (`onParty`). */
  get party(): Party {
    return this.current;
  }

  set party(p: Party) {
    if (p === this.current) return;
    this.current = p;
    this.lastZone = '-';
    this.presenceDirty = true;
    this.options.onParty?.(p);
  }

  private menuHost(): ConstructorParameters<typeof OverworldMenus>[0] {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const scene = this;
    return {
      content: this.options.content,
      theme: this.options.theme,
      stack: this.stack,
      map: this.map,
      get party() {
        return scene.party;
      },
      set party(p: Party) {
        scene.party = p;
      },
      mapId: this.options.mapId,
      explored: (id: string) =>
        id === this.options.mapId
          ? this.explored
          : exploredMap(loadRegion(this.options.content, id), this.options.explored?.[id]),
      pressed: (a: 'inspect' | 'zoom') => this.options.input.pressed(a),
      size: () => ({ width: this.width, height: this.height }),
      where: () => {
        const z = this.map.zoneAt(this.player.tx, this.player.ty);
        const place = z ? `${z.name} · Lv ${z.levels[0]}–${z.levels[1]}` : 'Town';
        return { x: this.player.tx, y: this.player.ty, place };
      },
      services: () =>
        this.sim.npcs.flatMap((n) =>
          n.npc.role ? [{ x: n.mover.tx, y: n.mover.ty, role: n.npc.role.kind }] : [],
        ),
      say: (pages, speaker, done) => this.say(pages, speaker, done),
      ...(this.options.save
        ? {
            save: (done: (error?: string) => void) =>
              void this.saveNow('manual').then((error) => done(error)),
          }
        : {}),
      centerUsed: () => {
        const npc = this.talkingTo;
        if (npc) this.respawn = inFront(npc.mover.destination, npc.mover.facing);
      },
      quit: () => {
        void this.saveNow('auto').finally(() => this.options.onExit());
      },
      bindings: this.options.input.bindings,
      capture: () => this.options.input.anyPressed(),
    };
  }

  /** In front of the map's first center NPC, else the spawn point. */
  private firstRespawn(): { x: number; y: number; facing: Dir } {
    const center = this.sim.npcs.find((n) => n.npc.role?.kind === 'center');
    if (center) return inFront(center.mover.destination, center.mover.facing);
    const spot = this.map.anchors['spawn'] ?? { x: this.player.tx, y: this.player.ty };
    return { x: spot.x, y: spot.y, facing: 'down' };
  }

  get player(): GridMover {
    return this.sim.player;
  }

  enter(): void {
    this.setContext();
    fieldAudio(this.map.biome);
  }

  pause(): void {
    this.view.visible = false;
    this.ui.visible = false;
  }

  resume(): void {
    this.view.visible = true;
    this.ui.visible = true;
    this.inBattle = false;
    this.setContext();
    fieldAudio(this.map.biome);
    const quests = advanceQuests(this.options.content, this.party);
    this.party = quests.party;
    const split = splitNotes(quests.notes);
    this.toasts.push(...split.toasts);
    const pages = [...this.afterBattle, ...split.pages];
    if (quests.notes.length) questSound(quests.notes);
    this.afterBattle = [];
    // Messages first, then the rest of a story battle's dialogue, then the level-up choices.
    const story = this.battleRun;
    this.battleRun = undefined;
    const then = (): void => {
      if (!story) {
        this.levelUpChoices();
        return;
      }
      story.run.battleOver(this.party, story.won);
      story.step();
    };
    if (pages.length) this.say(pages, undefined, then);
    else then();
    this.autosave();
  }

  /** The move and evolution offers the last battle left (C22b). */
  private levelUpChoices(): void {
    const offers = this.offers;
    this.offers = [];
    if (!offers.length) return;
    this.menus.levelUp.run(offers);
    this.setContext();
  }

  /** Shows the NPCs whose `when` holds (C27). */
  private syncPresence(): void {
    this.presenceDirty = false;
    const { content } = this.options;
    const before = [...this.sim.npcs];
    this.sim.present((n) => !n.when || holds(content, this.party, n.when));
    for (const npc of before) {
      if (this.sim.npcs.includes(npc) || !this.onScreen(npc.mover)) continue;
      const x = npc.mover.x * TILE + TILE / 2;
      const y = npc.mover.y * TILE + TILE - 4;
      if (npc.npc.object === 'item') {
        this.fx.sparkle(x, y - 4);
        playSfx('world.pickup');
      } else if (npc.npc.zorling) this.fx.puff(x, y - 8);
    }
  }

  /** Debug (dev console): moves the play clock on to the next `phase` of the day. */
  skipTo(phase: DayPhase): void {
    this.playtime = nextPhaseStart(this.playtime, phase);
  }

  exit(): void {
    this.menus.dispose();
    this.view.destroy({ children: true });
    this.ui.destroy({ children: true });
    this.texture.destroy(true);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.buf = new PixelBuffer(width, height);
    this.canvas.width = width;
    this.canvas.height = height;
    this.image = new ImageData(this.buf.bytes, width, height);
    this.texture.source.resize(width, height);
    this.atmosphere.resize(width, height);
    this.toasts.layout(width, HUD_H + 4);
    const [cx, cy] = this.focus();
    this.camera.snap(cx, cy, width, height, this.bounds);
    this.lastZone = '-';
    this.layoutHud();
    this.layoutDialog();
    this.menus.layout();
  }

  /**
   * Input context for what is on top: the world, a dialog or a menu. Held keys are
   * suppressed only when it changes (or `force`), so menu auto-repeat and "hold E" work.
   */
  private setContext(force = true): void {
    // Dialogs and menus take the HUD's place.
    const open = this.stack.size > 0;
    this.panel.visible = this.place.visible = this.help.visible = this.money.visible = !open;
    const context = !open ? 'overworld' : this.stack.top instanceof DialogBox ? 'dialog' : 'menu';
    if (!force && context === this.context) return;
    this.context = context;
    this.options.input.setContexts([context]);
    this.options.input.suppressHeld();
  }

  private get bounds(): { width: number; height: number } {
    return { width: this.map.width * TILE, height: this.map.height * TILE };
  }

  /** World point the camera centers on: the middle of the player's body. */
  private focus(): [number, number] {
    return [this.player.x * TILE + TILE / 2, this.player.y * TILE + TILE / 2 - 4];
  }

  update(dt: number): void {
    const { input } = this.options;
    this.time += dt;
    this.playtime += dt;
    this.motion.update(dt);
    // Toasts wait while a menu is open (they would cover it).
    this.toasts.view.visible = !this.stack.size;
    if (!this.inBattle && !this.stack.size) this.toasts.update(dt);
    if (!this.inBattle) {
      this.atmosphere.update(dt, this.player.x, this.player.y);
      this.fx.update(dt);
      if (this.nudge.t > 0) this.nudge.t -= dt;
    }
    if (this.savedNote > 0 && (this.savedNote -= dt) <= 0) this.lastZone = '-';
    if (this.inBattle || this.leaving) return;
    if (this.stack.size) {
      this.stack.update(dt);
      // A dialog over a menu (or a menu after a dialog) changes the input context.
      if (this.stack.size) this.setContext(false);
      return;
    }
    if (this.encounter) {
      this.encounter.t -= dt;
      if (this.encounter.t <= 0) this.startBattle(this.encounter.roamer);
      return;
    }
    if (this.spot) {
      this.updateSpot(dt);
      return;
    }
    if (this.presenceDirty && !this.inDialogue) this.syncPresence();
    if (this.openMenuKey()) return;
    const key = input.direction(MOVE_DIRECTIONS);
    if (key) this.clearPath();
    else if (input.rawPressed('Mouse0') && input.pointer.inside) this.clickTo(input.pointer);
    if (input.pressed('confirm') || this.interactAfter) {
      this.interactAfter = false;
      if (this.interact(this.sim.facing())) return;
    }

    const intent = (at: Tile): Intent | undefined => {
      // Standing on a tile (or arriving on one) in a trainer's line stops the player.
      if (!this.spot) this.startSpot(this.sim.spotter(at, this.sight));
      if (this.spot) return undefined;
      return key ? { dir: key } : this.followPath(at);
    };
    for (const e of this.sim.update(dt, intent, this.viewTiles())) {
      if (e.kind === 'encounter') this.touch(e.roamer);
      else if (e.kind === 'player' && e.event.kind === 'bump') {
        playSfx('world.bump', { key: 'bump', throttle: 0.25 });
        this.bumpNudge(e.event.dir);
      } else if (e.kind === 'player' && e.event.kind === 'step')
        this.stepFx(e.event.from, e.event.to);
      else if (e.kind === 'player' && e.event.kind === 'arrive' && this.travel(e.event.at)) return;
    }
    this.explore();
    this.roamerFx();
    this.logSeen();
    if ((this.autosaveTimer -= dt) <= 0) this.autosave();

    const [cx, cy] = this.focus();
    this.camera.follow(cx, cy, this.width, this.height, this.bounds, dt);
    this.stream.prefetch(this.viewRect());
    this.layoutHud();
  }

  /**
   * Arriving on a connection linked to another map: saves with the player at the other end
   * and lets the host open that map (C34). True when the player leaves.
   */
  private travel(at: Tile): boolean {
    const { content, mapId, onTravel } = this.options;
    if (!onTravel) return false;
    const key = connectionAt(content, mapId, at.x, at.y);
    const to = key ? linkedArrival(content, mapId, key) : undefined;
    if (!to) return false;
    this.leaving = true;
    this.clearPath();
    const state: GameState = {
      ...this.snapshot(),
      place: { map: to.map, x: to.x, y: to.y, facing: to.facing },
    };
    this.saved = undefined;
    void this.options.save?.(state).catch((e: unknown) => console.warn('Travel save failed:', e));
    onTravel(state);
    return true;
  }

  /** `Esc` and the menu keys (`P I B M J`). */
  private openMenuKey(): boolean {
    const { input } = this.options;
    const keys = [
      ['pause', () => this.menus.openPause()],
      ['party', () => this.menus.openParty()],
      ['inventory', () => this.menus.openBag()],
      ['dex', () => this.menus.openDex()],
      ['map', () => this.menus.openMap()],
      ['quests', () => this.menus.openQuests()],
    ] as const;
    for (const [action, open] of keys) {
      if (!input.pressed(action)) continue;
      this.clearPath();
      open();
      this.setContext();
      return true;
    }
    return false;
  }

  /** Wild Zorlings in view count as seen in the Dex. */
  private logSeen(): void {
    const v = this.viewTiles();
    const species: string[] = [];
    for (const r of this.sim.roamers) {
      const { tx, ty } = r.mover;
      if (tx < v.x || ty < v.y || tx >= v.x + v.width || ty >= v.y + v.height) continue;
      if (!this.party.dex.seen.includes(r.species)) species.push(r.species);
    }
    if (!species.length) return;
    this.party = { ...this.party, dex: markSeen(this.party.dex, species) };
    this.checkQuests();
  }

  /** Moves quests on; shows the notes (returns true) when one did. */
  private checkQuests(): boolean {
    const r = advanceQuests(this.options.content, this.party);
    if (!r.notes.length) return false;
    this.party = r.party;
    questSound(r.notes);
    const { toasts, pages } = splitNotes(r.notes);
    this.toasts.push(...toasts);
    if (!pages.length) return false;
    this.say(pages);
    return true;
  }

  /** The player's middle on the game screen (iris transitions center on it). */
  playerScreen(): { x: number; y: number } {
    const v = this.viewRect();
    const [cx, cy] = this.focus();
    return { x: Math.round(cx - v.x), y: Math.round(cy - v.y) };
  }

  private onScreen(m: GridMover): boolean {
    const v = this.viewRect();
    const x = m.x * TILE;
    const y = m.y * TILE;
    return x > v.x - TILE && y > v.y - TILE && x < v.x + v.width && y < v.y + v.height;
  }

  /** Grass bits stepping into tall grass, or a dust puff leaving a path tile. */
  private stepFx(from: Tile, to: Tile): void {
    const biome = BIOMES[this.map.biome];
    if (this.map.tall(to.x, to.y)) {
      this.fx.rustle(to.x * TILE + TILE / 2, to.y * TILE + TILE - 2, biome.ramps.tall);
      playSfx('world.rustle', { key: 'rustle', throttle: 0.12 });
    } else if (coverage(this.map.path, from.x * TILE + 8, from.y * TILE + 8, TILE) >= 0.5) {
      const color = biome.ramps.path[3] ?? 0xecd2a4;
      this.fx.dust(from.x * TILE + TILE / 2, from.y * TILE + TILE - 2, to.x - from.x, color);
    }
  }

  /** Wild Zorlings in view rustle the grass they step into. */
  private roamerFx(): void {
    const tall = BIOMES[this.map.biome].ramps.tall;
    for (const r of this.sim.roamers) {
      const m = r.mover;
      const tile = m.destination.y * this.map.width + m.destination.x;
      const last = this.roamerTiles.get(r);
      this.roamerTiles.set(r, tile);
      if (last === undefined || last === tile) continue;
      if (this.map.tall(m.destination.x, m.destination.y) && this.onScreen(m))
        this.fx.rustle(m.destination.x * TILE + TILE / 2, m.destination.y * TILE + TILE - 2, tall);
    }
    for (const r of this.roamerTiles.keys())
      if (!this.sim.roamers.includes(r)) this.roamerTiles.delete(r);
  }

  private bumpNudge(dir: Dir): void {
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    if (gameSettings().shake) this.nudge = { x: d[0] ?? 0, y: d[1] ?? 0, t: 0.07 };
  }

  private viewRect(): { x: number; y: number; width: number; height: number } {
    const n = this.nudge.t > 0 ? 1 : 0;
    return {
      x: Math.round(this.camera.x) + this.nudge.x * n,
      y: Math.round(this.camera.y) + this.nudge.y * n,
      width: this.width,
      height: this.height,
    };
  }

  private viewTiles(): { x: number; y: number; width: number; height: number } {
    const v = this.viewRect();
    const x = Math.floor(v.x / TILE);
    const y = Math.floor(v.y / TILE);
    return {
      x,
      y,
      width: Math.ceil((v.x + v.width) / TILE) - x,
      height: Math.ceil((v.y + v.height) / TILE) - y,
    };
  }

  // ------------------------------------------------------------ talking & encounters

  private interact(o: Occupant | undefined): boolean {
    if (!o) return false;
    if (o.kind === 'wild') {
      if (o.roamer.cooldown > 0) return false;
      this.touch(o.roamer);
      return true;
    }
    const npc = o.npc;
    const object = npc.npc.object !== undefined;
    npc.talking = true;
    if (!object) npc.faceToward(this.player.destination);
    this.clearPath();
    const role = npc.npc.role;
    const after = (): void => {
      // A trainer that walked up to the player goes back to its spot (C36d).
      const at = npc.mover.destination;
      if (this.spotted.has(npc) && (at.x !== npc.home.x || at.y !== npc.home.y)) {
        npc.goHome();
      }
      if (!role) {
        npc.talking = false;
        return;
      }
      // The NPC keeps facing the player while its service is open.
      this.talkingTo = npc;
      if (role.kind === 'center') this.menus.openCenter(npc.npc.name);
      else this.menus.openShop(role.title ?? 'Shop', role.stock);
      this.setContext();
    };
    const { dialogue, lines } = npc.npc;
    // Signs and items speak without a name tag.
    const name = object ? undefined : npc.npc.name;
    this.dialogueNpc = npc;
    if (dialogue)
      this.runDialogue(new DialogueRun(this.options.content, dialogue, this.party, name), after);
    else this.say(lines ?? [], name, after);
    return true;
  }

  /** Shows a pack dialogue view by view, writing its changes to the party. */
  private runDialogue(run: DialogueRun, done: () => void): void {
    this.inDialogue = true;
    const step = (): void => {
      this.party = run.party;
      const view = run.view;
      if (!view) {
        this.inDialogue = false;
        // The last box closed while `inDialogue` hid it from `onEmpty`: run that now.
        if (this.stack.size === 0) this.stack.onEmpty?.();
        done();
        this.levelUpChoices();
        return;
      }
      this.showView(view, (choice) => {
        if (view.battle) {
          this.dialogueBattle(run, view.battle, step);
          return;
        }
        run.next(choice);
        step();
      });
    };
    step();
  }

  /** The pages (with the speaker), then the notes, then the choices over the last box. */
  private showView(view: DialogueView, next: (choice?: number) => void): void {
    const { pages, choices } = view;
    if (view.notes.length) questSound(view.notes);
    const split = splitNotes(view.notes);
    this.toasts.push(...split.toasts);
    const notes = split.pages;
    const ask = choices.length ? (box?: DialogBox) => this.ask(choices, box, next) : undefined;
    const notesBox = (): void => {
      if (!notes.length) {
        if (ask) ask();
        else next();
        return;
      }
      this.say(notes, undefined, () => next(), ask);
    };
    if (!pages.length) notesBox();
    else if (notes.length || !ask) this.say(pages, view.speaker, notesBox);
    else this.say(pages, view.speaker, undefined, ask);
  }

  /** A choice menu over the held dialog box (or alone); `Q` picks the last choice. */
  private ask(
    choices: readonly string[],
    box: DialogBox | undefined,
    next: (c: number) => void,
  ): void {
    const pick = (i: number): void => {
      this.choiceMenu = undefined;
      this.heldBox = undefined;
      if (box) this.stack.remove(box);
      else if (menu) this.stack.remove(menu);
      next(i);
    };
    const menu: Menu = new Menu({
      theme: this.options.theme,
      items: choices.map((label) => ({ label })),
      onSelect: (i) => pick(i),
      onBack: () => pick(choices.length - 1),
    });
    this.choiceMenu = menu;
    this.heldBox = box;
    this.stack.push(menu);
    this.layoutDialog();
    this.setContext();
  }

  /**
   * Dialog pages; `done` runs when they close. With `hold`, the box stays on its last page
   * and `hold` gets it (the caller removes it).
   */
  private say(
    pages: readonly string[],
    speaker?: string,
    done?: () => void,
    hold?: (box: DialogBox) => void,
  ): void {
    // Text speed from the settings (C33).
    const base = this.options.theme;
    const theme = { ...base, motion: { ...base.motion, textSpeed: textCharsPerSecond() } };
    const dialog: DialogBox = new DialogBox({
      theme,
      pages,
      width: this.dialogWidth(),
      lines: 2,
      ...(speaker ? { speaker } : {}),
      onDone: (d) => {
        this.stack.remove(d);
        done?.();
      },
      ...(hold ? { onLastPage: hold } : {}),
    });
    this.stack.push(dialog);
    this.layoutDialog();
    this.setContext();
  }

  private dialogWidth(): number {
    return Math.min(320, this.width - 24);
  }

  private layoutDialog(): void {
    const menu =
      this.choiceMenu && this.stack.includes(this.choiceMenu) ? this.choiceMenu : undefined;
    const top = this.stack.top;
    const d = top instanceof DialogBox ? top : this.boxUnder(menu);
    let boxTop = this.height - 10;
    if (d) {
      d.view.position.set(Math.round((this.width - d.width) / 2), this.height - d.height - 10);
      boxTop = d.view.y;
    }
    if (menu) {
      // Right-aligned with the box, just above it.
      const right = Math.round((this.width + this.dialogWidth()) / 2);
      menu.view.position.set(right - menu.width, boxTop - menu.height - 4);
    }
  }

  /** The dialog box held under the choice menu, if any. */
  private boxUnder(menu: Menu | undefined): DialogBox | undefined {
    return menu ? this.heldBox : undefined;
  }

  /** Runs a dialogue node's battle; the dialogue goes on in `resume` once it is over. */
  private dialogueBattle(run: DialogueRun, battle: DialogueBattle, step: () => void): void {
    const plan = storyBattle(this.options.content, this.party, battle, this.sim.battleSeed());
    if (!plan) {
      run.battleOver(this.party, false);
      step();
      return;
    }
    this.battleRun = { run, step, won: false };
    const intro = this.introFor(plan, 'trainer' in battle);
    this.launch(plan.setup, plan.trainer, (result) => this.finishStoryBattle(plan, result), intro);
  }

  /** The intro splash of a story battle: the boss Zorling, or the trainer's sprite. */
  private introFor(plan: StoryBattle, trainerBattle: boolean): IntroSpec | undefined {
    const { content } = this.options;
    const bossRef = plan.setup.boss;
    if (bossRef) {
      const boss = content.bosses.require(bossRef.id);
      const look = battleLook(content, boss.species, { boss: boss.kind });
      const sprite = renderZorling(look.genome, { size: look.size, fill: look.fill });
      const kind = boss.kind === 'legendary' ? 'Legendary' : 'Titan';
      return {
        title: boss.name,
        subtitle: trainerBattle && plan.trainer ? plan.trainer : kind,
        boss: true,
        portrait: pixelTexture(sprite),
        scale: 1,
      };
    }
    if (!trainerBattle || !plan.trainer) return undefined;
    const npc = this.dialogueNpc;
    const sheet = npc ? this.npcSheets.get(npc) : undefined;
    const frame = sheet?.down[0];
    if (!frame) return undefined;
    return {
      title: plan.trainer,
      boss: false,
      portrait: pixelTexture(frameSprite(frame)),
      scale: 5,
    };
  }

  private finishStoryBattle(plan: StoryBattle, result: BattleResult): void {
    const { content } = this.options;
    const applied = applyBattleResult(this.party, result, plan.apply);
    this.party = applied.party;
    this.offers = offersFrom(result.team, result.progress);
    const won = result.outcome === 'win' || result.outcome === 'caught';
    if (this.battleRun) this.battleRun.won = won;
    if (result.caught && applied.caughtTo === 'storage') {
      this.afterBattle.push(
        `${displayName(content, result.caught)} was sent to storage. Your team is full.`,
      );
    }
    if (result.outcome === 'lose') this.wakeAtCenter();
  }

  /** How far an NPC spots the player now (C36d): 0 once it spotted on this visit. */
  private readonly sight = (npc: NpcActor): number => {
    if (this.spotted.has(npc)) return 0;
    const log = this.party.trainers;
    if (this.sightCache?.log !== log) this.sightCache = { log, sight: new Map() };
    let range = this.sightCache.sight.get(npc);
    if (range === undefined) {
      range = trainerSight(this.options.content, npc.npc, log);
      this.sightCache.sight.set(npc, range);
    }
    return range;
  };

  private startSpot(s: Spot | undefined): void {
    if (!s) return;
    this.spot = { ...s, t: SPOT.alert, stuck: 0 };
    this.spotted.add(s.npc);
    this.clearPath();
    playSfx('world.encounter');
  }

  /** "!" for a beat, then the trainer walks up and talks; a blocked walk gives up. */
  private updateSpot(dt: number): void {
    const s = this.spot;
    if (!s) return;
    if (s.t > 0) {
      if ((s.t -= dt) <= 0) s.npc.walkTo(s.stop, SPOT.speed);
      return;
    }
    // Wild encounters wait: the player stands still until the trainer arrives.
    this.sim.update(dt, () => undefined, this.viewTiles());
    this.roamerFx();
    if (s.npc.walking) {
      s.stuck = s.npc.mover.moving ? 0 : s.stuck + dt;
      if (s.stuck > SPOT.stuck) {
        s.npc.goHome();
        this.spot = undefined;
      }
      return;
    }
    this.spot = undefined;
    const d = dirBetween(this.player.destination, s.npc.mover.destination);
    if (d) this.player.facing = d;
    this.interact({ kind: 'npc', npc: s.npc });
  }

  /** A wild Zorling was touched: "!" over it for a beat, then the battle. */
  private touch(roamer: Roamer): void {
    this.clearPath();
    roamer.alert = ENCOUNTER_BEAT + 0.2;
    roamer.mover.facing = dirBetween(roamer.mover.destination, this.player.destination) ?? 'left';
    if (roamer.mover.facing === 'left' || roamer.mover.facing === 'right') {
      roamer.side = roamer.mover.facing;
    }
    this.encounter = { roamer, t: ENCOUNTER_BEAT };
    playSfx('world.encounter');
  }

  private startBattle(roamer: Roamer): void {
    const { content } = this.options;
    this.encounter = undefined;
    if (teamDown(this.party)) this.party = healTeam(content, this.party);
    const wild = createZorling(content, {
      uid: `wild-${roamer.id}`,
      species: roamer.species,
      level: roamer.level,
    });
    const setup: BattleSetup = {
      kind: 'wild',
      seed: this.sim.battleSeed(),
      player: this.party.team,
      opponent: [wild],
      bag: this.party.bag,
    };
    this.launch(setup, undefined, (result) => this.finishBattle(roamer, result));
  }

  /** Plays the battle transition into a battle; `end` writes the result back. */
  private launch(
    setup: BattleSetup,
    trainer: string | undefined,
    end: (result: BattleResult) => void,
    intro?: IntroSpec,
  ): void {
    const { engine, content, input, ui, theme } = this.options;
    this.clearPath();
    // A team that is down (only possible right after waking) is healed first.
    if (teamDown(this.party)) this.party = healTeam(content, this.party);
    this.inBattle = true;
    // Battle weather of the zone the player stands in (C34: ash storms → Burning).
    const weather = setup.weather ?? this.map.zoneAt(this.player.tx, this.player.ty)?.battleWeather;
    const scene = new BattleScene({
      content,
      input,
      ui,
      theme,
      setup: {
        ...setup,
        player: this.party.team,
        bag: this.party.bag,
        ...(weather?.length ? { weather } : {}),
      },
      ...(trainer ? { trainer } : {}),
      ...(intro ? { intro } : {}),
      badges: this.party.badges.length,
      speed: gameSettings().battleSpeed,
      money: this.party.money,
      confirmHotbarSwitch: gameSettings().confirmSwitch,
      biome: this.map.biome,
      onEnd: (result) => {
        end(result);
        void engine.scenes.pop({ transition: engine.iris(() => this.playerScreen()) });
      },
    });
    const transition = battleTransition(engine.layers.transitions, () => ({
      width: this.width,
      height: this.height,
    }));
    void engine.scenes.push(scene, { transition });
  }

  private finishBattle(roamer: Roamer, result: BattleResult): void {
    const { content } = this.options;
    const applied = applyBattleResult(this.party, result, {
      opponents: [roamer.species],
      prize: wildPrize(roamer.level),
    });
    this.party = applied.party;
    this.offers = offersFrom(result.team, result.progress);
    switch (result.outcome) {
      case 'win':
        this.sim.remove(roamer);
        this.fx.puff(roamer.mover.x * TILE + TILE / 2, roamer.mover.y * TILE + TILE - 8);
        break;
      case 'caught':
        this.sim.remove(roamer);
        if (result.caught && applied.caughtTo === 'storage') {
          this.afterBattle.push(
            `${displayName(content, result.caught)} was sent to storage. Your team is full.`,
          );
        }
        break;
      case 'ran':
        roamer.spook(RAN_COOLDOWN);
        break;
      case 'lose':
        this.wakeAtCenter();
        break;
    }
  }

  /** After losing: back at the last Zorling center used, team healed. */
  private wakeAtCenter(): void {
    this.party = healTeam(this.options.content, this.party);
    this.sim.clearWild();
    const spot = this.respawn;
    this.player.place({ x: spot.x, y: spot.y }, spot.facing);
    this.clearPath();
    const [cx, cy] = this.focus();
    this.camera.snap(cx, cy, this.width, this.height, this.bounds);
    this.afterBattle.push(
      'Your team fainted… You hurried back to the Zorling center, and they rested up.',
    );
  }

  // ------------------------------------------------------------ click-to-move

  private clickTo(p: { x: number; y: number }): void {
    const v = this.viewRect();
    const tile = { x: Math.floor((p.x + v.x) / TILE), y: Math.floor((p.y + v.y) / TILE) };
    if (!this.map.inside(tile.x, tile.y)) return;
    const from = this.player.destination;
    const path = pathToward(from, tile, this.sim.blocked);
    if (!path) return;
    this.path = path;
    this.target = tile;
    const end = path[path.length - 1] ?? from;
    const blocked = this.sim.blocked(tile.x, tile.y);
    this.faceAfter = blocked ? dirBetween(end, tile) : undefined;
    this.interactAfter = false;
    if (!path.length) this.finishPath();
  }

  private followPath(at: Tile): Intent | undefined {
    const path = this.path;
    if (!path) return undefined;
    while (path[0] && path[0].x === at.x && path[0].y === at.y) path.shift();
    const next = path[0];
    if (!next) {
      this.finishPath();
      return undefined;
    }
    const dir = dirBetween(at, next);
    if (!dir || this.sim.blocked(next.x, next.y)) {
      this.clearPath();
      return undefined;
    }
    return { dir, noTurnDelay: true };
  }

  private finishPath(): void {
    if (this.faceAfter) {
      this.player.facing = this.faceAfter;
      this.interactAfter = true;
    }
    this.clearPath();
  }

  private clearPath(): void {
    this.path = undefined;
    this.target = undefined;
    this.faceAfter = undefined;
  }

  // ------------------------------------------------------------ drawing

  render(): void {
    const { buf } = this;
    const v = this.viewRect();
    buf.fill(surface.background);
    const glow = this.atmosphere.begin(this.playtime, v.x, v.y);
    this.stream.draw(buf, v.x, v.y, this.time, glow);
    if (this.target) this.drawMarker(this.target, v.x, v.y);
    const list: Drawable[] = [];
    list.push(this.characterDrawable(this.player, this.sheet));
    for (const npc of this.sim.npcs) {
      const sheet = this.npcSheets.get(npc);
      const alert = this.spot?.npc === npc && this.spot.t > 0;
      if (sheet) list.push(this.characterDrawable(npc.mover, sheet, alert));
      else if (npc.npc.zorling) {
        const f = npc.mover.facing;
        if (f === 'left' || f === 'right') this.npcSides.set(npc, f);
        const side = this.npcSides.get(npc) ?? 'left';
        list.push(this.zorlingDrawable(npc.mover, npc.npc.zorling, side, 0));
      } else if (npc.npc.object === 'item') list.push(this.itemDrawable(npc.mover));
      // A `sign` object is not drawn: the map's sign or stone prop shows it.
    }
    for (const r of this.sim.roamers) {
      list.push(this.zorlingDrawable(r.mover, r.species, r.side, r.alert));
    }
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw(v.x, v.y);
    this.fx.draw(buf, v.x, v.y);
    this.atmosphere.finish(buf);
    this.ctx.putImageData(this.image, 0, 0);
    this.texture.source.update();
  }

  private characterDrawable(m: GridMover, sheet: CharacterSheet, alert = false): Drawable {
    return {
      y: m.y,
      draw: (camX, camY) => {
        const wx = Math.round(m.x * TILE);
        const wy = Math.round(m.y * TILE);
        const frames = sheet[m.facing];
        const frame = frames[walkFrame(m.walked, m.moving)] ?? (frames[0] as CharacterFrame);
        const left = wx + (TILE - CHARACTER_W) / 2;
        const top = wy + TILE - CHARACTER_H;
        this.drawShadow(wx + TILE / 2, wy + TILE - 1, 5.5, wy + BASE, camX, camY);
        this.blit(frame, left, top, wy + BASE, camX, camY);
        this.grassOver(m, left, top, CHARACTER_W, CHARACTER_H, wy + BASE, camX, camY);
        if (alert) this.drawAlert(wx + TILE / 2, top - 1, camX, camY);
      },
    };
  }

  private zorlingDrawable(
    m: GridMover,
    species: string,
    side: 'left' | 'right',
    alert: number,
  ): Drawable {
    return {
      y: m.y,
      draw: (camX, camY) => {
        const sprite = this.wildSprite(species)[side];
        const wx = Math.round(m.x * TILE);
        const wy = Math.round(m.y * TILE);
        // A little hop on every half tile walked.
        const hop = m.moving && Math.floor(m.walked * 2) % 2 === 0 ? 1 : 0;
        const left = wx + (TILE - sprite.width) / 2;
        const top = wy + TILE - sprite.height + 1 - hop;
        const baseY = wy + BASE;
        const rx = Math.max(3, Math.min(9, (sprite.right - sprite.left) / 2.4));
        this.drawShadow(wx + TILE / 2, wy + TILE - 1, rx, baseY, camX, camY);
        this.blit(sprite, left, top, baseY, camX, camY);
        this.grassOver(m, left, top, sprite.width, sprite.height, baseY, camX, camY);
        if (alert > 0) this.drawAlert(wx + TILE / 2, top + sprite.top - 2, camX, camY);
      },
    };
  }

  /** A hidden item lying on the ground (C30): a small Zorb that glints now and then. */
  private itemDrawable(m: GridMover): Drawable {
    return {
      y: m.y,
      draw: (camX, camY) => {
        this.itemFrame ??= itemFrame();
        const f = this.itemFrame;
        const wx = Math.round(m.x * TILE);
        const wy = Math.round(m.y * TILE);
        const left = wx + (TILE - f.width) / 2;
        const top = wy + TILE - f.height - 1;
        this.drawShadow(wx + TILE / 2, wy + TILE - 2, 4.5, wy + BASE, camX, camY);
        this.blit(f, left, top, wy + BASE, camX, camY);
        // A glint in the top-left of the orb for a moment every two seconds.
        if (this.time % 2 < 0.25) this.blit(GLINT, left + 1, top - 1, wy + BASE, camX, camY);
      },
    };
  }

  private wildSprite(species: string): WildSprite {
    const have = this.wildSprites.get(species);
    if (have) return have;
    const look = speciesLook(this.options.content, species);
    const right = packSprite(
      renderZorling(look.genome, { size: SPRITE_SIZE.overworld, fill: look.fill }),
    );
    const s: WildSprite = { right, left: mirror(right) };
    this.wildSprites.set(species, s);
    return s;
  }

  private blit(
    frame: CharacterFrame,
    left: number,
    top: number,
    baseY: number,
    camX: number,
    camY: number,
  ): void {
    const { data, width, height } = this.buf;
    for (let y = 0; y < frame.height; y++) {
      const Y = top + y - camY;
      if (Y < 0 || Y >= height) continue;
      for (let x = 0; x < frame.width; x++) {
        const c = frame.data[y * frame.width + x] ?? 0;
        if (!c) continue;
        const X = left + x - camX;
        if (X < 0 || X >= width) continue;
        if (this.stream.occludes(left + x, top + y, baseY)) continue;
        data[Y * width + X] = c;
      }
    }
  }

  /** Soft shadow on the ground centered at world (`cx`, `cy`). */
  private drawShadow(
    cx: number,
    cy: number,
    rx: number,
    baseY: number,
    camX: number,
    camY: number,
  ): void {
    const r = Math.ceil(rx);
    for (let y = -1; y <= 1; y++) {
      for (let x = -r; x <= r; x++) {
        if ((x / rx) ** 2 + (y / 1.6) ** 2 > 1) continue;
        const X = cx + x - camX;
        const Y = cy + y - camY;
        if (X < 0 || Y < 0 || X >= this.buf.width || Y >= this.buf.height) continue;
        if (this.stream.occludes(X + camX, Y + camY, baseY)) continue;
        const k = Y * this.buf.width + X;
        this.buf.data[k] = blendPacked(this.buf.data[k] ?? 0, SHADOW, 0.28);
      }
    }
  }

  /** Tall grass in front of the feet. */
  private grassOver(
    m: GridMover,
    left: number,
    top: number,
    w: number,
    h: number,
    baseY: number,
    camX: number,
    camY: number,
  ): void {
    const tx = Math.round(m.x);
    const ty = Math.round(m.y);
    if (!this.map.tall(tx, ty) && !this.map.tall(m.tx, m.ty)) return;
    this.stream.drawGrassOver(
      this.buf,
      camX,
      camY,
      this.time,
      { x: left, y: top, width: w, height: h },
      baseY - 6,
    );
  }

  /** A small paper speech bubble with "!" whose tip points down at world (`cx`, `bottom`). */
  private drawAlert(cx: number, bottom: number, camX: number, camY: number): void {
    const ink = paper.edge;
    const fill = paper.base;
    const mark = paper.warn;
    // 7×8 bubble + 2 px tip.
    const rows = [
      '.#####.',
      '#ooooo#',
      '#oo!oo#',
      '#oo!oo#',
      '#oo!oo#',
      '#ooooo#',
      '#oo!oo#',
      '.##o##.',
      '...#...',
    ];
    const x0 = Math.round(cx - 3 - camX);
    const y0 = Math.round(bottom - rows.length - camY);
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.') continue;
        this.buf.dot(x0 + x, y0 + y, ch === '#' ? ink : ch === '!' ? mark : fill, 1);
      }
    });
  }

  private drawMarker(t: Tile, camX: number, camY: number): void {
    const x0 = t.x * TILE - camX;
    const y0 = t.y * TILE - camY;
    const pulse = 0.55 + 0.35 * Math.sin(this.time * 8);
    for (let i = 2; i < TILE - 2; i++) {
      for (const [x, y] of [
        [x0 + i, y0 + 1],
        [x0 + i, y0 + TILE - 2],
        [x0 + 1, y0 + i],
        [x0 + TILE - 2, y0 + i],
      ] as const) {
        if ((i & 3) < 2) this.buf.dot(x, y, paper.cursor, pulse);
      }
    }
  }

  private layoutHud(): void {
    const z = this.map.zoneAt(this.player.tx, this.player.ty);
    const key = `${z?.key ?? ''}|${this.width}|${this.height}|${this.party.money}`;
    if (key === this.lastZone) return;
    this.lastZone = key;
    this.place.text = this.placeLabel();
    this.help.text = this.savedNote > 0 ? 'Game saved' : HELP;
    this.money.set(this.party.money);
    const w = Math.max(this.place.width + this.money.width + 16, this.help.width) + 16;
    const x = 6;
    const y = this.height - HUD_H - 6;
    drawPaper(this.panel.clear(), x, y, Math.round(w), HUD_H);
    this.place.position.set(x + 8, y + 2);
    this.help.position.set(x + 8, y + 14);
    this.money.position.set(Math.round(x + w - 8 - this.money.width), y + 4);
  }

  private placeLabel(): string {
    const z = this.map.zoneAt(this.player.tx, this.player.ty);
    return z ? `${z.name} · Lv ${z.levels[0]}–${z.levels[1]}` : `${this.map.name} · town`;
  }
}

/** RGBA sprite → packed pixels, with the figure's top row and horizontal extent. */
function packSprite(s: { width: number; height: number; data: Uint8ClampedArray }): Packed {
  const data = new Uint32Array(s.width * s.height);
  let top = s.height;
  let left = s.width;
  let right = 0;
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      const i = (y * s.width + x) * 4;
      if ((s.data[i + 3] ?? 0) === 0) continue;
      const rgb = ((s.data[i] ?? 0) << 16) | ((s.data[i + 1] ?? 0) << 8) | (s.data[i + 2] ?? 0);
      data[y * s.width + x] = packColor(rgb);
      top = Math.min(top, y);
      left = Math.min(left, x);
      right = Math.max(right, x + 1);
    }
  }
  return { width: s.width, height: s.height, data, top, left, right };
}

function mirror(p: Packed): Packed {
  const data = new Uint32Array(p.data.length);
  for (let y = 0; y < p.height; y++) {
    for (let x = 0; x < p.width; x++) {
      data[y * p.width + x] = p.data[y * p.width + (p.width - 1 - x)] ?? 0;
    }
  }
  return { ...p, data, left: p.width - p.right, right: p.width - p.left };
}

/** The tile in front of an NPC (where the player stands to talk), facing it. */
function inFront(at: Tile, facing: Dir): { x: number; y: number; facing: Dir } {
  const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[facing];
  const back = { up: 'down', down: 'up', left: 'right', right: 'left' } as const;
  return { x: at.x + (d[0] ?? 0), y: at.y + (d[1] ?? 0), facing: back[facing] };
}

/** A chime for quest notes: a fanfare when one completed. */
function questSound(notes: readonly string[]): void {
  if (notes.some((n) => n.startsWith(QUEST_NOTE.done) || n.startsWith(BADGE_NOTE))) {
    playJingle('world.questDone');
  } else if (
    notes.some((n) => n.startsWith(QUEST_NOTE.started) || n.startsWith(QUEST_NOTE.updated))
  ) {
    playSfx('world.quest');
  }
}

/** The bag's Zorb sprite as a world sprite (C30 hidden items), outlined in navy. */
function itemFrame(): CharacterFrame {
  const tint = 0xff5c6c;
  const colors: Record<string, number> = {
    o: 0x0e0c26,
    a: tint,
    b: lighten(tint, 0.45),
    c: darken(tint, 0.3),
    w: 0xffffff,
    g: 0xd8d0c0,
  };
  return bitmapFrame(ITEM_SPRITES.orb, colors);
}

/** A tiny 3×3 sparkle. */
const GLINT = bitmapFrame('.w./www/.w.', { w: 0xffffff });

function bitmapFrame(bitmap: string, colors: Readonly<Record<string, number>>): CharacterFrame {
  const rows = bitmap.split('/');
  const width = Math.max(...rows.map((r) => r.length));
  const data = new Uint32Array(width * rows.length);
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      const c = colors[r[x] ?? '.'];
      if (c !== undefined) data[y * width + x] = packColor(c);
    }
  });
  return { width, height: rows.length, data };
}

/** A packed character frame as an RGBA sprite (for a texture). */
function frameSprite(f: CharacterFrame): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
} {
  // Packed pixels are RGBA bytes in memory order (little-endian), as a sprite wants.
  const data = new Uint8ClampedArray(new Uint32Array(f.data).buffer);
  return { width: f.width, height: f.height, data };
}
