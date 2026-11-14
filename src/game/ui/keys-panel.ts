/**
 * Controls screen (C33): every key group with two key slots, plus "Reset to defaults".
 *
 * Keyboard: W/S choose a control, A/D choose the slot, E then press the new key (Esc
 * cancels), Q back. A key another control used is swapped (the note says which); `Esc` is
 * always Back and Menu and its slots are locked. Mouse: click a slot to pick it.
 */

import { Container, Graphics, Rectangle } from 'pixi.js';
import type { Bindings, KeyCode } from '@engine/input';
import { uiSound, type UiInput, type Widget } from '@engine/ui';
import type { Action } from '@game/input/actions';
import {
  allDefault,
  FIXED_KEY,
  groupKeys,
  KEY_GROUPS,
  KEY_SLOTS,
  rebindGroup,
  slotLabel,
  slotLocked,
} from '@game/settings';
import { paper } from '../style/tokens';
import { KeyHint, row } from './badges';
import { drawCursor, drawPaper, drawWell } from './skin';
import { uiText } from './text';
import { PointerQueue } from './zorling-view';

export interface KeysPanelOptions {
  readonly bindings: Bindings<Action>;
  /** The first key pressed this step, any key. */
  readonly capture: () => KeyCode | undefined;
  readonly onBack: (panel: KeysPanel) => void;
}

const W = 272;
const ROW_H = 11;
const TOP = 19;
const LABEL_W = 112;
const SLOT_W = 70;
const RESET = KEY_GROUPS.length;
const H = TOP + (KEY_GROUPS.length + 1) * ROW_H + 30;

export class KeysPanel implements Widget<Container> {
  readonly view = new Container({ label: 'keys' });
  private readonly dynamic = new Container();
  private index = 0;
  private slot = 0;
  private capturing = false;
  private note = '';
  private focused = false;
  private readonly pointer = new PointerQueue<'slot'>(() => this.focused && !this.capturing);

  constructor(private readonly options: KeysPanelOptions) {
    const bg = drawPaper(new Graphics(), 0, 0, W, H);
    const title = uiText('label', 'Controls', paper.title);
    title.position.set(7, 6);
    const k1 = uiText('label', 'Key 1', paper.inkDim);
    const k2 = uiText('label', 'Key 2', paper.inkDim);
    k1.position.set(LABEL_W + 10, 6);
    k2.position.set(LABEL_W + 10 + SLOT_W + 4, 6);
    this.view.addChild(bg, title, k1, k2, this.dynamic);
    this.view.eventMode = 'static';
    this.view.hitArea = new Rectangle(0, 0, W, H);
    this.build();
  }

  get width(): number {
    return W;
  }

  get height(): number {
    return H;
  }

  /** For tests and the debug console. */
  get state(): { index: number; slot: number; capturing: boolean; note: string } {
    return { index: this.index, slot: this.slot, capturing: this.capturing, note: this.note };
  }

  focus(): void {
    this.focused = true;
    this.build();
  }

  blur(): void {
    this.focused = false;
    this.capturing = false;
    this.pointer.clear();
    this.build();
  }

  contains(x: number, y: number): boolean {
    const p = this.view.toLocal({ x, y });
    return p.x >= 0 && p.y >= 0 && p.x <= W && p.y <= H;
  }

  dismiss(): void {
    if (!this.capturing) this.options.onBack(this);
  }

  handleInput(input: UiInput): void {
    if (this.capturing) {
      const key = this.options.capture();
      if (key !== undefined) this.take(key, input);
      return;
    }
    const p = this.pointer.take();
    if (p) {
      const [i, s] = [Math.floor(p.index / KEY_SLOTS), p.index % KEY_SLOTS];
      const changed = i !== this.index || s !== this.slot;
      this.index = i;
      this.slot = s;
      if (changed) uiSound('move');
      if (p.click) this.confirm();
      else this.build();
      return;
    }
    const dir = input.direction();
    if (dir === 'up' || dir === 'down') {
      const n = KEY_GROUPS.length + 1;
      this.index = (this.index + (dir === 'down' ? 1 : n - 1)) % n;
      uiSound('move');
      this.build();
    } else if (dir === 'left' || dir === 'right') {
      if (this.index !== RESET) {
        this.slot = (this.slot + 1) % KEY_SLOTS;
        uiSound('move');
        this.build();
      }
    } else if (input.confirmPressed()) this.confirm();
    else if (input.backPressed()) {
      uiSound('back');
      this.options.onBack(this);
    }
  }

