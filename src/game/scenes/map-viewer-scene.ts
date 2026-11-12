/**
 * Debug map viewer (C19): shows a region map loaded from pack content, so the world tool's
 * output can be checked in the game before the overworld exists (C20).
 *
 * - Overview: the whole region, a few game pixels per tile, with the spawn (white),
 *   other anchors (gold) and connection points (red) marked.
 * - Close-up: the real tiles around the cursor, baked one chunk at a time.
 *
 * Keyboard: W A S D / arrows move the cursor, E switches overview ↔ close-up, F cycles the
 * overlay (none, zones, collision), Q goes back.
 */

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { InputManager } from '@engine/input';
import { blendPacked, packColor, PixelBuffer } from '@engine/render/pixel-buffer';
import type { Scene } from '@engine/scenes/scene-manager';
import type { GameContent, Tier } from '@game/data';
import type { Action } from '@game/input/actions';
import { paper, surface } from '@game/style/tokens';
import { drawPaper } from '@game/ui/skin';
import { uiText } from '@game/ui/text';
import { TerrainRenderer } from '@game/world/animate';
import { BIOMES, TILE, type Biome } from '@game/world/biomes';
import { loadRegion, type WorldMap } from '@game/world/map';
import { PROP_INFO } from '@game/world/props';
import { bakeTerrain, type TerrainMap } from '@game/world/terrain';

export interface MapViewerOptions {
  readonly content: GameContent;
  readonly input: InputManager<Action>;
  readonly mapId: string;
  onExit(): void;
}

const OVERLAYS = ['none', 'zones', 'collision'] as const;
type Overlay = (typeof OVERLAYS)[number];

const TIER_TINT: Readonly<Record<Tier, number>> = {
  t1: 0xffd96a,
  t2: 0xff9450,
  t3: 0xd8405e,
  danger: 0x8a3ab0,
};
const BLOCK_TINT = 0xd0303a;
/** Cursor speed, tiles per second. */
const SPEED = { overview: 20, close: 9 } as const;
const PANEL_H = 38;

export class MapViewerScene implements Scene<Container> {
  readonly id = 'map-viewer';
  readonly view = new Container({ label: 'world:map-viewer' });
  readonly ui = new Container({ label: 'ui:map-viewer' });
  private readonly map: WorldMap;
  private readonly terrain: TerrainMap;
  private readonly biome: Biome;
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly texture: Texture;
  private buf = new PixelBuffer(1, 1);
  private image: ImageData;
  private readonly panel = new Graphics();
  private readonly title = uiText('name', '', paper.title);
  private readonly info = uiText('body', '');
  private readonly help = uiText('label', '', paper.inkDim);
  private readonly chunks = new Map<string, TerrainRenderer>();
  private mode: 'overview' | 'close' = 'overview';
  private overlay: Overlay = 'zones';
  private mini: PixelBuffer | undefined;
  private x: number;
  private y: number;
  private time = 0;
  private width = 480;
  private height = 270;
  private lastTile = '';

  constructor(private readonly options: MapViewerOptions) {
    this.map = loadRegion(options.content, options.mapId);
    this.terrain = this.map.toTerrainMap();
    this.biome = BIOMES[this.map.biome];
    const spawn = this.map.anchors['spawn'] ?? { x: this.map.width >> 1, y: this.map.height >> 1 };
    this.x = spawn.x;
    this.y = spawn.y;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas not available');
    this.ctx = ctx;
    this.image = ctx.createImageData(1, 1);
    this.texture = Texture.from(this.canvas);
    this.texture.source.scaleMode = 'nearest';
    this.view.addChild(new Sprite(this.texture));
    this.ui.addChild(this.panel, this.title, this.info, this.help);
    this.title.text = `${this.map.name} · ${this.biome.label} · ${this.map.width}×${this.map.height} tiles, ${this.map.chunksWide}×${this.map.chunksHigh} chunks`;
  }

  enter(): void {
    this.options.input.setContexts(['menu']);
    this.options.input.suppressHeld();
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
    this.mini = undefined;
    this.layout();
  }

  update(dt: number): void {
    const { input } = this.options;
    this.time += dt;
    if (input.pressed('back')) {
      this.options.onExit();
      return;
    }
    if (input.pressed('confirm')) this.mode = this.mode === 'overview' ? 'close' : 'overview';
    if (input.pressed('inspect')) {
      this.overlay = OVERLAYS[(OVERLAYS.indexOf(this.overlay) + 1) % OVERLAYS.length] ?? 'none';
      this.mini = undefined;
    }
    const step = SPEED[this.mode] * dt;
    const dx = (input.held('nav_right') ? 1 : 0) - (input.held('nav_left') ? 1 : 0);
    const dy = (input.held('nav_down') ? 1 : 0) - (input.held('nav_up') ? 1 : 0);
    this.x = Math.min(Math.max(this.x + dx * step, 0), this.map.width - 1);
    this.y = Math.min(Math.max(this.y + dy * step, 0), this.map.height - 1);
    this.layout();
  }

