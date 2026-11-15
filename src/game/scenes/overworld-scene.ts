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
 * - The seamless world (C37): the scene plays the whole composed world (`worldFor`). The
 *   region under the player sets the biome, music and ambience (crossfading at a border), the
 *   battle backdrop, the HUD's place name and where exploration is written; crossing into a
 *   region shows its arrival toast. Saves keep the region map and local tile.
 * - Ferries (C37): a rowboat waits at each pier. Bumping into it, facing it with `E` or
 *   talking to a ferryman asks "Sail to <region>?"; on Yes the boat rows the route to the far
 *   pier (input locked, camera on the boat, sea ambience) and the player steps off there.
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
import {
  BlipCounter,
  fieldAudio,
  seaAudio,
  playBlip,
  playJingle,
  playSfx,
  playSpec,
  screenPan,
  speakerPitch,
  speciesCry,
} from '@game/audio';
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
import { dayClock, fireLit, NO_CAMP, restAt, restParty, type CampState } from '@game/world/rest';
import { Campfires, type Campfire } from '@game/world/overworld/campfires';
import { connectionAt, linkedArrival, loadRegion, type WorldMap } from '@game/world/map';
import {
  worldFor,
  type Ferry,
  type FerryEnd,
  type PlacedRegion,
  type World,
} from '@game/world/world-compose';
import {
  along,
  boatFrame,
  drawWake,
  heading,
  rideSeconds,
  voyage,
  type Voyage,
} from '@game/world/overworld/boat';
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
  DIR_STEP,
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
import { LAIR_PAD, lairLook } from '@game/zorlings/lair-look';
import { OverworldMenus } from './overworld-menus';
import { keyHint, keysHint } from '@game/input/key-hint';

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
  /** Day-clock offset and campfire rests so far (C40). */
  readonly camp?: CampState;
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
/** The help line, with the player's keys (C36e). */
const help = (): string =>
  `${keysHint('move_up', 'move_down', 'move_left', 'move_right')} move · ${keyHint('confirm')} talk · click to walk · ${keyHint('pause')} menu`;

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

/** A Titan or legendary in its lair (C36e): frames facing each way. */
interface LairSprite {
  readonly right: readonly Packed[];
  readonly left: readonly Packed[];
}

interface Drawable {
  readonly y: number;
  draw(camX: number, camY: number): void;
}

export class OverworldScene implements Scene<Container> {
  readonly id = 'overworld';
  readonly view = new Container({ label: 'world:overworld' });
  readonly ui = new Container({ label: 'ui:overworld' });
  /** The whole composed world (C37), and its map. */
  readonly world: World;
  readonly map: WorldMap;
  readonly sim: OverworldSim;
  /** The region the player is in (or was last in). */
  private region: PlacedRegion;
  /** A ferry ride under way (C37). */
  private ride:
    { ferry: Ferry; to: FerryEnd; voyage: Voyage; d: number; speed: number; t: number } | undefined;
  private readonly stream: TerrainStream;
  private readonly atmosphere: Atmosphere;
  private readonly campfires: Campfires;
  private camp: CampState;
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
  private readonly lairSprites = new Map<string, LairSprite>();
  /** Roaming Zorlings chasing the player (each cried once as it started). */
  private readonly chasing = new Set<Roamer>();
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
  /** Each region's revealed cells and discovered places so far (C36b), by map id. */
  private readonly explored = new Map<string, ExploredMap>();
  /** The tile last revealed around. */
  private visited = '';

