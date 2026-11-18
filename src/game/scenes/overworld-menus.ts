/**
 * Overworld menus (C22): the pause menu (`Esc`) and the screens it opens: party (`P`), bag
 * (`I`), Dex (`B`) and the map window (`M`, `J` with quests open, C36c); plus the Zorling center (heal, storage, move
 * relearner) and shops opened by NPCs with a role. Every screen is a widget on the
 * overworld's focus stack, so the world stays paused while one is open. All changes go
 * through the pure rules in `@game/player` and are handed back with `host.setParty`.
 */

import type { Container } from 'pixi.js';
import { Texture } from 'pixi.js';
import { keyLabel, type Bindings, type KeyCode } from '@engine/input';
import { pixelTexture } from '@engine/render/pixel-texture';
import { Menu, type FocusStack, type MenuItem, type UiTheme, type Widget } from '@engine/ui';
import { bagTabsFor, itemLook } from '@game/battle/scene/view-data';
import { playJingle, playSfx } from '@game/audio';
import { SettingsMenu, type SizedWidget } from '@game/ui/settings-menu';
import type { GameContent, NpcRole } from '@game/data';
import type { Action } from '@game/input/actions';
import { bagCount } from '@game/inventory';
import {
  buyItem,
  canMove,
  dexPages,
  fieldUseProblem,
  healAll,
  maxBuyable,
  moveZorling,
  RELEARN_FEE,
  relearn,
  relearnOptions,
  useItemInField,
  type Party,
} from '@game/player';
import {
  canEvolve,
  displayName,
  MOVE_SLOTS,
  statsOf,
  xpForLevel,
  type Zorling,
} from '@game/progression';
import { styleTypes, typeIdOf } from '@game/style/ids';
import { BagPanel, type BagItem, type BagTab } from '@game/ui/bag';
import { DexPanel, type DexRow, type DexTab } from '@game/ui/dex-panel';
import { MapWindow, type GroupId, type MapWindowMarker } from '@game/ui/map-window';
import { formatMoney } from '@game/ui/panels';
import { PartyPanel } from '@game/ui/party-panel';
import { ShopPanel, type ShopItem } from '@game/ui/shop';
import { StoragePanel } from '@game/ui/storage-panel';
import type { MoveLine, ZorlingView } from '@game/ui/zorling-view';
import { BIOMES } from '@game/world/biomes';
import { buildMinimap, fogTint, loadRegion, tierTint, type WorldMap } from '@game/world/map';
import { atlasProgress, atlasRegion, speciesHabitats } from '@game/world/atlas';
import { worldBounds, worldLayout, worldLinks } from '@game/world/world-layout';
import type { ExploredMap } from '@game/world/explore';
import type { PixelBuffer } from '@engine/render/pixel-buffer';
import { questLog } from '@game/story';
import { speciesLook } from '@game/zorlings/species-look';
import { LevelUpFlow } from './level-up-flow';
import { renderZorling } from '@game/zorlings/render';

/** What the menus need from the overworld scene. */
export interface MenuHost {
  readonly content: GameContent;
  readonly theme: UiTheme;
  readonly stack: FocusStack<Container>;
  readonly map: WorldMap;
  /** Id of `map`. */
  readonly mapId: string;
  /** A map's exploration (this map's live one, others as saved) (C36b). */
  explored(mapId: string): ExploredMap;
  /** Menu keys the UI input has no method for: `F` inspect, `Z` map zoom. */
  pressed(action: 'inspect' | 'zoom'): boolean;
  party: Party;
  /** Screen size in game pixels. */
  size(): { width: number; height: number };
  /** Player tile and the zone label shown on the map. */
  where(): { x: number; y: number; place: string };
  /** Tiles of NPCs with a role (map markers). */
  services(): readonly { x: number; y: number; role: NpcRole['kind'] }[];
  /** Shows dialog pages above everything; `done` runs when they close. */
  say(pages: readonly string[], speaker?: string, done?: () => void): void;
  /** The player used this center (they wake up here after losing). */
  centerUsed(): void;
  /** Saves the game (pause menu → Save); `done` gets an error message if it failed. */
  save?(done: (error?: string) => void): void;
  /** Leave the overworld (pause menu → quit to title). */
  quit(): void;
  /** Key bindings, for the Controls screen (C33). */
  readonly bindings: Bindings<Action>;
  /** The first key pressed this step, any key (the Controls screen). */
  capture(): KeyCode | undefined;
}

