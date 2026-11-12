import { flipX } from '@engine/render/sdf-sprite';
import { spriteToCanvas } from '@engine/render/sprite-canvas';
import { TYPE_IDS, typeColors, type TypeId } from '@game/style/tokens';
import {
  BODY_PLANS,
  MOODS,
  generateGenome,
  type BodyPlan,
  type Mood,
  type ZorlingGenome,
} from '@game/zorlings/genome';
import { renderZorling, SPRITE_SIZE } from '@game/zorlings/render';
import { h, type LabSection } from '../dom';

const GRID = 24;

interface Controls {
  seed: string;
  type: TypeId | 'any';
  plan: BodyPlan | 'any';
  mood: Mood | 'any';
}

function genomesFor(c: Controls): ZorlingGenome[] {
  return Array.from({ length: GRID }, (_, i) =>
    generateGenome(`${c.seed}:${i}`, {
      ...(c.type !== 'any' ? { type: c.type } : {}),
      ...(c.plan !== 'any' ? { plan: c.plan } : {}),
      ...(c.mood !== 'any' ? { mood: c.mood } : {}),
    }),
  );
}

const label = (g: ZorlingGenome): string =>
  `${g.plan} · ${g.mood} · ${g.types.map((t) => typeColors[t].label).join('/')}`;

function select<T extends string>(
  name: string,
  values: readonly T[],
  current: T,
  onChange: (v: T) => void,
  text: (v: T) => string = (v) => v,
): HTMLLabelElement {
  const el = h('select', { name });
  for (const v of values) {
    const opt = h('option', { value: v }, text(v));
    if (v === current) opt.selected = true;
    el.append(opt);
  }
  el.addEventListener('change', () => onChange(el.value as T));
  return h('label', { class: 'zl-field' }, name, el);
}

/** C08: the Zorling generator — 24 random Zorlings, controls, and a detail view. */
export const zorlingsSection: LabSection = {
  id: 'zorlings',
  title: 'Zorling generator',
  chunk: 'C08',
  ready: true,
  render(el) {
    const c: Controls = { seed: 'zoravia', type: 'any', plan: 'any', mood: 'any' };
    const grid = h('div', { class: 'zl-grid', role: 'list' });
    const detail = h('div', { class: 'zl-detail', 'aria-live': 'polite' });

    const show = (g: ZorlingGenome): void => {
      const battle = renderZorling(g, { size: SPRITE_SIZE.battle });
      const over = renderZorling(g, { size: SPRITE_SIZE.overworld });
      detail.replaceChildren(
        h(
          'div',
          { class: 'zl-stage' },
          h('figure', {}, spriteToCanvas(battle, 3), h('figcaption', {}, '96×96 battle · ×3')),
          h(
            'figure',
            {},
            spriteToCanvas(flipX(battle), 3),
            h('figcaption', {}, 'flipped (enemy side)'),
          ),
          h('figure', {}, spriteToCanvas(over, 3), h('figcaption', {}, '32×32 overworld · ×3')),
          h('figure', {}, spriteToCanvas(over, 1), h('figcaption', {}, '32×32 · ×1')),
        ),
        h('h3', {}, label(g)),
        h(
          'pre',
          { class: 'zl-json' },
          JSON.stringify(
            g,
            (_k, v: unknown) =>
              typeof v === 'number' && v > 255 && v <= 0xffffff && _k !== 'seed'
                ? `#${v.toString(16).padStart(6, '0')}`
                : v,
            2,
          ),
        ),
      );
    };

    const refresh = (): void => {
      const genomes = genomesFor(c);
      grid.replaceChildren(
        ...genomes.map((g, i) => {
          const card = h(
            'button',
            {
              class: 'zl-card',
              type: 'button',
              role: 'listitem',
              'aria-label': `Zorling ${i + 1}: ${label(g)}`,
            },
            spriteToCanvas(renderZorling(g), 2),
            h('span', { class: 'zl-small' }, spriteToCanvas(renderZorling(g, { size: 32 }), 2)),
            h('span', { class: 'zl-label' }, label(g)),
          );
          card.addEventListener('click', () => {
            for (const other of grid.querySelectorAll('.zl-card'))
              other.classList.remove('selected');
            card.classList.add('selected');
            show(g);
          });
          return card;
        }),
      );
      const first = genomes[0];
      if (first) show(first);
    };

    const seedInput = h('input', { name: 'seed', value: c.seed, spellcheck: false });
    seedInput.addEventListener('change', () => {
      c.seed = seedInput.value.trim() || 'zoravia';
      refresh();
    });
    const randomize = h('button', { type: 'button', class: 'zl-button' }, 'Randomize');
    randomize.addEventListener('click', () => {
      c.seed = Math.floor(Math.random() * 1e9).toString(36);
      seedInput.value = c.seed;
      refresh();
    });

    el.append(
      h(
        'p',
        { class: 'lead' },
        'Every Zorling below is generated from a small genome (body plan, parts, palette, seed): ' +
          'shapes are built in code, rasterized straight to pixels with flat shading bands and ' +
          'outlines (src/game/zorlings/). Same genome → same pixels. Pick one to inspect it.',
      ),
      h(
        'div',
        { class: 'zl-controls' },
        h('label', { class: 'zl-field' }, 'seed', seedInput),
        select(
          'type',
          ['any', ...TYPE_IDS] as const,
          c.type,
          (v) => {
            c.type = v;
            refresh();
          },
          (v) => (v === 'any' ? 'any' : typeColors[v].label),
        ),
        select('body plan', ['any', ...BODY_PLANS] as const, c.plan, (v) => {
          c.plan = v;
          refresh();
        }),
        select('mood', ['any', ...MOODS] as const, c.mood, (v) => {
          c.mood = v;
          refresh();
        }),
        randomize,
      ),
      grid,
      detail,
    );
    refresh();
  },
};