  render(): void {
    this.buf.fill(surface.background);
    if (this.mode === 'overview') this.drawOverview();
    else this.drawClose();
    this.ctx.putImageData(this.image, 0, 0);
    this.texture.source.update();
  }

  private get tile(): [number, number] {
    return [Math.floor(this.x), Math.floor(this.y)];
  }

  /** Overview scale: whole game pixels per tile so the map fits above the info panel. */
  private get scale(): number {
    const room = Math.min(this.width - 16, this.height - PANEL_H - 24);
    return Math.max(1, Math.floor(room / Math.max(this.map.width, this.map.height)));
  }

  private tileColor(tx: number, ty: number, prop: string | undefined): number {
    const m = this.map;
    const r = this.biome.ramps;
    const corners = (g: WorldMap['alt']): number =>
      g.get(tx, ty) + g.get(tx + 1, ty) + g.get(tx, ty + 1) + g.get(tx + 1, ty + 1);
    let c: number;
    if (corners(m.liquid) >= 2) c = r.liquid[1] ?? 0;
    else if (prop)
      c = (PROP_INFO[prop as keyof typeof PROP_INFO].solid ? r.foliage[1] : r.accent[2]) ?? 0;
    else if (corners(m.path) >= 2) c = r.path[2] ?? 0;
    else if (m.tall(tx, ty)) c = r.tall[1] ?? 0;
    else if (corners(m.alt) >= 2) c = r.alt[2] ?? 0;
    else c = r.ground[2] ?? 0;
    let p = packColor(c);
    if (this.overlay === 'zones') {
      const z = m.zoneAt(tx, ty);
      if (z) {
        const shade = m.zones.indexOf(z) % 2 ? 0.32 : 0.5;
        p = blendPacked(p, TIER_TINT[z.tier], shade);
      }
    } else if (this.overlay === 'collision' && m.blocked(tx, ty)) {
      p = blendPacked(p, BLOCK_TINT, 0.55);
    }
    return p;
  }

  private buildMini(): PixelBuffer {
    const m = this.map;
    const s = this.scale;
    const mini = new PixelBuffer(m.width * s, m.height * s);
    const props = new Map(m.props.map((p) => [p.ty * m.width + p.tx, p.kind]));
    for (let ty = 0; ty < m.height; ty++) {
      for (let tx = 0; tx < m.width; tx++) {
        const c = this.tileColor(tx, ty, props.get(ty * m.width + tx));
        for (let y = 0; y < s; y++)
          mini.data.fill(
            c,
            (ty * s + y) * mini.width + tx * s,
            (ty * s + y) * mini.width + tx * s + s,
          );
      }
    }
    return mini;
  }

  private drawOverview(): void {
    const mini = (this.mini ??= this.buildMini());
    const s = this.scale;
    const ox = Math.round((this.width - mini.width) / 2);
    const oy = Math.round((this.height - PANEL_H - mini.height) / 2) + 2;
    const { buf } = this;
    for (let y = 0; y < mini.height; y++) {
      const dy = oy + y;
      if (dy < 0 || dy >= buf.height) continue;
      buf.data.set(mini.data.subarray(y * mini.width, (y + 1) * mini.width), dy * buf.width + ox);
    }
    const mark = (tx: number, ty: number, rgb: number): void => {
      for (let y = -1; y <= s; y++)
        for (let x = -1; x <= s; x++) buf.dot(ox + tx * s + x, oy + ty * s + y, rgb, 1);
    };
    for (const [id, a] of Object.entries(this.map.anchors))
      mark(a.x, a.y, id === 'spawn' ? 0xffffff : paper.cursor);
    for (const c of Object.values(this.map.connections)) mark(c.x, c.y, 0xe0303a);
    // Close-up viewport around the cursor.
    const vw = (this.width / TILE) * s;
    const vh = (this.height / TILE) * s;
    const cx = ox + this.x * s - vw / 2;
    const cy = oy + this.y * s - vh / 2;
    this.rect(Math.round(cx), Math.round(cy), Math.round(vw), Math.round(vh), 0xffffff, 0.9);
    const [tx, ty] = this.tile;
    this.rect(ox + tx * s - 1, oy + ty * s - 1, s + 2, s + 2, paper.cursor, 1);
  }

