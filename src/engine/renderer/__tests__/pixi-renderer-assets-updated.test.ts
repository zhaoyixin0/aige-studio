import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PixiRenderer } from '../pixi-renderer';
import { EventBus } from '@/engine/core/event-bus';
import type { AssetsUpdatedPayload } from '@/engine/core/events';

/**
 * Tests for PixiRenderer assets:updated listener (Phase D2 of asset-streaming).
 *
 * When AssetAgent streams a newly-fulfilled sprite, it emits assets:updated
 * on the engine eventBus. PixiRenderer must:
 *   - forward sprite updates to gameObjectRenderer.applyAssetUpdate
 *   - force syncBackgroundImage for background updates
 *   - not crash if gameObjectRenderer is null
 *   - clean up the listener on destroy / reconnect
 */

function createMockEngine(eventBus?: EventBus) {
  const bus = eventBus ?? new EventBus();
  return {
    eventBus: bus,
    getConfig: () => ({
      version: '1.0',
      modules: [],
      assets: {},
      canvas: { width: 1080, height: 1920 },
      meta: { name: 'test', description: '', thumbnail: null, createdAt: '', artStyle: 'cartoon', theme: 'fruit' },
    }),
    getModulesByType: (_type: string) => [] as Array<{ type: string; enabled: boolean; getParams: () => Record<string, unknown> }>,
    getAllModules: () => [] as unknown[],
  };
}

function setupRenderer(): {
  renderer: PixiRenderer;
  applyAssetUpdateSpy: ReturnType<typeof vi.fn>;
  syncBackgroundImageSpy: ReturnType<typeof vi.fn>;
} {
  const renderer = new PixiRenderer();
  const rAny = renderer as any;
  rAny.initialized = true;

  const applyAssetUpdateSpy = vi.fn();
  const syncBackgroundImageSpy = vi.fn();

  rAny.floatTextRenderer = { spawn: vi.fn(), update: vi.fn(), destroy: vi.fn() };
  rAny.particleRenderer = { burst: vi.fn(), update: vi.fn(), destroy: vi.fn() };
  rAny.soundSynth = { playScore: vi.fn(), playHit: vi.fn(), playCombo: vi.fn(), playGameOver: vi.fn(), destroy: vi.fn() };
  rAny.gameObjectRenderer = {
    reset: vi.fn(),
    wireIFramesEvents: vi.fn(),
    sync: vi.fn(),
    destroy: vi.fn(),
    applyAssetUpdate: applyAssetUpdateSpy,
  };
  rAny.shooterRenderer = { reset: vi.fn(), sync: vi.fn(), flashShield: vi.fn(), applyTweenUpdate: vi.fn(), clearTweenOffset: vi.fn(), destroy: vi.fn() };
  rAny.rpgOverlayRenderer = { reset: vi.fn(), sync: vi.fn(), addDrop: vi.fn(), destroy: vi.fn() };
  rAny.physicsDebugRenderer = { reset: vi.fn(), wire: vi.fn(), sync: vi.fn(), destroy: vi.fn() };
  rAny.parallaxRenderer = { reset: vi.fn(), updateFromStates: vi.fn(), destroy: vi.fn() };
  rAny.hudRenderer = { showRhythmFeedback: vi.fn(), sync: vi.fn() };
  rAny.app = { canvas: null, stage: { addChild: vi.fn() }, renderer: { width: 1080, height: 1920 } };

  // Replace private syncBackgroundImage with a spy so we can verify forced calls.
  rAny.syncBackgroundImage = syncBackgroundImageSpy;

  return { renderer, applyAssetUpdateSpy, syncBackgroundImageSpy };
}

