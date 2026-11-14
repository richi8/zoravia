/**
 * Emberwaste's campaign as the playthrough simulator walks it (C34): the zones each part opens,
 * the shops on the way and the story fights in the order a player meets them. Fights in an ash
 * storm start with both Zorlings Burning, as in the game (`emberwaste.test.ts` checks that the
 * storms here match the zones the NPCs stand in).
 */

import { starts, STARTER_FLAGS } from '../../packs/emberwaste/starts';
import type { Goal, PlaythroughSetup, RouteStage } from './playthrough';

const e = (local: string): string => `emberwaste:${local}`;
const c = (local: string): string => `core:${local}`;
const ASH = ['core:burning'] as const;
const t = (id: string, opts: { badge?: string; storm?: boolean } = {}): Goal => ({
  trainer: e(id),
  ...(opts.badge ? { badge: e(opts.badge) } : {}),
  ...(opts.storm ? { weather: ASH } : {}),
});
const boss = (id: string, storm = false): Goal => ({
  boss: e(id),
  ...(storm ? { weather: ASH } : {}),
});

export const EMBERWASTE_ROUTE: readonly RouteStage[] = [
  {
    name: 'Cinderwell flats',
    zones: ['flats'],
    shop: [c('potion'), c('zorb')],
    goals: [t('prospector-ruby')],
  },
  {
    name: 'Dustway & north road',
    zones: ['dustway'],
    goals: [t('mira-cinderwell'), t('water-carrier-ilo')],
  },
  { name: 'Redrock Trail', zones: ['redrock'], goals: [t('trailblazer-cass')] },
  {
    name: 'Forge Trial',
    zones: [],
    shop: [c('super-potion'), c('max-potion')],
    goals: [
      t('apprentice-flint'),
      t('forgemaster-hale', { badge: 'kiln-badge' }),
      t('mira-kilnreach'),
    ],
  },
  {
    name: 'Dunes, Glass Flats, Rust Canyon',
    zones: ['cinder-dunes', 'glassflats', 'rust-canyon'],
    goals: [
      t('dune-rider-zeph', { storm: true }),
      boss('dunewyrm-titan', true),
      t('glassblower-opal'),
      t('miner-tobin'),
    ],
  },
  {
    name: 'Ashfall & Scorch Basin',
    zones: ['ashfall', 'scorch-basin'],
    goals: [t('firewatcher-rook', { storm: true }), t('nomad-kesh'), boss('forgeback-titan')],
  },
  { name: 'Slagwatch', zones: [], goals: [t('mira-slagwatch')] },
  {
    name: 'Obsidian, Ironspire, Caldera',
    zones: ['obsidian', 'ironspire', 'caldera'],
    goals: [
      t('hermit-vale'),
      t('climber-nash'),
      t('ace-sienna', { storm: true }),
      t('glassmaker-gorran', { storm: true }),
    ],
  },
  { name: 'Ember Heart', zones: [], goals: [boss('calderon', true)] },
];

/** Team plans: each starter with two wild Zorlings from the first zones. */
export const EMBERWASTE_TEAMS: readonly Pick<PlaythroughSetup, 'starter' | 'catches' | 'flags'>[] =
  [
    {
      starter: e('sizzlet'),
      catches: [e('oasip'), e('rivetling')],
      flags: { [STARTER_FLAGS.sizzlet]: 1 },
    },
    {
      starter: e('pebbit'),
      catches: [e('tumblet'), e('oasip')],
      flags: { [STARTER_FLAGS.pebbit]: 1 },
    },
    {
      starter: e('pricklet'),
      catches: [e('cindermite'), e('rivetling')],
      flags: { [STARTER_FLAGS.pricklet]: 1 },
    },
  ];

/** The real Emberwaste start (`packs/emberwaste/starts.ts`): one Lv 6 starter, a few items. */
export const EMBERWASTE_START = {
  starterLevel: starts.emberwaste.level,
  bag: starts.emberwaste.bag,
  money: starts.emberwaste.money,
} as const;
