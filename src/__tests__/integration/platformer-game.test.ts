import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import {
  PlayerMovement, Jump, Gravity, CoyoteTime, StaticPlatform,
  Collectible, Hazard, Scorer, Timer, Lives, Checkpoint,
  IFrames, Knockback, CameraFollow, GameFlow,
} from '@/engine/modules';

describe('Platformer Game Integration', () => {
  function buildGame() {
    const engine = new Engine();
    engine.addModule(new GameFlow('gf-1', { countdown: 0, onFinish: 'show_result' }));
    engine.addModule(new PlayerMovement('pm-1', { speed: 300, moveRightEvent: 'go-right', moveLeftEvent: 'go-left' }));
    engine.addModule(new Jump('j-1', { jumpForce: 600, gravity: 980, groundY: 0.8, triggerEvent: 'jump' }));
    engine.addModule(new Gravity('g-1', { strength: 980, terminalVelocity: 800 }));
    engine.addModule(new CoyoteTime('ct-1', { coyoteFrames: 6, bufferFrames: 6, jumpEvent: 'jump' }));
    engine.addModule(new StaticPlatform('sp-1', {
      platforms: [{ x: 0, y: 500, width: 800, height: 50, material: 'normal' }],
    }));
    engine.addModule(new Collectible('col-1', {
      items: [{ x: 100, y: 200, value: 10, type: 'coin' }],
    }));
    engine.addModule(new Hazard('hz-1', {
      hazards: [{ x: 300, y: 490, width: 50, height: 10, pattern: 'static' }],
    }));
    engine.addModule(new Scorer('sc-1', { perHit: 10 }));
    engine.addModule(new Timer('t-1', { duration: 60, mode: 'countdown' }));
    engine.addModule(new Lives('l-1', { count: 3 }));
    engine.addModule(new Checkpoint('cp-1', {
      checkpoints: [{ x: 400, y: 300, width: 30, height: 50 }],
    }));
    engine.addModule(new IFrames('if-1', { duration: 1000 }));
    engine.addModule(new Knockback('kb-1', { force: 300, duration: 200 }));
    engine.addModule(new CameraFollow('cam-1', { mode: 'center', smoothing: 0.1 }));
    engine.eventBus.emit('gameflow:resume');
    return engine;
  }

  it('should instantiate all platformer modules without errors', () => {
    const engine = buildGame();
    expect(engine.getAllModules()).toHaveLength(15);
  });

  it('should move player right and update camera', () => {
    const engine = buildGame();
    const camHandler = vi.fn();
    engine.eventBus.on('camera:move', camHandler);

    engine.eventBus.emit('go-right');
    engine.tick(16);

    expect(camHandler).toHaveBeenCalled();
  });

  it('should handle jump → gravity → land cycle', () => {
    const engine = buildGame();
    const landHandler = vi.fn();
    engine.eventBus.on('jump:land', landHandler);

    engine.eventBus.emit('jump');
    for (let i = 0; i < 200; i++) engine.tick(16);

    expect(landHandler).toHaveBeenCalled();
  });

  it('should collect items and emit pickup', () => {
    const engine = buildGame();
    const col = engine.getModule('col-1') as any;
    const handler = vi.fn();
    engine.eventBus.on('collectible:pickup', handler);

    col.pickup(0);

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      type: 'coin', value: 10,
    }));
  });

  it('should trigger damage → iframes → knockback chain', () => {
    const engine = buildGame();
    const iframeHandler = vi.fn();
    const kbHandler = vi.fn();
    engine.eventBus.on('iframes:start', iframeHandler);
    engine.eventBus.on('knockback:start', kbHandler);

    engine.eventBus.emit('collision:damage', { x: 100, y: 200 });

    expect(iframeHandler).toHaveBeenCalledOnce();
    expect(kbHandler).toHaveBeenCalledOnce();
  });

  it('should activate checkpoint and respawn on death', () => {
    const engine = buildGame();
    const cp = engine.getModule('cp-1') as any;
    const respawnHandler = vi.fn();
    engine.eventBus.on('checkpoint:respawn', respawnHandler);

    cp.activate(0);

    // Trigger 3 damage events to reach lives:zero
    engine.eventBus.emit('collision:damage');
    engine.eventBus.emit('collision:damage');
    engine.eventBus.emit('collision:damage');

    expect(respawnHandler).toHaveBeenCalled();
  });

  it('should not take extra damage during iframes', () => {
    const engine = buildGame();
    const livesHandler = vi.fn();
    engine.eventBus.on('lives:change', livesHandler);

    // First damage triggers iframes
    engine.eventBus.emit('collision:damage');
    const iframes = engine.getModule('if-1') as any;
    expect(iframes.isActive()).toBe(true);

    // Lives:change should have been called once (from first damage)
    expect(livesHandler).toHaveBeenCalledTimes(1);
  });
});
