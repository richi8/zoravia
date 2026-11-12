import { h, type LabSection } from '../dom';

const upcoming = (id: string, title: string, chunk: string, what: string): LabSection => ({
  id,
  title,
  chunk,
  ready: false,
  render(el) {
    el.append(h('p', { class: 'note' }, `Coming in ${chunk}: ${what}`));
  },
});

export const upcomingSections: LabSection[] = [
  upcoming(
    'zorlings',
    'Zorling generator',
    'C08',
    'genome, 5 body plans, part library, 24-Zorling grid with seed/type/body controls.',
  ),
  upcoming(
    'animation',
    'Rig & animation',
    'C09',
    'idle/attack/hurt/faint, 3-stage lines, Titan and shiny variants.',
  ),
  upcoming(
    'ui-kit',
    'UI kit & battle mock',
    'C10',
    'HP/XP bars, type badges, condition icons, hotbar, menus, battle mock screen.',
  ),
  upcoming(
    'biomes',
    'Biome tiles & weather',
    'C11',
    'forest/lakes, volcanic desert, frozen coast tiles with weather.',
  ),
];
