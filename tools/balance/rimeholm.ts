/**
 * Rimeholm's campaign as the playthrough simulator walks it (C35): the zones each part opens,
 * the shops on the way and the story fights in the order a player meets them. Fights in a sleet
 * storm start with both Zorlings Wet, as in the game (`rimeholm.test.ts` checks that the storms
 * here match the zones the NPCs stand in).
 */

import { starts, STARTER_FLAGS } from '../../packs/rimeholm/starts';
import type { Goal, PlaythroughSetup, RouteStage } from './playthrough';

const r = (local: string): string => `rimeholm:${local}`;
const c = (local: string): string => `core:${local}`;
const SLEET = ['core:wet'] as const;
const t = (id: string, opts: { badge?: string; storm?: boolean } = {}): Goal => ({
  trainer: r(id),
  ...(opts.badge ? { badge: r(opts.badge) } : {}),
  ...(opts.storm ? { weather: SLEET } : {}),
});
const boss = (id: string, storm = false): Goal => ({
  boss: r(id),
  ...(storm ? { weather: SLEET } : {}),
});

export const RIMEHOLM_ROUTE: readonly RouteStage[] = [
  {
    name: 'Shingle Shore',
    zones: ['shingle'],
    shop: [c('potion'), c('zorb')],
    goals: [t('beachcomber-tilde')],
  },
  {
    name: 'Hoarfrost Heath & west road',
    zones: ['heath'],
    goals: [t('mira-brinewick'), t('shepherd-arne')],
  },
  { name: 'Driftwood Strand', zones: ['strand'], goals: [t('netter-yrsa')] },
  {
    name: 'Tide Trial',
    zones: [],
    shop: [c('super-potion'), c('max-potion')],
    goals: [
      t('deckhand-pell'),
      t('tidemaster-sigrun', { badge: 'tide-badge' }),
      t('mira-glimmerholm'),
    ],
  },
  {
    name: 'Sleet Fells & Kelp Shallows',
    zones: ['sleet-fells', 'kelp'],
    goals: [t('herder-eskil', { storm: true }), boss('floemaw-titan', true), t('diver-signe')],
  },
  {
    name: 'Thunder Bluffs, Squall Reach, Frostfen',
    zones: ['thunder-bluffs', 'squall-reach', 'frostfen'],
    goals: [
      t('stormchaser-bjorn'),
      boss('squallwing-titan'),
      t('skater-freya', { storm: true }),
      t('trapper-knud'),
    ],
  },
  { name: 'Rimeport', zones: [], goals: [t('mira-rimeport')] },
  {
    name: 'Shoals, Glacier Steps, White Crown',
    zones: ['shoals', 'glacier', 'crown'],
    goals: [
      t('wreck-diver-oskar'),
      t('lampwright-odessa'),
      t('climber-hedda'),
      t('ace-runa', { storm: true }),
    ],
  },
  { name: 'Crown Shrine', zones: [], goals: [boss('glacivar', true)] },
];

/** Team plans: each starter with two wild Zorlings from the first zones. */
export const RIMEHOLM_TEAMS: readonly Pick<PlaythroughSetup, 'starter' | 'catches' | 'flags'>[] = [
  {
    starter: r('selkit'),
    catches: [r('flurret'), r('spinzap')],
    flags: { [STARTER_FLAGS.selkit]: 1 },
  },
  {
    starter: r('woolump'),
    catches: [r('tuskit'), r('spinzap')],
    flags: { [STARTER_FLAGS.woolump]: 1 },
  },
  {
    starter: r('sparkit'),
    catches: [r('flurret'), r('kelpling')],
    flags: { [STARTER_FLAGS.sparkit]: 1 },
  },
];

/** The real Rimeholm start (`packs/rimeholm/starts.ts`): one Lv 6 starter, a few items. */
export const RIMEHOLM_START = {
  starterLevel: starts.rimeholm.level,
  bag: starts.rimeholm.bag,
  money: starts.rimeholm.money,
} as const;
