/**
 * Browser presentation of an animated Zorling: plays `animateZorling` clips as Pixi sprites,
 * honoring each frame's `ms`, `dx/dy` and `alpha`. The container's origin is the ground
 * point between the feet, so place it on the platform.
 *
 * `facing: 'left'` mirrors every frame (foe side) and negates `dx`. Clips are rendered
 * lazily the first time they play (rasterizing costs ~9 ms per frame at 96 px).
 */

import { Container, Sprite, type Texture } from 'pixi.js';
import { flipX } from '@engine/render/sdf-sprite';
import { pixelTexture } from '@engine/render/pixel-texture';
import { animateZorling, type ClipName, type ZorlingAnimation } from './animate';
import type { ZorlingGenome } from './genome';

export interface ActorOptions {
  readonly size?: number;
  readonly fill?: number;
  readonly titan?: boolean;
  readonly facing?: 'left' | 'right';
  /** Animation speed multiplier (battle speed setting). Default 1. */
  readonly speed?: number;
}

interface LoadedClip {
  readonly loop: boolean;
  readonly frames: readonly {
    readonly texture: Texture;
    readonly dx: number;
    readonly dy: number;
    readonly alpha: number;
    readonly ms: number;
  }[];
}

export class ZorlingActor extends Container {
  private readonly sprite = new Sprite();
  private readonly clips = new Map<ClipName, LoadedClip>();
  private anim: ZorlingAnimation | undefined;
  private clip: ClipName = 'idle';
  private frame = 0;
  private time = 0;
  private onDone: (() => void) | undefined;
  speed: number;

  constructor(
    readonly genome: ZorlingGenome,
    private readonly options: ActorOptions = {},
  ) {
    super({ label: 'zorling' });
    this.speed = options.speed ?? 1;
    this.addChild(this.sprite);
    this.play('idle');
  }

  get playing(): ClipName {
    return this.clip;
  }

  /** Plays `clip` from its start; `onDone` fires when a non-looping clip ends. */
  play(clip: ClipName, onDone?: () => void): void {
    this.clip = clip;
    this.frame = 0;
    this.time = 0;
    this.onDone = onDone;
    this.show();
  }

  /** Renders a clip ahead of time (e.g. while the player reads text), so playing it later does not hitch. */
  preload(clip: ClipName): void {
    this.load(clip);
  }

  update(dt: number): void {
    const c = this.load(this.clip);
    const f = c.frames[this.frame];
    if (!f) return;
    this.time += dt * 1000 * this.speed;
    let changed = false;
    while (this.time >= (c.frames[this.frame]?.ms ?? Infinity)) {
      this.time -= c.frames[this.frame]?.ms ?? 0;
      if (this.frame + 1 < c.frames.length) {
        this.frame++;
      } else if (c.loop) {
        this.frame = 0;
      } else {
        this.time = 0;
        const done = this.onDone;
        this.onDone = undefined;
        if (this.clip !== 'faint') this.play('idle');
        done?.();
        return;
      }
      changed = true;
    }
    if (changed) this.show();
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    for (const c of this.clips.values()) for (const f of c.frames) f.texture.destroy(true);
    this.clips.clear();
    super.destroy(options);
  }

  private show(): void {
    const c = this.load(this.clip);
    const f = c.frames[this.frame];
    const anim = this.anim;
    if (!f || !anim) return;
    const left = this.options.facing === 'left';
    this.sprite.texture = f.texture;
    const ax = left ? anim.width - anim.anchor.x : anim.anchor.x;
    this.sprite.position.set(
      Math.round(-ax + (left ? -f.dx : f.dx)),
      Math.round(-anim.anchor.y + f.dy),
    );
    this.sprite.alpha = f.alpha;
  }

  private load(name: ClipName): LoadedClip {
    const have = this.clips.get(name);
    if (have) return have;
    const anim = animateZorling(this.genome, {
      ...(this.options.size !== undefined ? { size: this.options.size } : {}),
      ...(this.options.fill !== undefined ? { fill: this.options.fill } : {}),
      ...(this.options.titan !== undefined ? { titan: this.options.titan } : {}),
      clips: [name],
    });
    this.anim ??= anim;
    const clip = anim.clips[name];
    const left = this.options.facing === 'left';
    const loaded: LoadedClip = {
      loop: clip?.loop ?? false,
      frames: (clip?.frames ?? []).map((f) => ({
        texture: pixelTexture(left ? flipX(f.sprite) : f.sprite),
        dx: f.dx,
        dy: f.dy,
        alpha: f.alpha,
        ms: f.ms,
      })),
    };
    this.clips.set(name, loaded);
    return loaded;
  }
}
