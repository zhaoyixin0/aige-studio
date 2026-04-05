import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScrollingLayers } from '../mechanic/scrolling-layers';
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

describe('ScrollingLayersModule', () => {
  let mod: ScrollingLayers;
  let engine: GameEngine;

  beforeEach(() => {
    mod = new ScrollingLayers('scroll_1', {
      axis: 'horizontal',
      baseSpeed: 200,
      direction: -1,
      layers: [
        { textureId: 'bg_far', ratio: 0.3 },
        { textureId: 'bg_near', ratio: 1.0 },
      ],
    });
    engine = createMockEngine();
    mod.init(engine);
  });

  it('has type "ScrollingLayers"', () => {
    expect(mod.type).toBe('ScrollingLayers');
  });

  it('has a valid schema', () => {
    const schema = mod.getSchema();
    expect(schema.baseSpeed).toBeDefined();
    expect(schema.axis).toBeDefined();
    expect(schema.layers).toBeDefined();
  });

  it('declares correct contracts', () => {
    const contracts = mod.getContracts();
    expect(contracts.emits).toContain('scrolling:update');
    expect(contracts.consumes).toContain('gameflow:pause');
    expect(contracts.consumes).toContain('gameflow:resume');
    expect(contracts.capabilities).toContain('parallax-controller');
  });

  it('does not update when paused', () => {
    mod.update(1);
    const states = mod.getLayerStates();
    for (const s of states) {
      expect(s.offsetX).toBe(0);
    }
  });

  it('updates after gameflow:resume', () => {
    engine.eventBus.emit('gameflow:resume');
    mod.update(1);
    const states = mod.getLayerStates();
    expect(states[1].offsetX).toBeCloseTo(-200, 0);
  });

  it('pauses on gameflow:pause', () => {
    engine.eventBus.emit('gameflow:resume');
    mod.update(0.5);
    engine.eventBus.emit('gameflow:pause');
    mod.update(1);
    // Should not advance further
    const states = mod.getLayerStates();
    expect(states[1].offsetX).toBeCloseTo(-100, 0);
  });

  it('emits scrolling:update with layer states', () => {
    engine.eventBus.emit('gameflow:resume');
    const spy = vi.fn();
    engine.eventBus.on('scrolling:update', spy);
    mod.update(0.1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        layers: expect.any(Array),
      }),
    );
  });

  it('responds to scrolling:set-speed event', () => {
    engine.eventBus.emit('gameflow:resume');
    engine.eventBus.emit('scrolling:set-speed', { speed: 500 });
    mod.update(1);
    const states = mod.getLayerStates();
    expect(states[1].offsetX).toBeCloseTo(-500, 0);
  });

  it('responds to scrolling:set-direction event', () => {
    engine.eventBus.emit('gameflow:resume');
    engine.eventBus.emit('scrolling:set-direction', { direction: 1 });
    mod.update(1);
    const states = mod.getLayerStates();
    expect(states[1].offsetX).toBeCloseTo(200, 0);
  });

  it('getLayerStates returns empty after destroy', () => {
    mod.destroy();
    expect(mod.getLayerStates()).toHaveLength(0);
  });
});