export class OverworldMenus {
  private readonly portraits = new Map<string, Texture>();
  private readonly art = new Map<string, Texture>();
  private readonly sizes = new Map<Widget<Container>, () => { w: number; h: number }>();
  /**
   * Region textures of the map screens by map and kind, drawn again when the exploration they
   * show changed. None is freed on close: a closing screen still draws during its animation.
   */
  private readonly maps = new Map<string, { key: string; texture: Texture }>();
  /** Move offers and evolutions after battles and from the party screen (C22b). */
  readonly levelUp: LevelUpFlow;

  /** Quest state when the log was last opened (or the visit began): newer ones show "New". */
  private readonly questsSeen = new Map<string, string>();

  constructor(readonly host: MenuHost) {
    this.levelUp = new LevelUpFlow(this);
    this.markQuestsSeen();
  }

  private static questKey(q: { readonly state: string; readonly step?: string }): string {
    return q.state === 'done' ? 'done' : `active:${q.step ?? ''}`;
  }

  private markQuestsSeen(): void {
    for (const [id, q] of Object.entries(this.host.party.quests))
      this.questsSeen.set(id, OverworldMenus.questKey(q));
  }

  /** Quests started or moved on since the log was last opened. */
  get newQuests(): number {
    let n = 0;
    for (const [id, q] of Object.entries(this.host.party.quests))
      if (this.questsSeen.get(id) !== OverworldMenus.questKey(q)) n++;
    return n;
  }

  /** Re-centers every open screen (after a resize). */
  layout(): void {
    const { width, height } = this.host.size();
    for (const [w, size] of this.sizes) {
      if (!this.host.stack.includes(w)) {
        this.sizes.delete(w);
        continue;
      }
      const { w: ww, h } = size();
      w.view.position.set(Math.round((width - ww) / 2), Math.round((height - h) / 2));
    }
  }

  dispose(): void {
    this.levelUp.dispose();
    for (const t of this.portraits.values()) t.destroy(true);
    for (const t of this.art.values()) t.destroy(true);
    for (const m of this.maps.values()) m.texture.destroy(true);
    this.maps.clear();
    this.portraits.clear();
    this.art.clear();
  }

  /** Pushes a centered screen (kept centered on resize). */
  open(w: Widget<Container>, size: () => { w: number; h: number }): void {
    this.sizes.set(w, size);
    this.host.stack.push(w);
    this.layout();
  }

  close(w: Widget<Container>): void {
    this.host.stack.remove(w);
    this.sizes.delete(w);
  }

  /** A centered menu; Q closes it unless `onBack` is given. */
  menu(
    title: string,
    items: readonly MenuItem[],
    onSelect: (i: number, m: Menu) => void,
    width = 150,
    onBack?: (m: Menu) => void,
  ): Menu {
    const m: Menu = new Menu({
      theme: this.host.theme,
      title,
      width,
      items,
      onSelect,
      onBack: onBack ?? (() => this.close(m)),
    });
    this.open(m, () => ({ w: m.width, h: m.height }));
    return m;
  }

  // ------------------------------------------------------------ pause menu

  openPause(): void {
    // Key hints follow the player's bindings (C33).
    const key = (a: Action): string => {
      const k = this.host.bindings.keysFor(a).find((c) => !c.startsWith('Mouse'));
      return k ? keyLabel(k) : '';
    };
    const entries: [string, string, () => void][] = [
      ['Party', key('party'), () => this.openParty()],
      ['Bag', key('inventory'), () => this.openBag()],
      ['Dex', key('dex'), () => this.openDex()],
      ['Map', key('map'), () => this.openMap()],
      ...(this.host.save
        ? [['Save', '', () => this.saveGame()] as [string, string, () => void]]
        : []),
      ['Settings', '', () => this.openSettings()],
      ['Quit to title', '', () => this.host.quit()],
    ];
    this.menu(
      'Menu',
      entries.map(([label, hint]) => ({ label, ...(hint ? { hint } : {}) })),
      (i) => entries[i]?.[2](),
      140,
    );
  }

