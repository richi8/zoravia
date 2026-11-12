import { GAME_TITLE } from '@game/index';

const root = document.getElementById('app');
if (root) {
  root.dataset['title'] = GAME_TITLE;
}
document.title = GAME_TITLE;
