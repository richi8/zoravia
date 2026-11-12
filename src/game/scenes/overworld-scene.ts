/**
 * Overworld (C20, C21): the player walks a region map on the tile grid among NPCs and
 * roaming wild Zorlings.
 *
 * - Keyboard: W A S D / arrows walk (tap to turn), `E` talks to the NPC in front (or touches
 *   the wild Zorling there), Esc leaves (until the pause menu, C22).
 * - Mouse (optional): click a tile to walk there along an A* path. Clicking an NPC or a wild
 *   Zorling walks next to it, faces it and talks / battles. Any direction key cancels the path.
 * - Walking into a roaming Zorling (or one catching the player) starts a wild battle with the
 *   battle transition; the world resumes after it, with the result written to the party.
 * - Terrain streams in 8×8-tile blocks; props in front hide everyone (walk behind trees),
 *   tall grass covers feet, and actors are drawn back to front. The camera eases after the
 *   player.
 */

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { InputManager } from '@engine/input';
import type { Engine } from '@engine/render/engine';
import { blendPacked, packColor, PixelBuffer } from '@engine/render/pixel-buffer';
import type { Scene } from '@engine/scenes/scene-manager';
import { DialogBox, FocusStack, type UiInput, type UiTheme } from '@engine/ui';
import type { BattleResult } from '@game/battle/logic';
import { BattleScene } from '@game/battle/scene/battle-scene';
import { battleTransition } from '@game/battle/scene/transition';
import type { GameContent } from '@game/data';
import { MOVE_DIRECTIONS, type Action } from '@game/input/actions';
import { applyBattleResult, healTeam, teamDown, type Party } from '@game/player';
import { createZorling, displayName } from '@game/progression';
import { paper, surface } from '@game/style/tokens';
import { drawPaper } from '@game/ui/skin';
import { uiText } from '@game/ui/text';
import { BIOMES, TILE } from '@game/world/biomes';
import { loadRegion, type WorldMap } from '@game/world/map';
import type { NpcActor, Roamer } from '@game/world/overworld/actors';
import { Camera } from '@game/world/overworld/camera';
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
import { OverworldSim, type Occupant } from '@game/world/overworld/sim';
import { TerrainStream } from '@game/world/overworld/stream';
import { speciesLook } from '@game/zorlings/species-look';
import { renderZorling, SPRITE_SIZE } from '@game/zorlings/render';

export interface OverworldOptions {
  readonly engine: Engine;
  readonly content: GameContent;
  readonly input: InputManager<Action>;
  readonly ui: UiInput;
  readonly theme: UiTheme;
  readonly mapId: string;
  /** The player's Zorlings, bag and money when entering. */
  readonly party: Party;
  /** Called after every battle with the updated party. */
  onParty?(party: Party): void;
  /** Battle speed (1, 1.5, 2) and confirm-before-switch, until settings (C33). */
  readonly battleSpeed?: number;
  readonly confirmHotbarSwitch?: boolean;
  /** Seed of the wild spawns and NPC behavior. Default: the map seed. */
  readonly seed?: number;
  onExit(): void;
}

