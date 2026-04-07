import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for PixiRenderer float text toggle behavior.
 *
 * The showFloatText param on UIOverlay controls whether SCORING float text
 * (+10, COMBO!, KILL!) is displayed. System announcements (WAVE, LEVEL UP,
 * skill activate) are always shown regardless of the toggle.
 *
 * We test by creating a minimal PixiRenderer, injecting mocks for internal
 * sub-renderers, and verifying spawn calls through EventBus event emission.
 */

import { PixiRenderer } from '../pixi-renderer';
import { EventBus } from '@/engine/core/event-bus';

// --- Helpers ---

function createMockEngine(showFloatText?: boolean) {
  const eventBus = new EventBus();

  const overlayParams: Record<string, unknown> = {
    showScore: true,
    showLives: true,
  };
  if (showFloatText !== undefined) {
    overlayParams.showFloatText = showFloatText;
  }

  const modules: Array<{ type: string; enabled: boolean; getParams: () => Record<string, unknown> }> = [
    {
      type: 'UIOverlay',
      enabled: true,
      getParams: () => overlayParams,
    },
  ];

  return {
    eventBus,
    getConfig: () => ({
      version: '1.0',
      modules: [],
      assets: {},
      canvas: { width: 1080, height: 1920 },
      meta: { name: 'test', description: '', thumbnail: null, createdAt: '', artStyle: 'cartoon', theme: 'fruit' },
    }),
    getModulesByType: (type: string) => modules.filter((m) => m.type === type),
    getAllModules: () => modules,
  };
}

function setupRenderer(): {
  renderer: PixiRenderer;
  spawnSpy: ReturnType<typeof vi.fn>;
} {
  const renderer = new PixiRenderer();

  // Mock internal state to bypass WebGL initialization
  const rAny = renderer as any;
  rAny.initialized = true;

  // Create mock sub-renderers
  const spawnSpy = vi.fn();
  rAny.floatTextRenderer = { spawn: spawnSpy, update: vi.fn(), destroy: vi.fn() };
  rAny.particleRenderer = { burst: vi.fn(), update: vi.fn(), destroy: vi.fn() };
  rAny.soundSynth = { playScore: vi.fn(), playHit: vi.fn(), playCombo: vi.fn(), playGameOver: vi.fn(), destroy: vi.fn() };
  rAny.gameObjectRenderer = { reset: vi.fn(), wireIFramesEvents: vi.fn(), sync: vi.fn(), destroy: vi.fn() };
  rAny.shooterRenderer = { reset: vi.fn(), sync: vi.fn(), flashShield: vi.fn(), applyTweenUpdate: vi.fn(), clearTweenOffset: vi.fn(), destroy: vi.fn() };
  rAny.rpgOverlayRenderer = { reset: vi.fn(), sync: vi.fn(), addDrop: vi.fn(), destroy: vi.fn() };
  rAny.physicsDebugRenderer = { reset: vi.fn(), wire: vi.fn(), sync: vi.fn(), destroy: vi.fn() };
  rAny.parallaxRenderer = { reset: vi.fn(), updateFromStates: vi.fn(), destroy: vi.fn() };
  rAny.hudRenderer = { showRhythmFeedback: vi.fn(), sync: vi.fn() };
  rAny.app = { canvas: null, stage: { addChild: vi.fn() }, renderer: { width: 1080, height: 1920 } };

  return { renderer, spawnSpy };
}

describe('PixiRenderer float text toggle', () => {
  let renderer: PixiRenderer;
  let spawnSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const setup = setupRenderer();
    renderer = setup.renderer;
    spawnSpy = setup.spawnSpy;
  });

  // --- Scoring float text: collision:hit ---

  it('collision:hit spawns float text when showFloatText is true (default)', () => {
    const engine = createMockEngine(); // no explicit showFloatText → defaults to true
    renderer.connectToEngine(engine as any);

    // Simulate a render frame to sync floatTextEnabled from UIOverlay
    (renderer as any).floatTextEnabled = true; // default

    engine.eventBus.emit('collision:hit', { x: 100, y: 200 });
    expect(spawnSpy).toHaveBeenCalledWith(100, 170, '+10', 0xFFD700);
  });

  it('collision:hit does NOT spawn float text when UIOverlay.showFloatText is false', () => {
    const engine = createMockEngine(false);
    renderer.connectToEngine(engine as any);

    // Simulate sync reading showFloatText = false
    (renderer as any).floatTextEnabled = false;

    engine.eventBus.emit('collision:hit', { x: 100, y: 200 });
    expect(spawnSpy).not.toHaveBeenCalled();
  });

  // --- Scoring float text: scorer:update combo ---

  it('scorer:update combo spawns float text when showFloatText is true', () => {
    const engine = createMockEngine();
    renderer.connectToEngine(engine as any);
    (renderer as any).floatTextEnabled = true;

    engine.eventBus.emit('scorer:update', { combo: 3 });
    expect(spawnSpy).toHaveBeenCalledWith(540, 700, expect.stringContaining('COMBO'), expect.any(Number));
  });

  it('scorer:update combo does NOT spawn float text when showFloatText is false', () => {
    const engine = createMockEngine(false);
    renderer.connectToEngine(engine as any);
    (renderer as any).floatTextEnabled = false;

    engine.eventBus.emit('scorer:update', { combo: 5 });
    expect(spawnSpy).not.toHaveBeenCalled();
  });

  // --- System announcements: ALWAYS shown ---

  it('wave:start ALWAYS spawns float text regardless of showFloatText', () => {
    const engine = createMockEngine(false);
    renderer.connectToEngine(engine as any);
    (renderer as any).floatTextEnabled = false;

    engine.eventBus.emit('wave:start', { wave: 2 });
    expect(spawnSpy).toHaveBeenCalledWith(540, 400, 'WAVE 2', 0xFFFFFF);
  });

  it('levelup ALWAYS spawns float text regardless of showFloatText', () => {
    const engine = createMockEngine(false);
    renderer.connectToEngine(engine as any);
    (renderer as any).floatTextEnabled = false;

    engine.eventBus.emit('levelup:levelup', { level: 5 });
    expect(spawnSpy).toHaveBeenCalledWith(540, 600, 'LEVEL UP! Lv.5', 0xFFD700);
  });
});
