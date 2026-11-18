import { describe, expect, it } from 'vitest';
import type { UiInput } from '@engine/ui';
import { DragSpots } from './zorling-view';

/** A pointer script: each step is a press, a held position, or a release. */
function pointer(): {
  input: UiInput;
  press(x: number, y: number): void;
  hold(x: number, y: number): void;
  release(): void;
} {
  let pressed: { x: number; y: number } | undefined;
  let held: { x: number; y: number } | undefined;
  const input: UiInput = {
    direction: () => undefined,
    confirmPressed: () => false,
    confirmHeld: () => false,
    backPressed: () => false,
    pointerPressed: () => pressed,
    pointerHeld: () => held,
    suppressHeld: () => undefined,
  };
  return {
    input,
    press: (x, y) => {
      pressed = { x, y };
      held = { x, y };
    },
    hold: (x, y) => {
      pressed = undefined;
      held = { x, y };
    },
    release: () => {
      pressed = undefined;
      held = undefined;
    },
  };
}

// Spots are 10 px columns: x 0–9 is spot 0, 10–19 spot 1… Spot 3 is empty.
const spotAt = (x: number): number | undefined =>
  x >= 0 && x < 40 ? Math.floor(x / 10) : undefined;
const local = (p: { x: number; y: number }): { x: number; y: number } => p;

describe('DragSpots (C44)', () => {
  it('a press that moves becomes a drag and drops on the spot under the pointer', () => {
    const p = pointer();
    const d = new DragSpots<number>(spotAt, (s) => s !== 3);
    p.press(5, 5);
    expect(d.update(p.input, local)).toEqual({ kind: 'none' });
    p.hold(7, 5); // under the threshold
    expect(d.update(p.input, local)).toEqual({ kind: 'none' });
    p.hold(25, 5);
    expect(d.update(p.input, local)).toEqual({ kind: 'moving', from: 0, x: 25, y: 5 });
    p.release();
    expect(d.update(p.input, local)).toEqual({ kind: 'drop', from: 0, to: 2 });
    expect(d.dragging).toBe(false);
  });

  it('a press without moving stays a click; empty spots and misses do not start a drag', () => {
    const p = pointer();
    const d = new DragSpots<number>(spotAt, (s) => s !== 3);
    p.press(5, 5);
    d.update(p.input, local);
    p.release();
    expect(d.update(p.input, local)).toEqual({ kind: 'none' });
    for (const x of [35, 90]) {
      p.press(x, 5);
      d.update(p.input, local);
      p.hold(x - 30, 5);
      expect(d.update(p.input, local)).toEqual({ kind: 'none' });
      p.release();
      d.update(p.input, local);
    }
  });

  it('a drop outside every spot drops on nothing', () => {
    const p = pointer();
    const d = new DragSpots<number>(spotAt, () => true);
    p.press(15, 5);
    d.update(p.input, local);
    p.hold(80, 5);
    d.update(p.input, local);
    p.release();
    expect(d.update(p.input, local)).toEqual({ kind: 'drop', from: 1, to: undefined });
  });
});
