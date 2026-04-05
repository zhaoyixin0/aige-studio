import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Physics2D } from '@/engine/modules/mechanic/physics2d';
import { EventBus } from '@/engine/core/event-bus';
import { createModuleRegistry } from '@/engine/module-setup';
import type { GameEngine } from '@/engine/core/types';

function createMockEngine(): GameEngine {
  const eventBus = new EventBus();
  return {
    eventBus,
    getModule: vi.fn(),
    getModulesByType: vi.fn().mockReturnValue([]),
    getAllModules: vi.fn().mockReturnValue([]),
    getConfig: vi.fn().mockReturnValue({
      version: '1', meta: { name: '', description: '', thumbnail: null, createdAt: '' },
      canvas: { width: 1080, height: 1920 }, modules: [], assets: {},
    }),
    getCanvas: vi.fn().mockReturnValue({ width: 1080, height: 1920 }),
  };
}

describe('Physics2D Integration', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = createMockEngine();
  });

  it('full lifecycle: init → resume → update → contact → destroy', () => {
    const mod = new Physics2D('p2d', {
      gravityY: 9.81,
      bodies: [
        { entityId: 'ground', body: { type: 'static' }, colliders: [{ shape: { kind: 'Box', width: 1080, height: 20 } }], x: 540, y: 500 },
        { entityId: 'ball', body: { type: 'dynamic' }, colliders: [{ shape: { kind: 'Circle', radius: 16 }, density: 1 }], x: 540, y: 300 },
      ],
    });

    mod.init(engine);
    engine.eventBus.emit('gameflow:resume');

    const contactSpy = vi.fn();
    engine.eventBus.on('physics2d:contact-begin', contactSpy);

    for (let i = 0; i < 120; i++) mod.update(1 / 60);

    expect(contactSpy).toHaveBeenCalled();

    mod.destroy();
    expect(mod.getBodyPosition('ball')).toBeNull();
  });

  it('runtime body add/remove via events', () => {
    const mod = new Physics2D('p2d', { gravityY: 9.81 });
    mod.init(engine);

    engine.eventBus.emit('physics2d:add-body', {
      entityId: 'box', body: { type: 'dynamic' },
      colliders: [{ shape: { kind: 'Box', width: 32, height: 32 }, density: 1 }],
      x: 100, y: 100,
    });
    expect(mod.getBodyPosition('box')).not.toBeNull();

    engine.eventBus.emit('physics2d:remove-body', { entityId: 'box' });
    expect(mod.getBodyPosition('box')).toBeNull();

    mod.destroy();
  });

  it('pause stops physics, resume continues', () => {
    const mod = new Physics2D('p2d', {
      gravityY: 9.81,
      bodies: [{ entityId: 'ball', body: { type: 'dynamic' }, colliders: [{ shape: { kind: 'Circle', radius: 16 }, density: 1 }], x: 540, y: 200 }],
    });

    mod.init(engine);
    engine.eventBus.emit('gameflow:resume');

    for (let i = 0; i < 10; i++) mod.update(1 / 60);
    const midY = mod.getBodyPosition('ball')!.y;

    engine.eventBus.emit('gameflow:pause');
    for (let i = 0; i < 30; i++) mod.update(1 / 60);
    const pausedY = mod.getBodyPosition('ball')!.y;
    expect(pausedY).toBeCloseTo(midY, 0);

    engine.eventBus.emit('gameflow:resume');
    for (let i = 0; i < 10; i++) mod.update(1 / 60);
    const resumedY = mod.getBodyPosition('ball')!.y;
    expect(resumedY).toBeGreaterThan(midY);

    mod.destroy();
  });

  it('registry creates Physics2D module', () => {
    const registry = createModuleRegistry();
    const mod = registry.create('Physics2D', 'p2d_test', { gravityY: 9.81 }) as Physics2D;
    expect(mod).toBeDefined();
    expect(mod.type).toBe('Physics2D');
    mod.init(engine);
    mod.destroy();
  });

  it('bouncing ball with restitution', () => {
    const mod = new Physics2D('p2d', {
      gravityY: 9.81,
      bodies: [
        { entityId: 'floor', body: { type: 'static' }, colliders: [{ shape: { kind: 'Box', width: 1080, height: 20 }, restitution: 1 }], x: 540, y: 800 },
        { entityId: 'ball', body: { type: 'dynamic' }, colliders: [{ shape: { kind: 'Circle', radius: 16 }, density: 1, restitution: 1 }], x: 540, y: 200 },
      ],
    });

    mod.init(engine);
    engine.eventBus.emit('gameflow:resume');

    // Let ball fall and bounce
    for (let i = 0; i < 120; i++) mod.update(1 / 60);

    // Ball should still be above the floor (bouncing, not stuck)
    const pos = mod.getBodyPosition('ball')!;
    expect(pos.y).toBeLessThan(800);

    mod.destroy();
  });
});
