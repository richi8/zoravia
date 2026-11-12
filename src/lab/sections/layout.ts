import { borderWidth, radius, space } from '@game/style/tokens';
import { h, type LabSection } from '../dom';

export const layoutSection: LabSection = {
  id: 'layout',
  title: 'Spacing, radii, borders',
  chunk: 'C07',
  ready: true,
  render(el) {
    el.append(
      h('h3', {}, 'Spacing'),
      h(
        'div',
        { class: 'scale' },
        ...Object.entries(space).map(([k, v]) =>
          h(
            'div',
            { class: 'scale-row' },
            h('code', {}, `${k} · ${v}px`),
            h('span', { class: 'space-bar', style: `width:${v}px` }),
          ),
        ),
      ),
      h('h3', {}, 'Radii'),
      h(
        'div',
        { class: 'radii' },
        ...Object.entries(radius).map(([k, v]) =>
          h(
            'div',
            { class: 'radius-box', style: `border-radius:${Math.min(v, 48)}px` },
            h('code', {}, `${k} · ${v}`),
          ),
        ),
      ),
      h('h3', {}, 'Borders'),
      h(
        'div',
        { class: 'radii' },
        ...Object.entries(borderWidth).map(([k, v]) =>
          h(
            'div',
            { class: 'radius-box', style: `border-width:${v}px` },
            h('code', {}, `${k} · ${v}px`),
          ),
        ),
      ),
    );
  },
};
