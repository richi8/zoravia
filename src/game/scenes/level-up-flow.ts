/**
 * Level-up choices in the overworld (C22b). After a battle the battle text has already said
 * "wants to learn X" and "is ready to evolve"; here the player decides, one offer at a time:
 *
 * - **Move offer** (all 3 slots full): a menu of the current moves to forget, plus "Don't
 *   learn". `Q` is the same as not learning it. Skipped moves can be taught later by the
 *   move relearner.
 * - **Evolution**: "Evolve into X" or "Not now" (`Q`). Waiting is fine: it is offered again
 *   on the next level up, and the party screen can start it any time. Evolving plays the
 *   evolution animation, then any moves the new form learns at this level are taught or
 *   offered the same way.
 */

import type { Texture } from 'pixi.js';
import { pixelTexture } from '@engine/render/pixel-texture';
import type { PixelSprite } from '@engine/render/sdf-sprite';
import type { MenuItem } from '@engine/ui';
import { progressText } from '@game/battle/present/text';
import { answerMoveOffer, evolveMember, memberOf, offerValid, type Offer } from '@game/player';
import { playSfx, playSpec, speciesCry } from '@game/audio';
import { displayName, MOVE_SLOTS } from '@game/progression';
import { typeIdOf } from '@game/style/ids';
import { TypeBadge } from '@game/ui/badges';
import { EvolutionPanel } from '@game/ui/evolution-panel';
import { speciesLook } from '@game/zorlings/species-look';
import { renderZorling, SPRITE_SIZE } from '@game/zorlings/render';
import type { OverworldMenus } from './overworld-menus';

export class LevelUpFlow {
  private readonly textures: Texture[] = [];
  /** True while offers are being asked (so a second batch waits its turn). */
  private busy = false;
  private readonly waiting: { offers: readonly Offer[]; done?: () => void }[] = [];

  constructor(private readonly menus: OverworldMenus) {}

  private get host(): OverworldMenus['host'] {
    return this.menus.host;
  }

  dispose(): void {
    for (const t of this.textures) t.destroy(true);
    this.textures.length = 0;
  }

  /** Asks every offer in order, then calls `done`. */
  run(offers: readonly Offer[], done?: () => void): void {
    if (this.busy) {
      this.waiting.push(done ? { offers, done } : { offers });
      return;
    }
    this.busy = true;
    const queue = [...offers];
    const next = (): void => {
      const offer = queue.shift();
      if (!offer) {
        this.busy = false;
        done?.();
        const more = this.waiting.shift();
        if (more) this.run(more.offers, more.done);
        return;
      }
      if (!offerValid(this.host.content, this.host.party, offer)) {
        next();
        return;
      }
      if (offer.kind === 'move') this.askMove(offer.uid, offer.move, next);
      else
        this.askEvolve(offer.uid, offer.into, (more) => {
          queue.unshift(...more);
          next();
        });
    };
    next();
  }

  /** Starts an evolution now (party screen). Its move offers follow; then `done`. */
  evolve(uid: string, done?: () => void): void {
    this.playEvolution(uid, (offers) => this.run(offers, done));
  }

  // ------------------------------------------------------------ moves

