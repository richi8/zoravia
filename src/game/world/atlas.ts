/**
 * The Atlas (C36b): what the player knows about each region, built from pack data, the
 * party and the region's exploration. Pure; the map window (`ui/map-window.ts`, C36c) draws it.
 *
 * Nothing undiscovered is given away: a zone not yet entered, a fight whose spot is still
 * dark and a wild Zorling never seen are marked unknown, and the screen shows them as "?".
 *
 * - **Markers**: towns (discovered), and NPCs with an Atlas mark (`NpcData.mark`, or derived:
 *   a trainer battle → `trainer`, a boss battle → `titan`/`legendary`). An NPC shows while it
 *   is there (`when` holds) or once beaten.
 * - **Zones**: tier, levels, battle weather and the wild Zorlings seen and caught.
 * - **Fights**: every marked NPC but route trainers and gates, with level, result and (once
 *   beaten or caught) the weak spot: the reactions that break its Armor.
 */

import { trainerTeam, type GameContent, type NpcData, type NpcMark, type Tier } from '@game/data';
import type { Party } from '@game/player';
import { holds } from '@game/story/conditions';
import { mapPlaces, npcBattles, npcTile, type ExploredMap, type MapPlace } from './explore';
import type { WorldMap } from './map/world-map';

export type AtlasMarkerKind = NpcMark | 'town';

export interface AtlasMarker {
  readonly kind: AtlasMarkerKind;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly beaten: boolean;
}

export interface AtlasSpawn {
  readonly species: string;
  /** Undefined until seen. */
  readonly name?: string;
  readonly seen: boolean;
  readonly caught: boolean;
}

export interface AtlasZone {
  readonly key: string;
  /** False until entered: the screen shows "???". */
  readonly known: boolean;
  readonly name: string;
  readonly tier: Tier;
  readonly levels: readonly [number, number];
  /** Battle weather condition names ("Burning"). */
  readonly weather: readonly string[];
  readonly spawns: readonly AtlasSpawn[];
  /** Middle of the zone (map focus). */
  readonly x: number;
  readonly y: number;
}

export interface AtlasFight {
  readonly npc: string;
  readonly kind: NpcMark;
  /** False while its spot is unexplored: the screen shows "???". */
  readonly known: boolean;
  readonly name: string;
  readonly level: number;
  readonly result?: 'beaten' | 'caught';
  /** Reaction names that break its Armor (only once beaten or caught). */
  readonly weakSpot?: readonly string[];
  /** The zone it stands in, once that zone is discovered. */
  readonly where?: string;
  readonly x: number;
  readonly y: number;
}

export interface AtlasRegion {
  readonly map: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly zones: readonly AtlasZone[];
  readonly fights: readonly AtlasFight[];
  /** Markers on explored tiles only. */
  readonly markers: readonly AtlasMarker[];
  /** Discovered places (labels). */
  readonly places: readonly MapPlace[];
}

export interface AtlasProgress {
  readonly badges: readonly [number, number];
  /** Keepers beaten / Keepers in the game (one per heart). */
  readonly hearts: readonly [number, number];
  readonly dex: readonly [number, number];
}

/** The regions the Atlas has: every start region's map, in pack order. */
export function atlasMaps(content: GameContent): string[] {
  return [...new Set(content.starts.values().map((s) => s.map))];
}

/** An NPC's Atlas mark: its own, or derived from the battles its dialogue starts. */
export function npcMark(content: GameContent, n: NpcData): NpcMark | undefined {
  if (n.mark) return n.mark;
  const { trainers, bosses } = npcBattles(content, n.dialogue);
  const boss = bosses[0] ? content.bosses.get(bosses[0]) : undefined;
  if (boss) return boss.kind === 'legendary' ? 'legendary' : 'titan';
  return trainers.length ? 'trainer' : undefined;
}

