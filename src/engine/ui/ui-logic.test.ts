import { describe, expect, it } from 'vitest';
import { FocusStack, type Widget } from './focus-stack';
import { GridCursor } from './grid-cursor';
import { Typewriter } from './typewriter';
import { WheelSteps } from './wheel';
import type { UiInput } from './ui-input';

describe('GridCursor — list', () => {
  it('moves and wraps vertically; left/right do nothing', () => {
    const c = new GridCursor(3);
    expect(c.index).toBe(0);
    expect(c.move('up')).toBe(true);
    expect(c.index).toBe(2);
    c.move('down');
    expect(c.index).toBe(0);
    expect(c.move('left')).toBe(false);
    expect(c.move('right')).toBe(false);
  });

  it('skips disabled items, including the first', () => {
    const disabled = new Set([0, 2]);
    const c = new GridCursor(5, 1, (i) => !disabled.has(i));
    expect(c.index).toBe(1);
    c.move('down');
    expect(c.index).toBe(3);
    c.move('up');
    expect(c.index).toBe(1);
    c.move('up'); // 0 disabled → wraps to 4
    expect(c.index).toBe(4);
  });

  it('handles all-disabled, single item, and empty lists', () => {
    expect(new GridCursor(3, 1, () => false).index).toBe(-1);
    expect(new GridCursor(0).index).toBe(-1);
    const one = new GridCursor(1);
    expect(one.move('down')).toBe(false);
    expect(one.index).toBe(0);
  });

  it('set() ignores disabled/out-of-range; reset() keeps a valid index', () => {
    const c = new GridCursor(4, 1, (i) => i !== 2);
    expect(c.set(2)).toBe(false);
    expect(c.set(3)).toBe(true);
    c.reset(2);
    expect(c.index).toBe(0);
  });
});

describe('GridCursor — grid', () => {
  // 3 columns, 8 items:
  // 0 1 2
  // 3 4 5
  // 6 7
  const grid = (): GridCursor => new GridCursor(8, 3);

  it('wraps within rows and columns', () => {
    const c = grid();
    c.move('left');
    expect(c.index).toBe(2);
    c.move('right');
    expect(c.index).toBe(0);
    c.move('up');
    expect(c.index).toBe(6);
    c.move('down');
    expect(c.index).toBe(0);
  });

  it('handles the ragged last row', () => {
    const c = grid();
    c.set(2);
    c.move('up'); // column 2 has no row-2 cell → row 1
    expect(c.index).toBe(5);
    c.move('down'); // below 5 is missing → wraps to top of column
    expect(c.index).toBe(2);
    c.set(7);
    c.move('right'); // last row has 2 items → wraps to 6
    expect(c.index).toBe(6);
    c.move('left');
    expect(c.index).toBe(7);
  });

  it('skips disabled cells in the direction of travel', () => {
    const c = new GridCursor(8, 3, (i) => i !== 1);
    c.move('right');
    expect(c.index).toBe(2);
  });
});

describe('Typewriter', () => {
  const idle = { confirmPressed: false, confirmHeld: false, backPressed: false };
  const press = { ...idle, confirmPressed: true };

  it('reveals at chars/second and advances pages on press', () => {
    const t = new Typewriter(['Hello', 'World'], { charsPerSecond: 10 });
    t.update(0.25, idle);
    expect(t.visibleText).toBe('He');
    t.update(1, idle);
    expect(t.pageComplete).toBe(true);
    t.update(0, press);
    expect(t.page).toBe(1);
    expect(t.visibleText).toBe('');
  });

  it('holding confirm speeds up; a press while typing does not skip', () => {
    const t = new Typewriter(['abcdefghij'], { charsPerSecond: 10, fastMultiplier: 5 });
    t.update(0.1, { ...idle, confirmHeld: true });
    expect(t.visibleText).toBe('abcde');
    t.update(0, press);
    expect(t.page).toBe(0);
    expect(t.pageComplete).toBe(false);
  });

  it('back finishes the page instantly; last confirm finishes', () => {
    const t = new Typewriter(['abcdefghij']);
    t.update(0, { ...idle, backPressed: true });
    expect(t.visibleText).toBe('abcdefghij');
    expect(t.done).toBe(false);
    t.update(0, press);
    expect(t.done).toBe(true);
  });

  it('empty dialog is done immediately', () => {
    expect(new Typewriter([]).done).toBe(true);
  });
});

