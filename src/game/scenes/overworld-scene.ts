/**
 * Overworld (C20): the player walks a region map on the tile grid.
 *
 * - Keyboard: W A S D / arrows walk (tap to turn), Esc leaves (until the pause menu, C22).
 * - Mouse (optional): click a tile to walk there along an A* path; clicking a blocked tile
 *   walks next to it and turns to face it. Any direction key cancels the path.
 * - Terrain streams in 8×8-tile blocks; props in front of the player hide it (walk behind
 *   trees) and tall grass covers its feet. The camera eases after the player.
 */

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { InputManager } from '@engine/input';
import { blendPacked, PixelBuffer } from '@engine/render/pixel-buffer';
import type { Scene } from '@engine/scenes/scene-manager';
import type { GameContent } from '@game/data';
import { MOVE_DIRECTIONS, type Action } from '@game/input/actions';
import { paper, surface } from '@game/style/tokens';
import { drawPaper } from '@game/ui/skin';
import { uiText } from '@game/ui/text';
import { BIOMES, TILE } from '@game/world/biomes';
import { loadRegion, type WorldMap } from '@game/world/map';
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
  GridMover,
  type Dir,
  type Intent,
  type Tile,
} from '@game/world/overworld/mover';
import { pathToward } from '@game/world/overworld/path';
import { TerrainStream } from '@game/world/overworld/stream';

export interface OverworldOptions {
  readonly content: GameContent;
  readonly input: InputManager<Action>;
  readonly mapId: string;
  onExit(): void;
}

const HUD_H = 26;
/** World px from the top of a tile to an entity's base line (matches prop bases). */
const BASE = TILE - 2;

export class OverworldScene implements Scene<Container> {
  readonly id = 'overworld';
  readonly view = new Container({ label: 'world:overworld' });
  readonly ui = new Container({ label: 'ui:overworld' });
  readonly map: WorldMap;
  readonly player: GridMover;
  private readonly stream: TerrainStream;
  private readonly camera = new Camera();
  private readonly sheet: CharacterSheet;
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly texture: Texture;
  private buf = new PixelBuffer(1, 1);
  private image: ImageData;
  private readonly panel = new Graphics();
  private readonly place = uiText('name', '', paper.title);
  private readonly help = uiText('label', '', paper.inkDim);
  private path: Tile[] | undefined;
  private target: Tile | undefined;
  private faceAfter: Dir | undefined;
  private time = 0;
  private width = 480;
  private height = 270;
  private lastZone: string | undefined = '-';

  constructor(private readonly options: OverworldOptions) {
    this.map = loadRegion(options.content, options.mapId);
    this.stream = new TerrainStream(this.map, BIOMES[this.map.biome]);
    const spawn = this.map.anchors['spawn'] ?? {
      x: this.map.width >> 1,
      y: this.map.height >> 1,
    };
    this.player = new GridMover({ x: spawn.x, y: spawn.y }, 'down');
    this.sheet = buildCharacterSheet(PLAYER_OUTFIT);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas not available');
    this.ctx = ctx;
    this.image = ctx.createImageData(1, 1);
    this.texture = Texture.from(this.canvas);
    this.texture.source.scaleMode = 'nearest';
    this.view.addChild(new Sprite(this.texture));
    this.ui.addChild(this.panel, this.place, this.help);
    this.help.text = 'WASD move · click a tile to walk there · Esc back';
  }

  enter(): void {
    this.options.input.setContexts(['overworld']);
    this.options.input.suppressHeld();
  }

  pause(): void {
    this.view.visible = false;
    this.ui.visible = false;
  }

  resume(): void {
    this.view.visible = true;
    this.ui.visible = true;
    this.enter();
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
  }

  private get bounds(): { width: number; height: number } {
    return { width: this.map.width * TILE, height: this.map.height * TILE };
  }

  /** World point the camera centers on: the middle of the player's body. */
  private focus(): [number, number] {
    return [this.player.x * TILE + TILE / 2, this.player.y * TILE + TILE / 2 - 4];
  }

