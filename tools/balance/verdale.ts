/**
 * Verdale's campaign as the playthrough simulator walks it (C31): the zones each part opens,
 * the shops on the way and the story fights in the order a player meets them.
 */

import { starts, STARTER_FLAGS } from '../../packs/core/starts';
import type { RouteStage, PlaythroughSetup } from './playthrough';

const c = (local: string): string => `core:${local}`;
const t = (id: string, badge?: string) => ({
  trainer: c(id),
  ...(badge ? { badge: c(badge) } : {}),
});
const boss = (id: string) => ({ boss: c(id) });

export const VERDALE_ROUTE: readonly RouteStage[] = [
  {
    name: 'Willowmere meadow',
    zones: ['meadow'],
    shop: [c('potion'), c('zorb')],
    goals: [t('picnicker-nell')],
  },
  {
    name: 'Lakeshore & north road',
    zones: ['willow-shore'],
    goals: [t('mira-willowmere'), t('fisher-dot')],
  },
  { name: 'Brookside Trail', zones: ['brookside'], goals: [t('hiker-brann')] },
  {
    name: 'Grove Trial',
    zones: [],
    shop: [c('super-potion'), c('max-potion')],
    goals: [t('apprentice-linden'), t('warden-elm', 'grove-badge'), t('mira-fernhollow')],
  },
  {
    name: 'Marsh, Fernwood, Bramble',
    zones: ['reedmarsh', 'fernwood', 'bramble'],
    goals: [t('marsh-guide-tess'), boss('bogmaw-titan'), t('forager-juno'), t('scout-fen')],
  },
  {
    name: 'Deepwood & Downs',
    zones: ['deepwood', 'downs'],
    goals: [t('ranger-holt'), t('birder-wren'), boss('mossback-titan')],
  },
  { name: 'Galecrest', zones: [], goals: [t('mira-galecrest')] },
  {
    name: 'Mistmere, Old Grove, Galeback',
    zones: ['mistmere', 'oldgrove', 'galeback'],
    goals: [t('mystic-sora'), t('druid-ash'), t('ace-lyra'), t('stormcatcher-vex')],
  },
  { name: 'Heartwood Shrine', zones: [], goals: [boss('verdion')] },
];

/** Team plans: each starter with two wild Zorlings from the first zones. */
export const VERDALE_TEAMS: readonly Pick<PlaythroughSetup, 'starter' | 'catches' | 'flags'>[] = [
  {
    starter: c('sprigling'),
    catches: [c('pipwing'), c('puddlit')],
    flags: { [STARTER_FLAGS.sprigling]: 1 },
  },
  {
    starter: c('drizzlet'),
    catches: [c('sproutle'), c('hearthog')],
    flags: { [STARTER_FLAGS.drizzlet]: 1 },
  },
  {
    starter: c('emberkit'),
    catches: [c('sproutle'), c('mudpaddle')],
    flags: { [STARTER_FLAGS.emberkit]: 1 },
  },
];

/** The real Verdale start (C33, `packs/core/starts.ts`): one Lv 6 starter, a few items. */
export const VERDALE_START = {
  starterLevel: starts.verdale.level,
  bag: starts.verdale.bag,
  money: starts.verdale.money,
} as const;