describe('FocusStack', () => {
  function setup() {
    const log: string[] = [];
    let suppressed = 0;
    const input: UiInput = {
      direction: () => undefined,
      confirmPressed: () => false,
      confirmHeld: () => false,
      backPressed: () => false,
      pointerPressed: () => click,
      suppressHeld: () => void suppressed++,
    };
    let click: { x: number; y: number } | undefined;
    const widget = (id: string): Widget<string> => ({
      view: id,
      focus: () => log.push(`${id}:focus`),
      blur: () => log.push(`${id}:blur`),
      handleInput: () => log.push(`${id}:input`),
      update: () => log.push(`${id}:update`),
    });
    const attached: string[] = [];
    const stack = new FocusStack<string>(
      { attach: (v) => attached.push(v), detach: (v) => attached.splice(attached.indexOf(v), 1) },
      input,
    );
    return {
      stack,
      log,
      widget,
      attached,
      suppressed: () => suppressed,
      clickAt: (x: number, y: number) => (click = { x, y }),
      noClick: () => (click = undefined),
    };
  }

  it('only the top widget gets input; all update', () => {
    const { stack, log, widget } = setup();
    stack.push(widget('root'));
    stack.push(widget('sub'));
    log.length = 0;
    stack.update(1 / 60);
    expect(log).toEqual(['sub:input', 'root:update', 'sub:update']);
  });

  it('focus moves on push/pop and held keys are suppressed', () => {
    const { stack, log, widget, suppressed } = setup();
    stack.push(widget('root'));
    stack.push(widget('sub'));
    stack.pop();
    expect(log).toEqual(['root:focus', 'root:blur', 'sub:focus', 'sub:blur', 'root:focus']);
    expect(suppressed()).toBe(3);
  });

  it('remove() also removes widgets above; onEmpty fires', () => {
    const { stack, widget, attached } = setup();
    let empty = false;
    stack.onEmpty = () => (empty = true);
    const root = widget('root');
    stack.push(root);
    stack.push(widget('a'));
    stack.push(widget('b'));
    stack.remove(root);
    expect(attached).toEqual([]);
    expect(stack.size).toBe(0);
    expect(empty).toBe(true);
  });

  describe('click outside', () => {
    /** Widget occupying [x0, x1) horizontally; `closable` decides whether dismiss closes it. */
    function boxed(
      ctx: ReturnType<typeof setup>,
      id: string,
      x0: number,
      x1: number,
      closable = true,
    ): Widget<string> {
      const w: Widget<string> = {
        ...ctx.widget(id),
        contains: (x) => x >= x0 && x < x1,
        dismiss: () => {
          ctx.log.push(`${id}:dismiss`);
          if (closable) ctx.stack.remove(w);
        },
      };
      return w;
    }

    it('click on empty space closes nested menus down to a root that refuses', () => {
      const ctx = setup();
      ctx.stack.push(boxed(ctx, 'root', 0, 100, false));
      ctx.stack.push(boxed(ctx, 'sub', 100, 200));
      ctx.stack.push(boxed(ctx, 'subsub', 200, 300));
      ctx.log.length = 0;
      ctx.clickAt(500, 0);
      ctx.stack.update(1 / 60);
      expect(ctx.stack.size).toBe(1);
      expect(ctx.log.filter((l) => l.endsWith('dismiss'))).toEqual([
        'subsub:dismiss',
        'sub:dismiss',
        'root:dismiss',
      ]);
      // The click was used for dismissing; no widget handled it as input this step.
      expect(ctx.log.some((l) => l.endsWith(':input'))).toBe(false);
    });

    it('click on a parent menu closes only the menus above it', () => {
      const ctx = setup();
      ctx.stack.push(boxed(ctx, 'root', 0, 100, false));
      ctx.stack.push(boxed(ctx, 'sub', 100, 200));
      ctx.stack.push(boxed(ctx, 'subsub', 200, 300));
      ctx.clickAt(150, 0);
      ctx.stack.update(1 / 60);
      expect(ctx.stack.size).toBe(2);
      expect(ctx.stack.top?.view).toBe('sub');
    });

    it('click inside the top widget is normal input', () => {
      const ctx = setup();
      ctx.stack.push(boxed(ctx, 'root', 0, 100, false));
      ctx.stack.push(boxed(ctx, 'sub', 100, 200));
      ctx.log.length = 0;
      ctx.clickAt(150, 0);
      ctx.stack.update(1 / 60);
      expect(ctx.stack.size).toBe(2);
      expect(ctx.log[0]).toBe('sub:input');
    });

    it('widgets without dismiss (dialogs) ignore outside clicks', () => {
      const ctx = setup();
      ctx.stack.push(boxed(ctx, 'root', 0, 100, false));
      ctx.stack.push({ ...ctx.widget('dialog'), contains: () => false });
      ctx.clickAt(500, 0);
      ctx.stack.update(1 / 60);
      expect(ctx.stack.size).toBe(2);
      ctx.noClick();
    });
  });
});

describe('WheelSteps', () => {
  it('turns wheel pixels into whole steps and keeps the rest', () => {
    const w = new WheelSteps(30);
    expect(w.take(100)).toBe(3); // one notch
    expect(w.take(10)).toBe(0); // 10 + 10 left over
    expect(w.take(10)).toBe(1);
    expect(w.take(0)).toBe(0);
  });

  it('adds up small trackpad deltas, and drops them when the direction turns', () => {
    const w = new WheelSteps(30);
    for (let i = 0; i < 5; i++) expect(w.take(5)).toBe(0);
    expect(w.take(5)).toBe(1);
    expect(w.take(20)).toBe(0);
    expect(w.take(-20)).toBe(0); // the 20 down is dropped
    expect(w.take(-10)).toBe(-1);
  });
});
