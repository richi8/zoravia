import { contrastRatio, toCss } from '@engine/core/color';
import { brand, ink, semantic, surface } from '@game/style/tokens';
import { h, type LabSection } from '../dom';

function swatch(name: string, color: number, against = surface.background): HTMLElement {
  const ratio = contrastRatio(color, against);
  return h(
    'div',
    { class: 'swatch' },
    h('div', { class: 'chip', style: `background:${toCss(color)}` }),
    h('div', { class: 'swatch-name' }, name),
    h('code', {}, toCss(color)),
    h(
      'span',
      { class: 'ratio', title: 'Contrast against the page background' },
      `${ratio.toFixed(1)}:1`,
    ),
  );
}

function group(title: string, entries: [string, number][]): HTMLElement {
  return h(
    'div',
    {},
    h('h3', {}, title),
    h('div', { class: 'swatches' }, ...entries.map(([n, c]) => swatch(n, c))),
  );
}

function textSample(name: string, fg: number, bg: number): HTMLElement {
  const ratio = contrastRatio(fg, bg);
  const grade = ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA large' : 'fail';
  return h(
    'div',
    { class: 'text-sample', style: `background:${toCss(bg)};color:${toCss(fg)}` },
    h('strong', {}, name),
    ` ${ratio.toFixed(1)}:1 · ${grade}`,
  );
}

export const paletteSection: LabSection = {
  id: 'palette',
  title: 'Palette',
  chunk: 'C07',
  ready: true,
  render(el) {
    el.append(
      h(
        'p',
        { class: 'lead' },
        'Ratios are WCAG contrast against the page background. Text pairs below are checked by unit tests (≥ 4.5:1).',
      ),
      group(
        'Ink (neutrals)',
        Object.entries(ink)
          .sort((a, b) => Number(b[0]) - Number(a[0]))
          .map(([k, v]) => [`ink ${k}`, v]),
      ),
      group('Brand', Object.entries(brand)),
      group('Semantic', Object.entries(semantic)),
      group('Surfaces', Object.entries(surface)),
      h('h3', {}, 'Text on surfaces'),
      h(
        'div',
        { class: 'text-samples' },
        textSample('Text on base', surface.text, surface.base),
        textSample('Dim text on base', surface.textDim, surface.base),
        textSample('Text on raised', surface.text, surface.raised),
        textSample('Cursor text', surface.cursorText, surface.cursorBg),
        textSample('Title (sunbeam) on base', brand.sunbeam, surface.base),
        textSample('Disabled on base', surface.textDisabled, surface.base),
      ),
    );
  },
};
