/**
 * Browser view of a biome map with weather: draws terrain + weather into a screen-sized
 * `PixelBuffer` each frame and shows it as one nearest-filtered Pixi sprite in game pixels.
 */

import { Container, Sprite, Texture } from 'pixi.js';
import { blendPacked, PixelBuffer } from '@engine/render/pixel-buffer';
import { WeatherSim } from '@engine/render/weather';
import { TILE, type Biome } from './biomes';
import { TerrainRenderer } from './animate';
import { bakeTerrain, type TerrainMap } from './terrain';
import { WEATHER, type WeatherId } from './weather';

export class TerrainView {
  readonly view = new Container();
  /** Draws a faint tile grid on top (lab). */
  showGrid = false;
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private buf = new PixelBuffer(1, 1);
  private image: ImageData;
  private texture: Texture;
  private readonly sprite: Sprite;
  private renderer: TerrainRenderer;
  private weather: WeatherSim | undefined;
  private time = 0;
  private camX = 0;
  private camY = 0;

  constructor(
    private map: TerrainMap,
    private biome: Biome,
    weather: WeatherId = biome.weather,
  ) {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas not available');
    this.ctx = ctx;
    this.image = ctx.createImageData(1, 1);
    this.texture = Texture.from(this.canvas);
    this.texture.source.scaleMode = 'nearest';
    this.sprite = new Sprite(this.texture);
    this.view.addChild(this.sprite);
    this.renderer = new TerrainRenderer(bakeTerrain(map, biome), biome, map.seed);
    this.setWeather(weather);
  }

  setMap(map: TerrainMap, biome: Biome): void {
    this.map = map;
    this.biome = biome;
    this.renderer = new TerrainRenderer(bakeTerrain(map, biome), biome, map.seed);
    this.center();
  }

  setWeather(id: WeatherId): void {
    const spec = WEATHER[id];
    this.weather =
      spec.layers.length || spec.haze
        ? new WeatherSim(spec, `weather:${id}`, this.buf.width, this.buf.height)
        : undefined;
  }

  resize(width: number, height: number): void {
    this.buf = new PixelBuffer(width, height);
    this.canvas.width = width;
    this.canvas.height = height;
    this.image = new ImageData(this.buf.bytes, width, height);
    this.texture.source.resize(width, height);
    this.weather?.resize(width, height);
    this.center();
  }

  update(dt: number): void {
    this.time += dt;
    this.weather?.update(dt);
  }

  render(): void {
    const { buf } = this;
    buf.fill(this.biome.ramps.ground[1] ?? 0);
    this.renderer.draw(buf, this.camX, this.camY, this.time);
    this.weather?.draw(buf);
    if (this.showGrid) this.drawGrid();
    this.ctx.putImageData(this.image, 0, 0);
    this.texture.source.update();
  }

  destroy(): void {
    this.view.destroy({ children: true });
    this.texture.destroy(true);
  }

  /** Centers the map on screen (the lab map is about one screen). */
  private center(): void {
    this.camX = Math.round((this.map.width * TILE - this.buf.width) / 2);
    this.camY = Math.round((this.map.height * TILE - this.buf.height) / 2);
  }

  private drawGrid(): void {
    const { data, width, height } = this.buf;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if ((x + this.camX) % TILE === 0 || (y + this.camY) % TILE === 0) {
          data[y * width + x] = blendPacked(data[y * width + x] ?? 0, 0x000000, 0.18);
        }
      }
    }
  }
}
