import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Tween } from '../mechanic/tween';
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

describe('TweenModule', () => {
  let mod: Tween;
  let engine: GameEngine;

  beforeEach(() => {
    mod = new Tween('tween_1', {
      clips: [
        {
          id: 'bounce',
          duration: 0.5,
          tracks: [{ property: 'y', from: 0, to: -50, easing: 'BounceOut' }],
        },
      ],
    });
    engine = createMockEngine();
    mod.init(engine);
  });

  it('has type "Tween"', () => {
    expect(mod.type).toBe('Tween');
  });

  it('has a valid schema', () => {
    const schema = mod.getSchema();
    expect(schema.clips).toBeDefined();
    expect(schema.clips.type).toBe('object');
  });

  it('declares correct contracts', () => {
    const contracts = mod.getContracts();
    expect(contracts.emits).toContain('tween:start');
    expect(contracts.emits).toContain('tween:complete');
    expect(contracts.emits).toContain('tween:update');
    expect(contracts.consumes).toContain('gameflow:pause');
    expect(contracts.consumes).toContain('gameflow:resume');
    expect(contracts.capabilities).toContain('tween-provider');
  });

  it('does not update when gameflow is paused', () => {
    // Default: gameflowPaused = true
    const spy = vi.fn();
    engine.eventBus.on('tween:start', spy);
    mod.startClip('bounce', 'entity_1');
    mod.update(0.1);
    // tween:start fires on startClip but no tween:update
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('updates after gameflow:resume', () => {
    engine.eventBus.emit('gameflow:resume');
    const spy = vi.fn();
    engine.eventBus.on('tween:complete', spy);
    mod.startClip('bounce', 'entity_1');
    mod.update(0.6); // > 0.5 duration
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emits tween:update with property values during playback', () => {
    engine.eventBus.emit('gameflow:resume');
    const spy = vi.fn();
    engine.eventBus.on('tween:update', spy);
    mod.startClip('bounce', 'entity_1');
    mod.update(0.25); // 50% of 0.5s duration
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: 'entity_1',
        properties: expect.objectContaining({ y: expect.any(Number) }),
      }),
    );
  });

  it('pauses active tweens on gameflow:pause', () => {
    engine.eventBus.emit('gameflow:resume');
    mod.startClip('bounce', 'entity_1');
    mod.update(0.2); // partial

    engine.eventBus.emit('gameflow:pause');
    const spy = vi.fn();
    engine.eventBus.on('tween:complete', spy);
    mod.update(1.0); // should not advance
    expect(spy).not.toHaveBeenCalled();
  });

  it('startClip by id from configured clips', () => {
    engine.eventBus.emit('gameflow:resume');
    const spy = vi.fn();
    engine.eventBus.on('tween:start', spy);
    mod.startClip('bounce', 'entity_1');
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ clipId: 'bounce' }));
  });

  it('startClip with unknown clip id does nothing', () => {
    engine.eventBus.emit('gameflow:resume');
    const spy = vi.fn();
    engine.eventBus.on('tween:start', spy);
    mod.startClip('nonexistent', 'entity_1');
    expect(spy).not.toHaveBeenCalled();
  });

  it('responds to tween:trigger event', () => {
    engine.eventBus.emit('gameflow:resume');
    const spy = vi.fn();
    engine.eventBus.on('tween:start', spy);
    engine.eventBus.emit('tween:trigger', { clipId: 'bounce', entityId: 'enemy_1' });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ clipId: 'bounce', entityId: 'enemy_1' }));
  });

  it('stopClip removes active tween', () => {
    engine.eventBus.emit('gameflow:resume');
    mod.startClip('bounce', 'entity_1');
    mod.stopClip('entity_1', 'bounce');
    expect(mod.getActiveCount()).toBe(0);
  });

  it('destroy cleans up all tweens', () => {
    engine.eventBus.emit('gameflow:resume');
    mod.startClip('bounce', 'entity_1');
    mod.destroy();
    expect(mod.getActiveCount()).toBe(0);
  });

  it('getActiveCount returns number of active tweens', () => {
    engine.eventBus.emit('gameflow:resume');
    expect(mod.getActiveCount()).toBe(0);
    mod.startClip('bounce', 'e1');
    expect(mod.getActiveCount()).toBe(1);
  });
});
