import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Jump } from '../mechanic/jump';
import { Gravity } from '../mechanic/gravity';

describe('Jump', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const jump = new Jump('jump-1', params);
    engine.addModule(jump);
    engine.eventBus.emit('gameflow:resume');
    return { engine, jump };
  }

  it('should start grounded at groundY', () => {
    const { jump } = setup({ groundY: 0.8 });
    expect(jump.isGrounded()).toBe(true);
    expect(jump.getY()).toBe(0.8);
  });

  it('should emit jump:start on trigger event', () => {
    const { engine } = setup({ triggerEvent: 'touch:tap' });
    const handler = vi.fn();
    engine.eventBus.on('jump:start', handler);

    engine.eventBus.emit('touch:tap');

    expect(handler).toHaveBeenCalledOnce();
  });

  it('should not double-jump when already airborne', () => {
    const { engine, jump } = setup({ triggerEvent: 'touch:tap' });
    const handler = vi.fn();
    engine.eventBus.on('jump:start', handler);

    engine.eventBus.emit('touch:tap');
    engine.eventBus.emit('touch:tap');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(jump.isGrounded()).toBe(false);
  });

  it('should land after enough update ticks', () => {
    const { engine, jump } = setup({
      jumpForce: 500,
      gravity: 980,
      groundY: 0.8,
      triggerEvent: 'touch:tap',
    });
    const landHandler = vi.fn();
    engine.eventBus.on('jump:land', landHandler);

    engine.eventBus.emit('touch:tap');

    // Simulate many frames until landing
    for (let i = 0; i < 200; i++) {
      jump.update(16); // ~16ms per frame
    }

    expect(jump.isGrounded()).toBe(true);
    expect(jump.getY()).toBe(0.8);
    expect(landHandler).toHaveBeenCalled();
  });

  it('should emit jump:start with player id for Gravity integration', () => {
    const { engine } = setup({ triggerEvent: 'touch:tap' });
    const handler = vi.fn();
    engine.eventBus.on('jump:start', handler);

    engine.eventBus.emit('touch:tap');

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'player' }),
    );
  });
});

describe('Jump + Gravity integration', () => {
  function setupWithGravity(jumpParams: Record<string, any> = {}) {
    const engine = new Engine();
    engine.loadConfig({
      version: '1.0.0',
      meta: { name: 'Test', description: '', thumbnail: null, createdAt: '' },
      canvas: { width: 1080, height: 1920 },
      modules: [],
      assets: {},
    });
    const gravity = new Gravity('gravity-1', { strength: 980, terminalVelocity: 800 });
    const jump = new Jump('jump-1', { groundY: 0.78, jumpForce: 500, gravity: 980, triggerEvent: 'touch:tap', ...jumpParams });
    engine.addModule(gravity);
    engine.addModule(jump);
    engine.eventBus.emit('gameflow:resume');
    return { engine, jump, gravity };
  }

  it('should register player in Gravity system on init', () => {
    const { gravity } = setupWithGravity();
    const obj = gravity.getObject('player');
    expect(obj).toBeDefined();
    expect(obj!.y).toBeCloseTo(0.78 * 1920, 0);
  });

  it('should land on elevated platform instead of groundY', () => {
    const { engine, jump, gravity } = setupWithGravity();

    // Add a platform 80px above ground (within jump height of ~128px)
    // Ground is at 0.78*1920 = 1497.6, platform at 1420
    gravity.addSurface({ id: 'plat-1', x: 0, y: 1420, width: 300, oneWay: false, active: true });

    // Move player X to be over the platform
    const obj = gravity.getObject('player')!;
    gravity.addObject('player', { ...obj, x: 150 });

    // Trigger jump
    engine.eventBus.emit('touch:tap');

    // Run until landing
    for (let i = 0; i < 300; i++) {
      gravity.update(16);
      jump.update(16);
    }

    // Should land on the platform (y=1420) not at groundY (1497.6)
    expect(jump.isGrounded()).toBe(true);
    const landY = jump.getY() * 1920;
    expect(landY).toBeCloseTo(1420, -1); // within 10px
  });

  it('should fall to groundY when no platform is below', () => {
    const { engine, jump, gravity } = setupWithGravity();

    // No platforms — should fall to floorY (groundY in pixels)
    engine.eventBus.emit('touch:tap');

    for (let i = 0; i < 300; i++) {
      gravity.update(16);
      jump.update(16);
    }

    expect(jump.isGrounded()).toBe(true);
    expect(jump.getY()).toBeCloseTo(0.78, 1);
  });
});