const HUD_H = 26;
/** World px from the top of a tile to an entity's base line (matches prop bases). */
const BASE = TILE - 2;
/** Beat between touching a wild Zorling ("!") and the battle transition. */
const ENCOUNTER_BEAT = 0.4;
/** Seconds a wild Zorling the player ran from leaves the player alone. */
const RAN_COOLDOWN = 4;
const SHADOW = 0x1e3a14;

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
  private readonly camera = new Camera();
  private readonly sheet: CharacterSheet;
  private readonly npcSheets = new Map<NpcActor, CharacterSheet>();
  private readonly wildSprites = new Map<string, WildSprite>();
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly texture: Texture;
  private buf = new PixelBuffer(1, 1);
  private image: ImageData;
  private readonly panel = new Graphics();
  private readonly place = uiText('name', '', paper.title);
  private readonly help = uiText('label', '', paper.inkDim);
  private readonly layer = new Container({ label: 'dialogs' });
  private readonly stack: FocusStack<Container>;
  /** The current party (updated after each battle). */
  party: Party;
  private path: Tile[] | undefined;
  private target: Tile | undefined;
  private faceAfter: Dir | undefined;
  /** Talk to / touch what the player faces once the click path ends. */
  private interactAfter = false;
  private encounter: { roamer: Roamer; t: number } | undefined;
  private inBattle = false;
  private afterBattle: string[] = [];
  private time = 0;
  private width = 480;
  private height = 270;
  private lastZone: string | undefined = '-';

  constructor(private readonly options: OverworldOptions) {
    this.map = loadRegion(options.content, options.mapId);
    this.party = options.party;
    this.sim = new OverworldSim({
      content: options.content,
      mapId: options.mapId,
      map: this.map,
      seed: options.seed ?? this.map.seed,
    });
    this.stream = new TerrainStream(this.map, BIOMES[this.map.biome]);
    this.sheet = buildCharacterSheet(PLAYER_OUTFIT);
    for (const npc of this.sim.npcs) {
      this.npcSheets.set(npc, buildCharacterSheet(outfitOf(npc.npc.look)));
    }
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas not available');
    this.ctx = ctx;
    this.image = ctx.createImageData(1, 1);
    this.texture = Texture.from(this.canvas);
    this.texture.source.scaleMode = 'nearest';
    this.view.addChild(new Sprite(this.texture));
    this.ui.addChild(this.panel, this.place, this.help, this.layer);
    this.stack = new FocusStack<Container>(
      { attach: (v) => this.layer.addChild(v), detach: (v) => this.layer.removeChild(v) },
      options.ui,
    );
    this.stack.onEmpty = () => this.setContext();
    this.help.text = 'WASD move · E talk · click to walk · Esc back';
  }

  get player(): GridMover {
    return this.sim.player;
  }

  enter(): void {
    this.setContext();
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
    const pages = this.afterBattle;
    this.afterBattle = [];
    if (pages.length) this.say(pages);
  }

  exit(): void {
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
    const [cx, cy] = this.focus();
    this.camera.snap(cx, cy, width, height, this.bounds);
    this.lastZone = '-';
    this.layoutHud();
    this.layoutDialog();
  }

  private setContext(): void {
    // The dialog box takes the HUD's place at the bottom of the screen.
    const talking = this.stack.size > 0;
    this.panel.visible = this.place.visible = this.help.visible = !talking;
    this.options.input.setContexts([talking ? 'dialog' : 'overworld']);
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
    if (this.inBattle) return;
    if (this.stack.size) {
      this.stack.update(dt);
      return;
    }
    if (this.encounter) {
      this.encounter.t -= dt;
      if (this.encounter.t <= 0) this.startBattle(this.encounter.roamer);
      return;
    }
    if (input.pressed('pause')) {
      this.options.onExit();
      return;
    }
    const key = input.direction(MOVE_DIRECTIONS);
    if (key) this.clearPath();
    else if (input.rawPressed('Mouse0') && input.pointer.inside) this.clickTo(input.pointer);
    if (input.pressed('confirm') || this.interactAfter) {
      this.interactAfter = false;
      if (this.interact(this.sim.facing())) return;
    }

    const intent = (at: Tile): Intent | undefined => (key ? { dir: key } : this.followPath(at));
    for (const e of this.sim.update(dt, intent, this.viewTiles())) {
      if (e.kind === 'encounter') this.touch(e.roamer);
    }

    const [cx, cy] = this.focus();
    this.camera.follow(cx, cy, this.width, this.height, this.bounds, dt);
    this.stream.prefetch(this.viewRect());
    this.layoutHud();
  }

  private viewRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: Math.round(this.camera.x),
      y: Math.round(this.camera.y),
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
    npc.talking = true;
    npc.faceToward(this.player.destination);
    this.clearPath();
    this.say(npc.npc.lines, npc.npc.name, () => (npc.talking = false));
    return true;
  }

  private say(pages: readonly string[], speaker?: string, done?: () => void): void {
    const { theme } = this.options;
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
    });
    this.stack.push(dialog);
    this.layoutDialog();
    this.setContext();
  }

  private dialogWidth(): number {
    return Math.min(320, this.width - 24);
  }

  private layoutDialog(): void {
    const d = this.stack.top;
    if (!(d instanceof DialogBox)) return;
    d.view.position.set(Math.round((this.width - d.width) / 2), this.height - d.height - 10);
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
  }

  private startBattle(roamer: Roamer): void {
    const { engine, content, input, ui, theme } = this.options;
    this.encounter = undefined;
    if (teamDown(this.party)) this.party = healTeam(content, this.party);
    const wild = createZorling(content, {
      uid: `wild-${roamer.id}`,
      species: roamer.species,
      level: roamer.level,
    });
    this.inBattle = true;
    const scene = new BattleScene({
      content,
      input,
      ui,
      theme,
      setup: {
        kind: 'wild',
        seed: this.sim.battleSeed(),
        player: this.party.team,
        opponent: [wild],
        bag: this.party.bag,
      },
      speed: this.options.battleSpeed ?? 1,
      money: this.party.money,
      confirmHotbarSwitch: this.options.confirmHotbarSwitch ?? false,
      onEnd: (result) => {
        this.finishBattle(roamer, result);
        void engine.scenes.pop({ transition: engine.fade({ duration: 0.3 }) });
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
    const applied = applyBattleResult(this.party, result);
    this.party = applied.party;
    switch (result.outcome) {
      case 'win':
        this.sim.remove(roamer);
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
      case 'lose': {
        // No Zorling centers yet (C22): heal and wake up at the town's spawn point.
        this.party = healTeam(content, this.party);
        this.sim.clearWild();
        const spot = this.map.anchors['spawn'] ?? { x: this.player.tx, y: this.player.ty };
        this.player.place({ x: spot.x, y: spot.y }, 'down');
        this.clearPath();
        const [cx, cy] = this.focus();
        this.camera.snap(cx, cy, this.width, this.height, this.bounds);
        this.afterBattle.push('Your team fainted… You hurried back to town, and they rested up.');
        break;
      }
    }
    this.options.onParty?.(this.party);
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
    this.stream.draw(buf, v.x, v.y, this.time);
    if (this.target) this.drawMarker(this.target, v.x, v.y);
    const list: Drawable[] = [];
    list.push(this.characterDrawable(this.player, this.sheet));
    for (const npc of this.sim.npcs) {
      const sheet = this.npcSheets.get(npc);
      if (sheet) list.push(this.characterDrawable(npc.mover, sheet));
    }
    for (const r of this.sim.roamers) list.push(this.wildDrawable(r));
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw(v.x, v.y);
    this.ctx.putImageData(this.image, 0, 0);
    this.texture.source.update();
  }

  private characterDrawable(m: GridMover, sheet: CharacterSheet): Drawable {
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
      },
    };
  }

  private wildDrawable(r: Roamer): Drawable {
    const m = r.mover;
    return {
      y: m.y,
      draw: (camX, camY) => {
        const sprite = this.wildSprite(r.species)[r.side];
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
        if (r.alert > 0) this.drawAlert(wx + TILE / 2, top + sprite.top - 2, camX, camY);
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
    const key = `${z?.key ?? ''}|${this.width}|${this.height}`;
    if (key === this.lastZone) return;
    this.lastZone = key;
    this.place.text = z
      ? `${z.name} · Lv ${z.levels[0]}–${z.levels[1]}`
      : `${this.map.name} · town`;
    const w = Math.max(this.place.width, this.help.width) + 16;
    const x = 6;
    const y = this.height - HUD_H - 6;
    drawPaper(this.panel.clear(), x, y, Math.round(w), HUD_H);
    this.place.position.set(x + 8, y + 2);
    this.help.position.set(x + 8, y + 14);
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