  private openSettings(): void {
    const sized = (w: SizedWidget): void => this.open(w, () => ({ w: w.width, h: w.height }));
    sized(
      new SettingsMenu({
        theme: this.host.theme,
        bindings: this.host.bindings,
        capture: () => this.host.capture(),
        open: sized,
        close: (w) => this.close(w),
        onBack: (m) => this.close(m),
      }),
    );
  }

  private saveGame(): void {
    this.host.save?.((error) => {
      playSfx(error ? 'ui.blocked' : 'world.save');
      this.host.say([error ? `Could not save: ${error}` : 'Game saved.']);
    });
  }

  // ------------------------------------------------------------ party

  openParty(): void {
    const panel = new PartyPanel({
      team: this.teamViews(),
      onSwap: (a, b) => {
        this.host.party = moveZorling(
          this.host.party,
          { area: 'team', index: a },
          { area: 'team', index: b },
        );
        return this.teamViews();
      },
      onBack: (p) => this.close(p),
      onSelect: (i, p) => this.partyOptions(i, p),
    });
    this.open(panel, () => ({ w: PartyPanel.WIDTH, h: PartyPanel.HEIGHT }));
  }

  /** E on a party member: reorder, or evolve when it waited (C22b). */
  private partyOptions(index: number, panel: PartyPanel): void {
    const { content } = this.host;
    const z = this.host.party.team[index];
    if (!z) return;
    const into = content.species.require(z.species).evolution?.into;
    const entries: [MenuItem, () => void][] = [
      [{ label: 'Reorder', disabled: this.host.party.team.length < 2 }, () => panel.hold(index)],
    ];
    if (into && canEvolve(content, z)) {
      const name = content.species.require(into).name;
      entries.push([
        { label: `Evolve into ${name}` },
        () => this.levelUp.evolve(z.uid, () => panel.setTeam(this.teamViews())),
      ]);
    }
    const m = this.menu(
      displayName(content, z),
      [...entries.map(([item]) => item), { label: 'Cancel' }],
      (i) => {
        this.close(m);
        entries[i]?.[1]();
      },
      170,
    );
  }

  // ------------------------------------------------------------ bag

  openBag(): void {
    const { content } = this.host;
    const party = this.host.party;
    const panel: BagPanel = new BagPanel({
      tabs: fieldTabs(content, party),
      team: party.team.map((z) => ({
        name: displayName(content, z),
        level: z.level,
        types: styleTypes(content.species.require(z.species).types),
        hp: z.hp,
        maxHp: statsOf(content, z).hp,
        conditions: [],
        portrait: this.portrait(z),
      })),
      money: party.money,
      onUse: (item, target) => this.useItem(panel, item, target),
      onBack: (p) => this.close(p),
    });
    this.open(panel, () => ({ w: BagPanel.WIDTH, h: BagPanel.HEIGHT }));
  }

  private useItem(panel: BagPanel, item: BagItem, target: number | undefined): void {
    const { content } = this.host;
    const party = this.host.party;
    const index = target ?? 0;
    const z = party.team[index];
    const name = z ? displayName(content, z) : '';
    const problem = fieldUseProblem(content, party, item.id, index);
    const why = {
      none: `You have no ${item.name} left.`,
      'battle-only': `${item.name}s are for wild battles.`,
      fainted: `${name} has fainted. Potions can't revive it — rest at a Zorling center.`,
      full: `${name} already has full HP.`,
      target: 'Pick a Zorling to use it on.',
    };
    if (problem) {
      this.host.say([why[problem]]);
      return;
    }
    const used = useItemInField(content, party, item.id, index);
    this.host.party = used.party;
    // Rebuild the bag with the new counts, then tell what happened.
    this.close(panel);
    this.openBag();
    this.host.say([`${name} recovered ${used.healed} HP.`]);
  }

  // ------------------------------------------------------------ Dex