  private confirm(): void {
    const { bindings } = this.options;
    if (this.index === RESET) {
      if (allDefault(bindings)) {
        uiSound('blocked');
        return;
      }
      bindings.reset();
      uiSound('select');
      this.note = 'All keys are back to their defaults.';
      this.build();
      return;
    }
    const group = KEY_GROUPS[this.index];
    if (!group) return;
    if (slotLocked(bindings, group, this.slot)) {
      uiSound('blocked');
      this.note = 'Esc is always Back and Menu.';
      this.build();
      return;
    }
    uiSound('select');
    this.capturing = true;
    this.note = `Press a key for ${group.label}. Esc cancels.`;
    this.build();
  }

  private take(key: KeyCode, input: UiInput): void {
    const group = KEY_GROUPS[this.index];
    this.capturing = false;
    // The key just pressed must not also act in whatever handles input next.
    input.suppressHeld();
    if (key === FIXED_KEY || !group) {
      uiSound('back');
      this.note = '';
      this.build();
      return;
    }
    const r = rebindGroup(this.options.bindings, group, this.slot, key);
    uiSound(r.ok ? 'select' : 'blocked');
    this.note = r.ok ? (r.note ?? `${group.label}: ${slotLabel(key)}.`) : r.reason;
    this.build();
  }

  private build(): void {
    for (const c of this.dynamic.removeChildren()) c.destroy({ children: true });
    const { bindings } = this.options;
    const add = <T extends Container>(c: T, x: number, y: number): T => {
      c.position.set(Math.round(x), Math.round(y));
      this.dynamic.addChild(c);
      return c;
    };
    const g = add(new Graphics(), 0, 0);
    KEY_GROUPS.forEach((group, i) => {
      const y = TOP + i * ROW_H;
      const sel = i === this.index;
      if (i % 2 === 1) g.rect(5, y, W - 10, ROW_H).fill({ color: paper.well });
      add(uiText('body', group.label, sel ? paper.ink : paper.inkDim), 9, y - 1);
      groupKeys(bindings, group).forEach((key, s) => {
        const x = LABEL_W + 6 + s * (SLOT_W + 4);
        const on = sel && s === this.slot;
        const locked = key === FIXED_KEY;
        if (on) {
          drawCursor(g, x, y, SLOT_W, ROW_H - 1, this.focused);
        } else drawWell(g, x, y + 1, SLOT_W, ROW_H - 2);
        const text = on && this.capturing ? '…' : slotLabel(key);
        const color = locked ? paper.inkDisabled : key === undefined ? paper.inkDim : paper.ink;
        const t = add(uiText('body', text, color), 0, y - 1);
        t.x = Math.round(x + (SLOT_W - t.width) / 2);
        const hit = new Container();
        hit.hitArea = new Rectangle(0, 0, SLOT_W, ROW_H);
        this.pointer.bind(hit, 'slot', i * KEY_SLOTS + s);
        add(hit, x, y);
      });
    });
    const ry = TOP + KEY_GROUPS.length * ROW_H + 2;
    if (this.index === RESET) drawCursor(g, 5, ry, W - 10, ROW_H, this.focused);
    add(
      uiText('body', 'Reset to defaults', allDefault(bindings) ? paper.inkDisabled : paper.ink),
      16,
      ry - 1,
    );
    const resetHit = new Container();
    resetHit.hitArea = new Rectangle(0, 0, W - 10, ROW_H);
    this.pointer.bind(resetHit, 'slot', RESET * KEY_SLOTS);
    add(resetHit, 5, ry);

    if (this.note) add(uiText('body', this.note, paper.title), 9, H - 25);
    const hints = this.capturing
      ? [new KeyHint('Esc', 'Cancel')]
      : [new KeyHint('E', 'Change'), new KeyHint('A D', 'Slot'), new KeyHint('Q', 'Back')];
    for (const h of hints) this.dynamic.addChild(h);
    row(hints, 8, 7, H - 12);
  }
}
