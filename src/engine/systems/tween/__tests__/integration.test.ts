import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Tween } from '@/engine/modules/mechanic/tween';
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

describe('Tween Integration', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = createMockEngine();
  });

  it('full lifecycle: init → resume → start → update → complete → destroy', () => {
    const mod = new Tween('tween_1', {
      clips: [{ id: 'slide', duration: 0.5, tracks: [{ property: 'x', from: 0, to: 200, easing: 'Linear' }] }],
    });

    mod.init(engine);

    const startSpy = vi.fn();
    const completeSpy = vi.fn();
    engine.eventBus.on('tween:start', startSpy);
    engine.eventBus.on('tween:complete', completeSpy);

    // Start clip while paused — system creates the tween
    mod.startClip('slide', 'enemy_1');
    expect(startSpy).toHaveBeenCalledTimes(1);

    // Update while paused — no progress
    mod.update(0.3);
    expect(completeSpy).not.toHaveBeenCalled();

    // Resume → update
    engine.eventBus.emit('gameflow:resume');
    mod.update(0.6);
    expect(completeSpy).toHaveBeenCalledWith({ entityId: 'enemy_1', clipId: 'slide' });

    // Destroy cleans up
    mod.destroy();
    expect(mod.getActiveCount()).toBe(0);
  });

  it('tween:trigger event starts clip from external event', () => {
    const mod = new Tween('tween_1', {
      clips: [{ id: 'flash', duration: 0.2, tracks: [{ property: 'alpha', from: 1, to: 0, easing: 'Linear' }] }],
    });

    mod.init(engine);
    engine.eventBus.emit('gameflow:resume');

    const spy = vi.fn();
    engine.eventBus.on('tween:complete', spy);

    engine.eventBus.emit('tween:trigger', { clipId: 'flash', entityId: 'target_1' });
    mod.update(0.3);

    expect(spy).toHaveBeenCalledWith({ entityId: 'target_1', clipId: 'flash' });
  });

  it('onComplete.eventName fires custom event', () => {
    const mod = new Tween('tween_1', {
      clips: [{
        id: 'fadeout',
        duration: 0.3,
        tracks: [{ property: 'alpha', from: 1, to: 0, easing: 'Linear' }],
        onComplete: { eventName: 'spawner:destroyed' },
      }],
    });

    mod.init(engine);
    engine.eventBus.emit('gameflow:resume');

    const spy = vi.fn();
    engine.eventBus.on('spawner:destroyed', spy);

    mod.startClip('fadeout', 'item_5');
    mod.update(0.4);

    expect(spy).toHaveBeenCalledWith({ entityId: 'item_5' });
  });

  it('registry creates Tween with preset clips', () => {
    const registry = createModuleRegistry();
    const mod = registry.create('Tween', 'tween_test', {
      clips: [{ id: 'test', duration: 1, tracks: [{ property: 'y', from: 0, to: 50, easing: 'SineOut' }] }],
    }) as Tween;

    expect(mod).toBeDefined();
    mod.init(engine);
    engine.eventBus.emit('gameflow:resume');
    mod.startClip('test', 'e1');
    expect(mod.getActiveCount()).toBe(1);
    mod.destroy();
  });

  it('multiple clips in parallel on different entities', () => {
    const mod = new Tween('tween_1', {
      clips: [
        { id: 'bounce', duration: 0.5, tracks: [{ property: 'y', from: 0, to: -30, easing: 'BounceOut' }] },
        { id: 'fade', duration: 0.3, tracks: [{ property: 'alpha', from: 1, to: 0, easing: 'Linear' }] },
      ],
    });

    mod.init(engine);
    engine.eventBus.emit('gameflow:resume');

    mod.startClip('bounce', 'e1');
    mod.startClip('fade', 'e2');
    expect(mod.getActiveCount()).toBe(2);

    mod.update(0.35);
    // fade should complete (0.3s), bounce still active
    expect(mod.getActiveCount()).toBe(1);

    mod.update(0.2);
    expect(mod.getActiveCount()).toBe(0);
    mod.destroy();
  });

  it('pause/resume cycle preserves tween state', () => {
    const mod = new Tween('tween_1', {
      clips: [{ id: 'slide', duration: 1, tracks: [{ property: 'x', from: 0, to: 100, easing: 'Linear' }] }],
    });

    mod.init(engine);
    engine.eventBus.emit('gameflow:resume');
    mod.startClip('slide', 'e1');

    mod.update(0.3); // 30% progress
    expect(mod.getActiveCount()).toBe(1);

    engine.eventBus.emit('gameflow:pause');
    mod.update(0.5); // should not advance
    expect(mod.getActiveCount()).toBe(1);

    engine.eventBus.emit('gameflow:resume');

    const spy = vi.fn();
    engine.eventBus.on('tween:complete', spy);
    mod.update(0.8); // should complete (0.3 + 0.8 > 1.0)
    expect(spy).toHaveBeenCalled();

    mod.destroy();
  });
});