  openDex(): void {
    const { content, party } = this.host;
    // Where each seen species was found (C42), over every region's exploration.
    const habitats = speciesHabitats(content, party, (id) => this.host.explored(id));
    const tabs: DexTab[] = dexPages(content, party.dex).map((page) => ({
      name: page.name,
      rows: page.entries.map((e): DexRow => {
        const s = content.species.require(e.species);
        return {
          number: e.number,
          species: e.species,
          name: s.name,
          seen: e.seen,
          caught: e.caught,
          types: styleTypes(s.types),
          description: s.description,
          habitat: e.seen ? (habitats.get(e.species) ?? []) : [],
        };
      }),
    }));
    const panel = new DexPanel({
      tabs,
      sprite: (species) => this.speciesArt(species),
      pressed: (action) => this.host.pressed(action),
      onBack: (p) => this.close(p),
    });
    this.open(panel, () => ({ w: DexPanel.WIDTH, h: DexPanel.HEIGHT }));
  }

  // ------------------------------------------------------------ map & quests

  /** A region texture for `slot`, drawn again only when `key` (what it shows) changed. */
  private texture(slot: string, key: string, draw: () => PixelBuffer): Texture {
    const have = this.maps.get(slot);
    if (have?.key === key) return have.texture;
    const buf = draw();
    const canvas = document.createElement('canvas');
    canvas.width = buf.width;
    canvas.height = buf.height;
    canvas.getContext('2d')?.putImageData(new ImageData(buf.bytes, buf.width, buf.height), 0, 0);
    const texture = Texture.from(canvas);
    texture.source.scaleMode = 'nearest';
    have?.texture.destroy(true);
    this.maps.set(slot, { key, texture });
    return texture;
  }

  /**
   * The map window (C36c): one world map with every region at its world place, and the Zones,
   * Bosses and Quests groups. `M` opens it on the player, `J` with Quests open.
   */
  openMap(open?: GroupId): void {
    const { content, party, mapId } = this.host;
    const layout = worldLayout(content, [mapId]);
    const maps = layout.map((r) => (r.map === mapId ? this.host.map : loadRegion(content, r.map)));
    const explored = layout.map((r) => this.host.explored(r.map));
    const here = layout.find((r) => r.map === mapId) ?? { x: 0, y: 0 };
    const where = this.host.where();
    const markers: MapWindowMarker[] = [];
    const ownExplored = this.host.explored(mapId);
    for (const s of this.host.services()) {
      if (!ownExplored.seen(s.x, s.y)) continue;
      markers.push({
        x: here.x + s.x,
        y: here.y + s.y,
        color: s.role === 'center' ? 0xff5c6c : 0x5ab0ff,
      });
    }
    // A ferry's sea and route show once either end of it is explored.
    const seenAt = (map: string, x: number, y: number): boolean => {
      const i = layout.findIndex((r) => r.map === map);
      const r = layout[i];
      return !!r && !!explored[i]?.seen(x - r.x, y - r.y);
    };
    const links = worldLinks(content, layout).filter(
      (l) => seenAt(l.a.map, l.a.x, l.a.y) || seenAt(l.b.map, l.b.x, l.b.y),
    );
    const rows = questLog(content, party);
    const quests = rows.map((r) => {
      const q = party.quests[r.id];
      return { ...r, fresh: !!q && this.questsSeen.get(r.id) !== OverworldMenus.questKey(q) };
    });
    const panel = new MapWindow({
      regions: layout.map((r, i) => ({
        atlas: atlasRegion(content, party, r.map, maps[i] as WorldMap, explored[i] as ExploredMap),
        x: r.x,
        y: r.y,
      })),
      bounds: worldBounds(layout),
      image: (i) => {
        const m = maps[i] as WorldMap;
        const e = explored[i] as ExploredMap;
        return this.texture(`${layout[i]?.map ?? ''}:atlas`, String(e.explored), () =>
          buildMinimap(
            m,
            BIOMES[m.biome],
            1,
            fogTint((x, y) => e.seen(x, y), tierTint(m), (layout[i]?.x ?? 0) + (layout[i]?.y ?? 0)),
          ),
        );
      },
      player: { x: here.x + where.x, y: here.y + where.y },
      place: where.place,
      markers,
      links,
      progress: atlasProgress(content, party),
      quests,
      ...(open ? { open } : {}),
      pressed: (a) => this.host.pressed(a),
      onQuestsShown: () => this.markQuestsSeen(),
      onBack: (p) => this.close(p),
    });
    this.open(panel, () => ({ w: MapWindow.WIDTH, h: MapWindow.HEIGHT }));
  }

