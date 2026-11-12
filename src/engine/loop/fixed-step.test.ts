import { describe, expect, it } from 'vitest';
import { FpsCounter } from '../debug/fps-counter';
import { FixedStepLoop } from './fixed-step';

function makeLoop(stepHz = 60, maxFrameMs?: number) {
  const updates: number[] = [];
  const alphas: number[] = [];
  const loop = new FixedStepLoop({
    stepHz,
    ...(maxFrameMs === undefined ? {} : { maxFrameMs }),
    update: (dt) => updates.push(dt),
    render: (a) => alphas.push(a),
  });
  return { loop, updates, alphas };
}

describe('FixedStepLoop', () => {
  it('runs exactly one step per 60Hz frame', () => {
    const { loop, updates, alphas } = makeLoop();
    for (let i = 0; i < 600; i++) loop.advance(1000 / 60);
    expect(updates).toHaveLength(600);
    expect(loop.steps).toBe(600);
    expect(alphas).toHaveLength(600);
    expect(updates.every((dt) => dt === 1 / 60)).toBe(true);
  });

  it('step count follows real time regardless of frame rate', () => {
    for (const fps of [30, 60, 75, 144, 240]) {
      const { loop } = makeLoop();
      for (let i = 0; i < fps * 10; i++) loop.advance(1000 / fps); // 10 seconds
      expect(Math.abs(loop.steps - 600)).toBeLessThanOrEqual(1);
    }
  });

  it('accumulates small frames and reports alpha', () => {
    const { loop } = makeLoop(10); // 100ms steps
    expect(loop.advance(40)).toEqual({ steps: 0, alpha: 0.4 });
    expect(loop.advance(70).steps).toBe(1);
    expect(loop.advance(0).alpha).toBeCloseTo(0.1);
  });

  it('clamps long frames (no spiral of death)', () => {
    const { loop } = makeLoop(60, 250);
    expect(loop.advance(10_000).steps).toBe(15);
  });

  it('ignores negative time and reset drops the remainder', () => {
    const { loop } = makeLoop(10);
    expect(loop.advance(-50).steps).toBe(0);
    loop.advance(90);
    loop.reset();
    expect(loop.advance(20).steps).toBe(0);
  });

  it('rejects a bad step rate', () => {
    expect(() => new FixedStepLoop({ stepHz: 0, update: () => {} })).toThrow();
  });
});

describe('FpsCounter', () => {
  it('averages a rolling window and counts slow frames', () => {
    const c = new FpsCounter(4, 1000 / 60);
    expect(c.stats.fps).toBe(0);
    c.record(0); // ignored (first frame)
    for (const ms of [1000, 16, 17, 16, 30]) c.record(ms); // 1000 drops out of the window
    const s = c.stats;
    expect(s.avgMs).toBeCloseTo(19.75);
    expect(s.fps).toBeCloseTo(1000 / 19.75);
    expect(s.maxMs).toBe(30);
    expect(s.slowFrames).toBe(1);
  });
});
