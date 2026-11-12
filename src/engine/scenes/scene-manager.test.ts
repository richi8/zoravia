import { describe, expect, it } from 'vitest';
import { SceneManager, type Scene, type Transition } from './scene-manager';

interface FakeView {
  readonly name: string;
}

function setup() {
  const attached: string[] = [];
  const log: string[] = [];
  const manager = new SceneManager<FakeView>({
    attach: (v) => attached.push(v.name),
    detach: (v) => attached.splice(attached.indexOf(v.name), 1),
  });
  const scene = (id: string, extra: Partial<Scene<FakeView>> = {}): Scene<FakeView> => ({
    id,
    view: { name: id },
    enter: () => log.push(`${id}:enter`),
    exit: () => log.push(`${id}:exit`),
    pause: () => log.push(`${id}:pause`),
    resume: () => log.push(`${id}:resume`),
    update: () => log.push(`${id}:update`),
    resize: (w, h) => log.push(`${id}:resize ${w}x${h}`),
    ...extra,
  });
  return { manager, attached, log, scene };
}

function fakeTransition(duration: number) {
  const covers: number[] = [];
  const calls: string[] = [];
  const transition: Transition = {
    duration,
    begin: () => calls.push('begin'),
    setCover: (c) => covers.push(Math.round(c * 100) / 100),
    end: () => calls.push('end'),
  };
  return { transition, covers, calls };
}

describe('SceneManager stack', () => {
  it('push / pop / replace with lifecycle hooks', async () => {
    const { manager, attached, log, scene } = setup();
    manager.resize(800, 600);
    await manager.push(scene('world'));
    await manager.push(scene('menu'));
    expect(attached).toEqual(['world', 'menu']);
    expect(manager.top?.id).toBe('menu');

    await manager.pop();
    await manager.replace(scene('battle'));
    expect(attached).toEqual(['battle']);
    expect(log).toEqual([
      'world:enter',
      'world:resize 800x600',
      'world:pause',
      'menu:enter',
      'menu:resize 800x600',
      'menu:exit',
      'world:resume',
      'world:exit',
      'battle:enter',
      'battle:resize 800x600',
    ]);
  });

  it('only the top scene updates unless updateWhenCovered', async () => {
    const { manager, log, scene } = setup();
    await manager.push(scene('world', { updateWhenCovered: true }));
    await manager.push(scene('hud'));
    await manager.push(scene('menu'));
    log.length = 0;
    manager.update(1 / 60);
    expect(log).toEqual(['world:update', 'menu:update']);
  });

  it('emits scene:changed', async () => {
    const { manager, scene } = setup();
    const events: string[][] = [];
    manager.events.on('scene:changed', (e) => events.push([...e.stack]));
    await manager.push(scene('a'));
    await manager.push(scene('b'));
    await manager.pop();
    expect(events).toEqual([['a'], ['a', 'b'], ['a']]);
  });

  it('pop on an empty stack rejects; the same scene cannot be pushed twice', async () => {
    const { manager, scene } = setup();
    await expect(manager.pop()).rejects.toThrow('stack is empty');
    const a = scene('a');
    await manager.push(a);
    await expect(manager.push(a)).rejects.toThrow('already on the stack');
  });
});

describe('SceneManager transitions', () => {
  it('covers, swaps at full cover, then reveals — driven by update(dt)', async () => {
    const { manager, attached, scene } = setup();
    await manager.push(scene('a'));
    const { transition, covers, calls } = fakeTransition(0.5);
    let done = false;
    const p = manager.replace(scene('b'), { transition }).then(() => (done = true));

    expect(manager.isTransitioning).toBe(true);
    for (let i = 0; i < 2; i++) manager.update(0.25);
    expect(attached).toEqual(['b']); // swapped at full cover
    expect(done).toBe(false);
    for (let i = 0; i < 2; i++) manager.update(0.25);
    await p;
    expect(done).toBe(true);
    expect(manager.isTransitioning).toBe(false);
    expect(covers).toEqual([0, 0.5, 1, 1, 0.5, 0, 0]);
    expect(calls).toEqual(['begin', 'end']);
  });

  it('queues changes requested during a transition', async () => {
    const { manager, attached, scene } = setup();
    await manager.push(scene('a'));
    const { transition } = fakeTransition(0.1);
    const first = manager.replace(scene('b'), { transition });
    const second = manager.push(scene('c'));
    expect(attached).toEqual(['a']);
    for (let i = 0; i < 20 && manager.isTransitioning; i++) manager.update(0.05);
    await Promise.all([first, second]);
    expect(attached).toEqual(['b', 'c']);
  });

  it('zero-duration transition completes immediately', async () => {
    const { manager, attached, scene } = setup();
    const { transition, calls } = fakeTransition(0);
    await manager.push(scene('a'), { transition });
    expect(attached).toEqual(['a']);
    expect(calls).toEqual(['begin', 'end']);
  });

  it('a failing op during a transition rejects and frees the manager', async () => {
    const { manager, scene } = setup();
    const { transition, calls } = fakeTransition(0.1);
    const p = manager.pop({ transition });
    manager.update(0.1);
    await expect(p).rejects.toThrow('stack is empty');
    expect(manager.isTransitioning).toBe(false);
    expect(calls).toEqual(['begin', 'end']);
    await manager.push(scene('a'));
    expect(manager.top?.id).toBe('a');
  });
});