  /** `J`: the map window with Quests open. */
  openQuests(): void {
    this.openMap('Quests');
  }

  // ------------------------------------------------------------ Zorling center

  /** The center menu; `speaker` (the NPC's name) answers in dialogs. */
  openCenter(speaker = 'Zorling center'): void {
    const entries: [string, string, () => void][] = [
      ['Heal your Zorlings', '', () => this.heal(speaker)],
      ['Storage', '', () => this.openStorage()],
      ['Relearn moves', `${RELEARN_FEE} coins`, () => this.openRelearner()],
      ['Leave', '', () => this.close(m)],
    ];
    const m = this.menu(
      'Zorling center',
      entries.map(([label, hint]) => ({ label, ...(hint ? { hint } : {}) })),
      (i) => entries[i]?.[2](),
      170,
    );
  }

  private heal(speaker: string): void {
    this.host.party = healAll(this.host.content, this.host.party);
    this.host.centerUsed();
    playJingle('world.heal');
    this.host.say(['Your Zorlings are fully healed. Come back any time!'], speaker);
  }

  private openStorage(): void {
    const views = (): { team: ZorlingView[]; storage: ZorlingView[] } => ({
      team: this.teamViews(),
      storage: this.host.party.storage.map((z) => this.zorlingView(z)),
    });
    const panel = new StoragePanel({
      ...views(),
      canMove: (from, to) => canMove(this.host.party, from, to),
      onMove: (from, to) => {
        this.host.party = moveZorling(this.host.party, from, to);
        return views();
      },
      onBack: (p) => this.close(p),
    });
    this.open(panel, () => ({ w: StoragePanel.WIDTH, h: StoragePanel.HEIGHT }));
  }

  private openRelearner(): void {
    const { content } = this.host;
    if (this.host.party.money < RELEARN_FEE) {
      this.host.say([`The move relearner costs ${RELEARN_FEE} coins. Come back with more money.`]);
      return;
    }
    const team = this.host.party.team;
    if (team.every((_, i) => relearnOptions(content, this.host.party, i).length === 0)) {
      this.host.say(['None of your Zorlings has a move to relearn right now.']);
      return;
    }
    const who = this.menu(
      `Relearn · ${RELEARN_FEE} coins`,
      team.map((z, i) => {
        const n = relearnOptions(content, this.host.party, i).length;
        return {
          label: displayName(content, z),
          hint: n ? `${n} move${n > 1 ? 's' : ''}` : 'none',
          disabled: n === 0,
        };
      }),
      (i) => this.pickMove(i, who),
      190,
    );
  }

  private pickMove(teamIndex: number, who: Menu): void {
    const { content } = this.host;
    const moves = relearnOptions(content, this.host.party, teamIndex);
    const which = this.menu(
      'Teach which move?',
      moves.map((id) => {
        const m = content.moves.require(id);
        return { label: m.name, hint: m.power > 0 ? `Pow ${m.power}` : 'Status' };
      }),
      (i) => {
        const move = moves[i];
        if (!move) return;
        const z = this.host.party.team[teamIndex];
        if (z && z.moves.length >= MOVE_SLOTS) this.pickForget(teamIndex, move, [who, which]);
        else this.teach(teamIndex, move, null, [who, which]);
      },
      190,
    );
  }

  private pickForget(teamIndex: number, move: string, chain: Menu[]): void {
    const { content } = this.host;
    const z = this.host.party.team[teamIndex];
    if (!z) return;
    const forget = this.menu(
      `Forget a move for ${content.moves.require(move).name}?`,
      z.moves.map((id) => ({ label: content.moves.require(id).name })),
      (slot) => this.teach(teamIndex, move, slot, [...chain, forget]),
      200,
    );
  }

