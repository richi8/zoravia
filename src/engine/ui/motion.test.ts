import { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { UiMotion } from './motion';

describe('UiMotion', () => {
  it('fades a view in, then out and removes it', () => {
    const layer = new Container();
    const m = new UiMotion(layer);
    const v = new Container();
    m.attach(v);
    expect(v.parent).toBe(layer);
    expect(v.alpha).toBe(0);
    m.update(0.2);
    expect(v.alpha).toBe(1);
    expect(v.pivot.y).toBe(0);
    m.detach(v);
    expect(v.parent).toBe(layer); // still fading out
    m.update(0.2);
    expect(v.parent).toBeNull();
    expect(m.active).toBe(0);
  });

  it('keeps a view that is opened again while closing', () => {
    const layer = new Container();
    const m = new UiMotion(layer);
    const v = new Container();
    m.attach(v);
    m.update(1);
    m.detach(v);
    m.update(0.02);
    m.attach(v);
    m.update(1);
    expect(v.parent).toBe(layer);
    expect(v.alpha).toBe(1);
  });
});
