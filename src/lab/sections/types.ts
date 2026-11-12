import { toCss } from '@engine/core/color';
import { CONDITION_IDS, TYPE_IDS, conditionColors, typeColors } from '@game/style/tokens';
import { h, type LabSection } from '../dom';

export const typesSection: LabSection = {
  id: 'types',
  title: 'Type colors',
  chunk: 'C07',
  ready: true,
  render(el) {
    el.append(
      h(
        'p',
        { class: 'lead' },
        'The 8 types. Every pair is ≥ 20 ΔE apart (unit-tested), and badges always carry the type name, never color alone.',
      ),
      h(
        'div',
        { class: 'badges' },
        ...TYPE_IDS.map((id) => {
          const t = typeColors[id];
          return h(
            'span',
            { class: 'badge', style: `background:${toCss(t.base)};color:${toCss(t.on)}` },
            t.label.toUpperCase(),
          );
        }),
      ),
      h(
        'div',
        { class: 'type-cards' },
        ...TYPE_IDS.map((id) => {
          const t = typeColors[id];
          return h(
            'div',
            { class: 'type-card', style: `--c:${toCss(t.base)}` },
            h('div', { class: 'type-orb' }),
            h('strong', {}, t.label),
            h('code', {}, toCss(t.base)),
          );
        }),
      ),
    );
  },
};

export const conditionsSection: LabSection = {
  id: 'conditions',
  title: 'Condition colors',
  chunk: 'C07',
  ready: true,
  render(el) {
    el.append(
      h(
        'p',
        { class: 'lead' },
        'One condition per type (DESIGN.md "Conditions & reactions"). Icons come in C10; colors are related to, but distinct from, the type that applies them.',
      ),
      h(
        'div',
        { class: 'cond-grid' },
        ...CONDITION_IDS.map((id) => {
          const c = conditionColors[id];
          const t = typeColors[c.type];
          return h(
            'div',
            { class: 'cond' },
            h(
              'span',
              { class: 'cond-chip', style: `background:${toCss(c.color)};color:${toCss(c.on)}` },
              c.label,
            ),
            h(
              'span',
              { class: 'cond-from' },
              'from ',
              h('span', { class: 'dot', style: `background:${toCss(t.base)}` }),
              t.label,
            ),
            h('code', {}, toCss(c.color)),
          );
        }),
      ),
    );
  },
};