export function atlasRegion(
  content: GameContent,
  party: Party,
  mapId: string,
  m: WorldMap,
  e: ExploredMap,
): AtlasRegion {
  const markers: AtlasMarker[] = [];
  const fights: AtlasFight[] = [];
  const places = mapPlaces(m);
  for (const p of places)
    if (p.kind === 'town' && e.places.has(p.key))
      markers.push({ kind: 'town', name: p.name, x: p.x, y: p.y, beaten: false });

  const badges = party.badges.length;
  const reactionName = (id: string): string => content.reactions.get(id)?.name ?? id;
  for (const n of content.npcs.values()) {
    if (n.map !== mapId) continue;
    const kind = npcMark(content, n);
    const at = kind ? npcTile(m, n) : undefined;
    if (!kind || !at) continue;
    const { trainers, bosses } = npcBattles(content, n.dialogue);
    const beatenTrainer = trainers.some((t) => t in party.trainers);
    const logged = bosses.map((b) => party.bosses[b]).find((r) => r !== undefined);
    const beaten = beatenTrainer || logged !== undefined;
    const here = !n.when || holds(content, party, n.when);
    // A fight already won is known even where the map is still dark (an old save).
    const known = e.seen(at.x, at.y) || beaten;
    if (known && (here || beaten)) markers.push({ kind, name: n.name, x: at.x, y: at.y, beaten });
    if (kind === 'trainer' || kind === 'gate') continue;

    // Level and Armor of the fight: a boss battle, or a trainer (its boss member's Armor).
    let level = 0;
    let armor: readonly string[] | undefined;
    let name = n.name;
    const boss = bosses[0] ? content.bosses.get(bosses[0]) : undefined;
    const trainer = trainers[0] ? content.trainers.get(trainers[0]) : undefined;
    if (boss) {
      level = boss.level;
      armor = boss.armor?.breaks;
      name = boss.name;
    } else if (trainer) {
      const team = trainerTeam(trainer, badges);
      const scale = trainer.perBadge * Math.max(0, badges - team.badges);
      level = Math.max(...team.team.map((t) => t.level)) + scale;
      const bossMember = team.team.find((t) => t.boss);
      armor = bossMember?.boss ? content.bosses.get(bossMember.boss)?.armor?.breaks : undefined;
    }
    const zone = m.zoneAt(at.x, at.y);
    const where = zone && e.places.has(`zone:${zone.key}`) ? zone.name : undefined;
    const result = logged?.result === 'caught' ? 'caught' : beaten ? 'beaten' : undefined;
    fights.push({
      npc: n.id,
      kind,
      known,
      name,
      level,
      ...(result ? { result } : {}),
      ...(result && armor ? { weakSpot: armor.map(reactionName) } : {}),
      ...(where ? { where } : {}),
      x: at.x,
      y: at.y,
    });
  }

  const seen = new Set(party.dex.seen);
  const caught = new Set(party.dex.caught);
  const zones: AtlasZone[] = m.zones.map((z) => {
    const place = places.find((p) => p.key === `zone:${z.key}`);
    const species = [...new Set(z.spawns.map((s) => s.species))];
    return {
      key: z.key,
      known: e.places.has(`zone:${z.key}`),
      name: z.name,
      tier: z.tier,
      levels: z.levels,
      weather: (z.battleWeather ?? []).map((c) => content.conditions.get(c)?.name ?? c),
      spawns: species.map((s) => {
        const has = seen.has(s) || caught.has(s);
        return {
          species: s,
          ...(has ? { name: content.species.get(s)?.name ?? s } : {}),
          seen: has,
          caught: caught.has(s),
        };
      }),
      x: place?.x ?? 0,
      y: place?.y ?? 0,
    };
  });

  const order: Record<string, number> = {
    trial: 0,
    rival: 1,
    titan: 2,
    boss: 3,
    legendary: 4,
    elder: 5,
    keeper: 6,
  };
  fights.sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9) || a.level - b.level);
  return {
    map: mapId,
    name: m.name,
    width: m.width,
    height: m.height,
    zones,
    fights,
    markers,
    places: places.filter((p) => e.places.has(p.key)),
  };
}

export function atlasProgress(content: GameContent, party: Party): AtlasProgress {
  let keepers = 0;
  let hearts = 0;
  for (const n of content.npcs.values()) {
    if (n.mark !== 'keeper') continue;
    keepers++;
    if (npcBattles(content, n.dialogue).trainers.some((t) => t in party.trainers)) hearts++;
  }
  return {
    badges: [party.badges.length, content.badges.size],
    hearts: [hearts, keepers],
    dex: [party.dex.caught.length, content.species.size],
  };
}
