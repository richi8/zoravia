import { pixelateSvg } from '@engine/render/pixelate';
import { LOGO_PIXEL_OPTIONS, logoSvg } from '@game/brand/logo';
import { h, svg, type LabSection } from '../dom';

/** A pixel-art rendering of the logo, `width` game pixels wide, scaled up crisply. */
function pixelFigure(
  cls: string,
  width: number,
  caption: string,
  crop: 'full' | 'emblem' = 'full',
): HTMLElement {
  const fig = h('figure', { class: `logo-card ${cls} pixel` }, h('figcaption', {}, caption));
  void pixelateSvg(
    logoSvg({ crop, id: `px-${cls}-${width}-${crop}` }),
    width,
    LOGO_PIXEL_OPTIONS,
  ).then((canvas) => fig.prepend(canvas));
  return fig;
}

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
        'Dragon crest, generated in code (src/game/brand/logo.ts) and shown as pixel art: ' +
          'rendered small, snapped to the logo palette, with a scale texture on the body. ' +
          'Concept from the review; we will come back to it.',
      ),
      h(
        'div',
        { class: 'logo-row' },
        pixelFigure('dark', 400, 'Pixel art · 400 px wide · night'),
        pixelFigure('light', 400, 'Pixel art · 400 px wide · light'),
      ),
      h(
        'div',
        { class: 'logo-row' },
        pixelFigure('dark', 260, 'Pixel art · 260 px wide (small)'),
        h(
          'figure',
          { class: 'logo-card light' },
          svg(logoSvg({ id: 'lab-smooth' })),
          h('figcaption', {}, 'Smooth source (before pixelating)'),
        ),
      ),
      h('h3', {}, 'Emblem (favicon)'),
      h(
        'div',
        { class: 'emblem-row' },
        ...[128, 64, 32, 16].map((size) =>
          h(
            'figure',
            { class: 'emblem' },
            svg(logoSvg({ crop: 'emblem', height: size, id: `lab-emblem-${size}` })),
            h('figcaption', {}, `${size}px`),
          ),
        ),
        pixelFigure('dark emblem-px', 32, 'pixel, 32 px', 'emblem'),
      ),
      h('p', { class: 'note' }, 'The head crop is the favicon of the game and the lab.'),
    );
  },
};