  private teach(teamIndex: number, move: string, slot: number | null, chain: Menu[]): void {
    const { content } = this.host;
    const before = this.host.party.team[teamIndex];
    if (!before) return;
    const forgot = slot !== null ? before.moves[slot] : undefined;
    this.host.party = relearn(content, this.host.party, teamIndex, move, slot);
    const first = chain[0];
    if (first) this.close(first);
    const name = displayName(content, before);
    const moveName = content.moves.require(move).name;
    const pages = forgot
      ? [`${name} forgot ${content.moves.require(forgot).name} and learned ${moveName}!`]
      : [`${name} learned ${moveName}!`];
    this.host.say([...pages, `That will be ${RELEARN_FEE} coins. Thank you!`]);
  }

  // ------------------------------------------------------------ shop

  openShop(title: string, stock: readonly string[]): void {
    const { content } = this.host;
    const items = (): ShopItem[] =>
      stock.map((id) => {
        const it = content.items.require(id);
        return {
          id,
          name: it.name,
          price: it.price,
          owned: bagCount(this.host.party.bag, id),
          ...(it.bagCap !== undefined ? { cap: it.bagCap } : {}),
          ...itemLook(it),
        };
      });
    const shop = new ShopPanel({
      title,
      items: items(),
      money: () => this.host.party.money,
      onBuy: (item, qty, panel) => {
        const party = this.host.party;
        if (maxBuyable(content, party, item.id) < qty) {
          playSfx('ui.blocked');
          this.host.say([`You need ${formatMoney(item.price * qty)} coins for that.`]);
          return;
        }
        this.host.party = buyItem(content, party, item.id, qty);
        playSfx('world.buy');
        panel.setItems(items());
        this.host.say([`You bought ${qty} × ${item.name}.`]);
      },
      onBack: (p) => this.close(p),
    });
    this.open(shop, () => ({ w: shop.width, h: shop.height }));
  }

  // ------------------------------------------------------------ views

  teamViews(): ZorlingView[] {
    return this.host.party.team.map((z) => this.zorlingView(z));
  }

  zorlingView(z: Zorling): ZorlingView {
    const { content } = this.host;
    const s = content.species.require(z.species);
    const stats = statsOf(content, z);
    const floor = xpForLevel(z.level);
    const next = xpForLevel(z.level + 1);
    const moves: MoveLine[] = z.moves.map((id) => {
      const m = content.moves.require(id);
      return {
        name: m.name,
        type: typeIdOf(m.type) ?? 'metal',
        power: m.power,
        accuracy: m.accuracy,
      };
    });
    const trait = s.trait ? content.traits.require(s.trait) : undefined;
    return {
      uid: z.uid,
      name: displayName(content, z),
      species: s.name,
      level: z.level,
      types: styleTypes(s.types),
      hp: z.hp,
      maxHp: stats.hp,
      xp: next > floor ? (z.xp - floor) / (next - floor) : 1,
      toNext: Math.max(0, next - z.xp),
      stats: { attack: stats.attack, defense: stats.defense, speed: stats.speed },
      ...(trait ? { trait: { name: trait.name, description: trait.description } } : {}),
      moves,
      titan: z.titanMark,
      ...(s.evolution && canEvolve(content, z)
        ? { evolveInto: content.species.require(s.evolution.into).name }
        : {}),
      portrait: this.portrait(z),
    };
  }

  private portrait(z: Zorling): Texture {
    const have = this.portraits.get(z.species);
    if (have) return have;
    const look = speciesLook(this.host.content, z.species);
    const t = pixelTexture(renderZorling(look.genome, { size: 32, fill: look.fill }));
    this.portraits.set(z.species, t);
    return t;
  }

  private speciesArt(species: string): Texture {
    const have = this.art.get(species);
    if (have) return have;
    const look = speciesLook(this.host.content, species);
    const t = pixelTexture(renderZorling(look.genome, { size: 64, fill: look.fill }));
    this.art.set(species, t);
    return t;
  }
}

/** The bag outside battle: same tabs as in battle, without the "costs your turn" note. */
function fieldTabs(content: GameContent, party: Party): BagTab[] {
  return bagTabsFor(content, party.bag).map((tab) => ({
    ...tab,
    items: tab.items.map((item) => ({
      ...item,
      description: content.items.require(item.id).description,
    })),
  }));
}
