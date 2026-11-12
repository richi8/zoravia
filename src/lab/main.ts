/**
 * Style lab (`/lab/`): a living reference of the game's look. Each section is a module in
 * `sections/`; later Phase 1 chunks fill in the "coming" ones. Sections render lazily the
 * first time they scroll near the viewport.
 */

import { installFavicon, logoSvg } from '@game/brand/logo';
import { installCssVars } from '@game/style/css';
import { loadFonts } from '@game/style/fonts';
import { h, svg, type LabSection } from './dom';
import './lab.css';
import { brandSection } from './sections/brand';
import { layoutSection } from './sections/layout';
import { motionSection } from './sections/motion';
import { paletteSection } from './sections/palette';
import { conditionsSection, typesSection } from './sections/types';
import { typographySection } from './sections/typography';
import { uiThemeSection } from './sections/ui-theme';
import { upcomingSections } from './sections/upcoming';
import { animationSection } from './sections/animation';
import { zorlingsSection } from './sections/zorlings';

const SECTIONS: LabSection[] = [
  brandSection,
  paletteSection,
  typesSection,
  conditionsSection,
  typographySection,
  layoutSection,
  motionSection,
  uiThemeSection,
  zorlingsSection,
  animationSection,
  ...upcomingSections,
];

async function main(): Promise<void> {
  const root = document.getElementById('lab');
  if (!root) throw new Error('#lab element missing');
  installCssVars();
  installFavicon();
  await loadFonts();

  const nav = h(
    'nav',
    { class: 'lab-nav', 'aria-label': 'Sections' },
    ...SECTIONS.map((s) =>
      h(
        'a',
        { href: `#${s.id}`, class: s.ready ? '' : 'pending', 'data-id': s.id },
        s.title,
        h('span', { class: 'tag' }, s.chunk),
      ),
    ),
  );
  const main = h('main', { class: 'lab-main' });
  root.append(
    h(
      'header',
      { class: 'lab-header' },
      h(
        'a',
        { href: '#brand', class: 'lab-logo', 'aria-label': 'Zoravia' },
        svg(logoSvg({ id: 'lab-header' })),
      ),
      h('span', { class: 'lab-title' }, 'Style lab'),
      h('a', { href: '../', class: 'lab-game-link' }, 'Open game →'),
    ),
    h('div', { class: 'lab-body' }, nav, main),
  );

  const observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        const section = SECTIONS.find((s) => s.id === el.id);
        observer.unobserve(el);
        const body = el.querySelector<HTMLElement>('.section-body');
        if (section && body) section.render(body);
      }
    },
    { rootMargin: '400px 0px' },
  );

  for (const s of SECTIONS) {
    const el = h(
      'section',
      { id: s.id, class: s.ready ? 'lab-section' : 'lab-section pending' },
      h('h2', {}, s.title, h('span', { class: 'tag' }, s.chunk)),
      h('div', { class: 'section-body' }),
    );
    main.append(el);
    observer.observe(el);
  }

  // Highlight the nav entry of the section in view.
  const links = new Map(
    [...nav.querySelectorAll<HTMLAnchorElement>('a')].map((a) => [a.dataset.id, a]),
  );
  const spy = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          for (const a of links.values()) a.classList.remove('current');
          links.get(e.target.id)?.classList.add('current');
        }
      }
    },
    { rootMargin: '-30% 0px -60% 0px' },
  );
  for (const el of main.querySelectorAll('section')) spy.observe(el);

  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}

main().catch((err: unknown) => console.error(err));
