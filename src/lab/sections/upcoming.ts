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
    'biomes',
    'Biome tiles & weather',
    'C11',
    'forest/lakes, volcanic desert, frozen coast tiles with weather.',
  ),
];
