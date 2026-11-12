import { fontSize, fontWeight, fonts } from '@game/style/tokens';
import { h, type LabSection } from '../dom';

export const typographySection: LabSection = {
  id: 'typography',
  title: 'Typography',
  chunk: 'C07',
  ready: true,
  render(el) {
    const specimen = (
      label: string,
      family: string,
      sample: string,
      size: number,
      weight: number,
    ): HTMLElement =>
      h(
        'div',
        { class: 'specimen' },
        h('div', { class: 'specimen-label' }, label),
        h(
          'div',
          {
            style: `font-family:${family};font-size:${size}px;font-weight:${weight};line-height:1.2`,
          },
          sample,
        ),
      );
    el.append(
      h(
        'p',
        { class: 'lead' },
        'Fredoka (display) and Nunito (UI) — both SIL OFL, bundled with the build (no CDN). Rounded and friendly to match the light tone; Nunito stays readable at small sizes.',
      ),
      specimen(
        'Display · Fredoka 700 · hero',
        fonts.display,
        'Zorlings await!',
        fontSize.hero,
        700,
      ),
      specimen('Display · Fredoka 600 · 3xl', fonts.display, 'Wildfire! ×2', fontSize['3xl'], 600),
      specimen(
        'Display · Fredoka 500 · 2xl',
        fonts.display,
        'Route 3 — Mistwood Lake',
        fontSize['2xl'],
        500,
      ),
      specimen(
        'UI · Nunito 800 · xl',
        fonts.ui,
        'Fight   Switch   Items   Run',
        fontSize.xl,
        fontWeight.black,
      ),
      specimen(
        'UI · Nunito 400 · lg (menus & dialog)',
        fonts.ui,
        'The wild Emberfox is Burning! Water moves will cause a Steam Burst.',
        fontSize.lg,
        fontWeight.regular,
      ),
      specimen(
        'UI · Nunito 600 · md',
        fonts.ui,
        'Power 60 · Accuracy 95% · Applies Wet',
        fontSize.md,
        fontWeight.semibold,
      ),
      specimen(
        'UI · Nunito 400 · sm',
        fonts.ui,
        'Hold E to speed up text. Q goes back.',
        fontSize.sm,
        fontWeight.regular,
      ),
      specimen(
        'UI · Nunito 700 · xs',
        fonts.ui,
        'LV 12 · HP 48/52 · ÁÉÍÓÚ čřšžý',
        fontSize.xs,
        fontWeight.bold,
      ),
      specimen('Mono · debug', fonts.mono, 'FPS 60.0 · 16.67 ms', fontSize.sm, 400),
      h('h3', {}, 'Size scale'),
      h(
        'div',
        { class: 'scale' },
        ...Object.entries(fontSize).map(([k, v]) =>
          h(
            'div',
            { class: 'scale-row' },
            h('code', {}, `${k} · ${v}px`),
            h('span', { style: `font-family:${fonts.ui};font-size:${v}px` }, 'Zoravia'),
          ),
        ),
      ),
    );
  },
};
