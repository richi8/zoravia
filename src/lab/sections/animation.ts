import { mix, toCss } from '@engine/core/color';
import { spriteToCanvas } from '@engine/render/sprite-canvas';
import { TYPE_IDS, typeColors, type TypeId } from '@game/style/tokens';
import {
  animateZorling,
  type AnimateOptions,
  type ClipName,
  type ZorlingAnimation,
} from '@game/zorlings/animate';
import {
  BODY_PLANS,
  generateGenome,
  type BodyPlan,
  type ZorlingGenome,
} from '@game/zorlings/genome';
import { SPRITE_SIZE } from '@game/zorlings/render';
import {
  stageFill,
  stageGenome,
  stageGrowth,
  titanGenome,
  type StageCount,
} from '@game/zorlings/variants';
import { h, type LabSection } from '../dom';

const SCALE = 2;
const GROUND = 4;

interface Controls {
  seed: string;
  type: TypeId;
  plan: BodyPlan;
  stages: StageCount;
}

/** One animated Zorling on its own canvas; clips are rendered lazily and cached. */
class Player {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly cache = new Map<
    ClipName,
    { anim: ZorlingAnimation; frames: HTMLCanvasElement[] }
  >();
  private clip: ClipName = 'idle';
  private index = 0;
  private time = 0;
  private hold = 0;
  private readonly box: number;

  constructor(
    private readonly genome: ZorlingGenome,
    private readonly options: AnimateOptions,
    size: number,
  ) {
    this.box = Math.round(size * 1.5);
    this.canvas = h('canvas', { width: this.box, height: this.box });
    this.canvas.style.width = `${this.box * SCALE}px`;
    this.canvas.style.height = `${this.box * SCALE}px`;
    this.canvas.style.imageRendering = 'pixelated';
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas not available');
    this.ctx = ctx;
    this.load('idle');
  }

  private load(name: ClipName): { anim: ZorlingAnimation; frames: HTMLCanvasElement[] } {
    let c = this.cache.get(name);
    if (!c) {
      const anim = animateZorling(this.genome, { ...this.options, clips: [name] });
      const frames = (anim.clips[name]?.frames ?? []).map((f) => spriteToCanvas(f.sprite));
      c = { anim, frames };
      this.cache.set(name, c);
    }
    return c;
  }

  play(name: ClipName): void {
    this.load(name);
    this.clip = name;
    this.index = 0;
    this.time = 0;
    this.hold = 0;
  }

  update(dt: number): void {
    const { anim } = this.load(this.clip);
    const frames = anim.clips[this.clip]?.frames ?? [];
    if (this.hold > 0) {
      this.hold -= dt;
      if (this.hold <= 0) this.play('idle');
    } else {
      this.time += dt;
      while (frames[this.index] && this.time >= (frames[this.index]?.ms ?? 100)) {
        this.time -= frames[this.index]?.ms ?? 100;
        this.index++;
        if (this.index < frames.length) continue;
        if (this.clip === 'idle') this.index = 0;
        else if (this.clip === 'faint') {
          this.index = frames.length - 1;
          this.hold = 1200;
          break;
        } else {
          this.play('idle');
          return this.draw();
        }
      }
    }
    this.draw();
  }

  private draw(): void {
    const { anim, frames: canvases } = this.load(this.clip);
    const frame = anim.clips[this.clip]?.frames[this.index];
    const img = canvases[this.index];
    const { ctx, box } = this;
    ctx.clearRect(0, 0, box, box);
    ctx.fillStyle = toCss(mix(typeColors[this.genome.types[0]].base, 0x10122a, 0.7));
    ctx.fillRect(0, box - GROUND, box, GROUND);
    if (!frame || !img) return;
    ctx.globalAlpha = frame.alpha;
    ctx.drawImage(
      img,
      Math.round(box / 2 - anim.anchor.x) + frame.dx,
      box - GROUND - anim.anchor.y + frame.dy,
    );
    ctx.globalAlpha = 1;
  }
}

function select<T extends string | number>(
  name: string,
  values: readonly T[],
  current: T,
  onChange: (v: T) => void,
  text: (v: T) => string = String,
): HTMLLabelElement {
  const el = h('select', { name });
  values.forEach((v, i) => {
    const opt = h('option', { value: String(i) }, text(v));
    if (v === current) opt.selected = true;
    el.append(opt);
  });
  el.addEventListener('change', () => {
    const v = values[Number(el.value)];
    if (v !== undefined) onChange(v);
  });
  return h('label', { class: 'zl-field' }, name, el);
}

/** C09: rigged animation, evolution stages and the Titan variant. */
export const animationSection: LabSection = {
  id: 'animation',
  title: 'Rig & animation',
  chunk: 'C09',
  ready: true,
  render(el) {
    const c: Controls = { seed: 'zoravia', type: 'fire', plan: 'quadruped', stages: 3 };
    const stage = h('div', { class: 'za-stage' });
    let players: Player[] = [];

    const refresh = (): void => {
      const g = generateGenome(c.seed, { plan: c.plan, type: c.type });
      players = [];
      const figures: HTMLElement[] = [];
      const add = (p: Player, caption: string): void => {
        players.push(p);
        figures.push(h('figure', {}, p.canvas, h('figcaption', {}, caption)));
      };
      for (let s = 1; s <= c.stages; s++) {
        const fill = stageFill(stageGrowth(s, c.stages));
        add(
          new Player(stageGenome(g, s, c.stages), { fill }, SPRITE_SIZE.battle),
          `stage ${s} of ${c.stages}`,
        );
      }
      add(new Player(titanGenome(g), { titan: true }, 128), 'Titan · 128×128');
      add(new Player(g, { size: SPRITE_SIZE.overworld }, SPRITE_SIZE.overworld), 'overworld · 32');
      stage.replaceChildren(...figures);
    };

    const clipButtons = (['idle', 'attack', 'hurt', 'faint'] as const).map((name) => {
      const b = h('button', { type: 'button', class: 'zl-button' }, name);
      b.addEventListener('click', () => {
        for (const p of players) p.play(name);
      });
      return b;
    });

    const seedInput = h('input', { name: 'seed', value: c.seed, spellcheck: false });
    seedInput.addEventListener('change', () => {
      c.seed = seedInput.value.trim() || 'zoravia';
      refresh();
    });

    el.append(
      h(
        'p',
        { class: 'lead' },
        'Each frame is a rig pose (body, head, tail, wing bones) rasterized fresh to pixels ' +
          '(src/game/zorlings/animate.ts). Evolution stages are derived from the final form’s ' +
          'genome; the Titan is bulkier, 128×128, with a pulsing aura in its type color.',
      ),
      h(
        'div',
        { class: 'zl-controls' },
        h('label', { class: 'zl-field' }, 'seed', seedInput),
        select(
          'type',
          TYPE_IDS,
          c.type,
          (v) => {
            c.type = v;
            refresh();
          },
          (v) => typeColors[v].label,
        ),
        select('body plan', BODY_PLANS, c.plan, (v) => {
          c.plan = v;
          refresh();
        }),
        select('stages', [1, 2, 3] as const, c.stages, (v) => {
          c.stages = v;
          refresh();
        }),
        ...clipButtons,
      ),
      stage,
    );
    refresh();

    let last = performance.now();
    const tick = (now: number): void => {
      const dt = Math.min(100, now - last);
      last = now;
      if (el.isConnected) for (const p of players) p.update(dt);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },
};