  private readonly blocked = (x: number, y: number): boolean => this.map.blocked(x, y);

  update(dt: number): void {
    const { input } = this.options;
    this.time += dt;
    if (input.pressed('pause')) {
      this.options.onExit();
      return;
    }
    const key = input.direction(MOVE_DIRECTIONS);
    if (key) this.clearPath();
    else if (input.rawPressed('Mouse0') && input.pointer.inside) this.clickTo(input.pointer);

    const intent = (at: Tile): Intent | undefined => (key ? { dir: key } : this.followPath(at));
    this.player.update(dt, intent, this.blocked);

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

  // ------------------------------------------------------------ click-to-move

  private clickTo(p: { x: number; y: number }): void {
    const v = this.viewRect();
    const tile = { x: Math.floor((p.x + v.x) / TILE), y: Math.floor((p.y + v.y) / TILE) };
    if (!this.map.inside(tile.x, tile.y)) return;
    const from = this.player.destination;
    const path = pathToward(from, tile, this.blocked);
    if (!path) return;
    this.path = path;
    this.target = tile;
    const end = path[path.length - 1] ?? from;
    this.faceAfter = this.map.blocked(tile.x, tile.y) ? dirBetween(end, tile) : undefined;
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
    if (!dir || this.blocked(next.x, next.y)) {
      this.clearPath();
      return undefined;
    }
    return { dir, noTurnDelay: true };
  }

  private finishPath(): void {
    if (this.faceAfter) this.player.facing = this.faceAfter;
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
    this.drawPlayer(v.x, v.y);
    this.ctx.putImageData(this.image, 0, 0);
    this.texture.source.update();
  }

  private drawPlayer(camX: number, camY: number): void {
    const p = this.player;
    const wx = Math.round(p.x * TILE);
    const wy = Math.round(p.y * TILE);
    const baseY = wy + BASE;
    const frame = this.frame();
    const left = wx + (TILE - CHARACTER_W) / 2;
    const top = wy + TILE - CHARACTER_H;
    // Soft shadow on the ground.
    const sx = wx + TILE / 2 - camX;
    const sy = wy + TILE - 1 - camY;
    for (let y = -1; y <= 1; y++) {
      for (let x = -5; x <= 5; x++) {
        if ((x / 5.5) ** 2 + (y / 1.6) ** 2 > 1) continue;
        const X = sx + x;
        const Y = sy + y;
        if (X < 0 || Y < 0 || X >= this.buf.width || Y >= this.buf.height) continue;
        if (this.stream.occludes(X + camX, Y + camY, baseY)) continue;
        const k = Y * this.buf.width + X;
        this.buf.data[k] = blendPacked(this.buf.data[k] ?? 0, 0x1e3a14, 0.28);
      }
    }
    const { data, width } = this.buf;
    for (let y = 0; y < frame.height; y++) {
      const Y = top + y - camY;
      if (Y < 0 || Y >= this.buf.height) continue;
      for (let x = 0; x < frame.width; x++) {
        const c = frame.data[y * frame.width + x] ?? 0;
        if (!c) continue;
        const X = left + x - camX;
        if (X < 0 || X >= width) continue;
        if (this.stream.occludes(left + x, top + y, baseY)) continue;
        data[Y * width + X] = c;
      }
    }
    // Tall grass in front of the feet.
    const tx = Math.round(p.x);
    const ty = Math.round(p.y);
    if (this.map.tall(tx, ty) || this.map.tall(p.tx, p.ty)) {
      this.stream.drawGrassOver(
        this.buf,
        camX,
        camY,
        this.time,
        { x: left, y: top, width: CHARACTER_W, height: CHARACTER_H },
        baseY - 6,
      );
    }
  }

  private frame(): CharacterFrame {
    const p = this.player;
    const frames = this.sheet[p.facing];
    return frames[walkFrame(p.walked, p.moving)] ?? (frames[0] as CharacterFrame);
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
