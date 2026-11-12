/**
 * C10 shop mock: shop panel + shopkeeper dialog with a speaker tag, keyboard and mouse.
 */

import { Container, Graphics } from 'pixi.js';
import type { Scene } from '@engine/scenes/scene-manager';
import { DialogBox, FocusStack, type UiInput, type UiTheme } from '@engine/ui';
import { EffectsLayer, Toast } from '@game/ui/callout';
import { ShopPanel, type ShopItem } from '@game/ui/shop';
import { ZorlingActor } from '@game/zorlings/actor';
import { generateGenome } from '@game/zorlings/genome';
import { SHOP } from './data';

const GREETING = [
  'Welcome to the trading post! Potions are capped at five of each kind, so your bag never weighs you down.',
  'Pick something with W and S, change the amount with A and D, and press E to buy.',
];

export class ShopMockScene implements Scene<Container> {
  readonly id = 'shop-mock';
  readonly view = new Container({ label: 'world:shop-mock' });
  readonly ui = new Container({ label: 'ui:shop-mock' });
  private readonly room = new Graphics();
  private readonly keeper = new ZorlingActor(
    generateGenome(44, { plan: 'avian', type: 'wind', mood: 'cute' }),
    {
      size: 64,
      facing: 'left',
    },
  );
  private readonly layer = new Container();
  private readonly effects = new EffectsLayer();
  private readonly stack: FocusStack<Container>;
  private readonly shop: ShopPanel;
  private items: ShopItem[] = SHOP.map((i) => ({ ...i }));
  private money = 1240;
  private dialog: DialogBox | undefined;
  private width = 480;
  private height = 270;

  constructor(
    ui: UiInput,
    private readonly theme: UiTheme,
  ) {
    this.view.addChild(this.room, this.keeper);
    this.ui.addChild(this.layer, this.effects);
    this.stack = new FocusStack<Container>(
      { attach: (v) => this.layer.addChild(v), detach: (v) => this.layer.removeChild(v) },
      ui,
    );
    this.shop = new ShopPanel({
      title: 'Shop · Buy',
      items: this.items,
      money: () => this.money,
      onBuy: (item, qty) => this.buy(item, qty),
      onBack: () => this.say(['Come back any time!'], true),
    });
  }

  get state(): { money: number; owned: Record<string, number>; top: string } {
    return {
      money: this.money,
      owned: Object.fromEntries(this.items.map((i) => [i.id, i.owned])),
      top: this.stack.top?.view.label ?? '',
    };
  }

  enter(): void {
    this.stack.push(this.shop);
    this.say(GREETING);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    const g = this.room.clear();
    const wall = Math.round(height * 0.4);
    for (let x = 0; x < width; x += 16) g.rect(x, 0, 8, wall);
    g.fill({ color: 0x6b4a6e });
    for (let x = 8; x < width; x += 16) g.rect(x, 0, 8, wall);
    g.fill({ color: 0x634468 });
    g.rect(0, wall - 2, width, 4).fill({ color: 0x3f2a40 });
    for (let y = wall + 2; y < height; y += 8) {
      for (let x = ((y >> 3) * 24) % 64; x < width + 64; x += 64) g.rect(x - 32, y, 32, 8);
    }
    g.fill({ color: 0xa8754a });
    g.rect(0, wall + 2, width, height).fill({ color: 0x9d6c43, alpha: 0.5 });
    const counter = Math.round(height * 0.56);
    g.rect(0, counter, width, 26).fill({ color: 0x5a3b28 });
    g.rect(0, counter, width, 3).fill({ color: 0x7a5236 });
    this.keeper.position.set(Math.round(width * 0.72), counter + 2);
    this.shop.view.position.set(8, 8);
    this.placeDialog();
  }

  update(dt: number): void {
    this.stack.update(dt);
    this.keeper.update(dt);
    this.effects.update(dt);
  }

  private buy(item: ShopItem, qty: number): void {
    const cost = item.price * qty;
    if (cost > this.money) {
      this.say([`That's ${cost} coins. You only have ${this.money}.`]);
      return;
    }
    this.money -= cost;
    this.items = this.items.map((i) => (i.id === item.id ? { ...i, owned: i.owned + qty } : i));
    this.shop.setItems(this.items);
    this.effects.add(new Toast(`Bought ${qty} × ${item.name}.`), 8, this.shop.height + 14);
  }

  private say(pages: readonly string[], restart = false): void {
    if (this.dialog) this.stack.remove(this.dialog);
    const dialog = new DialogBox({
      theme: this.theme,
      width: this.width - 16,
      lines: 3,
      pages,
      speaker: 'Mira',
      onDone: (d) => {
        this.stack.remove(d);
        if (this.dialog === d) this.dialog = undefined;
        if (restart) {
          this.items = SHOP.map((i) => ({ ...i }));
          this.money = 1240;
          this.shop.setItems(this.items);
        }
      },
    });
    this.dialog = dialog;
    this.placeDialog();
    this.stack.push(dialog);
  }

  private placeDialog(): void {
    if (!this.dialog) return;
    this.dialog.view.position.set(8, this.height - 8 - this.dialog.height);
  }
}