  private drawClose(): void {
    const { buf, map } = this;
    const camX = Math.round(this.x * TILE + TILE / 2 - this.width / 2);
    const camY = Math.round(this.y * TILE + TILE / 2 - (this.height - PANEL_H) / 2);
    const view = {
      x: Math.floor(camX / TILE),
      y: Math.floor(camY / TILE),
      width: Math.ceil(this.width / TILE) + 2,
      height: Math.ceil(this.height / TILE) + 2,
    };
    buf.fill(this.biome.ramps.ground[1] ?? 0);
    let baked = false;
    for (const [cx, cy] of map.chunksIn(view)) {
      const key = `${cx},${cy}`;
      let r = this.chunks.get(key);
      // Bake at most one new chunk per frame to keep the viewer responsive.
      if (!r && !baked) {
        r = new TerrainRenderer(
          bakeTerrain(this.terrain, this.biome, map.chunkRect(cx, cy)),
          this.biome,
          map.seed,
        );
        this.chunks.set(key, r);
        baked = true;
      }
      r?.draw(buf, camX, camY, this.time);
    }
    for (let ty = view.y; ty < view.y + view.height; ty++) {
      for (let tx = view.x; tx < view.x + view.width; tx++) {
        let tint: number | undefined;
        let a = 0.35;
        if (this.overlay === 'collision' && map.blocked(tx, ty)) tint = BLOCK_TINT;
        else if (this.overlay === 'zones') {
          const z = map.zoneAt(tx, ty);
          if (z) {
            tint = TIER_TINT[z.tier];
            a = map.zones.indexOf(z) % 2 ? 0.15 : 0.25;
          }
        }
        if (tint !== undefined)
          this.fillRect(tx * TILE - camX, ty * TILE - camY, TILE, TILE, tint, a);
      }
    }
    const marks = [
      ...Object.entries(map.anchors).map(([id, p]) => ({
        ...p,
        rgb: id === 'spawn' ? 0xffffff : paper.cursor,
      })),
      ...Object.values(map.connections).map((p) => ({ ...p, rgb: 0xe0303a })),
    ];
    for (const p of marks) this.rect(p.x * TILE - camX + 4, p.y * TILE - camY + 4, 8, 8, p.rgb, 1);
    const [tx, ty] = this.tile;
    this.rect(tx * TILE - camX, ty * TILE - camY, TILE, TILE, paper.cursor, 1);
  }

  private fillRect(x: number, y: number, w: number, h: number, rgb: number, a: number): void {
    const { buf } = this;
    for (let j = Math.max(0, y); j < Math.min(buf.height, y + h); j++) {
      for (let i = Math.max(0, x); i < Math.min(buf.width, x + w); i++) {
        const k = j * buf.width + i;
        buf.data[k] = blendPacked(buf.data[k] ?? 0, rgb, a);
      }
    }
  }

  private rect(x: number, y: number, w: number, h: number, rgb: number, a: number): void {
    for (let i = 0; i < w; i++) {
      this.buf.dot(x + i, y, rgb, a);
      this.buf.dot(x + i, y + h - 1, rgb, a);
    }
    for (let j = 1; j < h - 1; j++) {
      this.buf.dot(x, y + j, rgb, a);
      this.buf.dot(x + w - 1, y + j, rgb, a);
    }
  }

  private layout(): void {
    const [tx, ty] = this.tile;
    const key = `${tx},${ty},${this.mode},${this.overlay},${this.width},${this.height}`;
    if (key === this.lastTile) return;
    this.lastTile = key;
    const m = this.map;
    const z = m.zoneAt(tx, ty);
    const species = this.options.content.species;
    const where = z
      ? `${z.name} (${z.tier.toUpperCase()}, Lv ${z.levels[0]}–${z.levels[1]}): ${z.spawns.map((s) => `${species.get(s.species)?.name ?? s.species} ×${s.weight}`).join(', ') || 'no spawns'}`
      : 'Town · no wild Zorlings';
    const anchor = Object.entries(m.anchors).find(([, a]) => a.x === tx && a.y === ty)?.[0];
    const conn = Object.entries(m.connections).find(([, c]) => c.x === tx && c.y === ty)?.[0];
    const extra = [anchor && `anchor "${anchor}"`, conn && `connection "${conn}"`]
      .filter(Boolean)
      .join(' · ');
    this.info.text = `(${tx}, ${ty}) ${m.blocked(tx, ty) ? 'blocked' : 'walkable'}${m.tall(tx, ty) ? ', tall grass' : ''}${extra ? ` · ${extra}` : ''} · ${where}`;
    this.help.text = `WASD move · E ${this.mode === 'overview' ? 'close-up' : 'overview'} · F overlay: ${this.overlay} · Q back`;
    const x = 6;
    const y = this.height - PANEL_H - 4;
    drawPaper(this.panel.clear(), x, y, this.width - 12, PANEL_H);
    this.title.position.set(x + 8, y + 3);
    this.info.position.set(x + 8, y + 15);
    this.help.position.set(x + 8, y + 28);
  }
}