  constructor(private readonly options: OverworldOptions) {
    this.world = worldFor(options.content, options.mapId);
    this.map = this.world.map;
    const home = this.world.region(options.mapId) ?? (this.world.regions[0] as PlacedRegion);
    this.region = home;
    this.current = options.party;
    this.playtime = options.playtime ?? 0;
    this.camp = options.camp ?? NO_CAMP;
    const start = this.onMap(options.start, true) ?? spawnOf(home);
    this.sim = new OverworldSim({
      content: options.content,
      mapId: options.mapId,
      map: this.map,
      seed: options.seed ?? home.map.seed,
      start,
      facing: start.facing,
      npcs: this.world.npcs(options.content),
    });
    this.region = this.world.regionAt(this.player.tx, this.player.ty) ?? home;
    this.stream = new TerrainStream(this.map, (x, y) => this.world.lookAt(x, y));
    this.atmosphere = new Atmosphere(this.map, BIOMES[home.biome], home.map.seed);
    this.campfires = new Campfires(this.world);
    this.atmosphere.update(0, this.player.x, this.player.y, true);
    this.fx = new WorldFx(home.map.seed + 7);
    this.sheet = buildCharacterSheet(PLAYER_OUTFIT);
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
    this.help.text = help();
    this.respawn = this.onMap(options.respawn, false) ?? this.firstRespawn();
    this.menus = new OverworldMenus(this.menuHost());
    if (options.arrived)
      this.toasts.push(arrivalToast(this.region.name, !options.explored?.[this.region.id]));
    this.explore();
    this.saved = { party: this.current, key: this.placeKey() };
  }

  /** Reveals around the player's tile (once per tile) and toasts places found (C36b). */
  private explore(): void {
    const { tx, ty } = this.player;
    const key = `${tx},${ty}`;
    if (key === this.visited) return;
    this.visited = key;
    const here = this.world.toLocal(tx, ty);
    if (!here) return;
    const e = this.exploredOf(here.region.id);
    for (const p of visit(here.region.map, e, here.x, here.y)) this.toasts.push(discoveryToast(p));
  }

  /** A region's exploration (C36b), loaded from the save the first time it is needed. */
  private exploredOf(id: string): ExploredMap {
    let e = this.explored.get(id);
    if (!e) {
      const r = this.world.region(id);
      const m = r ? r.map : loadRegion(this.options.content, id);
      e = exploredMap(m, this.options.explored?.[id]);
      this.explored.set(id, e);
    }
    return e;
  }

  /** Every map's exploration as of now (the regions walked this visit included). */
  exploration(): Record<string, ExploredData> {
    const out: Record<string, ExploredData> = { ...this.options.explored };
    for (const [id, e] of this.explored) {
      const r = this.world.region(id);
      if (r) out[id] = exploredData(r.map, e);
    }
    return out;
  }

  /**
   * A saved place as a world tile, if its map is in this world (and, for `walkable`, the tile
   * is inside and not blocked).
   */
  private onMap(
    p: Place | undefined,
    walkable: boolean,
  ): { x: number; y: number; facing: Dir } | undefined {
    const t = p && this.world.toWorld(p.map, p.x, p.y);
    if (!p || !t) return undefined;
    if (walkable && (!this.map.inside(t.x, t.y) || this.map.blocked(t.x, t.y))) return undefined;
    return { x: t.x, y: t.y, facing: p.facing };
  }

  /** A world tile as a saved place: its region's map and local tile. */
  private placeOf(t: Tile, facing: Dir): Place {
    const here = this.world.toLocal(t.x, t.y);
    const r = here?.region ?? this.region;
    return { map: r.id, x: t.x - r.x, y: t.y - r.y, facing };
  }

  /** Everything a save keeps, as of now. */
  snapshot(): GameState {
    const at = this.player.destination;
    const r = this.respawn;
    return {
      party: this.party,
      place: this.placeOf(at, this.player.facing),
      respawn: this.placeOf(r, r.facing),
      playtime: this.playtime,
      explored: this.exploration(),
      camp: this.camp,
    };
  }