  private askMove(uid: string, move: string, next: () => void): void {
    const { content } = this.host;
    const { zorling } = memberOf(this.host.party, uid);
    const name = displayName(content, zorling);
    const m = content.moves.require(move);
    if (zorling.moves.length < MOVE_SLOTS) {
      this.host.party = answerMoveOffer(content, this.host.party, uid, move, null);
      this.host.say([`${name} learned ${m.name}!`], undefined, next);
      return;
    }
    const stat = (power: number, accuracy: number): string =>
      `${power > 0 ? `Pow ${power}` : 'Status'} · Acc ${accuracy}`;
    const badge = (type: string) => () =>
      new TypeBadge(typeIdOf(type) ?? 'metal', { label: false });
    this.host.say(
      [
        `${name} wants to learn ${m.name} (${content.types.require(m.type).name}, ${stat(m.power, m.accuracy)}).`,
        `But ${name} already knows ${MOVE_SLOTS} moves. Forget one to make room?`,
      ],
      undefined,
      () => {
        const items: MenuItem[] = zorling.moves.map((id) => {
          const known = content.moves.require(id);
          return {
            label: known.name,
            hint: stat(known.power, known.accuracy),
            icon: badge(known.type),
          };
        });
        items.push({ label: `Don't learn ${m.name}`, icon: badge(m.type) });
        const skip = (): void => {
          this.menus.close(menu);
          this.host.say([`${name} did not learn ${m.name}.`], undefined, next);
        };
        const menu = this.menus.menu(
          `Forget a move for ${m.name}?`,
          items,
          (slot) => {
            const forgot = zorling.moves[slot];
            if (forgot === undefined) {
              skip();
              return;
            }
            this.menus.close(menu);
            this.host.party = answerMoveOffer(content, this.host.party, uid, move, slot);
            const old = content.moves.require(forgot).name;
            this.host.say(
              [`1, 2, and… poof! ${name} forgot ${old}.`, `And ${name} learned ${m.name}!`],
              undefined,
              next,
            );
          },
          230,
          skip,
        );
      },
    );
  }

  // ------------------------------------------------------------ evolution

  private askEvolve(uid: string, into: string, next: (offers: Offer[]) => void): void {
    const { content } = this.host;
    const { zorling } = memberOf(this.host.party, uid);
    const name = displayName(content, zorling);
    const intoName = content.species.require(into).name;
    const later = (): void => {
      this.menus.close(menu);
      this.host.say(
        [`${name} stays as it is for now. You can evolve it from the party screen (P).`],
        undefined,
        () => next([]),
      );
    };
    const menu = this.menus.menu(
      `${name} is ready to evolve!`,
      [{ label: `Evolve into ${intoName}` }, { label: 'Not now' }],
      (i) => {
        if (i !== 0) {
          later();
          return;
        }
        this.menus.close(menu);
        this.playEvolution(uid, next);
      },
      200,
      later,
    );
  }

  /** The animation, then the evolution itself and its messages. */
  private playEvolution(uid: string, next: (offers: Offer[]) => void): void {
    const { content } = this.host;
    const { zorling } = memberOf(this.host.party, uid);
    const evo = content.species.require(zorling.species).evolution;
    if (!evo) {
      next([]);
      return;
    }
    const name = displayName(content, zorling);
    playSfx('world.evolve');
    const panel = new EvolutionPanel({
      title: `What? ${name} is evolving!`,
      from: this.art(zorling.species),
      into: this.art(evo.into),
      onDone: (p) => {
        this.menus.close(p);
        playSpec(speciesCry(content, evo.into));
        const result = evolveMember(content, this.host.party, uid);
        this.host.party = result.party;
        const shownName = zorling.nickname ?? content.species.require(zorling.species).name;
        // "evolved" first, then moves learned into a free slot; offers come as choices.
        const pages = result.events
          .filter((e) => e.kind === 'evolved' || e.kind === 'learned')
          .flatMap((e) =>
            progressText(
              content,
              e.kind === 'evolved'
                ? shownName
                : displayName(content, memberOf(result.party, uid).zorling),
              e,
            ),
          );
        this.host.say(pages, undefined, () => next(result.offers));
      },
    });
    this.menus.open(panel, () => ({ w: panel.width, h: panel.height }));
  }

  /** Battle-size sprite and its white silhouette. */
  private art(species: string): { color: Texture; white: Texture } {
    const look = speciesLook(this.host.content, species);
    const sprite = renderZorling(look.genome, { size: SPRITE_SIZE.battle, fill: look.fill });
    const color = pixelTexture(sprite);
    const white = pixelTexture(silhouette(sprite));
    this.textures.push(color, white);
    return { color, white };
  }
}

/** The same sprite in plain white (alpha kept). */
function silhouette(s: PixelSprite): PixelSprite {
  const data = new Uint8ClampedArray(s.data);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
  }
  return { width: s.width, height: s.height, data };
}
