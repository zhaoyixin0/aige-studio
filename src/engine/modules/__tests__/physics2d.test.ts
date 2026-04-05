import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Physics2D } from '../mechanic/physics2d';
import { EventBus } from '@/engine/core/event-bus';
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

describe('Physics2DModule', () => {
  let mod: Physics2D;
  let engine: GameEngine;

  beforeEach(() => {
    mod = new Physics2D('physics2d_1', {
      gravityX: 0,
      gravityY: 9.81,
      pixelsPerMeter: 33.33,
      bodies: [
        {
          entityId: 'ball',
          body: { type: 'dynamic' },
          colliders: [{ shape: { kind: 'Circle', radius: 16 }, density: 1 }],
          x: 540,
          y: 200,
        },
        {
          entityId: 'ground',
          body: { type: 'static' },
          colliders: [{ shape: { kind: 'Box', width: 1080, height: 20 } }],
          x: 540,
          y: 1800,
        },
      ],
    });
    engine = createMockEngine();
    mod.init(engine);
  });

  it('has type "Physics2D"', () => {
    expect(mod.type).toBe('Physics2D');
  });

  it('has a valid schema', () => {
    const schema = mod.getSchema();
    expect(schema.gravityY).toBeDefined();
    expect(schema.pixelsPerMeter).toBeDefined();
  });

  it('declares correct contracts', () => {
    const contracts = mod.getContracts();
    expect(contracts.emits).toContain('physics2d:contact-begin');
    expect(contracts.consumes).toContain('gameflow:pause');
    expect(contracts.consumes).toContain('gameflow:resume');
    expect(contracts.capabilities).toContain('physics2d-provider');
  });

  it('does not update when paused', () => {
    const spy = vi.fn();
    engine.eventBus.on('physics2d:contact-begin', spy);
    mod.update(1 / 60);
    // Paused — no physics step
    expect(spy).not.toHaveBeenCalled();
  });

  it('updates after resume and bodies fall', () => {
    engine.eventBus.emit('gameflow:resume');
    const before = mod.getBodyPosition('ball')!;
    for (let i = 0; i < 30; i++) mod.update(1 / 60);
    const after = mod.getBodyPosition('ball')!;
    expect(after.y).toBeGreaterThan(before.y);
  });

  it('getBodyPosition returns null for unknown entity', () => {
    expect(mod.getBodyPosition('ghost')).toBeNull();
  });

  it('addBody at runtime', () => {
    mod.addBody('newball', { type: 'dynamic' }, [{ shape: { kind: 'Circle', radius: 8 } }], 100, 100);
    expect(mod.getBodyPosition('newball')).not.toBeNull();
  });

  it('removeBody at runtime', () => {
    mod.removeBody('ball');
    expect(mod.getBodyPosition('ball')).toBeNull();
  });

  it('destroy cleans up', () => {
    mod.destroy();
    expect(mod.getBodyPosition('ball')).toBeNull();
  });

  it('responds to physics2d:add-body event', () => {
    engine.eventBus.emit('physics2d:add-body', {
      entityId: 'dynamic_box',
      body: { type: 'dynamic' },
      colliders: [{ shape: { kind: 'Box', width: 32, height: 32 }, density: 1 }],
      x: 200,
      y: 300,
    });
    expect(mod.getBodyPosition('dynamic_box')).not.toBeNull();
  });

  it('responds to physics2d:remove-body event', () => {
    engine.eventBus.emit('physics2d:remove-body', { entityId: 'ball' });
    expect(mod.getBodyPosition('ball')).toBeNull();
  });
});