  private placeKey(): string {
    const at = this.player.destination;
    const r = this.respawn;
    return `${at.x},${at.y},${this.player.facing}|${r.x},${r.y},${r.facing}|${this.camp.clock}`;
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
    // After travel the next map's scene saves; this one's place is stale. Mid-sea, the player
    // is on the water: the save waits for the far pier.
    if (!save || this.leaving || this.ride || (mode === 'auto' && !this.dirty)) return undefined;
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
      get map() {
        return scene.region.map;
      },
      get party() {
        return scene.party;
      },
      set party(p: Party) {
        scene.party = p;
      },
      get mapId() {
        return scene.region.id;
      },
      explored: (id: string) => this.exploredOf(id),
      pressed: (a: 'inspect' | 'zoom') => this.options.input.pressed(a),
      size: () => ({ width: this.width, height: this.height }),
      where: () => {
        const z = this.map.zoneAt(this.player.tx, this.player.ty);
        const place = z ? `${z.name} · Lv ${z.levels[0]}–${z.levels[1]}` : 'Town';
        const r = this.region;
        return { x: this.player.tx - r.x, y: this.player.ty - r.y, place };
      },
      services: () => {
        const r = this.region;
        return this.sim.npcs.flatMap((n) =>
          n.npc.role && n.npc.map === r.id
            ? [{ x: n.mover.tx - r.x, y: n.mover.ty - r.y, role: n.npc.role.kind }]
            : [],
        );
      },
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

  /** In front of the starting region's first center NPC, else its spawn point. */
  private firstRespawn(): { x: number; y: number; facing: Dir } {
    const id = this.region.id;
    const center = this.sim.npcs.find((n) => n.npc.role?.kind === 'center' && n.npc.map === id);
    if (center) return inFront(center.mover.destination, center.mover.facing);
    const spot = spawnOf(this.region);
    return { x: spot.x, y: spot.y, facing: 'down' };
  }

  get player(): GridMover {
    return this.sim.player;
  }

  enter(): void {
    this.setContext();
    fieldAudio(this.region.biome);
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
    fieldAudio(this.region.biome);
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
    const now = dayClock(this.camp, this.playtime);
    this.camp = { ...this.camp, clock: this.camp.clock + nextPhaseStart(now, phase) - now };
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

  /** World point the camera centers on: the middle of the player's body (or the boat). */
  private focus(): [number, number] {
    if (this.ride) {
      const b = along(this.ride.voyage, this.ride.d);
      return [b.x, b.y - 4];
    }
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
    if (this.ride) {
      this.updateRide(dt);
      return;
    }
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
      if (!this.player.moving && this.offerFerry(this.player.facing)) return;
      if (!this.player.moving && this.offerRest(this.player.facing)) return;
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
        // Walking into the boat at a pier asks to sail (C37).
        if (this.offerFerry(e.event.dir)) return;
        playSfx('world.bump', { key: 'bump', throttle: 0.25 });
        this.bumpNudge(e.event.dir);
      } else if (e.kind === 'player' && e.event.kind === 'step')
        this.stepFx(e.event.from, e.event.to);
      else if (e.kind === 'player' && e.event.kind === 'arrive' && this.travel(e.event.at)) return;
    }
    // The region's arrival toast goes before the places it reveals.
    this.crossBorder();
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
    const { content, onTravel } = this.options;
    if (!onTravel) return false;
    const here = this.world.toLocal(at.x, at.y);
    if (!here) return false;
    const key = connectionAt(content, here.region.id, here.x, here.y);
    const to = key ? linkedArrival(content, here.region.id, key) : undefined;
    // Inside the world the other end is just a walk (a pass) or a boat ride away (C37).
    if (!to || this.world.region(to.map)) return false;
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

  /**
   * The player walked into another region (C37): its music and ambience crossfade in, the
   * HUD names it and its arrival toast shows (gold-edged the first time).
   */
  private crossBorder(): void {
    const r = this.world.regionAt(this.player.tx, this.player.ty);
    if (!r || r === this.region) return;
    const first = !this.options.explored?.[r.id] && !this.explored.has(r.id);
    this.region = r;
    this.lastZone = '-';
    fieldAudio(r.biome);
    this.toasts.push(arrivalToast(r.name, first));
  }

  /**
   * Facing (or walking into) a pier's boat from its end, or `end` given by a ferryman: asks
   * "Sail to <region>?" and starts the ride on Yes (C37). True when it asked.
   */
  private offerFerry(dir: Dir | undefined, end?: { ferry: Ferry; to: FerryEnd }): boolean {
    let trip = end;
    if (!trip && dir) {
      const at = this.player.destination;
      const [dx, dy] = DIR_STEP[dir];
      trip = this.world.ferryAt(at, { x: at.x + dx, y: at.y + dy });
    }
    if (!trip) return false;
    const { ferry, to } = trip;
    this.clearPath();
    this.say([`Sail to ${to.region.name}? The crossing is free.`], undefined, undefined, (box) =>
      this.ask(['Yes', 'No'], box, (i) => {
        if (i === 0) this.startRide(ferry, to);
      }),
    );
    return true;
  }

  /**
   * Facing a campfire (C40): a burning one asks "Rest?" and rests on Yes; embers only say
   * so. True when the player faces a fire.
   */
  private offerRest(dir: Dir): boolean {
    const at = this.player.destination;
    const [dx, dy] = DIR_STEP[dir];
    const fire = this.campfires.at(at.x + dx, at.y + dy);
    if (!fire) return false;
    this.clearPath();
    if (!fireLit(this.camp, fire.key, this.playtime)) {
      this.say(['Only embers are left. The fire will catch again before long.']);
      return true;
    }
    this.say(['The campfire crackles. Rest here for a while?'], undefined, undefined, (box) =>
      this.ask(['Yes', 'No'], box, (i) => {
        if (i === 0) this.restAt(fire);
      }),
    );
    return true;
  }

  /**
   * Rests at a burning fire: standing team Zorlings heal, fainted ones stay fainted, the day
   * clock moves on, the wild Zorlings around respawn and the fire burns down (C40).
   */
  private restAt(fire: Campfire): void {
    const fainted = this.party.team.filter((z) => z.hp <= 0).length;
    this.camp = restAt(this.camp, fire.key, this.playtime);
    this.party = restParty(this.options.content, this.party);
    this.sim.clearWild();
    playSfx('world.heal');
    const pages = ['Hours pass by the fire. Your Zorlings are rested.'];
    if (fainted)
      pages.push(
        fainted === 1
          ? 'One fainted Zorling still needs a center.'
          : `${fainted} fainted Zorlings still need a center.`,
      );
    this.say(pages);
  }

  /** The ferry from the connection a ferryman stands by, as seen from his region. */
  private ferryOf(npc: NpcActor): { ferry: Ferry; to: FerryEnd } | undefined {
    const key = npc.npc.ferry;
    return key ? this.world.ferryFrom(npc.npc.map, key) : undefined;
  }

  /** Boards the boat at the near pier and rows to `to` (C37). */
  private startRide(ferry: Ferry, to: FerryEnd): void {
    const route = to === ferry.b ? ferry.route : [...ferry.route].reverse();
    const v = voyage(route);
    this.ride = { ferry, to, voyage: v, d: 0, speed: v.length / rideSeconds(v), t: 0 };
    this.lastZone = '-';
    this.clearPath();
    this.sim.clearWild();
    seaAudio();
    playSfx('world.rustle');
  }

  /** The boat moves on along its route; at the far pier the player steps off. */
  private updateRide(dt: number): void {
    const ride = this.ride;
    if (!ride) return;
    ride.t += dt;
    ride.d = Math.min(ride.voyage.length, ride.d + ride.speed * dt);
    const [cx, cy] = this.focus();
    this.camera.follow(cx, cy, this.width, this.height, this.bounds, dt);
    this.stream.prefetch(this.viewRect());
    this.layoutHud();
    if (ride.d < ride.voyage.length) return;
    this.ride = undefined;
    this.lastZone = '-';
    const end = ride.to;
    this.player.place({ x: end.tile.x, y: end.tile.y }, end.facing);
    this.sim.clearWild();
    this.visited = '';
    this.crossBorder();
    this.explore();
    // The same region on both ends (or none): the field sound comes back by itself.
    fieldAudio(this.region.biome);
    this.autosave();
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
    const biome = this.world.lookAt(to.x, to.y);
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
    for (const r of this.sim.roamers) {
      const m = r.mover;
      // A wild Zorling cries when it starts to chase the player (C36e).
      if (r.state === 'chase' && !this.chasing.has(r)) {
        this.chasing.add(r);
        if (this.onScreen(m)) this.cryAt(r.species, m);
      } else if (r.state !== 'chase') this.chasing.delete(r);
      const tile = m.destination.y * this.map.width + m.destination.x;
      const last = this.roamerTiles.get(r);
      this.roamerTiles.set(r, tile);
      if (last === undefined || last === tile) continue;
      const { x, y } = m.destination;
      if (this.map.tall(x, y) && this.onScreen(m)) {
        const tall = this.world.lookAt(x, y).ramps.tall;
        this.fx.rustle(x * TILE + TILE / 2, y * TILE + TILE - 2, tall);
      }
    }
    for (const r of this.roamerTiles.keys())
      if (!this.sim.roamers.includes(r)) this.roamerTiles.delete(r);
    for (const r of this.chasing) if (!this.sim.roamers.includes(r)) this.chasing.delete(r);
  }

  /**
   * A Zorling's cry, panned left or right with its place on screen (C36e). A Titan or
   * legendary in its lair cries in its deeper boss voice.
   */
  private cryAt(species: string, m: GridMover, boss?: 'titan' | 'legendary'): void {
    const { content } = this.options;
    const x = (m.x + 0.5) * TILE - this.viewRect().x;
    const cry = speciesCry(content, species, boss ? { boss } : {});
    playSpec(cry, { pan: screenPan(x, this.width), gain: 0.8 });
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
      // A ferryman offers the crossing after talking (C37).
      const trip = this.ferryOf(npc);
      if (trip) {
        npc.talking = false;
        this.offerFerry(undefined, trip);
        return;
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
    // A Titan or legendary cries as the player speaks to it (C36e).
    const zorling = npc.npc.zorling;
    if (zorling) {
      const legendary = this.options.content.species.require(zorling).legendary;
      this.cryAt(zorling, npc.mover, legendary ? 'legendary' : 'titan');
    }
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
    // Text blips for people (C36e); narration, signs and Zorlings are silent.
    const zorling = this.dialogueNpc?.npc.zorling && speaker === this.dialogueNpc.npc.name;
    const blips = speaker && !zorling ? new BlipCounter() : undefined;
    const pitch = speaker ? speakerPitch(speaker) : 1;
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
      ...(blips ? { onType: (text: string) => blips.typed(text) && playBlip(pitch) } : {}),
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
    const zone = this.map.zoneAt(this.player.tx, this.player.ty);
    const weather = setup.weather ?? zone?.battleWeather;
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
      biome: this.world.biomeAt(this.player.tx, this.player.ty),
      danger: zone?.tier === 'danger',
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
    // The center may be in another region (C37): its sound and name come back with it.
    this.crossBorder();
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
    const glow = this.atmosphere.begin(
      dayClock(this.camp, this.playtime),
      v.x,
      v.y,
      this.campfires.lights(this.camp, this.playtime, v),
    );
    this.stream.draw(buf, v.x, v.y, this.time, glow);
    if (this.target) this.drawMarker(this.target, v.x, v.y);
    const list: Drawable[] = [];
    if (!this.ride) list.push(this.characterDrawable(this.player, this.sheet));
    this.boats(list, v.x, v.y);
    this.fires(list, v);
    // Only what is near the view is drawn (the world has every region's NPCs, C37).
    const near = (m: GridMover): boolean =>
      m.x * TILE > v.x - 4 * TILE &&
      m.x * TILE < v.x + v.width + 3 * TILE &&
      m.y * TILE > v.y - 2 * TILE &&
      m.y * TILE < v.y + v.height + 4 * TILE;
    for (const npc of this.sim.npcs) {
      if (!near(npc.mover)) continue;
      const sheet = this.sheetOf(npc);
      const alert = this.spot?.npc === npc && this.spot.t > 0;
      if (sheet) list.push(this.characterDrawable(npc.mover, sheet, alert));
      else if (npc.npc.zorling) {
        const f = npc.mover.facing;
        if (f === 'left' || f === 'right') this.npcSides.set(npc, f);
        const side = this.npcSides.get(npc) ?? 'left';
        list.push(this.lairDrawable(npc.mover, npc.npc.zorling, side));
      } else if (npc.npc.object === 'item') list.push(this.itemDrawable(npc.mover));
      // A `sign` object is not drawn: the map's sign or stone prop shows it.
    }
    for (const r of this.sim.roamers) {
      if (near(r.mover)) list.push(this.zorlingDrawable(r.mover, r.species, r.side, r.alert));
    }
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw(v.x, v.y);
    this.fx.draw(buf, v.x, v.y);
    this.atmosphere.finish(buf);
    this.ctx.putImageData(this.image, 0, 0);
    this.texture.source.update();
  }

  /** An NPC's walking sprites, built the first time it is drawn (none for Zorlings and objects). */
  private sheetOf(npc: NpcActor): CharacterSheet | undefined {
    if (npc.npc.zorling || npc.npc.object) return undefined;
    let sheet = this.npcSheets.get(npc);
    if (!sheet) {
      sheet = buildCharacterSheet(outfitOf(npc.npc.look));
      this.npcSheets.set(npc, sheet);
    }
    return sheet;
  }

  /**
   * The ferry boats (C37): one waiting at each pier, or the one under way with its wake and
   * the player at the bow. Wakes go on the water now; the boats join the depth-sorted list.
   */
  private boats(list: Drawable[], camX: number, camY: number): void {
    const bob = Math.round(Math.sin(this.time * 3.5));
    const ride = this.ride;
    for (const ferry of this.world.ferries) {
      if (ride?.ferry === ferry) continue;
      for (const [end, next] of [
        [ferry.a, ferry.route[1]],
        [ferry.b, ferry.route[ferry.route.length - 2]],
      ] as const) {
        const x = end.dock.x * TILE + TILE / 2;
        const y = end.dock.y * TILE + TILE / 2;
        if (
          x < camX - 64 ||
          x > camX + this.width + 64 ||
          y < camY - 64 ||
          y > camY + this.height + 64
        )
          continue;
        const dir = next ? heading(end.dock, next) : 'down';
        drawWake(this.buf, x - camX, y - camY, dir, this.time, false);
        list.push(this.boatDrawable(x, y + bob, dir, this.time * 0.15, false));
      }
    }
    if (ride) {
      const b = along(ride.voyage, ride.d);
      drawWake(this.buf, b.x - camX, b.y - camY, b.dir, this.time, true);
      list.push(this.boatDrawable(b.x, b.y + bob, b.dir, ride.t * 0.8, true));
    }
  }

  /** Burning campfires near the view, flickering over the map's burnt-down ones (C40). */
  private fires(
    list: Drawable[],
    v: { x: number; y: number; width: number; height: number },
  ): void {
    for (const fire of this.campfires.list) {
      if (fire.x > v.x + v.width || fire.y > v.y + v.height) continue;
      if (fire.x + 32 < v.x || fire.baseY + 4 < v.y) continue;
      if (!fireLit(this.camp, fire.key, this.playtime)) continue;
      list.push({
        y: fire.ty,
        draw: (camX, camY) => {
          const f = this.campfires.sprite(fire, this.time);
          const { data, width, height } = this.buf;
          const lights = this.atmosphere.lights;
          for (let y = 0; y < f.height; y++) {
            const Y = fire.y + y - camY;
            if (Y < 0 || Y >= height) continue;
            for (let x = 0; x < f.width; x++) {
              const c = f.data[y * f.width + x] ?? 0;
              if (!c) continue;
              const X = fire.x + x - camX;
              if (X < 0 || X >= width) continue;
              if (this.stream.occludes(fire.x + x, fire.y + y, fire.baseY)) continue;
              const i = Y * width + X;
              data[i] = c;
              // Flames shine at night: they keep their colors under the dark.
              if (f.glow?.[y * f.width + x]) lights.emit(i, c, c);
            }
          }
        },
      });
    }
  }

  /** A boat whose hull middle is at world (`x`, `y`); with the player at the bow when riding. */
  private boatDrawable(x: number, y: number, dir: Dir, phase: number, riding: boolean): Drawable {
    return {
      y: y / TILE,
      draw: (camX, camY) => {
        const f = boatFrame(dir, phase);
        const left = Math.round(x - f.cx);
        const top = Math.round(y - f.cy);
        this.blit(f, left, top, Math.round(y) + 8, camX, camY);
        if (!riding) return;
        // The player sits at the bow: the bottom rows (legs) are hidden in the hull.
        const frame = this.sheet[dir][0] as CharacterFrame;
        const cut = 7;
        const seated = { ...frame, height: frame.height - cut };
        const px = Math.round(x + f.bow.x - CHARACTER_W / 2);
        const py = Math.round(y + f.bow.y - (CHARACTER_H - cut));
        this.blit(seated, px, py, Math.round(y) + 8, camX, camY);
      },
    };
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

  /**
   * A Titan or legendary standing in its lair (C36e): its battle look at `LAIR_SIZE` with
   * its glow or twinkling shine, feet on its tile.
   */
  private lairDrawable(m: GridMover, species: string, side: 'left' | 'right'): Drawable {
    return {
      y: m.y,
      draw: (camX, camY) => {
        const frames = this.lairSprite(species)[side];
        const sprite = frames[Math.floor(this.time * 8) % frames.length] as Packed;
        const wx = Math.round(m.x * TILE);
        const wy = Math.round(m.y * TILE);
        const left = wx + (TILE - sprite.width) / 2;
        const top = wy + TILE - sprite.height + LAIR_PAD + 1;
        const baseY = wy + BASE;
        const rx = Math.max(6, Math.min(16, (sprite.right - sprite.left) / 2.6));
        this.drawShadow(wx + TILE / 2, wy + TILE - 1, rx, baseY, camX, camY);
        this.blit(sprite, left, top, baseY, camX, camY);
        this.grassOver(m, left, top, sprite.width, sprite.height, baseY, camX, camY);
      },
    };
  }

  private lairSprite(species: string): LairSprite {
    const have = this.lairSprites.get(species);
    if (have) return have;
    const right = lairLook(this.options.content, species).frames.map(packSprite);
    const s: LairSprite = { right, left: right.map(mirror) };
    this.lairSprites.set(species, s);
    return s;
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
    const sea = this.ride ? 'sea' : '';
    const key = `${this.region.id}|${z?.key ?? ''}|${sea}|${this.width}|${this.height}|${this.party.money}`;
    if (key === this.lastZone) return;
    this.lastZone = key;
    this.place.text = this.placeLabel();
    this.help.text =
      this.savedNote > 0 ? 'Game saved' : this.ride ? 'The ferryman rows you across' : help();
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
    if (this.ride) return `At sea · to ${this.ride.to.region.name}`;
    const z = this.map.zoneAt(this.player.tx, this.player.ty);
    return z ? `${z.name} · Lv ${z.levels[0]}–${z.levels[1]}` : `${this.region.name} · town`;
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

/** A region's spawn point as a world tile (its middle when it has none). */
function spawnOf(r: PlacedRegion): { x: number; y: number; facing: Dir } {
  const a = r.map.anchors['spawn'];
  const x = a?.x ?? r.map.width >> 1;
  const y = a?.y ?? r.map.height >> 1;
  return { x: r.x + x, y: r.y + y, facing: (a?.facing as Dir | undefined) ?? 'down' };
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
