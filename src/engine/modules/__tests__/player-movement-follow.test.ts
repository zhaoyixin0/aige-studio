import { describe, it, expect } from 'vitest';
import { Engine } from '@/engine/core/engine';
import { PlayerMovement } from '../mechanic/player-movement';

function setup(params: Record<string, any> = {}) {
  const engine = new Engine();
  engine.loadConfig({
    version: '1.0.0',
    meta: { name: 'T', description: '', thumbnail: null, createdAt: '' },
    canvas: { width: 1080, height: 1920 },
    modules: [],
    assets: {},
  });

  const pm = new PlayerMovement('pm_1', {
    mode: 'follow',
    followSpeed: 0.15,
    defaultY: 0.85,
    ...params,
  });
  pm.init(engine);
  // Resume game flow so update() actually runs
  engine.eventBus.emit('gameflow:resume');
  return { engine, pm };
}

// ═══════════════════════════════════════════════════════════════
// Bug fix: Follow mode + continuousEvent should NOT dual-listen
// ═══════════════════════════════════════════════════════════════

describe('PlayerMovement follow mode — no dual-listener conflict', () => {
  it('follow + touch continuousEvent should lerp, not snap', () => {
    const { engine, pm } = setup({ continuousEvent: 'input:touch:position' });

    // Touch at x=300 (canvas coords)
    engine.eventBus.emit('input:touch:position', { x: 300, y: 1600 });
    pm.update(16);

    // Should be partway from center (540) toward 300, NOT at 300
    expect(pm.getX()).toBeGreaterThan(300);
    expect(pm.getX()).toBeLessThan(540);
  });

  it('follow + touch should NOT multiply canvas coords by canvasWidth', () => {
    const { engine, pm } = setup({ continuousEvent: 'input:touch:position' });

    engine.eventBus.emit('input:touch:position', { x: 540, y: 1600 });
    pm.update(16);
    pm.update(16);
    pm.update(16);

    // x should approach 540, NOT 540*1080=583200
    expect(pm.getX()).toBeLessThan(1080);
    expect(pm.getX()).toBeGreaterThan(400);
  });

  it('follow + face should use canvas coords directly (not normalized)', () => {
    const { engine, pm } = setup({ continuousEvent: 'input:face:move' });

    // FaceInput emits canvas pixels (e.g., x=800 on 1080 canvas)
    engine.eventBus.emit('input:face:move', { x: 800, y: 900 });
    pm.update(16);

    // Should approach 800, not 800*1080
    expect(pm.getX()).toBeLessThan(1080);
    expect(pm.getX()).toBeGreaterThan(540); // moved toward 800 from center
  });

  it('follow + device tilt should map -1..1 to canvas', () => {
    const { engine, pm } = setup({ continuousEvent: 'input:device:tilt' });

    // tiltX = 0 → center of canvas (540)
    engine.eventBus.emit('input:device:tilt', { tiltX: 0 });
    pm.update(16);

    expect(pm.getX()).toBe(540); // first frame: no movement from center
  });

  it('follow + audio frequency should map Hz to canvas', () => {
    const { engine, pm } = setup({ continuousEvent: 'input:audio:frequency' });

    // 500 Hz → (500-200)/600 = 0.5 → 540px on 1080 canvas
    engine.eventBus.emit('input:audio:frequency', { frequency: 500 });
    pm.update(16);

    expect(pm.getX()).toBe(540); // first frame: no movement from center
  });
});

// ═══════════════════════════════════════════════════════════════
// Fallback: no continuousEvent should still work with hardcoded touch
// ═══════════════════════════════════════════════════════════════

describe('PlayerMovement follow mode — fallback without continuousEvent', () => {
  it('should track touch position when no continuousEvent is set', () => {
    const { engine, pm } = setup(); // no continuousEvent

    engine.eventBus.emit('input:touch:position', { x: 200, y: 1600 });
    pm.update(16);

    // Should move toward 200 from center (540)
    expect(pm.getX()).toBeLessThan(540);
    expect(pm.getX()).toBeGreaterThan(200);
  });
});

// ═══════════════════════════════════════════════════════════════
// Velocity mode: continuousEvent should directly set x
// ═══════════════════════════════════════════════════════════════

describe('PlayerMovement velocity mode — continuousEvent direct position', () => {
  it('velocity + device tilt should directly set x', () => {
    const engine = new Engine();
    engine.loadConfig({
      version: '1.0.0',
      meta: { name: 'T', description: '', thumbnail: null, createdAt: '' },
      canvas: { width: 1080, height: 1920 },
      modules: [],
      assets: {},
    });

    const pm = new PlayerMovement('pm_1', {
      mode: 'velocity',
      continuousEvent: 'input:device:tilt',
    });
    pm.init(engine);
    engine.eventBus.emit('gameflow:resume');

    // tiltX = 1 → right edge
    engine.eventBus.emit('input:device:tilt', { tiltX: 1 });

    // In velocity mode, x should be set directly (not lerped)
    expect(pm.getX()).toBe(1080);
  });
});
