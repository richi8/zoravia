/**
 * Test moves: 2–3 per type, status moves for Fire, Water, Nature and Ice, and the test
 * bosses' signature moves.
 */

import type { MoveInput } from '@game/data';

const t = (type: string): string => `core:${type}`;

export const moves = {
  ember: { name: 'Ember', type: t('fire'), power: 40, accuracy: 100, applyChance: 0.3 },
  'flame-pounce': {
    name: 'Flame Pounce',
    type: t('fire'),
    power: 65,
    accuracy: 95,
    applyChance: 0.2,
  },
  kindle: {
    name: 'Kindle',
    description: 'Sets the target Burning.',
    type: t('fire'),
    power: 0,
    accuracy: 90,
    applyChance: 1,
  },
  'splash-shot': {
    name: 'Splash Shot',
    type: t('water'),
    power: 40,
    accuracy: 100,
    applyChance: 0.3,
  },
  'tide-crash': { name: 'Tide Crash', type: t('water'), power: 70, accuracy: 90, applyChance: 0.2 },
  drench: {
    name: 'Drench',
    description: 'Soaks the target: Wet.',
    type: t('water'),
    power: 0,
    accuracy: 95,
    applyChance: 1,
  },
  'vine-snap': { name: 'Vine Snap', type: t('nature'), power: 45, accuracy: 100, applyChance: 0.3 },
  'thorn-volley': {
    name: 'Thorn Volley',
    type: t('nature'),
    power: 65,
    accuracy: 95,
    applyChance: 0.2,
  },
  'spore-cloud': {
    name: 'Spore Cloud',
    description: 'Seeds the target: Overgrown.',
    type: t('nature'),
    power: 0,
    accuracy: 90,
    applyChance: 1,
  },
  'static-bite': {
    name: 'Static Bite',
    type: t('electric'),
    power: 45,
    accuracy: 100,
    applyChance: 0.3,
  },
  'static-field': {
    name: 'Static Field',
    description: 'Fills the air with sparks: Charged.',
    type: t('electric'),
    power: 0,
    accuracy: 90,
    applyChance: 1,
  },
  'volt-lash': {
    name: 'Volt Lash',
    type: t('electric'),
    power: 70,
    accuracy: 90,
    applyChance: 0.2,
  },
  'cold-snap': {
    name: 'Cold Snap',
    description: 'A blast of cold air: Chilled.',
    type: t('ice'),
    power: 0,
    accuracy: 90,
    applyChance: 1,
  },
  whiteout: {
    name: 'Whiteout',
    description: 'Glacivar’s signature move.',
    type: t('ice'),
    power: 80,
    accuracy: 90,
    applyChance: 0.3,
  },
  'frost-fang': { name: 'Frost Fang', type: t('ice'), power: 45, accuracy: 95, applyChance: 0.3 },
  'hail-dash': { name: 'Hail Dash', type: t('ice'), power: 65, accuracy: 95, applyChance: 0.2 },
  'mud-toss': { name: 'Mud Toss', type: t('earth'), power: 40, accuracy: 90, applyChance: 0.5 },
  'rock-slam': { name: 'Rock Slam', type: t('earth'), power: 70, accuracy: 90, applyChance: 0.2 },
  gust: { name: 'Gust', type: t('wind'), power: 40, accuracy: 100, applyChance: 0.3 },
  'wing-cut': { name: 'Wing Cut', type: t('wind'), power: 55, accuracy: 100, applyChance: 0.2 },
  'gale-dash': { name: 'Gale Dash', type: t('wind'), power: 65, accuracy: 95, applyChance: 0.2 },
  'iron-bash': { name: 'Iron Bash', type: t('metal'), power: 45, accuracy: 100, applyChance: 0.3 },
  'bramble-gale': {
    name: 'Bramble Gale',
    description: 'The Thornwing Titan’s signature move.',
    type: t('wind'),
    power: 80,
    accuracy: 90,
    applyChance: 0.3,
  },
  'steel-claw': { name: 'Steel Claw', type: t('metal'), power: 65, accuracy: 95, applyChance: 0.2 },
} satisfies Record<string, MoveInput>;