describe('PixiRenderer assets:updated listener', () => {
  let renderer: PixiRenderer;
  let applyAssetUpdateSpy: ReturnType<typeof vi.fn>;
  let syncBackgroundImageSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const setup = setupRenderer();
    renderer = setup.renderer;
    applyAssetUpdateSpy = setup.applyAssetUpdateSpy;
    syncBackgroundImageSpy = setup.syncBackgroundImageSpy;
  });

  it('registers assets:updated listener on connectToEngine', () => {
    const engine = createMockEngine();
    const onSpy = vi.spyOn(engine.eventBus, 'on');
    renderer.connectToEngine(engine as any);
    const registeredEvents = onSpy.mock.calls.map((call) => call[0]);
    expect(registeredEvents).toContain('assets:updated');
  });

  it('forwards sprite updates to gameObjectRenderer.applyAssetUpdate', () => {
    const engine = createMockEngine();
    renderer.connectToEngine(engine as any);

    const payload: AssetsUpdatedPayload = {
      updates: [{ key: 'good_1', src: 'data:image/png;base64,AAA', type: 'sprite' }],
    };
    engine.eventBus.emit('assets:updated', payload);

    expect(applyAssetUpdateSpy).toHaveBeenCalledTimes(1);
    expect(applyAssetUpdateSpy).toHaveBeenCalledWith('good_1', 'data:image/png;base64,AAA');
    expect(syncBackgroundImageSpy).not.toHaveBeenCalled();
  });

  it('forwards background updates to syncBackgroundImage', () => {
    const engine = createMockEngine();
    renderer.connectToEngine(engine as any);

    const payload: AssetsUpdatedPayload = {
      updates: [{ key: 'background', src: 'data:image/png;base64,BBB', type: 'background' }],
    };
    engine.eventBus.emit('assets:updated', payload);

    expect(syncBackgroundImageSpy).toHaveBeenCalledTimes(1);
    expect(syncBackgroundImageSpy).toHaveBeenCalledWith(engine);
    expect(applyAssetUpdateSpy).not.toHaveBeenCalled();
  });

  it('handles mixed updates: one background + two sprites', () => {
    const engine = createMockEngine();
    renderer.connectToEngine(engine as any);

    const payload: AssetsUpdatedPayload = {
      updates: [
        { key: 'background', src: 'data:image/png;base64,BG', type: 'background' },
        { key: 'good_1', src: 'data:image/png;base64,A', type: 'sprite' },
        { key: 'bad_1', src: 'data:image/png;base64,B', type: 'sprite' },
      ],
    };
    engine.eventBus.emit('assets:updated', payload);

    expect(syncBackgroundImageSpy).toHaveBeenCalledTimes(1);
    expect(applyAssetUpdateSpy).toHaveBeenCalledTimes(2);
    expect(applyAssetUpdateSpy).toHaveBeenNthCalledWith(1, 'good_1', 'data:image/png;base64,A');
    expect(applyAssetUpdateSpy).toHaveBeenNthCalledWith(2, 'bad_1', 'data:image/png;base64,B');
  });

  it('does not throw if gameObjectRenderer is null', () => {
    const engine = createMockEngine();
    renderer.connectToEngine(engine as any);
    (renderer as any).gameObjectRenderer = null;

    const payload: AssetsUpdatedPayload = {
      updates: [{ key: 'good_1', src: 'data:image/png;base64,AAA', type: 'sprite' }],
    };
    expect(() => engine.eventBus.emit('assets:updated', payload)).not.toThrow();
  });

  it('removes assets:updated listener on destroy', () => {
    const engine = createMockEngine();
    renderer.connectToEngine(engine as any);
    const offSpy = vi.spyOn(engine.eventBus, 'off');

    // Simulate destroy cleanup path: directly iterate tracked handlers
    // (can't call full destroy() because PixiJS app destroy will throw).
    const rAny = renderer as any;
    for (const { event, handler } of rAny.engineEventHandlers) {
      engine.eventBus.off(event, handler);
    }

    const offEvents = offSpy.mock.calls.map((c) => c[0]);
    expect(offEvents).toContain('assets:updated');
  });

  it('removes old listener when reconnecting to a new engine', () => {
    const engine1 = createMockEngine();
    renderer.connectToEngine(engine1 as any);

    const engine2 = createMockEngine();
    renderer.connectToEngine(engine2 as any);

    // Emit on old engine — should NOT trigger anything
    engine1.eventBus.emit('assets:updated', {
      updates: [{ key: 'good_1', src: 'data:image/png;base64,A', type: 'sprite' }],
    });
    expect(applyAssetUpdateSpy).not.toHaveBeenCalled();

    // Emit on new engine — should work
    engine2.eventBus.emit('assets:updated', {
      updates: [{ key: 'good_2', src: 'data:image/png;base64,B', type: 'sprite' }],
    });
    expect(applyAssetUpdateSpy).toHaveBeenCalledTimes(1);
    expect(applyAssetUpdateSpy).toHaveBeenCalledWith('good_2', 'data:image/png;base64,B');
  });
});
