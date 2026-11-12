import { emblemSvg, logoSvg } from '@game/brand/logo';
import { h, svg, type LabSection } from '../dom';

export const brandSection: LabSection = {
  id: 'brand',
  title: 'Brand & logo',
  chunk: 'C07',
  ready: true,
  render(el) {
    el.append(
      h(
        'p',
        { class: 'lead' },
        'Wordmark built from stroke geometry in code (no font files). The O is the emblem: ' +
          'three petals for the three launch regions — forest-lake teal-green, volcanic ember, ' +
          'frozen-coast ice.',
      ),
      h(
        'div',
        { class: 'logo-row' },
        h(
          'figure',
          { class: 'logo-card dark' },
          svg(logoSvg({ variant: 'dark' })),
          h('figcaption', {}, 'Dark variant — for dark backgrounds (game default)'),
        ),
        h(
          'figure',
          { class: 'logo-card light' },
          svg(logoSvg({ variant: 'light' })),
          h('figcaption', {}, 'Light variant — for light backgrounds'),
        ),
      ),
      h('h3', {}, 'Emblem'),
      h(
        'div',
        { class: 'emblem-row' },
        ...[128, 64, 32, 16].map((size) =>
          h(
            'figure',
            { class: 'emblem' },
            svg(emblemSvg({ size })),
            h('figcaption', {}, `${size}px`),
          ),
        ),
        h(
          'figure',
          { class: 'emblem light' },
          svg(emblemSvg({ size: 64, variant: 'light' })),
          h('figcaption', {}, 'light, 64px'),
        ),
      ),
      h('p', { class: 'note' }, 'The 16/32px emblem is the favicon of the game and the lab.'),
    );
  },
};
